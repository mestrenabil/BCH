import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set([
  'NEW', 'ASSIGNED', 'IN_PROGRESS', 'INSPECTED', 'ACTION_REQUIRED',
  'FOLLOW_UP', 'PENDING_VALIDATION', 'CLOSED', 'ARCHIVED',
])
const ALLOWED_EDIT_FIELDS = [
  'office', 'type', 'title', 'description', 'priority',
  'quartier', 'adresse', 'latitude', 'longitude',
  'assignedTo', 'assignedToName', 'dueDate', 'notes',
]

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const dossier = await db.dossier.findUnique({
      where: { id },
      include: {
        events: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!dossier) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    return NextResponse.json({ dossier })
  } catch (error) {
    console.error('GET dossier error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const existing = await db.dossier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json()
    const data: Record<string, unknown> = {}

    // تحديث الحقول المسموحة
    for (const field of ALLOWED_EDIT_FIELDS) {
      if (body[field] !== undefined) {
        if (field === 'dueDate' && body[field]) {
          data[field] = new Date(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    // تغيير الحالة (مع تسجيل حدث timeline)
    let statusEvent: { fromStatus: string; toStatus: string; action: string; reason: string; changedBy: string; changedByName: string; metadata: string } | null = null
    if (body.status !== undefined && body.status !== existing.status) {
      if (!ALLOWED_STATUS.has(body.status)) {
        return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 })
      }
      data.status = body.status
      if (body.status === 'CLOSED' || body.status === 'ARCHIVED') {
        data.closedAt = new Date()
      }
      statusEvent = {
        fromStatus: existing.status,
        toStatus: body.status,
        action: body.status === 'ASSIGNED' && body.assignedTo !== existing.assignedTo ? 'ASSIGN' : 'STATUS_CHANGE',
        reason: body.reason || '',
        changedBy: user.id,
        changedByName: user.nom,
        metadata: JSON.stringify(body.metadata || {}),
      }
    }

    const updated = await db.dossier.update({
      where: { id },
      data: statusEvent
        ? { ...data, events: { create: [statusEvent] } }
        : data,
      include: { events: { orderBy: { createdAt: 'desc' } } },
    })

    if (statusEvent) {
      await recordActivity({
        user,
        action: 'STATUS_CHANGE',
        entityType: 'DOSSIER',
        entityId: id,
        commune: existing.commune,
        details: {
          reference: existing.reference,
          from: statusEvent.fromStatus,
          to: statusEvent.toStatus,
          reason: statusEvent.reason,
        },
      })
    } else {
      await recordActivity({
        user, action: 'UPDATE', entityType: 'DOSSIER', entityId: id,
        commune: existing.commune, details: { reference: existing.reference, fields: Object.keys(data) },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT dossier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const existing = await db.dossier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    await db.dossier.delete({ where: { id } })

    await recordActivity({
      user, action: 'DELETE', entityType: 'DOSSIER', entityId: id,
      commune: existing.commune, details: { reference: existing.reference },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE dossier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
