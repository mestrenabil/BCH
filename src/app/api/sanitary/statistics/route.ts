import { db } from '@/lib/db'
import { getScopedCommuneFilter, requireAuth } from '@/lib/auth'
import type { CommuneScope } from '@/lib/territory-scope'
import { NextRequest, NextResponse } from 'next/server'

function rangeForYear(year: number) {
  return { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
}

function scopeForCommune(communeFilter: CommuneScope) {
  return communeFilter ? { commune: communeFilter } : {}
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
    const scope = scopeForCommune(communeFilter)
    const yearRange = rangeForYear(year)
    const now = new Date()
    const monthStart = new Date(year, now.getMonth(), 1)
    const monthEnd = new Date(year, now.getMonth() + 1, 1)
    const overdueUntil = now < yearRange.lt ? now : yearRange.lt
    const overdueRange = { gte: yearRange.gte, lt: overdueUntil }
    const inspectionYearWhere = { ...scope, inspectionDate: yearRange }
    const inspectionRelationWhere = communeFilter ? { commune: communeFilter } : {}

    const [
      establishmentsRegistered,
      activeEstablishments,
      healthCardsTotal,
      expiredHealthCards,
      inspectionsThisMonth,
      inspectionsTotal,
      conformingInspections,
      nonConformingInspections,
      openFindings,
      criticalFindings,
      openFoodNonConformities,
      criticalFoodNonConformities,
      overdueControls,
      counterVisits,
      samplesCollected,
      labNonConformities,
      foodComplaints,
      expiredProducts,
      temperatureAlerts,
      oilNonConformities,
    ] = await Promise.all([
      db.establishment.count({ where: { ...scope, createdAt: yearRange } }),
      db.establishment.count({ where: { ...scope, status: 'ACTIVE' } }),
      db.healthCard.count({ where: { ...scope, createdAt: yearRange } }),
      db.healthCard.count({ where: { ...scope, expiryDate: { not: null, lt: now } } }),
      db.inspection.count({ where: { ...scope, inspectionDate: { gte: monthStart, lt: monthEnd } } }),
      db.inspection.count({ where: inspectionYearWhere }),
      db.inspection.findMany({ where: { ...inspectionYearWhere, overallResult: 'CONFORM' }, distinct: ['establishmentId'], select: { establishmentId: true } }),
      db.inspection.findMany({ where: { ...inspectionYearWhere, overallResult: { in: ['NON_CONFORM_MINOR', 'NON_CONFORM_MAJOR', 'NON_CONFORM_CRITICAL'] } }, distinct: ['establishmentId'], select: { establishmentId: true } }),
      db.finding.count({ where: { status: 'OPEN', inspection: { ...inspectionRelationWhere, inspectionDate: yearRange } } }),
      db.finding.count({ where: { status: 'OPEN', severity: 'CRITICAL', inspection: { ...inspectionRelationWhere, inspectionDate: yearRange } } }),
      db.foodNonConformity.count({ where: { ...scope, status: { not: 'CLOSED' }, createdAt: yearRange } }),
      db.foodNonConformity.count({ where: { ...scope, level: 'CRITICAL', status: { not: 'CLOSED' }, createdAt: yearRange } }),
      db.inspection.count({ where: { ...scope, status: 'PLANNED', inspectionDate: overdueRange } }),
      db.counterVisit.count({ where: { visitDate: yearRange, inspection: inspectionRelationWhere } }),
      db.sample.count({ where: { ...scope, sampleDate: yearRange } }),
      db.labResult.count({ where: { ...scope, analyzedAt: { not: null, gte: yearRange.gte, lt: yearRange.lt }, conformity: 'NON_CONFORM' } }),
      db.foodReport.count({ where: { ...scope, createdAt: yearRange } }),
      db.foodProduct.count({ where: { ...scope, expiryDate: { not: null, gte: yearRange.gte, lt: overdueUntil } } }),
      db.temperatureLog.count({ where: { ...scope, measuredAt: yearRange, conformity: 'NON_CONFORM' } }),
      db.fryingOilCheck.count({ where: { ...scope, checkedAt: yearRange, conformity: 'NON_CONFORM' } }),
    ])

    return NextResponse.json({
      year,
      metrics: {
        establishmentsRegistered,
        activeEstablishments,
        healthCardsTotal,
        expiredHealthCards,
        inspectionsThisMonth,
        inspectionsTotal,
        conformingEstablishments: conformingInspections.length,
        nonConformingEstablishments: nonConformingInspections.length,
        openNonConformities: openFindings + openFoodNonConformities,
        criticalNonConformities: criticalFindings + criticalFoodNonConformities,
        overdueControls,
        counterVisits,
        samplesCollected,
        labNonConformities,
        foodComplaints,
        expiredProducts,
        temperatureAlerts,
        oilNonConformities,
      },
      scope: { commune: user.commune, managedCommunes: user.managedCommunes },
    })
  } catch (error) {
    console.error('GET sanitary statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حساب المؤشرات الصحية' }, { status: 500 })
  }
}
