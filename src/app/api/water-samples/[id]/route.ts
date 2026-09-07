import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const SAMPLE_STATUSES = new Set(['COLLECTED', 'LABELLED', 'STORED', 'TRANSPORTED', 'RECEIVED', 'ANALYZED', 'RESULT_RECEIVED', 'VALIDATED', 'CANCELLED'])

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.waterSample.findUnique({ where: { id }, include: { chainEvents: { orderBy: { occurredAt: 'asc' } } } })
    if (!existing) return NextResponse.json({ error: 'العينة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذه العينة' }, { status: 403 })

    const body = await request.json() as Record<string, unknown>
    const nextStatus = body.status === undefined ? existing.status : String(body.status)
    if (!SAMPLE_STATUSES.has(nextStatus)) return NextResponse.json({ error: 'حالة العينة غير صالحة' }, { status: 400 })
    const statusChanged = nextStatus !== existing.status
    const result = body.laboratoryResult === undefined ? existing.laboratoryResult : String(body.laboratoryResult || '').trim()
    const resultReceivedAt = nextStatus === 'RESULT_RECEIVED' && !existing.resultReceivedAt ? new Date() : existing.resultReceivedAt
    const validatedAt = nextStatus === 'VALIDATED' && !existing.validatedAt ? new Date() : existing.validatedAt
    const data = {
      status: nextStatus,
      laboratoryResult: result,
      resultReceivedAt,
      validatedBy: nextStatus === 'VALIDATED' ? user.nom : existing.validatedBy,
      validatedAt,
      validationNote: body.validationNote === undefined ? existing.validationNote : String(body.validationNote || '').trim(),
    }
    const updated = await db.waterSample.update({
      where: { id }, data: statusChanged
        ? { ...data, chainEvents: { create: { action: nextStatus, actorId: user.id, actorName: user.nom, note: String(body.note || '') } } }
        : data,
      include: { waterPoint: { select: { id: true, reference: true, name: true } }, pool: { select: { id: true, reference: true, name: true } }, chainEvents: { orderBy: { occurredAt: 'asc' } } },
    })
    await recordActivity({ user, action: statusChanged ? 'STATUS_CHANGE' : 'UPDATE', entityType: 'WATER_SAMPLE', entityId: id, commune: existing.commune, details: { reference: existing.reference, from: existing.status, to: nextStatus, resultUpdated: body.laboratoryResult !== undefined } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT water-sample error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث العينة' }, { status: 500 })
  }
}
