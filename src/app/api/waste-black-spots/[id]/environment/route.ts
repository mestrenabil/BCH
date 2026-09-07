import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { linkWasteSpotToEnvironmentalDossier } from '@/lib/environment-links'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params
    const spot = await db.wasteBlackSpot.findUnique({ where: { id } })
    if (!spot) return NextResponse.json({ error: 'نقطة النفايات غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, spot.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const linked = await linkWasteSpotToEnvironmentalDossier(spot, user)
    if (!linked.alreadyLinked) await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_DOSSIER', entityId: linked.dossier.id, commune: linked.dossier.commune, details: { reference: linked.dossier.reference, wasteReference: spot.reference } })
    return NextResponse.json(linked, { status: linked.alreadyLinked ? 200 : 201 })
  } catch (error) {
    console.error('POST waste environmental dossier error:', error)
    return NextResponse.json({ error: 'فشل تحويل نقطة النفايات إلى ملف بيئي' }, { status: 500 })
  }
}
