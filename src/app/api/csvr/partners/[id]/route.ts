import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.strayPartner.findUnique({ where: { id }, select: { commune: true, status: true } })
    if (!existing) return NextResponse.json({ error: 'الشريك غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية التعديل' }, { status: 403 })
    const body = await request.json()
    const status = body.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE'
    const partner = await db.strayPartner.update({ where: { id }, data: { status } })
    await recordActivity({ user, action: 'UPDATE', entityType: 'CSVR_PARTNER', entityId: id, commune: existing.commune, details: { status } })
    return NextResponse.json(partner)
  } catch (error) {
    console.error('PUT csvr/partners/[id] error:', error)
    return NextResponse.json({ error: 'تعذر تحديث الشريك' }, { status: 500 })
  }
}
