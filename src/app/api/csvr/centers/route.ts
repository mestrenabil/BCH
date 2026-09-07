import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_TYPES = new Set(['REFUGE', 'CENTRE_VETERINAIRE', 'QUARANTINE', 'OTHER'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const commune = getScopedCommuneFilter(user, searchParams)
    const centers = await db.strayAnimalCenter.findMany({
      where: { ...(commune ? { commune } : {}), ...(searchParams.get('status') ? { status: searchParams.get('status')! } : {}) },
      include: { _count: { select: { admissions: true } } },
      orderBy: { name: 'asc' },
      take: 500,
    })
    const activeAdmissions = await db.strayAnimalAdmission.groupBy({ by: ['centerId'], where: { releasedAt: null }, _count: { _all: true } })
    const occupancy = new Map(activeAdmissions.map((item) => [item.centerId, item._count._all]))
    return NextResponse.json({ centers: centers.map((center) => ({ ...center, occupied: occupancy.get(center.id) || 0, available: center.capacity > 0 ? Math.max(center.capacity - (occupancy.get(center.id) || 0), 0) : null })) })
  } catch (error) {
    console.error('GET csvr/centers error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل مراكز الإيواء' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const enforcedCommune = resolveRecordCommune(user, body.commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    if (!String(body.name || '').trim()) return NextResponse.json({ error: 'اسم المركز مطلوب' }, { status: 400 })
    const center = await db.strayAnimalCenter.create({
      data: {
        name: String(body.name).trim().slice(0, 180),
        type: ALLOWED_TYPES.has(body.type) ? body.type : 'REFUGE',
        commune: enforcedCommune,
        adresse: String(body.adresse || '').slice(0, 300),
        latitude: Number.isFinite(Number(body.latitude)) ? Number(body.latitude) : null,
        longitude: Number.isFinite(Number(body.longitude)) ? Number(body.longitude) : null,
        responsible: String(body.responsible || '').slice(0, 160),
        telephone: String(body.telephone || '').slice(0, 40),
        capacity: Math.max(Number.parseInt(body.capacity, 10) || 0, 0),
        status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        notes: String(body.notes || '').slice(0, 2000),
        createdBy: user.nom,
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_CENTER', entityId: center.id, commune: enforcedCommune, details: { name: center.name } })
    return NextResponse.json(center, { status: 201 })
  } catch (error) {
    console.error('POST csvr/centers error:', error)
    return NextResponse.json({ error: 'تعذر إنشاء المركز، تحقق من عدم تكرار الاسم' }, { status: 500 })
  }
}
