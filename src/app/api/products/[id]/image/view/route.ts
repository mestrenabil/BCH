import path from 'path'
import { readFile } from 'fs/promises'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth, type AuthUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'
import { getProductImagePath } from '@/lib/product-image-storage'

export const runtime = 'nodejs'

const mimeTypeByExtension: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
}

async function getAuthorizedProductImage(user: AuthUser, id: string) {
  const product = await db.product.findUnique({ where: { id }, select: { commune: true, imagePath: true } })
  if (!product) return { error: NextResponse.json({ error: 'المنتج غير موجود' }, { status: 404 }) }
  if (!product.imagePath) return { error: NextResponse.json({ error: 'لا توجد صورة لهذا المنتج' }, { status: 404 }) }
  const commune = product.commune && product.commune !== 'ALL' ? product.commune : ''
  if (commune && !canAccessCommune(user, commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول إلى هذه الصورة' }, { status: 403 }) }
  }
  return { imagePath: product.imagePath }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth({ allowFieldAgent: true })
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const accessResult = await getAuthorizedProductImage(authResult.user, id)
    if ('error' in accessResult) return accessResult.error

    const storedFilePath = getProductImagePath(accessResult.imagePath)
    if (!storedFilePath) return NextResponse.json({ error: 'مسار الصورة غير صالح' }, { status: 404 })

    const file = await readFile(storedFilePath)
    const extension = path.extname(accessResult.imagePath).toLowerCase()
    const mimeType = mimeTypeByExtension[extension] || 'application/octet-stream'
    return new NextResponse(new Uint8Array(file), {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': 'inline; filename="product-image"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('GET product image file error:', error)
    return NextResponse.json({ error: 'تعذر تحميل صورة المنتج' }, { status: 500 })
  }
}
