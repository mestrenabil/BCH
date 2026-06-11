import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/backup - Export all data as JSON backup (requires auth)
export async function GET() {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    // Fetch all data for backup
    const [
      interventions, products, agents, usersRaw,
      quartiers, documents, complaints, stockMovements, activityLogs,
    ] = await Promise.all([
      db.intervention.findMany({ include: { materials: { include: { product: true } } } }),
      db.product.findMany(),
      db.agent.findMany(),
      db.user.findMany(),
      db.quartier.findMany(),
      db.document.findMany(),
      db.complaint.findMany(),
      db.stockMovement.findMany(),
      db.activityLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
    ])

    // Remove passwords from users
    const safeUsers = usersRaw.map(({ password, ...rest }) => rest)

    const backup = {
      version: '2.0',
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
      summary: {
        interventions: interventions.length,
        products: products.length,
        agents: agents.length,
        users: safeUsers.length,
        quartiers: quartiers.length,
        documents: documents.length,
        complaints: complaints.length,
        stockMovements: stockMovements.length,
        activityLogs: activityLogs.length,
      },
    }

    return NextResponse.json(backup)
  } catch (error) {
    console.error('Backup error:', error)
    return NextResponse.json({ error: 'فشل في إنشاء النسخة الاحتياطية' }, { status: 500 })
  }
}
