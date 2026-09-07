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
      where.OR = [
        { reference: { contains: search } }, { deceasedName: { contains: search } },
        { deceasedCin: { contains: search } }, { declarantName: { contains: search } },
      ]
    }
    const deathCases = await db.deathCase.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
    const total = await db.deathCase.count({ where })
    return NextResponse.json({ deathCases, total })
  } catch (error) {
    console.error('GET death-cases error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { deceasedName, deceasedCin, deceasedAge, deceasedGender, deathDate, deathCause, deathPlace, commune, source, declarantName, declarantPhone, morgueStatus, notes } = body
    if (!deceasedName) return NextResponse.json({ error: 'يرجى تقديم اسم المتوفى' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `DEC-${year}-${r}`
      if (!await db.deathCase.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `DEC-${year}-${Date.now().toString(36).toUpperCase()}`
    const initialStatus = morgueStatus === 'ADMITTED' ? 'MORGUE' : 'NEW'
    const dc = await db.deathCase.create({
      data: {
        reference, deceasedName, deceasedCin: deceasedCin || '', deceasedAge: deceasedAge ? parseInt(deceasedAge) : null,
        deceasedGender: deceasedGender || '', deathDate: deathDate ? new Date(deathDate) : null,
        deathCause: deathCause || '', deathPlace: deathPlace || '', commune: enforcedCommune,
        source: source || 'INTERNAL', declarantName: declarantName || '', declarantPhone: declarantPhone || '',
        morgueStatus: morgueStatus || 'NONE', morgueAdmissionDate: morgueStatus === 'ADMITTED' ? new Date() : null,
        status: initialStatus, notes: notes || '',
      },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'DEATH_CASE', entityId: dc.id, commune: enforcedCommune, details: { reference: dc.reference, deceasedName } })
    return NextResponse.json(dc, { status: 201 })
  } catch (error) {
    console.error('POST death-cases error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
