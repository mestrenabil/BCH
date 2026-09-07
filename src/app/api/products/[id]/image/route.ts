import crypto from 'crypto'
import path from 'path'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth, type AuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import {
  getProductImageDirectory,
  getProductImagePath,
  isAllowedProductImage,
  MAX_PRODUCT_IMAGE_SIZE_BYTES,
  sanitizeProductImageName,
} from '@/lib/product-image-storage'

export const runtime = 'nodejs'

async function getAuthorizedProduct(user: AuthUser, id: string) {
  const product = await db.product.findUnique({ where: { id }, select: { id: true, commune: true, imagePath: true } })
  if (!product) return { error: NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 }) }
  // Products with an empty/ALL commune are shared; allow any authenticated user.
  const commune = product.commune && product.commune !== 'ALL' ? product.commune : ''
  if (commune && !canAccessCommune(user, commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول إلى هذا المنتج' }, { status: 403 }) }
  }
  return { product }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const accessResult = await getAuthorizedProduct(user, id)
    if ('error' in accessResult) return accessResult.error

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'يرجى اختيار صورة صالحة' }, { status: 400 })
    }

    const originalName = sanitizeProductImageName(file.name)
    if (!originalName || !isAllowedProductImage(originalName, file.type || undefined)) {
      return NextResponse.json({ error: 'يسمح فقط بصور JPG أو PNG أو WebP' }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_PRODUCT_IMAGE_SIZE_BYTES) {
      return NextResponse.json({ error: 'حجم الصورة يجب أن يكون بين 1 بايت و5 ميغابايت' }, { status: 400 })
    }

    const storedFileName = `${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`
    const storedFilePath = getProductImagePath(storedFileName)
    if (!storedFilePath) return NextResponse.json({ error: 'مسار التخزين غير صالح' }, { status: 400 })

    await mkdir(getProductImageDirectory(), { recursive: true })
    await writeFile(storedFilePath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' })

    try {
      const previousImage = accessResult.product.imagePath
      const updated = await db.product.update({
        where: { id },
        data: { imagePath: storedFileName },
        select: { id: true, imagePath: true },
      })
      // Remove the previous image file (if any) now that the DB points to the new one.
      if (previousImage && previousImage !== storedFileName) {
        const previousPath = getProductImagePath(previousImage)
        if (previousPath) await unlink(previousPath).catch(() => undefined)
      }
      return NextResponse.json({ imagePath: updated.imagePath }, { status: 201 })
    } catch (error) {
      await unlink(storedFilePath).catch(() => undefined)
      throw error
    }
  } catch (error) {
    console.error('POST product image error:', error)
    return NextResponse.json({ error: 'فشل في رفع صورة المنتج' }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const accessResult = await getAuthorizedProduct(user, id)
    if ('error' in accessResult) return accessResult.error

    const previousImage = accessResult.product.imagePath
    if (previousImage) {
      const previousPath = getProductImagePath(previousImage)
      if (previousPath) await unlink(previousPath).catch(() => undefined)
    }
    await db.product.update({ where: { id }, data: { imagePath: null } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE product image error:', error)
    return NextResponse.json({ error: 'فشل في حذف صورة المنتج' }, { status: 500 })
  }
}
