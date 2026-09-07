import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth'

// POST /api/auth/change-password — Change current user's password
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error
    const { user: authUser } = authResult

    const { currentPassword, newPassword } = await request.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'يرجى إدخال كلمة المرور الحالية والجديدة' },
        { status: 400 }
      )
    }

    if (newPassword.length < 12) {
      return NextResponse.json(
        { error: 'كلمة المرور الجديدة يجب أن تكون 12 حرفاً على الأقل' },
        { status: 400 }
      )
    }

    // Get the user's current password hash
    const user = await db.user.findUnique({
      where: { id: authUser.id },
      select: { id: true, password: true, nom: true },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'المستخدم غير موجود' },
        { status: 404 }
      )
    }

    // Verify current password
    if (!verifyPassword(currentPassword, user.password)) {
      return NextResponse.json(
        { error: 'كلمة المرور الحالية غير صحيحة' },
        { status: 401 }
      )
    }

    // Update to new password
    await db.user.update({
      where: { id: authUser.id },
      data: { password: hashPassword(newPassword) },
    })

    return NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح',
    })
  } catch (error) {
    console.error('Change password error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تغيير كلمة المرور' },
      { status: 500 }
    )
  }
}
