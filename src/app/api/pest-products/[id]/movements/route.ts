import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_MOVEMENT_TYPES = new Set(['ENTREE', 'SORTIE', 'AJUSTEMENT', 'PEREMPTION'])

// GET: قائمة حركات مخزون منتج
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { id } = await params
    const movements = await db.pestStockMovement.findMany({
      where: { productId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ movements })
  } catch (error) {
    console.error('GET movements error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: إضافة حركة مخزون + تحديث الكمية ذرّياً
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const body = await request.json()
    const { type, quantity, reason, interventionRef } = body

    if (!ALLOWED_MOVEMENT_TYPES.has(type)) {
      return NextResponse.json({ error: 'نوع حركة غير صالح' }, { status: 400 })
    }
    const qty = parseInt(quantity)
    if (isNaN(qty) || qty === 0) {
      return NextResponse.json({ error: 'الكمية يجب أن تكون رقماً غير صفري' }, { status: 400 })
    }

    const product = await db.pestProduct.findUnique({ where: { id }, select: { id: true, reference: true, commercialName: true, quantityStock: true, commune: true } })
    if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })

    // احسب الكمية النهائية
    let delta = qty
    if (type === 'SORTIE' || type === 'PEREMPTION') delta = -Math.abs(qty)
    else delta = Math.abs(qty)
    const newQuantity = Math.max(0, product.quantityStock + delta)

    // أنشئ الحركة + حدّث الكمية في معاملة
    const [movement] = await db.$transaction([
      db.pestStockMovement.create({
        data: {
          productId: id, type, quantity: delta, reason: reason || '',
          interventionRef: interventionRef || '', commune: product.commune, userName: user.nom,
        },
      }),
      db.pestProduct.update({ where: { id }, data: { quantityStock: newQuantity } }),
    ])

    await recordActivity({
      user, action: type === 'ENTREE' ? 'IMPORT' : type === 'SORTIE' ? 'EXPORT' : 'UPDATE',
      entityType: 'PEST_PRODUCT', entityId: id, commune: product.commune,
      details: { reference: product.reference, movementType: type, delta, newQuantity, reason },
    })

    return NextResponse.json({ movement, newQuantity }, { status: 201 })
  } catch (error) {
    console.error('POST movement error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
