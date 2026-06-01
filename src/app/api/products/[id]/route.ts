import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const product = await db.product.findUnique({ where: { id } })
    if (!product) return NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 })
    return NextResponse.json(product)
  } catch (error) {
    console.error('GET product error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nom, categorie, commune, unite, quantiteStock, seuilAlerte, prixUnitaire, fournisseur, description } = body

    const product = await db.product.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(categorie !== undefined && { categorie }),
        ...(commune !== undefined && { commune }),
        ...(unite !== undefined && { unite }),
        ...(quantiteStock !== undefined && { quantiteStock: parseInt(quantiteStock) || 0 }),
        ...(seuilAlerte !== undefined && { seuilAlerte: parseInt(seuilAlerte) || 10 }),
        ...(prixUnitaire !== undefined && { prixUnitaire: parseFloat(prixUnitaire) || 0 }),
        ...(fournisseur !== undefined && { fournisseur }),
        ...(description !== undefined && { description }),
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
    const { id } = await params
    await db.product.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE product error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المنتج' }, { status: 500 })
  }
}
