import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const actif = searchParams.get('actif')

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (actif !== null && actif !== undefined) where.actif = actif === 'true'

    const agents = await db.agent.findMany({
      where,
      include: { team: { select: { id: true, name: true, office: true, mission: true, color: true, commune: true, actif: true } } },
      orderBy: { nom: 'asc' },
    })

    return NextResponse.json({ agents })
  } catch (error) {
    console.error('GET agents error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الأعوان' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { nom, prenom, telephone, commune, fonction, actif, teamId, territoryFilter } = body

    if (!nom) {
      return NextResponse.json({ error: 'يرجى إدخال اسم العون' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إضافة العون' }, { status: 400 })
    }

    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي الحالي' }, { status: 403 })
    }

    if (teamId) {
      const team = await db.team.findUnique({ where: { id: teamId }, select: { commune: true } })
      if (!team || team.commune !== enforcedCommune) {
        return NextResponse.json({ error: 'الفريق المختار لا ينتمي إلى الجماعة المحددة' }, { status: 400 })
      }
    }

    const agent = await db.agent.create({
      data: {
        nom,
        prenom: prenom || '',
        telephone: telephone || '',
        commune: enforcedCommune,
        fonction: fonction || 'عون صحية',
        actif: actif !== undefined ? actif : true,
        teamId: teamId || null,
      },
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('POST agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة العون' }, { status: 500 })
  }
}
