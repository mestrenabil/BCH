import crypto from 'crypto'
import { db } from '@/lib/db'
import { getClientIp, consumePublicRateLimit } from '@/lib/public-rate-limit'
import { NextRequest, NextResponse } from 'next/server'
import catalogJson from '../../../../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'

const COMMUNES = new Set((catalogJson as TerritoryCatalog).communes.map((commune) => (
  commune.nameAr || commune.name || commune.nameFr
)))
const SPECIES = new Set(['DOG', 'CAT', 'OTHER'])

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number | null {
  if (value === undefined || value === null || value === '') return null
  const coordinate = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) return null
  return coordinate
}

function noStoreJson(body: object, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest) {
  const limit = consumePublicRateLimit(`public-csvr:${getClientIp(request.headers)}`, 5, 60 * 60 * 1000)
  if (!limit.allowed) {
    return noStoreJson({ error: 'تم تجاوز عدد البلاغات المسموح بها في الساعة. يرجى المحاولة لاحقاً.' }, 429)
  }

  try {
    const body = await request.json()

    // Honeypot field — reject bots
    const website = text(body.website, 200)
    if (website) return noStoreJson({ error: 'طلب غير صالح' }, 400)

    const commune = text(body.commune, 60)
    if (!commune || !COMMUNES.has(commune)) {
      return noStoreJson({ error: 'يرجى اختيار جماعة صحيحة' }, 400)
    }

    const description = text(body.description, 1000)
    const address = text(body.address, 300)
    if (!description && !address) {
      return noStoreJson({ error: 'يرجى وصف الحيوان أو الموقع' }, 400)
    }

    const species = SPECIES.has(body.species) ? body.species : 'DOG'
    const latitude = parseCoordinate(body.latitude, -90, 90)
    const longitude = parseCoordinate(body.longitude, -180, 180)
    // If coordinates were provided but invalid, reject
    if (latitude === null && body.latitude !== undefined && body.latitude !== '') {
      return noStoreJson({ error: 'إحداثيات الموقع غير صالحة' }, 400)
    }
    if (longitude === null && body.longitude !== undefined && body.longitude !== '') {
      return noStoreJson({ error: 'إحداثيات الموقع غير صالحة' }, 400)
    }

    const declarantName = text(body.declarantName, 100)
    const declarantPhone = text(body.declarantPhone, 30)
    const quartier = text(body.quartier, 100)

    const estimatedCount = Math.min(Math.max(parseInt(body.estimatedCount, 10) || 1, 1), 999)

    // Determine priority from flags
    let priority = 'NORMALE'
    const isAggressive = Boolean(body.isAggressive)
    const isInjured = Boolean(body.isInjured)
    const rabiesSuspect = Boolean(body.rabiesSuspect)
    const biteReported = Boolean(body.biteReported)
    if (rabiesSuspect || biteReported) priority = 'SANITAIRE'
    else if (isAggressive) priority = 'URGENTE'
    else if (isInjured) priority = 'HAUTE'

    // Generate reference: SIG-CSVR-YYYY-XXXXXX
    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = crypto.randomBytes(3).toString('hex').toUpperCase()
      const candidate = `SIG-CSVR-${year}-${random}`
      const exists = await db.strayReport.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) {
      reference = `SIG-CSVR-${year}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`
    }

    const report = await db.strayReport.create({
      data: {
        reference,
        source: 'PUBLIC',
        declarantName,
        declarantPhone,
        declarantRole: 'citoyen',
        commune,
        quartier,
        secteur: '',
        adresse: address,
        latitude,
        longitude,
        species,
        estimatedCount,
        hasYoung: Boolean(body.hasYoung),
        isAggressive,
        isInjured,
        isSick: Boolean(body.isSick),
        rabiesSuspect,
        biteReported,
        nearSchool: Boolean(body.nearSchool),
        nearMarket: Boolean(body.nearMarket),
        nearHealth: Boolean(body.nearHealth),
        nearDump: Boolean(body.nearDump),
        description,
        priority,
        statut: 'NOUVEAU',
        observations: '',
      },
      select: {
        reference: true, priority: true, statut: true, createdAt: true, species: true,
      },
    })

    return noStoreJson({ report }, 201)
  } catch (error) {
    console.error('POST public csvr-reports error:', error)
    return noStoreJson({ error: 'تعذر إرسال البلاغ. يرجى المحاولة لاحقاً.' }, 500)
  }
}

// Track a report by reference
export async function GET(request: NextRequest) {
  const limit = consumePublicRateLimit(`public-csvr-status:${getClientIp(request.headers)}`, 30, 15 * 60 * 1000)
  if (!limit.allowed) {
    return noStoreJson({ error: 'تم تجاوز عدد محاولات التتبع. يرجى المحاولة لاحقاً.' }, 429)
  }

  const reference = text(new URL(request.url).searchParams.get('reference'), 40).toUpperCase()
  if (!/^SIG-CSVR-\d{4}-[A-F0-9]{6,8}$/.test(reference)) {
    return noStoreJson({ error: 'مرجع التتبع غير صالح' }, 400)
  }

  const report = await db.strayReport.findFirst({
    where: { reference, source: 'PUBLIC' },
    select: { reference: true, statut: true, priority: true, createdAt: true, species: true },
  })

  if (!report) {
    return noStoreJson({ error: 'لم يتم العثور على بلاغ بهذا المرجع' }, 404)
  }

  const STATUS_LABELS: Record<string, string> = {
    NOUVEAU: 'تم استلام البلاغ',
    VERIFICATION: 'قيد التحقق',
    VALIDE: 'تمت المصادقة على البلاغ',
    MISSION_PLANIFIEE: 'تمت برمجة مهمة',
    EN_COURS: 'التدخل جارٍ',
    TRAITE: 'تمت معالجة البلاغ',
    PARTIEL: 'معالجة جزئية',
    NON_LOCALISE: 'تعذر تحديد الموقع',
    DOUBLON: 'بلاغ مكرر',
    CLASSE: 'تم أرشفة البلاغ',
  }

  return noStoreJson({
    report: {
      reference: report.reference,
      statut: report.statut,
      statutLabel: STATUS_LABELS[report.statut] || report.statut,
      priority: report.priority,
      createdAt: report.createdAt.toISOString(),
    },
  })
}
