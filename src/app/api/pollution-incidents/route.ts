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
    const severity = searchParams.get('severity')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (type) where.type = type
    if (severity) where.severity = severity
    if (search) { where.OR = [{ reference: { contains: search } }, { description: { contains: search } }, { quartier: { contains: search } }, { pollutantName: { contains: search } }, { company: { contains: search } }] }
    const incidents = await db.pollutionIncident.findMany({ where: where as any, orderBy: { createdAt: 'desc' }, take: limit, include: { environmentalDossier: { select: { id: true, reference: true, title: true } } } })
    const total = await db.pollutionIncident.count({ where: where as any })
    return NextResponse.json({ incidents, total })
  } catch (error) { console.error('GET pollution error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { type, commune, quartier, adresse, latitude, longitude, description, source, declarantName, declarantPhone, pollutantName, severity, company } = body
    if (!description) return NextResponse.json({ error: 'يرجى تقديم وصف' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `POL-${year}-${r}`; if (!await db.pollutionIncident.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `POL-${year}-${Date.now().toString(36).toUpperCase()}`
    const incident = await db.pollutionIncident.create({ data: { reference, type: type || 'AIR', commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null, description, source: source || 'INTERNAL', declarantName: declarantName || '', declarantPhone: declarantPhone || '', pollutantName: pollutantName || '', severity: severity || 'LOW', company: company || '' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'POLLUTION_INCIDENT', entityId: incident.id, commune: enforcedCommune, details: { reference: incident.reference, type: incident.type, severity: incident.severity } })
    return NextResponse.json(incident, { status: 201 })
  } catch (error) { console.error('POST pollution error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
