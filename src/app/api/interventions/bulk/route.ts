import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// POST /api/interventions/bulk - Perform bulk actions on interventions
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ids, data } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Action and ids array are required' }, { status: 400 })
    }

    let result

    switch (action) {
      case 'delete':
        result = await db.intervention.deleteMany({
          where: { id: { in: ids } },
        })
        break

      case 'updateStatus':
        if (!data?.statut) {
          return NextResponse.json({ error: 'Status is required for updateStatus action' }, { status: 400 })
        }
        result = await db.intervention.updateMany({
          where: { id: { in: ids } },
          data: { statut: data.statut },
        })
        break

      case 'updateCommune':
        if (!data?.commune) {
          return NextResponse.json({ error: 'Commune is required for updateCommune action' }, { status: 400 })
        }
        result = await db.intervention.updateMany({
          where: { id: { in: ids } },
          data: { commune: data.commune },
        })
        break

      case 'export':
        const interventions = await db.intervention.findMany({
          where: { id: { in: ids } },
          include: { materials: true, documents: true, photos: true },
        })
        return NextResponse.json({ interventions })

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    return NextResponse.json({ success: true, affected: result?.count || 0 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to perform bulk action' }, { status: 500 })
  }
}
