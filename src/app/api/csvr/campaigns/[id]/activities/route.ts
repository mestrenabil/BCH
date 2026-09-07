import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['RESULT', 'CAPTURE', 'VACCINATION', 'STERILIZATION', 'IDENTIFICATION', 'RELEASE'])

function parseDate(value: unknown) {
  if (!value) return new Date()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const campaign = await db.strayCampaign.findUnique({ where: { id }, select: { id: true, commune: true } })
    if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, campaign.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية الوصول' }, { status: 403 })
    const activities = await db.strayCampaignActivity.findMany({ where: { campaignId: id }, orderBy: { date: 'desc' }, take: 500 })
    return NextResponse.json({ activities })
  } catch (error) {
    console.error('GET csvr/campaigns/[id]/activities error:', error)
    return NextResponse.json({ error: 'تعذر تحميل سجل المتابعة' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const body = await request.json()
    const campaign = await db.strayCampaign.findUnique({ where: { id }, select: { id: true, commune: true, reference: true } })
    if (!campaign) return NextResponse.json({ error: 'الحملة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, campaign.commune)) return NextResponse.json({ error: 'ليست لديك صلاحية التعديل' }, { status: 403 })
    const date = parseDate(body.date)
    if (!date) return NextResponse.json({ error: 'تاريخ المتابعة غير صالح' }, { status: 400 })
    const quantity = Math.max(Number.parseInt(body.quantity, 10) || 0, 0)
    if (quantity <= 0) return NextResponse.json({ error: 'أدخل حصيلة أكبر من صفر' }, { status: 400 })
    const activity = await db.$transaction(async (tx) => {
      const created = await tx.strayCampaignActivity.create({ data: {
        campaignId: id,
        date,
        type: TYPES.has(body.type) ? body.type : 'RESULT',
        zone: String(body.zone || '').slice(0, 240),
        quantity,
        staff: String(body.staff || '').slice(0, 240),
        latitude: optionalNumber(body.latitude),
        longitude: optionalNumber(body.longitude),
        notes: String(body.notes || '').slice(0, 2000),
        createdBy: user.nom,
      } })
      const aggregate = await tx.strayCampaignActivity.aggregate({ where: { campaignId: id }, _sum: { quantity: true } })
      await tx.strayCampaign.update({ where: { id }, data: { achieved: aggregate._sum.quantity || 0 } })
      return created
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_CAMPAIGN_ACTIVITY', entityId: activity.id, commune: campaign.commune, details: { campaign: campaign.reference, quantity: activity.quantity, type: activity.type } })
    return NextResponse.json(activity, { status: 201 })
  } catch (error) {
    console.error('POST csvr/campaigns/[id]/activities error:', error)
    return NextResponse.json({ error: 'تعذر تسجيل الحصيلة' }, { status: 500 })
  }
}
