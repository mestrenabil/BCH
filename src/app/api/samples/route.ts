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
    const conformity = searchParams.get('conformity')
    const establishmentId = searchParams.get('establishmentId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (conformity) where.conformity = conformity
    if (establishmentId) where.establishmentId = establishmentId

    const samples = await db.sample.findMany({
      where,
      orderBy: { sampleDate: 'desc' },
      take: limit,
      include: {
        establishment: { select: { id: true, reference: true, name: true } },
      },
    })

    const total = await db.sample.count({ where })

    return NextResponse.json({ samples, total })
  } catch (error) {
    console.error('GET samples error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { establishmentId, commune, product, sampleDate, reason, temperature, collectorName, laboratory, requestedTests, notes } = body

    if (!product) {
      return NextResponse.json({ error: 'يرجى تحديد المنتج المفحوص' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    }

    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `ECH-${year}-${random}`
      const exists = await db.sample.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) reference = `ECH-${year}-${Date.now().toString(36).toUpperCase()}`

    const sample = await db.sample.create({
      data: {
        reference,
        establishmentId: establishmentId || null,
        commune: enforcedCommune,
        product,
        sampleDate: sampleDate ? new Date(sampleDate) : new Date(),
        reason: reason || '',
        temperature: temperature ?? null,
        collectorName: collectorName || user.nom,
        laboratory: laboratory || '',
        requestedTests: requestedTests || '',
        notes: notes || '',
      },
    })

    await recordActivity({
      user, action: 'CREATE', entityType: 'SAMPLE', entityId: sample.id,
      commune: enforcedCommune, details: { reference: sample.reference, product },
    })

    return NextResponse.json(sample, { status: 201 })
  } catch (error) {
    console.error('POST samples error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء العينة' }, { status: 500 })
  }
}
