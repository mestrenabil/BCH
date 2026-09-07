import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { syncStrayReportDossier } from '@/lib/vigilance-links'

const ALLOWED_STATUS = new Set([
  'NOUVEAU', 'VERIFICATION', 'VALIDE', 'MISSION_PLANIFIEE', 'EN_COURS',
  'TRAITE', 'PARTIEL', 'NON_LOCALISE', 'DOUBLON', 'CLASSE',
])
const ALLOWED_PRIORITY = new Set(['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'])
const ALLOWED_SPECIES = new Set(['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const report = await db.strayReport.findUnique({
      where: { id },
      include: {
        photos: { orderBy: { createdAt: 'desc' } },
        mission: { select: { id: true, reference: true, statut: true } },
      },
    })

    if (!report) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, report.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية للوصول إلى هذا البلاغ' }, { status: 403 })
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('GET csvr/reports/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البلاغ' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const existing = await db.strayReport.findUnique({ where: { id }, select: { commune: true, statut: true } })
    if (!existing) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذا البلاغ' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    const fields = [
      'source', 'declarantName', 'declarantPhone', 'declarantRole',
      'quartier', 'secteur', 'adresse', 'description', 'observations',
      'estimatedCount', 'hasYoung', 'isAggressive', 'isInjured', 'isSick',
      'rabiesSuspect', 'biteReported', 'nearSchool', 'nearMarket', 'nearHealth', 'nearDump',
      'missionId',
    ]
    for (const f of fields) {
      if (f in body) data[f] = body[f]
    }
    if ('latitude' in body) data.latitude = body.latitude
    if ('longitude' in body) data.longitude = body.longitude
    if (body.statut && ALLOWED_STATUS.has(body.statut)) data.statut = body.statut
    if (body.priority && ALLOWED_PRIORITY.has(body.priority)) data.priority = body.priority
    if (body.species && ALLOWED_SPECIES.has(body.species)) data.species = body.species

    const updated = await db.strayReport.update({ where: { id }, data })
    try {
      await syncStrayReportDossier({ ...updated, source: updated.source || 'INTERNAL' }, user)
    } catch (linkError) {
      console.error('Sync stray report dossier error:', linkError)
    }

    if (body.statut && body.statut !== existing.statut) {
      await recordActivity({
        user, action: 'STATUS_CHANGE', entityType: 'CSVR_REPORT', entityId: id,
        commune: existing.commune, details: { from: existing.statut, to: body.statut },
      })
    } else {
      await recordActivity({
        user, action: 'UPDATE', entityType: 'CSVR_REPORT', entityId: id, commune: existing.commune,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT csvr/reports/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل البلاغ' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const existing = await db.strayReport.findUnique({ where: { id }, select: { commune: true, reference: true } })
    if (!existing) {
      return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لحذف هذا البلاغ' }, { status: 403 })
    }

    await db.strayReport.delete({ where: { id } })

    await recordActivity({
      user, action: 'DELETE', entityType: 'CSVR_REPORT', entityId: id,
      commune: existing.commune, details: { reference: existing.reference },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE csvr/reports/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف البلاغ' }, { status: 500 })
  }
}
