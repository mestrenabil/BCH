import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set(['PLANNED', 'DONE', 'MISSED', 'CANCELLED'])
const ALLOWED_ROUTES = new Set(['', 'UNKNOWN', 'ID', 'IM'])

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const biteCase = await db.biteCase.findUnique({ where: { id }, select: { id: true, reference: true, commune: true } })
    if (!biteCase) return NextResponse.json({ error: 'حالة العض غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, biteCase.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية للوصول إلى هذه الحالة' }, { status: 403 })
    const steps = await db.biteVaccinationStep.findMany({ where: { biteCaseId: id }, orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }] })
    return NextResponse.json({ biteCase, steps })
  } catch (error) {
    console.error('GET bite-case vaccinations error:', error)
    return NextResponse.json({ error: 'تعذر تحميل خطوات التلقيح' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const biteCase = await db.biteCase.findUnique({ where: { id }, select: { id: true, reference: true, commune: true } })
    if (!biteCase) return NextResponse.json({ error: 'حالة العض غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, biteCase.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذه الحالة' }, { status: 403 })

    const body = await request.json()
    const stepKey = String(body.stepKey || '').trim().slice(0, 60)
    if (!stepKey) return NextResponse.json({ error: 'معرّف خطوة التلقيح مطلوب' }, { status: 400 })
    const status = ALLOWED_STATUS.has(body.status) ? body.status : 'PLANNED'
    const route = ALLOWED_ROUTES.has(String(body.route || '')) ? String(body.route || '') : ''
    const data = {
      label: String(body.label || '').trim().slice(0, 180),
      status,
      scheduledDate: optionalDate(body.scheduledDate),
      administeredDate: optionalDate(body.administeredDate),
      vaccineType: String(body.vaccineType || '').trim().slice(0, 80),
      route,
      lotNumber: String(body.lotNumber || '').trim().slice(0, 80),
      facility: String(body.facility || '').trim().slice(0, 200),
      administeredBy: String(body.administeredBy || '').trim().slice(0, 160),
      notes: String(body.notes || '').trim().slice(0, 2000),
    }
    const step = await db.biteVaccinationStep.upsert({
      where: { biteCaseId_stepKey: { biteCaseId: id, stepKey } },
      create: { biteCaseId: id, stepKey, ...data },
      update: data,
    })
    await recordActivity({ user, action: 'UPDATE', entityType: 'BITE_VACCINATION_STEP', entityId: step.id, commune: biteCase.commune, details: { reference: biteCase.reference, stepKey, status } })
    return NextResponse.json(step)
  } catch (error) {
    console.error('POST bite-case vaccinations error:', error)
    return NextResponse.json({ error: 'تعذر حفظ خطوة التلقيح' }, { status: 500 })
  }
}
