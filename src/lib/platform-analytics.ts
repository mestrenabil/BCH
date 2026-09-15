import crypto from 'crypto'
import catalogJson from '../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'
import { getCommuneForPoint } from '@/lib/commune-boundaries'

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
  return headers.get('cf-connecting-ip')
    || headers.get('x-real-ip')
    || headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

function finiteCoordinate(value: string | null): number | null {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * يحدد جماعة الزائر من البيانات التي يضيفها CDN إلى الطلب.
 * المعالجة محلية ولا يُرسل عنوان IP إلى أي طرف ثالث.
 */
export async function resolvePublicVisitorCommune(headers: Headers, suppliedCommune: unknown): Promise<string> {
  const supplied = normalizeAnalyticsCommune(suppliedCommune)
  if (supplied) return supplied

  const country = (headers.get('cf-ipcountry') || headers.get('x-vercel-ip-country') || '').toUpperCase()
  if (country && !['MA', 'XX', 'T1'].includes(country)) return 'خارج المغرب'

  if (country === 'MA') {
    const latitude = finiteCoordinate(headers.get('cf-iplatitude') || headers.get('x-vercel-ip-latitude'))
    const longitude = finiteCoordinate(headers.get('cf-iplongitude') || headers.get('x-vercel-ip-longitude'))
    if (latitude !== null && longitude !== null) {
      const match = await getCommuneForPoint(latitude, longitude)
      const commune = normalizeAnalyticsCommune(match?.commune)
      if (commune) return commune
    }

    const city = normalizeAnalyticsCommune(headers.get('cf-ipcity') || headers.get('x-vercel-ip-city'))
    return city || 'المغرب — تعذر تحديد الجماعة'
  }

  return 'تعذر تحديد الموقع'
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
