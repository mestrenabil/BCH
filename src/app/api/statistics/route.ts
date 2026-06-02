import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCommuneFilter } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year')
    const requestedCommune = searchParams.get('commune')

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

    const where: Record<string, unknown> = {}
    if (year) {
      const start = new Date(parseInt(year), 0, 1)
      const end = new Date(parseInt(year), 11, 31)
      where.date = { gte: start, lte: end }
    }
    if (communeFilter) where.commune = communeFilter

    const [total, byType, byStatut, byQuartier, byCommune, monthly, recent] = await Promise.all([
      // Total count
      db.intervention.count({ where }),
      // By type
      db.intervention.groupBy({
        by: ['type'],
        _count: true,
        where,
      }),
      // By status
      db.intervention.groupBy({
        by: ['statut'],
        _count: true,
        where,
      }),
      // By quartier
      db.intervention.groupBy({
        by: ['quartier'],
        _count: true,
        where,
        orderBy: { _count: { quartier: 'desc' } },
      }),
      // By commune
      db.intervention.groupBy({
        by: ['commune'],
        _count: true,
        where,
      }),
      // Monthly for current year
      db.intervention.findMany({
        where,
        select: { date: true, type: true },
        orderBy: { date: 'asc' },
      }),
      // Recent interventions
      db.intervention.findMany({
        where,
        orderBy: { date: 'desc' },
        take: 10,
      }),
    ])

    // Process monthly data
    const monthlyData: Record<string, Record<string, number>> = {}
    for (const item of monthly) {
      const monthKey = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, '0')}`
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { DERATISATION: 0, DESINSECTISATION: 0, DESINFECTION: 0 }
      }
      monthlyData[monthKey][item.type] = (monthlyData[monthKey][item.type] || 0) + 1
    }

    // Process type data
    const typeStats = {
      DERATISATION: 0,
      DESINSECTISATION: 0,
      DESINFECTION: 0,
    }
    for (const item of byType) {
      typeStats[item.type as keyof typeof typeStats] = item._count
    }

    // Process statut data
    const statutStats = {
      PLANIFIEE: 0,
      EN_COURS: 0,
      TERMINEE: 0,
      ANNULEE: 0,
    }
    for (const item of byStatut) {
      statutStats[item.statut as keyof typeof statutStats] = item._count
    }

    // Process commune data
    const communeStats: Record<string, { total: number; DERATISATION: number; DESINSECTISATION: number; DESINFECTION: number }> = {}
    for (const item of byCommune) {
      const key = item.commune || 'غير محدد'
      if (!communeStats[key]) {
        communeStats[key] = { total: 0, DERATISATION: 0, DESINSECTISATION: 0, DESINFECTION: 0 }
      }
      communeStats[key].total = item._count
    }

    // Get detailed commune+type breakdown
    const byCommuneType = await db.intervention.groupBy({
      by: ['commune', 'type'],
      _count: true,
      where,
    })
    for (const item of byCommuneType) {
      const key = item.commune || 'غير محدد'
      if (!communeStats[key]) {
        communeStats[key] = { total: 0, DERATISATION: 0, DESINSECTISATION: 0, DESINFECTION: 0 }
      }
      if (item.type === 'DERATISATION' || item.type === 'DESINSECTISATION' || item.type === 'DESINFECTION') {
        communeStats[key][item.type] = item._count
      }
    }

    // Get quartiers list — also filter by user's commune
    const quartierWhere: Record<string, unknown> = {}
    if (communeFilter) quartierWhere.commune = communeFilter
    const quartiers = await db.quartier.findMany({ where: quartierWhere })

    return NextResponse.json({
      total,
      byType: typeStats,
      byStatut: statutStats,
      byQuartier: byQuartier.map(q => ({ quartier: q.quartier, count: q._count })),
      byCommune: communeStats,
      monthly: monthlyData,
      recent,
      quartiers,
      userCommune: user.commune, // Send user's commune so frontend knows
    })
  } catch (error) {
    console.error('Statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الإحصائيات' }, { status: 500 })
  }
}
