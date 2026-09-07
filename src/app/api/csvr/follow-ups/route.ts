import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['POST_ADOPTION', 'POST_RELEASE', 'CENTER_CHECK'])
const STATUSES = new Set(['PLANNED', 'CONTACTED', 'COMPLETED', 'FAILED', 'CANCELLED'])

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const animalId = searchParams.get('animalId')
    const type = searchParams.get('type')
    const followUps = await db.strayAnimalFollowUp.findMany({
      where: { ...(animalId ? { animalId } : {}), ...(type && TYPES.has(type) ? { type } : {}) },
      include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true, statut: true } } },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'desc' }],
      take: 500,
    })
    return NextResponse.json({ followUps: followUps.filter((followUp) => canAccessCommune(user, followUp.animal.commune)) })
  } catch (error) {
    console.error('GET csvr/follow-ups error:', error)
    return NextResponse.json({ error: 'تعذر تحميل المتابعات' }, { status: 500 })
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
    const animal = await db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, csvrNumber: true, commune: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, animal.commune)) return NextResponse.json({ error: 'الحيوان خارج النطاق المسموح' }, { status: 403 })
    const type = TYPES.has(body.type) ? body.type : 'POST_ADOPTION'
    const scheduledDate = optionalDate(body.scheduledDate)
    if (!scheduledDate) return NextResponse.json({ error: 'موعد المتابعة مطلوب' }, { status: 400 })
    const followUp = await db.strayAnimalFollowUp.create({
      data: {
        animalId,
        destinationId: typeof body.destinationId === 'string' ? body.destinationId : null,
        type,
        scheduledDate,
        visitDate: optionalDate(body.visitDate),
        status: STATUSES.has(body.status) ? body.status : 'PLANNED',
        contactName: String(body.contactName || '').slice(0, 160),
        contactPhone: String(body.contactPhone || '').slice(0, 40),
        welfareStatus: String(body.welfareStatus || '').slice(0, 160),
        location: String(body.location || '').slice(0, 300),
        outcome: String(body.outcome || '').slice(0, 2000),
        notes: String(body.notes || '').slice(0, 3000),
        createdBy: user.nom,
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_FOLLOW_UP', entityId: followUp.id, commune: animal.commune, details: { csvrNumber: animal.csvrNumber, type } })
    return NextResponse.json(followUp, { status: 201 })
  } catch (error) {
    console.error('POST csvr/follow-ups error:', error)
    return NextResponse.json({ error: 'تعذر حفظ المتابعة' }, { status: 500 })
  }
}
