import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const statuses = new Set(['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'])

function parseWaterClosureSetting(value: string | null | undefined) {
  try {
    const parsed: unknown = value ? JSON.parse(value) : {}
    const root = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    const water = root.water && typeof root.water === 'object' && !Array.isArray(root.water) ? root.water as Record<string, unknown> : {}
    return water.requireClosureNote !== false
  } catch {
    return true
  }
}

function parseDateField(value: unknown, current: Date | null) {
  if (value === undefined) return { value: current, invalid: false }
  if (value === null || value === '') return { value: null, invalid: false }
  const date = new Date(String(value))
  return { value: Number.isNaN(date.getTime()) ? current : date, invalid: Number.isNaN(date.getTime()) }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.waterAction.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا التدخل' }, { status: 403 })
    const body = await request.json() as Record<string, unknown>
    const status = body.status === undefined ? existing.status : String(body.status)
    if (!statuses.has(status)) return NextResponse.json({ error: 'حالة التدخل غير صالحة' }, { status: 400 })
    const executionStatuses = new Set(['COMPLETED', 'VERIFIED', 'CLOSED'])
    const executionStarted = executionStatuses.has(status) && !executionStatuses.has(existing.status)
    const executedField = body.executedDate === undefined && executionStarted ? { value: new Date(), invalid: false } : parseDateField(body.executedDate, existing.executedDate)
    const plannedField = parseDateField(body.plannedDate, existing.plannedDate)
    const followUpField = parseDateField(body.followUpDate, existing.followUpDate)
    if (executedField.invalid || plannedField.invalid || followUpField.invalid) return NextResponse.json({ error: 'أحد تواريخ الإجراء غير صالح' }, { status: 400 })
    if (status === 'CLOSED') {
      const settingsRow = await db.communeSettings.findUnique({ where: { commune: existing.commune }, select: { settings: true } })
      const requiresClosureNote = parseWaterClosureSetting(settingsRow?.settings)
      const outcome = body.outcome === undefined ? existing.outcome : String(body.outcome)
      if (requiresClosureNote && !outcome.trim()) return NextResponse.json({ error: 'أدخل نتيجة التنفيذ أو ملاحظة الإغلاق قبل إغلاق الإجراء' }, { status: 400 })
    }
    const executedDate = executedField.value
    const plannedDate = plannedField.value
    const followUpDate = followUpField.value
    const closedAt = status === 'CLOSED' ? existing.closedAt || new Date() : null
    const updated = await db.waterAction.update({ where: { id }, data: { status, responsible: body.responsible === undefined ? existing.responsible : String(body.responsible), plannedDate, executedDate, followUpDate, measures: body.measures === undefined ? existing.measures : String(body.measures), outcome: body.outcome === undefined ? existing.outcome : String(body.outcome), observation: body.observation === undefined ? existing.observation : String(body.observation), closedAt } })
    await recordActivity({ user, action: status !== existing.status ? 'STATUS_CHANGE' : 'UPDATE', entityType: 'WATER_ACTION', entityId: id, commune: existing.commune, details: { reference: existing.reference, from: existing.status, to: status } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT water-action error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث التدخل' }, { status: 500 })
  }
}
