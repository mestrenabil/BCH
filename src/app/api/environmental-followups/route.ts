import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, getScopedCommuneFilter, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

async function makeReference(year: number) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `EFOL-${year}-${suffix}`
    if (!await db.environmentalFollowUp.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `EFOL-${year}-${Date.now().toString(36).toUpperCase()}`
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const dossierId = searchParams.get('dossierId')
    const dossier = dossierId ? await db.environmentalDossier.findUnique({ where: { id: dossierId }, select: { commune: true } }) : null
    if (dossierId && (!dossier || !canAccessCommune(user, dossier.commune))) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where = dossierId ? { environmentalDossierId: dossierId } : (communeFilter ? { commune: communeFilter } : {})
    return NextResponse.json({ followUps: await db.environmentalFollowUp.findMany({ where, orderBy: { followUpDate: 'desc' }, take: 500 }) })
  } catch { return NextResponse.json({ error: 'تعذر تحميل المتابعات' }, { status: 500 }) }
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
    const damageRemoved = ['YES', 'NO', 'PARTIAL', 'PENDING'].includes(body.damageRemoved) ? body.damageRemoved : 'PENDING'
    const followUp = await db.environmentalFollowUp.create({ data: {
      reference: await makeReference(new Date().getFullYear()), environmentalDossierId: dossier.id, commune: dossier.commune,
      followUpDate: body.followUpDate ? new Date(body.followUpDate) : new Date(), employeeName: body.employeeName || user.nom,
      currentStatus: body.currentStatus || '', damageRemoved, notes: body.notes || '', nextAction: body.nextAction || '', nextFollowUpDate: body.nextFollowUpDate ? new Date(body.nextFollowUpDate) : null,
    } })
    const nextStatus = damageRemoved === 'YES' ? 'RESOLVED' : 'FOLLOW_UP'
    await db.environmentalDossier.update({ where: { id: dossier.id }, data: { status: nextStatus, nextFollowUpDate: followUp.nextFollowUpDate } })
    if (dossier.unifiedDossierId) await db.dossier.update({ where: { id: dossier.unifiedDossierId }, data: { status: nextStatus, events: { create: { fromStatus: dossier.status, toStatus: nextStatus, action: 'FOLLOW_UP', reason: followUp.notes || followUp.nextAction || 'إعادة معاينة', changedBy: user.id, changedByName: user.nom, metadata: JSON.stringify({ environmentalFollowUpId: followUp.id, damageRemoved }) } } } })
    await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_FOLLOW_UP', entityId: followUp.id, commune: dossier.commune, details: { reference: followUp.reference, dossierId: dossier.id, damageRemoved } })
    return NextResponse.json(followUp, { status: 201 })
  } catch { return NextResponse.json({ error: 'فشل حفظ إعادة المعاينة' }, { status: 500 }) }
}
