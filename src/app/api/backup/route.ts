import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { createBackupPayload, parseBackupPayload, restoreBackupPayload } from '@/lib/backup-service'

export const dynamic = 'force-dynamic'

// تصدير نسخة JSON موحّدة — للمسؤول العام فقط.
export async function GET() {
  try {
    const authResult = await requireAdmin()
    if ('error' in authResult) return authResult.error

    return NextResponse.json(await createBackupPayload(), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.error('Backup error:', error)
    return NextResponse.json({ error: 'فشل في إنشاء النسخة الاحتياطية' }, { status: 500 })
  }
}

// استعادة بالدمج: تحدّث السجلات الموجودة وتضيف المفقودة دون حذف البيانات الحالية.
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAdmin()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    if (!body || typeof body !== 'object' || body.confirmation !== 'RESTORE_BACKUP') {
      return NextResponse.json({ error: 'يلزم تأكيد عملية الاستعادة' }, { status: 400 })
    }

    const payload = parseBackupPayload(body.backup)
    const restored = await restoreBackupPayload(payload)

    await db.activityLog.create({
      data: {
        userId: user.id,
        userName: user.nom,
        action: 'IMPORT',
        entityType: 'BACKUP',
        details: JSON.stringify({ version: payload.version, exportedAt: payload.exportedAt, restored }),
        commune: user.commune,
      },
    })

    return NextResponse.json({ message: 'تمت استعادة النسخة الاحتياطية بنجاح', restored })
  } catch (error) {
    console.error('Restore backup error:', error)
    const message = error instanceof Error ? error.message : 'فشل في استعادة النسخة الاحتياطية'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
