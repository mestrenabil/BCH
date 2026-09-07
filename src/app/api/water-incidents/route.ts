import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const INCIDENT_TYPES = new Set(['OUTAGE', 'CONTAMINATION', 'LOW_PRESSURE', 'PIPE_BURST', 'FLOOD', 'OTHER'])
const SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
const STATUSES = new Set(['NEW', 'INVESTIGATING', 'RESPONDING', 'RESOLVED', 'CLOSED'])

function createReference() {
  const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
  return `INC-WATER-${new Date().getFullYear()}-${suffix}`
}

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function nonNegativeInt(value: unknown) {
  if (value === '' || value == null) return 0
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    const year = Number(searchParams.get('year'))
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) {
      where.startedAt = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
    }
    if (searchParams.get('status')) where.status = searchParams.get('status')
    if (searchParams.get('severity')) where.severity = searchParams.get('severity')
    if (searchParams.get('incidentType')) where.incidentType = searchParams.get('incidentType')
    const incidents = await db.waterIncident.findMany({ where, orderBy: { startedAt: 'desc' }, take: 500 })
    return NextResponse.json({ incidents, total: incidents.length })
  } catch (error) {
    console.error('GET water-incidents error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل حوادث المياه' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    if (!String(body.description || '').trim()) return NextResponse.json({ error: 'يرجى تقديم وصف للحادث' }, { status: 400 })
    const incidentType = INCIDENT_TYPES.has(body.incidentType) ? body.incidentType : 'OTHER'
    const severity = SEVERITIES.has(body.severity) ? body.severity : 'MEDIUM'
    const status = STATUSES.has(body.status) ? body.status : 'NEW'
    let reference = createReference()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (!await db.waterIncident.findUnique({ where: { reference }, select: { id: true } })) break
      reference = createReference()
    }
    const incident = await db.waterIncident.create({
      data: {
        reference,
        commune,
        quartier: String(body.quartier || ''),
        adresse: String(body.adresse || ''),
        latitude: body.latitude == null || body.latitude === '' ? null : Number(body.latitude),
        longitude: body.longitude == null || body.longitude === '' ? null : Number(body.longitude),
        incidentType,
        severity,
        source: String(body.source || 'INTERNAL'),
        description: String(body.description).trim(),
        affectedPopulation: nonNegativeInt(body.affectedPopulation),
        affectedPoints: nonNegativeInt(body.affectedPoints),
        startedAt: optionalDate(body.startedAt) || new Date(),
        resolvedAt: optionalDate(body.resolvedAt),
        assignedTo: String(body.assignedTo || ''),
        status,
        response: String(body.response || ''),
        notes: String(body.notes || ''),
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_INCIDENT', entityId: incident.id, commune, details: { reference, incidentType, severity, status } })
    return NextResponse.json(incident, { status: 201 })
  } catch (error) {
    console.error('POST water-incidents error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تسجيل حادث المياه' }, { status: 500 })
  }
}
