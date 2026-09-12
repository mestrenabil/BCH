import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAuthUser } from '@/lib/auth'
import { consumePublicRateLimit } from '@/lib/public-rate-limit'
import {
  detectAnalyticsDevice,
  getAnalyticsClientIp,
  hashAnalyticsIdentifier,
  normalizeAnalyticsCommune,
  sanitizeAnalyticsPath,
  sanitizeReferrer,
} from '@/lib/platform-analytics'

const DEDUPLICATION_WINDOW_MS = 30 * 60 * 1000

export async function POST(request: NextRequest) {
  try {
    const clientIp = getAnalyticsClientIp(request.headers)
    const limit = consumePublicRateLimit(`platform-analytics:${clientIp}`, 120, 15 * 60 * 1000)
    if (!limit.allowed) {
      return NextResponse.json({ recorded: false }, { status: 202 })
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    const path = sanitizeAnalyticsPath(body.path)
    const user = await getAuthUser()
    const rawVisitorId = typeof body.visitorId === 'string' && /^[a-zA-Z0-9-]{8,128}$/.test(body.visitorId)
      ? body.visitorId
      : clientIp
    const visitorHash = hashAnalyticsIdentifier(rawVisitorId)
    const kind = user
      ? 'PLATFORM'
      : path === '/'
        ? 'PUBLIC_SITE'
        : path.startsWith('/signaler')
          ? 'REPORT_PAGE'
          : 'PUBLIC_SITE'
    const commune = user
      ? (user.commune === 'ALL' ? 'الإدارة العامة' : user.commune)
      : normalizeAnalyticsCommune(body.commune)
    const now = new Date()
    const recent = await db.platformVisit.findFirst({
      where: {
        visitorHash,
        kind,
        path,
        lastSeenAt: { gte: new Date(now.getTime() - DEDUPLICATION_WINDOW_MS) },
      },
      orderBy: { createdAt: 'desc' },
    })

    if (recent) {
      await db.platformVisit.update({
        where: { id: recent.id },
        data: {
          lastSeenAt: now,
          ...(commune && recent.commune !== commune ? { commune } : {}),
        },
      })
      return NextResponse.json({ recorded: false }, { status: 202 })
    }

    await db.platformVisit.create({
      data: {
        kind,
        path,
        visitorHash,
        sessionHash: hashAnalyticsIdentifier(`${visitorHash}:${Math.floor(now.getTime() / DEDUPLICATION_WINDOW_MS)}`),
        userId: user?.id,
        userName: user?.nom || '',
        userRole: user?.role || '',
        commune,
        device: detectAnalyticsDevice(request.headers.get('user-agent') || ''),
        referrer: sanitizeReferrer(body.referrer),
        lastSeenAt: now,
      },
    })

    return NextResponse.json({ recorded: true }, { status: 201 })
  } catch (error) {
    console.error('Platform analytics tracking error:', error)
    // فشل الإحصائيات لا يجب أن يعطل استعمال المنصة.
    return NextResponse.json({ recorded: false }, { status: 202 })
  }
}
