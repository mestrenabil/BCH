import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, getManagedCommunes, requireAuth } from '@/lib/auth'
import { getTerritoryFilterFromSearchParams, getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

async function getAccessibleTeam(id: string, request: NextRequest) {
  const authResult = await requireAuth()
  if ('error' in authResult) return { error: authResult.error } as const
  const { user } = authResult
  const team = await db.team.findUnique({ where: { id }, include: { agents: { orderBy: { nom: 'asc' } }, _count: { select: { agents: true } } } })
  if (!team) return { error: NextResponse.json({ error: 'الفريق غير موجود' }, { status: 404 }) } as const
  const territorialFilter = getTerritoryFilterFromSearchParams(new URL(request.url).searchParams)
  if (!canAccessCommune(user, team.commune) || (user.commune === 'ALL' && !isCommuneInTerritoryScope(team.commune, territorialFilter))) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا الفريق' }, { status: 403 }) } as const
  }
  return { user, team } as const
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await getAccessibleTeam((await params).id, request)
    if ('error' in result) return result.error
    return NextResponse.json(result.team)
  } catch (error) {
    console.error('GET team error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الفريق' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await getAccessibleTeam((await params).id, request)
    if ('error' in result) return result.error
    const { user, team } = result
    const body = await request.json()
    const requestedCommune = typeof body.commune === 'string' ? body.commune.trim() : team.commune
    const managedCommunes = getManagedCommunes(user)
    const enforcedCommune = user.commune !== 'ALL'
      ? (managedCommunes.length === 1 ? managedCommunes[0] : team.commune)
      : requestedCommune
    const territorialFilter = getTerritoryFilterFromValue(body.territoryFilter)

    if (!enforcedCommune || !canAccessCommune(user, enforcedCommune) || (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, territorialFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي الحالي' }, { status: 403 })
    }
    if (enforcedCommune !== team.commune && team.agents.length > 0) {
      return NextResponse.json({ error: 'لا يمكن تغيير جماعة فريق يحتوي على أعوان' }, { status: 409 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : team.name
    const mission = typeof body.mission === 'string' ? body.mission.trim() : team.mission
    if (!name) return NextResponse.json({ error: 'يرجى إدخال اسم الفريق' }, { status: 400 })
    if (!mission) return NextResponse.json({ error: 'يرجى تحديد مهمة الفريق' }, { status: 400 })

    const updated = await db.team.update({
      where: { id: team.id },
      data: {
        name,
        commune: enforcedCommune,
        ...(typeof body.office === 'string' && { office: body.office.trim() }),
        mission,
        ...(typeof body.description === 'string' && { description: body.description.trim() }),
        ...(typeof body.color === 'string' && body.color.trim() && { color: body.color.trim() }),
        ...(typeof body.actif === 'boolean' && { actif: body.actif }),
      },
      include: { agents: { orderBy: { nom: 'asc' } }, _count: { select: { agents: true } } },
    })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT team error:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'يوجد فريق بنفس الاسم في هذه الجماعة' }, { status: 409 })
    }
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الفريق' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const result = await getAccessibleTeam((await params).id, request)
    if ('error' in result) return result.error
    await db.team.delete({ where: { id: result.team.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE team error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الفريق' }, { status: 500 })
  }
}
