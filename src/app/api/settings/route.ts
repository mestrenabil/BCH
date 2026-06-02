import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCommuneFilter } from '@/lib/auth'

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
}

// GET /api/settings — Return settings for the authenticated user's commune
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    // Determine which commune's settings to load
    const requestedCommune = new URL(request.url).searchParams.get('commune')
    const communeFilter = getCommuneFilter(user, requestedCommune)
    const targetCommune = communeFilter || user.commune

    // For admin with no specific filter, return all communes' settings
    if (user.commune === 'ALL' && !communeFilter) {
      const allSettings = await db.communeSettings.findMany()
      const result: Record<string, typeof DEFAULT_SETTINGS> = {}
      for (const cs of allSettings) {
        try {
          result[cs.commune] = { ...DEFAULT_SETTINGS, ...JSON.parse(cs.settings) }
        } catch {
          result[cs.commune] = { ...DEFAULT_SETTINGS }
        }
      }
      return NextResponse.json({ settings: result, commune: 'ALL' })
    }

    // Get specific commune settings
    const communeSettings = await db.communeSettings.findUnique({
      where: { commune: targetCommune }
    })

    let settings = { ...DEFAULT_SETTINGS }
    if (communeSettings) {
      try {
        settings = { ...DEFAULT_SETTINGS, ...JSON.parse(communeSettings.settings) }
      } catch {
        // Use defaults if parse fails
      }
    }

    // For non-admin users, force defaultCommune to their own commune
    if (user.commune !== 'ALL') {
      settings.defaultCommune = user.commune as typeof settings.defaultCommune
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
    const communeFilter = getCommuneFilter(user, requestedCommune)
    const targetCommune = communeFilter || user.commune

    // Non-admin users: force defaultCommune to their own commune
    if (user.commune !== 'ALL' && newSettings.defaultCommune) {
      newSettings.defaultCommune = user.commune
    }

    // Sanitize settings: only allow known keys
    const sanitized: Record<string, unknown> = {}
    const allowedKeys = Object.keys(DEFAULT_SETTINGS)
    for (const key of allowedKeys) {
      if (key in newSettings) {
        sanitized[key] = newSettings[key]
      }
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
    const communeFilter = getCommuneFilter(user, requestedCommune)
    const targetCommune = communeFilter || user.commune

    // Delete the commune's custom settings (will fall back to defaults)
    try {
      await db.communeSettings.delete({ where: { commune: targetCommune } })
    } catch {
      // Settings might not exist
    }

    const resetSettings = { ...DEFAULT_SETTINGS }
    if (user.commune !== 'ALL') {
      resetSettings.defaultCommune = user.commune as typeof resetSettings.defaultCommune
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
