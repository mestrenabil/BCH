import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCommuneFilter } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    const requestedCommune = searchParams.get('commune')

    const communeFilter = getCommuneFilter(user, requestedCommune)

    const where: Record<string, unknown> = {}
    if (productId) where.productId = productId
    if (communeFilter) where.commune = communeFilter

    const movements = await db.stockMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    return NextResponse.json({ movements })
  } catch (error) {
    console.error('GET stock-movements error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل حركات المخزون' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { productId, type, quantity, reason, note } = body

    if (!productId || !type || !quantity) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    if (type !== 'IN' && type !== 'OUT') {
      return NextResponse.json({ error: 'نوع الحركة غير صالح' }, { status: 400 })
    }

    // Check product exists and belongs to user's commune
    const product = await db.product.findUnique({ where: { id: productId } })
    if (!product) {
      return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    }
    if (user.commune !== 'ALL' && product.commune !== '' && product.commune !== 'ALL' && product.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية التعديل على هذا المنتج' }, { status: 403 })
    }

    const enforcedCommune = user.commune !== 'ALL' ? user.commune : (product.commune || '')

    const movement = await db.stockMovement.create({
      data: {
        productId,
        type,
        quantity: parseInt(String(quantity)) || 0,
        reason: reason || null,
        note: note || null,
        commune: enforcedCommune,
      },
    })

    return NextResponse.json(movement, { status: 201 })
  } catch (error) {
    console.error('POST stock-movement error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الحركة' }, { status: 500 })
  }
}
