import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const assetTypes = new Set(['SEWER_LINE', 'DRAIN', 'PUMP_STATION', 'TANK', 'TREATMENT_PLANT'])
const statuses = new Set(['ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE'])

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `ASS-AST-${year}-${suffix}`
    if (!await db.sanitationAsset.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `ASS-AST-${year}-${Date.now().toString(36).toUpperCase()}`
}

function optionalNumber(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const where: Record<string, unknown> = {}
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) where.commune = communeFilter
    if (searchParams.get('type')) where.type = searchParams.get('type')
    if (searchParams.get('status')) where.status = searchParams.get('status')
    const assets = await db.sanitationAsset.findMany({ where, orderBy: { createdAt: 'desc' }, take: 1000 })
    const total = await db.sanitationAsset.count({ where })
    return NextResponse.json({ assets, total })
  } catch (error) {
    console.error('GET sanitation-assets error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل أصول الصرف الصحي' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'اسم الأصل مطلوب' }, { status: 400 })
    const type = String(body.type || 'DRAIN')
    const status = String(body.status || 'ACTIVE')
    if (!assetTypes.has(type) || !statuses.has(status)) return NextResponse.json({ error: 'نوع أو حالة الأصل غير صالحة' }, { status: 400 })
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'ليست لديك صلاحية على الجماعة المحددة' }, { status: 403 })
    const asset = await db.sanitationAsset.create({ data: { reference: await createReference(), name, type, status, commune, quartier: String(body.quartier || ''), adresse: String(body.adresse || ''), latitude: optionalNumber(body.latitude), longitude: optionalNumber(body.longitude), operator: String(body.operator || ''), capacity: optionalNumber(body.capacity), capacityUnit: String(body.capacityUnit || 'm³/j'), lastMaintenanceAt: optionalDate(body.lastMaintenanceAt), nextMaintenanceAt: optionalDate(body.nextMaintenanceAt), description: String(body.description || '') } })
    await recordActivity({ user, action: 'CREATE', entityType: 'SANITATION_ASSET', entityId: asset.id, commune, details: { reference: asset.reference, type, status } })
    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    console.error('POST sanitation-assets error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء أصل الصرف الصحي' }, { status: 500 })
  }
}
