import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const SPECIES = new Set(['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER'])

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validDate(value: unknown) {
  if (!value) return new Date()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const commune = getScopedCommuneFilter(user, searchParams)
    const reports = await db.strayAnimalDeathReport.findMany({ where: commune ? { commune } : {}, orderBy: { reportedAt: 'desc' }, take: 500 })
    return NextResponse.json({ reports })
  } catch (error) {
    console.error('GET csvr/death-reports error:', error)
    return NextResponse.json({ error: 'تعذر تحميل سجل الحيوانات النافقة' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    if (!canAccessCommune(user, commune)) return NextResponse.json({ error: 'الجماعة خارج النطاق المسموح' }, { status: 403 })
    const reportedAt = validDate(body.reportedAt)
    const year = reportedAt.getFullYear()
    const count = await db.strayAnimalDeathReport.count({ where: { reference: { startsWith: `SIG-CSVR-DEATH-${year}-` } } })
    const reference = `SIG-CSVR-DEATH-${year}-${String(count + 1).padStart(5, '0')}`
    const report = await db.strayAnimalDeathReport.create({ data: { reference, reportedAt, species: SPECIES.has(body.species) ? body.species : 'OTHER', quantity: Math.max(Number.parseInt(body.quantity, 10) || 1, 1), commune, quartier: String(body.quartier || '').slice(0, 160), location: String(body.location || '').slice(0, 300), latitude: optionalNumber(body.latitude), longitude: optionalNumber(body.longitude), apparentCause: String(body.apparentCause || '').slice(0, 500), accident: Boolean(body.accident), healthSuspicion: Boolean(body.healthSuspicion), removalDate: body.removalDate ? validDate(body.removalDate) : null, team: String(body.team || '').slice(0, 200), destination: String(body.destination || '').slice(0, 300), handlingMode: String(body.handlingMode || '').slice(0, 200), observations: String(body.observations || '').slice(0, 3000), createdBy: user.nom } })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_DEATH_REPORT', entityId: report.id, commune, details: { reference, species: report.species, healthSuspicion: report.healthSuspicion } })
    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST csvr/death-reports error:', error)
    return NextResponse.json({ error: 'تعذر تسجيل الحيوان النافق' }, { status: 500 })
  }
}
