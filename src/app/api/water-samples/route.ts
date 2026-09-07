import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `PREL-${year}-${suffix}`
    if (!await db.waterSample.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `PREL-${year}-${Date.now().toString(36).toUpperCase()}`
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
    if (searchParams.get('status')) where.status = searchParams.get('status')
    if (searchParams.get('waterPointId')) where.waterPointId = searchParams.get('waterPointId')
    if (searchParams.get('poolId')) where.poolId = searchParams.get('poolId')
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 500), 1), 1000)
    const samples = await db.waterSample.findMany({ where, orderBy: { sampleDate: 'desc' }, take: limit, include: { waterPoint: { select: { id: true, reference: true, name: true } }, pool: { select: { id: true, reference: true, name: true } }, chainEvents: { orderBy: { occurredAt: 'asc' } } } })
    const total = await db.waterSample.count({ where })
    return NextResponse.json({ samples, total })
  } catch (error) {
    console.error('GET water-samples error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل العينات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { waterPointId, poolId, commune, sampleType, sampleDate, sampleTime, collectorName, volumeMl, containerType, sterile, preservative, transportTemperature, departureAt, laboratoryArrivalAt, laboratory, reason, requestedTests, observation, status } = body
    if (!waterPointId && !poolId) return NextResponse.json({ error: 'يرجى تحديد نقطة المياه أو المسبح' }, { status: 400 })
    const [waterPoint, pool] = await Promise.all([
      waterPointId ? db.waterPoint.findUnique({ where: { id: String(waterPointId) }, select: { id: true, commune: true, reference: true, name: true } }) : null,
      poolId ? db.pool.findUnique({ where: { id: String(poolId) }, select: { id: true, commune: true, reference: true, name: true } }) : null,
    ])
    if (waterPointId && !waterPoint) return NextResponse.json({ error: 'نقطة المياه غير موجودة' }, { status: 404 })
    if (poolId && !pool) return NextResponse.json({ error: 'المسبح غير موجود' }, { status: 404 })
    if (waterPoint && pool && waterPoint.commune !== pool.commune) return NextResponse.json({ error: 'يجب أن تنتمي نقطة المياه والمسبح إلى نفس الجماعة' }, { status: 400 })
    const sourceCommune = waterPoint?.commune || pool?.commune || commune
    const enforcedCommune = resolveRecordCommune(user, commune || sourceCommune)
    if (!enforcedCommune || (waterPoint && waterPoint.commune !== enforcedCommune) || (pool && pool.commune !== enforcedCommune)) return NextResponse.json({ error: 'ليست لديك صلاحية على مصدر العينة المحدد' }, { status: 403 })
    const reference = await createReference()
    const sample = await db.waterSample.create({ data: { reference, waterPointId: waterPoint?.id || null, poolId: pool?.id || null, commune: enforcedCommune, sampleType: String(sampleType || 'DRINKING_WATER'), sampleDate: sampleDate ? new Date(sampleDate) : new Date(), sampleTime: String(sampleTime || ''), collectorName: String(collectorName || user.nom || ''), volumeMl: volumeMl == null || volumeMl === '' ? null : Number(volumeMl), containerType: String(containerType || ''), sterile: sterile === true, preservative: String(preservative || ''), transportTemperature: transportTemperature == null || transportTemperature === '' ? null : Number(transportTemperature), departureAt: departureAt ? new Date(departureAt) : null, laboratoryArrivalAt: laboratoryArrivalAt ? new Date(laboratoryArrivalAt) : null, laboratory: String(laboratory || ''), reason: String(reason || ''), requestedTests: String(requestedTests || ''), observation: String(observation || ''), status: String(status || 'COLLECTED'), chainEvents: { create: { action: String(status || 'COLLECTED'), actorId: user.id, actorName: user.nom, note: 'إنشاء سجل أخذ العينة' } } }, include: { chainEvents: true } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_SAMPLE', entityId: sample.id, commune: enforcedCommune, details: { reference, waterPoint: waterPoint?.reference, pool: pool?.reference } })
    return NextResponse.json(sample, { status: 201 })
  } catch (error) {
    console.error('POST water-samples error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل العينة' }, { status: 500 })
  }
}
