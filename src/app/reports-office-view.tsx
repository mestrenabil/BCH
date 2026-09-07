'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'أسبوع' },
  { key: 'month', label: 'شهر' },
  { key: 'quarter', label: 'ربع سنة' },
  { key: 'year', label: 'سنة' },
  { key: 'all', label: 'الكل' },
]

// تعريف الأقسام للعرض
const SECTIONS = [
  { key: 'interventions', label: 'تدخلات 3D', icon: '🧪', group: 'النواقل' },
  { key: 'complaints', label: 'شكايات', icon: '📢', group: 'النواقل' },
  { key: 'foodReports', label: 'بلاغات غذائية', icon: '🥗', group: 'النواقل' },
  { key: 'strayReports', label: 'حيوانات شاردة', icon: '🐾', group: 'النواقل' },
  { key: 'biteCases', label: 'لسع/عضة', icon: '🐕', group: 'النواقل' },
  { key: 'establishments', label: 'منشآت', icon: '🏪', group: 'الصحة' },
  { key: 'inspections', label: 'تفتيشات', icon: '🔍', group: 'الصحة' },
  { key: 'waterPoints', label: 'نقاط مياه', icon: '💧', group: 'الماء' },
  { key: 'waterMeasurements', label: 'قياسات مياه', icon: '🌡️', group: 'الماء' },
  { key: 'pollutionIncidents', label: 'تلوث', icon: '🏭', group: 'البيئة' },
  { key: 'wasteSpots', label: 'نقاط رمي', icon: '🗑️', group: 'البيئة' },
  { key: 'naturalSites', label: 'مواقع طبيعية', icon: '🌳', group: 'البيئة' },
  { key: 'awarenessCampaigns', label: 'حملات تحسيس', icon: '📢', group: 'البيئة' },
  { key: 'deathCases', label: 'وفيات', icon: '⚱️', group: 'الجنائز' },
  { key: 'burialDossiers', label: 'دفن', icon: '🪦', group: 'الجنائز' },
  { key: 'authDossiers', label: 'تراخيص', icon: '📋', group: 'التراخيص' },
  { key: 'opinions', label: 'آراء صحية', icon: '📝', group: 'التراخيص' },
  { key: 'committeeVisits', label: 'زيارات لجان', icon: '👥', group: 'التراخيص' },
  { key: 'dossiers', label: 'ملفات موحّدة', icon: '🗂️', group: 'عام' },
]

export default function ReportsOfficeView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { language, selectedYear } = useAppStore()
  const [period, setPeriod] = useState('all')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    if (selectedYear) params.set('year', selectedYear)
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return params
  }, [selectedCommune, territoryFilter, useTerritoryFilter, selectedYear])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/reports/comprehensive?${buildParams({ period }).toString()}`)
      if (res.ok) setData(await res.json())
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams, period])

  useEffect(() => { refresh() }, [refresh])

  // تصدير CSV للإحصائيات
  const exportCSV = () => {
    if (!data?.stats) return
    const lines = ['القسم,الكيان,العدد']
    for (const s of SECTIONS) {
      lines.push(`${s.group},${s.label},${data.stats[s.key] || 0}`)
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `report-${period}-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
    toast.success('تم تصدير التقرير')
  }

  // مجموع كل الإحصائيات
  const total = useMemo(() => {
    if (!data?.stats) return 0
    return Object.values(data.stats).reduce((sum: number, v: any) => sum + (Number(v) || 0), 0)
  }, [data])

  // رتّب الأقسام حسب المجموعة
  const grouped = useMemo(() => {
    const g: Record<string, typeof SECTIONS> = {}
    for (const s of SECTIONS) { if (!g[s.group]) g[s.group] = []; g[s.group].push(s) }
    return g
  }, [])

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-violet-700 to-purple-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">📊</span> التقارير والإحصائيات الشاملة</h1>
            <p className="text-violet-50 text-xs sm:text-sm mt-0.5">تقارير دورية عبر كل المكاتب التسعة — المكتب 09</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none">{total}</div>
              <div className="text-[10px] opacity-80 mt-0.5">إجمالي السجلات</div>
            </div>
          </div>
        </div>
      </div>

      {/* اختيار الفترة */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${period === p.key ? 'bg-violet-700 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-violet-50'}`}>
            {p.label}
          </button>
        ))}
        <button onClick={exportCSV} disabled={!data}
          className="mr-auto px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
          📥 تصدير CSV
        </button>
      </div>

      {/* تنبيهات حرجة */}
      {data?.critical && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          {data.critical.urgentFood > 0 && <CriticalCard icon="🥗" count={data.critical.urgentFood} label="بلاغ غذائي عاجل" color="bg-red-50 border-red-200 text-red-700" />}
          {data.critical.criticalPollution > 0 && <CriticalCard icon="🏭" count={data.critical.criticalPollution} label="تلوث خطير" color="bg-orange-50 border-orange-200 text-orange-700" />}
          {data.critical.criticalEstablishments > 0 && <CriticalCard icon="🏪" count={data.critical.criticalEstablishments} label="منشأة حرجة" color="bg-red-50 border-red-200 text-red-700" />}
          {data.critical.expiredHealthCards > 0 && <CriticalCard icon="🩺" count={data.critical.expiredHealthCards} label="بطاقة منتهية" color="bg-amber-50 border-amber-200 text-amber-700" />}
          {data.critical.pendingBurialAuth > 0 && <CriticalCard icon="🪦" count={data.critical.pendingBurialAuth} label="دفن بانتظار إذن" color="bg-amber-50 border-amber-200 text-amber-700" />}
        </div>
      )}

      {/* الإحصائيات حسب المجموعة */}
      {loading && !data ? (
        <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([group, items]) => (
            <motion.div key={group} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-100 p-4">
              <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">📁 {group}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {items.map(item => (
                  <div key={item.key} className="bg-slate-50 rounded-xl p-2.5 text-center">
                    <div className="text-lg mb-0.5">{item.icon}</div>
                    <div className="text-xl font-black text-slate-800">{data?.stats?.[item.key] ?? 0}</div>
                    <div className="text-[10px] text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* الاتجاه الزمني */}
      {data?.trend && data.trend.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">📈 الاتجاه — آخر 30 يوم</h3>
          <div className="flex items-end gap-0.5 h-32">
            {data.trend.map((d: any, i: number) => {
              const max = Math.max(1, ...data.trend.map((t: any) => t.interventions + t.complaints + t.foodReports))
              const val = d.interventions + d.complaints + d.foodReports
              const h = (val / max) * 100
              return (
                <div key={i} className="flex-1 group relative">
                  <div className="text-[8px] text-slate-500 font-bold opacity-0 group-hover:opacity-100 absolute -top-4 left-1/2 -translate-x-1/2">{val}</div>
                  <div className="w-full rounded-t-sm bg-gradient-to-t from-violet-400 to-purple-500 hover:from-violet-500 hover:to-purple-600 min-h-[2px] transition-colors" style={{ height: `${Math.max(2, h)}%` }} title={`${d.date}: ${val}`} />
                </div>
              )
            })}
          </div>
          <div className="flex items-center justify-between mt-2 text-[10px] text-slate-400">
            <span>{new Date(data.trend[0].date).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit' })}</span>
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" /> المجموع اليومي</span>
            </span>
            <span>{new Date(data.trend[data.trend.length - 1].date).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit' })}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function CriticalCard({ icon, count, label, color }: { icon: string; count: number; label: string; color: string }) {
  return (
    <div className={`rounded-xl border p-3 text-center ${color}`}>
      <div className="text-xl mb-0.5">{icon}</div>
      <div className="text-lg font-black">{count}</div>
      <div className="text-[10px]">{label}</div>
    </div>
  )
}
