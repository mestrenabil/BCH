import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, getScopedCommuneFilter, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

function riskLevel(score: number) {
  if (score >= 80) return 'CRITICAL'
  if (score >= 48) return 'HIGH'
  if (score >= 24) return 'MEDIUM'
  return 'LOW'
}

async function referenceFor(year: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `EINS-${year}-${suffix}`
    if (!await db.environmentalInspection.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `EINS-${year}-${Date.now().toString(36).toUpperCase()}`
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where = communeFilter ? { commune: communeFilter } : {}
    const inspections = await db.environmentalInspection.findMany({ where, orderBy: { inspectionDate: 'desc' }, take: 500, include: { environmentalDossier: { select: { reference: true, title: true } } } })
    return NextResponse.json({ inspections })
  } catch (error) {
    console.error('GET environmental inspections error:', error)
    return NextResponse.json({ error: 'تعذر تحميل المعاينات البيئية' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const dossier = await db.environmentalDossier.findUnique({ where: { id: body.environmentalDossierId } })
    if (!dossier) return NextResponse.json({ error: 'الملف البيئي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const probability = Math.max(1, Math.min(5, Number(body.probability) || 1))
    const severity = Math.max(1, Math.min(5, Number(body.severity) || 1))
    const score = probability * severity * 4
    const inspection = await db.environmentalInspection.create({ data: {
      reference: await referenceFor(new Date().getFullYear()), environmentalDossierId: dossier.id, commune: dossier.commune,
      inspectionDate: body.inspectionDate ? new Date(body.inspectionDate) : new Date(), inspectorName: body.inspectorName || user.nom,
      observation: body.observation || '', probableSource: body.probableSource || '', extent: body.extent || '',
      exposedPopulation: Math.max(0, Number(body.exposedPopulation) || 0), milieu: body.milieu || '', probability, severity,
      riskScore: score, riskLevel: riskLevel(score), resolution: body.resolution || 'PENDING', nextAction: body.nextAction || '',
      nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null, notes: body.notes || '',
    } })
    await db.environmentalDossier.update({ where: { id: dossier.id }, data: { inspectionDate: inspection.inspectionDate, probableSource: inspection.probableSource, extent: inspection.extent, exposedPopulation: inspection.exposedPopulation, milieu: inspection.milieu, riskScore: score, riskLevel: inspection.riskLevel, nextFollowUpDate: inspection.nextFollowUpDate, status: 'INSPECTED' } })
    if (dossier.unifiedDossierId) await db.dossier.update({ where: { id: dossier.unifiedDossierId }, data: { status: 'INSPECTED', events: { create: { fromStatus: dossier.status, toStatus: 'INSPECTED', action: 'INSPECTION', reason: inspection.observation || 'معاينة ميدانية', changedBy: user.id, changedByName: user.nom, metadata: JSON.stringify({ environmentalInspectionId: inspection.id, riskScore: score }) } } } })
    await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_INSPECTION', entityId: inspection.id, commune: dossier.commune, details: { reference: inspection.reference, environmentalDossierId: dossier.id, riskScore: score } })
    return NextResponse.json(inspection, { status: 201 })
  } catch (error) {
    console.error('POST environmental inspection error:', error)
    return NextResponse.json({ error: 'فشل تسجيل المعاينة البيئية' }, { status: 500 })
  }
}
