import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set(['NEW', 'TO_VERIFY', 'INSPECTION_SCHEDULED', 'IN_PROGRESS', 'PENDING', 'FORMAL_NOTICE', 'TO_CONTROL', 'TRANSMITTED', 'INSPECTED', 'ACTION_REQUIRED', 'FOLLOW_UP', 'PENDING_VALIDATION', 'RESOLVED', 'CLOSED', 'ARCHIVED'])
const EDITABLE_FIELDS = ['title', 'category', 'quartier', 'adresse', 'latitude', 'longitude', 'description', 'riskScore', 'riskLevel', 'probability', 'severity', 'priority', 'assignedTo', 'company', 'progress', 'notes', 'source', 'probableSource', 'extent', 'exposedPopulation', 'milieu', 'servicesConcerned', 'legalReference', 'measuresTaken']
const DATE_FIELDS = ['dueDate', 'inspectionDate', 'nextFollowUpDate']

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const dossier = await db.environmentalDossier.findUnique({
      where: { id },
      include: { documents: { include: { document: true }, orderBy: { createdAt: 'desc' } }, evidence: { orderBy: { createdAt: 'desc' } }, complaints: { select: { id: true, reference: true, type: true, statut: true, source: true }, orderBy: { createdAt: 'desc' } }, inspections: { orderBy: { inspectionDate: 'desc' }, take: 20 } },
    })
    if (!dossier) return NextResponse.json({ error: 'الملف البيئي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const unifiedDossier = dossier.unifiedDossierId
      ? await db.dossier.findUnique({ where: { id: dossier.unifiedDossierId }, include: { events: { orderBy: { createdAt: 'desc' } } } })
      : null
    return NextResponse.json({ dossier, unifiedDossier })
  } catch (error) {
    console.error('GET env dossier error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.environmentalDossier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الملف البيئي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json()
    const data: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue
      if (field === 'progress' || field === 'riskScore' || field === 'exposedPopulation') data[field] = Math.max(0, Number(body[field]) || 0)
      else if (field === 'probability' || field === 'severity') data[field] = Math.max(1, Math.min(5, Number(body[field]) || 1))
      else if (field === 'servicesConcerned') data[field] = Array.isArray(body[field]) ? JSON.stringify(body[field]) : String(body[field] || '[]')
      else data[field] = body[field]
    }
    for (const field of DATE_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field] ? new Date(body[field]) : null
    }
    if (body.probability !== undefined || body.severity !== undefined) {
      const probability = Math.max(1, Math.min(5, Number(body.probability ?? existing.probability) || 1))
      const severity = Math.max(1, Math.min(5, Number(body.severity ?? existing.severity) || 1))
      data.riskScore = probability * severity
      data.riskLevel = probability * severity >= 20 ? 'CRITICAL' : probability * severity >= 12 ? 'HIGH' : probability * severity >= 6 ? 'MEDIUM' : 'LOW'
    }
    const status = body.status
    if (status !== undefined && status !== existing.status) {
      if (!ALLOWED_STATUS.has(status)) return NextResponse.json({ error: 'حالة غير صالحة' }, { status: 400 })
      data.status = status
      if (status === 'CLOSED' || status === 'ARCHIVED') data.closedAt = new Date()
    }

    const updated = await db.environmentalDossier.update({ where: { id }, data })
    if (updated.unifiedDossierId) {
      const unifiedData: Record<string, unknown> = {
        title: updated.title, description: updated.description, priority: updated.priority, quartier: updated.quartier,
        adresse: updated.adresse, latitude: updated.latitude, longitude: updated.longitude, assignedTo: updated.assignedTo, dueDate: updated.dueDate,
      }
      if (status !== undefined && status !== existing.status) {
        unifiedData.status = status
        if (status === 'CLOSED' || status === 'ARCHIVED') unifiedData.closedAt = new Date()
        await db.dossier.update({ where: { id: updated.unifiedDossierId }, data: { ...unifiedData, events: { create: { fromStatus: existing.status, toStatus: status, action: 'STATUS_CHANGE', reason: body.reason || '', changedBy: user.id, changedByName: user.nom, metadata: JSON.stringify({ environmentalDossierId: id }) } } } })
      } else {
        await db.dossier.update({ where: { id: updated.unifiedDossierId }, data: unifiedData })
      }
    }
    await recordActivity({ user, action: status !== undefined && status !== existing.status ? 'STATUS_CHANGE' : 'UPDATE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: id, commune: existing.commune, details: { reference: existing.reference, fields: Object.keys(data) } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT env dossier error:', error)
    return NextResponse.json({ error: 'فشل تحديث الملف البيئي' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const existing = await db.environmentalDossier.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'الملف البيئي غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    await db.$transaction([
      db.environmentalDossier.delete({ where: { id } }),
      ...(existing.unifiedDossierId ? [db.dossier.delete({ where: { id: existing.unifiedDossierId } })] : []),
    ])
    await recordActivity({ user, action: 'DELETE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: id, commune: existing.commune, details: { reference: existing.reference } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE env dossier error:', error)
    return NextResponse.json({ error: 'فشل حذف الملف البيئي' }, { status: 500 })
  }
}
