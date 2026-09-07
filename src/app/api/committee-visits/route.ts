import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const recommendation = searchParams.get('recommendation')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (recommendation) where.recommendation = recommendation
    const visits = await db.committeeVisit.findMany({ where: where as any, orderBy: { visitDate: 'desc' }, take: limit })
    const total = await db.committeeVisit.count({ where: where as any })
    return NextResponse.json({ visits, total })
  } catch (error) { console.error('GET committee-visits error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { dossierId, establishmentName, commune, visitDate, participantsJson, inspectionNotes, notes } = body
    if (!establishmentName && !dossierId) return NextResponse.json({ error: 'يرجى تقديم اسم المنشأة أو ملف مرتبط' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    if (dossierId) {
      const dossier = await db.authorizationDossier.findUnique({ where: { id: String(dossierId) }, select: { commune: true } })
      if (!dossier || !canAccessCommune(user, dossier.commune) || dossier.commune !== enforcedCommune) return NextResponse.json({ error: 'ملف الترخيص غير متاح ضمن الجماعة المحددة' }, { status: 400 })
    }
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `VIS-${year}-${r}`; if (!await db.committeeVisit.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `VIS-${year}-${Date.now().toString(36).toUpperCase()}`
    const visit = await db.committeeVisit.create({ data: { reference, dossierId: dossierId || null, establishmentName: establishmentName || '', commune: enforcedCommune, visitDate: visitDate ? new Date(visitDate) : new Date(), participantsJson: participantsJson || '[]', inspectionNotes: inspectionNotes || '', notes: notes || '', recommendation: 'PENDING', validationStatus: 'PENDING', status: 'PLANNED' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'COMMITTEE_VISIT', entityId: visit.id, commune: enforcedCommune, details: { reference: visit.reference } })
    return NextResponse.json(visit, { status: 201 })
  } catch (error) { console.error('POST committee-visits error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
