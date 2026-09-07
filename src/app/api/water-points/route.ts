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
    const waterPoints = await db.waterPoint.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
      include: { _count: { select: { measurements: true } } },
    })
    const total = await db.waterPoint.count({ where })
    return NextResponse.json({ waterPoints, total })
  } catch (error) {
    console.error('GET water-points error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { name, type, commune, quartier, adresse, latitude, longitude, operator, status, description } = body
    if (!name) return NextResponse.json({ error: 'يرجى تقديم اسم النقطة' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `PE-${year}-${r}`
      if (!await db.waterPoint.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `PE-${year}-${Date.now().toString(36).toUpperCase()}`
    const wp = await db.waterPoint.create({
      data: { reference, name, type: type || 'NETWORK', commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '', latitude: latitude ?? null, longitude: longitude ?? null, operator: operator || '', status: status || 'ACTIVE', description: description || '' },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_POINT', entityId: wp.id, commune: enforcedCommune, details: { reference: wp.reference, name } })
    return NextResponse.json(wp, { status: 201 })
  } catch (error) {
    console.error('POST water-points error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الإنشاء' }, { status: 500 })
  }
}
