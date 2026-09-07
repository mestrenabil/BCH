import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth, type AuthUser } from '@/lib/auth'

async function getAuthorizedIntervention(user: AuthUser, interventionId: string) {
  const intervention = await db.intervention.findUnique({ where: { id: interventionId }, select: { id: true, commune: true } })
  if (!intervention) return { error: NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 }) }
  if (!canAccessCommune(user, intervention.commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا التدخل' }, { status: 403 }) }
  }
  return { intervention }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const interventionId = new URL(request.url).searchParams.get('interventionId')
    if (!interventionId) {
      return NextResponse.json({ error: 'يرجى تحديد التدخل' }, { status: 400 })
    }

    const accessResult = await getAuthorizedIntervention(authResult.user, interventionId)
    if ('error' in accessResult) return accessResult.error

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
    if (typeof interventionId !== 'string' || typeof url !== 'string' || !url || url.length > 5_000_000) {
      return NextResponse.json({ error: 'بيانات الصورة غير صالحة' }, { status: 400 })
    }

    const accessResult = await getAuthorizedIntervention(authResult.user, interventionId)
    if ('error' in accessResult) return accessResult.error

    const photo = await db.interventionPhoto.create({
      data: {
        interventionId,
        url,
        caption: typeof caption === 'string' ? caption.slice(0, 500) : null,
        type: type === 'BEFORE' ? 'BEFORE' : 'AFTER',
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

    const { id } = await request.json()
    if (typeof id !== 'string') {
      return NextResponse.json({ error: 'يرجى تحديد الصورة' }, { status: 400 })
    }

    const photo = await db.interventionPhoto.findUnique({
      where: { id },
      include: { intervention: { select: { commune: true } } },
    })
    if (!photo) {
      return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })
    }
    if (!canAccessCommune(authResult.user, photo.intervention.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذه الصورة' }, { status: 403 })
    }

    await db.interventionPhoto.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE intervention-photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الصورة' }, { status: 500 })
  }
}
