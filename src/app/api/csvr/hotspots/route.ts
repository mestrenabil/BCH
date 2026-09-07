import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const PRIORITIES = new Set(['LOW', 'MODERATE', 'HIGH', 'CRITICAL'])
const STATUSES = new Set(['ACTIVE', 'MONITORING', 'RESOLVED', 'ARCHIVED'])

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const commune = getScopedCommuneFilter(user, searchParams)
    const hotspots = await db.strayAnimalHotspot.findMany({ where: commune ? { commune } : {}, orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }], take: 500 })
    return NextResponse.json({ hotspots })
  } catch (error) {
    console.error('GET csvr/hotspots error:', error)
    return NextResponse.json({ error: 'تعذر تحميل النقاط الساخنة' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const name = String(body.name || '').trim()
    const commune = resolveRecordCommune(user, body.commune)
    if (!name || !commune) return NextResponse.json({ error: 'اسم النقطة والجماعة مطلوبان' }, { status: 400 })
    if (!canAccessCommune(user, commune)) return NextResponse.json({ error: 'الجماعة خارج النطاق المسموح' }, { status: 403 })
    const year = new Date().getFullYear()
    const count = await db.strayAnimalHotspot.count({ where: { reference: { startsWith: `HS-CSVR-${year}-` } } })
    const reference = `HS-CSVR-${year}-${String(count + 1).padStart(4, '0')}`
    const hotspot = await db.strayAnimalHotspot.create({ data: { reference, name: name.slice(0, 200), commune, quartier: String(body.quartier || '').slice(0, 160), location: String(body.location || '').slice(0, 300), latitude: optionalNumber(body.latitude), longitude: optionalNumber(body.longitude), priority: PRIORITIES.has(body.priority) ? body.priority : 'MODERATE', status: STATUSES.has(body.status) ? body.status : 'ACTIVE', reportCount: Math.max(Number.parseInt(body.reportCount, 10) || 0, 0), groupCount: Math.max(Number.parseInt(body.groupCount, 10) || 0, 0), biteCount: Math.max(Number.parseInt(body.biteCount, 10) || 0, 0), interventionCount: Math.max(Number.parseInt(body.interventionCount, 10) || 0, 0), lastReviewDate: optionalDate(body.lastReviewDate), nextReviewDate: optionalDate(body.nextReviewDate), resolutionNotes: String(body.resolutionNotes || '').slice(0, 2000), notes: String(body.notes || '').slice(0, 2000), createdBy: user.nom } })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_HOTSPOT', entityId: hotspot.id, commune, details: { reference, priority: hotspot.priority } })
    return NextResponse.json(hotspot, { status: 201 })
  } catch (error) {
    console.error('POST csvr/hotspots error:', error)
    return NextResponse.json({ error: 'تعذر إنشاء النقطة الساخنة' }, { status: 500 })
  }
}
