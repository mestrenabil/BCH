import crypto from 'crypto'
import { db } from '@/lib/db'
import { canAccessCommune, getScopedCommuneFilter, isFieldAgent, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { isCoordinateInCommune } from '@/lib/commune-boundaries'

const PRIORITIES = new Set(['URGENTE', 'HAUTE', 'NORMALE', 'BASSE'])
const STATUSES = new Set(['NOUVEAU', 'ASSIGNE', 'EN_ROUTE', 'EN_COURS', 'TERMINE', 'ANNULE'])
const SLA_HOURS: Record<string, number> = { URGENTE: 4, HAUTE: 24, NORMALE: 72, BASSE: 120 }

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

function workOrderReference(): string {
  return `OT-${new Date().getFullYear()}-${crypto.randomBytes(5).toString('hex').toUpperCase()}`
}

function defaultDueAt(priority: string, scheduledFor: Date | null): Date {
  const baseDate = scheduledFor && scheduledFor > new Date() ? scheduledFor : new Date()
  return new Date(baseDate.getTime() + SLA_HOURS[priority] * 60 * 60 * 1000)
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
    take: 6,
  },
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error

    const { searchParams } = new URL(request.url)
    const status = text(searchParams.get('status'), 20)
    const assignedAgentId = text(searchParams.get('assignedAgentId'), 80)
    const communeFilter = getScopedCommuneFilter(authResult.user, searchParams)

    if (status && !STATUSES.has(status)) {
      return NextResponse.json({ error: 'حالة أمر العمل غير صالحة' }, { status: 400 })
    }

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    const year = Number(searchParams.get('year'))
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) where.createdAt = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
    if (status) where.status = status
    if (isFieldAgent(authResult.user)) {
      if (!authResult.user.agentId) return NextResponse.json({ error: 'حساب العون غير مرتبط بملف ميداني' }, { status: 403 })
      where.assignedAgentId = authResult.user.agentId
    } else if (assignedAgentId) {
      where.assignedAgentId = assignedAgentId
    }

    const workOrders = await db.workOrder.findMany({
      where,
      include: workOrderInclude,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    })

    return NextResponse.json({ workOrders })
  } catch (error) {
    console.error('GET work orders error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل أوامر العمل' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    if (isFieldAgent(user)) {
      return NextResponse.json({ error: 'لا يمكن للعون الميداني إنشاء أوامر عمل' }, { status: 403 })
    }

    const body = await request.json() as Record<string, unknown>
    const commune = resolveRecordCommune(user, text(body.commune, 80))
    const title = text(body.title, 160)
    const description = text(body.description, 2000)
    const priority = text(body.priority, 20) || 'NORMALE'
    const assignedAgentId = text(body.assignedAgentId, 80)
    const complaintId = text(body.complaintId, 80)
    const interventionId = text(body.interventionId, 80)
    const scheduledFor = parseDate(body.scheduledFor)
    const requestedDueAt = parseDate(body.dueAt)
    const latitude = parseCoordinate(body.latitude, -90, 90)
    const longitude = parseCoordinate(body.longitude, -180, 180)

    if (!commune || title.length < 3 || !PRIORITIES.has(priority)) {
      return NextResponse.json({ error: 'يرجى إدخال الجماعة والعنوان والأولوية بصورة صحيحة' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(commune, getTerritoryFilterFromValue(body.territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }
    if (scheduledFor === undefined || requestedDueAt === undefined || latitude === undefined || longitude === undefined) {
      return NextResponse.json({ error: 'التاريخ أو الإحداثيات غير صالحة' }, { status: 400 })
    }
    if (user.commune !== 'ALL' && latitude !== null && longitude !== null && await isCoordinateInCommune(commune, latitude, longitude) === false) {
      return NextResponse.json({ error: 'إحداثيات أمر العمل خارج حدود جماعتك' }, { status: 403 })
    }
    const dueAt = requestedDueAt || defaultDueAt(priority, scheduledFor)

    const [agent, complaint, intervention] = await Promise.all([
      assignedAgentId ? db.agent.findUnique({ where: { id: assignedAgentId } }) : null,
      complaintId ? db.complaint.findUnique({ where: { id: complaintId } }) : null,
      interventionId ? db.intervention.findUnique({ where: { id: interventionId } }) : null,
    ])

    if (assignedAgentId && (!agent || !agent.actif || agent.commune !== commune)) {
      return NextResponse.json({ error: 'العون المختار غير متاح لهذه الجماعة' }, { status: 400 })
    }
    if (complaintId && (!complaint || !canAccessCommune(user, complaint.commune) || complaint.commune !== commune)) {
      return NextResponse.json({ error: 'الشكاية المختارة غير متاحة لهذه الجماعة' }, { status: 400 })
    }
    if (interventionId && (!intervention || !canAccessCommune(user, intervention.commune) || intervention.commune !== commune)) {
      return NextResponse.json({ error: 'التدخل المختار غير متاح لهذه الجماعة' }, { status: 400 })
    }

    const workOrder = await db.$transaction(async (transaction) => {
      const created = await transaction.workOrder.create({
        data: {
          reference: workOrderReference(),
          commune,
          title,
          description,
          priority,
          status: assignedAgentId ? 'ASSIGNE' : 'NOUVEAU',
          assignedAgentId: assignedAgentId || null,
          complaintId: complaintId || null,
          interventionId: interventionId || null,
          scheduledFor,
          dueAt,
          latitude,
          longitude,
          createdBy: user.nom,
        },
        include: workOrderInclude,
      })

      if (complaint && complaint.statut === 'EN_ATTENTE') {
        await transaction.complaint.update({
          where: { id: complaint.id },
          data: { statut: 'EN_COURS' },
        })
      }

      return created
    })

    await recordActivity({
      user,
      action: 'CREATE',
      entityType: 'WORK_ORDER',
      entityId: workOrder.id,
      commune,
      details: {
        reference: workOrder.reference,
        status: workOrder.status,
        priority: workOrder.priority,
        assignedAgentId: workOrder.assignedAgentId,
      },
    })

    return NextResponse.json(workOrder, { status: 201 })
  } catch (error) {
    console.error('POST work order error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء أمر العمل' }, { status: 500 })
  }
}
