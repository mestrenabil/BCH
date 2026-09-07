import { db } from '@/lib/db'
import { getScopedCommuneFilter, requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

const TERMINAL_STATUSES = new Set(['TERMINE', 'ANNULE'])
const SLA_HOURS: Record<string, number> = { URGENTE: 4, HAUTE: 24, NORMALE: 72, BASSE: 120 }

function effectiveDueAt(workOrder: { dueAt: Date | null; scheduledFor: Date | null; createdAt: Date; priority: string }): Date {
  if (workOrder.dueAt) return workOrder.dueAt
  const baseDate = workOrder.scheduledFor && workOrder.scheduledFor > workOrder.createdAt ? workOrder.scheduledFor : workOrder.createdAt
  return new Date(baseDate.getTime() + (SLA_HOURS[workOrder.priority] || SLA_HOURS.NORMALE) * 60 * 60 * 1000)
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(authResult.user, searchParams)
    const where: Record<string, unknown> = communeFilter ? { commune: communeFilter } : {}
    const year = Number(searchParams.get('year'))
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) where.createdAt = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
    const workOrders = await db.workOrder.findMany({
      where,
      select: {
        id: true,
        reference: true,
        commune: true,
        title: true,
        priority: true,
        status: true,
        dueAt: true,
        scheduledFor: true,
        completedAt: true,
        createdAt: true,
        assignedAgentId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })

    const now = new Date()
    const nextDay = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    const openOrders = workOrders.filter((workOrder) => !TERMINAL_STATUSES.has(workOrder.status))
    const overdue = openOrders.filter((workOrder) => effectiveDueAt(workOrder) < now)
    const dueSoon = openOrders.filter((workOrder) => {
      const dueAt = effectiveDueAt(workOrder)
      return dueAt >= now && dueAt <= nextDay
    })
    const unassigned = openOrders.filter((workOrder) => !workOrder.assignedAgentId)
    const urgent = openOrders.filter((workOrder) => workOrder.priority === 'URGENTE')
    const completed = workOrders.filter((workOrder) => workOrder.status === 'TERMINE')
    const completedWithDuration = completed.filter((workOrder) => workOrder.completedAt)
    const averageCompletionHours = completedWithDuration.length
      ? Math.round(completedWithDuration.reduce((total, workOrder) => total + ((workOrder.completedAt!.getTime() - workOrder.createdAt.getTime()) / 3_600_000), 0) / completedWithDuration.length * 10) / 10
      : null

    const byStatus = Object.fromEntries(['NOUVEAU', 'ASSIGNE', 'EN_ROUTE', 'EN_COURS', 'TERMINE', 'ANNULE'].map((status) => [status, workOrders.filter((workOrder) => workOrder.status === status).length]))
    const alertCandidates = [
      ...overdue.map((workOrder) => ({ workOrder, kind: 'OVERDUE' as const, dueAt: effectiveDueAt(workOrder) })),
      ...dueSoon.map((workOrder) => ({ workOrder, kind: 'DUE_SOON' as const, dueAt: effectiveDueAt(workOrder) })),
      ...unassigned.filter((workOrder) => workOrder.priority === 'URGENTE' || workOrder.status === 'NOUVEAU').map((workOrder) => ({ workOrder, kind: 'UNASSIGNED' as const, dueAt: effectiveDueAt(workOrder) })),
    ]
    const uniqueAlerts = new Map<string, (typeof alertCandidates)[number]>()
    for (const alert of alertCandidates) {
      if (!uniqueAlerts.has(alert.workOrder.id)) uniqueAlerts.set(alert.workOrder.id, alert)
    }
    const alerts = [...uniqueAlerts.values()]
      .sort((first, second) => first.dueAt.getTime() - second.dueAt.getTime())
      .slice(0, 30)
      .map(({ workOrder, kind, dueAt }) => ({
        id: `${kind}-${workOrder.id}`,
        workOrderId: workOrder.id,
        reference: workOrder.reference,
        title: workOrder.title,
        commune: workOrder.commune,
        status: workOrder.status,
        priority: workOrder.priority,
        dueAt,
        kind,
      }))

    return NextResponse.json({
      generatedAt: now,
      metrics: {
        total: workOrders.length,
        open: openOrders.length,
        overdue: overdue.length,
        dueSoon: dueSoon.length,
        unassigned: unassigned.length,
        urgent: urgent.length,
        completed: completed.length,
        completionRate: workOrders.length ? Math.round((completed.length / workOrders.length) * 100) : 0,
        averageCompletionHours,
      },
      byStatus,
      alerts,
    })
  } catch (error) {
    console.error('GET operations summary error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المتابعة التشغيلية' }, { status: 500 })
  }
}
