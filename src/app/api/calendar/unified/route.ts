import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'

// GET: كل المواعيد القادمة عبر كل المكاتب
// ?days=30 (الأيام القادمة)
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const requestedDays = Number.parseInt(searchParams.get('days') || '30', 10)
    const days = Number.isFinite(requestedDays) ? Math.min(Math.max(requestedDays, 1), 365) : 30
    const requestedYear = searchParams.get('year')
    const selectedYear = requestedYear && /^\d{4}$/.test(requestedYear) ? Number(requestedYear) : null
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where = communeFilter ? { commune: communeFilter } : {}

    const now = new Date()
    const currentYear = now.getFullYear()
    const yearStart = selectedYear ? new Date(selectedYear, 0, 1) : null
    const yearEnd = selectedYear ? new Date(selectedYear + 1, 0, 1) : null
    const rangeStart = yearStart && selectedYear !== currentYear ? yearStart : now
    const requestedLimitDate = new Date(rangeStart)
    requestedLimitDate.setDate(requestedLimitDate.getDate() + days)
    const limitDate = yearEnd && requestedLimitDate > yearEnd ? yearEnd : requestedLimitDate

    type CalEvent = { id: string; kind: string; title: string; subtitle: string; date: string; commune: string; daysUntil: number; overdue: boolean }

    const events: CalEvent[] = []
    const daysUntil = (d: Date) => Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // 1. التدخلات المخطّطة
    const plannedInterventions = await db.intervention.findMany({ where: { ...where, statut: 'PLANIFIEE', date: { gte: rangeStart, lte: limitDate } } as any, take: 100, select: { id: true, reference: true, type: true, date: true, commune: true, quartier: true } })
    for (const i of plannedInterventions) events.push({ id: i.id, kind: 'INTERVENTION', title: `🧪 ${i.type} — ${i.reference}`, subtitle: i.quartier || '', date: i.date.toISOString(), commune: i.commune, daysUntil: daysUntil(i.date), overdue: false })

    // 2. حملات ميدانية (Campagne) — planned
    const campagnes = await db.campagne.findMany({ where: { ...where, statut: 'PLANIFIEE', dateDebut: { gte: rangeStart, lte: limitDate } } as any, take: 50, select: { id: true, nom: true, type: true, dateDebut: true, commune: true } })
    for (const c of campagnes) { if (c.dateDebut) events.push({ id: c.id, kind: 'CAMPAIGN', title: `🎪 ${c.nom}`, subtitle: c.type, date: c.dateDebut.toISOString(), commune: c.commune, daysUntil: daysUntil(c.dateDebut), overdue: c.dateDebut < now }) }

    // 3. تفتيشات — استخدم inspectionDate
    const inspections = await db.inspection.findMany({ where: { ...where, inspectionDate: { gte: rangeStart, lte: limitDate } } as any, take: 100, select: { id: true, reference: true, type: true, inspectionDate: true, commune: true, establishment: { select: { name: true } } } })
    for (const ins of inspections) events.push({ id: ins.id, kind: 'INSPECTION', title: `🔍 ${ins.type} — ${ins.reference}`, subtitle: ins.establishment?.name || '', date: ins.inspectionDate.toISOString(), commune: ins.commune, daysUntil: daysUntil(ins.inspectionDate), overdue: ins.inspectionDate < now })

    // 4. مواعيد الماء والتطهير
    const waterInspections = await db.waterInspection.findMany({ where: { ...where, inspectionDate: { gte: rangeStart, lte: limitDate }, status: { in: ['PLANNED', 'IN_PROGRESS', 'FOLLOW_UP'] } } as any, take: 100, select: { id: true, reference: true, inspectionDate: true, commune: true, status: true, waterPoint: { select: { name: true } }, pool: { select: { name: true } } } })
    for (const inspection of waterInspections) {
      const location = inspection.waterPoint?.name || inspection.pool?.name || ''
      events.push({ id: inspection.id, kind: 'WATER_INSPECTION', title: `💧 معاينة مياه — ${inspection.reference}`, subtitle: `${location} · ${inspection.status}`, date: inspection.inspectionDate.toISOString(), commune: inspection.commune, daysUntil: daysUntil(inspection.inspectionDate), overdue: inspection.inspectionDate < now })
    }
    const waterActions = await db.waterAction.findMany({ where: { ...where, plannedDate: { gte: rangeStart, lte: limitDate }, status: { notIn: ['COMPLETED', 'VERIFIED', 'CLOSED'] } } as any, take: 100, select: { id: true, reference: true, actionType: true, priority: true, plannedDate: true, commune: true, waterPoint: { select: { name: true } }, pool: { select: { name: true } } } })
    for (const action of waterActions) {
      if (!action.plannedDate) continue
      const location = action.waterPoint?.name || action.pool?.name || ''
      events.push({ id: action.id, kind: 'WATER_ACTION', title: `🛠️ إجراء مياه — ${action.reference}`, subtitle: `${action.actionType} · ${action.priority} · ${location}`, date: action.plannedDate.toISOString(), commune: action.commune, daysUntil: daysUntil(action.plannedDate), overdue: action.plannedDate < now })
    }
    const waterDisinfection = await db.waterDisinfectionOperation.findMany({ where: { ...where, operationDate: { gte: rangeStart, lte: limitDate }, status: 'PLANNED' } as any, take: 100, select: { id: true, reference: true, operationDate: true, operationType: true, commune: true, waterPoint: { select: { name: true } }, pool: { select: { name: true } } } })
    for (const operation of waterDisinfection) {
      const location = operation.waterPoint?.name || operation.pool?.name || ''
      events.push({ id: operation.id, kind: 'WATER_DISINFECTION', title: `🧴 تطهير مياه — ${operation.reference}`, subtitle: `${operation.operationType} · ${location}`, date: operation.operationDate.toISOString(), commune: operation.commune, daysUntil: daysUntil(operation.operationDate), overdue: operation.operationDate < now })
    }

    // 5. بطاقات صحية منتهية أو وشيكة
    const healthCards = await db.healthCard.findMany({ where: { ...where, expiryDate: { gte: rangeStart, lte: limitDate } } as any, take: 100, select: { id: true, reference: true, workerName: true, expiryDate: true, commune: true, status: true } })
    for (const h of healthCards) { if (h.expiryDate) { const d = daysUntil(h.expiryDate); events.push({ id: h.id, kind: 'HEALTH_CARD', title: `🩺 انتهاء بطاقة: ${h.workerName}`, subtitle: h.reference, date: h.expiryDate.toISOString(), commune: h.commune, daysUntil: d, overdue: d < 0 }) } }

    // 6. جنازز — دفن مخطّط
    const burials = await db.burialDossier.findMany({ where: { ...where, burialDate: { gte: rangeStart, lte: limitDate }, status: { in: ['NEW', 'AUTHORIZED'] } } as any, take: 50, select: { id: true, reference: true, deceasedName: true, burialDate: true, commune: true } })
    for (const b of burials) { if (b.burialDate) events.push({ id: b.id, kind: 'BURIAL', title: `🪦 دفن: ${b.deceasedName}`, subtitle: b.reference, date: b.burialDate.toISOString(), commune: b.commune, daysUntil: daysUntil(b.burialDate), overdue: b.burialDate < now }) }

    // 6. زيارات لجان مخطّطة
    const visits = await db.committeeVisit.findMany({ where: { ...where, visitDate: { gte: rangeStart, lte: limitDate }, status: 'PLANNED' } as any, take: 50, select: { id: true, reference: true, establishmentName: true, visitDate: true, commune: true } })
    for (const v of visits) events.push({ id: v.id, kind: 'COMMITTEE', title: `👥 زيارة لجنة: ${v.establishmentName}`, subtitle: v.reference, date: v.visitDate.toISOString(), commune: v.commune, daysUntil: daysUntil(v.visitDate), overdue: v.visitDate < now })

    // 7. مهلات Dossiers
    const dossierDue = await db.dossier.findMany({ where: { ...where, dueDate: { gte: rangeStart, lte: limitDate }, status: { notIn: ['CLOSED', 'ARCHIVED'] } } as any, take: 100, select: { id: true, reference: true, title: true, dueDate: true, commune: true } })
    for (const d of dossierDue) { if (d.dueDate) { const dd = daysUntil(d.dueDate); events.push({ id: d.id, kind: 'DOSSIER_DUE', title: `🗂️ مهلة: ${d.title || d.reference}`, subtitle: d.reference, date: d.dueDate.toISOString(), commune: d.commune, daysUntil: dd, overdue: dd < 0 }) } }

    // 8. حملات تحسيس نشطة
    const campaigns = await db.awarenessCampaign.findMany({ where: { ...where, status: 'PLANNED', startDate: { gte: rangeStart, lte: limitDate } } as any, take: 50, select: { id: true, reference: true, title: true, theme: true, startDate: true, commune: true } })
    for (const c of campaigns) { if (c.startDate) events.push({ id: c.id, kind: 'CAMPAIGN_ENV', title: `📢 ${c.title}`, subtitle: c.theme, date: c.startDate.toISOString(), commune: c.commune, daysUntil: daysUntil(c.startDate), overdue: c.startDate < now }) }

    // رتّب حسب الأقرب
    events.sort((a, b) => a.daysUntil - b.daysUntil)

    return NextResponse.json({ events, total: events.length })
  } catch (error) {
    console.error('GET calendar/unified error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
