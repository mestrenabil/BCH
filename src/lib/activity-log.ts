import { db } from '@/lib/db'
import type { AuthUser } from '@/lib/auth'

type ActivityEntry = {
  user: Pick<AuthUser, 'id' | 'nom'>
  action: string
  entityType: string
  entityId?: string
  commune?: string
  details?: Record<string, unknown>
}

export async function recordActivity({
  user,
  action,
  entityType,
  entityId,
  commune = '',
  details,
}: ActivityEntry): Promise<void> {
  try {
    await db.activityLog.create({
      data: {
        userId: user.id,
        userName: user.nom,
        action,
        entityType,
        entityId,
        commune,
        details: details ? JSON.stringify(details) : '',
      },
    })
  } catch (error) {
    console.error('Activity log write error:', error)
  }
}
