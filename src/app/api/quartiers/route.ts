import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commune = searchParams.get('commune')

    const where: Record<string, unknown> = {}
    if (commune) where.commune = commune

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
    const body = await request.json()
    const { nom, commune, latitude, longitude } = body

    if (!nom) {
      return NextResponse.json({ error: 'يرجى إدخال اسم الحي' }, { status: 400 })
    }

    // Check if quartier with same name exists
    const existing = await db.quartier.findUnique({ where: { nom } })
    if (existing) {
      return NextResponse.json({ error: 'حي بهذا الاسم موجود مسبقاً' }, { status: 409 })
    }

    const quartier = await db.quartier.create({
      data: {
        nom,
        commune: commune || '',
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
