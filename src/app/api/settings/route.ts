import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getManagedCommunes, requireAuth, type AuthUser } from '@/lib/auth'

// Default settings values (same as frontend DEFAULT_SETTINGS)
const DEFAULT_SETTINGS = {
  animationsEnabled: true,
  mapClickEnabled: true,
  showCommunePopups: false,
  mapDefaultTile: 'light',
  mapClusterRadius: 50,
  defaultCommune: 'ALL',
  defaultYear: new Date().getFullYear().toString(),
  interventionsPerPage: 50,
  stockAlertEnabled: true,
  stockAlertThreshold: 10,
  deadlineReminderEnabled: true,
  deadlineReminderDays: 3,
  fontSize: 'medium',
  compactMode: false,
  navVisibility: {
    dashboard: true, map: true, interventions: true, agents: true, inventory: true, documents: true, calendar: true,
    complaints: true, workOrders: true, campagnes: true, csvr: true, food: true, dossiers: true, sanitary: true,
    water: true, vector: true, funeral: true, environment: true, vigilance: true, authorizations: true, gis: true,
    reportsOffice: true, calendarUnified: true, reports: true, operations: true, kpi: true, alerts: true, export: true,
    notifications: true, activityLog: true, timeline: true, users: true, settings: true, helpCenter: true,
  },
  navOrder: ['dashboard', 'map', 'interventions', 'agents', 'inventory', 'documents', 'calendar', 'complaints', 'workOrders', 'campagnes', 'csvr', 'food', 'dossiers', 'sanitary', 'water', 'vector', 'funeral', 'environment', 'vigilance', 'authorizations', 'gis', 'reportsOffice', 'calendarUnified', 'reports', 'operations', 'kpi', 'alerts', 'export', 'notifications', 'activityLog', 'timeline', 'users', 'settings', 'helpCenter'],
  sanitary: {
    operational: { defaultPriority: 'NORMALE', responseTargetHours: 48, requireLocation: true, requireEvidenceForClosure: true },
    notifications: { urgentAlerts: true, inspectionReminders: true, sampleReminders: true, expiryReminders: true },
    map: { defaultZoom: 13, showBoundary: true, showEstablishments: true, showInspections: true, showHealthCards: true, showSamples: true },
    reporting: { referencePrefix: 'SAN', defaultFormat: 'PDF', includeCoordinates: true, includeRiskSummary: true },
    workflow: { autoCreateInspection: false, lockClosedRecords: true, requireClosureNote: true },
  },
  // Overlay section visibility
  overlaySectionVisibility: {
    location: true, details: true, timeDetails: true, costs: true, product: true,
    materials: true, description: true, observations: true, documents: true, photos: true,
    coordinates: false, systemInfo: false, quickActions: false, progressIndicator: false,
  },
  // Print / Document settings
  presidentName: '',
  responsableName: '',
  chefServiceName: '',
  communeNameFr: '',
  communeNameAr: '',
  communeAddress: '',
  communePhone: '',
  communeFax: '',
  communeEmail: '',
  communeLogo: '',
  showWatermark: false,
  watermarkText: 'BCH',
  documentFooter: '',
}

function resolveSettingsCommune(user: AuthUser, requestedCommune?: string | null): string | null {
  if (user.role === 'admin') {
    return requestedCommune || 'ALL'
  }

  const managedCommunes = getManagedCommunes(user)
  if (requestedCommune && requestedCommune !== 'ALL') {
    return managedCommunes.includes(requestedCommune) ? requestedCommune : null
  }

  return managedCommunes[0] || null
}

// GET /api/settings — Return settings for the authenticated user's commune
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    // Determine which commune's settings to load
    const requestedCommune = new URL(request.url).searchParams.get('commune')
    const targetCommune = resolveSettingsCommune(user, requestedCommune)

    if (!targetCommune) {
      return NextResponse.json({ error: 'الجماعة المطلوبة خارج نطاق الحساب' }, { status: 403 })
    }

    // Load the selected commune settings and the shared settings separately.
    // The ALL record is the common baseline for every commune account.
    const [communeSettings, sharedSettings] = await Promise.all([
      db.communeSettings.findUnique({ where: { commune: targetCommune } }),
      user.role === 'admin' || targetCommune === 'ALL'
        ? Promise.resolve(null)
        : db.communeSettings.findUnique({ where: { commune: 'ALL' } }),
    ])

    const parseSettings = (value: string | null | undefined): Record<string, unknown> => {
      if (!value) return {}
      try {
        const parsed = JSON.parse(value)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
      } catch {
        return {}
      }
    }

    const shared = parseSettings(sharedSettings?.settings)
    const local = parseSettings(communeSettings?.settings)
    const sharedNavVisibility = (shared.navVisibility && typeof shared.navVisibility === 'object' && !Array.isArray(shared.navVisibility))
      ? shared.navVisibility as Record<string, unknown>
      : {}
    const localNavVisibility = (local.navVisibility && typeof local.navVisibility === 'object' && !Array.isArray(local.navVisibility))
      ? local.navVisibility as Record<string, unknown>
      : {}

    let settings = {
      ...DEFAULT_SETTINGS,
      ...shared,
      ...local,
    }

    if (user.role !== 'admin' && targetCommune !== 'ALL') {
      // Shared settings can restrict every commune account. A local setting
      // may add another restriction, but cannot reopen a globally hidden section.
      settings.navVisibility = Object.fromEntries(
        Object.keys(DEFAULT_SETTINGS.navVisibility).map((key) => [
          key,
          sharedNavVisibility[key] !== false && localNavVisibility[key] !== false,
        ])
      ) as typeof DEFAULT_SETTINGS.navVisibility
    }

    // For non-admin users, force defaultCommune to their own commune
    if (user.role !== 'admin') {
      settings.defaultCommune = targetCommune as typeof settings.defaultCommune
    }

    return NextResponse.json({ settings, commune: targetCommune })
  } catch (error) {
    console.error('GET settings error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الإعدادات' }, { status: 500 })
  }
}

// PUT /api/settings — Save settings for the authenticated user's commune
export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { commune: bodyCommune, settings: newSettings } = body

    // Determine which commune's settings to update
    const requestedCommune = bodyCommune || undefined
    const targetCommune = resolveSettingsCommune(user, requestedCommune)
    if (!targetCommune) {
      return NextResponse.json({ error: 'الجماعة المطلوبة خارج نطاق الحساب' }, { status: 403 })
    }

    const existingCommuneSettings = await db.communeSettings.findUnique({
      where: { commune: targetCommune },
    })

    let existingSettings: Record<string, unknown> = {}
    if (existingCommuneSettings) {
      try {
        existingSettings = JSON.parse(existingCommuneSettings.settings || '{}')
      } catch {
        existingSettings = {}
      }
    }

    // Non-admin users: force defaultCommune to their own commune
    if (user.role !== 'admin' && newSettings.defaultCommune) {
      newSettings.defaultCommune = targetCommune
    }

    // Sanitize settings: only allow known keys
    const sanitized: Record<string, unknown> = {}
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    for (const key of allowedKeys) {
      if (key in newSettings) {
        sanitized[key] = newSettings[key]
      }
    }

    // Only the general administrator can control section visibility and order.
    if (user.role !== 'admin') {
      sanitized.navVisibility = existingSettings.navVisibility ?? DEFAULT_SETTINGS.navVisibility
      sanitized.navOrder = existingSettings.navOrder ?? DEFAULT_SETTINGS.navOrder
    }

    // Upsert settings
    const saved = await db.communeSettings.upsert({
      where: { commune: targetCommune },
      update: { settings: JSON.stringify(sanitized) },
      create: { commune: targetCommune, settings: JSON.stringify(sanitized) },
    })

    return NextResponse.json({
      success: true,
      settings: { ...DEFAULT_SETTINGS, ...sanitized },
      commune: targetCommune,
    })
  } catch (error) {
    console.error('PUT settings error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حفظ الإعدادات' }, { status: 500 })
  }
}

// POST /api/settings — Reset settings for a commune to defaults
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const requestedCommune = body.commune || undefined
    const targetCommune = resolveSettingsCommune(user, requestedCommune)
    if (!targetCommune) {
      return NextResponse.json({ error: 'الجماعة المطلوبة خارج نطاق الحساب' }, { status: 403 })
    }

    // Delete the commune's custom settings (will fall back to defaults)
    try {
      await db.communeSettings.delete({ where: { commune: targetCommune } })
    } catch {
      // Settings might not exist
    }

    const resetSettings = { ...DEFAULT_SETTINGS }
    if (user.role !== 'admin') {
      resetSettings.defaultCommune = targetCommune as typeof resetSettings.defaultCommune
    }

    return NextResponse.json({
      success: true,
      settings: resetSettings,
      commune: targetCommune,
    })
  } catch (error) {
    console.error('POST settings reset error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إعادة ضبط الإعدادات' }, { status: 500 })
  }
}
