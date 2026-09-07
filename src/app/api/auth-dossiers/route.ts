import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const REQUEST_TYPES = new Set(['COMMERCIAL', 'BUILDING', 'OCCUPANCY', 'CONFORMITY', 'CLASSIFIED'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const requestType = searchParams.get('requestType')
    const opinionStatus = searchParams.get('opinionStatus')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (requestType) where.requestType = requestType
    if (opinionStatus) where.opinionStatus = opinionStatus
    if (search) { where.OR = [{ reference: { contains: search } }, { applicantName: { contains: search } }, { establishmentName: { contains: search } }, { rokhasReference: { contains: search } }] }
    const dossiers = await db.authorizationDossier.findMany({ where: where as any, orderBy: { createdAt: 'desc' }, take: limit })
    const total = await db.authorizationDossier.count({ where: where as any })
    return NextResponse.json({ dossiers, total })
  } catch (error) { console.error('GET auth-dossiers error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { applicantName, applicantCin, applicantPhone, establishmentName, activity, commune, quartier, adresse, requestType, rokhasReference, competentAuthority, legalReference, checklistJson, notes } = body
    if (!applicantName && !establishmentName) return NextResponse.json({ error: 'يرجى تقديم اسم مقدم الطلب أو المنشأة' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) { const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase(); const c = `AUT-${year}-${r}`; if (!await db.authorizationDossier.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break } }
    if (!reference) reference = `AUT-${year}-${Date.now().toString(36).toUpperCase()}`
    const finalRequestType = typeof requestType === 'string' && REQUEST_TYPES.has(requestType) ? requestType : 'COMMERCIAL'
    const dossier = await db.authorizationDossier.create({ data: { reference, applicantName: applicantName || '', applicantCin: applicantCin || '', applicantPhone: applicantPhone || '', establishmentName: establishmentName || '', activity: activity || '', commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', requestType: finalRequestType, rokhasReference: rokhasReference || '', competentAuthority: competentAuthority || '', legalReference: legalReference || '', checklistJson: checklistJson || '[]', notes: notes || '', opinionStatus: 'PENDING', status: 'NEW' } })
    await recordActivity({ user, action: 'CREATE', entityType: 'AUTHORIZATION_DOSSIER', entityId: dossier.id, commune: enforcedCommune, details: { reference: dossier.reference, requestType: finalRequestType } })
    return NextResponse.json(dossier, { status: 201 })
  } catch (error) { console.error('POST auth-dossiers error:', error); return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 }) }
}
