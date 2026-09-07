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
    const type = searchParams.get('type')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (type) where.type = type
    const sites = await db.naturalSite.findMany({ where: where as any, orderBy: { createdAt: 'desc' }, take: limit, include: { environmentalDossier: { select: { id: true, reference: true, title: true } } } })
    const total = await db.naturalSite.count({ where: where as any })
    return NextResponse.json({ sites, total })
  } catch (error) { console.error('GET natural-sites error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { name, type, commune, quartier, adresse, latitude, longitude, area, description, protectionLevel, status, threats } = body
    if (!name) return NextResponse.json({ error: 'يرجى تقديم اسم الموقع' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `SITE-${year}-${r}`; if (!await db.naturalSite.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `SITE-${year}-${Date.now().toString(36).toUpperCase()}`
    const site = await db.naturalSite.create({ data: { reference, name, type: type || 'FOREST', commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null, area: area ? parseFloat(area) : null, description: description || '', protectionLevel: protectionLevel || 'NONE', status: status || 'INTACT', threats: threats || '' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'NATURAL_SITE', entityId: site.id, commune: enforcedCommune, details: { reference: site.reference, name } })
    return NextResponse.json(site, { status: 201 })
  } catch (error) { console.error('POST natural-sites error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
