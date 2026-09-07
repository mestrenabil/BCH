import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const recurring = searchParams.get('recurring')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (recurring === 'true') where.recurring = true
    const spots = await db.wasteBlackSpot.findMany({ where: where as any, orderBy: { createdAt: 'desc' }, take: limit, include: { environmentalDossier: { select: { id: true, reference: true, title: true } } } })
    const total = await db.wasteBlackSpot.count({ where: where as any })
    return NextResponse.json({ spots, total })
  } catch (error) { console.error('GET waste-spots error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { commune, quartier, adresse, latitude, longitude, description, wasteType, recurring, source } = body
    if (!description && !adresse) return NextResponse.json({ error: 'يرجى تقديم وصف أو عنوان' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `DEP-${year}-${r}`; if (!await db.wasteBlackSpot.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `DEP-${year}-${Date.now().toString(36).toUpperCase()}`
    const spot = await db.wasteBlackSpot.create({ data: { reference, commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null, description: description || '', wasteType: wasteType || 'MIXED', recurring: recurring || false, recurrenceCount: 1, source: source || 'INTERNAL' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WASTE_BLACK_SPOT', entityId: spot.id, commune: enforcedCommune, details: { reference: spot.reference } })
    return NextResponse.json(spot, { status: 201 })
  } catch (error) { console.error('POST waste-spots error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
