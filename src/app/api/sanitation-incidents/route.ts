import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set(['NEW', 'ASSIGNED', 'IN_PROGRESS', 'VERIFIED', 'CLOSED'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const riskLevel = searchParams.get('riskLevel')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (type) where.type = type
    if (status) where.status = status
    if (riskLevel) where.riskLevel = riskLevel
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { description: { contains: search } },
        { quartier: { contains: search } },
        { declarantName: { contains: search } },
      ]
    }
    const incidents = await db.sanitationIncident.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
    const total = await db.sanitationIncident.count({ where })
    return NextResponse.json({ incidents, total })
  } catch (error) {
    console.error('GET sanitation-incidents error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { type, commune, quartier, adresse, latitude, longitude, description, riskLevel, source, declarantName, declarantPhone, assignedTo } = body
    if (!description) return NextResponse.json({ error: 'يرجى تقديم وصف' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `ASS-${year}-${r}`
      if (!await db.sanitationIncident.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `ASS-${year}-${Date.now().toString(36).toUpperCase()}`
    const incident = await db.sanitationIncident.create({
      data: { reference, type: type || 'BLOCKAGE', commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null, description, riskLevel: riskLevel || 'LOW', source: source || 'INTERNAL', declarantName: declarantName || '', declarantPhone: declarantPhone || '', assignedTo: assignedTo || '', status: assignedTo ? 'ASSIGNED' : 'NEW' },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'SANITATION_INCIDENT', entityId: incident.id, commune: enforcedCommune, details: { reference: incident.reference, type: incident.type, riskLevel: incident.riskLevel } })
    return NextResponse.json(incident, { status: 201 })
  } catch (error) {
    console.error('POST sanitation-incidents error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
