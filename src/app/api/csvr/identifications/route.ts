import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['MICROCHIP', 'TAG', 'COLLAR', 'TATTOO', 'OTHER'])

function validDate(value: unknown) {
  if (!value) return new Date()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const animalId = new URL(request.url).searchParams.get('animalId')
    const identifications = await db.strayAnimalIdentification.findMany({ where: animalId ? { animalId } : undefined, include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true } } }, orderBy: { date: 'desc' }, take: 500 })
    return NextResponse.json({ identifications: identifications.filter((item) => canAccessCommune(user, item.animal.commune)) })
  } catch (error) {
    console.error('GET csvr/identifications error:', error)
    return NextResponse.json({ error: 'تعذر تحميل التعريفات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const animalId = typeof body.animalId === 'string' ? body.animalId : ''
    const number = String(body.number || '').trim()
    if (!animalId || !number) return NextResponse.json({ error: 'الحيوان ورقم التعريف مطلوبان' }, { status: 400 })
    const animal = await db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, csvrNumber: true, commune: true, statut: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, animal.commune)) return NextResponse.json({ error: 'الحيوان خارج النطاق المسموح' }, { status: 403 })
    const type = TYPES.has(body.type) ? body.type : 'OTHER'
    const duplicate = await db.strayAnimalIdentification.findFirst({ where: { type, number } })
    if (duplicate) return NextResponse.json({ error: 'رقم التعريف مستعمل مسبقاً' }, { status: 409 })
    const identification = await db.$transaction(async (tx) => {
      const created = await tx.strayAnimalIdentification.create({ data: { animalId, type, number: number.slice(0, 120), date: validDate(body.date), operator: String(body.operator || user.nom).slice(0, 160), photo: String(body.photo || '').slice(0, 300), notes: String(body.notes || '').slice(0, 2000), createdBy: user.nom } })
      if (animal.statut !== 'IDENTIFIE') {
        await tx.strayAnimal.update({ where: { id: animalId }, data: { statut: 'IDENTIFIE', ...(type === 'MICROCHIP' ? { microchipNumber: number } : type === 'TAG' ? { tagNumber: number } : type === 'COLLAR' ? { collarNumber: number } : {}) } })
        await tx.strayAnimalStatus.create({ data: { animalId, fromStatus: animal.statut, toStatus: 'IDENTIFIE', reason: 'تسجيل وسيلة تعريف الحيوان', changedBy: user.nom } })
      }
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_IDENTIFICATION', entityId: identification.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, type, number } })
    return NextResponse.json(identification, { status: 201 })
  } catch (error) {
    console.error('POST csvr/identifications error:', error)
    return NextResponse.json({ error: 'تعذر تسجيل التعريف' }, { status: 500 })
  }
}
