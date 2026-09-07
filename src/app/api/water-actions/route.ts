import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const sourceSelect = { id: true, reference: true, name: true } as const
const statuses = new Set(['PLANNED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CLOSED'])
const priorities = new Set(['LOW', 'NORMAL', 'HIGH', 'URGENT'])

const DEFAULT_WATER_ACTION_SETTINGS = {
  defaultPriority: 'NORMAL',
  responsibleService: 'مصلحة الماء والتطهير الصحي',
}

function parseWaterSettings(value: string | null | undefined) {
  try {
    const parsed: unknown = value ? JSON.parse(value) : {}
    const root = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
    const water = root.water && typeof root.water === 'object' && !Array.isArray(root.water) ? root.water as Record<string, unknown> : {}
    return {
      defaultPriority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(String(water.defaultPriority)) ? String(water.defaultPriority) : DEFAULT_WATER_ACTION_SETTINGS.defaultPriority,
      responsibleService: String(water.responsibleService || DEFAULT_WATER_ACTION_SETTINGS.responsibleService).trim() || DEFAULT_WATER_ACTION_SETTINGS.responsibleService,
    }
  } catch {
    return DEFAULT_WATER_ACTION_SETTINGS
  }
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
    const actions = await db.waterAction.findMany({ where, orderBy: { plannedDate: 'asc' }, take: 500, include: { waterPoint: { select: sourceSelect }, pool: { select: sourceSelect }, inspection: { select: { id: true, reference: true } }, sample: { select: { id: true, reference: true } }, sanitationIncident: { select: { id: true, reference: true } } } })
    return NextResponse.json({ actions })
  } catch (error) {
    console.error('GET water-actions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل التدخلات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const ids = { waterPointId: body.waterPointId ? String(body.waterPointId) : null, poolId: body.poolId ? String(body.poolId) : null, inspectionId: body.inspectionId ? String(body.inspectionId) : null, sampleId: body.sampleId ? String(body.sampleId) : null, sanitationIncidentId: body.sanitationIncidentId ? String(body.sanitationIncidentId) : null }
    if (!Object.values(ids).some(Boolean)) return NextResponse.json({ error: 'حدد مصدراً واحداً للتدخل على الأقل' }, { status: 400 })
    const [point, pool, inspection, sample, incident] = await Promise.all([ids.waterPointId ? db.waterPoint.findUnique({ where: { id: ids.waterPointId }, select: { id: true, commune: true, reference: true, name: true } }) : null, ids.poolId ? db.pool.findUnique({ where: { id: ids.poolId }, select: { id: true, commune: true, reference: true, name: true } }) : null, ids.inspectionId ? db.waterInspection.findUnique({ where: { id: ids.inspectionId }, select: { id: true, commune: true, reference: true } }) : null, ids.sampleId ? db.waterSample.findUnique({ where: { id: ids.sampleId }, select: { id: true, commune: true, reference: true } }) : null, ids.sanitationIncidentId ? db.sanitationIncident.findUnique({ where: { id: ids.sanitationIncidentId }, select: { id: true, commune: true, reference: true } }) : null])
    const sources = [point, pool, inspection, sample, incident]
    if (sources.some((source, index) => Object.values(ids)[index] && !source)) return NextResponse.json({ error: 'أحد مصادر التدخل غير موجود' }, { status: 404 })
    const communes = sources.map((source) => source?.commune).filter(Boolean)
    if (new Set(communes).size > 1) return NextResponse.json({ error: 'يجب أن تنتمي مصادر التدخل إلى نفس الجماعة' }, { status: 400 })
    const commune = resolveRecordCommune(user, body.commune || communes[0])
    if (!commune || communes.some((value) => value !== commune)) return NextResponse.json({ error: 'ليست لديك صلاحية على مصدر التدخل' }, { status: 403 })
    const status = String(body.status || 'PLANNED')
    if (!statuses.has(status)) return NextResponse.json({ error: 'حالة التدخل غير صالحة' }, { status: 400 })
    const settingsRow = await db.communeSettings.findUnique({ where: { commune }, select: { settings: true } })
    const waterSettings = parseWaterSettings(settingsRow?.settings)
    const priority = String(body.priority || waterSettings.defaultPriority)
    if (!priorities.has(priority)) return NextResponse.json({ error: 'أولوية التدخل غير صالحة' }, { status: 400 })
    const year = new Date().getFullYear()
    const reference = `ACT-WATER-${year}-${Date.now().toString(36).toUpperCase()}`
    const action = await db.waterAction.create({ data: { reference, ...ids, commune, actionType: String(body.actionType || 'CONTROL'), priority, status, responsible: String(body.responsible || waterSettings.responsibleService), plannedDate: body.plannedDate ? new Date(String(body.plannedDate)) : null, followUpDate: body.followUpDate ? new Date(String(body.followUpDate)) : null, measures: String(body.measures || ''), observation: String(body.observation || '') }, include: { waterPoint: { select: sourceSelect }, pool: { select: sourceSelect }, inspection: { select: { id: true, reference: true } }, sample: { select: { id: true, reference: true } }, sanitationIncident: { select: { id: true, reference: true } } } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_ACTION', entityId: action.id, commune, details: { reference, status, actionType: action.actionType } })
    return NextResponse.json(action, { status: 201 })
  } catch (error) {
    console.error('POST water-actions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل التدخل' }, { status: 500 })
  }
}
