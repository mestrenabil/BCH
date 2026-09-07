import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, isAdmin, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { syncComplaintDossier } from '@/lib/vigilance-links'

const COMPLAINT_STATUSES = new Set(['EN_ATTENTE', 'EN_COURS', 'TRAITEE', 'REJETEE'])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const complaint = await db.complaint.findUnique({
      where: { id },
      include: { intervention: true, environmentalDossier: { select: { id: true, reference: true, title: true, status: true } }, contacts: { orderBy: { contactedAt: 'desc' } } },
    })

    if (!complaint) {
      return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(authResult.user, complaint.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذه الشكاية' }, { status: 403 })
    }

    const dossier = await db.dossier.findFirst({ where: { complaintId: complaint.id }, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, status: true, dueDate: true, closedAt: true } })
    return NextResponse.json({ ...complaint, dossier: dossier || null })
  } catch (error) {
    console.error('GET complaint error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الشكاية' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const body = await request.json() as Record<string, unknown>

    const existing = await db.complaint.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(authResult.user, existing.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذه الشكاية' }, { status: 403 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['nomCitoyen', 'telephone', 'adresse', 'quartier', 'type', 'description', 'priorite', 'statut', 'interventionId', 'observations']
    if (isAdmin(authResult.user)) allowedFields.push('commune')
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === '' ? null : body[field]
      }
    }

    if (body.statut !== undefined && (typeof body.statut !== 'string' || !COMPLAINT_STATUSES.has(body.statut))) {
      return NextResponse.json({ error: 'حالة الشكاية غير صالحة' }, { status: 400 })
    }
    if (body.observations !== undefined) {
      if (typeof body.observations !== 'string' || body.observations.trim().length > 2_000) {
        return NextResponse.json({ error: 'الملاحظات غير صالحة' }, { status: 400 })
      }
      updateData.observations = body.observations.trim() || null
    }
    if (body.interventionId !== undefined) {
      const interventionId = typeof body.interventionId === 'string' ? body.interventionId.trim() : ''
      if (interventionId) {
        const intervention = await db.intervention.findUnique({ where: { id: interventionId } })
        if (!intervention || intervention.commune !== existing.commune) {
          return NextResponse.json({ error: 'التدخل المختار غير متاح لهذه الشكاية' }, { status: 400 })
        }
      }
      updateData.interventionId = interventionId || null
    }

    // If statut changed to TRAITEE, set dateTraitement
    if (body.statut === 'TRAITEE' && existing.statut !== 'TRAITEE') {
      updateData.dateTraitement = new Date()
    } else if (body.statut !== undefined && body.statut !== 'TRAITEE' && existing.statut === 'TRAITEE') {
      updateData.dateTraitement = null
    }

    const complaint = await db.complaint.update({
      where: { id },
      data: updateData,
      include: { intervention: true, environmentalDossier: { select: { id: true, reference: true, title: true, status: true } }, contacts: { orderBy: { contactedAt: 'desc' } } },
    })
    try {
      await syncComplaintDossier(complaint, authResult.user)
    } catch (linkError) {
      console.error('Sync complaint dossier error:', linkError)
    }

    await recordActivity({
      user: authResult.user,
      action: body.statut && body.statut !== existing.statut ? 'STATUS_CHANGE' : 'UPDATE',
      entityType: 'COMPLAINT',
      entityId: complaint.id,
      commune: complaint.commune,
      details: {
        reference: complaint.reference,
        previousStatus: existing.statut,
        status: complaint.statut,
        interventionId: complaint.interventionId,
      },
    })

    const dossier = await db.dossier.findFirst({ where: { complaintId: complaint.id }, orderBy: { createdAt: 'desc' }, select: { id: true, reference: true, status: true, dueDate: true, closedAt: true } })
    return NextResponse.json({ ...complaint, dossier: dossier || null })
  } catch (error) {
    console.error('PUT complaint error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الشكاية' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const existing = await db.complaint.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(authResult.user, existing.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذه الشكاية' }, { status: 403 })
    }

    await db.complaint.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE complaint error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الشكاية' }, { status: 500 })
  }
}
