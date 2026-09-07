import crypto from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'
import { db } from '@/lib/db'
import { getClientIp, consumePublicRateLimit } from '@/lib/public-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import catalogJson from '../../../../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'
import {
  MAX_FOOD_PHOTO_SIZE_BYTES,
  sanitizeFoodPhotoName,
  isAllowedFoodPhoto,
  getFoodPhotoDirectory,
  getFoodPhotoPath,
} from '@/lib/food-photo-storage'
import { mkdir, writeFile, unlink } from 'fs/promises'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const COMMUNES = new Set((catalogJson as TerritoryCatalog).communes.map((c) => c.nameAr || c.name || c.nameFr))
const ALLOWED_TYPES = new Set(['RESTAURANT', 'EXPIRED_PRODUCT', 'STREET_VENDOR', 'PREMISES_HYGIENE'])
const MAX_PHOTOS = 5

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseCoordinate(value: unknown, min: number, max: number): number | null {
  if (value === undefined || value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function noStoreJson(body: object, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** توليد مرجع فريد SIG-FOOD-YYYY-XXXXXX */
async function generateReference(): Promise<string> {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt++) {
    const random = crypto.randomBytes(3).toString('hex').toUpperCase()
    const candidate = `SIG-FOOD-${year}-${random}`
    const exists = await db.foodReport.findUnique({ where: { reference: candidate }, select: { id: true } })
    if (!exists) return candidate
  }
  return `SIG-FOOD-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
}

// ===== GET: تتبع البلاغ بالمرجع =====
export async function GET(request: NextRequest) {
  const limit = consumePublicRateLimit(`public-food-status:${getClientIp(request.headers)}`, 30, 15 * 60 * 1000)
  if (!limit.allowed) return noStoreJson({ error: 'تم تجاوز عدد محاولات التتبع. يرجى المحاولة لاحقاً.' }, 429)

  const reference = text(new URL(request.url).searchParams.get('reference'), 40).toUpperCase()
  if (!/^SIG-FOOD-\d{4}-[A-F0-9]{6,8}$/.test(reference)) {
    return noStoreJson({ error: 'مرجع التتبع غير صالح' }, 400)
  }

  const report = await db.foodReport.findUnique({
    where: { reference },
    select: {
      reference: true,
      statut: true,
      reportType: true,
      establishmentName: true,
      createdAt: true,
    },
  })

  if (!report) return noStoreJson({ error: 'لم يتم العثور على بلاغ بهذا المرجع' }, 404)

  const STATUS_LABELS: Record<string, string> = {
    NOUVEAU: 'تم استلام البلاغ',
    VERIFICATION: 'قيد التحقق',
    VALIDE: 'تمت المصادقة على البلاغ',
    EN_COURS: 'المعالجة جارية',
    TRAITE: 'تمت معالجة البلاغ',
    REJETE: 'تم رفض البلاغ',
    CLASSE: 'تم أرشفة البلاغ',
  }

  return noStoreJson({
    report: {
      reference: report.reference,
      statutLabel: STATUS_LABELS[report.statut] || report.statut,
      reportType: report.reportType,
      establishmentName: report.establishmentName,
      createdAt: report.createdAt,
    },
  })
}

// ===== POST: إنشاء بلاغ غذائي + رفع صور (FormData) =====
export async function POST(request: NextRequest) {
  const limit = consumePublicRateLimit(`public-food:${getClientIp(request.headers)}`, 5, 60 * 60 * 1000)
  if (!limit.allowed) {
    return noStoreJson({ error: 'تم تجاوز عدد البلاغات المسموح بها في الساعة. يرجى المحاولة لاحقاً.' }, 429)
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return noStoreJson({ error: 'تعذر قراءة بيانات البلاغ' }, 400)
  }

  // Honeypot — ارفض البوتات
  const website = text(formData.get('website'), 200)
  if (website) return noStoreJson({ received: true }, 202)

  // استخراج الحقول النصية
  const commune = text(formData.get('commune'), 60)
  if (!commune || !COMMUNES.has(commune)) {
    return noStoreJson({ error: 'يرجى اختيار جماعة صحيحة' }, 400)
  }

  const reportType = text(formData.get('reportType'), 30)
  if (!ALLOWED_TYPES.has(reportType)) {
    return noStoreJson({ error: 'نوع البلاغ غير صالح' }, 400)
  }

  const description = text(formData.get('description'), 2000)
  const establishmentName = text(formData.get('establishmentName'), 200)
  if (!description && !establishmentName) {
    return noStoreJson({ error: 'يرجى وصف المخالفة أو تحديد اسم المنشأة' }, 400)
  }

  const declarantName = text(formData.get('declarantName'), 100)
  const declarantPhone = text(formData.get('declarantPhone'), 30)

  const latitude = parseCoordinate(formData.get('latitude'), -90, 90)
  const longitude = parseCoordinate(formData.get('longitude'), -180, 180)

  // أولوية تلقائية: منتجات فاسدة → SANITAIRE، وإلا NORMALE
  let priority = 'NORMALE'
  if (reportType === 'EXPIRED_PRODUCT') priority = 'SANITAIRE'

  // توليد المرجع
  const reference = await generateReference()

  // معالجة الصور (حتى MAX_PHOTOS)
  const photoEntries: { storedFileName: string; originalName: string; mimeType: string; size: number }[] = []
  const allEntries = Array.from(formData.entries())
  const fileEntries = allEntries.filter(([key, value]) => key === 'photos' && value instanceof File)

  if (fileEntries.length > MAX_PHOTOS) {
    return noStoreJson({ error: `الحد الأقصى ${MAX_PHOTOS} صور` }, 400)
  }

  // إنشاء البلاغ أولاً
  const report = await db.foodReport.create({
    data: {
      reference,
      source: 'PUBLIC',
      declarantName,
      declarantPhone,
      commune,
      quartier: text(formData.get('quartier'), 100),
      adresse: text(formData.get('adresse'), 300),
      latitude,
      longitude,
      reportType,
      establishmentName,
      establishmentType: text(formData.get('establishmentType'), 100),
      description,
      priority,
      statut: 'NOUVEAU',
    },
  })

  // كتابة الصور على القرص + إنشاء سجلات DB (مع rollback عند الفشل)
  if (fileEntries.length > 0) {
    await mkdir(getFoodPhotoDirectory(), { recursive: true })
    const writtenFiles: string[] = []

    for (const [, value] of fileEntries) {
      const file = value as File
      if (file.size === 0) continue
      if (file.size > MAX_FOOD_PHOTO_SIZE_BYTES) {
        // rollback: احذف الملفات المكتوبة + البلاغ
        for (const f of writtenFiles) { try { await unlink(f) } catch {} }
        await db.foodReport.delete({ where: { id: report.id } }).catch(() => undefined)
        return noStoreJson({ error: 'حجم الصورة يتجاوز 8 ميغابايت' }, 400)
      }
      const originalName = sanitizeFoodPhotoName(file.name)
      if (!isAllowedFoodPhoto(originalName, file.type)) continue

      const storedFileName = `${crypto.randomUUID()}${path.extname(originalName).toLowerCase()}`
      const storedPath = getFoodPhotoPath(storedFileName)
      if (!storedPath) continue

      try {
        await writeFile(storedPath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' })
        writtenFiles.push(storedPath)
        photoEntries.push({ storedFileName, originalName, mimeType: file.type || 'image/jpeg', size: file.size })
      } catch {
        // تجاهل الصورة الفاشلة، تابع الباقي
      }
    }

    // أنشئ سجلات الصور في DB
    if (photoEntries.length > 0) {
      try {
        await db.foodReportPhoto.createMany({
          data: photoEntries.map((p) => ({ ...p, reportId: report.id, uploadedBy: 'PUBLIC' })),
        })
      } catch (err) {
        // rollback الملفات
        for (const f of writtenFiles) { try { await unlink(f) } catch {} }
        await db.foodReport.delete({ where: { id: report.id } }).catch(() => undefined)
        console.error('food photo DB create error:', err)
        return noStoreJson({ error: 'تعذر حفظ الصور. يرجى المحاولة مجدداً.' }, 500)
      }
    }
  }

  return noStoreJson({
    report: {
      reference: report.reference,
      priority: report.priority,
      reportType: report.reportType,
    },
    photoCount: photoEntries.length,
  }, 201)
}
