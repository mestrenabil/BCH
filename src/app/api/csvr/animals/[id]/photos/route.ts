import crypto from 'crypto'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth } from '@/lib/auth'
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
    const animal = await db.strayAnimal.findUnique({ where: { id }, select: { commune: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(authResult.user, animal.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذا الحيوان' }, { status: 403 })
    }

    const photos = await db.strayAnimalPhoto.findMany({
      where: { animalId: id },
      select: { id: true, originalName: true, mimeType: true, size: true, isMain: true, caption: true, uploadedBy: true, createdAt: true },
      orderBy: [{ isMain: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({ photos })
  } catch (error) {
    console.error('GET csvr animal photos error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الصور' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const animal = await db.strayAnimal.findUnique({ where: { id }, select: { commune: true } })
    if (!animal) return NextResponse.json({ error: 'الحيوان غير موجود' }, { status: 404 })
    if (!canAccessCommune(authResult.user, animal.commune)) {
      return NextResponse.json({ error: 'ليست لديك صلاحية الوصول إلى هذا الحيوان' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file')
    const isMain = formData.get('isMain') === 'true'
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
      // If this is the main photo, unset previous main and update animal.mainPhoto
      if (isMain) {
        await db.strayAnimalPhoto.updateMany({ where: { animalId: id, isMain: true }, data: { isMain: false } })
      }

      const photo = await db.strayAnimalPhoto.create({
        data: {
          animalId: id,
          storedFileName,
          originalName,
          mimeType: file.type,
          size: file.size,
          isMain,
          caption,
          uploadedBy: authResult.user.nom,
        },
        select: { id: true, originalName: true, mimeType: true, size: true, isMain: true, caption: true, uploadedBy: true, createdAt: true },
      })

      if (isMain) {
        await db.strayAnimal.update({ where: { id }, data: { mainPhoto: storedFileName } })
      }

      return NextResponse.json(photo, { status: 201 })
    } catch (error) {
      const { unlink } = await import('fs/promises')
      await unlink(storedFilePath).catch(() => undefined)
      throw error
    }
  } catch (error) {
    console.error('POST csvr animal photo error:', error)
    return NextResponse.json({ error: 'فشل في رفع الصورة' }, { status: 500 })
  }
}
