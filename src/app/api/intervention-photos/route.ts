import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { searchParams } = new URL(request.url)
    const interventionId = searchParams.get('interventionId')

    if (!interventionId) {
      return NextResponse.json({ error: 'يرجى تحديد التدخل' }, { status: 400 })
    }

    const photos = await db.interventionPhoto.findMany({
      where: { interventionId },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('GET intervention-photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الصور' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const body = await request.json()
    const { interventionId, url, caption, type } = body

    if (!interventionId || !url) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }

    // Verify intervention exists
    const intervention = await db.intervention.findUnique({ where: { id: interventionId } })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }

    const photo = await db.interventionPhoto.create({
      data: {
        interventionId,
        url,
        caption: caption || null,
        type: type || 'AFTER',
      },
    })

    return NextResponse.json(photo, { status: 201 })
  } catch (error) {
    console.error('POST intervention-photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء رفع الصورة' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const body = await request.json()
    const { id } = body

    if (!id) {
      return NextResponse.json({ error: 'يرجى تحديد الصورة' }, { status: 400 })
    }

    const photo = await db.interventionPhoto.findUnique({ where: { id } })
    if (!photo) {
      return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })
    }

    await db.interventionPhoto.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE intervention-photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الصورة' }, { status: 500 })
  }
}
