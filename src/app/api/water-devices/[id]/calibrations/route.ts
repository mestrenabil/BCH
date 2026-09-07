import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const device = await db.waterDevice.findUnique({ where: { id } })
    if (!device) return NextResponse.json({ error: 'الجهاز غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, device.commune)) return NextResponse.json({ error: 'ليس لديك صلاحية معايرة هذا الجهاز' }, { status: 403 })
    const body = await request.json() as Record<string, unknown>
    const calibrationDate = body.calibrationDate ? new Date(String(body.calibrationDate)) : new Date()
    const nextDueDate = body.nextDueDate ? new Date(String(body.nextDueDate)) : null
    const result = String(body.result || 'CONFORM')
    if (!['CONFORM', 'NON_CONFORM', 'PENDING'].includes(result)) return NextResponse.json({ error: 'نتيجة المعايرة غير صالحة' }, { status: 400 })
    const calibration = await db.$transaction(async (tx) => {
      const created = await tx.waterDeviceCalibration.create({ data: { deviceId: id, calibrationDate, nextDueDate, performedBy: String(body.performedBy || user.nom || ''), certificateReference: String(body.certificateReference || ''), result, notes: String(body.notes || '') } })
      await tx.waterDevice.update({ where: { id }, data: { calibrationDueDate: nextDueDate, status: result === 'NON_CONFORM' ? 'MAINTENANCE' : device.status } })
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_CALIBRATION', entityId: calibration.id, commune: device.commune, details: { device: device.reference, result, nextDueDate } })
    return NextResponse.json(calibration, { status: 201 })
  } catch (error) {
    console.error('POST water calibration error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل المعايرة' }, { status: 500 })
  }
}
