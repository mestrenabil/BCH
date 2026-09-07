import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { ensureFoodReportDossier } from '@/lib/vigilance-links'

const ALLOWED_TYPES = new Set(['RESTAURANT', 'EXPIRED_PRODUCT', 'STREET_VENDOR', 'PREMISES_HYGIENE'])
const ALLOWED_STATUS = new Set(['NOUVEAU', 'VERIFICATION', 'VALIDE', 'EN_COURS', 'TRAITE', 'REJETE', 'CLASSE'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const reportType = searchParams.get('reportType')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (statut) where.statut = statut
    if (reportType) where.reportType = reportType
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { establishmentName: { contains: search } },
        { description: { contains: search } },
        { quartier: { contains: search } },
      ]
    }

    const reports = await db.foodReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { photos: { orderBy: { createdAt: 'desc' }, take: 1 } },
    })

    const total = await db.foodReport.count({ where })

    return NextResponse.json({ reports, total })
  } catch (error) {
    console.error('GET food-reports error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البلاغات الغذائية' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      commune, quartier, adresse, latitude, longitude,
      reportType, establishmentName, establishmentType, description, priority,
    } = body

    if (!description && !establishmentName) {
      return NextResponse.json({ error: 'يرجى تقديم وصف أو اسم المنشأة' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء البلاغ' }, { status: 400 })
    }

    const finalType = ALLOWED_TYPES.has(reportType) ? reportType : 'RESTAURANT'

    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `SIG-FOOD-${year}-${random}`
      const exists = await db.foodReport.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) reference = `SIG-FOOD-${year}-${Date.now().toString(36).toUpperCase()}`

    const report = await db.foodReport.create({
      data: {
        reference,
        source: 'INTERNAL',
        commune: enforcedCommune,
        quartier: quartier || '',
        adresse: adresse || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        reportType: finalType,
        establishmentName: establishmentName || '',
        establishmentType: establishmentType || '',
        description: description || '',
        priority: priority || 'NORMALE',
        statut: 'NOUVEAU',
      },
    })
    try {
      await ensureFoodReportDossier(report, user)
    } catch (linkError) {
      console.error('Create food report dossier error:', linkError)
    }

    await recordActivity({
      user, action: 'CREATE', entityType: 'FOOD_REPORT', entityId: report.id,
      commune: enforcedCommune, details: { reference: report.reference, reportType: finalType },
    })

    return NextResponse.json(report, { status: 201 })
  } catch (error) {
    console.error('POST food-reports error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء البلاغ الغذائي' }, { status: 500 })
  }
}
