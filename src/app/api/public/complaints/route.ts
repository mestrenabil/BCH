import crypto from 'crypto'
import { db } from '@/lib/db'
import { getClientIp, consumePublicRateLimit } from '@/lib/public-rate-limit'
import { sendComplaintReferenceEmail } from '@/lib/complaint-email'
import { getCommuneForPoint } from '@/lib/commune-boundaries'
import { NextRequest, NextResponse } from 'next/server'
import catalogJson from '../../../../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'
import { linkComplaintToEnvironmentalDossier } from '@/lib/environment-links'
import { ensureComplaintDossier } from '@/lib/vigilance-links'

const COMMUNES = new Set((catalogJson as TerritoryCatalog).communes.map((commune) => (
  commune.nameAr || commune.name || commune.nameFr
)))
const COMPLAINT_TYPES = new Set(['DERATISATION', 'DESINSECTISATION', 'DESINFECTION', 'FOOD', 'ANIMAL', 'ENVIRONMENT'])
const PRIORITIES = new Set(['URGENTE', 'HAUTE', 'NORMALE', 'BASSE'])
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

function parseCoordinate(value: unknown, minimum: number, maximum: number): number | null | undefined {
  if (value === undefined || value === null || value === '') return null
  const coordinate = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(coordinate) || coordinate < minimum || coordinate > maximum) return undefined
  return coordinate
}

function trackingReference(): string {
  return `SIG-${new Date().getFullYear()}-${crypto.randomBytes(9).toString('hex').toUpperCase()}`
}

function noStoreJson(body: object, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: NextRequest) {
  const limit = consumePublicRateLimit(`public-complaint-status:${getClientIp(request.headers)}`, 30, 15 * 60 * 1000)
  if (!limit.allowed) {
    return noStoreJson({ error: 'تم تجاوز عدد محاولات التتبع. يرجى المحاولة لاحقاً.' }, 429)
  }

  const reference = text(new URL(request.url).searchParams.get('reference'), 40).toUpperCase()
  if (!/^SIG-\d{4}-[A-F0-9]{18}$/.test(reference)) {
    return noStoreJson({ error: 'مرجع التتبع غير صالح' }, 400)
  }

  const complaint = await db.complaint.findFirst({
    where: { reference, source: 'PUBLIC' },
    select: { reference: true, statut: true, dateReception: true, dateTraitement: true },
  })

  if (!complaint) {
    return noStoreJson({ error: 'لم يتم العثور على بلاغ بهذا المرجع' }, 404)
  }

  return noStoreJson({
    complaint: {
      reference: complaint.reference,
      status: complaint.statut,
      receivedAt: complaint.dateReception,
      processedAt: complaint.dateTraitement,
    },
  })
}

export async function POST(request: NextRequest) {
  const limit = consumePublicRateLimit(`public-complaint-submit:${getClientIp(request.headers)}`, 3, 60 * 60 * 1000)
  if (!limit.allowed) {
    return noStoreJson(
      { error: 'تم تجاوز الحد المسموح للبلاغات. يرجى المحاولة بعد قليل.' },
      429,
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return noStoreJson({ error: 'تعذر قراءة بيانات البلاغ' }, 400)
  }

  if (typeof body !== 'object' || body === null) {
    return noStoreJson({ error: 'بيانات البلاغ غير صالحة' }, 400)
  }

  if (text(body.website, 200)) {
    return noStoreJson({ received: true }, 202)
  }

  const nomCitoyen = text(body.nomCitoyen, 120)
  const telephone = text(body.telephone, 30)
  const email = text(body.email, 254).toLowerCase()
  const adresse = text(body.adresse, 240)
  const quartier = text(body.quartier, 120)
  const type = text(body.type, 40)
  const description = text(body.description, 2000)
  const priorite = text(body.priorite, 20) || 'NORMALE'
  const latitude = parseCoordinate(body.latitude, -90, 90)
  const longitude = parseCoordinate(body.longitude, -180, 180)

  if (!nomCitoyen || !email || !description || !COMPLAINT_TYPES.has(type)) {
    return noStoreJson({ error: 'يرجى تعبئة الحقول المطلوبة ببيانات صحيحة' }, 400)
  }
  if (!EMAIL_PATTERN.test(email)) return noStoreJson({ error: 'البريد الإلكتروني غير صالح' }, 400)
  if (!PRIORITIES.has(priorite) || latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    return noStoreJson({ error: 'الأولوية أو الإحداثيات غير صالحة' }, 400)
  }

  const detectedCommune = await getCommuneForPoint(latitude, longitude)
  const commune = detectedCommune?.commune || ''
  if (!COMMUNES.has(commune)) {
    return noStoreJson({ error: 'يجب تحديد موقع داخل جماعة ترابية معروفة حتى يتم ربط البلاغ بها تلقائياً' }, 400)
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const complaint = await db.complaint.create({
        data: {
          reference: trackingReference(),
          nomCitoyen,
          telephone: telephone || null,
          email,
          adresse: adresse || '',
          quartier: quartier || null,
          commune,
          type,
          description,
          priorite,
          source: 'PUBLIC',
          latitude,
          longitude,
        },
        select: { id: true, reference: true, statut: true, dateReception: true, environmentalDossierId: true, commune: true, quartier: true, adresse: true, latitude: true, longitude: true, description: true, priorite: true, source: true },
      })

      try {
        await ensureComplaintDossier({ ...complaint, createdAt: complaint.dateReception })
      } catch (linkError) {
        console.error('Create public complaint dossier error:', linkError)
      }

      let environmentalLink: { reference: string } | null = null
      if (type === 'ENVIRONMENT') {
        const linked = await linkComplaintToEnvironmentalDossier(complaint)
        environmentalLink = { reference: linked.dossier.reference }
      }

      const emailDelivery = await sendComplaintReferenceEmail({
        recipient: email,
        reference: complaint.reference,
        commune,
      })
      return noStoreJson({ complaint: { reference: complaint.reference, statut: complaint.statut, dateReception: complaint.dateReception }, environmentalLink, emailDelivery }, 201)
    } catch (error) {
      const code = (error as { code?: string }).code
      if (code !== 'P2002' || attempt === 2) throw error
    }
  }

  return noStoreJson({ error: 'تعذر تسجيل البلاغ، يرجى المحاولة مجدداً' }, 500)
}
