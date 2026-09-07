import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_TYPES = new Set(['RETURN', 'ADOPTION', 'TRANSFER', 'DEATH'])
const STATUS_BY_TYPE: Record<string, string> = { RETURN: 'RELACHE', ADOPTION: 'ADOPTE', TRANSFER: 'TRANSFERE', DEATH: 'DECEDE' }

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
    const type = searchParams.get('type')
    const destinations = await db.strayAnimalDestination.findMany({
      where: { ...(animalId ? { animalId } : {}), ...(type && ALLOWED_TYPES.has(type) ? { type } : {}) },
      include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true } } },
      orderBy: { date: 'desc' },
      take: 500,
    })
    return NextResponse.json({ destinations: destinations.filter((item) => canAccessCommune(user, item.animal.commune)) })
  } catch (error) {
    console.error('GET csvr/destinations error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل وجهات الحيوانات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const animalId = typeof body.animalId === 'string' ? body.animalId : ''
    const type = ALLOWED_TYPES.has(body.type) ? body.type : 'RETURN'
    if (!animalId) return NextResponse.json({ error: 'الحيوان مطلوب' }, { status: 400 })
    const animal = await db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, commune: true, statut: true, csvrNumber: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, animal.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذا السجل' }, { status: 403 })

    const destination = {
      animalId,
      type,
      date: validDate(body.date),
      time: String(body.time || '').slice(0, 20),
      site: String(body.site || '').slice(0, 300),
      commune: String(body.commune || animal.commune).slice(0, 120),
      quartier: String(body.quartier || '').slice(0, 160),
      latitude: optionalNumber(body.latitude),
      longitude: optionalNumber(body.longitude),
      structure: String(body.structure || '').slice(0, 240),
      adopterName: String(body.adopterName || '').slice(0, 160),
      adopterPhone: String(body.adopterPhone || '').slice(0, 40),
      adoptionDocument: String(body.adoptionDocument || '').slice(0, 160),
      adoptionCommitment: Boolean(body.adoptionCommitment),
      vaccinationConfirmed: Boolean(body.vaccinationConfirmed),
      sterilizationConfirmed: Boolean(body.sterilizationConfirmed),
      identificationConfirmed: Boolean(body.identificationConfirmed),
      notes: String(body.notes || '').slice(0, 3000),
      createdBy: user.nom,
    }
    const nextStatus = STATUS_BY_TYPE[type]
    const result = await db.$transaction(async (tx) => {
      const created = await tx.strayAnimalDestination.create({ data: destination })
      if (nextStatus !== animal.statut) {
        await tx.strayAnimal.update({ where: { id: animalId }, data: { statut: nextStatus } })
        await tx.strayAnimalStatus.create({ data: { animalId, fromStatus: animal.statut, toStatus: nextStatus, reason: `تسجيل الوجهة: ${type}`, changedBy: user.nom } })
      }
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_DESTINATION', entityId: result.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, type } })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST csvr/destinations error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ وجهة الحيوان' }, { status: 500 })
  }
}
