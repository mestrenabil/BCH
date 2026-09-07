import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import {
  clearLoginFailures,
  createSession,
  cleanupSessions,
  getLoginRetryAfterSeconds,
  needsPasswordRehash,
  recordLoginFailure,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_HOURS,
  normalizeManagedCommunes,
  verifyPassword,
  hashPassword,
} from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' }, { status: 400 })
    }

    const normalizedUsername = String(username).trim()
    const clientIp = request.headers.get('x-real-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rateLimitKey = `${clientIp}:${normalizedUsername.toLowerCase()}`
    const retryAfterSeconds = getLoginRetryAfterSeconds(rateLimitKey)

    if (retryAfterSeconds > 0) {
      return NextResponse.json(
        { error: 'تم تجاوز عدد محاولات الدخول. يرجى المحاولة لاحقاً.' },
        { status: 429, headers: { 'Retry-After': retryAfterSeconds.toString() } }
      )
    }

    const user = await db.user.findUnique({ where: { username: normalizedUsername }, include: { agent: true } })

    if (!user || !user.actif || (user.role === 'agent' && (!user.agentId || !user.agent?.actif))) {
      recordLoginFailure(rateLimitKey)
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

    if (!verifyPassword(password, user.password)) {
      recordLoginFailure(rateLimitKey)
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

    clearLoginFailures(rateLimitKey)

    if (needsPasswordRehash(user.password)) {
      await db.user.update({
        where: { id: user.id },
        data: { password: hashPassword(password) },
      })
    }

    // Clean up expired sessions
    await cleanupSessions()

    // Create session
    const token = await createSession(user.id)

    // Set cookie
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nom: user.nom,
        commune: user.commune,
        managedCommunes: normalizeManagedCommunes(user.managedCommunes),
        communeGroupName: user.communeGroupName,
        navVisibilityJson: user.navVisibilityJson || '{}',
        role: user.role,
        agentId: user.agentId,
      }
    })

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول' }, { status: 500 })
  }
}
