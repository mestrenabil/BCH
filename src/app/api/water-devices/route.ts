import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, isAdmin, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const reference = `DEV-WATER-${year}-${Math.random().toString(16).slice(2, 8).toUpperCase()}`
    if (!await db.waterDevice.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `DEV-WATER-${year}-${Date.now().toString(36).toUpperCase()}`
}

const pointSelect = { id: true, reference: true, name: true } as const

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const where: Record<string, unknown> = {}
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) where.commune = communeFilter
    const devices = await db.waterDevice.findMany({ where, orderBy: { name: 'asc' }, include: { waterPoint: { select: pointSelect }, calibrations: { orderBy: { calibrationDate: 'desc' }, take: 10 } } })
    return NextResponse.json({ devices })
  } catch (error) {
    console.error('GET water-devices error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الأجهزة' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'اسم الجهاز مطلوب' }, { status: 400 })
    const waterPointId = typeof body.waterPointId === 'string' && body.waterPointId ? body.waterPointId : null
    const point = waterPointId ? await db.waterPoint.findUnique({ where: { id: waterPointId }, select: { id: true, commune: true, reference: true, name: true } }) : null
    if (waterPointId && !point) return NextResponse.json({ error: 'نقطة المياه غير موجودة' }, { status: 404 })
    const requestedCommune = String(body.commune || point?.commune || (isAdmin(user) ? 'ALL' : '')).trim()
    const commune = isAdmin(user) && (!requestedCommune || requestedCommune === 'ALL') ? 'ALL' : resolveRecordCommune(user, requestedCommune)
    if (!commune || (point && point.commune !== commune)) return NextResponse.json({ error: 'ليست لديك صلاحية على جماعة الجهاز' }, { status: 403 })
    const device = await db.waterDevice.create({ data: { reference: await createReference(), commune, waterPointId, name, type: String(body.type || 'MULTIMETER'), serialNumber: String(body.serialNumber || ''), manufacturer: String(body.manufacturer || ''), model: String(body.model || ''), status: String(body.status || 'ACTIVE'), calibrationDueDate: body.calibrationDueDate ? new Date(String(body.calibrationDueDate)) : null, notes: String(body.notes || '') }, include: { waterPoint: { select: pointSelect }, calibrations: true } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_DEVICE', entityId: device.id, commune, details: { reference: device.reference, name } })
    return NextResponse.json(device, { status: 201 })
  } catch (error) {
    console.error('POST water-devices error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الجهاز' }, { status: 500 })
  }
}
