import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const operationTypes = new Set(['CHLORINATION', 'DISINFECTION', 'SHOCK'])
const statuses = new Set(['PLANNED', 'COMPLETED', 'VERIFIED'])
const sourceSelect = { id: true, reference: true, name: true } as const

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `DSV-WATER-${year}-${suffix}`
    if (!await db.waterDisinfectionOperation.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `DSV-WATER-${year}-${Date.now().toString(36).toUpperCase()}`
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

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
    const operations = await db.waterDisinfectionOperation.findMany({ where, orderBy: { operationDate: 'desc' }, take: 500, include: { waterPoint: { select: sourceSelect }, pool: { select: sourceSelect } } })
    const total = await db.waterDisinfectionOperation.count({ where })
    return NextResponse.json({ operations, total })
  } catch (error) {
    console.error('GET water-disinfection error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل سجل التطهير' }, { status: 500 })
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
    if ((!waterPointId && !poolId) || (waterPointId && poolId)) return NextResponse.json({ error: 'حدد نقطة مياه أو مسبحاً واحداً فقط' }, { status: 400 })
    const [waterPoint, pool] = await Promise.all([
      waterPointId ? db.waterPoint.findUnique({ where: { id: waterPointId }, select: { id: true, commune: true, reference: true } }) : null,
      poolId ? db.pool.findUnique({ where: { id: poolId }, select: { id: true, commune: true, reference: true } }) : null,
    ])
    if (waterPointId && !waterPoint) return NextResponse.json({ error: 'نقطة المياه غير موجودة' }, { status: 404 })
    if (poolId && !pool) return NextResponse.json({ error: 'المسبح غير موجود' }, { status: 404 })
    const sourceCommune = waterPoint?.commune || pool?.commune
    const commune = resolveRecordCommune(user, body.commune || sourceCommune)
    if (!commune || sourceCommune !== commune) return NextResponse.json({ error: 'ليست لديك صلاحية على مصدر التطهير المحدد' }, { status: 403 })
    const operationType = String(body.operationType || 'CHLORINATION')
    const status = String(body.status || 'COMPLETED')
    if (!operationTypes.has(operationType) || !statuses.has(status)) return NextResponse.json({ error: 'نوع أو حالة عملية التطهير غير صالحة' }, { status: 400 })
    const operationDate = body.operationDate ? new Date(String(body.operationDate)) : new Date()
    if (Number.isNaN(operationDate.getTime())) return NextResponse.json({ error: 'تاريخ عملية التطهير غير صالح' }, { status: 400 })
    const operation = await db.waterDisinfectionOperation.create({
      data: {
        reference: await createReference(), waterPointId, poolId, commune, operationDate, operationType, status,
        productName: String(body.productName || ''), activeSubstance: String(body.activeSubstance || ''), lotNumber: String(body.lotNumber || ''),
        doseValue: optionalNumber(body.doseValue), doseUnit: String(body.doseUnit || 'mg/L'), treatedVolume: optionalNumber(body.treatedVolume), volumeUnit: String(body.volumeUnit || 'm³'),
        residualBefore: optionalNumber(body.residualBefore), residualAfter: optionalNumber(body.residualAfter), contactTimeMin: optionalNumber(body.contactTimeMin),
        operator: String(body.operator || user.nom || ''), result: String(body.result || ''), observation: String(body.observation || ''),
      },
      include: { waterPoint: { select: sourceSelect }, pool: { select: sourceSelect } },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_DISINFECTION', entityId: operation.id, commune, details: { reference: operation.reference, operationType, status } })
    return NextResponse.json(operation, { status: 201 })
  } catch (error) {
    console.error('POST water-disinfection error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل عملية التطهير' }, { status: 500 })
  }
}
