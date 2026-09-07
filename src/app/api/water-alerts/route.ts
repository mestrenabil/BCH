import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth } from '@/lib/auth'

const DEFAULT_ALERT_LEAD_DAYS = 7

function parseSettings(value: string | null | undefined) {
  try {
    const parsed = value ? JSON.parse(value) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where = communeFilter ? { commune: communeFilter } : {}
    const settingRows = await db.communeSettings.findMany({ where: communeFilter ? { commune: communeFilter } : {}, select: { commune: true, settings: true } })
    const alertLeadDaysByCommune = new Map(settingRows.map((row) => {
      const water = parseSettings(row.settings).water
      const values = water && typeof water === 'object' && !Array.isArray(water) ? water as Record<string, unknown> : {}
      return [row.commune, Math.min(90, Math.max(1, Number(values.alertLeadDays) || DEFAULT_ALERT_LEAD_DAYS))] as const
    }))
    const maxAlertLeadDays = Math.max(DEFAULT_ALERT_LEAD_DAYS, ...Array.from(alertLeadDaysByCommune.values()))
    const alertLeadDays = (commune: string) => alertLeadDaysByCommune.get(commune) || DEFAULT_ALERT_LEAD_DAYS
    const [measurements, inspections, devicesCandidates, incidents, actionsCandidates, emergencyPlans, waterIncidents] = await Promise.all([
      db.waterMeasurement.findMany({ where: { ...where, conformity: 'NON_CONFORM' }, orderBy: { measurementDate: 'desc' }, take: 100, include: { waterPoint: { select: { name: true } } } }),
      db.waterInspection.findMany({ where: { ...where, riskLevel: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'CLOSED' } }, orderBy: { inspectionDate: 'desc' }, take: 100, include: { waterPoint: { select: { name: true } }, pool: { select: { name: true } } } }),
      db.waterDevice.findMany({ where: { ...where, status: { not: 'OUT_OF_SERVICE' }, calibrationDueDate: { lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }, orderBy: { calibrationDueDate: 'asc' }, take: 100 }),
      db.sanitationIncident.findMany({ where: { ...where, riskLevel: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.waterAction.findMany({ where: { ...where, OR: [{ plannedDate: { not: null, lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }, { followUpDate: { not: null, lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }] }, orderBy: { createdAt: 'desc' }, take: 500, select: { id: true, reference: true, commune: true, actionType: true, status: true, plannedDate: true, followUpDate: true, waterPointId: true, poolId: true, inspectionId: true, sampleId: true, sanitationIncidentId: true } }),
      db.waterEmergencyPlan.findMany({ where: { ...where, status: { in: ['ACTIVE', 'MONITORING'] }, OR: [{ targetCloseAt: { not: null, lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }, { riskLevel: 'CRITICAL' }] }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.waterIncident.findMany({ where: { ...where, severity: { in: ['HIGH', 'CRITICAL'] }, status: { notIn: ['RESOLVED', 'CLOSED'] } }, orderBy: { startedAt: 'desc' }, take: 100 }),
    ])
    const devices = devicesCandidates.filter((item) => item.calibrationDueDate && item.calibrationDueDate.getTime() <= Date.now() + alertLeadDays(item.commune) * 86400000)
    const actions = actionsCandidates.filter((item) => {
      const dueDate = item.followUpDate || item.plannedDate
      return dueDate && dueDate.getTime() <= Date.now() + alertLeadDays(item.commune) * 86400000
    })
    const baseAlerts = [
      ...measurements.map((item) => ({ id: `measurement-${item.id}`, sourceType: 'measurement' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: 'HIGH' as const, title: 'قياس غير مطابق', detail: `${item.waterPoint?.name || 'نقطة مياه'} — يلزم التحقق واتخاذ الإجراء المناسب`, occurredAt: item.measurementDate.toISOString(), targetTab: 'measurements' as const })),
      ...inspections.map((item) => ({ id: `inspection-${item.id}`, sourceType: 'inspection' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: 'HIGH' as const, title: 'خطر مرتفع في معاينة ميدانية', detail: `${item.waterPoint?.name || item.pool?.name || 'مصدر مائي'} — مؤشر الخطر ${item.riskScore}/100`, occurredAt: item.inspectionDate.toISOString(), targetTab: 'inspections' as const })),
      ...devices.map((item) => ({ id: `device-${item.id}`, sourceType: 'device' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: 'MEDIUM' as const, title: 'معايرة جهاز مستحقة قريباً', detail: `${item.name} — الموعد ${item.calibrationDueDate ? item.calibrationDueDate.toLocaleDateString('ar-MA') : 'غير محدد'}`, occurredAt: (item.calibrationDueDate || item.updatedAt).toISOString(), targetTab: 'devices' as const })),
      ...incidents.map((item) => ({ id: `sanitation-${item.id}`, sourceType: 'sanitation' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: 'HIGH' as const, title: 'حادث صرف صحي مفتوح', detail: `${item.description || item.type} — مستوى الخطر ${item.riskLevel}`, occurredAt: item.createdAt.toISOString(), targetTab: 'sanitation' as const })),
      ...actions.flatMap((item) => {
        if (!['PLANNED', 'ASSIGNED', 'IN_PROGRESS'].includes(item.status)) return []
        const dueDate = item.followUpDate || item.plannedDate
        if (!dueDate || dueDate.getTime() > Date.now() + alertLeadDays(item.commune) * 86400000) return []
        const overdue = dueDate.getTime() < Date.now()
        return [{ id: `action-${item.id}`, sourceType: 'action' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: overdue ? 'HIGH' as const : 'MEDIUM' as const, title: overdue ? 'إجراء متأخر' : 'موعد إجراء قريب', detail: `${item.actionType} — الموعد ${dueDate.toLocaleDateString('ar-MA')}`, occurredAt: dueDate.toISOString(), targetTab: 'actions' as const }]
      }),
      ...emergencyPlans.map((item) => ({ id: `emergency-${item.id}`, sourceType: 'emergency' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: item.riskLevel === 'CRITICAL' ? 'HIGH' as const : 'MEDIUM' as const, title: 'خطة طوارئ مائية نشطة', detail: `${item.title} — ${item.alternativeSource || 'لم يحدد مصدر بديل'}`, occurredAt: (item.activatedAt || item.createdAt).toISOString(), targetTab: 'emergency' as const })),
      ...waterIncidents.map((item) => ({ id: `water-incident-${item.id}`, sourceType: 'incident' as const, sourceId: item.id, reference: item.reference, commune: item.commune, severity: 'HIGH' as const, title: 'حادث مياه مفتوح', detail: `${item.incidentType} — ${item.description}`, occurredAt: item.startedAt.toISOString(), targetTab: 'incidents' as const })),
    ]
    const openStatuses = new Set(['PLANNED', 'ASSIGNED', 'IN_PROGRESS'])
    const alerts = baseAlerts.map((alert) => {
      const sourceIds = new Set<string>([alert.sourceId])
      if (alert.sourceType === 'measurement') {
        const measurement = measurements.find((item) => item.id === alert.sourceId)
        if (measurement?.waterPointId) sourceIds.add(measurement.waterPointId)
      }
      if (alert.sourceType === 'device') {
        const device = devices.find((item) => item.id === alert.sourceId)
        if (device?.waterPointId) sourceIds.add(device.waterPointId)
      }
      const linkedActions = actions.filter((action) => [action.waterPointId, action.poolId, action.inspectionId, action.sampleId, action.sanitationIncidentId].some((id) => id && sourceIds.has(id)))
      const openActions = linkedActions.filter((action) => openStatuses.has(action.status))
      const actionNote = openActions[0] ? ` — إجراء مفتوح: ${openActions[0].reference}` : linkedActions[0] ? ` — مرتبط بإجراء ${linkedActions[0].reference} (${linkedActions[0].status})` : ''
      return { ...alert, detail: `${alert.detail}${actionNote}`, actionId: openActions[0]?.id || linkedActions[0]?.id || null, actionReference: openActions[0]?.reference || linkedActions[0]?.reference || null, actionStatus: openActions[0]?.status || linkedActions[0]?.status || null, openActionCount: openActions.length }
    }).sort((a, b) => (b.severity === 'HIGH' ? 1 : 0) - (a.severity === 'HIGH' ? 1 : 0) || new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
    return NextResponse.json({ alerts, total: alerts.length })
  } catch (error) {
    console.error('GET water-alerts error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل تنبيهات الماء' }, { status: 500 })
  }
}
