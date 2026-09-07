import { db } from '@/lib/db'
import { canAccessCommune, isFieldAgent, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'
import { isCoordinateInCommune } from '@/lib/commune-boundaries'

const PRIORITIES = new Set(['URGENTE', 'HAUTE', 'NORMALE', 'BASSE'])
const STATUSES = new Set(['NOUVEAU', 'ASSIGNE', 'EN_ROUTE', 'EN_COURS', 'TERMINE', 'ANNULE'])

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseDate(value: unknown): Date | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const coordinate = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) return undefined
  return coordinate
}

const workOrderInclude = {
  assignedAgent: { select: { id: true, nom: true, prenom: true, telephone: true, fonction: true } },
  complaint: {
    select: {
      id: true,
      reference: true,
      nomCitoyen: true,
      telephone: true,
      adresse: true,
      quartier: true,
      type: true,
      description: true,
      statut: true,
      latitude: true,
      longitude: true,
    },
  },
  intervention: { select: { id: true, reference: true, type: true, adresse: true, statut: true } },
  photos: {
    select: { id: true, originalName: true, mimeType: true, size: true, type: true, caption: true, uploadedBy: true, createdAt: true },
    orderBy: { createdAt: 'desc' as const },
    take: 20,
  },
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const workOrder = await db.workOrder.findUnique({ where: { id }, include: workOrderInclude })
    if (!workOrder) return NextResponse.json({ error: 'أمر العمل غير موجود' }, { status: 404 })
    if (!canAccessCommune(authResult.user, workOrder.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول إلى أمر العمل هذا' }, { status: 403 })
    }
    if (isFieldAgent(authResult.user) && (!authResult.user.agentId || workOrder.assignedAgentId !== authResult.user.agentId)) {
      return NextResponse.json({ error: 'يمكنك الوصول إلى أوامر العمل المسندة إليك فقط' }, { status: 403 })
    }

    return NextResponse.json(workOrder)
  } catch (error) {
    console.error('GET work order error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل أمر العمل' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const existing = await db.workOrder.findUnique({
      where: { id },
      include: { complaint: { select: { id: true, statut: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'أمر العمل غير موجود' }, { status: 404 })
    if (!canAccessCommune(authResult.user, existing.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل أمر العمل هذا' }, { status: 403 })
    }

    const body = await request.json() as Record<string, unknown>
    if (isFieldAgent(authResult.user)) {
      if (!authResult.user.agentId || existing.assignedAgentId !== authResult.user.agentId) {
        return NextResponse.json({ error: 'يمكنك تعديل أوامر العمل المسندة إليك فقط' }, { status: 403 })
      }
      const protectedFields = ['title', 'description', 'priority', 'scheduledFor', 'dueAt', 'assignedAgentId', 'complaintId', 'interventionId']
      if (protectedFields.some((field) => body[field] !== undefined)) {
        return NextResponse.json({ error: 'لا يمكن للعون الميداني تعديل بيانات التخطيط أو الإسناد' }, { status: 403 })
      }
      if (body.status !== undefined) {
        const requestedStatus = text(body.status, 20)
        const allowedNextStatus: Record<string, string> = { NOUVEAU: 'EN_ROUTE', ASSIGNE: 'EN_ROUTE', EN_ROUTE: 'EN_COURS', EN_COURS: 'TERMINE' }
        if (requestedStatus !== allowedNextStatus[existing.status]) {
          return NextResponse.json({ error: 'انتقال حالة أمر العمل غير مسموح' }, { status: 403 })
        }
      }
    }
    const updateData: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = text(body.title, 160)
      if (title.length < 3) return NextResponse.json({ error: 'عنوان أمر العمل قصير جداً' }, { status: 400 })
      updateData.title = title
    }
    if (body.description !== undefined) updateData.description = text(body.description, 2000)
    if (body.completionNotes !== undefined) updateData.completionNotes = text(body.completionNotes, 2000) || null
    if (body.priority !== undefined) {
      const priority = text(body.priority, 20)
      if (!PRIORITIES.has(priority)) return NextResponse.json({ error: 'الأولوية غير صالحة' }, { status: 400 })
      updateData.priority = priority
    }
    if (body.scheduledFor !== undefined) {
      const scheduledFor = parseDate(body.scheduledFor)
      if (scheduledFor === undefined) return NextResponse.json({ error: 'تاريخ البرمجة غير صالح' }, { status: 400 })
      updateData.scheduledFor = scheduledFor
    }
    if (body.dueAt !== undefined) {
      const dueAt = parseDate(body.dueAt)
      if (dueAt === undefined) return NextResponse.json({ error: 'آخر أجل غير صالح' }, { status: 400 })
      updateData.dueAt = dueAt
    }
    if (body.latitude !== undefined) {
      const latitude = parseCoordinate(body.latitude, -90, 90)
      if (latitude === undefined) return NextResponse.json({ error: 'خط العرض غير صالح' }, { status: 400 })
      updateData.latitude = latitude
    }
    if (body.longitude !== undefined) {
      const longitude = parseCoordinate(body.longitude, -180, 180)
      if (longitude === undefined) return NextResponse.json({ error: 'خط الطول غير صالح' }, { status: 400 })
      updateData.longitude = longitude
    }
    if (authResult.user.commune !== 'ALL') {
      const latitude = body.latitude === undefined ? existing.latitude : updateData.latitude as number | null
      const longitude = body.longitude === undefined ? existing.longitude : updateData.longitude as number | null
      if (latitude !== null && longitude !== null && await isCoordinateInCommune(existing.commune, latitude, longitude) === false) {
        return NextResponse.json({ error: 'إحداثيات أمر العمل خارج حدود جماعتك' }, { status: 403 })
      }
    }
    if (body.assignedAgentId !== undefined) {
      const assignedAgentId = text(body.assignedAgentId, 80)
      if (assignedAgentId) {
        const agent = await db.agent.findUnique({ where: { id: assignedAgentId } })
        if (!agent || !agent.actif || agent.commune !== existing.commune) {
          return NextResponse.json({ error: 'العون المختار غير متاح لهذه الجماعة' }, { status: 400 })
        }
      }
      updateData.assignedAgentId = assignedAgentId || null
      if (!body.status && existing.status === 'NOUVEAU' && assignedAgentId) updateData.status = 'ASSIGNE'
    }

    let requestedStatus = ''
    if (body.status !== undefined) {
      requestedStatus = text(body.status, 20)
      if (!STATUSES.has(requestedStatus)) return NextResponse.json({ error: 'حالة أمر العمل غير صالحة' }, { status: 400 })
      updateData.status = requestedStatus
      if (requestedStatus === 'EN_COURS' && !existing.startedAt) updateData.startedAt = new Date()
      if (requestedStatus === 'TERMINE' && !existing.completedAt) updateData.completedAt = new Date()
    }

    const workOrder = await db.$transaction(async (transaction) => {
      const updated = await transaction.workOrder.update({
        where: { id },
        data: updateData,
        include: workOrderInclude,
      })

      if (requestedStatus === 'TERMINE' && existing.complaint && existing.complaint.statut !== 'REJETEE') {
        await transaction.complaint.update({
          where: { id: existing.complaint.id },
          data: { statut: 'TRAITEE', dateTraitement: new Date() },
        })
      }

      return updated
    })

    await recordActivity({
      user: authResult.user,
      action: requestedStatus && requestedStatus !== existing.status ? 'STATUS_CHANGE' : 'UPDATE',
      entityType: 'WORK_ORDER',
      entityId: workOrder.id,
      commune: workOrder.commune,
      details: {
        reference: workOrder.reference,
        previousStatus: existing.status,
        status: workOrder.status,
        priority: workOrder.priority,
        assignedAgentId: workOrder.assignedAgentId,
      },
    })

    return NextResponse.json(workOrder)
  } catch (error) {
    console.error('PUT work order error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث أمر العمل' }, { status: 500 })
  }
}
