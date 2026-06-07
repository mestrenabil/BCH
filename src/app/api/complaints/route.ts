import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCommuneFilter } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const requestedCommune = searchParams.get('commune')
    const statut = searchParams.get('statut')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const communeFilter = getCommuneFilter(user, requestedCommune)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (statut) where.statut = statut
    if (type) where.type = type
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { nomCitoyen: { contains: search } },
        { telephone: { contains: search } },
        { adresse: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const complaints = await db.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const total = await db.complaint.count({ where })

    return NextResponse.json({ complaints, total })
  } catch (error) {
    console.error('GET complaints error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الشكايات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { nomCitoyen, telephone, adresse, quartier, commune, type, description, priorite, observations } = body

    if (!nomCitoyen || !adresse || !commune || !type || !description) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    // Enforce commune for non-admin users
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : commune

    // Generate reference: PL-YYYY-NNN
    const year = new Date().getFullYear()
    const count = await db.complaint.count({
      where: { reference: { startsWith: `PL-${year}-` } },
    })
    const reference = `PL-${year}-${String(count + 1).padStart(3, '0')}`

    const complaint = await db.complaint.create({
      data: {
        reference,
        nomCitoyen,
        telephone: telephone || null,
        adresse,
        quartier: quartier || null,
        commune: enforcedCommune,
        type,
        description,
        priorite: priorite || 'NORMALE',
        observations: observations || null,
      },
    })

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('POST complaints error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الشكاية' }, { status: 500 })
  }
}
