import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const TYPES = new Set(['CENSUS', 'CAPTURE', 'VACCINATION', 'STERILIZATION', 'IDENTIFICATION', 'AWARENESS', 'TARGETED', 'OTHER'])
const STATUSES = new Set(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])

function validDate(value: unknown, fallback = new Date()) {
  if (!value) return fallback
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? fallback : date
}

function withProgress(campaign: { quantitativeTarget: number; achieved: number } & Record<string, unknown>) {
  const progress = campaign.quantitativeTarget > 0 ? Math.min(Math.round((campaign.achieved / campaign.quantitativeTarget) * 100), 100) : null
  return { ...campaign, progress }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const commune = getScopedCommuneFilter(user, searchParams)
    const year = searchParams.get('year')
    const status = searchParams.get('status')
    const campaigns = await db.strayCampaign.findMany({ where: { ...(commune ? { commune } : {}), ...(year && Number.isFinite(Number(year)) ? { year: Number(year) } : {}), ...(status && STATUSES.has(status) ? { status } : {}) }, orderBy: [{ year: 'desc' }, { startDate: 'desc' }], take: 500 })
    return NextResponse.json({ campaigns: campaigns.map(withProgress) })
  } catch (error) {
    console.error('GET csvr/campaigns error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الحملات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'اسم الحملة مطلوب' }, { status: 400 })
    const startDate = validDate(body.startDate)
    const year = Number.parseInt(body.year, 10) || startDate.getFullYear()
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const count = await db.strayCampaign.count({ where: { reference: { startsWith: `CSVR-CAMP-${year}-` } } })
    const reference = `CSVR-CAMP-${year}-${String(count + 1).padStart(3, '0')}`
    const campaign = await db.strayCampaign.create({ data: { reference, year, type: TYPES.has(body.type) ? body.type : 'OTHER', name: name.slice(0, 200), commune, zone: String(body.zone || '').slice(0, 240), objective: String(body.objective || '').slice(0, 2000), responsible: String(body.responsible || '').slice(0, 160), partners: String(body.partners || '').slice(0, 1000), startDate, endDate: body.endDate ? validDate(body.endDate) : null, indicator: String(body.indicator || '').slice(0, 160), quantitativeTarget: Math.max(Number.parseInt(body.quantitativeTarget, 10) || 0, 0), achieved: Math.max(Number.parseInt(body.achieved, 10) || 0, 0), status: STATUSES.has(body.status) ? body.status : 'PLANNED', notes: String(body.notes || '').slice(0, 2000), createdBy: user.nom } })
    await recordActivity({ user, action: 'CREATE', entityType: 'CSVR_CAMPAIGN', entityId: campaign.id, commune, details: { reference: campaign.reference, type: campaign.type } })
    return NextResponse.json(withProgress(campaign), { status: 201 })
  } catch (error) {
    console.error('POST csvr/campaigns error:', error)
    return NextResponse.json({ error: 'تعذر إنشاء الحملة' }, { status: 500 })
  }
}
