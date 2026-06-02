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
    const requestedCommune = searchParams.get('commune')

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

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
    const { nom, commune, latitude, longitude } = body

    if (!nom) {
      return NextResponse.json({ error: 'يرجى إدخال اسم الحي' }, { status: 400 })
    }

    // Enforce commune: non-admin users can only add quartiers for their own commune
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : (commune || '')

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
