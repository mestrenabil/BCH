import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const intervention = await db.intervention.findUnique({
      where: { id },
      include: {
        materials: {
          include: {
            product: { select: { id: true, nom: true, unite: true, quantiteStock: true } }
          }
        },
        documents: {
          include: {
            document: {
              select: {
                id: true,
                titre: true,
                nomFichier: true,
                typeFichier: true,
                tailleFichier: true,
                cheminFichier: true,
                categorie: true,
                commune: true,
              }
            }
          }
        }
      }
    })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }

    // Non-admin users can only view interventions from their own commune
    if (user.commune !== 'ALL' && intervention.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا التدخل' }, { status: 403 })
    }

    return NextResponse.json(intervention)
  } catch (error) {
    console.error('GET intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البيانات' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Get existing intervention and check commune permission
    const existingCheck = await db.intervention.findUnique({ where: { id } })
    if (!existingCheck) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    if (user.commune !== 'ALL' && existingCheck.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا التدخل' }, { status: 403 })
    }

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
          for (const existingMat of existing.materials) {
            await db.product.update({
              where: { id: existingMat.productId },
              data: { quantiteStock: { decrement: existingMat.quantity } }
            })
          }
          return NextResponse.json({ error: `المنتج غير موجود` }, { status: 400 })
        }
        const currentStock = product.quantiteStock + (existing.materials.find(m => m.productId === mat.productId)?.quantity || 0)
        if (currentStock < mat.quantity) {
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

    // Enforce commune: non-admin users cannot change the commune
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : undefined

    // Update intervention
    const updateData: Record<string, unknown> = {
      ...restBody,
      ...(enforcedCommune && { commune: enforcedCommune }),
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
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Get existing and check commune permission
    const existingCheck = await db.intervention.findUnique({ where: { id } })
    if (!existingCheck) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    if (user.commune !== 'ALL' && existingCheck.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذا التدخل' }, { status: 403 })
    }

    // Get existing materials to restore stock
    const existing = await db.intervention.findUnique({
      where: { id },
      include: { materials: true }
    })

    if (existing) {
      for (const mat of existing.materials) {
        await db.product.update({
          where: { id: mat.productId },
          data: { quantiteStock: { increment: mat.quantity } }
        })
      }
    }

    await db.interventionMaterial.deleteMany({ where: { interventionId: id } })
    await db.intervention.delete({ where: { id } })
    return NextResponse.json({ message: 'تم حذف التدخل بنجاح' })
  } catch (error) {
    console.error('DELETE intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف التدخل' }, { status: 500 })
  }
}
