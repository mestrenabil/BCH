import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const INSPECTION_STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FOLLOW_UP', 'CLOSED'])
const CONFORMITY = new Set(['PENDING', 'CONFORM', 'PARTIAL', 'NON_CONFORM'])

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `INS-WATER-${year}-${suffix}`
    if (!await db.waterInspection.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `INS-WATER-${year}-${Date.now().toString(36).toUpperCase()}`
}

const sourceSelect = { id: true, reference: true, name: true } as const

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const where: Record<string, unknown> = {}
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) where.commune = communeFilter
    if (searchParams.get('status')) where.status = searchParams.get('status')
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 500), 1), 1000)
    const inspections = await db.waterInspection.findMany({ where, orderBy: { inspectionDate: 'desc' }, take: limit, include: { waterPoint: { select: sourceSelect }, pool: { select: sourceSelect }, sample: { select: { id: true, reference: true } } } })
    const total = await db.waterInspection.count({ where })
    return NextResponse.json({ inspections, total })
  } catch (error) {
    console.error('GET water-inspections error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المعاينات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const waterPointId = typeof body.waterPointId === 'string' && body.waterPointId ? body.waterPointId : null
    const poolId = typeof body.poolId === 'string' && body.poolId ? body.poolId : null
    const sampleId = typeof body.sampleId === 'string' && body.sampleId ? body.sampleId : null
    if (!waterPointId && !poolId) return NextResponse.json({ error: 'يرجى تحديد نقطة المياه أو المسبح' }, { status: 400 })
    const [waterPoint, pool, sample] = await Promise.all([
      waterPointId ? db.waterPoint.findUnique({ where: { id: waterPointId }, select: { id: true, commune: true, reference: true, name: true } }) : null,
      poolId ? db.pool.findUnique({ where: { id: poolId }, select: { id: true, commune: true, reference: true, name: true } }) : null,
      sampleId ? db.waterSample.findUnique({ where: { id: sampleId }, select: { id: true, commune: true, reference: true } }) : null,
    ])
    if (waterPointId && !waterPoint) return NextResponse.json({ error: 'نقطة المياه غير موجودة' }, { status: 404 })
    if (poolId && !pool) return NextResponse.json({ error: 'المسبح غير موجود' }, { status: 404 })
    if (sampleId && !sample) return NextResponse.json({ error: 'العينة غير موجودة' }, { status: 404 })
    const communes = [waterPoint?.commune, pool?.commune, sample?.commune].filter(Boolean)
    if (new Set(communes).size > 1) return NextResponse.json({ error: 'يجب أن تنتمي مصادر المعاينة إلى نفس الجماعة' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, body.commune || communes[0])
    if (!enforcedCommune || communes.some((commune) => commune !== enforcedCommune)) return NextResponse.json({ error: 'ليست لديك صلاحية على مصدر المعاينة المحدد' }, { status: 403 })
    const probability = Math.min(Math.max(Number(body.probability) || 1, 1), 5)
    const severity = Math.min(Math.max(Number(body.severity) || 1, 1), 5)
    const riskScore = Math.min(100, probability * severity * 4)
    const riskLevel = riskScore >= 80 ? 'CRITICAL' : riskScore >= 50 ? 'HIGH' : riskScore >= 20 ? 'MEDIUM' : 'LOW'
    const status = String(body.status || 'COMPLETED')
    const conformity = String(body.conformity || 'PENDING')
    if (!INSPECTION_STATUSES.has(status) || !CONFORMITY.has(conformity)) return NextResponse.json({ error: 'حالة المعاينة أو المطابقة غير صالحة' }, { status: 400 })
    const inspection = await db.waterInspection.create({ data: { reference: await createReference(), waterPointId, poolId, sampleId, commune: enforcedCommune, inspectionDate: body.inspectionDate ? new Date(String(body.inspectionDate)) : new Date(), inspectorName: String(body.inspectorName || user.nom || ''), checklistJson: typeof body.checklistJson === 'string' ? body.checklistJson : JSON.stringify(body.checklist || {}), observation: String(body.observation || ''), probability, severity, riskScore, riskLevel, conformity, correctiveAction: String(body.correctiveAction || ''), followUpDate: body.followUpDate ? new Date(String(body.followUpDate)) : null, status, closedAt: status === 'CLOSED' ? new Date() : null }, include: { waterPoint: { select: sourceSelect }, pool: { select: sourceSelect }, sample: { select: { id: true, reference: true } } } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_INSPECTION', entityId: inspection.id, commune: enforcedCommune, details: { reference: inspection.reference, riskScore, waterPoint: waterPoint?.reference, pool: pool?.reference, sample: sample?.reference } })
    return NextResponse.json(inspection, { status: 201 })
  } catch (error) {
    console.error('POST water-inspections error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل المعاينة' }, { status: 500 })
  }
}
