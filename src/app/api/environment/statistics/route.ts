import { db } from '@/lib/db'
import { getScopedCommuneFilter, requireAuth } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

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
    const scope = communeFilter ? { commune: communeFilter } : {}
    const yearRange = rangeForYear(year)
    const now = new Date()
    const openDossierStatuses = { notIn: ['CLOSED', 'ARCHIVED'] }
    const openPollutionStatuses = { not: 'CLOSED' }
    const openWasteStatuses = { notIn: ['CLOSED', 'CLEANED'] }
    const openComplaintStatuses = { notIn: ['TRAITEE', 'REJETEE'] }

    const [
      dossiersTotal,
      openDossiers,
      highRiskDossiers,
      overdueDossiers,
      pollutionTotal,
      openPollution,
      criticalPollution,
      wasteTotal,
      recurringWaste,
      threatenedSites,
      inspectionsTotal,
      overdueInspections,
      followUpsTotal,
      overdueFollowUps,
      programsTotal,
      activePrograms,
      campaignsTotal,
      activeCampaigns,
      environmentalComplaints,
      openEnvironmentalComplaints,
      waterPoints,
      nonConformingWaterMeasurements,
    ] = await Promise.all([
      db.environmentalDossier.count({ where: { ...scope, createdAt: yearRange } }),
      db.environmentalDossier.count({ where: { ...scope, createdAt: yearRange, status: openDossierStatuses } }),
      db.environmentalDossier.count({ where: { ...scope, createdAt: yearRange, status: openDossierStatuses, riskLevel: { in: ['HIGH', 'CRITICAL'] } } }),
      db.environmentalDossier.count({ where: { ...scope, createdAt: yearRange, status: openDossierStatuses, dueDate: { not: null, lt: now } } }),
      db.pollutionIncident.count({ where: { ...scope, createdAt: yearRange } }),
      db.pollutionIncident.count({ where: { ...scope, createdAt: yearRange, status: openPollutionStatuses } }),
      db.pollutionIncident.count({ where: { ...scope, createdAt: yearRange, status: openPollutionStatuses, severity: { in: ['HIGH', 'CRITICAL'] } } }),
      db.wasteBlackSpot.count({ where: { ...scope, createdAt: yearRange } }),
      db.wasteBlackSpot.count({ where: { ...scope, createdAt: yearRange, status: openWasteStatuses, OR: [{ recurring: true }, { recurrenceCount: { gt: 1 } }] } }),
      db.naturalSite.count({ where: { ...scope, createdAt: yearRange, status: { in: ['THREATENED', 'DEGRADED'] } } }),
      db.environmentalInspection.count({ where: { ...scope, createdAt: yearRange } }),
      db.environmentalInspection.count({ where: { ...scope, createdAt: yearRange, nextFollowUpDate: { not: null, lt: now } } }),
      db.environmentalFollowUp.count({ where: { ...scope, createdAt: yearRange } }),
      db.environmentalFollowUp.count({ where: { ...scope, createdAt: yearRange, damageRemoved: { not: 'YES' }, nextFollowUpDate: { not: null, lt: now } } }),
      db.environmentalProgram.count({ where: { ...scope, createdAt: yearRange } }),
      db.environmentalProgram.count({ where: { ...scope, createdAt: yearRange, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      db.awarenessCampaign.count({ where: { ...scope, createdAt: yearRange } }),
      db.awarenessCampaign.count({ where: { ...scope, createdAt: yearRange, status: { notIn: ['COMPLETED', 'CANCELLED'] } } }),
      db.complaint.count({ where: { ...scope, type: 'ENVIRONMENT', createdAt: yearRange } }),
      db.complaint.count({ where: { ...scope, type: 'ENVIRONMENT', createdAt: yearRange, statut: openComplaintStatuses } }),
      db.waterPoint.count({ where: scope }),
      db.waterMeasurement.count({ where: { ...scope, measurementDate: yearRange, conformity: 'NON_CONFORM' } }),
    ])

    return NextResponse.json({
      year,
      metrics: {
        dossiersTotal, openDossiers, highRiskDossiers, overdueDossiers,
        pollutionTotal, openPollution, criticalPollution, wasteTotal, recurringWaste,
        threatenedSites, inspectionsTotal, overdueInspections, followUpsTotal, overdueFollowUps,
        programsTotal, activePrograms, campaignsTotal, activeCampaigns,
        environmentalComplaints, openEnvironmentalComplaints, waterPoints, nonConformingWaterMeasurements,
      },
      scope: { commune: user.commune, managedCommunes: user.managedCommunes },
    })
  } catch (error) {
    console.error('GET environment statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حساب المؤشرات البيئية' }, { status: 500 })
  }
}
