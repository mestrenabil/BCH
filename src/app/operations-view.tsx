'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'

type OperationsSummary = {
  generatedAt: string
  metrics: { total: number; open: number; overdue: number; dueSoon: number; unassigned: number; urgent: number; completed: number; completionRate: number; averageCompletionHours: number | null }
  byStatus: Record<string, number>
  alerts: { id: string; workOrderId: string; reference: string; title: string; commune: string; status: string; priority: string; dueAt: string; kind: 'OVERDUE' | 'DUE_SOON' | 'UNASSIGNED' }[]
}

const STATUS_LABELS: Record<string, string> = { NOUVEAU: 'جديد', ASSIGNE: 'مُسند', EN_ROUTE: 'في الطريق', EN_COURS: 'قيد الإنجاز', TERMINE: 'منجز', ANNULE: 'ملغى' }
const ALERT_CONFIG = {
  OVERDUE: { label: 'متأخر', color: 'border-red-200 bg-red-50 text-red-800', icon: '⏰' },
  DUE_SOON: { label: 'قريب الاستحقاق', color: 'border-amber-200 bg-amber-50 text-amber-800', icon: '⌛' },
  UNASSIGNED: { label: 'غير مسند', color: 'border-violet-200 bg-violet-50 text-violet-800', icon: '👤' },
}

export default function OperationsView() {
  const { selectedCommune, selectedYear, setCurrentView, territoryFilter, user } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const [summary, setSummary] = useState<OperationsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
      if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
      if (selectedYear) params.set('year', selectedYear)
      const response = await fetch(`/api/operations?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'load')
      setSummary(data)
    } catch (loadError) {
      setError(loadError instanceof Error && loadError.message !== 'load' ? loadError.message : 'تعذر تحميل المؤشرات التشغيلية.')
    } finally {
      setLoading(false)
    }
  }, [selectedCommune, selectedYear, territoryFilter, useTerritoryFilter])

  useEffect(() => { loadSummary() }, [loadSummary])

  if (loading) return <div className="p-6 text-center text-slate-500">جارٍ تحميل المتابعة التشغيلية…</div>
  if (!summary) return <div className="p-6"><div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error || 'تعذر تحميل البيانات.'}</div></div>

  return <div className="space-y-5 p-4 pb-24 lg:p-6 lg:pb-6" dir="rtl">
    <section className="flex flex-col gap-4 rounded-3xl bg-gradient-to-l from-slate-950 via-indigo-950 to-violet-900 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold text-violet-200">مراقبة الآجال وسير التنفيذ</p><h1 className="mt-1 text-2xl font-black">المتابعة التشغيلية</h1><p className="mt-2 text-sm text-slate-300">ركّز على المهام المتأخرة والقريبة من آخر أجل قبل أن تتحول إلى شكايات غير معالجة.</p></div>
      <div className="flex gap-2"><button onClick={loadSummary} className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20">↻ تحديث</button><button onClick={() => setCurrentView('workOrders')} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950">إدارة الأوامر</button></div>
    </section>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="مهام مفتوحة" value={summary.metrics.open} color="bg-blue-50 text-blue-800" /><Metric label="متأخرة" value={summary.metrics.overdue} color="bg-red-50 text-red-800" /><Metric label="تستحق خلال 24س" value={summary.metrics.dueSoon} color="bg-amber-50 text-amber-800" /><Metric label="غير مسندة" value={summary.metrics.unassigned} color="bg-violet-50 text-violet-800" /></div>
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-black text-slate-900">تنبيهات العمل</h2><p className="mt-1 text-xs text-slate-500">{summary.alerts.length} عناصر تحتاج متابعة</p></div><span className="text-xs text-slate-400">تحديث: {new Date(summary.generatedAt).toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' })}</span></div><div className="mt-4 space-y-3">{summary.alerts.length === 0 ? <p className="rounded-xl bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-700">✓ لا توجد آجال حرجة حالياً</p> : summary.alerts.map((alert) => { const config = ALERT_CONFIG[alert.kind]; return <button key={alert.id} onClick={() => setCurrentView('workOrders')} className={`w-full rounded-xl border p-3 text-right transition hover:brightness-95 ${config.color}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold">{config.icon} {config.label} · {alert.reference}</p><p className="mt-1 text-sm font-extrabold">{alert.title}</p><p className="mt-1 text-xs opacity-80">{alert.commune} · {STATUS_LABELS[alert.status] || alert.status}</p></div><span className="shrink-0 text-xs font-bold">{new Date(alert.dueAt).toLocaleString('ar-MA', { dateStyle: 'short', timeStyle: 'short' })}</span></div></button> })}</div></section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="font-black text-slate-900">مؤشرات الإنجاز</h2><div className="mt-5 space-y-4"><Progress label="نسبة الإنجاز" value={summary.metrics.completionRate} color="bg-emerald-500" /><div className="grid grid-cols-2 gap-3"><SmallMetric label="عاجلة مفتوحة" value={summary.metrics.urgent} /><SmallMetric label="متوسط الإنجاز" value={summary.metrics.averageCompletionHours === null ? '—' : `${summary.metrics.averageCompletionHours} س`} /></div><div className="border-t border-slate-100 pt-4"><p className="text-xs font-bold text-slate-500">حالات الأوامر</p><div className="mt-3 grid grid-cols-2 gap-2 text-sm">{Object.entries(summary.byStatus).filter(([status]) => status !== 'ANNULE').map(([status, count]) => <div key={status} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{STATUS_LABELS[status] || status}</span><strong>{count}</strong></div>)}</div></div></div></section>
    </div>
  </div>
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) { return <div className={`rounded-2xl p-4 ${color}`}><p className="text-xs font-semibold opacity-80">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div> }
function SmallMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-black text-slate-900">{value}</p></div> }
function Progress({ label, value, color }: { label: string; value: number; color: string }) { return <div><div className="flex justify-between text-sm"><span className="font-bold text-slate-700">{label}</span><strong className="text-slate-900">{value}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div></div> }
