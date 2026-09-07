import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { recordActivity } from '@/lib/activity-log'
import { ensureStrayReportDossier } from '@/lib/vigilance-links'

const ALLOWED_STATUS = new Set([
  'NOUVEAU', 'VERIFICATION', 'VALIDE', 'MISSION_PLANIFIEE', 'EN_COURS',
  'TRAITE', 'PARTIEL', 'NON_LOCALISE', 'DOUBLON', 'CLASSE',
])
const ALLOWED_PRIORITY = new Set(['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'])
const ALLOWED_SPECIES = new Set(['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER'])
const ALLOWED_SOURCE = new Set(['INTERNAL', 'PUBLIC', 'PHONE', 'AUTHORITY', 'ASSOCIATION', 'AGENT', 'COMMUNE', 'EDUCATIONAL', 'HEALTH', 'SECURITY', 'PROGRAMMED', 'OTHER'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const priority = searchParams.get('priority')
    const species = searchParams.get('species')
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
    if (species) where.species = species
    if (quartier) where.quartier = { contains: quartier }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to)
      where.createdAt = dateFilter
    }
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { declarantName: { contains: search } },
        { declarantPhone: { contains: search } },
        { adresse: { contains: search } },
        { description: { contains: search } },
        { quartier: { contains: search } },
      ]
    }

    const reports = await db.strayReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { photos: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    const total = await db.strayReport.count({ where })

    return NextResponse.json({ reports, total })
  } catch (error) {
    console.error('GET csvr/reports error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البلاغات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      source, declarantName, declarantPhone, declarantRole,
      commune, quartier, secteur, adresse, latitude, longitude,
      species, estimatedCount, hasYoung, isAggressive, isInjured, isSick,
      rabiesSuspect, biteReported, nearSchool, nearMarket, nearHealth, nearDump,
      description, priority, observations, territoryFilter,
    } = body

    if (!description && !adresse) {
      return NextResponse.json({ error: 'يرجى تقديم وصف أو عنوان للبلاغ' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء البلاغ' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    const finalSource = ALLOWED_SOURCE.has(source) ? source : 'INTERNAL'
    const finalPriority = ALLOWED_PRIORITY.has(priority) ? priority : 'NORMALE'
    const finalSpecies = ALLOWED_SPECIES.has(species) ? species : 'DOG'

    // Generate reference: SIG-CSVR-YYYY-XXXXXX
    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `SIG-CSVR-${year}-${random}`
      const exists = await db.strayReport.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) {
      reference = `SIG-CSVR-${year}-${Date.now().toString(36).toUpperCase()}`
    }

    const report = await db.strayReport.create({
      data: {
        reference,
        source: finalSource,
        declarantName: declarantName || '',
        declarantPhone: declarantPhone || '',
        declarantRole: declarantRole || '',
        commune: enforcedCommune,
        quartier: quartier || '',
        secteur: secteur || '',
        adresse: adresse || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        species: finalSpecies,
        estimatedCount: parseInt(estimatedCount, 10) || 1,
        hasYoung: Boolean(hasYoung),
        isAggressive: Boolean(isAggressive),
        isInjured: Boolean(isInjured),
        isSick: Boolean(isSick),
        rabiesSuspect: Boolean(rabiesSuspect),
        biteReported: Boolean(biteReported),
        nearSchool: Boolean(nearSchool),
        nearMarket: Boolean(nearMarket),
        nearHealth: Boolean(nearHealth),
        nearDump: Boolean(nearDump),
        description: description || '',
        priority: finalPriority,
        statut: 'NOUVEAU',
        observations: observations || '',
      },
    })
    try {
      await ensureStrayReportDossier(report, user)
    } catch (linkError) {
      console.error('Create stray report dossier error:', linkError)
    }

    await recordActivity({
      user, action: 'CREATE', entityType: 'CSVR_REPORT', entityId: report.id,
      commune: enforcedCommune, details: { reference: report.reference, species: finalSpecies, priority: finalPriority },
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST csvr/reports error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء البلاغ' }, { status: 500 })
  }
}
