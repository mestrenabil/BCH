import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const communeFilter = getScopedCommuneFilter(user, new URL(request.url).searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    const categories = await db.productCategory.findMany({ where, orderBy: { label: 'asc' } })
    return NextResponse.json({ categories })
  } catch (error) {
    console.error('GET product categories error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل فئات المنتجات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const label = typeof body.label === 'string' ? body.label.trim() : ''
    const commune = resolveRecordCommune(user, body.commune)
    const territoryFilter = getTerritoryFilterFromValue(body.territoryFilter)

    if (label.length < 2) return NextResponse.json({ error: 'يرجى إدخال اسم فئة صحيح' }, { status: 400 })
    if (!commune) return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إضافة الفئة' }, { status: 400 })
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(commune, territoryFilter)) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي الحالي' }, { status: 403 })
    }

    const category = await db.productCategory.create({
      data: { key: `CUSTOM_${randomUUID().replaceAll('-', '').slice(0, 16)}`, label, commune },
    })
    return NextResponse.json({ category }, { status: 201 })
  } catch (error) {
    console.error('POST product category error:', error)
    if (error instanceof Error && error.message.includes('Unique constraint')) {
      return NextResponse.json({ error: 'هذه الفئة موجودة مسبقاً في الجماعة' }, { status: 409 })
    }
    return NextResponse.json({ error: 'حدث خطأ أثناء إضافة فئة المنتج' }, { status: 500 })
  }
}
