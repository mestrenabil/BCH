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
      where.OR = [
        { reference: { contains: search } }, { deceasedName: { contains: search } },
        { deceasedCin: { contains: search } }, { plotSection: { contains: search } },
      ]
    }
    const burials = await db.burialDossier.findMany({
      where: where as any, orderBy: { createdAt: 'desc' }, take: limit,
      include: { cemetery: { select: { id: true, reference: true, name: true } } },
    })
    const total = await db.burialDossier.count({ where })
    return NextResponse.json({ burials, total })
  } catch (error) {
    console.error('GET burials error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { deceasedName, deceasedCin, commune, cemeteryId, plotSection, burialDate, deathCaseId, officiantName, notes } = body
    if (!deceasedName) return NextResponse.json({ error: 'يرجى تقديم اسم المتوفى' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `DEF-${year}-${r}`
      if (!await db.burialDossier.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `DEF-${year}-${Date.now().toString(36).toUpperCase()}`
    const burial = await db.burialDossier.create({
      data: {
        reference, deceasedName, deceasedCin: deceasedCin || '', commune: enforcedCommune,
        cemeteryId: cemeteryId || null, plotSection: plotSection || '',
        burialDate: burialDate ? new Date(burialDate) : null, deathCaseId: deathCaseId || null,
        officiantName: officiantName || '', notes: notes || '',
        // ⚠️ إذن الدفن يبدأ PENDING — يتطلب مصادقة يدوية
        authorizationStatus: 'PENDING', status: 'NEW',
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'BURIAL_DOSSIER', entityId: burial.id, commune: enforcedCommune, details: { reference: burial.reference, deceasedName, authStatus: 'PENDING' } })
    return NextResponse.json(burial, { status: 201 })
  } catch (error) {
    console.error('POST burials error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
