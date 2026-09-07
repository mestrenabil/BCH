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
    const type = searchParams.get('type')
    const status = searchParams.get('status')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (type) where.type = type
    if (status) where.status = status
    const pools = await db.pool.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit })
    const total = await db.pool.count({ where })
    return NextResponse.json({ pools, total })
  } catch (error) {
    console.error('GET pools error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { name, type, commune, quartier, adresse, latitude, longitude, operator, status, waterType, notes } = body
    if (!name) return NextResponse.json({ error: 'يرجى تقديم اسم المسبح' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `PISC-${year}-${r}`
      if (!await db.pool.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `PISC-${year}-${Date.now().toString(36).toUpperCase()}`
    const pool = await db.pool.create({
      data: { reference, name, type: type || 'SWIMMING', commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null, operator: operator || '', status: status || 'ACTIVE', waterType: waterType || 'TREATED', notes: notes || '' },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'POOL', entityId: pool.id, commune: enforcedCommune, details: { reference: pool.reference, name } })
    return NextResponse.json(pool, { status: 201 })
  } catch (error) {
    console.error('POST pools error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
