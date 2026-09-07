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
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (search) {
      where.OR = [{ reference: { contains: search } }, { deceasedName: { contains: search } }, { originPlace: { contains: search } }, { destinationPlace: { contains: search } }, { vehiclePlate: { contains: search } }]
    }
    const transports = await db.corpseTransport.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
    const total = await db.corpseTransport.count({ where })
    return NextResponse.json({ transports, total })
  } catch (error) {
    console.error('GET corpse-transports error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { deceasedName, commune, originPlace, destinationPlace, transportDate, vehiclePlate, driverName, driverPhone, deathCaseId, notes } = body
    if (!deceasedName) return NextResponse.json({ error: 'يرجى تقديم اسم المتوفى' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `TRANS-${year}-${r}`
      if (!await db.corpseTransport.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `TRANS-${year}-${Date.now().toString(36).toUpperCase()}`
    const transport = await db.corpseTransport.create({
      data: {
        reference, deceasedName, commune: enforcedCommune, originPlace: originPlace || '', destinationPlace: destinationPlace || '',
        transportDate: transportDate ? new Date(transportDate) : null, vehiclePlate: vehiclePlate || '',
        driverName: driverName || '', driverPhone: driverPhone || '', deathCaseId: deathCaseId || null, notes: notes || '',
        // ⚠️ إذن النقل يبدأ PENDING
        authorizationStatus: 'PENDING', status: 'NEW',
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'CORPSE_TRANSPORT', entityId: transport.id, commune: enforcedCommune, details: { reference: transport.reference, deceasedName } })
    return NextResponse.json(transport, { status: 201 })
  } catch (error) {
    console.error('POST corpse-transports error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
