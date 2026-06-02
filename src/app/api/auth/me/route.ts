import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getAuthUser()

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 })
    }

    return NextResponse.json({
      authenticated: true,
      user,
    })
  } catch (error) {
    console.error('Auth check error:', error)
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }
}
