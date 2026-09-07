import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || String(new Date().getFullYear())
    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const startOfYear = new Date(`${year}-01-01T00:00:00.000Z`)
    const endOfYear = new Date(`${Number(year) + 1}-01-01T00:00:00.000Z`)
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    const communeWhere = communeFilter ? { commune: communeFilter } : {}

    // Reports queries
    const [
      totalReports,
      reportsToday,
      urgentReports,
      rabiesReports,
      reportsByStatus,
      reportsByPriority,
      reportsBySpecies,
      reportsByQuartier,
      reportsMonthly,
    ] = await Promise.all([
      db.strayReport.count({ where: communeWhere }),
      db.strayReport.count({ where: { ...communeWhere, createdAt: { gte: startOfToday } } }),
      db.strayReport.count({ where: { ...communeWhere, priority: { in: ['URGENTE', 'SANITAIRE'] } } }),
      db.strayReport.count({ where: { ...communeWhere, rabiesSuspect: true } }),
      db.strayReport.groupBy({ by: ['statut'], where: communeWhere, _count: true }),
      db.strayReport.groupBy({ by: ['priority'], where: communeWhere, _count: true }),
      db.strayReport.groupBy({ by: ['species'], where: communeWhere, _count: true }),
      db.strayReport.groupBy({ by: ['quartier'], where: communeWhere, _count: true }),
      db.strayReport.findMany({
        where: { ...communeWhere, createdAt: { gte: startOfYear, lt: endOfYear } },
        select: { createdAt: true, species: true },
      }),
    ])

    // Mission queries
    const [
      totalMissions,
      missionsPlanned,
      missionsCompleted,
      missionsOverdue,
      animalsCapturedFromMissions,
    ] = await Promise.all([
      db.captureMission.count({ where: communeWhere }),
      db.captureMission.count({ where: { ...communeWhere, statut: 'PLANIFIEE' } }),
      db.captureMission.count({ where: { ...communeWhere, statut: 'TERMINEE' } }),
      db.captureMission.count({
        where: {
          ...communeWhere,
          statut: { in: ['PLANIFIEE', 'CONFIRME'] },
          scheduledAt: { lt: now },
        },
      }),
      db.captureMission.aggregate({ where: { ...communeWhere, statut: 'TERMINEE' }, _sum: { capturedCount: true } }),
    ])

    // Animal queries
    const [
      totalAnimals,
      animalsByStatus,
      animalsBySpecies,
      animalsBySex,
      animalsSterilized,
      animalsVaccinated,
      animalsAdopted,
      animalsDeceased,
      animalsAtCenter,
      animalsInQuarantine,
      bitesReported,
    ] = await Promise.all([
      db.strayAnimal.count({ where: communeWhere }),
      db.strayAnimal.groupBy({ by: ['statut'], where: communeWhere, _count: true }),
      db.strayAnimal.groupBy({ by: ['species'], where: communeWhere, _count: true }),
      db.strayAnimal.groupBy({ by: ['sex'], where: communeWhere, _count: true }),
      db.strayAnimal.count({ where: { ...communeWhere, statut: { in: ['STERILISE', 'VACCINE', 'IDENTIFIE', 'CONVALESCENCE', 'PRET_RELACHER', 'RELACHE', 'ADOPTABLE', 'ADOPTE'] } } }),
      db.strayAnimal.count({ where: { ...communeWhere, statut: { in: ['VACCINE', 'IDENTIFIE', 'CONVALESCENCE', 'PRET_RELACHER', 'RELACHE', 'ADOPTABLE', 'ADOPTE'] } } }),
      db.strayAnimal.count({ where: { ...communeWhere, statut: 'ADOPTE' } }),
      db.strayAnimal.count({ where: { ...communeWhere, statut: 'DECEDE' } }),
      db.strayAnimal.count({ where: { ...communeWhere, statut: { in: ['ADMIT_CENTRE', 'QUARANTINE', 'OBSERVATION', 'SOINS', 'CONVALESCENCE'] } } }),
      db.strayAnimal.count({ where: { ...communeWhere, statut: 'QUARANTINE' } }),
      db.strayReport.count({ where: { ...communeWhere, biteReported: true } }),
    ])

    // Process monthly data for chart
    const monthly: Record<string, Record<string, number>> = {}
    for (let m = 1; m <= 12; m++) {
      monthly[`${year}-${String(m).padStart(2, '0')}`] = { DOG: 0, CAT: 0, HORSE: 0, DONKEY: 0, FARM: 0, OTHER: 0 }
    }
    for (const r of reportsMonthly) {
      const monthKey = `${year}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`
      if (monthly[monthKey]) {
        const sp = r.species || 'OTHER'
        monthly[monthKey][sp]++
      }
    }

    // Compute rates
    const sterilizationRate = totalAnimals > 0 ? Math.round((animalsSterilized / totalAnimals) * 100) : 0
    const vaccinationRate = totalAnimals > 0 ? Math.round((animalsVaccinated / totalAnimals) * 100) : 0
    const adoptionRate = totalAnimals > 0 ? Math.round((animalsAdopted / totalAnimals) * 100) : 0

    return NextResponse.json({
      reports: {
        total: totalReports,
        today: reportsToday,
        urgent: urgentReports,
        rabiesSuspect: rabiesReports,
        bites: bitesReported,
        byStatus: Object.fromEntries(reportsByStatus.map((s) => [s.statut, s._count])),
        byPriority: Object.fromEntries(reportsByPriority.map((s) => [s.priority, s._count])),
        bySpecies: Object.fromEntries(reportsBySpecies.map((s) => [s.species, s._count])),
        byQuartier: reportsByQuartier
          .map((q) => ({ quartier: q.quartier || 'غير محدد', count: q._count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15),
        monthly,
      },
      missions: {
        total: totalMissions,
        planned: missionsPlanned,
        completed: missionsCompleted,
        overdue: missionsOverdue,
        animalsCaptured: animalsCapturedFromMissions._sum.capturedCount || 0,
      },
      animals: {
        total: totalAnimals,
        atCenter: animalsAtCenter,
        inQuarantine: animalsInQuarantine,
        sterilized: animalsSterilized,
        vaccinated: animalsVaccinated,
        adopted: animalsAdopted,
        deceased: animalsDeceased,
        byStatus: Object.fromEntries(animalsByStatus.map((s) => [s.statut, s._count])),
        bySpecies: Object.fromEntries(animalsBySpecies.map((s) => [s.species, s._count])),
        bySex: Object.fromEntries(animalsBySex.map((s) => [s.sex, s._count])),
        sterilizationRate,
        vaccinationRate,
        adoptionRate,
      },
    })
  } catch (error) {
    console.error('GET csvr/statistics error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الإحصائيات' }, { status: 500 })
  }
}
