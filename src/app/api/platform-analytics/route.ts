import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

const VALID_PERIODS = new Set([1, 7, 30, 90, 365])
const PAGE_VIEW_KINDS = new Set(['PUBLIC_SITE', 'REPORT_PAGE', 'PLATFORM'])
const ANALYTICS_TIME_ZONE = 'Africa/Casablanca'

function dateParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value || 0)
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
  }
}

function timeZoneOffset(date: Date, timeZone: string): number {
  const parts = dateParts(date, timeZone)
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime()
}

function startOfAnalyticsDay(now: Date, offsetDays = 0): Date {
  const local = dateParts(now, ANALYTICS_TIME_ZONE)
  const nominalUtc = Date.UTC(local.year, local.month - 1, local.day + offsetDays)
  let result = new Date(nominalUtc)
  result = new Date(nominalUtc - timeZoneOffset(result, ANALYTICS_TIME_ZONE))
  result = new Date(nominalUtc - timeZoneOffset(result, ANALYTICS_TIME_ZONE))
  return result
}

function dayKey(date: Date): string {
  const parts = dateParts(date, ANALYTICS_TIME_ZONE)
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`
}

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  try {
    const requestedDays = Number(request.nextUrl.searchParams.get('days') || 30)
    const days = VALID_PERIODS.has(requestedDays) ? requestedDays : 30
    const now = new Date()
    const from = startOfAnalyticsDay(now, -days + 1)
    const previousFrom = startOfAnalyticsDay(now, -days * 2 + 1)

    const [events, previousVisits, users, publicReportCounts] = await Promise.all([
      db.platformVisit.findMany({
        where: { createdAt: { gte: from } },
        select: {
          kind: true, path: true, visitorHash: true, userId: true, userName: true,
          userRole: true, commune: true, device: true, referrer: true, createdAt: true, lastSeenAt: true,
        },
        orderBy: { createdAt: 'asc' },
        take: 100_000,
      }),
      db.platformVisit.count({
        where: {
          kind: { in: [...PAGE_VIEW_KINDS] },
          createdAt: { gte: previousFrom, lt: from },
        },
      }),
      db.user.findMany({
        where: { role: { in: ['admin', 'responsable'] } },
        select: {
          id: true, username: true, nom: true, role: true, commune: true,
          managedCommunes: true, actif: true, lastLogin: true,
        },
      }),
      Promise.all([
        db.complaint.count({ where: { source: 'PUBLIC', dateReception: { gte: from } } }),
        db.foodReport.count({ where: { source: 'PUBLIC', createdAt: { gte: from } } }),
        db.strayReport.count({ where: { source: 'PUBLIC', createdAt: { gte: from } } }),
      ]),
    ])

    const pageViews = events.filter((event) => PAGE_VIEW_KINDS.has(event.kind))
    const uniqueVisitors = new Set(pageViews.map((event) => event.visitorHash)).size
    const currentVisits = pageViews.length
    const changePercent = previousVisits === 0
      ? (currentVisits > 0 ? 100 : 0)
      : Math.round(((currentVisits - previousVisits) / previousVisits) * 100)

    const dailyMap = new Map<string, { publicSite: number; reports: number; platform: number }>()
    for (let index = 0; index < days; index += 1) {
      const date = startOfAnalyticsDay(now, index - days + 1)
      dailyMap.set(dayKey(date), { publicSite: 0, reports: 0, platform: 0 })
    }

    const communeMap = new Map<string, { visits: number; visitors: Set<string> }>()
    const pageMap = new Map<string, { visits: number; visitors: Set<string> }>()
    const deviceMap = new Map<string, number>()
    const referrerMap = new Map<string, number>()
    const userMap = new Map<string, { platformVisits: number; logins: number; lastSeen: Date | null }>()

    for (const event of events) {
      if (event.userId) {
        const current = userMap.get(event.userId) || { platformVisits: 0, logins: 0, lastSeen: null }
        if (event.kind === 'PLATFORM') current.platformVisits += 1
        if (event.kind === 'LOGIN') current.logins += 1
        if (!current.lastSeen || event.lastSeenAt > current.lastSeen) current.lastSeen = event.lastSeenAt
        userMap.set(event.userId, current)
      }

      if (!PAGE_VIEW_KINDS.has(event.kind)) continue
      const daily = dailyMap.get(dayKey(event.createdAt))
      if (daily) {
        if (event.kind === 'PUBLIC_SITE') daily.publicSite += 1
        if (event.kind === 'REPORT_PAGE') daily.reports += 1
        if (event.kind === 'PLATFORM') daily.platform += 1
      }

      // السجلات القديمة التي لا تتوفر على جماعة تبقى في الإجمالي ولا تظهر في ترتيب الجماعات.
      if (event.commune) {
        const communeEntry = communeMap.get(event.commune) || { visits: 0, visitors: new Set<string>() }
        communeEntry.visits += 1
        communeEntry.visitors.add(event.visitorHash)
        communeMap.set(event.commune, communeEntry)
      }

      const pageEntry = pageMap.get(event.path) || { visits: 0, visitors: new Set<string>() }
      pageEntry.visits += 1
      pageEntry.visitors.add(event.visitorHash)
      pageMap.set(event.path, pageEntry)
      deviceMap.set(event.device, (deviceMap.get(event.device) || 0) + 1)
      if (event.referrer) referrerMap.set(event.referrer, (referrerMap.get(event.referrer) || 0) + 1)
    }

    const onlineThreshold = new Date(now.getTime() - 5 * 60 * 1000)
    const onlineNow = new Set(events
      .filter((event) => event.kind === 'PLATFORM' && event.userId && event.lastSeenAt >= onlineThreshold)
      .map((event) => event.userId)).size
    const liveVisitors = new Set(events
      .filter((event) => PAGE_VIEW_KINDS.has(event.kind) && event.lastSeenAt >= onlineThreshold)
      .map((event) => event.visitorHash)).size
    const livePublicVisitors = new Set(events
      .filter((event) => ['PUBLIC_SITE', 'REPORT_PAGE'].includes(event.kind) && event.lastSeenAt >= onlineThreshold)
      .map((event) => event.visitorHash)).size
    const completedPublicReports = publicReportCounts.reduce((sum, count) => sum + count, 0)
    const reportVisits = pageViews.filter((event) => event.kind === 'REPORT_PAGE').length
    const publicSiteVisits = pageViews.filter((event) => event.kind === 'PUBLIC_SITE').length
    const reportEntryVisits = reportVisits + publicSiteVisits
    const inactiveThreshold = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const inactiveAccounts = users.filter((user) => !user.lastLogin || user.lastLogin < inactiveThreshold).length

    return NextResponse.json({
      periodDays: days,
      generatedAt: now.toISOString(),
      summary: {
        totalVisits: currentVisits,
        uniqueVisitors,
        publicSiteVisits,
        reportVisits,
        completedPublicReports,
        reportConversionRate: reportEntryVisits ? Math.round((completedPublicReports / reportEntryVisits) * 1000) / 10 : 0,
        platformVisits: pageViews.filter((event) => event.kind === 'PLATFORM').length,
        loginEvents: events.filter((event) => event.kind === 'LOGIN').length,
        onlineNow,
        liveVisitors,
        livePublicVisitors,
        inactiveAccounts,
        changePercent,
      },
      daily: [...dailyMap.entries()].map(([date, values]) => ({ date, ...values })),
      communes: [...communeMap.entries()]
        .map(([commune, value]) => ({ commune, visits: value.visits, visitors: value.visitors.size }))
        .sort((a, b) => b.visits - a.visits),
      pages: [...pageMap.entries()]
        .map(([path, value]) => ({ path, visits: value.visits, visitors: value.visitors.size }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 5),
      devices: [...deviceMap.entries()]
        .map(([device, visits]) => ({ device, visits }))
        .sort((a, b) => b.visits - a.visits),
      referrers: [...referrerMap.entries()]
        .map(([source, visits]) => ({ source, visits }))
        .sort((a, b) => b.visits - a.visits)
        .slice(0, 8),
      users: users.map((user) => {
        const metrics = userMap.get(user.id) || { platformVisits: 0, logins: 0, lastSeen: null }
        return { ...user, ...metrics }
      }).sort((a, b) => b.logins - a.logins || b.platformVisits - a.platformVisits),
    })
  } catch (error) {
    console.error('Platform analytics report error:', error)
    return NextResponse.json({ error: 'تعذر تحميل إحصائيات المنصة' }, { status: 500 })
  }
}
