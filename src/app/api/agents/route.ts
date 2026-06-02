import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commune = searchParams.get('commune')
    const actif = searchParams.get('actif')

    const where: Record<string, unknown> = {}
    if (commune) where.commune = commune
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
    const body = await request.json()
    const { nom, prenom, telephone, commune, fonction, actif } = body

    if (!nom) {
      return NextResponse.json({ error: 'يرجى إدخال اسم العون' }, { status: 400 })
    }

    const agent = await db.agent.create({
      data: {
        nom,
        prenom: prenom || '',
        telephone: telephone || '',
        commune: commune || '',
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
