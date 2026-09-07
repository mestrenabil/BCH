import { readFile, unlink } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'
import { getWorkOrderPhotoPath } from '@/lib/work-order-photo-storage'

export const runtime = 'nodejs'

async function getAuthorizedPhoto(photoId: string) {
  const authResult = await requireAuth({ allowFieldAgent: true })
  if ('error' in authResult) return authResult

  const photo = await db.workOrderPhoto.findUnique({
    where: { id: photoId },
    include: { workOrder: { select: { commune: true, assignedAgentId: true } } },
  })
  if (!photo) return { error: NextResponse.json({ error: 'صورة التنفيذ غير موجودة' }, { status: 404 }) }
  if (!canAccessCommune(authResult.user, photo.workOrder.commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول إلى هذه الصورة' }, { status: 403 }) }
  }
  if (authResult.user.role === 'agent' && (!authResult.user.agentId || photo.workOrder.assignedAgentId !== authResult.user.agentId)) {
    return { error: NextResponse.json({ error: 'يمكنك الوصول إلى أدلة أوامر العمل المسندة إليك فقط' }, { status: 403 }) }
  }

  return { photo, user: authResult.user }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params
    const accessResult = await getAuthorizedPhoto(photoId)
    if ('error' in accessResult) return accessResult.error

    const storedFilePath = getWorkOrderPhotoPath(accessResult.photo.storedFileName)
    if (!storedFilePath) return NextResponse.json({ error: 'مسار الصورة غير صالح' }, { status: 404 })

    const file = await readFile(storedFilePath)
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': accessResult.photo.mimeType,
        'Content-Disposition': 'inline; filename="execution-photo"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('GET work order photo file error:', error)
    return NextResponse.json({ error: 'تعذر تحميل صورة التنفيذ' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params
    const accessResult = await getAuthorizedPhoto(photoId)
    if ('error' in accessResult) return accessResult.error
    if (accessResult.user.role === 'agent') {
      return NextResponse.json({ error: 'لا يمكن للعون الميداني حذف أدلة التنفيذ' }, { status: 403 })
    }

    const storedFilePath = getWorkOrderPhotoPath(accessResult.photo.storedFileName)
    await db.workOrderPhoto.delete({ where: { id: photoId } })
    if (storedFilePath) await unlink(storedFilePath).catch(() => undefined)
    await recordActivity({
      user: accessResult.user,
      action: 'DELETE',
      entityType: 'WORK_ORDER_PHOTO',
      entityId: photoId,
      commune: accessResult.photo.workOrder.commune,
      details: {
        workOrderId: accessResult.photo.workOrderId,
        type: accessResult.photo.type,
        originalName: accessResult.photo.originalName,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE work order photo error:', error)
    return NextResponse.json({ error: 'تعذر حذف صورة التنفيذ' }, { status: 500 })
  }
}
