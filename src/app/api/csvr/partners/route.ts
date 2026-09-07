import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['COMMUNE', 'BCH', 'LOCAL_AUTHORITY', 'HEALTH', 'VETERINARY', 'ASSOCIATION', 'SECURITY', 'SHELTER', 'LABORATORY', 'OTHER'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const commune = getScopedCommuneFilter(user, new URL(request.url).searchParams)
    const partners = await db.strayPartner.findMany({ where: commune ? { commune } : {}, orderBy: [{ status: 'asc' }, { name: 'asc' }], take: 500 })
    return NextResponse.json({ partners })
  } catch (error) {
    console.error('GET csvr/partners error:', error)
    return NextResponse.json({ error: 'تعذر تحميل دليل الشركاء' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const name = String(body.name || '').trim()
    const commune = resolveRecordCommune(user, body.commune)
    if (!name || !commune) return NextResponse.json({ error: 'اسم الشريك والجماعة مطلوبان' }, { status: 400 })
    if (!canAccessCommune(user, commune)) return NextResponse.json({ error: 'الجماعة خارج النطاق المسموح' }, { status: 403 })
    const partner = await db.strayPartner.create({ data: { name: name.slice(0, 200), type: TYPES.has(body.type) ? body.type : 'OTHER', commune, contact: String(body.contact || '').slice(0, 160), telephone: String(body.telephone || '').slice(0, 40), email: String(body.email || '').slice(0, 160), status: body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE', notes: String(body.notes || '').slice(0, 2000), createdBy: user.nom } })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_PARTNER', entityId: partner.id, commune, details: { name: partner.name, type: partner.type } })
    return NextResponse.json(partner, { status: 201 })
  } catch (error) {
    console.error('POST csvr/partners error:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) return NextResponse.json({ error: 'هذا الشريك مسجل مسبقاً في الجماعة' }, { status: 409 })
    return NextResponse.json({ error: 'تعذر إضافة الشريك' }, { status: 500 })
  }
}
