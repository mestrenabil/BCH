import { db } from '@/lib/db'
import { canAccessCommune, isAdmin, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'

const RECOMMENDATIONS = new Set(['PENDING', 'FAVORABLE', 'FAVORABLE_RESERVATIONS', 'UNFAVORABLE'])
const VALIDATION_STATUSES = new Set(['PENDING', 'APPROVED', 'REJECTED'])
const VISIT_STATUSES = new Set(['PLANNED', 'COMPLETED', 'CANCELLED'])

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.committeeVisit.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'زيارة اللجنة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json() as Record<string, unknown>
    const data: Record<string, unknown> = {}
    for (const field of ['inspectionNotes', 'findingsJson', 'reservations', 'correctiveActions', 'notes', 'participantsJson']) {
      if (body[field] !== undefined) data[field] = typeof body[field] === 'string' ? body[field].trim().slice(0, 10000) : '[]'
    }
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !VISIT_STATUSES.has(body.status)) return NextResponse.json({ error: 'حالة الزيارة غير صالحة' }, { status: 400 })
      data.status = body.status
    }
    if (body.recommendation !== undefined) {
      if (typeof body.recommendation !== 'string' || !RECOMMENDATIONS.has(body.recommendation)) return NextResponse.json({ error: 'توصية اللجنة غير صالحة' }, { status: 400 })
      data.recommendation = body.recommendation
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
    const finalRecommendation = typeof body.recommendation === 'string' ? body.recommendation : existing.recommendation
    if (finalValidation && finalRecommendation === 'PENDING') return NextResponse.json({ error: 'يجب تحديد توصية اللجنة قبل المصادقة' }, { status: 400 })

    const visit = await db.committeeVisit.update({ where: { id }, data })
    if (visit.dossierId && finalValidation) {
      await db.authorizationDossier.update({ where: { id: visit.dossierId }, data: { opinionStatus: finalRecommendation, opinionDate: new Date(), opinionNotes: visit.inspectionNotes, reservations: visit.reservations, authorizedBy: user.nom, status: finalRecommendation === 'UNFAVORABLE' ? 'REJECTED' : finalRecommendation === 'PENDING' ? 'UNDER_REVIEW' : 'OPINION_ISSUED' } })
    }
    await recordActivity({ user, action: finalValidation ? 'STATUS_CHANGE' : 'UPDATE', entityType: 'COMMITTEE_VISIT', entityId: id, commune: existing.commune, details: { reference: existing.reference, recommendation: visit.recommendation, validationStatus: visit.validationStatus, validatedBy: visit.validatedBy } })
    return NextResponse.json(visit)
  } catch (error) {
    console.error('PUT committee visit error:', error)
    return NextResponse.json({ error: 'تعذر تحديث زيارة اللجنة' }, { status: 500 })
  }
}
