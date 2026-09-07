import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { linkComplaintToEnvironmentalDossier } from '@/lib/environment-links'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const complaint = await db.complaint.findUnique({ where: { id } })
    if (!complaint) return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, complaint.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const linked = await linkComplaintToEnvironmentalDossier(complaint, user)
    if (!linked.alreadyLinked) {
      await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: linked.dossier.id, commune: linked.dossier.commune, details: { reference: linked.dossier.reference, complaintReference: complaint.reference } })
    }
    return NextResponse.json(linked, { status: linked.alreadyLinked ? 200 : 201 })
  } catch (error) {
    console.error('POST complaint environmental dossier error:', error)
    return NextResponse.json({ error: 'فشل تحويل الشكاية إلى ملف بيئي' }, { status: 500 })
  }
}
