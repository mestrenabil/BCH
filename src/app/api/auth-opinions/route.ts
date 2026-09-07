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
    const result = searchParams.get('result')
    const validationStatus = searchParams.get('validationStatus')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (result) where.result = result
    if (validationStatus) where.validationStatus = validationStatus
    const opinions = await db.sanitaryOpinion.findMany({ where: where as any, orderBy: { date: 'desc' }, take: limit })
    const total = await db.sanitaryOpinion.count({ where: where as any })
    return NextResponse.json({ opinions, total })
  } catch (error) { console.error('GET auth-opinions error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { dossierId, establishmentName, commune, opinionType, observations, reservations, correctiveActions, recommendation, legalReference, notes } = body
    if (!establishmentName && !dossierId) return NextResponse.json({ error: 'يرجى تقديم اسم المنشأة أو ملف مرتبط' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    if (dossierId) {
      const dossier = await db.authorizationDossier.findUnique({ where: { id: String(dossierId) }, select: { commune: true } })
      if (!dossier || !canAccessCommune(user, dossier.commune) || dossier.commune !== enforcedCommune) return NextResponse.json({ error: 'ملف الترخيص غير متاح ضمن الجماعة المحددة' }, { status: 400 })
    }
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `AVIS-${year}-${r}`; if (!await db.sanitaryOpinion.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `AVIS-${year}-${Date.now().toString(36).toUpperCase()}`
    // ⚠️ الرأي يبدأ PENDING + validationStatus PENDING — يتطلب مصادقة يدوية
    const opinion = await db.sanitaryOpinion.create({ data: { reference, dossierId: dossierId || null, establishmentName: establishmentName || '', commune: enforcedCommune, opinionType: opinionType || 'COMMERCIAL', inspectorName: user.nom, observations: observations || '', reservations: reservations || '', correctiveActions: correctiveActions || '', recommendation: recommendation || '', legalReference: legalReference || '', notes: notes || '', result: 'PENDING', validationStatus: 'PENDING' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'SANITARY_OPINION', entityId: opinion.id, commune: enforcedCommune, details: { reference: opinion.reference, result: 'PENDING' } })
    return NextResponse.json(opinion, { status: 201 })
  } catch (error) { console.error('POST auth-opinions error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
