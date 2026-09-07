import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const animal = await db.strayAnimal.findUnique({
      where: { id },
      include: {
        statusHistory: { orderBy: { createdAt: 'desc' } },
        mission: { select: { id: true, reference: true, statut: true } },
      },
    })

    if (!animal) {
      return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, animal.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية للوصول إلى هذا الحيوان' }, { status: 403 })
    }

    const [report, careEvents, destinations, admissions, transports, healthAlerts, identifications, photos, biteCases, followUps] = await Promise.all([
      animal.reportId
        ? db.strayReport.findUnique({ where: { id: animal.reportId }, select: { id: true, reference: true, statut: true, priority: true, commune: true, quartier: true, description: true, createdAt: true } })
        : Promise.resolve(null),
      db.strayAnimalCareEvent.findMany({ where: { animalId: id }, orderBy: { date: 'desc' }, take: 100 }),
      db.strayAnimalDestination.findMany({ where: { animalId: id }, orderBy: { date: 'desc' }, take: 100 }),
      db.strayAnimalAdmission.findMany({ where: { animalId: id }, include: { center: { select: { id: true, name: true, type: true, commune: true } } }, orderBy: { admittedAt: 'desc' }, take: 100 }),
      db.strayAnimalTransport.findMany({ where: { animalId: id }, orderBy: { departureDate: 'desc' }, take: 100 }),
      db.strayAnimalHealthAlert.findMany({ where: { animalId: id }, orderBy: { reportedAt: 'desc' }, take: 100 }),
      db.strayAnimalIdentification.findMany({ where: { animalId: id }, orderBy: { date: 'desc' }, take: 100 }),
      db.strayAnimalPhoto.findMany({ where: { animalId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
      db.biteCase.findMany({ where: { animalId: id }, orderBy: { biteDate: 'desc' }, take: 100 }),
      db.strayAnimalFollowUp.findMany({ where: { animalId: id }, orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }], take: 100 }),
    ])

    return NextResponse.json({ ...animal, report, careEvents, destinations, admissions, transports, healthAlerts, identifications, photos, biteCases, followUps })
  } catch (error) {
    console.error('GET csvr/animals/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الحيوان' }, { status: 500 })
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
    const existing = await db.strayAnimal.findUnique({ where: { id }, select: { commune: true } })
    if (!existing) {
      return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذا الحيوان' }, { status: 403 })
    }

    const body = await request.json()
    const data: Record<string, unknown> = {}

    const fields = [
      'species', 'breed', 'sex', 'estimatedAge', 'size', 'primaryColor', 'secondaryColors',
      'distinctiveMarks', 'microchipNumber', 'tagNumber', 'collarNumber',
      'captureLocation', 'captureQuartier', 'capturedBy', 'captureState', 'captureNotes',
      'shelterName', 'boxOrCage',
    ]
    for (const f of fields) {
      if (f in body) data[f] = body[f]
    }
    if ('weight' in body) data.weight = body.weight
    if ('captureLatitude' in body) data.captureLatitude = body.captureLatitude
    if ('captureLongitude' in body) data.captureLongitude = body.captureLongitude
    if ('captureDate' in body) data.captureDate = body.captureDate ? new Date(body.captureDate) : null
    if ('captureTime' in body) data.captureTime = body.captureTime
    if ('hasParasites' in body) data.hasParasites = body.hasParasites
    if ('diseaseSuspect' in body) data.diseaseSuspect = body.diseaseSuspect

    const updated = await db.strayAnimal.update({ where: { id }, data })

    await recordActivity({
      user, action: 'UPDATE', entityType: 'CSVR_ANIMAL', entityId: id, commune: existing.commune,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT csvr/animals/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تعديل الحيوان' }, { status: 500 })
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
    const existing = await db.strayAnimal.findUnique({ where: { id }, select: { commune: true, csvrNumber: true } })
    if (!existing) {
      return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, existing.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لحذف هذا الحيوان' }, { status: 403 })
    }

    await db.strayAnimal.delete({ where: { id } })

    await recordActivity({
      user, action: 'DELETE', entityType: 'CSVR_ANIMAL', entityId: id,
      commune: existing.commune, details: { csvrNumber: existing.csvrNumber },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE csvr/animals/[id] error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الحيوان' }, { status: 500 })
  }
}
