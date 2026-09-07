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

    const [
      deathsTotal,
      morgueAdmitted,
      burialsTotal,
      pendingBurialAuthorizations,
      cemeteriesTotal,
      fullCemeteries,
      transportsTotal,
      pendingTransportAuthorizations,
      exhumationsTotal,
      pendingExhumationAuthorizations,
    ] = await Promise.all([
      db.deathCase.count({ where: { ...scope, createdAt: yearRange } }),
      db.deathCase.count({ where: { ...scope, morgueStatus: 'ADMITTED' } }),
      db.burialDossier.count({ where: { ...scope, createdAt: yearRange } }),
      db.burialDossier.count({ where: { ...scope, createdAt: yearRange, authorizationStatus: 'PENDING' } }),
      db.cemetery.count({ where: scope }),
      db.cemetery.count({ where: { ...scope, status: 'FULL' } }),
      db.corpseTransport.count({ where: { ...scope, createdAt: yearRange } }),
      db.corpseTransport.count({ where: { ...scope, createdAt: yearRange, authorizationStatus: 'PENDING' } }),
      db.exhumationDossier.count({ where: { ...scope, createdAt: yearRange } }),
      db.exhumationDossier.count({ where: { ...scope, createdAt: yearRange, authorizationStatus: 'PENDING' } }),
    ])

    return NextResponse.json({
      year,
      metrics: {
        deathsTotal,
        morgueAdmitted,
        burialsTotal,
        pendingBurialAuthorizations,
        cemeteriesTotal,
        fullCemeteries,
        transportsTotal,
        pendingTransportAuthorizations,
        exhumationsTotal,
        pendingExhumationAuthorizations,
        pendingAuthorizations: pendingBurialAuthorizations + pendingTransportAuthorizations + pendingExhumationAuthorizations,
      },
      scope: { commune: user.commune, managedCommunes: user.managedCommunes },
    })
  } catch (error) {
    console.error('GET funeral statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حساب مؤشرات الجنائز والمقابر' }, { status: 500 })
  }
}
