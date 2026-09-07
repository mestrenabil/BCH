import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const DEFAULT_SETTINGS = {
  categories: ['POLLUTION', 'WASTE', 'NATURAL_SITE', 'ESTABLISHMENT', 'COMPLAINT', 'PROGRAM'],
  pollutionTypes: ['AIR', 'WATER', 'SOIL', 'NOISE', 'ODOR', 'OTHER'], wasteTypes: ['HOUSEHOLD', 'CONSTRUCTION', 'GREEN', 'DANGEROUS', 'OTHER'], siteTypes: ['FOREST', 'WETLAND', 'COAST', 'PARK', 'WATERCOURSE', 'OTHER'],
  operational: { defaultPriority: 'NORMALE', responseTargetHours: 48, followUpAfterDays: 7, requireLocation: true, requirePhotoForClosure: true },
  contacts: { responsibleName: '', serviceName: 'مصلحة المحافظة على البيئة', emergencyPhone: '', email: '' }, notifications: { urgentAlerts: true, pollutionAlerts: true, inspectionReminders: true, campaignReminders: true },
  workflow: { autoCreateInspection: false, lockClosedRecords: true, allowStatusReopen: false, requireClosureNote: true },
  map: { defaultZoom: 13, showBoundary: true, showDossiers: true, showPollution: true, showWaste: true, showSites: true, clusterPoints: true },
  reporting: { referencePrefix: 'ENV', defaultFormat: 'PDF', includeCoordinates: true, includePhotos: true, includeRiskSummary: true }, dataPolicy: { retentionDays: 3650, maskPersonalContacts: false, requireEvidenceForClosure: true },
}

function parse(value: string | null | undefined): Record<string, unknown> { try { const result = value ? JSON.parse(value) : {}; return result && typeof result === 'object' && !Array.isArray(result) ? result as Record<string, unknown> : {} } catch { return {} } }
function list(value: unknown, fallback: string[]) { return Array.isArray(value) ? Array.from(new Set(value.map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean))).slice(0, 40) : fallback }
function object(input: unknown) { return input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {} }
function sanitize(input: Record<string, unknown>) {
  const operational = object(input.operational), contacts = object(input.contacts), notifications = object(input.notifications), workflow = object(input.workflow), map = object(input.map), reporting = object(input.reporting), dataPolicy = object(input.dataPolicy)
  return {
    categories: list(input.categories, DEFAULT_SETTINGS.categories), pollutionTypes: list(input.pollutionTypes, DEFAULT_SETTINGS.pollutionTypes), wasteTypes: list(input.wasteTypes, DEFAULT_SETTINGS.wasteTypes), siteTypes: list(input.siteTypes, DEFAULT_SETTINGS.siteTypes),
    operational: { defaultPriority: String(operational.defaultPriority || DEFAULT_SETTINGS.operational.defaultPriority).slice(0, 30), responseTargetHours: Math.min(720, Math.max(1, Number(operational.responseTargetHours) || 48)), followUpAfterDays: Math.min(365, Math.max(0, Number(operational.followUpAfterDays) || 0)), requireLocation: operational.requireLocation !== false, requirePhotoForClosure: operational.requirePhotoForClosure !== false },
    contacts: { responsibleName: String(contacts.responsibleName || '').trim().slice(0, 160), serviceName: String(contacts.serviceName || DEFAULT_SETTINGS.contacts.serviceName).trim().slice(0, 200), emergencyPhone: String(contacts.emergencyPhone || '').trim().slice(0, 60), email: String(contacts.email || '').trim().slice(0, 160) },
    notifications: { urgentAlerts: notifications.urgentAlerts !== false, pollutionAlerts: notifications.pollutionAlerts !== false, inspectionReminders: notifications.inspectionReminders !== false, campaignReminders: notifications.campaignReminders !== false },
    workflow: { autoCreateInspection: workflow.autoCreateInspection === true, lockClosedRecords: workflow.lockClosedRecords !== false, allowStatusReopen: workflow.allowStatusReopen === true, requireClosureNote: workflow.requireClosureNote !== false },
    map: { defaultZoom: Math.min(19, Math.max(5, Number(map.defaultZoom) || 13)), showBoundary: map.showBoundary !== false, showDossiers: map.showDossiers !== false, showPollution: map.showPollution !== false, showWaste: map.showWaste !== false, showSites: map.showSites !== false, clusterPoints: map.clusterPoints !== false },
    reporting: { referencePrefix: String(reporting.referencePrefix || 'ENV').trim().slice(0, 20), defaultFormat: ['PDF', 'CSV', 'JSON'].includes(String(reporting.defaultFormat)) ? String(reporting.defaultFormat) : 'PDF', includeCoordinates: reporting.includeCoordinates !== false, includePhotos: reporting.includePhotos !== false, includeRiskSummary: reporting.includeRiskSummary !== false },
    dataPolicy: { retentionDays: Math.min(36500, Math.max(30, Number(dataPolicy.retentionDays) || 3650)), maskPersonalContacts: dataPolicy.maskPersonalContacts === true, requireEvidenceForClosure: dataPolicy.requireEvidenceForClosure !== false },
  }
}

export async function GET(request: NextRequest) {
  try { const authResult = await requireAuth(); if ('error' in authResult) return authResult.error; const { user } = authResult; const requested = new URL(request.url).searchParams.get('commune'); const managed = user.managedCommunes?.length ? user.managedCommunes : (user.commune && user.commune !== 'ALL' ? [user.commune] : []); const commune = requested && requested !== 'ALL' ? requested : (managed[0] || ''); if (!commune) return NextResponse.json({ settings: DEFAULT_SETTINGS, commune: '' }); if (!canAccessCommune(user, commune)) return NextResponse.json({ error: 'ليست لديك صلاحية لهذه الجماعة' }, { status: 403 }); const row = await db.communeSettings.findUnique({ where: { commune } }); const stored = parse(row?.settings).environment; return NextResponse.json({ settings: sanitize({ ...DEFAULT_SETTINGS, ...object(stored) }), commune }) } catch (error) { console.error('GET environment/settings error:', error); return NextResponse.json({ error: 'حدث خطأ أثناء تحميل إعدادات البيئة' }, { status: 500 }) }
}

export async function PUT(request: NextRequest) {
  try { const authResult = await requireAuth(); if ('error' in authResult) return authResult.error; const { user } = authResult; const body = await request.json(); const commune = resolveRecordCommune(user, body.commune); if (!commune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 }); const existing = await db.communeSettings.findUnique({ where: { commune } }); const root = parse(existing?.settings); const merged = sanitize({ ...DEFAULT_SETTINGS, ...object(root.environment), ...object(body.settings) }); const settings = JSON.stringify({ ...root, environment: merged }); await db.communeSettings.upsert({ where: { commune }, update: { settings }, create: { commune, settings } }); await recordActivity({ user, action: 'UPDATE', entityType: 'ENVIRONMENT_SETTINGS', entityId: commune, commune, details: { sections: Object.keys(body.settings || {}) } }); return NextResponse.json({ settings: merged, commune }) } catch (error) { console.error('PUT environment/settings error:', error); return NextResponse.json({ error: 'حدث خطأ أثناء حفظ إعدادات البيئة' }, { status: 500 }) }
}
