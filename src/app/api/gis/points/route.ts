import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'
import { filterPointsToCommunes } from '@/lib/commune-boundaries'

const DEFAULT_WATER_ALERT_LEAD_DAYS = 7

function parseStoredSettings(value: string | null | undefined): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

// GET: كل النقاط الجغرافية من كل المصادر، موحّدة لـ GIS
// ?layers=interventions,complaints,quartiers,establishments,waterPoints,pools,pollution,waste,sites,environmentalDossiers,animals,captureMissions,capturedAnimals,sanitation,biteCases,cemeteries,foodReports,workOrders,dossiers
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const layersParam = searchParams.get('layers') || ''
    const requestedLayers = layersParam ? layersParam.split(',').map(l => l.trim()).filter(Boolean) : null
    const interventionLayerKeys = ['interventions', 'deratisation', 'desinsectisation', 'desinfection']
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where = communeFilter ? { commune: communeFilter } : {}
    const selectedYear = searchParams.get('year')
    const yearNumber = selectedYear && /^\d{4}$/.test(selectedYear) ? Number(selectedYear) : null
    const dateFilter = yearNumber
      ? { gte: new Date(yearNumber, 0, 1), lt: new Date(yearNumber + 1, 0, 1) }
      : null
    const createdAtWhere = dateFilter ? { ...where, createdAt: dateFilter } : where
    const interventionWhere = dateFilter ? { ...where, date: dateFilter } : where
    const limit = 2000

    type GisPoint = {
      layer: string; id: string; reference: string; title: string
      subtitle: string; lat: number; lng: number; status: string
      color: string; icon: string; commune: string; createdAt: string; linkedLayer?: string; layers?: string[]
      linkedReference?: string
    }
    const points: GisPoint[] = []

    const shouldFetch = (layer: string) => !requestedLayers || requestedLayers.includes(layer)
    const shouldFetchInterventions = !requestedLayers || interventionLayerKeys.some((layer) => requestedLayers.includes(layer))

    // التدخلات 3D
    if (shouldFetchInterventions) {
      const items = await db.intervention.findMany({ where: interventionWhere, take: limit, select: { id: true, reference: true, type: true, statut: true, quartier: true, adresse: true, latitude: true, longitude: true, commune: true, createdAt: true, gisLayer: true } })
      const colors: Record<string, string> = { DERATISATION: '#dc2626', DESINSECTISATION: '#ea580c', DESINFECTION: '#8b5cf6' }
      const icons: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🪲', DESINFECTION: '🧴' }
      const typeLayers: Record<string, string> = { DERATISATION: 'deratisation', DESINSECTISATION: 'desinsectisation', DESINFECTION: 'desinfection' }
      for (const i of items) {
        if (i.latitude == null || i.longitude == null) continue
        const typeLayer = typeLayers[i.type] || 'interventions'
        const linkedLayer = i.gisLayer || 'interventions'
        const layers = Array.from(new Set(['interventions', typeLayer, linkedLayer]))
        if (requestedLayers && !layers.some((layer) => requestedLayers.includes(layer))) continue
        points.push({ layer: typeLayer, layers, id: i.id, reference: i.reference, title: `${icons[i.type] || '🧪'} ${i.type}`, subtitle: i.adresse || i.quartier || '', lat: i.latitude, lng: i.longitude, status: i.statut, color: colors[i.type] || '#64748b', icon: icons[i.type] || '🧪', commune: i.commune, createdAt: i.createdAt.toISOString(), linkedLayer })
      }
    }

    // الشكايات
    if (shouldFetch('complaints')) {
      const items = await db.complaint.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, type: true, description: true, statut: true, quartier: true, latitude: true, longitude: true, commune: true, createdAt: true, intervention: { select: { reference: true, latitude: true, longitude: true } }, workOrders: { select: { reference: true, latitude: true, longitude: true } } } })
      const colors: Record<string, string> = { DERATISATION: '#dc2626', DESINSECTISATION: '#ea580c', DESINFECTION: '#8b5cf6', FOOD: '#e11d48', ANIMAL: '#d97706', AUTRE: '#64748b' }
      const icons: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🪲', DESINFECTION: '🧴', FOOD: '🥗', ANIMAL: '🐾' }
      for (const c of items) {
        const linkedWorkOrder = c.workOrders.find((workOrder) => workOrder.latitude != null && workOrder.longitude != null)
        const lat = c.latitude ?? c.intervention?.latitude ?? linkedWorkOrder?.latitude ?? null
        const lng = c.longitude ?? c.intervention?.longitude ?? linkedWorkOrder?.longitude ?? null
        if (lat == null || lng == null) continue
        const linkedLayer = c.latitude == null && c.intervention ? 'interventions' : c.latitude == null && linkedWorkOrder ? 'workOrders' : undefined
        const linkedReference = c.latitude == null && c.intervention ? c.intervention.reference : c.latitude == null ? linkedWorkOrder?.reference : undefined
        points.push({ layer: 'complaints', id: c.id, reference: c.reference, title: `${icons[c.type] || '📢'} ${c.type}`, subtitle: (c.description || '').slice(0, 60), lat, lng, status: c.statut, color: colors[c.type] || '#64748b', icon: icons[c.type] || '📢', commune: c.commune, createdAt: c.createdAt.toISOString(), linkedLayer, linkedReference })
      }
    }

    // الأحياء المرجعية
    if (shouldFetch('quartiers')) {
      const items = await db.quartier.findMany({ where, take: limit, select: { id: true, nom: true, commune: true, latitude: true, longitude: true } })
      for (const quartier of items) {
        points.push({ layer: 'quartiers', id: quartier.id, reference: `QUARTIER-${quartier.id}`, title: `🏘️ ${quartier.nom}`, subtitle: 'حي ترابي مرجعي', lat: quartier.latitude, lng: quartier.longitude, status: 'REFERENCE', color: '#64748b', icon: '🏘️', commune: quartier.commune, createdAt: new Date(0).toISOString() })
      }
    }

    // المنشآت
    if (shouldFetch('establishments')) {
      const items = await db.establishment.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, activity: true, status: true, riskCategory: true, latitude: true, longitude: true, commune: true, quartier: true, createdAt: true } })
      const riskColors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626', UNCLASSIFIED: '#94a3b8' }
      for (const e of items) {
        if (e.latitude == null || e.longitude == null) continue
        points.push({ layer: 'establishments', id: e.id, reference: e.reference, title: `🏪 ${e.name}`, subtitle: `${e.activity} · ${e.riskCategory}`, lat: e.latitude, lng: e.longitude, status: e.status, color: riskColors[e.riskCategory] || '#64748b', icon: '🏪', commune: e.commune, createdAt: e.createdAt.toISOString() })
      }
    }

    // سجلات المنشآت المرتبطة بموقع المنشأة
    if (shouldFetch('inspections')) {
      const items = await db.inspection.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, type: true, overallResult: true, status: true, commune: true, createdAt: true, establishment: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const resultColors: Record<string, string> = { CONFORM: '#10b981', NON_CONFORM_MINOR: '#f59e0b', NON_CONFORM_MAJOR: '#ea580c', NON_CONFORM_CRITICAL: '#dc2626', PENDING: '#64748b' }
      for (const inspection of items) {
        if (inspection.establishment.latitude == null || inspection.establishment.longitude == null) continue
        points.push({ layer: 'inspections', id: inspection.id, reference: inspection.reference, title: `🔎 تفتيش ${inspection.establishment.name}`, subtitle: inspection.type, lat: inspection.establishment.latitude, lng: inspection.establishment.longitude, status: inspection.overallResult, color: resultColors[inspection.overallResult] || '#16a34a', icon: '🔎', commune: inspection.commune || inspection.establishment.commune, createdAt: inspection.createdAt.toISOString() })
      }
    }

    if (shouldFetch('healthCards')) {
      const items = await db.healthCard.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, workerName: true, occupation: true, status: true, commune: true, createdAt: true, establishment: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const statusColors: Record<string, string> = { VALID: '#10b981', EXPIRED: '#dc2626', PENDING: '#f59e0b', RENEWING: '#3b82f6' }
      for (const card of items) {
        if (card.establishment?.latitude == null || card.establishment.longitude == null) continue
        points.push({ layer: 'healthCards', id: card.id, reference: card.reference, title: `🪪 بطاقة ${card.workerName}`, subtitle: `${card.occupation}${card.establishment.name ? ` · ${card.establishment.name}` : ''}`, lat: card.establishment.latitude, lng: card.establishment.longitude, status: card.status, color: statusColors[card.status] || '#0f766e', icon: '🪪', commune: card.commune || card.establishment.commune, createdAt: card.createdAt.toISOString() })
      }
    }

    if (shouldFetch('samples')) {
      const items = await db.sample.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, product: true, conformity: true, commune: true, createdAt: true, establishment: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const conformityColors: Record<string, string> = { CONFORM: '#10b981', NON_CONFORM: '#dc2626', PENDING: '#f59e0b' }
      for (const sample of items) {
        if (sample.establishment?.latitude == null || sample.establishment.longitude == null) continue
        points.push({ layer: 'samples', id: sample.id, reference: sample.reference, title: `🧫 عينة ${sample.product || 'غذائية'}`, subtitle: sample.establishment.name, lat: sample.establishment.latitude, lng: sample.establishment.longitude, status: sample.conformity, color: conformityColors[sample.conformity] || '#0891b2', icon: '🧫', commune: sample.commune || sample.establishment.commune, createdAt: sample.createdAt.toISOString() })
      }
    }

    // نقاط المياه
    if (shouldFetch('waterPoints')) {
      const items = await db.waterPoint.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, type: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true, _count: { select: { measurements: true } } } })
      const typeIcons: Record<string, string> = { NETWORK: '🕸️', RESERVOIR: '🛢️', TOWER: '🗼', FOUNTAIN: '⛲', WELL: '🕳️', BOREHOLE: '⛏️', SOURCE: '🌊', CISTERN: '🚛', INSTITUTION: '🏛️' }
      for (const w of items) {
        if (w.latitude == null || w.longitude == null) continue
        points.push({ layer: 'waterPoints', id: w.id, reference: w.reference, title: `${typeIcons[w.type] || '💧'} ${w.name}`, subtitle: `${w.type}${w._count.measurements ? ` · 🌡️ ${w._count.measurements} قياس` : ''}`, lat: w.latitude, lng: w.longitude, status: w.status, color: '#06b6d4', icon: typeIcons[w.type] || '💧', commune: w.commune, createdAt: w.createdAt.toISOString() })
      }
    }

    // المسابح ومواقع السباحة
    if (shouldFetch('pools')) {
      const items = await db.pool.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, type: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      for (const pool of items) {
        if (pool.latitude == null || pool.longitude == null) continue
        points.push({ layer: 'pools', id: pool.id, reference: pool.reference, title: `🏊 ${pool.name}`, subtitle: pool.type, lat: pool.latitude, lng: pool.longitude, status: pool.status, color: '#0284c7', icon: '🏊', commune: pool.commune, createdAt: pool.createdAt.toISOString() })
      }
    }

    // قياسات المياه مرتبطة بإحداثيات نقطة المياه الأصلية
    if (shouldFetch('waterMeasurements')) {
      const items = await db.waterMeasurement.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, conformity: true, measurementDate: true, commune: true, createdAt: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const conformityColors: Record<string, string> = { CONFORM: '#10b981', NON_CONFORM: '#dc2626', PENDING: '#f59e0b' }
      for (const measurement of items) {
        if (measurement.waterPoint.latitude == null || measurement.waterPoint.longitude == null) continue
        points.push({ layer: 'waterMeasurements', id: measurement.id, reference: measurement.reference, title: `🌡️ قياس ${measurement.waterPoint.name}`, subtitle: `${measurement.conformity} · ${measurement.measurementDate.toLocaleDateString('ar-MA')}`, lat: measurement.waterPoint.latitude, lng: measurement.waterPoint.longitude, status: measurement.conformity, color: conformityColors[measurement.conformity] || '#0e7490', icon: '🌡️', commune: measurement.commune || measurement.waterPoint.commune, createdAt: measurement.createdAt.toISOString() })
      }
    }

    // العينات والمعاينات والإجراءات المرتبطة بمواقع المياه
    if (shouldFetch('waterSamples')) {
      const items = await db.waterSample.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, sampleType: true, status: true, sampleDate: true, commune: true, createdAt: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const statusColors: Record<string, string> = { COLLECTED: '#7c3aed', RECEIVED: '#2563eb', ANALYZED: '#0e7490', RESULT_RECEIVED: '#f59e0b', VALIDATED: '#10b981', CANCELLED: '#64748b' }
      for (const sample of items) {
        const source = sample.waterPoint || sample.pool
        if (!source || source.latitude == null || source.longitude == null) continue
        points.push({ layer: 'waterSamples', id: sample.id, reference: sample.reference, title: `🧪 عينة ${source.name}`, subtitle: `${sample.sampleType} · ${sample.status}`, lat: source.latitude, lng: source.longitude, status: sample.status, color: statusColors[sample.status] || '#7c3aed', icon: '🧪', commune: sample.commune || source.commune, createdAt: sample.createdAt.toISOString() })
      }
    }

    if (shouldFetch('waterInspections')) {
      const items = await db.waterInspection.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, riskLevel: true, riskScore: true, conformity: true, status: true, inspectionDate: true, commune: true, createdAt: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const riskColors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626' }
      for (const inspection of items) {
        const source = inspection.waterPoint || inspection.pool
        if (!source || source.latitude == null || source.longitude == null) continue
        points.push({ layer: 'waterInspections', id: inspection.id, reference: inspection.reference, title: `🔎 معاينة ${source.name}`, subtitle: `${inspection.riskLevel} · ${inspection.riskScore}/100 · ${inspection.conformity}`, lat: source.latitude, lng: source.longitude, status: inspection.status, color: riskColors[inspection.riskLevel] || '#ea580c', icon: '🔎', commune: inspection.commune || source.commune, createdAt: inspection.createdAt.toISOString() })
      }
    }

    if (shouldFetch('waterActions')) {
      const items = await db.waterAction.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, actionType: true, priority: true, status: true, plannedDate: true, createdAt: true, commune: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } }, inspection: { select: { reference: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } }, sample: { select: { reference: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } }, sanitationIncident: { select: { reference: true, latitude: true, longitude: true, commune: true } } } })
      const priorityColors: Record<string, string> = { LOW: '#64748b', NORMAL: '#2563eb', HIGH: '#ea580c', URGENT: '#dc2626' }
      for (const action of items) {
        const source = action.waterPoint || action.pool || action.inspection?.waterPoint || action.inspection?.pool || action.sample?.waterPoint || action.sample?.pool || action.sanitationIncident
        if (!source || source.latitude == null || source.longitude == null) continue
        points.push({ layer: 'waterActions', id: action.id, reference: action.reference, title: `🛠️ ${action.actionType}`, subtitle: `${action.priority} · ${action.status}`, lat: source.latitude, lng: source.longitude, status: action.status, color: priorityColors[action.priority] || '#1d4ed8', icon: '🛠️', commune: action.commune || source.commune, createdAt: action.createdAt.toISOString() })
      }
    }

    if (shouldFetch('waterDisinfection')) {
      const items = await db.waterDisinfectionOperation.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, operationType: true, status: true, productName: true, operationDate: true, commune: true, createdAt: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      for (const operation of items) {
        const source = operation.waterPoint || operation.pool
        if (!source || source.latitude == null || source.longitude == null) continue
        points.push({ layer: 'waterDisinfection', id: operation.id, reference: operation.reference, title: `🧴 ${operation.productName || 'عملية تطهير'}`, subtitle: `${operation.operationType} · ${operation.status}`, lat: source.latitude, lng: source.longitude, status: operation.status, color: '#059669', icon: '🧴', commune: operation.commune || source.commune, createdAt: operation.createdAt.toISOString() })
      }
    }

    if (shouldFetch('waterIncidents')) {
      const items = await db.waterIncident.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, incidentType: true, severity: true, status: true, description: true, latitude: true, longitude: true, commune: true, startedAt: true, createdAt: true } })
      const colors: Record<string, string> = { LOW: '#64748b', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#be123c' }
      for (const incident of items) {
        if (incident.latitude == null || incident.longitude == null) continue
        points.push({ layer: 'waterIncidents', id: incident.id, reference: incident.reference, title: `⚠️ ${incident.incidentType}`, subtitle: `${incident.severity} · ${incident.status}`, lat: incident.latitude, lng: incident.longitude, status: incident.status, color: colors[incident.severity] || '#be123c', icon: '⚠️', commune: incident.commune, createdAt: incident.startedAt.toISOString() })
      }
    }

    if (shouldFetch('waterAlerts')) {
      const settingRows = await db.communeSettings.findMany({
        where: communeFilter ? { commune: communeFilter } : {},
        select: { commune: true, settings: true },
      })
      const alertLeadDaysByCommune = new Map(settingRows.map((row) => {
        const water = parseStoredSettings(row.settings).water
        const values = water && typeof water === 'object' && !Array.isArray(water) ? water as Record<string, unknown> : {}
        const days = Math.min(90, Math.max(1, Number(values.alertLeadDays) || DEFAULT_WATER_ALERT_LEAD_DAYS))
        return [row.commune, days] as const
      }))
      const maxAlertLeadDays = Math.max(DEFAULT_WATER_ALERT_LEAD_DAYS, ...Array.from(alertLeadDaysByCommune.values()))
      const alertLeadDays = (commune: string) => alertLeadDaysByCommune.get(commune) || DEFAULT_WATER_ALERT_LEAD_DAYS
      const [measurements, inspections, devices, incidents, actions] = await Promise.all([
        db.waterMeasurement.findMany({ where: { ...where, conformity: 'NON_CONFORM' }, take: limit, select: { id: true, reference: true, measurementDate: true, createdAt: true, commune: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } } } }),
        db.waterInspection.findMany({ where: { ...where, status: { not: 'CLOSED' }, OR: [{ riskLevel: { in: ['HIGH', 'CRITICAL'] } }, { conformity: 'NON_CONFORM' }] }, take: limit, select: { id: true, reference: true, riskLevel: true, riskScore: true, inspectionDate: true, createdAt: true, commune: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } }),
        db.waterDevice.findMany({ where: { ...where, status: { not: 'OUT_OF_SERVICE' }, calibrationDueDate: { not: null, lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }, take: limit, select: { id: true, reference: true, name: true, calibrationDueDate: true, updatedAt: true, commune: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } } } }),
        db.sanitationIncident.findMany({ where: { ...where, riskLevel: { in: ['HIGH', 'CRITICAL'] }, status: { not: 'CLOSED' } }, take: limit, select: { id: true, reference: true, type: true, riskLevel: true, createdAt: true, commune: true, latitude: true, longitude: true } }),
        db.waterAction.findMany({ where: { ...where, status: { in: ['PLANNED', 'ASSIGNED', 'IN_PROGRESS'] }, OR: [{ plannedDate: { not: null, lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }, { followUpDate: { not: null, lte: new Date(Date.now() + maxAlertLeadDays * 86400000) } }] }, take: limit, select: { id: true, reference: true, actionType: true, status: true, plannedDate: true, followUpDate: true, commune: true, waterPoint: { select: { name: true, latitude: true, longitude: true, commune: true } }, pool: { select: { name: true, latitude: true, longitude: true, commune: true } } } }),
      ])
      for (const measurement of measurements) {
        const source = measurement.waterPoint
        if (source.latitude == null || source.longitude == null) continue
        points.push({ layer: 'waterAlerts', id: `measurement-${measurement.id}`, reference: measurement.reference, title: `🚨 قياس غير مطابق ${source.name}`, subtitle: 'يلزم التحقق واتخاذ إجراء', lat: source.latitude, lng: source.longitude, status: 'HIGH', color: '#b91c1c', icon: '🚨', commune: measurement.commune || source.commune, createdAt: measurement.createdAt.toISOString() })
      }
      for (const inspection of inspections) {
        const source = inspection.waterPoint || inspection.pool
        if (!source || source.latitude == null || source.longitude == null) continue
        points.push({ layer: 'waterAlerts', id: `inspection-${inspection.id}`, reference: inspection.reference, title: `🚨 خطر معاينة ${source.name}`, subtitle: `${inspection.riskLevel} · ${inspection.riskScore}/100`, lat: source.latitude, lng: source.longitude, status: inspection.riskLevel, color: '#dc2626', icon: '🚨', commune: inspection.commune || source.commune, createdAt: inspection.createdAt.toISOString() })
      }
      for (const device of devices) {
        const source = device.waterPoint
        if (!source || source.latitude == null || source.longitude == null || !device.calibrationDueDate || device.calibrationDueDate.getTime() > Date.now() + alertLeadDays(device.commune) * 86400000) continue
        points.push({ layer: 'waterAlerts', id: `device-${device.id}`, reference: device.reference, title: `🚨 معايرة جهاز ${device.name}`, subtitle: device.calibrationDueDate ? `موعد المعايرة: ${device.calibrationDueDate.toLocaleDateString('ar-MA')}` : 'موعد المعايرة غير محدد', lat: source.latitude, lng: source.longitude, status: 'MEDIUM', color: '#f59e0b', icon: '🚨', commune: device.commune || source.commune, createdAt: device.updatedAt.toISOString() })
      }
      for (const incident of incidents) {
        if (incident.latitude == null || incident.longitude == null) continue
        points.push({ layer: 'waterAlerts', id: `sanitation-${incident.id}`, reference: incident.reference, title: `🚨 حادث صرف ${incident.type}`, subtitle: `مستوى الخطر: ${incident.riskLevel}`, lat: incident.latitude, lng: incident.longitude, status: incident.riskLevel, color: '#dc2626', icon: '🚨', commune: incident.commune, createdAt: incident.createdAt.toISOString() })
      }
      for (const action of actions) {
        const source = action.waterPoint || action.pool
        const dueDate = action.followUpDate || action.plannedDate
        if (!source || source.latitude == null || source.longitude == null || !dueDate || dueDate.getTime() > Date.now() + alertLeadDays(action.commune) * 86400000) continue
        const overdue = dueDate.getTime() < Date.now()
        points.push({ layer: 'waterAlerts', id: `action-${action.id}`, reference: action.reference, title: `🚨 ${overdue ? 'إجراء متأخر' : 'موعد إجراء قريب'} · ${action.actionType}`, subtitle: `${action.status} · ${dueDate.toLocaleDateString('ar-MA')}`, lat: source.latitude, lng: source.longitude, status: overdue ? 'HIGH' : 'MEDIUM', color: overdue ? '#b91c1c' : '#f59e0b', icon: '🚨', commune: action.commune || source.commune, createdAt: dueDate.toISOString() })
      }
    }

    // تلوث
    if (shouldFetch('pollution')) {
      const items = await db.pollutionIncident.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, type: true, description: true, severity: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const sevColors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626' }
      const typeIcons: Record<string, string> = { AIR: '💨', WATER: '💧', SOIL: '🌍', NOISE: '🔊', ODOUR: '👃', SMOKE: '🏭', DUST: '🌪️', WASTEWATER: '🚿', INDUSTRIAL: '⚗️' }
      for (const p of items) {
        if (p.latitude == null || p.longitude == null) continue
        points.push({ layer: 'pollution', id: p.id, reference: p.reference, title: `${typeIcons[p.type] || '🏭'} ${p.type}`, subtitle: (p.description || '').slice(0, 60), lat: p.latitude, lng: p.longitude, status: p.status, color: sevColors[p.severity] || '#64748b', icon: typeIcons[p.type] || '🏭', commune: p.commune, createdAt: p.createdAt.toISOString() })
      }
    }

    // نفايات
    if (shouldFetch('waste')) {
      const items = await db.wasteBlackSpot.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, wasteType: true, description: true, status: true, recurring: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      for (const w of items) {
        if (w.latitude == null || w.longitude == null) continue
        points.push({ layer: 'waste', id: w.id, reference: w.reference, title: `🗑️ ${w.wasteType}`, subtitle: w.recurring ? '⚠️ متكرر' : '', lat: w.latitude, lng: w.longitude, status: w.status, color: w.recurring ? '#dc2626' : '#f59e0b', icon: '🗑️', commune: w.commune, createdAt: w.createdAt.toISOString() })
      }
    }

    // مواقع طبيعية
    if (shouldFetch('sites')) {
      const items = await db.naturalSite.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, type: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { INTACT: '#10b981', THREATENED: '#f59e0b', DEGRADED: '#ef4444', PROTECTED: '#3b82f6' }
      const typeIcons: Record<string, string> = { FOREST: '🌲', WETLAND: '🦩', COASTAL: '🏖️', PARK: '🏞️', RESERVE: '🛡️', HISTORICAL: '🏛️', OTHER: '📍' }
      for (const s of items) {
        if (s.latitude == null || s.longitude == null) continue
        points.push({ layer: 'sites', id: s.id, reference: s.reference, title: `${typeIcons[s.type] || '🌳'} ${s.name}`, subtitle: s.type, lat: s.latitude, lng: s.longitude, status: s.status, color: statusColors[s.status] || '#10b981', icon: typeIcons[s.type] || '🌳', commune: s.commune, createdAt: s.createdAt.toISOString() })
      }
    }

    // الملفات البيئية
    if (shouldFetch('environmentalDossiers')) {
      const items = await db.environmentalDossier.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, title: true, category: true, riskLevel: true, status: true, description: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const riskColors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626' }
      for (const dossier of items) {
        if (dossier.latitude == null || dossier.longitude == null) continue
        points.push({ layer: 'environmentalDossiers', id: dossier.id, reference: dossier.reference, title: `🌍 ${dossier.title || dossier.category}`, subtitle: `${dossier.category} · ${(dossier.description || '').slice(0, 45)}`, lat: dossier.latitude, lng: dossier.longitude, status: dossier.status, color: riskColors[dossier.riskLevel] || '#15803d', icon: '🌍', commune: dossier.commune, createdAt: dossier.createdAt.toISOString() })
      }
    }

    // حيوانات شاردة (بلاغات)
    if (shouldFetch('animals')) {
      const items = await db.strayReport.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, species: true, description: true, statut: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      for (const s of items) {
        if (s.latitude == null || s.longitude == null) continue
        points.push({ layer: 'animals', id: s.id, reference: s.reference, title: `🐾 ${s.species || 'حيوان شارد'}`, subtitle: (s.description || '').slice(0, 60), lat: s.latitude, lng: s.longitude, status: s.statut, color: '#f59e0b', icon: '🐾', commune: s.commune, createdAt: s.createdAt.toISOString() })
      }
    }

    // مهام التقاط الحيوانات
    if (shouldFetch('captureMissions')) {
      const items = await db.captureMission.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, zone: true, statut: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { PLANIFIEE: '#7c3aed', EN_ROUTE: '#2563eb', SUR_PLACE: '#0891b2', CAPTURE_EN_COURS: '#d97706', TERMINEE: '#10b981', ANNULEE: '#64748b' }
      for (const mission of items) {
        if (mission.latitude == null || mission.longitude == null) continue
        points.push({ layer: 'captureMissions', id: mission.id, reference: mission.reference, title: `🚐 مهمة التقاط`, subtitle: mission.zone || 'منطقة التدخل', lat: mission.latitude, lng: mission.longitude, status: mission.statut, color: statusColors[mission.statut] || '#9333ea', icon: '🚐', commune: mission.commune, createdAt: mission.createdAt.toISOString() })
      }
    }

    // الحيوانات الملتقطة ميدانياً
    if (shouldFetch('capturedAnimals')) {
      const items = await db.strayAnimal.findMany({ where: createdAtWhere, take: limit, select: { id: true, csvrNumber: true, species: true, statut: true, captureLatitude: true, captureLongitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { CAPTURE: '#c026d3', ADMIT_CENTRE: '#9333ea', STERILISE: '#2563eb', VACCINE: '#0891b2', ADOPTE: '#10b981', DECEDE: '#64748b' }
      for (const animal of items) {
        if (animal.captureLatitude == null || animal.captureLongitude == null) continue
        points.push({ layer: 'capturedAnimals', id: animal.id, reference: animal.csvrNumber, title: `🐕‍🦺 ${animal.species}`, subtitle: 'موقع الالتقاط', lat: animal.captureLatitude, lng: animal.captureLongitude, status: animal.statut, color: statusColors[animal.statut] || '#c026d3', icon: '🐕‍🦺', commune: animal.commune, createdAt: animal.createdAt.toISOString() })
      }
    }

    // وجهات الحيوانات بعد المعالجة
    if (shouldFetch('animalDestinations')) {
      const items = await db.strayAnimalDestination.findMany({ where: createdAtWhere, take: limit, select: { id: true, type: true, site: true, quartier: true, latitude: true, longitude: true, commune: true, createdAt: true, animal: { select: { csvrNumber: true, species: true } } } })
      const destinationLabels: Record<string, string> = { RETURN: 'إعادة إلى المجال', ADOPTION: 'تبنٍ', TRANSFER: 'نقل', DEATH: 'نفوق' }
      for (const destination of items) {
        if (destination.latitude == null || destination.longitude == null) continue
        points.push({ layer: 'animalDestinations', id: destination.id, reference: destination.animal.csvrNumber, title: `↩️ ${destinationLabels[destination.type] || destination.type}`, subtitle: destination.site || destination.quartier || destination.animal.species, lat: destination.latitude, lng: destination.longitude, status: destination.type, color: '#0f766e', icon: '↩️', commune: destination.commune, createdAt: destination.createdAt.toISOString() })
      }
    }

    // النقاط الساخنة للحيوانات الشاردة
    if (shouldFetch('animalHotspots')) {
      const items = await db.strayAnimalHotspot.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, quartier: true, location: true, latitude: true, longitude: true, priority: true, status: true, reportCount: true, groupCount: true, biteCount: true, interventionCount: true, commune: true, createdAt: true } })
      const priorityColors: Record<string, string> = { LOW: '#84cc16', MODERATE: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626' }
      for (const hotspot of items) {
        if (hotspot.latitude == null || hotspot.longitude == null) continue
        points.push({ layer: 'animalHotspots', id: hotspot.id, reference: hotspot.reference, title: `🔥 ${hotspot.name}`, subtitle: `${hotspot.quartier || hotspot.location || 'نقطة ساخنة'} · بلاغات: ${hotspot.reportCount} · عضات: ${hotspot.biteCount}`, lat: hotspot.latitude, lng: hotspot.longitude, status: hotspot.status, color: priorityColors[hotspot.priority] || '#f59e0b', icon: '🔥', commune: hotspot.commune, createdAt: hotspot.createdAt.toISOString() })
      }
    }

    // الحيوانات النافقة
    if (shouldFetch('animalDeaths')) {
      const items = await db.strayAnimalDeathReport.findMany({ where: { ...where, ...(dateFilter ? { reportedAt: dateFilter } : {}) }, take: limit, select: { id: true, reference: true, species: true, quantity: true, quartier: true, location: true, latitude: true, longitude: true, healthSuspicion: true, accident: true, commune: true, reportedAt: true } })
      for (const death of items) {
        if (death.latitude == null || death.longitude == null) continue
        const status = death.healthSuspicion ? 'اشتباه صحي' : death.accident ? 'حادث' : 'مسجلة'
        points.push({ layer: 'animalDeaths', id: death.id, reference: death.reference, title: `🕊️ ${death.species} × ${death.quantity}`, subtitle: `${death.quartier || death.location || 'موقع غير محدد'} · ${status}`, lat: death.latitude, lng: death.longitude, status, color: death.healthSuspicion ? '#dc2626' : death.accident ? '#ea580c' : '#475569', icon: '🕊️', commune: death.commune, createdAt: death.reportedAt.toISOString() })
      }
    }

    // التنبيهات الصحية مرتبطة بإحداثيات الالتقاط للحيوان
    if (shouldFetch('animalHealthAlerts')) {
      const healthAlertWhere = { ...(dateFilter ? { createdAt: dateFilter } : {}), ...(communeFilter ? { animal: { commune: communeFilter } } : {}) }
      const items = await db.strayAnimalHealthAlert.findMany({ where: healthAlertWhere, take: limit, select: { id: true, type: true, urgency: true, clinicalSuspicion: true, measureTaken: true, createdAt: true, animal: { select: { csvrNumber: true, species: true, commune: true, captureLatitude: true, captureLongitude: true } } } })
      const urgencyColors: Record<string, string> = { NORMAL: '#f59e0b', HIGH: '#ea580c', URGENT: '#dc2626' }
      for (const alert of items) {
        if (alert.animal.captureLatitude == null || alert.animal.captureLongitude == null) continue
        points.push({ layer: 'animalHealthAlerts', id: alert.id, reference: alert.animal.csvrNumber, title: `🩸 ${alert.animal.species} · ${alert.urgency}`, subtitle: (alert.measureTaken || 'تنبيه صحي') .slice(0, 70), lat: alert.animal.captureLatitude, lng: alert.animal.captureLongitude, status: alert.type, color: urgencyColors[alert.urgency] || '#dc2626', icon: '🩸', commune: alert.animal.commune, createdAt: alert.createdAt.toISOString() })
      }
    }

    // مراكز الإيواء والمراكز البيطرية
    if (shouldFetch('animalCenters')) {
      const items = await db.strayAnimalCenter.findMany({ where, take: limit, select: { id: true, name: true, type: true, status: true, capacity: true, latitude: true, longitude: true, adresse: true, commune: true, createdAt: true, _count: { select: { admissions: true } } } })
      const typeLabels: Record<string, string> = { REFUGE: 'إيواء', CENTRE_VETERINAIRE: 'بيطري', QUARANTINE: 'حجر صحي', OTHER: 'أخرى' }
      for (const center of items) {
        if (center.latitude == null || center.longitude == null) continue
        points.push({ layer: 'animalCenters', id: center.id, reference: `CENTER-${center.id}`, title: `🏠 ${center.name}`, subtitle: `${typeLabels[center.type] || center.type} · السعة: ${center.capacity || '—'} · سجلات الاستقبال: ${center._count.admissions}`, lat: center.latitude, lng: center.longitude, status: center.status, color: center.status === 'ACTIVE' ? '#7c3aed' : '#64748b', icon: '🏠', commune: center.commune, createdAt: center.createdAt.toISOString() })
      }
    }

    // حوادث صرف
    if (shouldFetch('sanitation')) {
      const items = await db.sanitationIncident.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, type: true, description: true, riskLevel: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const riskColors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626' }
      for (const s of items) {
        if (s.latitude == null || s.longitude == null) continue
        points.push({ layer: 'sanitation', id: s.id, reference: s.reference, title: `🚿 ${s.type}`, subtitle: (s.description || '').slice(0, 60), lat: s.latitude, lng: s.longitude, status: s.status, color: riskColors[s.riskLevel] || '#64748b', icon: '🚿', commune: s.commune, createdAt: s.createdAt.toISOString() })
      }
    }

    if (shouldFetch('sanitationAssets')) {
      const items = await db.sanitationAsset.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, type: true, status: true, nextMaintenanceAt: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const assetIcons: Record<string, string> = { SEWER_LINE: '🛣️', DRAIN: '🚿', PUMP_STATION: '⚙️', TANK: '🛢️', TREATMENT_PLANT: '🏭' }
      for (const asset of items) {
        if (asset.latitude == null || asset.longitude == null) continue
        const overdue = asset.nextMaintenanceAt != null && asset.nextMaintenanceAt.getTime() < Date.now()
        points.push({ layer: 'sanitationAssets', id: asset.id, reference: asset.reference, title: `${assetIcons[asset.type] || '🏗️'} ${asset.name}`, subtitle: `${asset.type} · ${overdue ? 'الصيانة متأخرة' : asset.status}`, lat: asset.latitude, lng: asset.longitude, status: overdue ? 'MAINTENANCE' : asset.status, color: overdue ? '#dc2626' : '#c2410c', icon: assetIcons[asset.type] || '🏗️', commune: asset.commune, createdAt: asset.createdAt.toISOString() })
      }
    }

    // حالات عضة
    if (shouldFetch('biteCases')) {
      const items = await db.biteCase.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, animalType: true, description: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const typeIcons: Record<string, string> = { DOG: '🐕', CAT: '🐈', MONKEY: '🐒', OTHER: '🐾' }
      for (const b of items) {
        if (b.latitude == null || b.longitude == null) continue
        points.push({ layer: 'biteCases', id: b.id, reference: b.reference, title: `${typeIcons[b.animalType] || '🐾'} ${b.animalType}`, subtitle: (b.description || '').slice(0, 60), lat: b.latitude, lng: b.longitude, status: b.status, color: '#dc2626', icon: typeIcons[b.animalType] || '🐾', commune: b.commune, createdAt: b.createdAt.toISOString() })
      }
    }

    // المقابر التابعة للجماعة
    if (shouldFetch('cemeteries')) {
      const items = await db.cemetery.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, name: true, type: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { ACTIVE: '#334155', FULL: '#dc2626', CLOSED: '#64748b', MAINTENANCE: '#f59e0b' }
      for (const cemetery of items) {
        if (cemetery.latitude == null || cemetery.longitude == null) continue
        points.push({ layer: 'cemeteries', id: cemetery.id, reference: cemetery.reference, title: `🪦 ${cemetery.name}`, subtitle: cemetery.type, lat: cemetery.latitude, lng: cemetery.longitude, status: cemetery.status, color: statusColors[cemetery.status] || '#334155', icon: '🪦', commune: cemetery.commune, createdAt: cemetery.createdAt.toISOString() })
      }
    }

    // ملفات الدفن والنبش مرتبطة بإحداثيات المقبرة
    if (shouldFetch('burials')) {
      const items = await db.burialDossier.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, deceasedName: true, status: true, commune: true, createdAt: true, cemetery: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const statusColors: Record<string, string> = { NEW: '#64748b', AUTHORIZED: '#3b82f6', BURIED: '#334155', CLOSED: '#10b981' }
      for (const burial of items) {
        if (burial.cemetery?.latitude == null || burial.cemetery.longitude == null) continue
        points.push({ layer: 'burials', id: burial.id, reference: burial.reference, title: `⚰️ دفن ${burial.deceasedName}`, subtitle: burial.cemetery.name, lat: burial.cemetery.latitude, lng: burial.cemetery.longitude, status: burial.status, color: statusColors[burial.status] || '#475569', icon: '⚰️', commune: burial.commune || burial.cemetery.commune, createdAt: burial.createdAt.toISOString() })
      }
    }

    if (shouldFetch('exhumations')) {
      const items = await db.exhumationDossier.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, deceasedName: true, status: true, commune: true, createdAt: true, cemetery: { select: { name: true, latitude: true, longitude: true, commune: true } } } })
      const statusColors: Record<string, string> = { NEW: '#64748b', AUTHORIZED: '#3b82f6', COMPLETED: '#10b981', REJECTED: '#dc2626' }
      for (const exhumation of items) {
        if (exhumation.cemetery?.latitude == null || exhumation.cemetery.longitude == null) continue
        points.push({ layer: 'exhumations', id: exhumation.id, reference: exhumation.reference, title: `🧾 نبش ${exhumation.deceasedName}`, subtitle: exhumation.cemetery.name, lat: exhumation.cemetery.latitude, lng: exhumation.cemetery.longitude, status: exhumation.status, color: statusColors[exhumation.status] || '#64748b', icon: '🧾', commune: exhumation.commune || exhumation.cemetery.commune, createdAt: exhumation.createdAt.toISOString() })
      }
    }

    // البلاغات الغذائية
    if (shouldFetch('foodReports')) {
      const items = await db.foodReport.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, reportType: true, establishmentName: true, description: true, statut: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { NOUVEAU: '#e11d48', VERIFICATION: '#f59e0b', EN_COURS: '#3b82f6', TRAITE: '#10b981', REJETE: '#64748b', CLASSE: '#64748b' }
      for (const report of items) {
        if (report.latitude == null || report.longitude == null) continue
        points.push({ layer: 'foodReports', id: report.id, reference: report.reference, title: `🥗 ${report.establishmentName || report.reportType}`, subtitle: (report.description || '').slice(0, 60), lat: report.latitude, lng: report.longitude, status: report.statut, color: statusColors[report.statut] || '#e11d48', icon: '🥗', commune: report.commune, createdAt: report.createdAt.toISOString() })
      }
    }

    // أوامر العمل
    if (shouldFetch('workOrders')) {
      const items = await db.workOrder.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, title: true, description: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { NOUVEAU: '#7c3aed', ASSIGNE: '#3b82f6', EN_ROUTE: '#8b5cf6', EN_COURS: '#f59e0b', TERMINE: '#10b981', ANNULE: '#64748b' }
      for (const order of items) {
        if (order.latitude == null || order.longitude == null) continue
        points.push({ layer: 'workOrders', id: order.id, reference: order.reference, title: `🧭 ${order.title}`, subtitle: (order.description || '').slice(0, 60), lat: order.latitude, lng: order.longitude, status: order.status, color: statusColors[order.status] || '#7c3aed', icon: '🧭', commune: order.commune, createdAt: order.createdAt.toISOString() })
      }
    }

    // الملفات الموحّدة
    if (shouldFetch('dossiers')) {
      const items = await db.dossier.findMany({ where: createdAtWhere, take: limit, select: { id: true, reference: true, title: true, description: true, status: true, latitude: true, longitude: true, commune: true, createdAt: true } })
      const statusColors: Record<string, string> = { NEW: '#475569', ASSIGNED: '#3b82f6', IN_PROGRESS: '#f59e0b', CLOSED: '#10b981', ARCHIVED: '#64748b' }
      for (const dossier of items) {
        if (dossier.latitude == null || dossier.longitude == null) continue
        points.push({ layer: 'dossiers', id: dossier.id, reference: dossier.reference, title: `🗂️ ${dossier.title || dossier.reference}`, subtitle: (dossier.description || '').slice(0, 60), lat: dossier.latitude, lng: dossier.longitude, status: dossier.status, color: statusColors[dossier.status] || '#475569', icon: '🗂️', commune: dossier.commune, createdAt: dossier.createdAt.toISOString() })
      }
    }

    const polygonCommunes = typeof communeFilter === 'string'
      ? [communeFilter]
      : communeFilter?.in || []
    const scopedPoints = polygonCommunes.length > 0
      ? await filterPointsToCommunes(points, polygonCommunes)
      : points

    return NextResponse.json({ points: scopedPoints, total: scopedPoints.length })
  } catch (error) {
    console.error('GET gis/points error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
