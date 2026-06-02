import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, hashPassword } from '@/lib/auth'

// GET /api/auth/users/[id] — Get a single user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult
    const { id } = await params

    const user = await db.user.findUnique({
      where: { id },
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
    })

    if (!user) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Non-admin users can only view users from their own commune
    if (authUser.commune !== 'ALL' && user.commune !== authUser.commune) {
      return NextResponse.json({ error: 'غير مصرح لك بالوصول' }, { status: 403 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('GET user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المستخدم' }, { status: 500 })
  }
}

// PUT /api/auth/users/[id] — Update a user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult
    const { id } = await params

    const existingUser = await db.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Non-admin users can only edit users from their own commune
    if (authUser.commune !== 'ALL' && existingUser.commune !== authUser.commune) {
      return NextResponse.json({ error: 'غير مصرح لك بتعديل هذا المستخدم' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, password, commune, role, actif } = body

    const updateData: Record<string, unknown> = {}

    if (nom !== undefined) updateData.nom = nom

    // Handle password change
    if (password && password.length > 0) {
      if (password.length < 4) {
        return NextResponse.json({ error: 'كلمة المرور يجب أن تكون 4 أحرف على الأقل' }, { status: 400 })
      }
      updateData.password = hashPassword(password)
    }

    // Only admin can change commune and role
    if (authUser.role === 'admin') {
      if (commune !== undefined) updateData.commune = commune
      if (role !== undefined) updateData.role = role
    }

    // Toggle active status
    if (actif !== undefined) updateData.actif = actif

    const updatedUser = await db.user.update({
      where: { id },
      data: updateData,
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
    })

    return NextResponse.json({ user: updatedUser })
  } catch (error) {
    console.error('PUT user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث المستخدم' }, { status: 500 })
  }
}

// DELETE /api/auth/users/[id] — Delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult
    const { id } = await params

    const existingUser = await db.user.findUnique({ where: { id } })
    if (!existingUser) {
      return NextResponse.json({ error: 'المستخدم غير موجود' }, { status: 404 })
    }

    // Non-admin users can only delete users from their own commune
    if (authUser.commune !== 'ALL' && existingUser.commune !== authUser.commune) {
      return NextResponse.json({ error: 'غير مصرح لك بحذف هذا المستخدم' }, { status: 403 })
    }

    // Prevent deleting yourself
    if (existingUser.id === authUser.id) {
      return NextResponse.json({ error: 'لا يمكنك حذف حسابك الخاص' }, { status: 400 })
    }

    // Delete user's sessions first
    await db.session.deleteMany({ where: { userId: id } })

    // Delete the user
    await db.user.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE user error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف المستخدم' }, { status: 500 })
  }
}
