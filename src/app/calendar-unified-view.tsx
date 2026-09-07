'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

interface CalEvent {
  id: string; kind: string; title: string; subtitle: string
  date: string; commune: string; daysUntil: number; overdue: boolean
}

const KIND_META: Record<string, { label: string; icon: string; color: string }> = {
  INTERVENTION: { label: 'تدخل 3D', icon: '🧪', color: '#dc2626' },
  CAMPAIGN: { label: 'حملة', icon: '🎪', color: '#f59e0b' },
  INSPECTION: { label: 'تفتيش', icon: '🔍', color: '#10b981' },
  WATER_INSPECTION: { label: 'معاينة مياه', icon: '💧', color: '#0891b2' },
  WATER_ACTION: { label: 'إجراء مياه', icon: '🛠️', color: '#2563eb' },
  WATER_DISINFECTION: { label: 'تطهير مياه', icon: '🧴', color: '#059669' },
  HEALTH_CARD: { label: 'بطاقة صحية', icon: '🩺', color: '#8b5cf6' },
  BURIAL: { label: 'دفن', icon: '🪦', color: '#64748b' },
  COMMITTEE: { label: 'لجنة', icon: '👥', color: '#3b82f6' },
  DOSSIER_DUE: { label: 'مهلة ملف', icon: '🗂️', color: '#ea580c' },
  CAMPAIGN_ENV: { label: 'حملة تحسيس', icon: '📢', color: '#84cc16' },
}

const PERIODS = [
  { key: '7', label: '7 أيام' },
  { key: '14', label: '14 يوم' },
  { key: '30', label: '30 يوم' },
  { key: '90', label: '90 يوم' },
]

function fmtDate(d: string) { return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function fmtDateTime(d: string) { return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

export default function CalendarUnifiedView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { setCurrentView, selectedYear } = useAppStore()
  const [days, setDays] = useState('30')
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [filterKind, setFilterKind] = useState('ALL')

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
      const res = await fetch(`/api/calendar/unified?${buildParams({ days }).toString()}`)
      if (res.ok) { const d = await res.json(); setEvents(d.events || []) }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams, days])

  useEffect(() => { refresh() }, [refresh])

  const filtered = useMemo(() => events.filter(e => filterKind === 'ALL' || e.kind === filterKind), [events, filterKind])

  const overdue = filtered.filter(e => e.overdue).length
  const upcoming7 = filtered.filter(e => !e.overdue && e.daysUntil <= 7).length

  // الانتقال للوحدة المعنية
  const navigateTo = (e: CalEvent) => {
    const map: Record<string, string> = {
      INTERVENTION: 'interventions', CAMPAIGN: 'campagnes', INSPECTION: 'sanitary',
      WATER_INSPECTION: 'water', WATER_ACTION: 'water', WATER_DISINFECTION: 'water',
      HEALTH_CARD: 'sanitary', BURIAL: 'funeral', COMMITTEE: 'authorizations',
      DOSSIER_DUE: 'dossiers', CAMPAIGN_ENV: 'environment',
    }
    const view = map[e.kind]
    if (view) setCurrentView(view as any)
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-cyan-700 to-blue-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">📅</span> التقويم الموحّد</h1>
            <p className="text-cyan-50 text-xs sm:text-sm mt-0.5">كل المواعيد القادمة عبر كل المكاتب</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{events.length}</div><div className="text-[10px] opacity-80 mt-0.5">موعد</div></div>
            {overdue > 0 && <div className="bg-red-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-red-100">{overdue}</div><div className="text-[10px] opacity-80 mt-0.5">⏰ متأخر</div></div>}
            {upcoming7 > 0 && <div className="bg-amber-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-amber-100">{upcoming7}</div><div className="text-[10px] opacity-80 mt-0.5">هذا الأسبوع</div></div>}
          </div>
        </div>
      </div>

      {/* اختيار الفترة + فلتر */}
      <div className="flex flex-wrap items-center gap-2">
        {PERIODS.map(p => (
          <button key={p.key} onClick={() => setDays(p.key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${days === p.key ? 'bg-cyan-700 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-cyan-50'}`}>
            {p.label}
          </button>
        ))}
        <select value={filterKind} onChange={(e) => setFilterKind(e.target.value)} className="mr-auto px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {Object.entries(KIND_META).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
      </div>

      {/* القائمة */}
      {loading && events.length === 0 ? (
        <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-sm text-slate-500">لا توجد مواعيد في هذه الفترة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, 100).map((e, i) => {
            const meta = KIND_META[e.kind] || { label: e.kind, icon: '📌', color: '#64748b' }
            const isOverdue = e.overdue
            return (
              <motion.button
                key={e.kind + e.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.01 }}
                onClick={() => navigateTo(e)}
                className={`w-full text-right bg-white rounded-2xl border p-3 hover:shadow-md transition flex items-center gap-3 ${
                  isOverdue ? 'border-red-200 bg-red-50/30' : e.daysUntil <= 3 ? 'border-amber-200' : 'border-slate-100'
                }`}
              >
                {/* التاريخ */}
                <div className={`shrink-0 w-14 text-center rounded-xl p-1.5 ${isOverdue ? 'bg-red-100' : 'bg-slate-50'}`}>
                  <div className={`text-lg font-black ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>{e.daysUntil < 0 ? Math.abs(e.daysUntil) : e.daysUntil}</div>
                  <div className={`text-[9px] ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>{isOverdue ? 'متأخر' : 'يوم'}</div>
                </div>
                {/* الأيقونة */}
                <div className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ backgroundColor: meta.color + '15' }}>
                  {meta.icon}
                </div>
                {/* النص */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-slate-800 truncate">{e.title}</div>
                  <div className="text-[10px] text-slate-500 truncate">{e.subtitle} · {fmtDateTime(e.date)}</div>
                </div>
                {/* الشارة */}
                <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: meta.color + '15', color: meta.color }}>
                  {meta.label}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}

      {filtered.length > 100 && (
        <div className="text-center text-xs text-slate-400">عرض أول 100 موعد من {filtered.length}</div>
      )}
    </div>
  )
}
