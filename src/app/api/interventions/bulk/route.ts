import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCommuneFilter, isAdmin, requireAuth } from '@/lib/auth'

const allowedStatuses = new Set(['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'])

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { action, ids, data } = body
    const selectedIds = Array.isArray(ids)
      ? [...new Set(ids.filter((id: unknown): id is string => typeof id === 'string'))].slice(0, 200)
      : []

    if (!action || selectedIds.length === 0) {
      return NextResponse.json({ error: 'الإجراء ومعرفات التدخلات مطلوبان' }, { status: 400 })
    }

    const communeFilter = getCommuneFilter(user)
    const where = isAdmin(user) || !communeFilter
      ? { id: { in: selectedIds } }
      : { id: { in: selectedIds }, commune: communeFilter }

    switch (action) {
      case 'delete': {
        const result = await db.intervention.deleteMany({ where })
        return NextResponse.json({ success: true, affected: result.count })
      }
      case 'updateStatus': {
        if (!allowedStatuses.has(data?.statut)) {
          return NextResponse.json({ error: 'حالة التدخل غير صالحة' }, { status: 400 })
        }
        const result = await db.intervention.updateMany({ where, data: { statut: data.statut } })
        return NextResponse.json({ success: true, affected: result.count })
      }
      case 'updateCommune': {
        if (!isAdmin(user)) {
          return NextResponse.json({ error: 'تغيير الجماعة متاح للمسؤول العام فقط' }, { status: 403 })
        }
        if (!data?.commune || data.commune === 'ALL') {
          return NextResponse.json({ error: 'الجماعة غير صالحة' }, { status: 400 })
        }
        const result = await db.intervention.updateMany({ where, data: { commune: data.commune } })
        return NextResponse.json({ success: true, affected: result.count })
      }
      case 'export': {
        const interventions = await db.intervention.findMany({
          where,
          include: { materials: true, documents: true, photos: true },
        })
        return NextResponse.json({ interventions })
      }
      default:
        return NextResponse.json({ error: 'الإجراء غير مدعوم' }, { status: 400 })
    }
  } catch (error) {
    console.error('Bulk intervention action error:', error)
    return NextResponse.json({ error: 'فشل تنفيذ الإجراء الجماعي' }, { status: 500 })
  }
}
