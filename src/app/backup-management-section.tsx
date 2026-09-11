'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'

type BackupFile = {
  version: string
  exportedAt?: string
  data: Record<string, unknown[]>
  summary?: Record<string, number>
}

type RemoteStatus = { googleDrive: boolean; webdav: boolean }

const ENTITY_LABELS: Record<string, string> = {
  interventions: 'تدخل', products: 'منتج', agents: 'عون', quartiers: 'حي', campagnes: 'حملة',
  complaints: 'شكاية', workOrders: 'أمر عمل', documents: 'مستند', stockMovements: 'حركة مخزون',
}

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `bch-backup-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function BackupManagementSection() {
  const restoreInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'download' | 'restore' | 'googleDrive' | 'webdav' | null>(null)
  const [remoteStatus, setRemoteStatus] = useState<RemoteStatus>({ googleDrive: false, webdav: false })

  useEffect(() => {
    fetch('/api/backup/remote')
      .then(async (response) => response.ok ? response.json() as Promise<RemoteStatus> : Promise.reject())
      .then(setRemoteStatus)
      .catch(() => undefined)
  }, [])

  const createLocalBackup = async () => {
    setBusy('download')
    toast.loading('جاري إنشاء النسخة الاحتياطية...', { id: 'backup' })
    try {
      const response = await fetch('/api/backup', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'فشل إنشاء النسخة')
      downloadJson(result)
      toast.success('تم تنزيل النسخة الاحتياطية بنجاح', { id: 'backup' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل إنشاء النسخة الاحتياطية', { id: 'backup' })
    } finally {
      setBusy(null)
    }
  }

  const restoreBackup = async (file: File) => {
    setBusy('restore')
    try {
      const backup = JSON.parse(await file.text()) as BackupFile
      if (!backup.version?.startsWith('3.') || !backup.data || typeof backup.data !== 'object') {
        throw new Error('ملف النسخة الاحتياطية غير صالح أو غير مدعوم')
      }
      const counts = Object.entries(backup.data)
        .filter(([key, rows]) => ENTITY_LABELS[key] && Array.isArray(rows) && rows.length > 0)
        .map(([key, rows]) => `${rows.length} ${ENTITY_LABELS[key]}`)
        .join('، ')
      if (!window.confirm(`سيتم دمج بيانات النسخة مع البيانات الحالية دون حذفها:\n${counts || 'لا توجد سجلات قابلة للاستعادة'}\n\nهل تريد المتابعة؟`)) return

      toast.loading('جاري التحقق واستعادة البيانات...', { id: 'restore' })
      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation: 'RESTORE_BACKUP', backup }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'فشل استعادة النسخة')
      const restoredText = Object.entries(result.restored as Record<string, number>)
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${count} ${ENTITY_LABELS[key] || key}`)
        .join('، ')
      toast.success(`تمت الاستعادة بنجاح${restoredText ? `: ${restoredText}` : ''}`, { id: 'restore', duration: 7000 })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر قراءة أو استعادة النسخة', { id: 'restore' })
    } finally {
      setBusy(null)
      if (restoreInput.current) restoreInput.current.value = ''
    }
  }

  const createRemoteBackup = async (provider: 'googleDrive' | 'webdav') => {
    setBusy(provider)
    const toastId = `backup-${provider}`
    toast.loading('جاري رفع النسخة إلى التخزين الخارجي...', { id: toastId })
    try {
      const response = await fetch('/api/backup/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'فشل رفع النسخة')
      toast.success('تم حفظ النسخة الخارجية بنجاح', { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشل رفع النسخة الخارجية', { id: toastId })
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
      <div className="bg-gradient-to-l from-cyan-600 to-sky-600 px-6 py-4 text-white">
        <h3 className="text-base font-bold">💾 النسخ الاحتياطي والاستعادة</h3>
        <p className="mt-0.5 text-xs text-cyan-100">نسخة موحّدة قابلة للتنزيل والاستعادة أو الحفظ خارج المنصة</p>
      </div>

      <div className="space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={busy !== null} onClick={createLocalBackup}
            className="flex items-center gap-3 rounded-xl border border-cyan-100 bg-cyan-50 p-4 text-right transition hover:bg-cyan-100 disabled:opacity-50">
            <span className="text-2xl">⬇️</span>
            <span><strong className="block text-sm text-cyan-900">تنزيل نسخة JSON</strong><small className="text-cyan-700">تصدير البيانات إلى جهازك</small></span>
          </button>
          <button type="button" disabled={busy !== null} onClick={() => restoreInput.current?.click()}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-right transition hover:bg-slate-100 disabled:opacity-50">
            <span className="text-2xl">📂</span>
            <span><strong className="block text-sm text-slate-800">استعادة ودمج نسخة</strong><small className="text-slate-500">إضافة المفقود وتحديث الموجود دون حذف</small></span>
          </button>
          <input ref={restoreInput} type="file" accept="application/json,.json" className="hidden"
            onChange={(event) => { const file = event.target.files?.[0]; if (file) void restoreBackup(file) }} />
        </div>

        <div className="border-t border-slate-100 pt-5">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-slate-800">☁️ التخزين الخارجي</h4>
            <p className="mt-1 text-xs text-slate-500">تُحفظ بيانات الربط في متغيرات الخادم فقط ولا تُرسل إلى المتصفح.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={!remoteStatus.googleDrive || busy !== null} onClick={() => createRemoteBackup('googleDrive')}
              className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-50">
              Google Drive {remoteStatus.googleDrive ? '— حفظ نسخة الآن' : '— غير مربوط'}
            </button>
            <button type="button" disabled={!remoteStatus.webdav || busy !== null} onClick={() => createRemoteBackup('webdav')}
              className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-sm font-bold text-violet-800 disabled:cursor-not-allowed disabled:opacity-50">
              WebDAV / Nextcloud {remoteStatus.webdav ? '— حفظ نسخة الآن' : '— غير مربوط'}
            </button>
          </div>
          {(!remoteStatus.googleDrive || !remoteStatus.webdav) && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              الربط يحتاج إعداد متغيرات Google Drive أو WebDAV في ملف <code>.env</code> على الخادم ثم إعادة تشغيل التطبيق.
            </p>
          )}
        </div>

        <p className="text-[11px] leading-5 text-slate-400">
          ملاحظة: نسخة JSON تحفظ سجلات قاعدة البيانات. الملفات والصور الموجودة في مجلد storage تحتاج نسخة ملفات مستقلة على الخادم.
        </p>
      </div>
    </motion.div>
  )
}
