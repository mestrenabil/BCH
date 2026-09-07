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
    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter

    const quartiers = await db.quartier.findMany({
      where,
      orderBy: { nom: 'asc' },
    })

    return NextResponse.json({ quartiers })
  } catch (error) {
    console.error('GET quartiers error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الأحياء' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { nom, commune, latitude, longitude, territoryFilter } = body

    if (!nom) {
      return NextResponse.json({ error: 'يرجى إدخال اسم الحي' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إضافة الحي' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    // Check if quartier with same name exists in the same commune
    const existing = await db.quartier.findFirst({ where: { nom, commune: enforcedCommune } })
    if (existing) {
      return NextResponse.json({ error: 'حي بهذا الاسم موجود مسبقاً في هذه الجماعة' }, { status: 409 })
    }

    const quartier = await db.quartier.create({
      data: {
        nom,
        commune: enforcedCommune,
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
      },
    })

    return NextResponse.json(quartier, { status: 201 })
  } catch (error) {
    console.error('POST quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة الحي' }, { status: 500 })
  }
}
