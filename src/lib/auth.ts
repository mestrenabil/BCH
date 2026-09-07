import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCommuneScope, getTerritoryFilterFromSearchParams, type CommuneScope } from '@/lib/territory-scope'

const SESSION_COOKIE_NAME = '3d_session_token'
const SESSION_DURATION_HOURS = 24
const PASSWORD_HASH_ALGORITHM = 'scrypt'
const PASSWORD_HASH_KEY_LENGTH = 64
const LOGIN_ATTEMPT_WINDOW_MS = 15 * 60 * 1000
const MAX_LOGIN_ATTEMPTS = 5

type LoginAttempt = {
  count: number
  expiresAt: number
}

const loginAttempts = new Map<string, LoginAttempt>()

export interface AuthUser {
  id: string
  username: string
  nom: string
  commune: string
  managedCommunes: string[]
  communeGroupName: string | null
  navVisibilityJson: string
  role: string
  agentId: string | null
}

export function normalizeManagedCommunes(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '[]') : value
    if (!Array.isArray(parsed)) return []
    return [...new Set(parsed.filter((commune): commune is string => typeof commune === 'string' && Boolean(commune.trim()) && commune !== 'ALL').map((commune) => commune.trim()))]
  } catch {
    return []
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH).toString('hex')
  return `${PASSWORD_HASH_ALGORITHM}$${salt}$${derivedKey}`
}

export function verifyPassword(password: string, hash: string): boolean {
  const [algorithm, salt, storedKey] = hash.split('$')

  if (algorithm === PASSWORD_HASH_ALGORITHM && salt && storedKey) {
    try {
      const derivedKey = crypto.scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH)
      const expectedKey = Buffer.from(storedKey, 'hex')
      return expectedKey.length === derivedKey.length && crypto.timingSafeEqual(expectedKey, derivedKey)
    } catch {
      return false
    }
  }

  const legacyHash = crypto.createHash('sha256').update(password).digest('hex')
  const expectedHash = Buffer.from(hash, 'hex')
  const providedHash = Buffer.from(legacyHash, 'hex')
  return expectedHash.length === providedHash.length && crypto.timingSafeEqual(expectedHash, providedHash)
}

export function needsPasswordRehash(hash: string): boolean {
  return !hash.startsWith(`${PASSWORD_HASH_ALGORITHM}$`)
}

export function getLoginRetryAfterSeconds(key: string): number {
  const attempt = loginAttempts.get(key)
  if (!attempt) return 0

  if (attempt.expiresAt <= Date.now()) {
    loginAttempts.delete(key)
    return 0
  }

  if (attempt.count < MAX_LOGIN_ATTEMPTS) return 0
  return Math.ceil((attempt.expiresAt - Date.now()) / 1000)
}

export function recordLoginFailure(key: string): void {
  const now = Date.now()
  const existing = loginAttempts.get(key)
  const activeAttempt = existing && existing.expiresAt > now ? existing : undefined

  loginAttempts.set(key, {
    count: (activeAttempt?.count ?? 0) + 1,
    expiresAt: now + LOGIN_ATTEMPT_WINDOW_MS,
  })

  if (loginAttempts.size > 1000) {
    for (const [attemptKey, attempt] of loginAttempts) {
      if (attempt.expiresAt <= now) loginAttempts.delete(attemptKey)
    }
  }
}

export function clearLoginFailures(key: string): void {
  loginAttempts.delete(key)
}

// Generate session token
export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Create a new session
export async function createSession(userId: string): Promise<string> {
  const token = generateToken()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000)

  await db.session.create({
    data: { token, userId, expiresAt }
  })

  // Update last login
  await db.user.update({
    where: { id: userId },
    data: { lastLogin: new Date() }
  })

  return token
}

// Get current authenticated user from request
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (!token) return null

    const session = await db.session.findUnique({
      where: { token },
      include: { user: { include: { agent: true } } }
    })

    if (!session || !session.user || !session.user.actif) return null
    if (session.user.role === 'agent' && (!session.user.agentId || !session.user.agent?.actif)) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { token } })
      return null
    }

    return {
      id: session.user.id,
      username: session.user.username,
      nom: session.user.nom,
      commune: session.user.commune,
      managedCommunes: normalizeManagedCommunes(session.user.managedCommunes),
      communeGroupName: session.user.communeGroupName,
      navVisibilityJson: session.user.navVisibilityJson || '{}',
      role: session.user.role,
      agentId: session.user.agentId,
    }
  } catch {
    return null
  }
}

// Delete session
export async function deleteSession(token: string): Promise<void> {
  try {
    await db.session.delete({ where: { token } })
  } catch {
    // Session might not exist
  }
}

// Clean up expired sessions
export async function cleanupSessions(): Promise<void> {
  try {
    await db.session.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    })
  } catch {
    // Ignore errors
  }
}

/**
 * Require authentication for API routes.
 * Returns the authenticated user or a 401 NextResponse.
 * Use this in API route handlers to enforce login.
 */
export async function requireAuth(options: { allowFieldAgent?: boolean } = {}): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const user = await getAuthUser()
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
  }
  if (user.role === 'agent' && !options.allowFieldAgent) {
    return {
      error: NextResponse.json(
        { error: 'حساب العون الميداني مخصص للتطبيق الميداني فقط' },
        { status: 403 }
      )
    }
  }
  return { user }
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin'
}

export function isFieldAgent(user: AuthUser): boolean {
  return user.role === 'agent'
}

export function canAccessCommune(user: AuthUser, commune: string): boolean {
  return isAdmin(user) || commune === '' || commune === 'ALL' || getManagedCommunes(user).includes(commune)
}

export function getManagedCommunes(user: AuthUser): string[] {
  if (user.managedCommunes.length > 0) return user.managedCommunes
  return user.commune !== 'ALL' ? [user.commune] : []
}

export function isCommuneGroupAccount(user: AuthUser): boolean {
  return getManagedCommunes(user).length > 1
}

export function resolveRecordCommune(user: AuthUser, requestedCommune?: unknown): string {
  const managedCommunes = getManagedCommunes(user)
  if (managedCommunes.length === 1) return managedCommunes[0]
  if (managedCommunes.length > 1) {
    if (typeof requestedCommune !== 'string') return ''
    const commune = requestedCommune.trim()
    return managedCommunes.includes(commune) ? commune : ''
  }
  if (typeof requestedCommune !== 'string') return ''

  const commune = requestedCommune.trim()
  return commune === 'ALL' ? '' : commune
}

export async function requireAdmin(): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult

  if (!isAdmin(authResult.user)) {
    return {
      error: NextResponse.json(
        { error: 'هذه العملية متاحة للمسؤول العام فقط' },
        { status: 403 }
      )
    }
  }

  return authResult
}

/**
 * Get the commune filter for the authenticated user.
 * - Admin users (commune='ALL') can see all communes — returns null (no filter)
 * - Responsible users can only see their own commune — returns their commune name
 * This also respects an optional requestedCommune parameter:
 * - Admin can request any commune or 'ALL'
 * - Non-admin users are always restricted to their own commune regardless of request
 */
export function getCommuneFilter(user: AuthUser, requestedCommune?: string | null): CommuneScope {
  if (!isAdmin(user)) {
    const managedCommunes = getManagedCommunes(user)
    if (requestedCommune && requestedCommune !== 'ALL') {
      return managedCommunes.includes(requestedCommune) ? requestedCommune : { in: [] }
    }
    return managedCommunes.length === 1 ? managedCommunes[0] || { in: [] } : { in: managedCommunes }
  }
  if (requestedCommune && requestedCommune !== 'ALL') {
    return requestedCommune
  }
  return null
}

export function getScopedCommuneFilter(user: AuthUser, searchParams: URLSearchParams): CommuneScope {
  if (!isAdmin(user) || user.commune !== 'ALL') return getCommuneFilter(user, searchParams.get('commune'))

  const territorialScope = getCommuneScope(getTerritoryFilterFromSearchParams(searchParams))
  if (territorialScope) return territorialScope

  return getCommuneFilter(user, searchParams.get('commune'))
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_HOURS }
