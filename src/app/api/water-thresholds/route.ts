import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, isAdmin, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

function numeric(value: unknown) { return value === null || value === undefined || value === '' ? null : Number(value) }

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const where: Record<string, unknown> = {}
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) where.commune = communeFilter
    if (searchParams.get('active') !== 'all') where.active = searchParams.get('active') !== 'false'
    const thresholds = await db.waterThreshold.findMany({ where, orderBy: [{ commune: 'asc' }, { parameter: 'asc' }] })
    return NextResponse.json({ thresholds })
  } catch (error) {
    console.error('GET water-thresholds error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المرجعيات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const parameter = String(body.parameter || '').trim().toUpperCase()
    if (!parameter) return NextResponse.json({ error: 'اسم المؤشر مطلوب' }, { status: 400 })
    const minValue = numeric(body.minValue)
    const maxValue = numeric(body.maxValue)
    if (minValue === null && maxValue === null) return NextResponse.json({ error: 'أدخل حداً أدنى أو أقصى واحداً على الأقل' }, { status: 400 })
    if ((minValue !== null && !Number.isFinite(minValue)) || (maxValue !== null && !Number.isFinite(maxValue)) || (minValue !== null && maxValue !== null && minValue > maxValue)) return NextResponse.json({ error: 'حدود القياس غير صالحة' }, { status: 400 })
    const requestedCommune = String(body.commune || (isAdmin(user) ? 'ALL' : '')).trim()
    const commune = isAdmin(user) && (!requestedCommune || requestedCommune === 'ALL') ? 'ALL' : resolveRecordCommune(user, requestedCommune)
    if (!commune) return NextResponse.json({ error: 'حدد جماعة مرجعية واحدة' }, { status: 400 })
    const existing = await db.waterThreshold.findUnique({ where: { commune_parameter: { commune, parameter } } })
    if (existing) return NextResponse.json({ error: 'هذه المرجعية موجودة مسبقاً لهذه الجماعة' }, { status: 409 })
    const threshold = await db.waterThreshold.create({ data: { commune, parameter, label: String(body.label || parameter), unit: String(body.unit || ''), minValue, maxValue, active: body.active !== false, notes: String(body.notes || '') } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_THRESHOLD', entityId: threshold.id, commune, details: { parameter, minValue, maxValue } })
    return NextResponse.json(threshold, { status: 201 })
  } catch (error) {
    console.error('POST water-thresholds error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ المرجعية' }, { status: 500 })
  }
}
