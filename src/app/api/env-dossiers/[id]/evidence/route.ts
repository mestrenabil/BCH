import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const dossier = await db.environmentalDossier.findUnique({ where: { id }, select: { commune: true } })
    if (!dossier) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    return NextResponse.json({ evidence: await db.environmentalEvidence.findMany({ where: { environmentalDossierId: id }, orderBy: { createdAt: 'desc' } }) })
  } catch { return NextResponse.json({ error: 'تعذر تحميل الأدلة' }, { status: 500 }) }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const body = await request.json()
    const dossier = await db.environmentalDossier.findUnique({ where: { id } })
    if (!dossier) return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    if (typeof body.url !== 'string' || body.url.length < 20 || body.url.length > 8_000_000) return NextResponse.json({ error: 'حجم أو محتوى الدليل غير صالح' }, { status: 400 })
    const evidence = await db.environmentalEvidence.create({ data: { environmentalDossierId: id, url: body.url, caption: String(body.caption || '').slice(0, 500), type: ['BEFORE', 'AFTER', 'INSPECTION', 'ANALYSIS', 'CORRESPONDENCE'].includes(body.type) ? body.type : 'INSPECTION', mimeType: String(body.mimeType || '').slice(0, 100), originalName: String(body.originalName || '').slice(0, 200), uploadedBy: user.nom } })
    await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_EVIDENCE', entityId: evidence.id, commune: dossier.commune, details: { dossierId: id, type: evidence.type, originalName: evidence.originalName } })
    return NextResponse.json(evidence, { status: 201 })
  } catch { return NextResponse.json({ error: 'فشل حفظ الدليل' }, { status: 500 }) }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const { evidenceId } = await request.json()
    const evidence = await db.environmentalEvidence.findUnique({ where: { id: evidenceId }, include: { environmentalDossier: { select: { commune: true } } } })
    if (!evidence || evidence.environmentalDossierId !== id) return NextResponse.json({ error: 'الدليل غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, evidence.environmentalDossier.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    await db.environmentalEvidence.delete({ where: { id: evidenceId } })
    return NextResponse.json({ success: true })
  } catch { return NextResponse.json({ error: 'فشل حذف الدليل' }, { status: 500 }) }
}
