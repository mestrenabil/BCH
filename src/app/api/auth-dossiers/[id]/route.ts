import { db } from '@/lib/db'
import { canAccessCommune, isAdmin, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'

const REQUEST_TYPES = new Set(['COMMERCIAL', 'BUILDING', 'OCCUPANCY', 'CONFORMITY', 'CLASSIFIED'])
const DOSSIER_STATUSES = new Set(['NEW', 'UNDER_REVIEW', 'OPINION_ISSUED', 'CLOSED', 'REJECTED'])
const OPINION_STATUSES = new Set(['PENDING', 'FAVORABLE', 'FAVORABLE_RESERVATIONS', 'UNFAVORABLE', 'ADDITIONAL_INFO'])

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.authorizationDossier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'ملف الترخيص غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json() as Record<string, unknown>
    const data: Record<string, unknown> = {}
    const textFields = ['applicantName', 'applicantCin', 'applicantPhone', 'establishmentName', 'activity', 'quartier', 'adresse', 'rokhasReference', 'opinionNotes', 'reservations', 'competentAuthority', 'legalReference', 'authorizedBy', 'checklistJson', 'notes']
    for (const field of textFields) {
      if (body[field] !== undefined) data[field] = typeof body[field] === 'string' ? body[field].trim().slice(0, 5000) : ''
    }
    if (body.requestType !== undefined) {
      if (typeof body.requestType !== 'string' || !REQUEST_TYPES.has(body.requestType)) return NextResponse.json({ error: 'نوع الطلب غير صالح' }, { status: 400 })
      data.requestType = body.requestType
    }
    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !DOSSIER_STATUSES.has(body.status)) return NextResponse.json({ error: 'حالة الملف غير صالحة' }, { status: 400 })
      if (['OPINION_ISSUED', 'CLOSED', 'REJECTED'].includes(body.status) && !isAdmin(user)) return NextResponse.json({ error: 'إصدار القرار النهائي يتطلب مصادقة المدير العام' }, { status: 403 })
      data.status = body.status
    }
    if (body.opinionStatus !== undefined) {
      if (typeof body.opinionStatus !== 'string' || !OPINION_STATUSES.has(body.opinionStatus)) return NextResponse.json({ error: 'نتيجة الرأي غير صالحة' }, { status: 400 })
      if (body.opinionStatus !== 'PENDING' && !isAdmin(user)) return NextResponse.json({ error: 'اعتماد الرأي يتطلب مصادقة المدير العام' }, { status: 403 })
      data.opinionStatus = body.opinionStatus
      if (body.opinionStatus !== 'PENDING') {
        data.opinionDate = new Date()
        data.authorizedBy = user.nom
        data.status = body.opinionStatus === 'UNFAVORABLE' ? 'REJECTED' : body.opinionStatus === 'ADDITIONAL_INFO' ? 'UNDER_REVIEW' : 'OPINION_ISSUED'
      }
    }

    const updated = await db.authorizationDossier.update({ where: { id }, data })
    await recordActivity({ user, action: 'UPDATE', entityType: 'AUTHORIZATION_DOSSIER', entityId: id, commune: existing.commune, details: { reference: existing.reference, previousStatus: existing.status, status: updated.status, opinionStatus: updated.opinionStatus, manualValidation: isAdmin(user) } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT auth-dossier error:', error)
    return NextResponse.json({ error: 'تعذر تحديث ملف الترخيص' }, { status: 500 })
  }
}
