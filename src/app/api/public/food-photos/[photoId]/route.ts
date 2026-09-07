import { readFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getFoodPhotoPath } from '@/lib/food-photo-storage'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * يخدم صور البلاغات الغذائية للعموم (لا مصادقة).
 * مسار الصورة محدد بـ photoId من قاعدة البيانات — آمن لأنه لا يقبل مساراً مباشراً.
 *
 * GET /api/public/food-photos/[photoId]
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) {
  try {
    const { photoId } = await params
    const photo = await db.foodReportPhoto.findUnique({
      where: { id: photoId },
      select: { storedFileName: true, mimeType: true },
    })
    if (!photo) return NextResponse.json({ error: 'الصورة غير موجودة' }, { status: 404 })

    const filePath = getFoodPhotoPath(photo.storedFileName)
    if (!filePath) return NextResponse.json({ error: 'مسار الصورة غير صالح' }, { status: 404 })

    const buffer = await readFile(filePath)
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': photo.mimeType || 'image/jpeg',
        'Content-Disposition': 'inline; filename="food-photo"',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('public food photo serve error:', error)
    return NextResponse.json({ error: 'تعذر تحميل الصورة' }, { status: 500 })
  }
}
