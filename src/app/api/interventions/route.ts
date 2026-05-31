import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const statut = searchParams.get('statut')
    const quartier = searchParams.get('quartier')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}

    if (type) where.type = type
    if (statut) where.statut = statut
    if (quartier) where.quartier = quartier
    if (from || to) {
      where.date = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      }
    }
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { agentNom: { contains: search } },
        { quartier: { contains: search } },
        { adresse: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [interventions, total] = await Promise.all([
      db.intervention.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.intervention.count({ where }),
    ])

    return NextResponse.json({
      interventions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    console.error('GET interventions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البيانات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      type, date, quartier, adresse, latitude, longitude,
      statut, description, agentNom, produitUtilise, quantite,
      superficie, nombrePrestations, observations,
    } = body

    // Generate reference
    const year = new Date(date).getFullYear()
    const prefix = type === 'DERATISATION' ? 'DR' : type === 'DESINSECTISATION' ? 'DI' : 'DF'
    const count = await db.intervention.count({ where: { type } })
    const reference = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`

    const intervention = await db.intervention.create({
      data: {
        type,
        date: new Date(date),
        quartier,
        adresse,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        statut,
        description: description || '',
        agentNom,
        produitUtilise: produitUtilise || '',
        quantite: quantite || '',
        superficie: superficie || '',
        nombrePrestations: parseInt(nombrePrestations) || 1,
        observations: observations || '',
        reference,
      },
    })

    return NextResponse.json(intervention, { status: 201 })
  } catch (error) {
    console.error('POST intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة التدخل' }, { status: 500 })
  }
}
