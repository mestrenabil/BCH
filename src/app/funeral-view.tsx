'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type FuneralSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import {
  DEATH_CASE_STATUS_LABELS, DEATH_CASE_STATUS_COLORS,
  MORGUE_STATUS_LABELS, MORGUE_STATUS_COLORS,
  BURIAL_STATUS_LABELS, BURIAL_STATUS_COLORS,
  AUTHORIZATION_STATUS_LABELS, AUTHORIZATION_STATUS_COLORS,
  CEMETERY_TYPE_LABELS, CEMETERY_TYPE_ICONS, CEMETERY_STATUS_LABELS, CEMETERY_STATUS_COLORS,
  TRANSPORT_STATUS_LABELS, TRANSPORT_STATUS_COLORS,
  EXHUMATION_STATUS_LABELS, EXHUMATION_STATUS_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { DeathCase, BurialDossier, Cemetery, CorpseTransport, ExhumationDossier, FuneralDashboardMetrics } from './funeral/types'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: FuneralSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'deaths', label: 'حالات الوفاة', icon: '⚱️' },
  { id: 'burials', label: 'ملفات الدفن', icon: '🪦' },
  { id: 'cemeteries', label: 'المقابر', icon: '🕌' },
  { id: 'transports', label: 'النقل', icon: '🚐' },
  { id: 'exhumations', label: 'النبش', icon: '⛏️' },
]

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

export default function FuneralView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { funeralSubTab, setFuneralSubTab, selectedYear } = useAppStore()
  const [deaths, setDeaths] = useState<DeathCase[]>([])
  const [burials, setBurials] = useState<BurialDossier[]>([])
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([])
  const [transports, setTransports] = useState<CorpseTransport[]>([])
  const [exhumations, setExhumations] = useState<ExhumationDossier[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<FuneralDashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState<string | null>(null)

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
      const [dRes, bRes, cRes, tRes, eRes, statsRes] = await Promise.allSettled([
        fetch(`/api/death-cases?${buildParams()}`),
        fetch(`/api/burials?${buildParams()}`),
        fetch(`/api/cemeteries?${buildParams()}`),
        fetch(`/api/corpse-transports?${buildParams()}`),
        fetch(`/api/exhumations?${buildParams()}`),
        fetch(`/api/funeral/statistics?${buildParams()}`),
      ])
      if (dRes.status === 'fulfilled' && dRes.value.ok) { const d = await dRes.value.json(); setDeaths(d.deathCases || []) }
      if (bRes.status === 'fulfilled' && bRes.value.ok) { const d = await bRes.value.json(); setBurials(d.burials || []) }
      if (cRes.status === 'fulfilled' && cRes.value.ok) { const d = await cRes.value.json(); setCemeteries(d.cemeteries || []) }
      if (tRes.status === 'fulfilled' && tRes.value.ok) { const d = await tRes.value.json(); setTransports(d.transports || []) }
      if (eRes.status === 'fulfilled' && eRes.value.ok) { const d = await eRes.value.json(); setExhumations(d.exhumations || []) }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) { const d = await statsRes.value.json(); setDashboardMetrics(d.metrics || null) }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => {
    const inMorgue = deaths.filter(d => d.morgueStatus === 'ADMITTED').length
    const pendingAuth = [...burials, ...transports, ...exhumations].filter(x => x.authorizationStatus === 'PENDING').length
    return { inMorgue, pendingAuth }
  }, [deaths, burials, transports, exhumations])

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-stone-700 to-slate-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">⚱️</span> الجنائز والمقابر والمستودع</h1>
            <p className="text-stone-200 text-xs sm:text-sm mt-0.5">حالات الوفاة وملفات الدفن والمقابر والنقل والنبش — المكتب 05</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{deaths.length}</div><div className="text-[10px] opacity-80 mt-0.5">حالة وفاة</div></div>
            {stats.inMorgue > 0 && <div className="bg-violet-900/40 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-violet-100">{stats.inMorgue}</div><div className="text-[10px] opacity-80 mt-0.5">في المستودع</div></div>}
            {stats.pendingAuth > 0 && <div className="bg-amber-900/40 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-amber-100">{stats.pendingAuth}</div><div className="text-[10px] opacity-80 mt-0.5">بانتظار إذن</div></div>}
          </div>
        </div>
      </div>

      {/* تنبيه قانوني دائم */}
      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
        <span className="text-base">⚠️</span>
        <div><strong>تنبيه قانوني:</strong> كل إذن (دفن، نبش، نقل) يتطلب مصادقة يدوية من الموظف المختص. لا تُصدر المنصة أي ترخيص آلياً. راجع <code className="bg-amber-100 px-1 rounded">docs/LEGAL_SAFETY.md</code>.</div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setFuneralSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${funeralSubTab === tab.id ? 'bg-stone-700 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-stone-50 border border-slate-200'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={funeralSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {funeralSubTab === 'dashboard' && <Dashboard deaths={deaths} burials={burials} cemeteries={cemeteries} transports={transports} exhumations={exhumations} dashboardMetrics={dashboardMetrics} onNavigate={(t) => setFuneralSubTab(t)} />}
          {funeralSubTab === 'deaths' && <DeathsTab data={deaths} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'death'} setShowCreate={(v) => setShowCreate(v ? 'death' : null)} />}
          {funeralSubTab === 'burials' && <BurialsTab data={burials} cemeteries={cemeteries} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'burial'} setShowCreate={(v) => setShowCreate(v ? 'burial' : null)} />}
          {funeralSubTab === 'cemeteries' && <CemeteriesTab data={cemeteries} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'cemetery'} setShowCreate={(v) => setShowCreate(v ? 'cemetery' : null)} />}
          {funeralSubTab === 'transports' && <TransportsTab data={transports} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'transport'} setShowCreate={(v) => setShowCreate(v ? 'transport' : null)} />}
          {funeralSubTab === 'exhumations' && <ExhumationsTab data={exhumations} cemeteries={cemeteries} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'exhumation'} setShowCreate={(v) => setShowCreate(v ? 'exhumation' : null)} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ===== Dashboard =====
function Dashboard({ deaths, burials, cemeteries, transports, exhumations, dashboardMetrics, onNavigate }: any) {
  const pendingAuth = [...burials, ...transports, ...exhumations].filter((x: any) => x.authorizationStatus === 'PENDING').length
  if (!dashboardMetrics && deaths.length === 0 && burials.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-6xl mb-4">⚱️</div><h3 className="text-lg font-bold text-slate-700">لا توجد بيانات بعد</h3><p className="text-sm text-slate-500 mt-2">ابدأ بتسجيل حالة وفاة أو مقبرة.</p></div>
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {(dashboardMetrics ? [
          { icon: '⚱️', v: dashboardMetrics.deathsTotal, l: 'حالات وفاة', go: 'deaths' as const },
          { icon: '🏥', v: dashboardMetrics.morgueAdmitted, l: 'في المستودع', go: 'deaths' as const },
          { icon: '🪦', v: dashboardMetrics.burialsTotal, l: 'ملفات دفن', go: 'burials' as const },
          { icon: '⚠️', v: dashboardMetrics.pendingBurialAuthorizations, l: 'دفن بانتظار إذن', go: 'burials' as const },
          { icon: '🕌', v: dashboardMetrics.cemeteriesTotal, l: 'المقابر', go: 'cemeteries' as const },
          { icon: '🚨', v: dashboardMetrics.fullCemeteries, l: 'مقابر ممتلئة', go: 'cemeteries' as const },
          { icon: '🚐', v: dashboardMetrics.transportsTotal, l: 'عمليات نقل', go: 'transports' as const },
          { icon: '⚠️', v: dashboardMetrics.pendingTransportAuthorizations, l: 'نقل بانتظار إذن', go: 'transports' as const },
          { icon: '⛏️', v: dashboardMetrics.exhumationsTotal, l: 'ملفات نبش', go: 'exhumations' as const },
          { icon: '⚠️', v: dashboardMetrics.pendingExhumationAuthorizations, l: 'نبش بانتظار إذن', go: 'exhumations' as const },
          { icon: '📋', v: dashboardMetrics.pendingAuthorizations, l: 'إجمالي المصادقات المعلقة', go: 'burials' as const },
        ] : [
          { icon: '⚱️', v: deaths.length, l: 'وفاة', go: 'deaths' as const }, { icon: '🪦', v: burials.length, l: 'دفن', go: 'burials' as const }, { icon: '🕌', v: cemeteries.length, l: 'مقبرة', go: 'cemeteries' as const }, { icon: '🚐', v: transports.length, l: 'نقل', go: 'transports' as const }, { icon: '⛏️', v: exhumations.length, l: 'نبش', go: 'exhumations' as const }
        ]).map((k, i) => (
          <motion.button key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onNavigate(k.go)} className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md transition">
            <div className="flex items-center justify-between"><span className="text-xl">{k.icon}</span><span className="text-2xl font-black text-slate-800">{k.v}</span></div>
            <p className="text-xs text-slate-500 mt-1">{k.l}</p>
          </motion.button>
        ))}
      </div>
      {pendingAuth > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
          <div><div className="text-lg font-bold text-amber-800">⚠️ {pendingAuth} طلب بانتظار مصادقة</div><p className="text-xs text-amber-700 mt-1">دفن/نقل/نبش يتطلب موافقة يدوية</p></div>
        </div>
      )}
      {/* المقابر وسعتها */}
      {cemeteries.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🕌 حالة المقابر</h3>
          <div className="space-y-2">
            {cemeteries.map((c: Cemetery) => {
              const pct = c.capacity > 0 ? Math.round((c.occupied / c.capacity) * 100) : 0
              const isFull = pct >= 90
              return (
                <div key={c.id} className="flex items-center gap-2 text-xs">
                  <span className="w-32 shrink-0 truncate">{CEMETERY_TYPE_ICONS[c.type]} {c.name}</span>
                  <div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden relative">
                    <div className="h-full rounded-md" style={{ width: `${pct}%`, background: isFull ? '#ef4444' : pct > 70 ? '#f59e0b' : '#10b981' }} />
                  </div>
                  <span className="font-bold w-20 text-left text-slate-600">{c.occupied}/{c.capacity}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Shared UI =====
function Spinner() { return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-stone-500 border-t-transparent rounded-full animate-spin" /></div> }
function Empty({ icon, text }: { icon: string; text: string }) { return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">{icon}</div><p className="text-sm text-slate-500">{text}</p></div> }

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className="bg-gradient-to-l from-stone-700 to-slate-800 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button></div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function AuthBadge({ status }: { status: string }) {
  const c = AUTHORIZATION_STATUS_COLORS[status] || '#94a3b8'
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: c + '15', color: c }}>{AUTHORIZATION_STATUS_LABELS[status] || status}</span>
}

function CardShell({ ref: reference, name, badge, color, children, onClick }: any) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden cursor-pointer hover:shadow-md transition" onClick={onClick}>
      <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: color }} />
      <div className="flex items-start justify-between pr-1">
        <div className="min-w-0"><div className="text-sm font-bold truncate">{name}</div><div className="text-[10px] text-slate-400">{reference}</div></div>
        {badge}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">{children}</div>
    </motion.div>
  )
}

const inp = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-400"
function SaveBtn({ saving, label = 'إنشاء' }: { saving: boolean; label?: string }) { return <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-stone-700 rounded-lg hover:bg-stone-800 disabled:opacity-50">{saving ? '...' : label}</button> }

// ===== Deaths Tab =====
function DeathsTab({ data, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const filtered = data.filter((d: DeathCase) => (filterStatus === 'ALL' || d.status === filterStatus) && (!search || d.reference.includes(search) || d.deceasedName.toLowerCase().includes(search.toLowerCase())))
  if (loading && data.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-stone-400" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل الحالات</option>{Object.entries(DEATH_CASE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-stone-700 text-white hover:bg-stone-800">➕ حالة وفاة</button>
      </div>
      {filtered.length === 0 ? <Empty icon="⚱️" text="لا توجد حالات" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((d: DeathCase, i: number) => {
            const sc = DEATH_CASE_STATUS_COLORS[d.status]
            const mc = MORGUE_STATUS_COLORS[d.morgueStatus]
            return (
              <CardShell key={d.id} ref={d.reference} name={`⚱️ ${d.deceasedName}`} color={sc} i={i} badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{DEATH_CASE_STATUS_LABELS[d.status]}</span>}>
                {d.deceasedAge && <span>{d.deceasedAge} سنة</span>}
                <span style={{ color: COMMUNE_COLORS[d.commune] }}>{COMMUNE_LABELS[d.commune] || d.commune}</span>
                {d.deathDate && <span>· وفاة: {fmtDate(d.deathDate)}</span>}
                {d.morgueStatus !== 'NONE' && <span className="px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: mc + '15', color: mc }}>المستودع: {MORGUE_STATUS_LABELS[d.morgueStatus]}</span>}
              </CardShell>
            )
          })}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="⚱️ حالة وفاة جديدة"><DeathForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
    </div>
  )
}

// ===== Burials Tab =====
function BurialsTab({ data, cemeteries, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [filterAuth, setFilterAuth] = useState('ALL')
  const filtered = data.filter((b: BurialDossier) => filterAuth === 'ALL' || b.authorizationStatus === filterAuth)
  if (loading && data.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filterAuth} onChange={(e) => setFilterAuth(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل التراخيص</option>{Object.entries(AUTHORIZATION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-stone-700 text-white hover:bg-stone-800">➕ ملف دفن</button>
      </div>
      {filtered.length === 0 ? <Empty icon="🪦" text="لا توجد ملفات دفن" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((b: BurialDossier, i: number) => {
            const sc = BURIAL_STATUS_COLORS[b.status]
            return (
              <CardShell key={b.id} ref={b.reference} name={`🪦 ${b.deceasedName}`} color={sc} i={i} badge={<div className="flex flex-col gap-1 items-end shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{BURIAL_STATUS_LABELS[b.status]}</span><AuthBadge status={b.authorizationStatus} /></div>}>
                {b.cemetery?.name && <span>🕌 {b.cemetery.name}</span>}
                {b.plotSection && <span>📍 {b.plotSection}</span>}
                {b.burialDate && <span>· {fmtDate(b.burialDate)}</span>}
                {b.authorizationStatus === 'PENDING' && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">⚠️ يتطلب إذناً</span>}
              </CardShell>
            )
          })}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🪦 ملف دفن جديد"><BurialForm cemeteries={cemeteries} buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
    </div>
  )
}

// ===== Cemeteries Tab =====
function CemeteriesTab({ data, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [filterStatus, setFilterStatus] = useState('ALL')
  const filtered = data.filter((c: Cemetery) => filterStatus === 'ALL' || c.status === filterStatus)
  if (loading && data.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل الحالات</option>{Object.entries(CEMETERY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-stone-700 text-white hover:bg-stone-800">➕ مقبرة</button>
      </div>
      {filtered.length === 0 ? <Empty icon="🕌" text="لا توجد مقابر" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c: Cemetery, i: number) => {
            const sc = CEMETERY_STATUS_COLORS[c.status]
            const pct = c.capacity > 0 ? Math.round((c.occupied / c.capacity) * 100) : 0
            return (
              <CardShell key={c.id} ref={c.reference} name={`${CEMETERY_TYPE_ICONS[c.type]} ${c.name}`} color={sc} i={i} badge={<span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{CEMETERY_STATUS_LABELS[c.status]}</span>}>
                <span>{CEMETERY_TYPE_LABELS[c.type]}</span>
                <span style={{ color: COMMUNE_COLORS[c.commune] }}>{COMMUNE_LABELS[c.commune] || c.commune}</span>
                <span>· {c.occupied}/{c.capacity} ({pct}%)</span>
              </CardShell>
            )
          })}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🕌 مقبرة جديدة"><CemeteryForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
    </div>
  )
}

// ===== Transports Tab =====
function TransportsTab({ data, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  if (loading && data.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-stone-700 text-white hover:bg-stone-800">➕ طلب نقل</button></div>
      {data.length === 0 ? <Empty icon="🚐" text="لا توجد عمليات نقل" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.map((t: CorpseTransport, i: number) => {
            const sc = TRANSPORT_STATUS_COLORS[t.status]
            return (
              <CardShell key={t.id} ref={t.reference} name={`🚐 ${t.deceasedName}`} color={sc} i={i} badge={<div className="flex flex-col gap-1 items-end shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{TRANSPORT_STATUS_LABELS[t.status]}</span><AuthBadge status={t.authorizationStatus} /></div>}>
                <span>{t.originPlace} → {t.destinationPlace}</span>
                {t.transportDate && <span>· {fmtDate(t.transportDate)}</span>}
                {t.vehiclePlate && <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">{t.vehiclePlate}</span>}
              </CardShell>
            )
          })}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🚐 طلب نقل جديد"><TransportForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
    </div>
  )
}

// ===== Exhumations Tab =====
function ExhumationsTab({ data, cemeteries, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  if (loading && data.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2"><button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-stone-700 text-white hover:bg-stone-800">➕ طلب نبش</button></div>
      {data.length === 0 ? <Empty icon="⛏️" text="لا توجد طلبات نبش" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.map((e: ExhumationDossier, i: number) => {
            const sc = EXHUMATION_STATUS_COLORS[e.status]
            return (
              <CardShell key={e.id} ref={e.reference} name={`⛏️ ${e.deceasedName}`} color={sc} i={i} badge={<div className="flex flex-col gap-1 items-end shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{EXHUMATION_STATUS_LABELS[e.status]}</span><AuthBadge status={e.authorizationStatus} /></div>}>
                {e.cemetery?.name && <span>🕌 {e.cemetery.name}</span>}
                {e.plotSection && <span>📍 {e.plotSection}</span>}
                {e.reason && <span>· {e.reason}</span>}
                {e.authorizationStatus === 'PENDING' && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">⚠️ حساس — يتطلب إذناً</span>}
              </CardShell>
            )
          })}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="⛏️ طلب نبش جديد"><ExhumationForm cemeteries={cemeteries} buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
    </div>
  )
}

// ===== Forms =====
function DeathForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ deceasedName: '', deceasedCin: '', deceasedAge: '', deceasedGender: 'M', deathDate: '', deathCause: '', deathPlace: '', commune: '', source: 'INTERNAL', declarantName: '', declarantPhone: '', morgueStatus: 'NONE', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.deceasedName.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    try { const p = buildParams(); const res = await fetch('/api/death-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || p.get('commune') || 'ALL', deceasedAge: f.deceasedAge || null, deathDate: f.deathDate || null }) }); if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }; toast.success('تم التسجيل'); onCreated() } catch { toast.error('خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">اسم المتوفى *</label><input value={f.deceasedName} onChange={(e) => setF({ ...f, deceasedName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">البطاقة الوطنية</label><input value={f.deceasedCin} onChange={(e) => setF({ ...f, deceasedCin: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-3 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">العمر</label><input type="number" value={f.deceasedAge} onChange={(e) => setF({ ...f, deceasedAge: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجنس</label><select value={f.deceasedGender} onChange={(e) => setF({ ...f, deceasedGender: e.target.value })} className={inp}><option value="M">ذكر</option><option value="F">أنثى</option></select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الوفاة</label><input type="date" value={f.deathDate} onChange={(e) => setF({ ...f, deathDate: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">مكان الوفاة</label><input value={f.deathPlace} onChange={(e) => setF({ ...f, deathPlace: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">سبب الوفاة (عام)</label><input value={f.deathCause} onChange={(e) => setF({ ...f, deathCause: e.target.value })} className={inp} /></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">حالة المستودع</label><select value={f.morgueStatus} onChange={(e) => setF({ ...f, morgueStatus: e.target.value })} className={inp}>{Object.entries(MORGUE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    <SaveBtn saving={saving} />
  </form>
}

function BurialForm({ cemeteries, buildParams, onCreated }: any) {
  const [f, setF] = useState({ deceasedName: '', deceasedCin: '', commune: '', cemeteryId: '', plotSection: '', burialDate: '', officiantName: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.deceasedName.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    try { const p = buildParams(); const res = await fetch('/api/burials', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || p.get('commune') || 'ALL', burialDate: f.burialDate || null }) }); if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }; toast.success('تم إنشاء الملف — بانتظار المصادقة'); onCreated() } catch { toast.error('خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">⚠️ إذن الدفن يبدأ "بانتظار المصادقة" ويتطلب موافقة يدوية + مرجع قانوني.</div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">اسم المتوفى *</label><input value={f.deceasedName} onChange={(e) => setF({ ...f, deceasedName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">البطاقة الوطنية</label><input value={f.deceasedCin} onChange={(e) => setF({ ...f, deceasedCin: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">المقبرة</label><select value={f.cemeteryId} onChange={(e) => setF({ ...f, cemeteryId: e.target.value })} className={inp}><option value="">— اختر —</option>{cemeteries.map((c: Cemetery) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">القسم/القبر</label><input value={f.plotSection} onChange={(e) => setF({ ...f, plotSection: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الدفن</label><input type="date" value={f.burialDate} onChange={(e) => setF({ ...f, burialDate: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <SaveBtn saving={saving} />
  </form>
}

function CemeteryForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ name: '', type: 'MUSLIM', commune: '', quartier: '', adresse: '', capacity: '', occupied: '', status: 'ACTIVE', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.name.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    try { const p = buildParams(); const res = await fetch('/api/cemeteries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || p.get('commune') || 'ALL' }) }); if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }; toast.success('تم الإنشاء'); onCreated() } catch { toast.error('خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الاسم *</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">النوع</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}>{Object.entries(CEMETERY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{CEMETERY_TYPE_ICONS[k]} {v}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الحالة</label><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inp}>{Object.entries(CEMETERY_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الطاقة الاستيعابية</label><input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">المشغولة</label><input type="number" value={f.occupied} onChange={(e) => setF({ ...f, occupied: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div></div>
    <SaveBtn saving={saving} />
  </form>
}

function TransportForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ deceasedName: '', commune: '', originPlace: '', destinationPlace: '', transportDate: '', vehiclePlate: '', driverName: '', driverPhone: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.deceasedName.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    try { const p = buildParams(); const res = await fetch('/api/corpse-transports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || p.get('commune') || 'ALL', transportDate: f.transportDate || null }) }); if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }; toast.success('تم الإنشاء — بانتظار الإذن'); onCreated() } catch { toast.error('خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">⚠️ إذن النقل يبدأ "بانتظار المصادقة".</div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">اسم المتوفى *</label><input value={f.deceasedName} onChange={(e) => setF({ ...f, deceasedName: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">مكان الانطلاق</label><input value={f.originPlace} onChange={(e) => setF({ ...f, originPlace: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الوجهة</label><input value={f.destinationPlace} onChange={(e) => setF({ ...f, destinationPlace: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ النقل</label><input type="date" value={f.transportDate} onChange={(e) => setF({ ...f, transportDate: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">لوحة المركبة</label><input value={f.vehiclePlate} onChange={(e) => setF({ ...f, vehiclePlate: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">السائق</label><input value={f.driverName} onChange={(e) => setF({ ...f, driverName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">هاتف السائق</label><input value={f.driverPhone} onChange={(e) => setF({ ...f, driverPhone: e.target.value })} className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div>
    <SaveBtn saving={saving} />
  </form>
}

function ExhumationForm({ cemeteries, buildParams, onCreated }: any) {
  const [f, setF] = useState({ deceasedName: '', deceasedCin: '', commune: '', cemeteryId: '', plotSection: '', originalBurialDate: '', exhumationDate: '', reason: '', newDestination: '', requesterName: '', requesterCin: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!f.deceasedName.trim()) { toast.error('الاسم مطلوب'); return }
    setSaving(true)
    try { const p = buildParams(); const res = await fetch('/api/exhumations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || p.get('commune') || 'ALL', originalBurialDate: f.originalBurialDate || null, exhumationDate: f.exhumationDate || null }) }); if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }; toast.success('تم الإنشاء — إذن النبش حسّاس جداً'); onCreated() } catch { toast.error('خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div className="bg-red-50 border border-red-300 rounded-lg p-2 text-[11px] text-red-700">⚠️ النبش عملية قانونية حسّاسة جداً. الإذن يبدأ "بانتظار المصادقة" ويتطلب موافقة يدوية + مرجع قانوني + جهة مختصة.</div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">اسم المتوفى *</label><input value={f.deceasedName} onChange={(e) => setF({ ...f, deceasedName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">البطاقة الوطنية</label><input value={f.deceasedCin} onChange={(e) => setF({ ...f, deceasedCin: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">المقبرة</label><select value={f.cemeteryId} onChange={(e) => setF({ ...f, cemeteryId: e.target.value })} className={inp}><option value="">— اختر —</option>{cemeteries.map((c: Cemetery) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">القسم/القبر</label><input value={f.plotSection} onChange={(e) => setF({ ...f, plotSection: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الدفن الأصلي</label><input type="date" value={f.originalBurialDate} onChange={(e) => setF({ ...f, originalBurialDate: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ النبش المقترح</label><input type="date" value={f.exhumationDate} onChange={(e) => setF({ ...f, exhumationDate: e.target.value })} className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">سبب النبش</label><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} className={inp} /></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوجهة الجديدة</label><input value={f.newDestination} onChange={(e) => setF({ ...f, newDestination: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">مقدم الطلب</label><input value={f.requesterName} onChange={(e) => setF({ ...f, requesterName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">بطاقة مقدم الطلب</label><input value={f.requesterCin} onChange={(e) => setF({ ...f, requesterCin: e.target.value })} className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div>
    <SaveBtn saving={saving} />
  </form>
}
