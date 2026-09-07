import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'

// GET: قائمة أحداث الـ timeline لملف محدّد
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const dossier = await db.dossier.findUnique({ where: { id }, select: { commune: true } })
    if (!dossier) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const events = await db.dossierEvent.findMany({
      where: { dossierId: id },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ events })
  } catch (error) {
    console.error('GET dossier events error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

// POST: إضافة حدث (تعليق/ملاحظة) دون تغيير الحالة
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const dossier = await db.dossier.findUnique({ where: { id }, select: { commune: true, reference: true, status: true } })
    if (!dossier) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json()
    const { reason, action } = body

    if (!reason || !reason.trim()) {
      return NextResponse.json({ error: 'يرجى تقديم محتوى التعليق' }, { status: 400 })
    }

    const event = await db.dossierEvent.create({
      data: {
        dossierId: id,
        fromStatus: dossier.status,
        toStatus: dossier.status,  // نفس الحالة — تعليق فقط
        action: action || 'COMMENT',
        reason: reason.trim(),
        changedBy: user.id,
        changedByName: user.nom,
        metadata: JSON.stringify({}),
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('POST dossier event error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة الحدث' }, { status: 500 })
  }
}
