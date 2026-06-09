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
    const type = searchParams.get('type')
    const statut = searchParams.get('statut')
    const quartier = searchParams.get('quartier')
    const requestedCommune = searchParams.get('commune')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

    const where: Record<string, unknown> = {}

    if (type) where.type = type
    if (statut) where.statut = statut
    if (quartier) where.quartier = quartier
    if (communeFilter) where.commune = communeFilter
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
        include: {
          materials: {
            include: {
              product: { select: { id: true, nom: true, unite: true, quantiteStock: true } }
            }
          },
          documents: {
            include: {
              document: {
                select: {
                  id: true,
                  titre: true,
                  nomFichier: true,
                  typeFichier: true,
                  tailleFichier: true,
                  cheminFichier: true,
                  categorie: true,
                  commune: true,
                }
              }
            }
          },
          photos: {
            select: {
              id: true,
              interventionId: true,
              url: true,
              caption: true,
              type: true,
              createdAt: true,
            }
          }
        }
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
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      type, date, quartier, adresse, commune, latitude, longitude,
      statut, description, agentNom, produitUtilise, quantite,
      superficie, nombrePrestations, observations,
      coutMainOeuvre, coutMateriaux, coutTotal,
      materials, // Array of { productId, quantity }
    } = body

    // Validate required fields
    if (!type || !date || !quartier || !agentNom || !statut) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    // Enforce commune: non-admin users can only create interventions for their own commune
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : (commune || '')

    // Validate materials stock availability
    if (materials && Array.isArray(materials) && materials.length > 0) {
      for (const mat of materials) {
        if (!mat.productId || !mat.quantity || mat.quantity <= 0) continue
        const product = await db.product.findUnique({ where: { id: mat.productId } })
        if (!product) {
          return NextResponse.json({ error: `المنتج غير موجود` }, { status: 400 })
        }
        if (product.quantiteStock < mat.quantity) {
          return NextResponse.json({ 
            error: `الكمية المطلوبة (${mat.quantity} ${product.unite}) من "${product.nom}" تتجاوز المخزون المتوفر (${product.quantiteStock} ${product.unite})` 
          }, { status: 400 })
        }
      }
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

    // Build materials create data
    const materialsCreate = (materials && Array.isArray(materials) && materials.length > 0)
      ? materials
          .filter((m: { productId: string; quantity: number }) => m.productId && m.quantity > 0)
          .map((m: { productId: string; quantity: number }) => ({
            productId: m.productId,
            quantity: m.quantity,
          }))
      : []

    const intervention = await db.intervention.create({
      data: {
        type,
        date: new Date(date),
        quartier,
        adresse: adresse || '',
        commune: enforcedCommune,
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
        coutMainOeuvre: coutMainOeuvre ? parseFloat(coutMainOeuvre) : null,
        coutMateriaux: coutMateriaux ? parseFloat(coutMateriaux) : null,
        coutTotal: coutTotal ? parseFloat(coutTotal) : null,
        reference,
        materials: {
          create: materialsCreate,
        },
      },
      include: {
        materials: {
          include: {
            product: { select: { id: true, nom: true, unite: true, quantiteStock: true } }
          }
        }
      }
    })

    // Deduct stock quantities for each material used
    for (const mat of materialsCreate) {
      await db.product.update({
        where: { id: mat.productId },
        data: { quantiteStock: { decrement: mat.quantity } }
      })
    }

    return NextResponse.json(intervention, { status: 201 })
  } catch (error) {
    console.error('POST intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة التدخل' }, { status: 500 })
  }
}
