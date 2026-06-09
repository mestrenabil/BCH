import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/backup - Export all data as JSON
export async function GET() {
  try {
    // Fetch data in lightweight mode to avoid memory issues
    const interventions = await db.intervention.findMany()
    const products = await db.product.findMany()
    const agents = await db.agent.findMany()
    const usersRaw = await db.user.findMany()
    // Remove passwords from users
    const safeUsers = usersRaw.map(({ password, ...rest }) => rest)
    const quartiers = await db.quartier.findMany()
    const documents = await db.document.findMany()
    const complaints = await db.complaint.findMany()
    const stockMovements = await db.stockMovement.findMany()
    const activityLogs = await db.activityLog.findMany({
      take: 500,
      orderBy: { createdAt: 'desc' },
    })

    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      data: {
        interventions,
        products,
        agents,
        users: safeUsers,
        quartiers,
        documents,
        complaints,
        stockMovements,
        activityLogs,
      },
    }

    return NextResponse.json(backup)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create backup' }, { status: 500 })
  }
}
