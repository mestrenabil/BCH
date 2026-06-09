import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/activity-log - Get activity logs with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const action = searchParams.get('action')
    const entityType = searchParams.get('entityType')
    const commune = searchParams.get('commune')
    const userId = searchParams.get('userId')

    const where: Record<string, string> = {}
    if (action) where.action = action
    if (entityType) where.entityType = entityType
    if (commune) where.commune = commune
    if (userId) where.userId = userId

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.activityLog.count({ where }),
    ])

    return NextResponse.json({ logs, total })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 })
  }
}

// POST /api/activity-log - Create an activity log entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, userName, action, entityType, entityId, details, commune, ipAddress } = body

    const log = await db.activityLog.create({
      data: {
        userId: userId || null,
        userName: userName || '',
        action,
        entityType,
        entityId: entityId || null,
        details: details || '',
        commune: commune || '',
        ipAddress: ipAddress || null,
      },
    })

    return NextResponse.json(log, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create activity log' }, { status: 500 })
  }
}
