import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.waterThreshold.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'المرجعية غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذه المرجعية' }, { status: 403 })
    const body = await request.json() as Record<string, unknown>
    const minValue = body.minValue === undefined ? existing.minValue : (body.minValue === '' || body.minValue === null ? null : Number(body.minValue))
    const maxValue = body.maxValue === undefined ? existing.maxValue : (body.maxValue === '' || body.maxValue === null ? null : Number(body.maxValue))
    if ((minValue !== null && !Number.isFinite(minValue)) || (maxValue !== null && !Number.isFinite(maxValue)) || (minValue !== null && maxValue !== null && minValue > maxValue)) return NextResponse.json({ error: 'حدود القياس غير صالحة' }, { status: 400 })
    const threshold = await db.waterThreshold.update({ where: { id }, data: { label: body.label === undefined ? existing.label : String(body.label), unit: body.unit === undefined ? existing.unit : String(body.unit), minValue, maxValue, active: body.active === undefined ? existing.active : body.active === true, notes: body.notes === undefined ? existing.notes : String(body.notes) } })
    await recordActivity({ user, action: 'UPDATE', entityType: 'WATER_THRESHOLD', entityId: id, commune: existing.commune, details: { parameter: existing.parameter } })
    return NextResponse.json(threshold)
  } catch (error) {
    console.error('PUT water-threshold error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل المرجعية' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.waterThreshold.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'المرجعية غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذه المرجعية' }, { status: 403 })
    await db.waterThreshold.delete({ where: { id } })
    await recordActivity({ user, action: 'DELETE', entityType: 'WATER_THRESHOLD', entityId: id, commune: existing.commune, details: { parameter: existing.parameter } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE water-threshold error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المرجعية' }, { status: 500 })
  }
}
