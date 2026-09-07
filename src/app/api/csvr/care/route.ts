import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_TYPES = new Set(['EXAMINATION', 'TREATMENT', 'VACCINATION', 'STERILIZATION', 'CONTROL'])

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function optionalDate(value: unknown) {
  if (!value) return null
  const parsed = new Date(String(value))
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const animalId = searchParams.get('animalId')
    const type = searchParams.get('type')
    const animal = animalId ? await db.strayAnimal.findUnique({ where: { id: animalId }, select: { commune: true } }) : null
    if (animalId && !animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (animal && !canAccessCommune(user, animal.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية للوصول إلى هذا السجل' }, { status: 403 })

    const events = await db.strayAnimalCareEvent.findMany({
      where: { ...(animalId ? { animalId } : {}), ...(type && ALLOWED_TYPES.has(type) ? { type } : {}) },
      include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true } } },
      orderBy: { date: 'desc' },
      take: 500,
    })
    const scopedEvents = events.filter((event) => canAccessCommune(user, event.animal.commune))
    return NextResponse.json({ events: scopedEvents })
  } catch (error) {
    console.error('GET csvr/care error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل السجل البيطري' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const animalId = typeof body.animalId === 'string' ? body.animalId : ''
    if (!animalId) return NextResponse.json({ error: 'الحيوان مطلوب' }, { status: 400 })
    const animal = await db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, commune: true, statut: true, csvrNumber: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, animal.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذا السجل' }, { status: 403 })

    const type = ALLOWED_TYPES.has(body.type) ? body.type : 'EXAMINATION'
    if (type === 'VACCINATION' && !String(body.vaccineName || '').trim()) return NextResponse.json({ error: 'اسم اللقاح مطلوب' }, { status: 400 })
    if (type === 'STERILIZATION' && !String(body.surgeryType || '').trim()) return NextResponse.json({ error: 'نوع عملية التعقيم مطلوب' }, { status: 400 })
    const event = {
      animalId,
      type,
      date: optionalDate(body.date) || new Date(),
      practitioner: String(body.practitioner || '').slice(0, 160),
      facility: String(body.facility || '').slice(0, 200),
      weight: optionalNumber(body.weight),
      temperature: optionalNumber(body.temperature),
      generalCondition: String(body.generalCondition || '').slice(0, 500),
      diagnosis: String(body.diagnosis || '').slice(0, 2000),
      treatment: String(body.treatment || '').slice(0, 2000),
      vaccineName: String(body.vaccineName || '').slice(0, 200),
      vaccineLot: String(body.vaccineLot || '').slice(0, 120),
      vaccineExpiryDate: optionalDate(body.vaccineExpiryDate),
      dose: String(body.dose || '').slice(0, 80),
      surgeryType: String(body.surgeryType || '').slice(0, 200),
      postoperativeNotes: String(body.postoperativeNotes || '').slice(0, 2000),
      nextDate: optionalDate(body.nextDate),
      notes: String(body.notes || '').slice(0, 3000),
      createdBy: user.nom,
    }
    const nextStatus = type === 'VACCINATION' ? 'VACCINE' : type === 'STERILIZATION' ? 'STERILISE' : null
    const result = await db.$transaction(async (tx) => {
      const created = await tx.strayAnimalCareEvent.create({ data: event })
      if (nextStatus && nextStatus !== animal.statut) {
        await tx.strayAnimal.update({ where: { id: animalId }, data: { statut: nextStatus } })
        await tx.strayAnimalStatus.create({ data: { animalId, fromStatus: animal.statut, toStatus: nextStatus, reason: type === 'VACCINATION' ? 'تسجيل التلقيح' : 'تسجيل التعقيم', changedBy: user.nom } })
      }
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_CARE_EVENT', entityId: result.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, type } })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('POST csvr/care error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ المتابعة البيطرية' }, { status: 500 })
  }
}
