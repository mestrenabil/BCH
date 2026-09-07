import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const conformity = searchParams.get('conformity')
    const waterPointId = searchParams.get('waterPointId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (conformity) where.conformity = conformity
    if (waterPointId) where.waterPointId = waterPointId
    const measurements = await db.waterMeasurement.findMany({
      where, orderBy: { measurementDate: 'desc' }, take: limit,
      include: { waterPoint: { select: { id: true, reference: true, name: true, type: true } }, sample: { select: { id: true, reference: true } }, device: { select: { id: true, reference: true, name: true } } },
    })
    const total = await db.waterMeasurement.count({ where })
    return NextResponse.json({ measurements, total })
  } catch (error) {
    console.error('GET water-measurements error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { waterPointId, sampleId, deviceId, commune, sampleNumber, measurementDate, chlorineResidual, ph, temperature, turbidity, conductivity, labTestsJson, conformity, collectorName, laboratory, notes } = body
    if (!waterPointId) return NextResponse.json({ error: 'يرجى تحديد نقطة المياه' }, { status: 400 })
    const [wp, sample, device] = await Promise.all([
      db.waterPoint.findUnique({ where: { id: waterPointId }, select: { commune: true, reference: true, name: true } }),
      sampleId ? db.waterSample.findUnique({ where: { id: String(sampleId) }, select: { id: true, commune: true, reference: true } }) : null,
      deviceId ? db.waterDevice.findUnique({ where: { id: String(deviceId) }, select: { id: true, commune: true, reference: true, name: true } }) : null,
    ])
    if (!wp) return NextResponse.json({ error: 'نقطة المياه غير موجودة' }, { status: 404 })
    if (sampleId && !sample) return NextResponse.json({ error: 'العينة غير موجودة' }, { status: 404 })
    if (deviceId && !device) return NextResponse.json({ error: 'جهاز القياس غير موجود' }, { status: 404 })
    const sourceCommunes = [wp.commune, sample?.commune, device?.commune].filter(Boolean)
    if (new Set(sourceCommunes).size > 1) return NextResponse.json({ error: 'يجب أن تنتمي النقطة والعينة والجهاز إلى نفس الجماعة' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune || wp.commune)
    if (!enforcedCommune || sourceCommunes.some((sourceCommune) => sourceCommune !== enforcedCommune)) return NextResponse.json({ error: 'ليست لديك صلاحية على مصادر القياس المحددة' }, { status: 403 })
    const values: Record<string, number | null> = { CHLORINE: chlorineResidual == null || chlorineResidual === '' ? null : Number(chlorineResidual), PH: ph == null || ph === '' ? null : Number(ph), TEMPERATURE: temperature == null || temperature === '' ? null : Number(temperature), TURBIDITY: turbidity == null || turbidity === '' ? null : Number(turbidity), CONDUCTIVITY: conductivity == null || conductivity === '' ? null : Number(conductivity) }
    const thresholds = await db.waterThreshold.findMany({ where: { commune: { in: ['ALL', enforcedCommune] }, active: true } })
    const applicable = thresholds.map((threshold) => ({ threshold, value: values[threshold.parameter] ?? values[threshold.parameter.replace('_RESIDUAL', '')] })).filter((item) => item.value !== null && item.value !== undefined && Number.isFinite(item.value))
    const evaluatedConformity = conformity || (applicable.length === 0 ? 'PENDING' : applicable.every(({ threshold, value }) => (threshold.minValue === null || value! >= threshold.minValue) && (threshold.maxValue === null || value! <= threshold.maxValue)) ? 'CONFORM' : 'NON_CONFORM')
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `MES-${year}-${r}`
      if (!await db.waterMeasurement.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `MES-${year}-${Date.now().toString(36).toUpperCase()}`
    const meas = await db.waterMeasurement.create({
      data: { reference, waterPointId, sampleId: sample?.id || null, deviceId: device?.id || null, commune: enforcedCommune, sampleNumber: sampleNumber || '', measurementDate: measurementDate ? new Date(measurementDate) : new Date(), chlorineResidual: values.CHLORINE, ph: values.PH, temperature: values.TEMPERATURE, turbidity: values.TURBIDITY, conductivity: values.CONDUCTIVITY, labTestsJson: labTestsJson || '{}', conformity: evaluatedConformity, collectorName: collectorName || user.nom, laboratory: laboratory || '', notes: notes || '' },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_MEASUREMENT', entityId: meas.id, commune: enforcedCommune, details: { reference: meas.reference, waterPoint: wp.reference } })
    return NextResponse.json(meas, { status: 201 })
  } catch (error) {
    console.error('POST water-measurements error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
