import crypto from 'crypto'
import catalogJson from '../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'

const catalog = catalogJson as TerritoryCatalog
const communeNames = new Map<string, string>()

for (const commune of catalog.communes) {
  const canonical = commune.nameAr || commune.name || commune.nameFr
  for (const value of [commune.nameAr, commune.name, commune.nameFr]) {
    if (value) communeNames.set(value.trim(), canonical)
  }
}

export function normalizeAnalyticsCommune(value: unknown): string {
  if (typeof value !== 'string') return ''
  const normalized = value.trim()
  if (!normalized || normalized === 'ALL') return ''
  return communeNames.get(normalized) || ''
}

export function getAnalyticsClientIp(headers: Headers): string {
  return headers.get('x-real-ip')
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

export function hashAnalyticsIdentifier(value: string): string {
  const salt = process.env.ANALYTICS_HASH_SALT || process.env.SESSION_SECRET || 'bch-local-analytics'
  return crypto.createHmac('sha256', salt).update(value).digest('hex')
}

export function detectAnalyticsDevice(userAgent: string): string {
  if (!userAgent) return 'UNKNOWN'
  if (/bot|crawler|spider|slurp|headless/i.test(userAgent)) return 'BOT'
  if (/ipad|tablet|kindle|silk/i.test(userAgent)) return 'TABLET'
  if (/mobile|iphone|ipod|android/i.test(userAgent)) return 'MOBILE'
  return 'DESKTOP'
}

export function sanitizeAnalyticsPath(value: unknown): string {
  if (typeof value !== 'string') return '/'
  const path = value.trim().split('?')[0]
  if (!path.startsWith('/') || path.length > 160 || /[\x00-\x1f]/.test(path)) return '/'
  return path
}

export function sanitizeReferrer(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const url = new URL(value)
    return url.hostname.slice(0, 120)
  } catch {
    return ''
  }
}
