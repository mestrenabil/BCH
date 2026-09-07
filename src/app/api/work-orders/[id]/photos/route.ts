import crypto from 'crypto'
import path from 'path'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth, type AuthUser } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'
import {
  getWorkOrderPhotoDirectory,
  getWorkOrderPhotoPath,
  isAllowedWorkOrderPhoto,
  MAX_WORK_ORDER_PHOTO_SIZE_BYTES,
  sanitizeWorkOrderPhotoName,
} from '@/lib/work-order-photo-storage'

export const runtime = 'nodejs'

async function getAuthorizedWorkOrder(user: AuthUser, id: string) {
  const workOrder = await db.workOrder.findUnique({ where: { id }, select: { id: true, commune: true, assignedAgentId: true } })
  if (!workOrder) return { error: NextResponse.json({ error: 'أمر العمل غير موجود' }, { status: 404 }) }
  if (!canAccessCommune(user, workOrder.commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول إلى هذا الأمر' }, { status: 403 }) }
  }
  if (user.role === 'agent' && (!user.agentId || workOrder.assignedAgentId !== user.agentId)) {
    return { error: NextResponse.json({ error: 'يمكنك الوصول إلى أدلة أوامر العمل المسندة إليك فقط' }, { status: 403 }) }
  }
  return { workOrder }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const accessResult = await getAuthorizedWorkOrder(authResult.user, id)
    if ('error' in accessResult) return accessResult.error

    const photos = await db.workOrderPhoto.findMany({
      where: { workOrderId: id },
      select: { id: true, originalName: true, mimeType: true, size: true, type: true, caption: true, uploadedBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('GET work order photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل صور التنفيذ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const accessResult = await getAuthorizedWorkOrder(authResult.user, id)
    if ('error' in accessResult) return accessResult.error

    const formData = await request.formData()
    const file = formData.get('file')
    const type = formData.get('type') === 'BEFORE' ? 'BEFORE' : 'AFTER'
    const captionValue = formData.get('caption')
    const caption = typeof captionValue === 'string' ? captionValue.trim().slice(0, 500) : null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'يرجى اختيار صورة صالحة' }, { status: 400 })
    }

    const originalName = sanitizeWorkOrderPhotoName(file.name)
    if (!originalName || !isAllowedWorkOrderPhoto(originalName, file.type || undefined)) {
      return NextResponse.json({ error: 'يسمح فقط بصور JPG أو PNG أو WebP' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_WORK_ORDER_PHOTO_SIZE_BYTES) {
      return NextResponse.json({ error: 'حجم الصورة يجب أن يكون بين 1 بايت و8 ميغابايت' }, { status: 400 })
    }

    const storedFileName = `${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`
    const storedFilePath = getWorkOrderPhotoPath(storedFileName)
    if (!storedFilePath) return NextResponse.json({ error: 'مسار التخزين غير صالح' }, { status: 400 })

    await mkdir(getWorkOrderPhotoDirectory(), { recursive: true })
    await writeFile(storedFilePath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' })

    try {
      const photo = await db.workOrderPhoto.create({
        data: {
          workOrderId: id,
          storedFileName,
          originalName,
          mimeType: file.type,
          size: file.size,
          type,
          caption,
          uploadedBy: authResult.user.nom,
        },
        select: { id: true, originalName: true, mimeType: true, size: true, type: true, caption: true, uploadedBy: true, createdAt: true },
      })
      await recordActivity({
        user: authResult.user,
        action: 'UPLOAD',
        entityType: 'WORK_ORDER_PHOTO',
        entityId: photo.id,
        commune: accessResult.workOrder.commune,
        details: { workOrderId: id, type, originalName, size: file.size },
      })
      return NextResponse.json(photo, { status: 201 })
    } catch (error) {
      await unlink(storedFilePath).catch(() => undefined)
      throw error
    }
  } catch (error) {
    console.error('POST work order photo error:', error)
    return NextResponse.json({ error: 'فشل في رفع صورة التنفيذ' }, { status: 500 })
  }
}
