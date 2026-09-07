import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const type = searchParams.get('type')
    const search = searchParams.get('search')
    const activeOnly = searchParams.get('active') === 'true'

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    const year = Number(searchParams.get('year'))
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) where.dateDebut = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
    if (statut) where.statut = statut
    if (type) where.type = type
    if (activeOnly) {
      where.statut = { in: ['PLANIFIEE', 'EN_COURS'] }
    }
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { nom: { contains: search } },
        { description: { contains: search } },
        { responsable: { contains: search } },
        { objectif: { contains: search } },
      ]
    }

    const campagnes = await db.campagne.findMany({
      where,
      orderBy: { dateDebut: 'desc' },
      include: {
        _count: { select: { interventions: true } },
      },
    })

    const total = await db.campagne.count({ where })

    return NextResponse.json({ campagnes, total })
  } catch (error) {
    console.error('GET campagnes error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الحملات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      nom, type, commune, description, objectif,
      budgetPrevu, dateDebut, dateFin, statut,
      responsable, couleur, territoryFilter,
    } = body

    // Validate required fields
    if (!nom || !type || !dateDebut) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء الحملة' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    // Generate unique reference: CAMP-YYYY-NNN
    const year = new Date(dateDebut).getFullYear()
    let reference = ''
    let created = false
    let attempts = 0

    while (!created && attempts < 5) {
      attempts++
      const count = await db.campagne.count({
        where: { reference: { startsWith: `CAMP-${year}-` } },
      })
      const seq = String(count + attempts).padStart(3, '0')
      reference = `CAMP-${year}-${seq}`
      const existing = await db.campagne.findUnique({ where: { reference } })
      if (!existing) created = true
    }

    if (!created) {
      const timestamp = Date.now().toString(36).toUpperCase()
      reference = `CAMP-${year}-${timestamp}`
    }

    const campagne = await db.campagne.create({
      data: {
        nom,
        type,
        commune: enforcedCommune,
        description: description || '',
        objectif: objectif || '',
        budgetPrevu: budgetPrevu ? parseFloat(budgetPrevu) : null,
        coutReel: 0,
        dateDebut: new Date(dateDebut),
        dateFin: dateFin ? new Date(dateFin) : null,
        statut: statut || 'PLANIFIEE',
        responsable: responsable || '',
        couleur: couleur || '#10b981',
        reference,
      },
      include: {
        _count: { select: { interventions: true } },
      },
    })

    return NextResponse.json({ campagne }, { status: 201 })
  } catch (error) {
    console.error('POST campagnes error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الحملة' }, { status: 500 })
  }
}
