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
    const expiringLimit = new Date(now)
    expiringLimit.setDate(expiringLimit.getDate() + 90)

    const [
      productsTotal,
      expiringProducts,
      expiredProducts,
      productsForValue,
      stockMovements,
      stockOutMovements,
      bitesTotal,
      openBites,
      suspectBites,
      rigPendingCases,
      overdueVaccinations,
    ] = await Promise.all([
      db.pestProduct.count({ where: scope }),
      db.pestProduct.count({ where: { ...scope, expiryDate: { not: null, gte: now, lte: expiringLimit } } }),
      db.pestProduct.count({ where: { ...scope, expiryDate: { not: null, lt: now } } }),
      db.pestProduct.findMany({ where: scope, select: { quantityStock: true, thresholdAlert: true, unitPrice: true } }),
      db.pestStockMovement.count({ where: { ...scope, createdAt: yearRange } }),
      db.pestStockMovement.count({ where: { ...scope, createdAt: yearRange, type: 'SORTIE' } }),
      db.biteCase.count({ where: { ...scope, biteDate: yearRange } }),
      db.biteCase.count({ where: { ...scope, status: { notIn: ['CLOSED', 'LOST_CONTACT'] } } }),
      db.biteCase.count({ where: { ...scope, animalStatus: 'SUSPECT', status: { not: 'CLOSED' } } }),
      db.biteCase.count({ where: { ...scope, rigIndicated: true, rigAdministered: false, status: { not: 'CLOSED' } } }),
      db.biteVaccinationStep.count({ where: { status: 'PLANNED', scheduledDate: { not: null, lt: now }, biteCase: scope } }),
    ])

    const totalStockQuantity = productsForValue.reduce((total, product) => total + product.quantityStock, 0)
    const stockValue = productsForValue.reduce((total, product) => total + product.quantityStock * product.unitPrice, 0)
    const lowStockProducts = productsForValue.filter((product) => product.quantityStock <= product.thresholdAlert).length

    return NextResponse.json({
      year,
      metrics: {
        productsTotal,
        lowStockProducts,
        expiringProducts,
        expiredProducts,
        totalStockQuantity,
        stockValue,
        stockMovements,
        stockOutMovements,
        bitesTotal,
        openBites,
        suspectBites,
        rigPendingCases,
        overdueVaccinations,
      },
      scope: { commune: user.commune, managedCommunes: user.managedCommunes },
    })
  } catch (error) {
    console.error('GET vector statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حساب مؤشرات محاربة النواقل' }, { status: 500 })
  }
}
