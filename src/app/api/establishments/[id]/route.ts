import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { FINDING_SEVERITY_WEIGHTS, RISK_CATEGORY_LABELS } from '@/lib/constants'

const ALLOWED_FIELDS = ['name', 'activity', 'category', 'ownerName', 'ownerCin', 'telephone', 'quartier', 'adresse', 'latitude', 'longitude', 'authorizationNumber', 'authorizationDate', 'openingDate', 'status', 'description']

// احسب درجة المخاطر من النقائص (0-100) + الفئة
function computeRiskScore(findings: { severity: string; status: string }[]): { score: number; category: string } {
  let score = 0
  for (const f of findings) {
    if (f.status === 'OPEN') {
      score += FINDING_SEVERITY_WEIGHTS[f.severity] || 5
    }
  }
  score = Math.min(100, score)
  let category = 'LOW'
  if (score >= 70) category = 'CRITICAL'
  else if (score >= 40) category = 'HIGH'
  else if (score >= 15) category = 'MEDIUM'
  return { score, category }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const establishment = await db.establishment.findUnique({
      where: { id },
      include: {
        inspections: {
          orderBy: { inspectionDate: 'desc' },
          take: 10,
          include: { _count: { select: { findings: true, correctiveActions: true } } },
        },
        healthCards: { orderBy: { createdAt: 'desc' } },
        samples: { orderBy: { sampleDate: 'desc' }, take: 10 },
      },
    })
    if (!establishment) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, establishment.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    return NextResponse.json({ establishment })
  } catch (error) {
    console.error('GET establishment error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const existing = await db.establishment.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json()
    const data: Record<string, unknown> = {}
    for (const field of ALLOWED_FIELDS) {
      if (body[field] !== undefined) {
        if ((field === 'authorizationDate' || field === 'openingDate') && body[field]) {
          data[field] = new Date(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    const updated = await db.establishment.update({ where: { id }, data })

    await recordActivity({
      user, action: 'UPDATE', entityType: 'ESTABLISHMENT', entityId: id,
      commune: existing.commune, details: { reference: existing.reference, fields: Object.keys(data) },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT establishment error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const existing = await db.establishment.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'المنشأة غير موجودة' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    await db.establishment.delete({ where: { id } })

    await recordActivity({
      user, action: 'DELETE', entityType: 'ESTABLISHMENT', entityId: id,
      commune: existing.commune, details: { reference: existing.reference },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE establishment error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}

export { computeRiskScore }
