import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })

    // Non-admin users can only view products from their own commune or shared products
    if (user.commune !== 'ALL' && product.commune !== '' && product.commune !== 'ALL' && product.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا المنتج' }, { status: 403 })
    }

    return NextResponse.json(product)
  } catch (error) {
    console.error('GET product error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check product belongs to user's commune
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    if (user.commune !== 'ALL' && existing.commune !== '' && existing.commune !== 'ALL' && existing.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا المنتج' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, categorie, commune, unite, quantiteStock, seuilAlerte, prixUnitaire, fournisseur, description, dateExpiration } = body

    // Non-admin users cannot change the commune to a different commune
    const enforcedCommune = user.commune !== 'ALL'
      ? user.commune
      : (commune !== undefined ? commune : existing.commune)

    const product = await db.product.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(categorie !== undefined && { categorie }),
        commune: enforcedCommune,
        ...(unite !== undefined && { unite }),
        ...(quantiteStock !== undefined && { quantiteStock: parseInt(quantiteStock) || 0 }),
        ...(seuilAlerte !== undefined && { seuilAlerte: parseInt(seuilAlerte) || 10 }),
        ...(prixUnitaire !== undefined && { prixUnitaire: parseFloat(prixUnitaire) || 0 }),
        ...(fournisseur !== undefined && { fournisseur }),
        ...(description !== undefined && { description }),
        ...(dateExpiration !== undefined && { dateExpiration: dateExpiration ? new Date(dateExpiration) : null }),
      },
    })

    return NextResponse.json(product)
  } catch (error) {
    console.error('PUT product error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث المنتج' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check product belongs to user's commune
    const existing = await db.product.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    if (user.commune !== 'ALL' && existing.commune !== '' && existing.commune !== 'ALL' && existing.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذا المنتج' }, { status: 403 })
    }

    await db.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE product error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المنتج' }, { status: 500 })
  }
}
