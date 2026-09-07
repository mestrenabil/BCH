import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const STATUSES = new Set(['PLANNED', 'CONTACTED', 'COMPLETED', 'FAILED', 'CANCELLED'])

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.strayAnimalFollowUp.findUnique({ where: { id }, include: { animal: { select: { commune: true, csvrNumber: true } } } })
    if (!existing) return NextResponse.json({ error: 'المتابعة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.animal.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذه المتابعة' }, { status: 403 })
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if (STATUSES.has(body.status)) data.status = body.status
    if ('visitDate' in body) data.visitDate = optionalDate(body.visitDate)
    if ('welfareStatus' in body) data.welfareStatus = String(body.welfareStatus || '').slice(0, 160)
    if ('outcome' in body) data.outcome = String(body.outcome || '').slice(0, 2000)
    if ('notes' in body) data.notes = String(body.notes || '').slice(0, 3000)
    const updated = await db.strayAnimalFollowUp.update({ where: { id }, data })
    await recordActivity({ user, action: 'UPDATE', entityType: 'CSVR_FOLLOW_UP', entityId: id, commune: existing.animal.commune, details: { csvrNumber: existing.animal.csvrNumber, status: updated.status } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH csvr/follow-ups/[id] error:', error)
    return NextResponse.json({ error: 'تعذر تحديث المتابعة' }, { status: 500 })
  }
}
