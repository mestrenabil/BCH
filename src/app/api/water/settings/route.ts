import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getManagedCommunes, requireAuth, type AuthUser } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const DEFAULT_SETTINGS = {
  samplingFrequencyDays: 30,
  inspectionFrequencyDays: 30,
  alertLeadDays: 7,
  defaultDisinfectant: 'الكلور الحر',
  defaultPriority: 'NORMAL',
  responsibleService: 'مصلحة الماء والتطهير الصحي',
  requireEvidencePhoto: false,
  requireClosureNote: true,
  enableAutomaticReminders: true,
}

function parse(value: string | null | undefined): Record<string, unknown> {
  try {
    const parsed = value ? JSON.parse(value) : {}
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function sanitize(input: Record<string, unknown>) {
  const numberValue = (value: unknown, fallback: number, max: number) => Math.min(max, Math.max(1, Number(value) || fallback))
  return {
    samplingFrequencyDays: numberValue(input.samplingFrequencyDays, DEFAULT_SETTINGS.samplingFrequencyDays, 365),
    inspectionFrequencyDays: numberValue(input.inspectionFrequencyDays, DEFAULT_SETTINGS.inspectionFrequencyDays, 365),
    alertLeadDays: numberValue(input.alertLeadDays, DEFAULT_SETTINGS.alertLeadDays, 90),
    defaultDisinfectant: String(input.defaultDisinfectant || DEFAULT_SETTINGS.defaultDisinfectant).trim().slice(0, 100),
    defaultPriority: ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(String(input.defaultPriority)) ? String(input.defaultPriority) : DEFAULT_SETTINGS.defaultPriority,
    responsibleService: String(input.responsibleService || DEFAULT_SETTINGS.responsibleService).trim().slice(0, 160),
    requireEvidencePhoto: input.requireEvidencePhoto === true,
    requireClosureNote: input.requireClosureNote !== false,
    enableAutomaticReminders: input.enableAutomaticReminders !== false,
  }
}

function resolveCommune(user: AuthUser, requested?: string | null) {
  if (user.role === 'admin') return requested || 'ALL'
  const managed = getManagedCommunes(user)
  if (requested && requested !== 'ALL') return managed.includes(requested) ? requested : null
  return managed[0] || null
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const commune = resolveCommune(user, new URL(request.url).searchParams.get('commune'))
    if (!commune) return NextResponse.json({ settings: DEFAULT_SETTINGS, commune: '' })
    const row = await db.communeSettings.findUnique({ where: { commune } })
    const storedWater = parse(row?.settings).water
    const stored = storedWater && typeof storedWater === 'object' && !Array.isArray(storedWater) ? storedWater as Record<string, unknown> : {}
    const settings = sanitize({ ...DEFAULT_SETTINGS, ...stored })
    return NextResponse.json({ settings, commune })
  } catch (error) {
    console.error('GET water/settings error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل إعدادات الماء والتطهير' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as { commune?: string; settings?: Record<string, unknown> }
    const commune = resolveCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'ليست لديك صلاحية لهذه الجماعة' }, { status: 403 })
    const existing = await db.communeSettings.findUnique({ where: { commune } })
    const root = parse(existing?.settings)
    const settings = sanitize({ ...DEFAULT_SETTINGS, ...parse(typeof root.water === 'string' ? root.water : JSON.stringify(root.water || {})), ...(body.settings || {}) })
    await db.communeSettings.upsert({ where: { commune }, update: { settings: JSON.stringify({ ...root, water: settings }) }, create: { commune, settings: JSON.stringify({ water: settings }) } })
    await recordActivity({ user, action: 'UPDATE', entityType: 'WATER_SETTINGS', entityId: commune, commune, details: { sections: Object.keys(body.settings || {}) } })
    return NextResponse.json({ settings, commune })
  } catch (error) {
    console.error('PUT water/settings error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ إعدادات الماء والتطهير' }, { status: 500 })
  }
}
