import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, canAccessCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'
import { syncFoodReportDossier } from '@/lib/vigilance-links'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const report = await db.foodReport.findUnique({
      where: { id },
      include: { photos: { orderBy: { createdAt: 'desc' } } },
    })
    if (!report) return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, report.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    return NextResponse.json({ report })
  } catch (error) {
    console.error('GET food-report error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const existing = await db.foodReport.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    const body = await request.json()
    const data: Record<string, unknown> = {}
    const allowedFields = ['reportType', 'establishmentName', 'establishmentType', 'description', 'priority', 'statut', 'observations', 'quartier', 'adresse']
    for (const field of allowedFields) {
      if (body[field] !== undefined) data[field] = body[field]
    }

    const updated = await db.foodReport.update({ where: { id }, data })
    try {
      await syncFoodReportDossier(updated, user)
    } catch (linkError) {
      console.error('Sync food report dossier error:', linkError)
    }

    if (body.statut && body.statut !== existing.statut) {
      await recordActivity({
        user, action: 'STATUS_CHANGE', entityType: 'FOOD_REPORT', entityId: id,
        commune: existing.commune,
        details: { reference: existing.reference, from: existing.statut, to: body.statut },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PUT food-report error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التحديث' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { id } = await params

    const existing = await db.foodReport.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'البلاغ غير موجود' }, { status: 404 })
    if (!canAccessCommune(user, existing.commune)) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })

    await db.foodReport.delete({ where: { id } })

    await recordActivity({
      user, action: 'DELETE', entityType: 'FOOD_REPORT', entityId: id,
      commune: existing.commune, details: { reference: existing.reference },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE food-report error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الحذف' }, { status: 500 })
  }
}
