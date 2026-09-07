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
    const theme = searchParams.get('theme')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (theme) where.theme = theme
    const campaigns = await db.awarenessCampaign.findMany({ where: where as any, orderBy: { createdAt: 'desc' }, take: limit, include: { environmentalDossier: { select: { id: true, reference: true, title: true } }, environmentalProgram: { select: { id: true, reference: true, operation: true } } } })
    const total = await db.awarenessCampaign.count({ where: where as any })
    return NextResponse.json({ campaigns, total })
  } catch (error) { console.error('GET campaigns error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { title, theme, commune, description, targetAudience, startDate, endDate, budget, participantsCount, organizerName, notes, environmentalDossierId, environmentalProgramId, status, outcomes } = body
    if (!title) return NextResponse.json({ error: 'يرجى تقديم عنوان الحملة' }, { status: 400 })
    const dossier = environmentalDossierId ? await db.environmentalDossier.findUnique({ where: { id: String(environmentalDossierId) }, select: { id: true, commune: true } }) : null
    const program = environmentalProgramId ? await db.environmentalProgram.findUnique({ where: { id: String(environmentalProgramId) }, select: { id: true, commune: true } }) : null
    if (environmentalDossierId && !dossier) return NextResponse.json({ error: 'الملف البيئي المرتبط غير موجود' }, { status: 404 })
    if (environmentalProgramId && !program) return NextResponse.json({ error: 'العملية المبرمجة المرتبطة غير موجودة' }, { status: 404 })
    if (dossier && !resolveRecordCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح بالملف المرتبط' }, { status: 403 })
    if (program && !resolveRecordCommune(user, program.commune)) return NextResponse.json({ error: 'غير مصرح بالعملية المرتبطة' }, { status: 403 })
    if (dossier && program && dossier.commune !== program.commune) return NextResponse.json({ error: 'يجب أن تنتمي الروابط إلى نفس الجماعة' }, { status: 400 })
    const enforcedCommune = dossier?.commune || program?.commune || resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `CAMP-ENV-${year}-${r}`; if (!await db.awarenessCampaign.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `CAMP-ENV-${year}-${Date.now().toString(36).toUpperCase()}`
    const campaign = await db.awarenessCampaign.create({ data: { reference, title, theme: theme || 'GENERAL', commune: enforcedCommune, environmentalDossierId: dossier?.id || null, environmentalProgramId: program?.id || null, description: description || '', targetAudience: targetAudience || '', startDate: startDate ? new Date(startDate) : null, endDate: endDate ? new Date(endDate) : null, budget: budget ? parseFloat(budget) : null, participantsCount: Math.max(0, parseInt(participantsCount) || 0), organizerName: organizerName || '', status: status || 'PLANNED', outcomes: outcomes || '', notes: notes || '' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'AWARENESS_CAMPAIGN', entityId: campaign.id, commune: enforcedCommune, details: { reference: campaign.reference, title } })
    return NextResponse.json(campaign, { status: 201 })
  } catch (error) { console.error('POST campaigns error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
