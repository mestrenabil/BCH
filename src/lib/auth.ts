import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const SESSION_COOKIE_NAME = '3d_session_token'
const SESSION_DURATION_HOURS = 24

export interface AuthUser {
  id: string
  username: string
  nom: string
  commune: string
  role: string
}

// Hash password using SHA-256 (simple approach for SQLite setup)
export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// Verify password
export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
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
      include: { user: true }
    })

    if (!session || !session.user || !session.user.actif) return null
    if (session.expiresAt < new Date()) {
      await db.session.delete({ where: { token } })
      return null
    }

    return {
      id: session.user.id,
      username: session.user.username,
      nom: session.user.nom,
      commune: session.user.commune,
      role: session.user.role,
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
export async function requireAuth(): Promise<{ user: AuthUser } | { error: NextResponse }> {
  const user = await getAuthUser()
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'يرجى تسجيل الدخول أولاً' },
        { status: 401 }
      )
    }
  }
  return { user }
}

/**
 * Get the commune filter for the authenticated user.
 * - Admin users (commune='ALL') can see all communes — returns null (no filter)
 * - Responsible users can only see their own commune — returns their commune name
 * This also respects an optional requestedCommune parameter:
 * - Admin can request any commune or 'ALL'
 * - Non-admin users are always restricted to their own commune regardless of request
 */
export function getCommuneFilter(user: AuthUser, requestedCommune?: string | null): string | null {
  // Non-admin users are always restricted to their own commune
  if (user.commune !== 'ALL') {
    return user.commune
  }
  // Admin users: respect the requested filter if provided
  if (requestedCommune && requestedCommune !== 'ALL') {
    return requestedCommune
  }
  // Admin with no specific filter — see all
  return null
}

export { SESSION_COOKIE_NAME, SESSION_DURATION_HOURS }
