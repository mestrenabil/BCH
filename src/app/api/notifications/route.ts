import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCommuneFilter, requireAuth } from '@/lib/auth'

const TERMINAL_WORK_ORDER_STATUSES = new Set(['TERMINE', 'ANNULE'])
const SLA_HOURS: Record<string, number> = { URGENTE: 4, HAUTE: 24, NORMALE: 72, BASSE: 120 }

type NotificationCategory = 'urgent' | 'warning' | 'info'

type Notification = {
  id: string
  category: NotificationCategory
  title: string
  commune: string
  timestamp: Date
}

function effectiveDueAt(workOrder: { dueAt: Date | null; scheduledFor: Date | null; createdAt: Date; priority: string }): Date {
  if (workOrder.dueAt) return workOrder.dueAt
  const baseDate = workOrder.scheduledFor && workOrder.scheduledFor > workOrder.createdAt ? workOrder.scheduledFor : workOrder.createdAt
  return new Date(baseDate.getTime() + (SLA_HOURS[workOrder.priority] || SLA_HOURS.NORMALE) * 3_600_000)
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { searchParams } = new URL(request.url)
    const communeFilter = getCommuneFilter(authResult.user, searchParams.get('commune'))
    const scopedWhere = communeFilter ? { commune: communeFilter } : {}
    const productsWhere = communeFilter
      ? { OR: [{ commune: communeFilter }, { commune: '' }, { commune: 'ALL' }] }
      : {}
    const documentsWhere = communeFilter
      ? { OR: [{ commune: communeFilter }, { commune: '' }, { commune: 'ALL' }] }
      : {}

    const [products, interventions, documents, workOrders] = await Promise.all([
      db.product.findMany({ where: productsWhere, orderBy: { updatedAt: 'desc' }, take: 250 }),
      db.intervention.findMany({ where: scopedWhere, orderBy: { updatedAt: 'desc' }, take: 250 }),
      db.document.findMany({ where: documentsWhere, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.workOrder.findMany({ where: scopedWhere, orderBy: { updatedAt: 'desc' }, take: 250 }),
    ])

    const now = new Date()
    const inThreeDays = new Date(now.getTime() + 3 * 24 * 3_600_000)
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3_600_000)
    const notifications: Notification[] = []

    for (const product of products) {
      if (product.quantiteStock === 0) {
        notifications.push({
          id: `stock-critical-${product.id}`,
          category: 'urgent',
          title: 'نفاد المخزون',
          commune: product.commune,
          timestamp: product.updatedAt,
        })
      } else if (product.quantiteStock <= product.seuilAlerte) {
        notifications.push({
          id: `stock-low-${product.id}`,
          category: 'warning',
          title: 'المخزون منخفض',
          commune: product.commune,
          timestamp: product.updatedAt,
        })
      }
    }

    for (const intervention of interventions) {
      if ((intervention.statut === 'PLANIFIEE' || intervention.statut === 'EN_COURS') && intervention.date < now) {
        notifications.push({
          id: `overdue-${intervention.id}`,
          category: 'urgent',
          title: 'تدخل متأخر',
          commune: intervention.commune,
          timestamp: intervention.updatedAt,
        })
      } else if (intervention.statut === 'PLANIFIEE' && intervention.date >= now && intervention.date <= inThreeDays) {
        notifications.push({
          id: `upcoming-${intervention.id}`,
          category: 'info',
          title: 'تدخل مبرمج',
          commune: intervention.commune,
          timestamp: intervention.updatedAt,
        })
      }
    }

    for (const document of documents) {
      if (document.createdAt >= threeDaysAgo) {
        notifications.push({
          id: `doc-new-${document.id}`,
          category: 'info',
          title: 'مستند جديد',
          commune: document.commune,
          timestamp: document.createdAt,
        })
      }
    }

    for (const workOrder of workOrders) {
      if (TERMINAL_WORK_ORDER_STATUSES.has(workOrder.status)) continue
      const dueAt = effectiveDueAt(workOrder)
      if (dueAt < now) {
        notifications.push({
          id: `work-order-overdue-${workOrder.id}`,
          category: 'urgent',
          title: 'أمر عمل متأخر',
          commune: workOrder.commune,
          timestamp: dueAt,
        })
      } else if (dueAt <= new Date(now.getTime() + 24 * 3_600_000)) {
        notifications.push({
          id: `work-order-due-soon-${workOrder.id}`,
          category: 'warning',
          title: 'أمر عمل قريب الاستحقاق',
          commune: workOrder.commune,
          timestamp: dueAt,
        })
      } else if (!workOrder.assignedAgentId && (workOrder.priority === 'URGENTE' || workOrder.status === 'NOUVEAU')) {
        notifications.push({
          id: `work-order-unassigned-${workOrder.id}`,
          category: 'warning',
          title: 'أمر عمل غير مسند',
          commune: workOrder.commune,
          timestamp: workOrder.updatedAt,
        })
      }
    }

    notifications.sort((first, second) => second.timestamp.getTime() - first.timestamp.getTime())
    return NextResponse.json({ generatedAt: now, notifications: notifications.slice(0, 100) })
  } catch (error) {
    console.error('GET notifications error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل التنبيهات' }, { status: 500 })
  }
}
