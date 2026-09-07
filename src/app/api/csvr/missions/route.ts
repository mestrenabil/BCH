import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set([
  'PLANIFIEE', 'CONFIRME', 'EN_ROUTE', 'SUR_PLACE', 'CAPTURE_EN_COURS',
  'TERMINEE', 'PARTIEL', 'REPORTEE', 'ANNULEE',
])
const ALLOWED_PRIORITY = new Set(['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const priority = searchParams.get('priority')
    const quartier = searchParams.get('quartier')
    const search = searchParams.get('search')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (statut) where.statut = statut
    if (priority) where.priority = priority
    if (quartier) where.quartier = { contains: quartier }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)
      where.scheduledAt = dateFilter
    }
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { teamLead: { contains: search } },
        { driver: { contains: search } },
        { quartier: { contains: search } },
        { zone: { contains: search } },
      ]
    }

    const missions = await db.captureMission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { reports: true, animals: true } },
      },
    })

    const total = await db.captureMission.count({ where })

    return NextResponse.json({ missions, total })
  } catch (error) {
    console.error('GET csvr/missions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المهام' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      commune, quartier, latitude, longitude, zone, scheduledAt,
      priority, teamLead, driver, agents, veterinarian, vehicle, equipment,
      cagesAvailable, estimatedAnimals, safetyNotes, preNotes, territoryFilter,
      reportIds,
    } = body

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء المهمة' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    const finalPriority = ALLOWED_PRIORITY.has(priority) ? priority : 'NORMALE'

    // Generate reference: MIS-CSVR-YYYY-NNN
    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await db.captureMission.count({ where: { reference: { startsWith: `MIS-CSVR-${year}-` } } })
      const candidate = `MIS-CSVR-${year}-${String(count + 1 + attempt).padStart(3, '0')}`
      const exists = await db.captureMission.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) {
      reference = `MIS-CSVR-${year}-${Date.now().toString(36).toUpperCase()}`
    }

    const mission = await db.captureMission.create({
      data: {
        reference,
        commune: enforcedCommune,
        quartier: quartier || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        zone: zone || '',
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        priority: finalPriority,
        statut: 'PLANIFIEE',
        teamLead: teamLead || '',
        driver: driver || '',
        agents: typeof agents === 'string' ? agents : JSON.stringify(agents || []),
        veterinarian: veterinarian || '',
        vehicle: vehicle || '',
        equipment: equipment || '',
        cagesAvailable: parseInt(cagesAvailable, 10) || 0,
        estimatedAnimals: parseInt(estimatedAnimals, 10) || 0,
        safetyNotes: safetyNotes || '',
        preNotes: preNotes || '',
        createdBy: user.nom,
      },
    })

    // Link reports if provided
    if (Array.isArray(reportIds) && reportIds.length > 0) {
      await db.strayReport.updateMany({
        where: { id: { in: reportIds }, commune: enforcedCommune },
        data: { missionId: mission.id, statut: 'MISSION_PLANIFIEE' },
      })
    }

    await recordActivity({
      user, action: 'CREATE', entityType: 'CSVR_MISSION', entityId: mission.id,
      commune: enforcedCommune, details: { reference: mission.reference, priority: finalPriority },
    })

    return NextResponse.json(mission, { status: 201 })
  } catch (error) {
    console.error('POST csvr/missions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء المهمة' }, { status: 500 })
  }
}
