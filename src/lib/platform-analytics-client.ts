'use client'

const VISITOR_KEY = 'bch-analytics-visitor-v1'
const HEARTBEAT_INTERVAL_MS = 60_000
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let currentVisit: { path: string; commune: string } | null = null

function visitorId(): string {
  try {
    const existing = window.localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const created = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(VISITOR_KEY, created)
    return created
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}

function sendVisit(path: string, commune: string): void {
  void fetch('/api/platform-analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    body: JSON.stringify({
      path,
      commune,
      visitorId: visitorId(),
      referrer: document.referrer,
    }),
  }).catch(() => undefined)
}

export function trackPlatformVisit(path: string, commune = ''): void {
  if (typeof window === 'undefined') return
  currentVisit = { path, commune }
  sendVisit(path, commune)

  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (document.visibilityState === 'visible' && currentVisit) {
        sendVisit(currentVisit.path, currentVisit.commune)
      }
    }, HEARTBEAT_INTERVAL_MS)
  }
}
