import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.strayCampaign.findUnique({ where: { id }, select: { commune: true } })
    if (!existing) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية تعديل هذه الحملة' }, { status: 403 })
    const body = await request.json()
    const data: Record<string, unknown> = {}
    if ('achieved' in body) data.achieved = Math.max(Number.parseInt(body.achieved, 10) || 0, 0)
    if (body.status && STATUSES.has(body.status)) data.status = body.status
    if ('notes' in body) data.notes = String(body.notes || '').slice(0, 2000)
    const campaign = await db.strayCampaign.update({ where: { id }, data })
    await recordActivity({ user, action: 'UPDATE', entityType: 'CSVR_CAMPAIGN', entityId: id, commune: existing.commune, details: { achieved: campaign.achieved, status: campaign.status } })
    return NextResponse.json({ ...campaign, progress: campaign.quantitativeTarget > 0 ? Math.min(Math.round((campaign.achieved / campaign.quantitativeTarget) * 100), 100) : null })
  } catch (error) {
    console.error('PUT csvr/campaigns/[id] error:', error)
    return NextResponse.json({ error: 'تعذر تحديث الحملة' }, { status: 500 })
  }
}
