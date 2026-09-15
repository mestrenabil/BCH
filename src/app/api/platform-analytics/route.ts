import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

const VALID_PERIODS = new Set([7, 30, 90, 365])
const PAGE_VIEW_KINDS = new Set(['PUBLIC_SITE', 'REPORT_PAGE', 'PLATFORM'])

const dayKey = (date: Date) => date.toISOString().slice(0, 10)

export async function GET(request: NextRequest) {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  try {
    const requestedDays = Number(request.nextUrl.searchParams.get('days') || 30)
    const days = VALID_PERIODS.has(requestedDays) ? requestedDays : 30
    const now = new Date()
    const from = new Date(now)
    from.setUTCHours(0, 0, 0, 0)
    from.setUTCDate(from.getUTCDate() - days + 1)
    const previousFrom = new Date(from)
    previousFrom.setUTCDate(previousFrom.getUTCDate() - days)

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
      const date = new Date(from)
      date.setUTCDate(from.getUTCDate() + index)
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

      const commune = event.commune || 'سجل قديم — الموقع غير متوفر'
      const communeEntry = communeMap.get(commune) || { visits: 0, visitors: new Set<string>() }
      communeEntry.visits += 1
      communeEntry.visitors.add(event.visitorHash)
      communeMap.set(commune, communeEntry)

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
