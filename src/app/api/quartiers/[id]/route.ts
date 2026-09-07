import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, getManagedCommunes, requireAuth } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const quartier = await db.quartier.findUnique({ where: { id } })
    if (!quartier) return NextResponse.json({ error: 'الحي غير موجود' }, { status: 404 })

    // Non-admin users can only view quartiers from their own commune
    if (!canAccessCommune(user, quartier.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا الحي' }, { status: 403 })
    }

    return NextResponse.json(quartier)
  } catch (error) {
    console.error('GET quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check quartier belongs to user's commune
    const existing = await db.quartier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الحي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا الحي' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, commune, latitude, longitude, territoryFilter } = body

    // Non-admin users cannot change the commune
    const managedCommunes = getManagedCommunes(user)
    const enforcedCommune = user.commune !== 'ALL'
      ? (managedCommunes.length === 1 ? managedCommunes[0] : existing.commune)
      : (commune !== undefined ? commune : existing.commune)
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    // If renaming, check uniqueness within the same commune
    if (nom) {
      const nameCheck = await db.quartier.findFirst({ where: { nom, commune: enforcedCommune, id: { not: id } } })
      if (nameCheck) {
        return NextResponse.json({ error: 'حي بهذا الاسم موجود مسبقاً في هذه الجماعة' }, { status: 409 })
      }
    }

    const quartier = await db.quartier.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        commune: enforcedCommune,
        ...(latitude !== undefined && { latitude: parseFloat(latitude) || 0 }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) || 0 }),
      },
    })

    return NextResponse.json(quartier)
  } catch (error) {
    console.error('PUT quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الحي' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check quartier belongs to user's commune
    const existing = await db.quartier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الحي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذا الحي' }, { status: 403 })
    }

    // Check if quartier is used in any intervention
    const interventionsCount = await db.intervention.count({
      where: { quartier: existing.nom },
    })

    await db.quartier.delete({ where: { id } })

    return NextResponse.json({ success: true, interventionsAffected: interventionsCount })
  } catch (error) {
    console.error('DELETE quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الحي' }, { status: 500 })
  }
}
