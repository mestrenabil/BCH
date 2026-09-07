import crypto from 'crypto'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCsvrPhotoDirectory,
  getCsvrPhotoPath,
  isAllowedCsvrPhoto,
  MAX_CSVR_PHOTO_SIZE_BYTES,
  sanitizeCsvrPhotoName,
} from '@/lib/csvr-photo-storage'

export const runtime = 'nodejs'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const report = await db.strayReport.findUnique({ where: { id }, select: { commune: true } })
    if (!report) return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    if (!canAccessCommune(authResult.user, report.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذا البلاغ' }, { status: 403 })
    }

    const photos = await db.strayReportPhoto.findMany({
      where: { reportId: id },
      select: { id: true, originalName: true, mimeType: true, size: true, caption: true, uploadedBy: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('GET csvr report photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الصور' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const report = await db.strayReport.findUnique({ where: { id }, select: { commune: true, reference: true } })
    if (!report) return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    if (!canAccessCommune(authResult.user, report.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذا البلاغ' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const captionValue = formData.get('caption')
    const caption = typeof captionValue === 'string' ? captionValue.trim().slice(0, 500) : null

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'يرجى اختيار صورة صالحة' }, { status: 400 })
    }

    const originalName = sanitizeCsvrPhotoName(file.name)
    if (!originalName || !isAllowedCsvrPhoto(originalName, file.type || undefined)) {
      return NextResponse.json({ error: 'يسمح فقط بصور JPG أو PNG أو WebP' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_CSVR_PHOTO_SIZE_BYTES) {
      return NextResponse.json({ error: 'حجم الصورة يجب أن يكون بين 1 بايت و8 ميغابايت' }, { status: 400 })
    }

    const storedFileName = `${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`
    const storedFilePath = getCsvrPhotoPath(storedFileName)
    if (!storedFilePath) return NextResponse.json({ error: 'مسار التخزين غير صالح' }, { status: 400 })

    await mkdir(getCsvrPhotoDirectory(), { recursive: true })
    await writeFile(storedFilePath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' })

    try {
      const photo = await db.strayReportPhoto.create({
        data: {
          reportId: id,
          storedFileName,
          originalName,
          mimeType: file.type,
          size: file.size,
          caption,
          uploadedBy: authResult.user.nom,
        },
        select: { id: true, originalName: true, mimeType: true, size: true, caption: true, uploadedBy: true, createdAt: true },
      })
      return NextResponse.json(photo, { status: 201 })
    } catch (error) {
      const { unlink } = await import('fs/promises')
      await unlink(storedFilePath).catch(() => undefined)
      throw error
    }
  } catch (error) {
    console.error('POST csvr report photo error:', error)
    return NextResponse.json({ error: 'فشل في رفع الصورة' }, { status: 500 })
  }
}
