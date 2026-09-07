import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const { documentId } = await request.json()
    if (!documentId) return NextResponse.json({ error: 'يرجى اختيار المستند' }, { status: 400 })
    const [dossier, document] = await Promise.all([
      db.environmentalDossier.findUnique({ where: { id } }),
      db.document.findUnique({ where: { id: documentId } }),
    ])
    if (!dossier || !document) return NextResponse.json({ error: 'الملف أو المستند غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, dossier.commune) || !canAccessCommune(user, document.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const link = await db.environmentalDossierDocument.upsert({
      where: { environmentalDossierId_documentId: { environmentalDossierId: id, documentId } },
      create: { environmentalDossierId: id, documentId }, update: {}, include: { document: true },
    })
    await recordActivity({ user, action: 'UPDATE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: id, commune: dossier.commune, details: { reference: dossier.reference, documentId } })
    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    console.error('POST env dossier document error:', error)
    return NextResponse.json({ error: 'فشل ربط المستند' }, { status: 500 })
  }
}
