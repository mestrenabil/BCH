import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { createBackupPayload } from '@/lib/backup-service'
import { getRemoteBackupStatus, uploadBackupToGoogleDrive, uploadBackupToWebDav } from '@/lib/backup-remote'

export const dynamic = 'force-dynamic'

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error
  return NextResponse.json(getRemoteBackupStatus(), { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as { provider?: string }
    if (body.provider !== 'googleDrive' && body.provider !== 'webdav') {
      return NextResponse.json({ error: 'مزود التخزين غير مدعوم' }, { status: 400 })
    }

    const backup = await createBackupPayload()
    const filename = `bch-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    const content = JSON.stringify(backup, null, 2)
    const uploaded = body.provider === 'googleDrive'
      ? await uploadBackupToGoogleDrive(filename, content)
      : await uploadBackupToWebDav(filename, content)

    await db.activityLog.create({
      data: {
        userId: user.id,
        userName: user.nom,
        action: 'EXPORT',
        entityType: 'BACKUP',
        details: JSON.stringify({ provider: body.provider, filename, remoteId: 'id' in uploaded ? uploaded.id : undefined }),
        commune: user.commune,
      },
    })

    return NextResponse.json({ message: 'تم حفظ النسخة الخارجية بنجاح', uploaded })
  } catch (error) {
    console.error('Remote backup error:', error)
    const message = error instanceof Error ? error.message : 'فشل حفظ النسخة الخارجية'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
