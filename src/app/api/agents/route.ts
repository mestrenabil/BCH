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
    const actif = searchParams.get('actif')

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (actif !== null && actif !== undefined) where.actif = actif === 'true'

    const agents = await db.agent.findMany({
      where,
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
    const { nom, prenom, telephone, commune, fonction, actif } = body

    if (!nom) {
      return NextResponse.json({ error: 'يرجى إدخال اسم العون' }, { status: 400 })
    }

    // Enforce commune: non-admin users can only add agents for their own commune
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : (commune || '')

    const agent = await db.agent.create({
      data: {
        nom,
        prenom: prenom || '',
        telephone: telephone || '',
        commune: enforcedCommune,
        fonction: fonction || 'عون صحية',
        actif: actif !== undefined ? actif : true,
      },
    })

    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    console.error('POST agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة العون' }, { status: 500 })
  }
}
