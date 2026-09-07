import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_CATEGORIES = new Set(['INSECTICIDE', 'RODENTICIDE', 'DISINFECTANT', 'REPELLENT', 'BAIT', 'OTHER'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')
    const lowStock = searchParams.get('lowStock') === 'true'
    const expiring = searchParams.get('expiring') === 'true'
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (category) where.category = category
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { commercialName: { contains: search } },
        { activeSubstance: { contains: search } },
        { lotNumber: { contains: search } },
      ]
    }
    const products = await db.pestProduct.findMany({
      where, orderBy: { createdAt: 'desc' }, take: limit,
      include: { _count: { select: { movements: true } } },
    })
    let filtered = products
    if (lowStock) filtered = filtered.filter(p => p.quantityStock <= p.thresholdAlert)
    if (expiring) {
      const limitDate = new Date(); limitDate.setDate(limitDate.getDate() + 90)
      filtered = filtered.filter(p => p.expiryDate && new Date(p.expiryDate) <= limitDate)
    }
    const total = await db.pestProduct.count({ where })
    return NextResponse.json({ products: filtered, total })
  } catch (error) {
    console.error('GET pest-products error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const { commercialName, activeSubstance, category, formulation, concentration, lotNumber, unit, quantityStock, thresholdAlert, expiryDate, target, supplier, unitPrice, commune, description } = body
    if (!commercialName) return NextResponse.json({ error: 'يرجى تقديم الاسم التجاري' }, { status: 400 })
    const enforcedCommune = resolveRecordCommune(user, commune || '') || ''
    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `PP-${year}-${r}`
      if (!await db.pestProduct.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `PP-${year}-${Date.now().toString(36).toUpperCase()}`
    const finalCategory = ALLOWED_CATEGORIES.has(category) ? category : 'OTHER'
    const qty = Math.max(0, parseInt(quantityStock) || 0)
    const product = await db.pestProduct.create({
      data: {
        reference, commercialName, activeSubstance: activeSubstance || '', category: finalCategory,
        formulation: formulation || '', concentration: concentration || '', lotNumber: lotNumber || '',
        unit: unit || 'LITRE', quantityStock: qty, thresholdAlert: parseInt(thresholdAlert) || 10,
        expiryDate: expiryDate ? new Date(expiryDate) : null, target: target || '',
        supplier: supplier || '', unitPrice: parseFloat(unitPrice) || 0, commune: enforcedCommune, description: description || '',
        // إذا أُدخل كمية ابتدائية، سجّل حركة إدخال
        movements: qty > 0 ? { create: [{ type: 'ENTREE', quantity: qty, reason: 'إدخال ابتدائي', commune: enforcedCommune, userName: user.nom }] } : undefined,
      },
      include: { movements: true },
    })
    await recordActivity({ user, action: 'CREATE', entityType: 'PEST_PRODUCT', entityId: product.id, commune: enforcedCommune, details: { reference: product.reference, commercialName, quantity: qty } })
    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    console.error('POST pest-products error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
