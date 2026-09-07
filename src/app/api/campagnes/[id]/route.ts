import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

interface RouteParams {
  params: Promise<{ id: string }>
}

/** Recompute the real cost (coutReel) of a campagne from its linked interventions. */
async function recomputeCoutReel(campagneId: string) {
  const result = await db.intervention.aggregate({
    where: { campagneId },
    _sum: { coutTotal: true },
  })
  await db.campagne.update({
    where: { id: campagneId },
    data: { coutReel: result._sum.coutTotal ?? 0 },
  })
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    const campagne = await db.campagne.findUnique({
      where: { id },
      include: {
        interventions: {
          orderBy: { date: 'desc' },
          select: {
            id: true,
            reference: true,
            type: true,
            statut: true,
            date: true,
            quartier: true,
            adresse: true,
            commune: true,
            agentNom: true,
            coutTotal: true,
            superficie: true,
          },
        },
        _count: { select: { interventions: true } },
      },
    })

    if (!campagne) {
      return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    }

    // Enforce commune access
    if (!canAccessCommune(user, campagne.commune)) {
      return NextResponse.json({ error: 'غير مصرح بالوصول' }, { status: 403 })
    }

    return NextResponse.json({ campagne })
  } catch (error) {
    console.error('GET campagne error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الحملة' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    const existing = await db.campagne.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    }

    // Enforce commune access
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'غير مصرح بالتعديل' }, { status: 403 })
    }

    const body = await request.json()
    const {
      nom, type, commune, description, objectif,
      budgetPrevu, dateDebut, dateFin, statut,
      responsable, couleur, territoryFilter,
    } = body

    // Enforce commune for non-admin users
    const enforcedCommune = resolveRecordCommune(user, commune ?? existing.commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد جماعة ضمن نطاق الحساب' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    const updated = await db.campagne.update({
      where: { id },
      data: {
        nom: nom ?? existing.nom,
        type: type ?? existing.type,
        commune: enforcedCommune,
        description: description ?? existing.description,
        objectif: objectif ?? existing.objectif,
        budgetPrevu: budgetPrevu !== undefined ? (budgetPrevu ? parseFloat(budgetPrevu) : null) : existing.budgetPrevu,
        dateDebut: dateDebut ? new Date(dateDebut) : existing.dateDebut,
        dateFin: dateFin !== undefined ? (dateFin ? new Date(dateFin) : null) : existing.dateFin,
        statut: statut ?? existing.statut,
        responsable: responsable ?? existing.responsable,
        couleur: couleur ?? existing.couleur,
      },
      include: {
        _count: { select: { interventions: true } },
      },
    })

    // Keep coutReel in sync
    await recomputeCoutReel(id)

    return NextResponse.json({ campagne: updated })
  } catch (error) {
    console.error('PUT campagne error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الحملة' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    const existing = await db.campagne.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    }

    // Enforce commune access
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'غير مصرح بالحذف' }, { status: 403 })
    }

    // Unlink interventions (SetNull) before deleting the campagne
    await db.intervention.updateMany({
      where: { campagneId: id },
      data: { campagneId: null },
    })

    await db.campagne.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE campagne error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الحملة' }, { status: 500 })
  }
}
