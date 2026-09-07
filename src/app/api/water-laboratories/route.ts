import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['PUBLIC', 'PRIVATE', 'UNIVERSITY', 'REFERENCE'])
const ACCREDITATION = new Set(['ACCREDITED', 'PENDING', 'EXPIRED', 'UNKNOWN'])

function createReference() {
  const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
  return `LAB-WATER-${new Date().getFullYear()}-${suffix}`
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (searchParams.get('active') === 'true') where.active = true
    const laboratories = await db.waterLaboratory.findMany({ where, orderBy: [{ active: 'desc' }, { name: 'asc' }], take: 500 })
    return NextResponse.json({ laboratories, total: laboratories.length })
  } catch (error) {
    console.error('GET water-laboratories error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المختبرات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune || !String(body.name || '').trim()) return NextResponse.json({ error: 'يرجى تحديد الجماعة واسم المختبر' }, { status: 400 })
    let reference = createReference()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!await db.waterLaboratory.findUnique({ where: { reference }, select: { id: true } })) break
      reference = createReference()
    }
    const turnaroundDays = Number(body.turnaroundDays)
    const laboratory = await db.waterLaboratory.create({
      data: {
        reference,
        commune,
        name: String(body.name).trim(),
        laboratoryType: TYPES.has(body.laboratoryType) ? body.laboratoryType : 'PUBLIC',
        accreditationStatus: ACCREDITATION.has(body.accreditationStatus) ? body.accreditationStatus : 'UNKNOWN',
        accreditationReference: String(body.accreditationReference || ''),
        contactName: String(body.contactName || ''),
        phone: String(body.phone || ''),
        email: String(body.email || ''),
        address: String(body.address || ''),
        turnaroundDays: Number.isFinite(turnaroundDays) ? Math.max(1, Math.round(turnaroundDays)) : 7,
        parameters: String(body.parameters || ''),
        active: body.active !== false,
        notes: String(body.notes || ''),
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_LABORATORY', entityId: laboratory.id, commune, details: { reference, name: laboratory.name } })
    return NextResponse.json(laboratory, { status: 201 })
  } catch (error) {
    console.error('POST water-laboratories error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ المختبر' }, { status: 500 })
  }
}
