import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { FINDING_SEVERITY_WEIGHTS } from '@/lib/constants'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const overallResult = searchParams.get('overallResult')
    const establishmentId = searchParams.get('establishmentId')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (type) where.type = type
    if (overallResult) where.overallResult = overallResult
    if (establishmentId) where.establishmentId = establishmentId

    const inspections = await db.inspection.findMany({
      where,
      orderBy: { inspectionDate: 'desc' },
      take: limit,
      include: {
        establishment: { select: { id: true, reference: true, name: true, activity: true, commune: true } },
        _count: { select: { findings: true, correctiveActions: true, counterVisits: true } },
      },
    })

    const total = await db.inspection.count({ where })

    return NextResponse.json({ inspections, total })
  } catch (error) {
    console.error('GET inspections error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل التفتيشات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { establishmentId, type, commune, inspectionDate, inspectorName, checklistJson, notes, foodReportId, findings } = body

    if (!establishmentId) {
      return NextResponse.json({ error: 'يرجى تحديد المنشأة' }, { status: 400 })
    }

    const establishment = await db.establishment.findUnique({ where: { id: establishmentId }, select: { commune: true, reference: true, name: true } })
    if (!establishment) {
      return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 })
    }

    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `INSP-${year}-${random}`
      const exists = await db.inspection.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) reference = `INSP-${year}-${Date.now().toString(36).toUpperCase()}`

    // احسب درجة المخاطر + النتيجة من النقائص
    let riskScore = 0
    let overallResult = 'CONFORM'
    const findingsData: { category: string; description: string; severity: string; weight: number; status: string }[] = []
    if (Array.isArray(findings)) {
      for (const f of findings) {
        const severity = f.severity || 'MINOR'
        const weight = FINDING_SEVERITY_WEIGHTS[severity] || 5
        riskScore += weight
        findingsData.push({
          category: f.category || '',
          description: f.description || '',
          severity,
          weight,
          status: 'OPEN',
        })
      }
    }
    riskScore = Math.min(100, riskScore)
    if (riskScore >= 70) overallResult = 'NON_CONFORM_CRITICAL'
    else if (riskScore >= 40) overallResult = 'NON_CONFORM_MAJOR'
    else if (riskScore >= 15) overallResult = 'NON_CONFORM_MINOR'
    else overallResult = 'CONFORM'

    const inspection = await db.inspection.create({
      data: {
        reference,
        establishmentId,
        type: type || 'PERIODIC',
        commune: establishment.commune,
        inspectionDate: inspectionDate ? new Date(inspectionDate) : new Date(),
        inspectorName: inspectorName || user.nom,
        inspectorId: user.id,
        overallResult,
        riskScore,
        checklistJson: checklistJson || '{}',
        notes: notes || '',
        status: 'COMPLETED',
        foodReportId: foodReportId || null,
        findings: { create: findingsData },
      },
      include: { findings: true },
    })

    // حدّث درجة مخاطر المنشأة (إجمالي النقائص المفتوحة عبر كل التفتيشات)
    const allOpenFindings = await db.finding.findMany({
      where: { inspection: { establishmentId }, status: 'OPEN' },
      select: { severity: true },
    })
    let estScore = 0
    for (const f of allOpenFindings) estScore += FINDING_SEVERITY_WEIGHTS[f.severity] || 5
    estScore = Math.min(100, estScore)
    let estCategory = 'LOW'
    if (estScore >= 70) estCategory = 'CRITICAL'
    else if (estScore >= 40) estCategory = 'HIGH'
    else if (estScore >= 15) estCategory = 'MEDIUM'
    await db.establishment.update({
      where: { id: establishmentId },
      data: { riskScore: estScore, riskCategory: estCategory },
    })

    await recordActivity({
      user, action: 'CREATE', entityType: 'INSPECTION', entityId: inspection.id,
      commune: establishment.commune,
      details: { reference: inspection.reference, establishment: establishment.reference, riskScore, overallResult },
    })

    return NextResponse.json(inspection, { status: 201 })
  } catch (error) {
    console.error('POST inspections error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء التفتيش' }, { status: 500 })
  }
}
