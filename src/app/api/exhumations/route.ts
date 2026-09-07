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
    const authStatus = searchParams.get('authorizationStatus')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (authStatus) where.authorizationStatus = authStatus
    if (search) {
      where.OR = [{ reference: { contains: search } }, { deceasedName: { contains: search } }, { requesterName: { contains: search } }, { plotSection: { contains: search } }]
    }
    const exhumations = await db.exhumationDossier.findMany({
      where: where as any, orderBy: { createdAt: 'desc' }, take: limit,
      include: { cemetery: { select: { id: true, reference: true, name: true } } },
    })
    const total = await db.exhumationDossier.count({ where })
    return NextResponse.json({ exhumations, total })
  } catch (error) {
    console.error('GET exhumations error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { deceasedName, deceasedCin, commune, cemeteryId, plotSection, originalBurialDate, exhumationDate, reason, newDestination, requesterName, requesterCin, notes } = body
    if (!deceasedName) return NextResponse.json({ error: 'يرجى تقديم اسم المتوفى' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `EXH-${year}-${r}`
      if (!await db.exhumationDossier.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `EXH-${year}-${Date.now().toString(36).toUpperCase()}`
    const exhumation = await db.exhumationDossier.create({
      data: {
        reference, deceasedName, deceasedCin: deceasedCin || '', commune: enforcedCommune,
        cemeteryId: cemeteryId || null, plotSection: plotSection || '',
        originalBurialDate: originalBurialDate ? new Date(originalBurialDate) : null,
        exhumationDate: exhumationDate ? new Date(exhumationDate) : null,
        reason: reason || '', newDestination: newDestination || '',
        requesterName: requesterName || '', requesterCin: requesterCin || '', notes: notes || '',
        // ⚠️ إذن النبش يبدأ PENDING — حساس جداً
        authorizationStatus: 'PENDING', status: 'NEW',
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'EXHUMATION_DOSSIER', entityId: exhumation.id, commune: enforcedCommune, details: { reference: exhumation.reference, deceasedName, authStatus: 'PENDING' } })
    return NextResponse.json(exhumation, { status: 201 })
  } catch (error) {
    console.error('POST exhumations error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
