import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const DEFAULT_SETTINGS = {
  shelters: [] as Array<{ name: string; address: string; capacity: number }>,
  speciesTypes: ['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER'],
  priorityLevels: ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'],
  captureStates: ['CALME', 'PEUREUX', 'AGRESSIF', 'BLESSE', 'MALADE', 'AMAIGRI', 'GESTANTE', 'ALLAITANTE'],
  operational: { defaultPriority: 'NORMALE', responseTargetHours: 24, quarantineDays: 10, requireLocation: true, requirePhotoForClosure: false },
  contacts: { responsibleName: '', veterinaryService: '', emergencyPhone: '', email: '' },
  notifications: { urgentAlerts: true, healthAlerts: true, missionReminders: true },
  vaccination: { preferredVaccineType: 'UNKNOWN', preferredRoute: 'UNKNOWN', protocolReference: 'WHO/OMS + البرنامج الوطني المعتمد', requireMedicalValidation: true },
  workflow: { autoCreateUrgentMission: false, followUpAfterDays: 3, lockClosedRecords: true, allowStatusReopen: false },
  map: { defaultZoom: 13, showBoundary: true, showReports: true, showMissions: true, showAnimals: true, clusterPoints: true },
  reporting: { referencePrefix: 'CSVR', defaultFormat: 'PDF', includeCoordinates: true, includePhotos: false },
  dataPolicy: { retentionDays: 3650, maskPersonalContacts: false, requireClosureNote: true },
}

function stringList(value: unknown, fallback: string[], max = 40) {
  if (!Array.isArray(value)) return fallback
  return Array.from(new Set(value.map((item) => String(item || '').trim().slice(0, 80)).filter(Boolean))).slice(0, max)
}

function parseStored(value: string | undefined) {
  try { return value ? JSON.parse(value) as Record<string, unknown> : {} } catch { return {} }
}

function sanitizeSettings(input: Record<string, unknown>) {
  const operational = input.operational && typeof input.operational === 'object' ? input.operational as Record<string, unknown> : {}
  const contacts = input.contacts && typeof input.contacts === 'object' ? input.contacts as Record<string, unknown> : {}
  const notifications = input.notifications && typeof input.notifications === 'object' ? input.notifications as Record<string, unknown> : {}
  const vaccination = input.vaccination && typeof input.vaccination === 'object' ? input.vaccination as Record<string, unknown> : {}
  const workflow = input.workflow && typeof input.workflow === 'object' ? input.workflow as Record<string, unknown> : {}
  const map = input.map && typeof input.map === 'object' ? input.map as Record<string, unknown> : {}
  const reporting = input.reporting && typeof input.reporting === 'object' ? input.reporting as Record<string, unknown> : {}
  const dataPolicy = input.dataPolicy && typeof input.dataPolicy === 'object' ? input.dataPolicy as Record<string, unknown> : {}
  return {
    shelters: Array.isArray(input.shelters) ? input.shelters.slice(0, 50).map((item) => {
      const shelter = item as Record<string, unknown>
      return { name: String(shelter.name || '').trim().slice(0, 160), address: String(shelter.address || '').trim().slice(0, 300), capacity: Math.max(0, Number.parseInt(String(shelter.capacity || 0), 10) || 0) }
    }).filter((item) => item.name) : DEFAULT_SETTINGS.shelters,
    speciesTypes: stringList(input.speciesTypes, DEFAULT_SETTINGS.speciesTypes),
    priorityLevels: stringList(input.priorityLevels, DEFAULT_SETTINGS.priorityLevels),
    captureStates: stringList(input.captureStates, DEFAULT_SETTINGS.captureStates),
    operational: {
      defaultPriority: String(operational.defaultPriority || DEFAULT_SETTINGS.operational.defaultPriority),
      responseTargetHours: Math.min(720, Math.max(1, Number(operational.responseTargetHours) || DEFAULT_SETTINGS.operational.responseTargetHours)),
      quarantineDays: Math.min(365, Math.max(0, Number(operational.quarantineDays) || DEFAULT_SETTINGS.operational.quarantineDays)),
      requireLocation: operational.requireLocation !== false,
      requirePhotoForClosure: operational.requirePhotoForClosure === true,
    },
    contacts: {
      responsibleName: String(contacts.responsibleName || '').trim().slice(0, 160), veterinaryService: String(contacts.veterinaryService || '').trim().slice(0, 200), emergencyPhone: String(contacts.emergencyPhone || '').trim().slice(0, 60), email: String(contacts.email || '').trim().slice(0, 160),
    },
    notifications: { urgentAlerts: notifications.urgentAlerts !== false, healthAlerts: notifications.healthAlerts !== false, missionReminders: notifications.missionReminders !== false },
    vaccination: { preferredVaccineType: String(vaccination.preferredVaccineType || DEFAULT_SETTINGS.vaccination.preferredVaccineType).slice(0, 80), preferredRoute: String(vaccination.preferredRoute || DEFAULT_SETTINGS.vaccination.preferredRoute).slice(0, 20), protocolReference: String(vaccination.protocolReference || DEFAULT_SETTINGS.vaccination.protocolReference).trim().slice(0, 240), requireMedicalValidation: vaccination.requireMedicalValidation !== false },
    workflow: { autoCreateUrgentMission: workflow.autoCreateUrgentMission === true, followUpAfterDays: Math.min(90, Math.max(0, Number(workflow.followUpAfterDays) || DEFAULT_SETTINGS.workflow.followUpAfterDays)), lockClosedRecords: workflow.lockClosedRecords !== false, allowStatusReopen: workflow.allowStatusReopen === true },
    map: { defaultZoom: Math.min(19, Math.max(5, Number(map.defaultZoom) || DEFAULT_SETTINGS.map.defaultZoom)), showBoundary: map.showBoundary !== false, showReports: map.showReports !== false, showMissions: map.showMissions !== false, showAnimals: map.showAnimals !== false, clusterPoints: map.clusterPoints !== false },
    reporting: { referencePrefix: String(reporting.referencePrefix || DEFAULT_SETTINGS.reporting.referencePrefix).trim().slice(0, 20), defaultFormat: ['PDF', 'CSV', 'JSON'].includes(String(reporting.defaultFormat)) ? String(reporting.defaultFormat) : DEFAULT_SETTINGS.reporting.defaultFormat, includeCoordinates: reporting.includeCoordinates !== false, includePhotos: reporting.includePhotos === true },
    dataPolicy: { retentionDays: Math.min(36500, Math.max(30, Number(dataPolicy.retentionDays) || DEFAULT_SETTINGS.dataPolicy.retentionDays)), maskPersonalContacts: dataPolicy.maskPersonalContacts === true, requireClosureNote: dataPolicy.requireClosureNote !== false },
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const communeParam = searchParams.get('commune')

    // For admins without a specific commune, return defaults
    let commune = communeParam
    if (!commune || commune === 'ALL') {
      const managed = user.managedCommunes?.length ? user.managedCommunes : (user.commune && user.commune !== 'ALL' ? [user.commune] : [])
      commune = managed[0] || ''
    }

    if (!commune) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS, commune: '' })
    }

    if (!canAccessCommune(user, commune)) return NextResponse.json({ error: 'ليست لديك صلاحية لهذه الجماعة' }, { status: 403 })
    const row = await db.csvrSettings.findUnique({ where: { commune } })
    const settings = sanitizeSettings({ ...DEFAULT_SETTINGS, ...(row ? parseStored(row.settings) : {}) })

    return NextResponse.json({ settings, commune })
  } catch (error) {
    console.error('GET csvr/settings error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الإعدادات' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { commune: bodyCommune, settings } = body

    const enforcedCommune = resolveRecordCommune(user, bodyCommune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    }

    const existing = await db.csvrSettings.findUnique({ where: { commune: enforcedCommune } })
    const merged = sanitizeSettings({ ...DEFAULT_SETTINGS, ...(existing ? parseStored(existing.settings) : {}), ...(settings || {}) })

    if (existing) {
      await db.csvrSettings.update({ where: { commune: enforcedCommune }, data: { settings: JSON.stringify(merged) } })
    } else {
      await db.csvrSettings.create({ data: { commune: enforcedCommune, settings: JSON.stringify(merged) } })
    }

    await recordActivity({ user, action: 'UPDATE', entityType: 'CSVR_SETTINGS', entityId: enforcedCommune, commune: enforcedCommune, details: { sections: Object.keys(settings || {}) } })

    return NextResponse.json({ settings: merged, commune: enforcedCommune })
  } catch (error) {
    console.error('PUT csvr/settings error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ الإعدادات' }, { status: 500 })
  }
}
