import { db } from '@/lib/db'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

type CommuneFilter = ReturnType<typeof getScopedCommuneFilter>

function buildScope(communeFilter: CommuneFilter): Record<string, unknown> {
  if (!communeFilter) return {}
  return { commune: communeFilter }
}

function buildInventoryScope(communeFilter: CommuneFilter): Record<string, unknown> {
  if (!communeFilter) return {}
  return { OR: [{ commune: communeFilter }, { commune: '' }] }
}

function rangeForYear(year: number) {
  return { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const parsedYear = Number(searchParams.get('year'))
    const year = Number.isInteger(parsedYear) && parsedYear >= 2020 ? parsedYear : new Date().getFullYear()
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const scope = buildScope(communeFilter)
    const createdAt = rangeForYear(year)
    const where = { createdAt, ...scope }
    const interventionWhere = { date: createdAt, ...scope }
    const inventoryWhere = { createdAt, ...buildInventoryScope(communeFilter) }
    const now = new Date()
    const todayRange = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) }
    const todayWhere = { createdAt: todayRange, ...scope }
    const todayInterventionWhere = { date: todayRange, ...scope }

    const [
      interventions,
      complaints,
      workOrders,
      agents,
      documents,
      campagnes,
      strayReports,
      captureMissions,
      strayAnimals,
      foodReports,
      dossiers,
      establishments,
      inspections,
      healthCards,
      samples,
      waterPoints,
      waterMeasurements,
      pools,
      sanitationIncidents,
      pestProducts,
      biteCases,
      deathCases,
      burials,
      cemeteries,
      corpseTransports,
      exhumations,
      environmentalDossiers,
      pollutionIncidents,
      wasteBlackSpots,
      naturalSites,
      awarenessCampaigns,
      authorizationDossiers,
      sanitaryOpinions,
      committeeVisits,
      activityLog,
      interventionStatus,
      interventionType,
      complaintStatus,
      workOrderStatus,
      productRows,
      pestProductRows,
      userCount,
      settingsCount,
      todayInterventions,
      todayComplaints,
      todayWorkOrders,
      todayInspections,
      todayStrayReports,
      todayFoodReports,
      todayEnvironmentalDossiers,
      todayWaterMeasurements,
      todayActivityCount,
    ] = await Promise.all([
      db.intervention.count({ where: interventionWhere }),
      db.complaint.count({ where }),
      db.workOrder.count({ where }),
      db.agent.count({ where }),
      db.document.count({ where }),
      db.campagne.count({ where }),
      db.strayReport.count({ where }),
      db.captureMission.count({ where }),
      db.strayAnimal.count({ where }),
      db.foodReport.count({ where }),
      db.dossier.count({ where }),
      db.establishment.count({ where }),
      db.inspection.count({ where }),
      db.healthCard.count({ where }),
      db.sample.count({ where }),
      db.waterPoint.count({ where }),
      db.waterMeasurement.count({ where }),
      db.pool.count({ where }),
      db.sanitationIncident.count({ where }),
      db.pestProduct.count({ where }),
      db.biteCase.count({ where }),
      db.deathCase.count({ where }),
      db.burialDossier.count({ where }),
      db.cemetery.count({ where }),
      db.corpseTransport.count({ where }),
      db.exhumationDossier.count({ where }),
      db.environmentalDossier.count({ where }),
      db.pollutionIncident.count({ where }),
      db.wasteBlackSpot.count({ where }),
      db.naturalSite.count({ where }),
      db.awarenessCampaign.count({ where }),
      db.authorizationDossier.count({ where }),
      db.sanitaryOpinion.count({ where }),
      db.committeeVisit.count({ where }),
      db.activityLog.findMany({ where, orderBy: { createdAt: 'desc' }, take: 12 }),
      db.intervention.groupBy({ by: ['statut'], where: interventionWhere, _count: true }),
      db.intervention.groupBy({ by: ['type'], where: interventionWhere, _count: true }),
      db.complaint.groupBy({ by: ['statut'], where, _count: true }),
      db.workOrder.groupBy({ by: ['status'], where, _count: true }),
      db.product.findMany({ where: inventoryWhere, select: { quantiteStock: true, seuilAlerte: true, dateExpiration: true } }),
      db.pestProduct.findMany({ where: inventoryWhere, select: { quantityStock: true, thresholdAlert: true, expiryDate: true } }),
      db.user.count({ where }),
      db.communeSettings.count({ where: scope }),
      db.intervention.count({ where: todayInterventionWhere }),
      db.complaint.count({ where: todayWhere }),
      db.workOrder.count({ where: todayWhere }),
      db.inspection.count({ where: todayWhere }),
      db.strayReport.count({ where: todayWhere }),
      db.foodReport.count({ where: todayWhere }),
      db.environmentalDossier.count({ where: todayWhere }),
      db.waterMeasurement.count({ where: todayWhere }),
      db.activityLog.count({ where: todayWhere }),
    ])

    const statusMap = (rows: Array<{ _count: number; statut?: string; status?: string }>) =>
      rows.reduce<Record<string, number>>((result, row) => {
        const key = row.statut || row.status || 'UNKNOWN'
        result[key] = row._count
        return result
      }, {})

    const stock = [...productRows.map((item) => ({ quantity: item.quantiteStock, threshold: item.seuilAlerte, expiry: item.dateExpiration })),
      ...pestProductRows.map((item) => ({ quantity: item.quantityStock, threshold: item.thresholdAlert, expiry: item.expiryDate }))]
    const today = new Date()
    const expiryLimit = new Date(today)
    expiryLimit.setDate(expiryLimit.getDate() + 30)
    const interventionStatuses = statusMap(interventionStatus)
    const interventionTypes = interventionType.reduce<Record<string, number>>((result, row) => {
      result[row.type] = row._count
      return result
    }, {})
    const complaintStatuses = statusMap(complaintStatus)
    const workOrderStatuses = statusMap(workOrderStatus)
    const inventoryCount = productRows.length + pestProductRows.length
    const recordTotal = interventions + complaints + workOrders + documents + campagnes + inventoryCount + strayReports + captureMissions + strayAnimals + foodReports + dossiers + establishments + inspections + healthCards + samples + waterPoints + waterMeasurements + pools + sanitationIncidents + pestProducts + biteCases + deathCases + burials + cemeteries + corpseTransports + exhumations + environmentalDossiers + pollutionIncidents + wasteBlackSpots + naturalSites + awarenessCampaigns + authorizationDossiers + sanitaryOpinions + committeeVisits
    const mapRecordTotal = interventions + complaints + workOrders + strayReports + foodReports + pollutionIncidents + waterPoints

    return NextResponse.json({
      year,
      scope: { commune: user.commune, managedCommunes: user.managedCommunes },
      sections: {
        map: mapRecordTotal,
        interventions, complaints, workOrders, agents, inventory: inventoryCount, documents, campagnes,
        csvr: strayReports + captureMissions + strayAnimals,
        food: foodReports,
        dossiers,
        sanitary: establishments + inspections + healthCards + samples,
        water: waterPoints + waterMeasurements + pools + sanitationIncidents,
        vector: pestProducts + biteCases,
        funeral: deathCases + burials + cemeteries + corpseTransports + exhumations,
        environment: environmentalDossiers + pollutionIncidents + wasteBlackSpots + naturalSites + awarenessCampaigns,
        authorizations: authorizationDossiers + sanitaryOpinions + committeeVisits,
        reports: interventions + complaints + workOrders + dossiers,
        calendar: workOrders + campagnes + interventions,
        operations: interventions + workOrders,
        kpi: interventions,
        alerts: (complaintStatuses.EN_ATTENTE || 0) + (workOrderStatuses.NOUVEAU || 0) + stock.filter((item) => item.quantity <= item.threshold).length,
        notifications: activityLog.length,
        activityLog: activityLog.length,
        timeline: activityLog.length,
        export: recordTotal,
        users: userCount,
        settings: settingsCount,
        helpCenter: 0,
      },
      details: {
        map: { total: mapRecordTotal },
        interventions: { total: interventions, DERATISATION: interventionTypes.DERATISATION || 0, DESINSECTISATION: interventionTypes.DESINSECTISATION || 0, DESINFECTION: interventionTypes.DESINFECTION || 0 },
        complaints: { total: complaints, EN_ATTENTE: complaintStatuses.EN_ATTENTE || 0, EN_COURS: complaintStatuses.EN_COURS || 0, TRAITEE: complaintStatuses.TRAITEE || 0, REJETEE: complaintStatuses.REJETEE || 0 },
        workOrders: { total: workOrders, NOUVEAU: workOrderStatuses.NOUVEAU || 0, ASSIGNE: workOrderStatuses.ASSIGNE || 0, EN_COURS: workOrderStatuses.EN_COURS || 0, TERMINE: workOrderStatuses.TERMINE || 0 },
        agents: { total: agents, active: agents },
        inventory: { total: inventoryCount, products: productRows.length, vectorProducts: pestProductRows.length, lowStock: stock.filter((item) => item.quantity <= item.threshold).length },
        documents: { total: documents },
        campagnes: { total: campagnes },
        csvr: { reports: strayReports, missions: captureMissions, animals: strayAnimals },
        food: { reports: foodReports },
        dossiers: { total: dossiers },
        sanitary: { establishments, inspections, healthCards, samples },
        water: { points: waterPoints, measurements: waterMeasurements, pools, sanitationIncidents },
        vector: { products: pestProducts, bites: biteCases },
        funeral: { deaths: deathCases, burials, cemeteries, transports: corpseTransports, exhumations },
        environment: { dossiers: environmentalDossiers, pollution: pollutionIncidents, waste: wasteBlackSpots, sites: naturalSites, campaigns: awarenessCampaigns },
        authorizations: { dossiers: authorizationDossiers, opinions: sanitaryOpinions, visits: committeeVisits },
        reports: { interventions, complaints, workOrders, dossiers },
        calendar: { workOrders, campagnes, interventions },
        operations: { interventions, workOrders },
        kpi: { interventions },
        alerts: { complaints: complaintStatuses.EN_ATTENTE || 0, workOrders: workOrderStatuses.NOUVEAU || 0, lowStock: stock.filter((item) => item.quantity <= item.threshold).length },
        activityLog: { total: activityLog.length },
        timeline: { total: activityLog.length },
        export: { total: recordTotal },
        users: { total: userCount },
        settings: { total: settingsCount },
      },
      totals: {
        records: recordTotal,
        activeAgents: agents,
        lowStock: stock.filter((item) => item.quantity <= item.threshold).length,
        expiringStock: stock.filter((item) => item.expiry && item.expiry <= expiryLimit && item.expiry >= today).length,
      },
      today: {
        total: todayInterventions + todayComplaints + todayWorkOrders + todayInspections + todayStrayReports + todayFoodReports + todayEnvironmentalDossiers + todayWaterMeasurements,
        interventions: todayInterventions,
        complaints: todayComplaints,
        workOrders: todayWorkOrders,
        inspections: todayInspections,
        fieldOperations: todayStrayReports + todayFoodReports + todayEnvironmentalDossiers + todayWaterMeasurements,
        activityLog: todayActivityCount,
      },
      statuses: {
        interventions: interventionStatuses,
        complaints: complaintStatuses,
        workOrders: workOrderStatuses,
      },
      activityLog,
    })
  } catch (error) {
    console.error('Dashboard overview error:', error)
    return NextResponse.json({ error: 'تعذر تحميل ملخص الأقسام' }, { status: 500 })
  }
}
