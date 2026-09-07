import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, getManagedCommunes, requireAuth } from '@/lib/auth'
import { getTerritoryFilterFromSearchParams, getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { isCoordinateInCommune } from '@/lib/commune-boundaries'

const GIS_LAYER_KEYS = new Set([
  'interventions', 'deratisation', 'desinsectisation', 'desinfection', 'complaints', 'establishments', 'waterPoints', 'pollution', 'waste',
  'sites', 'animals', 'sanitation', 'biteCases', 'foodReports', 'workOrders', 'dossiers',
])

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const territorialFilter = getTerritoryFilterFromSearchParams(new URL(request.url).searchParams)
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
    if (!canAccessCommune(user, intervention.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا التدخل' }, { status: 403 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(intervention.commune, territorialFilter)) {
      return NextResponse.json({ error: 'التدخل خارج النطاق الترابي الحالي' }, { status: 403 })
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
    if (!canAccessCommune(user, existingCheck.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا التدخل' }, { status: 403 })
    }

    const body = await request.json()
    const territorialFilter = getTerritoryFilterFromValue(body.territoryFilter)
    if (user.commune === 'ALL' && (!isCommuneInTerritoryScope(existingCheck.commune, territorialFilter) || !isCommuneInTerritoryScope(body.commune || existingCheck.commune, territorialFilter))) {
      return NextResponse.json({ error: 'التدخل أو الجماعة المختارة خارج النطاق الترابي الحالي' }, { status: 403 })
    }
    if (user.commune !== 'ALL') {
      const latitude = body.latitude === undefined ? existingCheck.latitude : Number(body.latitude)
      const longitude = body.longitude === undefined ? existingCheck.longitude : Number(body.longitude)
      const targetCommune = getManagedCommunes(user).length === 1 ? getManagedCommunes(user)[0] : existingCheck.commune
      const isWithinCommune = await isCoordinateInCommune(targetCommune, latitude, longitude)
      if (isWithinCommune === false) {
        return NextResponse.json({ error: 'إحداثيات التدخل خارج حدود جماعتك' }, { status: 403 })
      }
    }
    const { materials, territoryFilter: _territoryFilter, ...restBody } = body

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
    const managedCommunes = getManagedCommunes(user)
    const enforcedCommune = user.commune !== 'ALL' && managedCommunes.length === 1 ? managedCommunes[0] : (user.commune !== 'ALL' ? existingCheck.commune : undefined)

    // Update intervention
    const updateData: Record<string, unknown> = {
      ...restBody,
      ...(restBody.gisLayer !== undefined && {
        gisLayer: typeof restBody.gisLayer === 'string' && GIS_LAYER_KEYS.has(restBody.gisLayer) ? restBody.gisLayer : 'interventions',
      }),
      ...(enforcedCommune && { commune: enforcedCommune }),
      date: restBody.date ? new Date(restBody.date as string) : undefined,
      latitude: restBody.latitude ? parseFloat(restBody.latitude as string) : undefined,
      longitude: restBody.longitude ? parseFloat(restBody.longitude as string) : undefined,
      nombrePrestations: restBody.nombrePrestations ? parseInt(restBody.nombrePrestations as string) : undefined,
      coutMainOeuvre: restBody.coutMainOeuvre !== undefined ? (restBody.coutMainOeuvre ? parseFloat(restBody.coutMainOeuvre as string) : null) : undefined,
      coutMateriaux: restBody.coutMateriaux !== undefined ? (restBody.coutMateriaux ? parseFloat(restBody.coutMateriaux as string) : null) : undefined,
      coutTotal: restBody.coutTotal !== undefined ? (restBody.coutTotal ? parseFloat(restBody.coutTotal as string) : null) : undefined,
      // Normalize campagneId: empty string → null (unlink)
      ...(restBody.campagneId !== undefined && { campagneId: restBody.campagneId || null }),
    }
    // Avoid passing undefined commune override as a literal undefined for prisma
    if (restBody.campagneId === undefined) delete updateData.campagneId

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

    // Recompute coutReel for affected campagnes (old + new)
    const affectedCampagnes = new Set<string>()
    if (existing.campagneId) affectedCampagnes.add(existing.campagneId)
    if (restBody.campagneId) affectedCampagnes.add(String(restBody.campagneId))
    for (const campId of affectedCampagnes) {
      const agg = await db.intervention.aggregate({ where: { campagneId: campId }, _sum: { coutTotal: true } })
      await db.campagne.update({ where: { id: campId }, data: { coutReel: agg._sum.coutTotal ?? 0 } })
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
    const territorialFilter = getTerritoryFilterFromSearchParams(new URL(request.url).searchParams)

    // Get existing and check commune permission
    const existingCheck = await db.intervention.findUnique({ where: { id } })
    if (!existingCheck) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, existingCheck.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذا التدخل' }, { status: 403 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(existingCheck.commune, territorialFilter)) {
      return NextResponse.json({ error: 'التدخل خارج النطاق الترابي الحالي' }, { status: 403 })
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
