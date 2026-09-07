import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const riskCategory = searchParams.get('riskCategory')
    const activity = searchParams.get('activity')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (riskCategory) where.riskCategory = riskCategory
    if (activity) where.activity = { contains: activity }
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { name: { contains: search } },
        { ownerName: { contains: search } },
        { quartier: { contains: search } },
        { authorizationNumber: { contains: search } },
      ]
    }

    const establishments = await db.establishment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        _count: { select: { inspections: true, healthCards: true, samples: true } },
      },
    })

    const total = await db.establishment.count({ where })

    return NextResponse.json({ establishments, total })
  } catch (error) {
    console.error('GET establishments error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المنشآت' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { name, activity, category, ownerName, ownerCin, telephone, commune, quartier, adresse, latitude, longitude, authorizationNumber, authorizationDate, openingDate, description } = body

    if (!name) {
      return NextResponse.json({ error: 'يرجى تقديم اسم المنشأة' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    }

    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `EST-${year}-${random}`
      const exists = await db.establishment.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) reference = `EST-${year}-${Date.now().toString(36).toUpperCase()}`

    const establishment = await db.establishment.create({
      data: {
        reference,
        name,
        activity: activity || '',
        category: category || '',
        ownerName: ownerName || '',
        ownerCin: ownerCin || '',
        telephone: telephone || '',
        commune: enforcedCommune,
        quartier: quartier || '',
        adresse: adresse || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        authorizationNumber: authorizationNumber || '',
        authorizationDate: authorizationDate ? new Date(authorizationDate) : null,
        openingDate: openingDate ? new Date(openingDate) : null,
        description: description || '',
      },
    })

    await recordActivity({
      user, action: 'CREATE', entityType: 'ESTABLISHMENT', entityId: establishment.id,
      commune: enforcedCommune, details: { reference: establishment.reference, name },
    })

    return NextResponse.json(establishment, { status: 201 })
  } catch (error) {
    console.error('POST establishments error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء المنشأة' }, { status: 500 })
  }
}
