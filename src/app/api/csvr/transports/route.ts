import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

function parseDate(value: unknown, fallback = new Date()) {
  if (!value) return fallback
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? fallback : date
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const animalId = new URL(request.url).searchParams.get('animalId')
    const transports = await db.strayAnimalTransport.findMany({ where: animalId ? { animalId } : undefined, include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true } } }, orderBy: { departureDate: 'desc' }, take: 500 })
    return NextResponse.json({ transports: transports.filter((transport) => canAccessCommune(user, transport.animal.commune)) })
  } catch (error) {
    console.error('GET csvr/transports error:', error)
    return NextResponse.json({ error: 'تعذر تحميل النقل الميداني' }, { status: 500 })
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
    const animal = await db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, csvrNumber: true, commune: true, statut: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, animal.commune)) return NextResponse.json({ error: 'الحيوان خارج النطاق المسموح' }, { status: 403 })
    const transport = await db.$transaction(async (tx) => {
      const created = await tx.strayAnimalTransport.create({ data: { animalId, departureDate: parseDate(body.departureDate), departureTime: String(body.departureTime || '').slice(0, 20), arrivalDate: body.arrivalDate ? parseDate(body.arrivalDate) : null, arrivalTime: String(body.arrivalTime || '').slice(0, 20), vehicle: String(body.vehicle || '').slice(0, 120), driver: String(body.driver || '').slice(0, 160), agent: String(body.agent || user.nom).slice(0, 160), destination: String(body.destination || '').slice(0, 240), animalCount: Math.max(Number.parseInt(body.animalCount, 10) || 1, 1), incident: String(body.incident || '').slice(0, 1000), notes: String(body.notes || '').slice(0, 2000), createdBy: user.nom } })
      if (animal.statut !== 'TRANSPORTE') {
        await tx.strayAnimal.update({ where: { id: animalId }, data: { statut: 'TRANSPORTE' } })
        await tx.strayAnimalStatus.create({ data: { animalId, fromStatus: animal.statut, toStatus: 'TRANSPORTE', reason: 'تسجيل نقل ميداني', changedBy: user.nom } })
      }
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_TRANSPORT', entityId: transport.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, destination: transport.destination } })
    return NextResponse.json(transport, { status: 201 })
  } catch (error) {
    console.error('POST csvr/transports error:', error)
    return NextResponse.json({ error: 'تعذر تسجيل النقل' }, { status: 500 })
  }
}
