import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

const applicationStartedAt = Date.now()

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`

    return NextResponse.json(
      {
        status: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
        uptimeSeconds: Math.floor((Date.now() - applicationStartedAt) / 1000),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    console.error('Health check error:', error)
    return NextResponse.json(
      { status: 'degraded', database: 'unavailable', timestamp: new Date().toISOString() },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
