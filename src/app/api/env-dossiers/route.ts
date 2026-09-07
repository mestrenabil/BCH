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
    const category = searchParams.get('category')
    const riskLevel = searchParams.get('riskLevel')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (category) where.category = category
    if (riskLevel) where.riskLevel = riskLevel
    if (search) { where.OR = [{ reference: { contains: search } }, { title: { contains: search } }, { description: { contains: search } }, { quartier: { contains: search } }, { company: { contains: search } }] }
    const dossiers = await db.environmentalDossier.findMany({ where: where as any, orderBy: { createdAt: 'desc' }, take: limit })
    const total = await db.environmentalDossier.count({ where: where as any })
    return NextResponse.json({ dossiers, total })
  } catch (error) { console.error('GET env-dossiers error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { title, category, commune, quartier, adresse, latitude, longitude, description, priority, assignedTo, company, notes, source, probableSource, extent, exposedPopulation, milieu, servicesConcerned, legalReference, measuresTaken, dueDate, inspectionDate, nextFollowUpDate, probability, severity } = body
    if (!title && !description) return NextResponse.json({ error: 'يرجى تقديم عنوان أو وصف' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `ENV-${year}-${r}`; if (!await db.environmentalDossier.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `ENV-${year}-${Date.now().toString(36).toUpperCase()}`
    const normalizedProbability = Math.max(1, Math.min(5, Number(probability) || 1))
    const normalizedSeverity = Math.max(1, Math.min(5, Number(severity) || 1))
    const normalizedRiskScore = normalizedProbability * normalizedSeverity * 4
    const normalizedRiskLevel = normalizedRiskScore >= 80 ? 'CRITICAL' : normalizedRiskScore >= 48 ? 'HIGH' : normalizedRiskScore >= 24 ? 'MEDIUM' : 'LOW'
    const dossier = await db.environmentalDossier.create({ data: {
      reference, title: title || '', category: category || 'OTHER', commune: enforcedCommune,
      quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null,
      description: description || '', priority: priority || 'NORMALE', assignedTo: assignedTo || '', company: company || '', notes: notes || '',
      riskScore: normalizedRiskScore, riskLevel: normalizedRiskLevel,
      probability: normalizedProbability, severity: normalizedSeverity,
      source: source || 'INTERNAL', probableSource: probableSource || '', extent: extent || '',
      exposedPopulation: Math.max(0, Number(exposedPopulation) || 0), milieu: milieu || '',
      servicesConcerned: Array.isArray(servicesConcerned) ? JSON.stringify(servicesConcerned) : (servicesConcerned || '[]'),
      legalReference: legalReference || '', measuresTaken: measuresTaken || '', dueDate: dueDate ? new Date(dueDate) : null,
      inspectionDate: inspectionDate ? new Date(inspectionDate) : null, nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
    } })

    let unifiedReference = ''
    for (let i = 0; i < 5; i++) {
      const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `DOS-${year}-${suffix}`
      if (!await db.dossier.findUnique({ where: { reference: candidate }, select: { id: true } })) { unifiedReference = candidate; break }
    }
    if (!unifiedReference) unifiedReference = `DOS-${year}-${Date.now().toString(36).toUpperCase()}`

    const unified = await db.dossier.create({ data: {
      reference: unifiedReference, office: 'OFFICE_06', type: 'ENVIRONMENTAL', title: dossier.title,
      description: dossier.description, status: dossier.status, priority: dossier.priority, commune: dossier.commune,
      quartier: dossier.quartier, adresse: dossier.adresse, latitude: dossier.latitude, longitude: dossier.longitude,
      assignedTo: dossier.assignedTo, dueDate: dossier.dueDate, createdBy: user.id, createdByName: user.nom,
      notes: JSON.stringify({ environmentalDossierId: dossier.id, environmentalReference: dossier.reference }),
      events: { create: { toStatus: 'NEW', action: 'CREATE', reason: 'إنشاء ملف بيئي', changedBy: user.id, changedByName: user.nom, metadata: JSON.stringify({ environmentalDossierId: dossier.id }) } },
    } })
    await db.environmentalDossier.update({ where: { id: dossier.id }, data: { unifiedDossierId: unified.id } })
    await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: dossier.id, commune: enforcedCommune, details: { reference: dossier.reference, title } })
    return NextResponse.json({ ...dossier, unifiedDossierId: unified.id }, { status: 201 })
  } catch (error) { console.error('POST env-dossiers error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
