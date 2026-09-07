import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { linkPollutionIncidentToEnvironmentalDossier } from '@/lib/environment-links'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const incident = await db.pollutionIncident.findUnique({ where: { id } })
    if (!incident) return NextResponse.json({ error: 'حادث التلوث غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, incident.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const linked = await linkPollutionIncidentToEnvironmentalDossier(incident, user)
    if (!linked.alreadyLinked) await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: linked.dossier.id, commune: linked.dossier.commune, details: { reference: linked.dossier.reference, pollutionReference: incident.reference } })
    return NextResponse.json(linked, { status: linked.alreadyLinked ? 200 : 201 })
  } catch (error) {
    console.error('POST pollution environmental dossier error:', error)
    return NextResponse.json({ error: 'فشل تحويل حادث التلوث إلى ملف بيئي' }, { status: 500 })
  }
}
