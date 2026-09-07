import crypto from 'crypto'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, requireAdmin } from '@/lib/auth'

function hasValidSetupToken(request: NextRequest, expectedToken: string): boolean {
  const providedToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!providedToken) return false

  const providedBuffer = Buffer.from(providedToken)
  const expectedBuffer = Buffer.from(expectedToken)
  return providedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(providedBuffer, expectedBuffer)
}

export async function POST(request: NextRequest) {
  try {
    const userCount = await db.user.count()

    if (userCount > 0) {
      const authResult = await requireAdmin()
      if ('error' in authResult) return authResult.error
      return NextResponse.json({ message: 'تم إعداد المستخدمين مسبقاً' })
    }

    const setupToken = process.env.INITIAL_SETUP_TOKEN
    const username = process.env.INITIAL_ADMIN_USERNAME
    const password = process.env.INITIAL_ADMIN_PASSWORD

    if (!setupToken || !username || !password) {
      return NextResponse.json(
        { error: 'يلزم إعداد بيانات المسؤول الأول في متغيرات البيئة' },
        { status: 503 }
      )
    }

    if (!hasValidSetupToken(request, setupToken)) {
      return NextResponse.json({ error: 'رمز الإعداد الأولي غير صالح' }, { status: 401 })
    }

    if (username.trim().length < 3 || password.length < 12) {
      return NextResponse.json(
        { error: 'بيانات المسؤول الأول لا تستوفي متطلبات الأمان' },
        { status: 500 }
      )
    }

    const user = await db.user.create({
      data: {
        username: username.trim(),
        password: hashPassword(password),
        nom: process.env.INITIAL_ADMIN_NAME?.trim() || 'المسؤول العام',
        commune: 'ALL',
        role: 'admin',
      },
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        role: true,
      },
    })

    return NextResponse.json({ message: 'تم إنشاء المسؤول الأول بنجاح', user }, { status: 201 })
  } catch (error) {
    console.error('Seed users error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إعداد المسؤول الأول' }, { status: 500 })
  }
}

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  try {
    const users = await db.user.findMany({
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        role: true,
        actif: true,
        lastLogin: true,
      }
    })
    return NextResponse.json({ users })
  } catch (error) {
    console.error('Get users error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء جلب المستخدمين' }, { status: 500 })
  }
}
