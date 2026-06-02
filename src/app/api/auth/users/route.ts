import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCommuneFilter, hashPassword } from '@/lib/auth'

// GET /api/auth/users — List users (filtered by commune for non-admin)
export async function GET() {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    // Non-admin users can only see users from their own commune
    const where: Record<string, unknown> = {}
    if (user.commune !== 'ALL') {
      where.commune = user.commune
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        role: true,
        actif: true,
        lastLogin: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error) {
    console.error('GET users error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المستخدمين' }, { status: 500 })
  }
}

// POST /api/auth/users — Create a new user
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult

    const body = await request.json()
    const { username, password, nom, commune, role } = body

    // Validation
    if (!username || !password || !nom) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' }, { status: 400 })
    }

    if (password.length < 4) {
      return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }, { status: 400 })
    }

    // Non-admin users can only create users for their own commune
    const enforcedCommune = authUser.commune !== 'ALL' ? authUser.commune : (commune || 'ALL')

    // Non-admin users cannot create admin users
    const enforcedRole = authUser.role !== 'admin' ? 'responsable' : (role || 'responsable')

    // Check if username already exists
    const existing = await db.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'اسم المستخدم موجود مسبقاً' }, { status: 409 })
    }

    const newUser = await db.user.create({
      data: {
        username,
        password: hashPassword(password),
        nom,
        commune: enforcedCommune,
        role: enforcedRole,
      },
      select: {
        id: true,
        username: true,
        nom: true,
        commune: true,
        role: true,
        actif: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ user: newUser }, { status: 201 })
  } catch (error) {
    console.error('POST user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء المستخدم' }, { status: 500 })
  }
}
