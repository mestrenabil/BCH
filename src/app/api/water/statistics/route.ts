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
    const recentCutoff = new Date(now)
    recentCutoff.setDate(recentCutoff.getDate() - 90)

    const [
      waterPointsRegistered,
      activeWaterPoints,
      overdueWaterPoints,
      measurementsTotal,
      nonConformingMeasurements,
      samplesTotal,
      inspectionsTotal,
      highRiskInspections,
      activePools,
      openSanitationIncidents,
      criticalSanitationIncidents,
      openActions,
      overdueDevices,
      disinfectionOperations,
    ] = await Promise.all([
      db.waterPoint.count({ where: { ...scope, createdAt: yearRange } }),
      db.waterPoint.count({ where: { ...scope, status: 'ACTIVE' } }),
      db.waterPoint.count({ where: { ...scope, measurements: { none: { measurementDate: { gte: recentCutoff } } } } }),
      db.waterMeasurement.count({ where: { ...scope, measurementDate: yearRange } }),
      db.waterMeasurement.count({ where: { ...scope, measurementDate: yearRange, conformity: 'NON_CONFORM' } }),
      db.waterSample.count({ where: { ...scope, sampleDate: yearRange } }),
      db.waterInspection.count({ where: { ...scope, inspectionDate: yearRange } }),
      db.waterInspection.count({ where: { ...scope, inspectionDate: yearRange, riskLevel: { in: ['HIGH', 'CRITICAL'] } } }),
      db.pool.count({ where: { ...scope, status: 'ACTIVE' } }),
      db.sanitationIncident.count({ where: { ...scope, status: { not: 'CLOSED' } } }),
      db.sanitationIncident.count({ where: { ...scope, status: { not: 'CLOSED' }, riskLevel: 'CRITICAL' } }),
      db.waterAction.count({ where: { ...scope, status: { not: 'CLOSED' } } }),
      db.waterDevice.count({ where: { ...scope, status: { not: 'OUT_OF_SERVICE' }, calibrationDueDate: { not: null, lt: now } } }),
      db.waterDisinfectionOperation.count({ where: { ...scope, operationDate: yearRange } }),
    ])

    return NextResponse.json({
      year,
      metrics: {
        waterPointsRegistered,
        activeWaterPoints,
        overdueWaterPoints,
        measurementsTotal,
        nonConformingMeasurements,
        samplesTotal,
        inspectionsTotal,
        highRiskInspections,
        activePools,
        openSanitationIncidents,
        criticalSanitationIncidents,
        openActions,
        overdueDevices,
        disinfectionOperations,
      },
      scope: { commune: user.commune, managedCommunes: user.managedCommunes },
    })
  } catch (error) {
    console.error('GET water statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حساب مؤشرات الماء والتطهير' }, { status: 500 })
  }
}
