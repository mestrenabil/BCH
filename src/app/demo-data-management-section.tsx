'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'

type DemoStatus = {
  years: number[]
  counts: Record<string, number>
  total: number
}

const EMPTY_STATUS: DemoStatus = { years: [], counts: {}, total: 0 }

export function DemoDataManagementSection() {
  const [status, setStatus] = useState<DemoStatus>(EMPTY_STATUS)
  const [loading, setLoading] = useState(true)
  const [action, setAction] = useState<'restore' | 'remove' | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/demo-data', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'تعذر قراءة الحالة')
      setStatus(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر قراءة البيانات التجريبية')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadStatus() }, [loadStatus])

  const runAction = async (nextAction: 'restore' | 'remove') => {
    const removing = nextAction === 'remove'
    const confirmed = window.confirm(removing
      ? 'سيتم حذف السجلات التجريبية الموسومة فقط. لن تتأثر البيانات الحقيقية. هل تريد المتابعة؟'
      : `سيتم إنشاء أو إعادة بيانات تجريبية للسنوات ${status.years.join('، ')} دون استبدال البيانات الحقيقية. هل تريد المتابعة؟`)
    if (!confirmed) return

    setAction(nextAction)
    const toastId = 'demo-data'
    toast.loading(removing ? 'جاري إزالة البيانات التجريبية...' : 'جاري إعداد بيانات السنوات الثلاث...', { id: toastId })
    try {
      const response = await fetch('/api/demo-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: nextAction,
          confirmation: removing ? 'REMOVE_DEMO_DATA' : 'RESTORE_DEMO_DATA',
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'فشلت العملية')
      setStatus(data)
      toast.success(data.message, { id: toastId })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'فشلت عملية البيانات التجريبية', { id: toastId })
    } finally {
      setAction(null)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-sm" dir="rtl">
      <div className="bg-gradient-to-l from-indigo-700 to-violet-700 px-6 py-4 text-white">
        <h3 className="text-base font-bold">🧪 المحتوى الافتراضي للمنصة</h3>
        <p className="mt-0.5 text-xs text-indigo-100">بيانات تجريبية مستقلة لعرض جميع المكاتب خلال آخر ثلاث سنوات.</p>
      </div>
      <div className="space-y-4 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-indigo-50 p-3"><p className="text-[10px] font-bold text-indigo-500">السنوات</p><p className="mt-1 text-sm font-extrabold text-indigo-900">{loading ? '...' : status.years.join(' · ')}</p></div>
          <div className="rounded-xl bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-600">السجلات التجريبية الأساسية</p><p className="mt-1 text-2xl font-black text-emerald-800">{loading ? '...' : status.total}</p></div>
          <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-bold text-slate-500">حماية البيانات الحقيقية</p><p className="mt-1 text-xs font-extrabold text-slate-800">✅ الإزالة تستهدف مراجع SEED- فقط</p></div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs leading-6 text-amber-900">
          لا تنشئ هذه العملية مستخدمين أو كلمات مرور، ولا تحذف الأحياء أو الأعوان أو الإعدادات المشتركة. ويمكن إعادة إنشاء المحتوى التجريبي بعد إزالته.
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void runAction('restore')} disabled={loading || action !== null}
            className="rounded-xl bg-indigo-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-800 disabled:opacity-50">
            {action === 'restore' ? 'جاري الإعداد...' : status.total > 0 ? '↻ إعادة المحتوى الافتراضي' : '🌱 إنشاء المحتوى الافتراضي'}
          </button>
          <button type="button" onClick={() => void runAction('remove')} disabled={loading || action !== null || status.total === 0}
            className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-40">
            {action === 'remove' ? 'جاري الإزالة...' : '🗑️ إزالة المحتوى الافتراضي'}
          </button>
          <button type="button" onClick={() => void loadStatus()} disabled={loading || action !== null}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            تحديث الحالة
          </button>
        </div>
      </div>
    </section>
  )
}
