import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categorie = searchParams.get('categorie')
    const commune = searchParams.get('commune')
    const search = searchParams.get('search')
    const alerteOnly = searchParams.get('alerte') === 'true'

    // Build where clause with proper AND/OR combinations
    const andConditions: Record<string, unknown>[] = []

    if (categorie) andConditions.push({ categorie })
    if (commune) {
      // Show products for selected commune OR shared products (empty commune / ALL)
      andConditions.push({
        OR: [
          { commune: commune },
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
    if (commune) {
      statsWhere.OR = [
        { commune: commune },
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
    const body = await request.json()
    const { nom, categorie, commune, unite, quantiteStock, seuilAlerte, prixUnitaire, fournisseur, description } = body

    if (!nom || !categorie) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

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
        commune: commune || '',
        unite: unite || 'لتر',
        quantiteStock: parseInt(quantiteStock) || 0,
        seuilAlerte: parseInt(seuilAlerte) || 10,
        prixUnitaire: parseFloat(prixUnitaire) || 0,
        fournisseur: fournisseur || '',
        description: description || '',
        reference,
      },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST product error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة المنتج' }, { status: 500 })
  }
}
