type RateLimitEntry = {
  count: number
  resetAt: number
}

const rateLimitEntries = new Map<string, RateLimitEntry>()

export function getClientIp(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()

  return headers.get('x-real-ip')?.trim() || 'unknown'
}

export function consumePublicRateLimit(key: string, limit: number, windowMs: number): {
  allowed: boolean
  retryAfterSeconds: number
} {
  const now = Date.now()
  const existing = rateLimitEntries.get(key)

  if (!existing || existing.resetAt <= now) {
    rateLimitEntries.set(key, { count: 1, resetAt: now + windowMs })
  } else {
    existing.count += 1
  }

  if (rateLimitEntries.size > 2000) {
    for (const [entryKey, entry] of rateLimitEntries) {
      if (entry.resetAt <= now) rateLimitEntries.delete(entryKey)
    }
  }

  const entry = rateLimitEntries.get(key)!
  return {
    allowed: entry.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  }
}
