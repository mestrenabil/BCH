import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSession, cleanupSessions, SESSION_COOKIE_NAME, SESSION_DURATION_HOURS } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'يرجى إدخال اسم المستخدم وكلمة المرور' }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { username } })

    if (!user || !user.actif) {
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

    if (!verifyPassword(password, user.password)) {
      return NextResponse.json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, { status: 401 })
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
        role: user.role,
      }
    })

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION_HOURS * 60 * 60,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الدخول' }, { status: 500 })
  }
}
