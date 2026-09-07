import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

const DEFAULT_COLOR = '#10b981'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter

    const teams = await db.team.findMany({
      where,
      include: {
        agents: {
          select: { id: true, nom: true, prenom: true, telephone: true, commune: true, fonction: true, actif: true },
          orderBy: { nom: 'asc' },
        },
        _count: { select: { agents: true } },
      },
      orderBy: [{ commune: 'asc' }, { office: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json({ teams })
  } catch (error) {
    console.error('GET teams error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الفرق' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const office = typeof body.office === 'string' ? body.office.trim() : 'OFFICE_04'
    const mission = typeof body.mission === 'string' ? body.mission.trim() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    const color = typeof body.color === 'string' && body.color.trim() ? body.color.trim() : DEFAULT_COLOR
    const enforcedCommune = resolveRecordCommune(user, body.commune)

    if (!name) return NextResponse.json({ error: 'يرجى إدخال اسم الفريق' }, { status: 400 })
    if (!mission) return NextResponse.json({ error: 'يرجى تحديد مهمة الفريق' }, { status: 400 })
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إضافة الفريق' }, { status: 400 })
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(body.territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي الحالي' }, { status: 403 })
    }

    const team = await db.team.create({
      data: { name, commune: enforcedCommune, office, mission, description, color, actif: body.actif !== false },
      include: { agents: true, _count: { select: { agents: true } } },
    })
    return NextResponse.json(team, { status: 201 })
  } catch (error) {
    console.error('POST team error:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'يوجد فريق بنفس الاسم في هذه الجماعة' }, { status: 409 })
    }
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة الفريق' }, { status: 500 })
  }
}
