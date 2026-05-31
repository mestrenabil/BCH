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
      type, date, quartier, adresse, commune, latitude, longitude,
      statut, description, agentNom, produitUtilise, quantite,
      superficie, nombrePrestations, observations,
    } = body

    // Validate required fields
    if (!type || !date || !quartier || !agentNom || !statut) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    // Generate unique reference with retry logic
    const year = new Date(date).getFullYear()
    const prefix = type === 'DERATISATION' ? 'DR' : type === 'DESINSECTISATION' ? 'DI' : 'DF'
    
    let reference = ''
    let created = false
    let attempts = 0
    
    while (!created && attempts < 5) {
      attempts++
      const count = await db.intervention.count({ where: { type } })
      const seq = String(count + attempts).padStart(4, '0')
      reference = `${prefix}-${year}-${seq}`
      
      // Check if this reference already exists
      const existing = await db.intervention.findUnique({ where: { reference } })
      if (!existing) {
        created = true
      }
    }
    
    if (!created) {
      // Fallback: use timestamp-based reference
      const timestamp = Date.now().toString(36).toUpperCase()
      reference = `${prefix}-${year}-${timestamp}`
    }

    const intervention = await db.intervention.create({
      data: {
        type,
        date: new Date(date),
        quartier,
        adresse: adresse || '',
        commune: commune || '',
        latitude: parseFloat(latitude) || 0,
        longitude: parseFloat(longitude) || 0,
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
