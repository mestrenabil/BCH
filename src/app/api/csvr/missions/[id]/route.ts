import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set([
  'PLANIFIEE', 'CONFIRME', 'EN_ROUTE', 'SUR_PLACE', 'CAPTURE_EN_COURS',
  'TERMINEE', 'PARTIEL', 'REPORTEE', 'ANNULEE',
])
const ALLOWED_PRIORITY = new Set(['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const mission = await db.captureMission.findUnique({
      where: { id },
      include: {
        reports: { select: { id: true, reference: true, species: true, priority: true, statut: true, adresse: true } },
        animals: { select: { id: true, csvrNumber: true, species: true, sex: true, primaryColor: true, statut: true } },
      },
    })

    if (!mission) {
      return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(user, mission.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية للوصول إلى هذه المهمة' }, { status: 403 })
    }

    return NextResponse.json(mission)
  } catch (error) {
    console.error('GET csvr/missions/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المهمة' }, { status: 500 })
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
    const existing = await db.captureMission.findUnique({ where: { id }, select: { commune: true, statut: true } })
    if (!existing) {
      return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذه المهمة' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    const fields = [
      'quartier', 'zone', 'teamLead', 'driver', 'agents', 'veterinarian', 'vehicle',
      'equipment', 'cagesAvailable', 'estimatedAnimals', 'safetyNotes', 'preNotes',
      'arrivalTime', 'endTime', 'observedCount', 'capturedCount', 'notCapturedCount',
      'difficulties', 'incidents', 'agentInjured', 'biteOccurred', 'materialDamage', 'postNotes',
    ]
    for (const f of fields) {
      if (f in body) data[f] = body[f]
    }
    if ('latitude' in body) data.latitude = body.latitude
    if ('longitude' in body) data.longitude = body.longitude
    if ('scheduledAt' in body) data.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null
    if (body.statut && ALLOWED_STATUS.has(body.statut)) {
      data.statut = body.statut
      if (body.statut === 'TERMINEE' && existing.statut !== 'TERMINEE') {
        data.completedAt = new Date()
      }
    }
    if (body.priority && ALLOWED_PRIORITY.has(body.priority)) data.priority = body.priority

    const updated = await db.captureMission.update({ where: { id }, data })

    if (body.statut && body.statut !== existing.statut) {
      await recordActivity({
        user, action: 'STATUS_CHANGE', entityType: 'CSVR_MISSION', entityId: id,
        commune: existing.commune, details: { from: existing.statut, to: body.statut },
      })
    } else {
      await recordActivity({
        user, action: 'UPDATE', entityType: 'CSVR_MISSION', entityId: id, commune: existing.commune,
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT csvr/missions/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل المهمة' }, { status: 500 })
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
    const existing = await db.captureMission.findUnique({ where: { id }, select: { commune: true, reference: true } })
    if (!existing) {
      return NextResponse.json({ error: 'المهمة غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لحذف هذه المهمة' }, { status: 403 })
    }

    // Unlink reports and animals before deleting
    await db.strayReport.updateMany({ where: { missionId: id }, data: { missionId: null } })
    await db.strayAnimal.updateMany({ where: { missionId: id }, data: { missionId: null } })

    await db.captureMission.delete({ where: { id } })

    await recordActivity({
      user, action: 'DELETE', entityType: 'CSVR_MISSION', entityId: id,
      commune: existing.commune, details: { reference: existing.reference },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE csvr/missions/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المهمة' }, { status: 500 })
  }
}
