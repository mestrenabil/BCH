import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const intervention = await db.intervention.findUnique({
      where: { id },
      include: {
        materials: {
          include: {
            product: { select: { id: true, nom: true, unite: true, quantiteStock: true } }
          }
        }
      }
    })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    return NextResponse.json(intervention)
  } catch (error) {
    console.error('GET intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البيانات' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { materials, ...restBody } = body

    // Get existing intervention with materials
    const existing = await db.intervention.findUnique({
      where: { id },
      include: { materials: true }
    })

    if (!existing) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }

    // Restore stock for existing materials before updating
    for (const existingMat of existing.materials) {
      await db.product.update({
        where: { id: existingMat.productId },
        data: { quantiteStock: { increment: existingMat.quantity } }
      })
    }

    // Validate new materials stock availability
    if (materials && Array.isArray(materials) && materials.length > 0) {
      for (const mat of materials) {
        if (!mat.productId || !mat.quantity || mat.quantity <= 0) continue
        const product = await db.product.findUnique({ where: { id: mat.productId } })
        if (!product) {
          // Re-deduct the old materials since we restored them
          for (const existingMat of existing.materials) {
            await db.product.update({
              where: { id: existingMat.productId },
              data: { quantiteStock: { decrement: existingMat.quantity } }
            })
          }
          return NextResponse.json({ error: `المنتج غير موجود` }, { status: 400 })
        }
        // After restoring old stock, check if new quantity is available
        const currentStock = product.quantiteStock + (existing.materials.find(m => m.productId === mat.productId)?.quantity || 0)
        if (currentStock < mat.quantity) {
          // Re-deduct the old materials since we restored them
          for (const existingMat of existing.materials) {
            await db.product.update({
              where: { id: existingMat.productId },
              data: { quantiteStock: { decrement: existingMat.quantity } }
            })
          }
          return NextResponse.json({
            error: `الكمية المطلوبة (${mat.quantity} ${product.unite}) من "${product.nom}" تتجاوز المخزون المتوفر (${currentStock} ${product.unite})`
          }, { status: 400 })
        }
      }
    }

    // Delete existing materials
    await db.interventionMaterial.deleteMany({ where: { interventionId: id } })

    // Update intervention
    const updateData: Record<string, unknown> = {
      ...restBody,
      date: restBody.date ? new Date(restBody.date as string) : undefined,
      latitude: restBody.latitude ? parseFloat(restBody.latitude as string) : undefined,
      longitude: restBody.longitude ? parseFloat(restBody.longitude as string) : undefined,
      nombrePrestations: restBody.nombrePrestations ? parseInt(restBody.nombrePrestations as string) : undefined,
    }

    // Build new materials
    const newMaterials = (materials && Array.isArray(materials) && materials.length > 0)
      ? materials.filter((m: { productId: string; quantity: number }) => m.productId && m.quantity > 0)
      : []

    const intervention = await db.intervention.update({
      where: { id },
      data: {
        ...updateData,
        materials: {
          create: newMaterials.map((m: { productId: string; quantity: number }) => ({
            productId: m.productId,
            quantity: m.quantity,
          }))
        }
      },
      include: {
        materials: {
          include: {
            product: { select: { id: true, nom: true, unite: true, quantiteStock: true } }
          }
        }
      }
    })

    // Deduct stock for new materials
    for (const mat of newMaterials) {
      await db.product.update({
        where: { id: mat.productId },
        data: { quantiteStock: { decrement: mat.quantity } }
      })
    }

    return NextResponse.json(intervention)
  } catch (error) {
    console.error('PUT intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث التدخل' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Get existing materials to restore stock
    const existing = await db.intervention.findUnique({
      where: { id },
      include: { materials: true }
    })

    if (existing) {
      // Restore stock for all materials
      for (const mat of existing.materials) {
        await db.product.update({
          where: { id: mat.productId },
          data: { quantiteStock: { increment: mat.quantity } }
        })
      }
    }

    // Delete materials first (cascade should handle this, but be explicit)
    await db.interventionMaterial.deleteMany({ where: { interventionId: id } })
    await db.intervention.delete({ where: { id } })
    return NextResponse.json({ message: 'تم حذف التدخل بنجاح' })
  } catch (error) {
    console.error('DELETE intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف التدخل' }, { status: 500 })
  }
}
