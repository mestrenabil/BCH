import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categorie = searchParams.get('categorie')
    const search = searchParams.get('search')
    const alerteOnly = searchParams.get('alerte') === 'true'

    const where: Record<string, unknown> = {}
    if (categorie) where.categorie = categorie
    if (search) {
      where.OR = [
        { nom: { contains: search } },
        { reference: { contains: search } },
        { fournisseur: { contains: search } },
        { description: { contains: search } },
      ]
    }
    if (alerteOnly) {
      // Products where stock is at or below alert threshold
      where.quantiteStock = { lte: 10 } // Will be refined with raw query
    }

    const products = await db.product.findMany({
      where,
      orderBy: { nom: 'asc' },
    })

    // Compute inventory stats
    const allProducts = await db.product.findMany()
    const totalProducts = allProducts.length
    const totalStockValue = allProducts.reduce((sum, p) => sum + (p.quantiteStock * p.prixUnitaire), 0)
    const lowStockCount = allProducts.filter(p => p.quantiteStock <= p.seuilAlerte).length
    const outOfStockCount = allProducts.filter(p => p.quantiteStock === 0).length

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
    const { nom, categorie, unite, quantiteStock, seuilAlerte, prixUnitaire, fournisseur, description } = body

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
      const timestamp = Date.now().toString(36).toUpperCase()
      return NextResponse.json({ error: 'مرجع المنتج موجود مسبقاً' }, { status: 409 })
    }

    const product = await db.product.create({
      data: {
        nom,
        categorie,
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
