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
    const categorie = searchParams.get('categorie')
    const requestedCommune = searchParams.get('commune')
    const search = searchParams.get('search')
    const alerteOnly = searchParams.get('alerte') === 'true'

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

    // Build where clause with proper AND/OR combinations
    const andConditions: Record<string, unknown>[] = []

    if (categorie) andConditions.push({ categorie })
    if (communeFilter) {
      // Show products for user's commune OR shared products (empty commune / ALL)
      andConditions.push({
        OR: [
          { commune: communeFilter },
          { commune: '' },
          { commune: 'ALL' },
        ]
      })
    }
    if (search) {
      andConditions.push({
        OR: [
          { nom: { contains: search } },
          { reference: { contains: search } },
          { fournisseur: { contains: search } },
          { description: { contains: search } },
        ]
      })
    }

    const where: Record<string, unknown> = andConditions.length > 0 ? { AND: andConditions } : {}

    const products = await db.product.findMany({
      where,
      orderBy: { nom: 'asc' },
    })

    // Compute inventory stats (also respect commune filter for stats)
    const statsWhere: Record<string, unknown> = {}
    if (communeFilter) {
      statsWhere.OR = [
        { commune: communeFilter },
        { commune: '' },
        { commune: 'ALL' },
      ]
    }
    const statsProducts = await db.product.findMany({ where: statsWhere })
    const totalProducts = statsProducts.length
    const totalStockValue = statsProducts.reduce((sum, p) => sum + (p.quantiteStock * p.prixUnitaire), 0)
    const lowStockCount = statsProducts.filter(p => p.quantiteStock <= p.seuilAlerte && p.quantiteStock > 0).length
    const outOfStockCount = statsProducts.filter(p => p.quantiteStock === 0).length

    // Filter for alerteOnly after fetching (SQLite doesn't support column comparison in where easily)
    const filteredProducts = alerteOnly
      ? products.filter(p => p.quantiteStock <= p.seuilAlerte)
      : products

    return NextResponse.json({
      products: filteredProducts,
      stats: { totalProducts, totalStockValue, lowStockCount, outOfStockCount },
    })
  } catch (error) {
    console.error('GET products error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المنتجات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { nom, categorie, commune, unite, quantiteStock, seuilAlerte, prixUnitaire, fournisseur, description, dateExpiration } = body

    if (!nom || !categorie) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    // Enforce commune: non-admin users can only add products for their own commune
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : (commune || '')

    // Generate reference
    const prefix = categorie === 'DERATISATION' ? 'PR-DR' : categorie === 'DESINSECTISATION' ? 'PR-DI' : categorie === 'DESINFECTION' ? 'PR-DF' : 'PR-GN'
    const count = await db.product.count({ where: { categorie } })
    const reference = `${prefix}-${String(count + 1).padStart(4, '0')}`

    // Check uniqueness
    const existing = await db.product.findUnique({ where: { reference } })
    if (existing) {
      return NextResponse.json({ error: 'مرجع المنتج موجود مسبقاً' }, { status: 409 })
    }

    const product = await db.product.create({
      data: {
        nom,
        categorie,
        commune: enforcedCommune,
        unite: unite || 'لتر',
        quantiteStock: parseInt(quantiteStock) || 0,
        seuilAlerte: parseInt(seuilAlerte) || 10,
        prixUnitaire: parseFloat(prixUnitaire) || 0,
        fournisseur: fournisseur || '',
        description: description || '',
        reference,
        ...(dateExpiration ? { dateExpiration: new Date(dateExpiration) } : {}),
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST product error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة المنتج' }, { status: 500 })
  }
}
