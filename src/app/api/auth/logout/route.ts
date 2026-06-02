import { NextResponse } from 'next/server'
import { deleteSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (token) {
      await deleteSession(token)
    }

    const response = NextResponse.json({ success: true })
    response.cookies.set(SESSION_COOKIE_NAME, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل الخروج' }, { status: 500 })
  }
}
