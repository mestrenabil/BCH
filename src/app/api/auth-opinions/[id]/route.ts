import { db } from '@/lib/db'
import { canAccessCommune, isAdmin, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'

const RESULTS = new Set(['PENDING', 'FAVORABLE', 'FAVORABLE_RESERVATIONS', 'UNFAVORABLE', 'ADDITIONAL_INFO'])
const VALIDATION_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED'])

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.sanitaryOpinion.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الرأي الصحي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json() as Record<string, unknown>
    const data: Record<string, unknown> = {}
    for (const field of ['observations', 'reservations', 'correctiveActions', 'recommendation', 'legalReference', 'notes']) {
      if (body[field] !== undefined) data[field] = typeof body[field] === 'string' ? body[field].trim().slice(0, 5000) : ''
    }
    if (body.result !== undefined) {
      if (typeof body.result !== 'string' || !RESULTS.has(body.result)) return NextResponse.json({ error: 'نتيجة الرأي غير صالحة' }, { status: 400 })
      data.result = body.result
    }
    if (body.validationStatus !== undefined) {
      if (typeof body.validationStatus !== 'string' || !VALIDATION_STATUSES.has(body.validationStatus)) return NextResponse.json({ error: 'حالة المصادقة غير صالحة' }, { status: 400 })
      if (body.validationStatus !== 'PENDING' && !isAdmin(user)) return NextResponse.json({ error: 'المصادقة النهائية متاحة للمدير العام فقط' }, { status: 403 })
      data.validationStatus = body.validationStatus
      if (body.validationStatus !== 'PENDING') {
        data.validatedBy = user.nom
        data.validatedAt = new Date()
      }
    }
    const finalValidation = body.validationStatus === 'APPROVED' || body.validationStatus === 'REJECTED'
    const finalResult = typeof body.result === 'string' ? body.result : existing.result
    if (finalValidation && finalResult === 'PENDING') return NextResponse.json({ error: 'يجب تحديد نتيجة الرأي قبل المصادقة' }, { status: 400 })

    const opinion = await db.sanitaryOpinion.update({ where: { id }, data })
    if (opinion.dossierId && finalValidation) {
      await db.authorizationDossier.update({ where: { id: opinion.dossierId }, data: { opinionStatus: finalResult, opinionDate: new Date(), opinionNotes: opinion.observations, reservations: opinion.reservations, legalReference: opinion.legalReference, authorizedBy: user.nom, status: finalResult === 'UNFAVORABLE' ? 'REJECTED' : finalResult === 'ADDITIONAL_INFO' ? 'UNDER_REVIEW' : 'OPINION_ISSUED' } })
    }
    await recordActivity({ user, action: finalValidation ? 'STATUS_CHANGE' : 'UPDATE', entityType: 'SANITARY_OPINION', entityId: id, commune: existing.commune, details: { reference: existing.reference, result: opinion.result, validationStatus: opinion.validationStatus, validatedBy: opinion.validatedBy } })
    return NextResponse.json(opinion)
  } catch (error) {
    console.error('PUT auth-opinion error:', error)
    return NextResponse.json({ error: 'تعذر تحديث الرأي الصحي' }, { status: 500 })
  }
}
