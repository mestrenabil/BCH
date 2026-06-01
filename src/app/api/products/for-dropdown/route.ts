import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const categorie = searchParams.get('categorie')

    const where: Record<string, unknown> = {}
    if (categorie) where.categorie = categorie
    // Only show products that have stock > 0
    where.quantiteStock = { gt: 0 }

    const products = await db.product.findMany({
      where,
      orderBy: { nom: 'asc' },
      select: {
        id: true,
        nom: true,
        categorie: true,
        unite: true,
        quantiteStock: true,
        prixUnitaire: true,
        reference: true,
      }
    })

    return NextResponse.json({ products })
  } catch (error) {
    console.error('GET products for dropdown error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
