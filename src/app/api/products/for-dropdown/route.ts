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

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

    const andConditions: Record<string, unknown>[] = []
    if (categorie) andConditions.push({ categorie })
    // Only show products that have stock > 0
    andConditions.push({ quantiteStock: { gt: 0 } })
    if (communeFilter) {
      andConditions.push({
        OR: [
          { commune: communeFilter },
          { commune: '' },
          { commune: 'ALL' },
        ]
      })
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {}

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
