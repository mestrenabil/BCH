import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function validDate(value: unknown) {
  if (!value) return new Date()
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const animalId = searchParams.get('animalId')
    const centerId = searchParams.get('centerId')
    const admissions = await db.strayAnimalAdmission.findMany({
      where: { ...(animalId ? { animalId } : {}), ...(centerId ? { centerId } : {}) },
      include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true, statut: true } }, center: { select: { id: true, name: true, commune: true } } },
      orderBy: { admittedAt: 'desc' },
      take: 500,
    })
    return NextResponse.json({ admissions: admissions.filter((item) => canAccessCommune(user, item.animal.commune)) })
  } catch (error) {
    console.error('GET csvr/admissions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الاستقبالات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const animalId = typeof body.animalId === 'string' ? body.animalId : ''
    const centerId = typeof body.centerId === 'string' ? body.centerId : ''
    if (!animalId || !centerId) return NextResponse.json({ error: 'الحيوان والمركز مطلوبان' }, { status: 400 })
    const [animal, center] = await Promise.all([
      db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, commune: true, statut: true, csvrNumber: true } }),
      db.strayAnimalCenter.findUnique({ where: { id: centerId }, select: { id: true, commune: true, capacity: true, name: true } }),
    ])
    if (!animal || !center) return NextResponse.json({ error: 'الحيوان أو المركز غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, animal.commune) || !canAccessCommune(user, center.commune) || animal.commune !== center.commune) return NextResponse.json({ error: 'الحيوان والمركز خارج النطاق المسموح' }, { status: 403 })
    const occupied = await db.strayAnimalAdmission.count({ where: { centerId, releasedAt: null } })
    if (center.capacity > 0 && occupied >= center.capacity) return NextResponse.json({ error: `المركز ممتلئ (${center.capacity} مكان)` }, { status: 409 })

    const admission = await db.$transaction(async (tx) => {
      const created = await tx.strayAnimalAdmission.create({ data: { animalId, centerId, admittedAt: validDate(body.admittedAt), boxOrZone: String(body.boxOrZone || '').slice(0, 120), generalCondition: String(body.generalCondition || '').slice(0, 500), weight: optionalNumber(body.weight), temperature: optionalNumber(body.temperature), observation: String(body.observation || '').slice(0, 2000), agent: String(body.agent || user.nom).slice(0, 160), createdBy: user.nom } })
      if (animal.statut !== 'ADMIT_CENTRE') {
        await tx.strayAnimal.update({ where: { id: animalId }, data: { statut: 'ADMIT_CENTRE', shelterName: center.name, boxOrCage: String(body.boxOrZone || '') } })
        await tx.strayAnimalStatus.create({ data: { animalId, fromStatus: animal.statut, toStatus: 'ADMIT_CENTRE', reason: 'تسجيل دخول إلى مركز الإيواء', changedBy: user.nom } })
      }
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_ADMISSION', entityId: admission.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, center: center.name } })
    return NextResponse.json(admission, { status: 201 })
  } catch (error) {
    console.error('POST csvr/admissions error:', error)
    return NextResponse.json({ error: 'تعذر تسجيل استقبال الحيوان' }, { status: 500 })
  }
}
