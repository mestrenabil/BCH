import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Aggregate statistics for a single campagne. */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    const campagne = await db.campagne.findUnique({ where: { id } })
    if (!campagne) {
      return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    }

    // Enforce commune access
    if (!canAccessCommune(user, campagne.commune)) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 403 })
    }

    // Fetch all interventions linked to this campagne
    const interventions = await db.intervention.findMany({
      where: { campagneId: id },
      select: {
        statut: true,
        type: true,
        quartier: true,
        coutTotal: true,
        superficie: true,
      },
    })

    const total = interventions.length
    const byStatut: Record<string, number> = {}
    const byType: Record<string, number> = {}
    const byQuartier: Record<string, number> = {}
    let totalCost = 0
    let totalArea = 0

    for (const iv of interventions) {
      byStatut[iv.statut] = (byStatut[iv.statut] || 0) + 1
      byType[iv.type] = (byType[iv.type] || 0) + 1
      if (iv.quartier) byQuartier[iv.quartier] = (byQuartier[iv.quartier] || 0) + 1
      totalCost += iv.coutTotal ?? 0
      const area = parseFloat(iv.superficie)
      if (!isNaN(area)) totalArea += area
    }

    const completed = byStatut['TERMINEE'] || 0
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
    const budgetUsage = campagne.budgetPrevu && campagne.budgetPrevu > 0
      ? Math.round((totalCost / campagne.budgetPrevu) * 100)
      : 0

    // Day-by-day progression (cumulative completed interventions by date)
    const progression = await db.intervention.findMany({
      where: { campagneId: id, statut: 'TERMINEE' },
      orderBy: { date: 'asc' },
      select: { date: true },
    })

    const dailyMap: Record<string, number> = {}
    let cumulative = 0
    for (const p of progression) {
      cumulative++
      const key = p.date.toISOString().slice(0, 10)
      dailyMap[key] = cumulative
    }
    const progressionSeries = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

    return NextResponse.json({
      stats: {
        total,
        completed,
        completionRate,
        totalCost,
        totalArea,
        budgetPrevu: campagne.budgetPrevu ?? 0,
        budgetUsage,
        byStatut,
        byType,
        byQuartier,
        progressionSeries,
      },
    })
  } catch (error) {
    console.error('GET campagne stats error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل إحصائيات الحملة' }, { status: 500 })
  }
}
