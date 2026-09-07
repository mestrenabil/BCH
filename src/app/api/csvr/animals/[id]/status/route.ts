import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set([
  'SIGNALISE', 'LOCALISE', 'CAPTURE', 'TRANSPORTE', 'ADMIT_CENTRE', 'QUARANTINE',
  'OBSERVATION', 'SOINS', 'APTE_STERIL', 'STERILISE', 'VACCINE', 'IDENTIFIE',
  'CONVALESCENCE', 'PRET_RELACHER', 'RELACHE', 'ADOPTABLE', 'ADOPTE', 'TRANSFERE',
  'DECEDE', 'CLOTURE',
])

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const animal = await db.strayAnimal.findUnique({ where: { id }, select: { commune: true, statut: true, csvrNumber: true } })
    if (!animal) {
      return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(user, animal.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية لتعديل هذا الحيوان' }, { status: 403 })
    }

    const body = await request.json()
    const { toStatus, reason, notes } = body

    if (!ALLOWED_STATUS.has(toStatus)) {
      return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 })
    }
    if (toStatus === animal.statut) {
      return NextResponse.json({ error: 'الحيوان في هذه الحالة بالفعل' }, { status: 400 })
    }

    // Create status history entry and update animal status atomically
    const [updated] = await db.$transaction([
      db.strayAnimal.update({
        where: { id },
        data: { statut: toStatus },
      }),
      db.strayAnimalStatus.create({
        data: {
          animalId: id,
          fromStatus: animal.statut,
          toStatus,
          reason: reason || '',
          changedBy: user.nom,
          notes: notes || '',
        },
      }),
    ])

    await recordActivity({
      user, action: 'STATUS_CHANGE', entityType: 'CSVR_ANIMAL', entityId: id,
      commune: animal.commune, details: { csvrNumber: animal.csvrNumber, from: animal.statut, to: toStatus },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('POST csvr/animals/[id]/status error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تغيير الحالة' }, { status: 500 })
  }
}
