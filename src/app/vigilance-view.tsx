'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type VigilanceSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import {
  COMPLAINT_CATEGORY_LABELS, COMPLAINT_CATEGORY_ICONS, COMPLAINT_OFFICE_MAP,
  VIGILANCE_PRIORITY_LABELS, VIGILANCE_PRIORITY_COLORS, VIGILANCE_SLA_DAYS,
  REPORT_SOURCE_LABELS, REPORT_SOURCE_ICONS,
  OFFICES,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { UnifiedReport, VigilanceStats } from './vigilance/types'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: VigilanceSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة الموحّدة', icon: '📊' },
  { id: 'all', label: 'كل البلاغات', icon: '📢' },
  { id: 'byCategory', label: 'حسب التصنيف', icon: '🗂️' },
]

function fmtDate(d: string) { return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }

// خرائطة الأولوية الموحّدة (لأن كل مصدر يستخدم تسميات مختلفة)
function normalizePriority(p: string): string {
  const map: Record<string, string> = {
    URGENTE: 'URGENT', SANITAIRE: 'CRITICAL', HAUTE: 'IMPORTANT', NORMALE: 'NORMAL', BASSE: 'NORMAL', FAIBLE: 'NORMAL',
    HIGH: 'URGENT', CRITICAL: 'CRITICAL', MEDIUM: 'IMPORTANT', LOW: 'NORMAL',
  }
  return map[p] || 'NORMAL'
}

export default function VigilanceView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { vigilanceSubTab, setVigilanceSubTab, setCurrentView } = useAppStore()
  const [reports, setReports] = useState<UnifiedReport[]>([])
  const [stats, setStats] = useState<VigilanceStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return params
  }, [selectedCommune, territoryFilter, useTerritoryFilter])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vigilance/overview?${buildParams().toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
        setStats(data.stats || null)
      }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const synchronizeDossiers = useCallback(async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/vigilance/sync?${buildParams().toString()}`, { method: 'POST' })
      const data = await res.json().catch(() => null) as { synchronized?: number; error?: string } | null
      if (!res.ok) {
        toast.error(data?.error || 'تعذرت مزامنة الملفات')
        return
      }
      toast.success(`تمت مزامنة ${data?.synchronized || 0} بلاغاً مع الملفات الموحدة`)
      await refresh()
    } catch {
      toast.error('تعذرت مزامنة الملفات حالياً')
    } finally {
      setSyncing(false)
    }
  }, [buildParams, refresh])

  // الانتقال للوحدة المعنية عند النقر على بلاغ
  const navigateToSource = (r: UnifiedReport) => {
    const map: Record<string, string> = {
      COMPLAINT: 'complaints', FOOD_REPORT: 'food', STRAY_REPORT: 'csvr', POLLUTION: 'environment', SANITATION: 'water',
    }
    const view = map[r.sourceKind]
    if (view) setCurrentView(view as any)
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-orange-600 to-amber-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">📢</span> الشكايات واليقظة الصحية</h1>
            <p className="text-orange-50 text-xs sm:text-sm mt-0.5">لوحة موحّدة لكل البلاغات عبر كل المكاتب + تصنيف وSLA — المكتب 07</p>
          </div>
          {stats && (
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{reports.length}</div><div className="text-[10px] opacity-80 mt-0.5">إجمالي البلاغات</div></div>
              <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none text-blue-200">{stats.open}</div><div className="text-[10px] opacity-80 mt-0.5">مفتوح</div></div>
              {stats.overdue > 0 && <div className="bg-red-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-red-100">{stats.overdue}</div><div className="text-[10px] opacity-80 mt-0.5">⏰ متأخر</div></div>}
              {stats.critical > 0 && <div className="bg-red-900/40 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-red-200">{stats.critical}</div><div className="text-[10px] opacity-80 mt-0.5">🚨 حرج</div></div>}
            </div>
          )}
          <button type="button" onClick={synchronizeDossiers} disabled={syncing} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold transition hover:bg-white/25 disabled:opacity-60">
            {syncing ? 'جارٍ توحيد الملفات...' : '📂 مزامنة الملفات'}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setVigilanceSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${vigilanceSubTab === tab.id ? 'bg-orange-600 text-white shadow-md shadow-orange-200' : 'bg-white text-slate-600 hover:bg-orange-50 border border-slate-200'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
            {tab.id === 'all' && reports.length > 0 && <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/20">{reports.length}</span>}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={vigilanceSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {vigilanceSubTab === 'dashboard' && stats && <DashboardTab reports={reports} stats={stats} />}
          {vigilanceSubTab === 'all' && <AllTab reports={reports} loading={loading} onNavigate={navigateToSource} />}
          {vigilanceSubTab === 'byCategory' && stats && <ByCategoryTab reports={reports} stats={stats} onNavigate={navigateToSource} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ===== Dashboard =====
function DashboardTab({ reports, stats }: { reports: UnifiedReport[]; stats: VigilanceStats }) {
  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><span className="text-2xl">📊</span><span className="text-3xl font-black text-slate-800">{reports.length}</span></div><p className="text-xs text-slate-500 mt-1">إجمالي البلاغات</p></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><span className="text-2xl">📂</span><span className="text-3xl font-black text-blue-600">{stats.open}</span></div><p className="text-xs text-slate-500 mt-1">بلاغات مفتوحة</p></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><span className="text-2xl">⏰</span><span className="text-3xl font-black text-red-600">{stats.overdue}</span></div><p className="text-xs text-slate-500 mt-1">تجاوز SLA</p></div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4"><div className="flex items-center justify-between"><span className="text-2xl">🚨</span><span className="text-3xl font-black text-red-700">{stats.critical}</span></div><p className="text-xs text-slate-500 mt-1">أولوية حرجة</p></div>
      </div>

      {/* حسب المصدر */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">📢 البلاغات حسب المصدر</h3>
        <div className="space-y-1.5">
          {Object.entries(stats.bySource).sort((a, b) => b[1] - a[1]).map(([s, n]) => (
            <div key={s} className="flex items-center gap-2 text-xs">
              <span className="w-40 shrink-0 truncate">{REPORT_SOURCE_ICONS[s]} {REPORT_SOURCE_LABELS[s]}</span>
              <div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden"><div className="h-full bg-orange-500 rounded-md" style={{ width: `${Math.max(5, (n / reports.length) * 100)}%` }} /></div>
              <span className="font-bold w-6 text-left">{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* حسب التصنيف */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3">🗂️ حسب التصنيف + المكتب المختص</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([cat, n]) => {
            const officeCode = COMPLAINT_OFFICE_MAP[cat]
            const office = officeCode ? OFFICES[officeCode] : null
            return (
              <div key={cat} className="bg-slate-50 rounded-xl p-2.5 text-center">
                <div className="text-lg mb-0.5">{COMPLAINT_CATEGORY_ICONS[cat] || '📢'}</div>
                <div className="text-sm font-black text-slate-700">{n}</div>
                <div className="text-[10px] text-slate-500 line-clamp-1">{COMPLAINT_CATEGORY_LABELS[cat] || cat}</div>
                {office && <div className="text-[9px] text-orange-600 mt-0.5">{office.icon} {office.nameAr.slice(0, 20)}</div>}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ===== All Reports =====
function AllTab({ reports, loading, onNavigate }: { reports: UnifiedReport[]; loading: boolean; onNavigate: (r: UnifiedReport) => void }) {
  const [search, setSearch] = useState('')
  const [filterSource, setFilterSource] = useState('ALL')
  const [filterSla, setFilterSla] = useState('ALL')

  const filtered = useMemo(() => reports.filter(r => {
    if (filterSource !== 'ALL' && r.sourceKind !== filterSource) return false
    if (filterSla !== 'ALL' && r.slaStatus !== filterSla) return false
    if (search && !r.reference.toLowerCase().includes(search.toLowerCase()) && !r.description.toLowerCase().includes(search.toLowerCase()) && !r.quartier.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [reports, filterSource, filterSla, search])

  if (loading && reports.length === 0) return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>

  const slaColor = (s: string) => s === 'OVERDUE' ? '#dc2626' : s === 'CRITICAL' ? '#ea580c' : '#10b981'
  const slaLabel = (s: string) => s === 'OVERDUE' ? '⏰ متأخر' : s === 'CRITICAL' ? '⚠️ حرج' : '✓ ضمن'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (مرجع/وصف/حي)..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-300" />
        <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل المصادر</option>
          {Object.entries(REPORT_SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{REPORT_SOURCE_ICONS[k]} {v}</option>)}
        </select>
        <select value={filterSla} onChange={(e) => setFilterSla(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل SLA</option>
          <option value="OVERDUE">⏰ متأخر</option>
          <option value="CRITICAL">⚠️ حرج</option>
          <option value="WITHIN">✓ ضمن</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">📢</div><p className="text-sm text-slate-500">لا توجد بلاغات مطابقة</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.slice(0, 100).map((r, i) => {
            const np = normalizePriority(r.priority)
            const pc = VIGILANCE_PRIORITY_COLORS[np] || '#94a3b8'
            const sc = slaColor(r.slaStatus)
            const srcIcon = REPORT_SOURCE_ICONS[r.sourceKind] || '📢'
            return (
              <motion.button key={r.sourceKind + r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.01 }}
                onClick={() => onNavigate(r)}
                className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md hover:border-orange-200 transition-all relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: pc }} />
                <div className="flex items-start justify-between pr-1">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{srcIcon} {r.reference}</div>
                    <div className="text-xs text-slate-600 line-clamp-2 mt-1">{r.description || '—'}</div>
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: pc + '15', color: pc }}>{VIGILANCE_PRIORITY_LABELS[np] || r.priority}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{slaLabel(r.slaStatus)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">
                  <span style={{ color: COMMUNE_COLORS[r.commune] }}>{COMMUNE_LABELS[r.commune] || r.commune}</span>
                  {r.quartier && <span>📍 {r.quartier}</span>}
                  <span>· {r.daysOpen} يوم</span>
                  {r.source === 'PUBLIC' && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">عمومي</span>}
                  <span className="mr-auto text-orange-600 font-bold">عرض ←</span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}
      <div className="text-center"><span className="text-xs text-slate-400">عرض {Math.min(filtered.length, 100)} من أصل {reports.length} بلاغ</span></div>
    </div>
  )
}

// ===== By Category =====
function ByCategoryTab({ reports, stats, onNavigate }: { reports: UnifiedReport[]; stats: VigilanceStats; onNavigate: (r: UnifiedReport) => void }) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const categorized = useMemo(() => {
    const map: Record<string, UnifiedReport[]> = {}
    for (const r of reports) {
      const cat = r.category || 'OTHER'
      if (!map[cat]) map[cat] = []
      map[cat].push(r)
    }
    return map
  }, [reports])

  const filteredReports = selectedCategory ? categorized[selectedCategory] || [] : []

  return (
    <div className="space-y-3">
      {/* شبكة التصنيفات */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {Object.entries(stats.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, n]) => {
          const officeCode = COMPLAINT_OFFICE_MAP[cat]
          const office = officeCode ? OFFICES[officeCode] : null
          const isActive = selectedCategory === cat
          return (
            <button key={cat} onClick={() => setSelectedCategory(isActive ? null : cat)}
              className={`rounded-xl p-3 text-center transition border-2 ${isActive ? 'border-orange-400 bg-orange-50' : 'border-transparent bg-white hover:border-orange-200'}`}>
              <div className="text-xl mb-1">{COMPLAINT_CATEGORY_ICONS[cat] || '📢'}</div>
              <div className="text-lg font-black text-slate-700">{n}</div>
              <div className="text-[10px] text-slate-500 line-clamp-1">{COMPLAINT_CATEGORY_LABELS[cat] || cat}</div>
              {office && <div className="text-[9px] text-orange-600 mt-0.5">{office.icon} {OFFICES[officeCode]?.nameAr.slice(0, 15)}</div>}
            </button>
          )
        })}
      </div>

      {/* بلاغات التصنيف المحدد */}
      {selectedCategory && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-700">{COMPLAINT_CATEGORY_ICONS[selectedCategory]} {COMPLAINT_CATEGORY_LABELS[selectedCategory] || selectedCategory} ({filteredReports.length})</h3>
            {COMPLAINT_OFFICE_MAP[selectedCategory] && (
              <span className="px-2 py-1 rounded-lg text-xs font-bold bg-orange-50 text-orange-600">
                المكتب المختص: {OFFICES[COMPLAINT_OFFICE_MAP[selectedCategory]]?.icon} {OFFICES[COMPLAINT_OFFICE_MAP[selectedCategory]]?.nameAr}
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {filteredReports.map(r => {
              const np = normalizePriority(r.priority)
              const pc = VIGILANCE_PRIORITY_COLORS[np] || '#94a3b8'
              return (
                <button key={r.sourceKind + r.id} onClick={() => onNavigate(r)} className="w-full text-right bg-slate-50 hover:bg-slate-100 rounded-xl p-2.5 transition flex items-center gap-2">
                  <span className="text-lg shrink-0">{REPORT_SOURCE_ICONS[r.sourceKind]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold truncate">{r.reference}</div>
                    <div className="text-[10px] text-slate-500 truncate">{r.description || '—'}</div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0" style={{ backgroundColor: pc + '15', color: pc }}>{VIGILANCE_PRIORITY_LABELS[np]}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">{r.daysOpen}ي</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
