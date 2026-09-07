import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const planTypes = new Set(['CONTAMINATION', 'OUTAGE', 'FLOOD', 'SHORTAGE', 'OTHER'])
const riskLevels = new Set(['MEDIUM', 'HIGH', 'CRITICAL'])
const statuses = new Set(['DRAFT', 'ACTIVE', 'MONITORING', 'CLOSED'])

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `URG-WATER-${year}-${suffix}`
    if (!await db.waterEmergencyPlan.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `URG-WATER-${year}-${Date.now().toString(36).toUpperCase()}`
}

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
    const where: Record<string, unknown> = {}
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) where.commune = communeFilter
    if (searchParams.get('status')) where.status = searchParams.get('status')
    const plans = await db.waterEmergencyPlan.findMany({ where, orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 500 })
    const total = await db.waterEmergencyPlan.count({ where })
    return NextResponse.json({ plans, total })
  } catch (error) {
    console.error('GET water-emergency-plans error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل خطط الطوارئ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const title = String(body.title || '').trim()
    if (!title) return NextResponse.json({ error: 'عنوان خطة الطوارئ مطلوب' }, { status: 400 })
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'ليست لديك صلاحية على الجماعة المحددة' }, { status: 403 })
    const planType = String(body.planType || 'CONTAMINATION')
    const riskLevel = String(body.riskLevel || 'HIGH')
    const status = String(body.status || 'DRAFT')
    if (!planTypes.has(planType) || !riskLevels.has(riskLevel) || !statuses.has(status)) return NextResponse.json({ error: 'نوع أو مستوى أو حالة الخطة غير صالحة' }, { status: 400 })
    const plan = await db.waterEmergencyPlan.create({ data: { reference: await createReference(), title, commune, planType, riskLevel, status, trigger: String(body.trigger || ''), responsible: String(body.responsible || user.nom || ''), alternativeSource: String(body.alternativeSource || ''), activatedAt: optionalDate(body.activatedAt), targetCloseAt: optionalDate(body.targetCloseAt), closedAt: status === 'CLOSED' ? new Date() : null, measures: String(body.measures || ''), communicationNote: String(body.communicationNote || ''), notes: String(body.notes || '') } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_EMERGENCY_PLAN', entityId: plan.id, commune, details: { reference: plan.reference, planType, riskLevel, status } })
    return NextResponse.json(plan, { status: 201 })
  } catch (error) {
    console.error('POST water-emergency-plans error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء خطة الطوارئ' }, { status: 500 })
  }
}
