import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['RAGE_SUSPECT', 'INJURY', 'DISEASE_SUSPECT', 'QUARANTINE', 'OTHER'])
const URGENCIES = new Set(['NORMAL', 'HIGH', 'URGENT'])
const VACCINATION = new Set(['UNKNOWN', 'VACCINATED', 'NOT_VACCINATED', 'PARTIAL'])

function parseDate(value: unknown) {
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
    const alerts = await db.strayAnimalHealthAlert.findMany({ where: animalId ? { animalId } : undefined, include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true, statut: true, captureLatitude: true, captureLongitude: true } } }, orderBy: { reportedAt: 'desc' }, take: 500 })
    return NextResponse.json({ alerts: alerts.filter((alert) => canAccessCommune(user, alert.animal.commune)) })
  } catch (error) {
    console.error('GET csvr/health-alerts error:', error)
    return NextResponse.json({ error: 'تعذر تحميل التنبيهات الصحية' }, { status: 500 })
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
    const type = TYPES.has(body.type) ? body.type : 'OTHER'
    const urgency = URGENCIES.has(body.urgency) ? body.urgency : 'NORMAL'
    const clinicalSuspicion = Boolean(body.clinicalSuspicion)
    const alert = await db.$transaction(async (tx) => {
      const created = await tx.strayAnimalHealthAlert.create({ data: { animalId, reportedAt: parseDate(body.reportedAt), type, urgency, clinicalSuspicion, vaccinationStatus: VACCINATION.has(body.vaccinationStatus) ? body.vaccinationStatus : 'UNKNOWN', measureTaken: String(body.measureTaken || '').slice(0, 2000), healthServiceInformed: Boolean(body.healthServiceInformed), authorityInformed: Boolean(body.authorityInformed), notes: String(body.notes || '').slice(0, 3000), createdBy: user.nom } })
      if ((type === 'RAGE_SUSPECT' || clinicalSuspicion) && animal.statut !== 'QUARANTINE') {
        await tx.strayAnimal.update({ where: { id: animalId }, data: { statut: 'QUARANTINE' } })
        await tx.strayAnimalStatus.create({ data: { animalId, fromStatus: animal.statut, toStatus: 'QUARANTINE', reason: 'تنبيه صحي: اشتباه يحتاج إلى حجر وتقييم مختص', changedBy: user.nom } })
      }
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_HEALTH_ALERT', entityId: alert.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, type, urgency } })
    return NextResponse.json(alert, { status: 201 })
  } catch (error) {
    console.error('POST csvr/health-alerts error:', error)
    return NextResponse.json({ error: 'تعذر تسجيل التنبيه الصحي' }, { status: 500 })
  }
}
