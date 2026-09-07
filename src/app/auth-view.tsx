'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type AuthSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import {
  AUTH_REQUEST_TYPE_LABELS, AUTH_REQUEST_TYPE_ICONS, AUTH_STATUS_LABELS, AUTH_STATUS_COLORS,
  OPINION_RESULT_LABELS, OPINION_RESULT_COLORS,
  COMMITTEE_STATUS_LABELS, COMMITTEE_STATUS_COLORS,
  AUTHORIZATION_STATUS_LABELS, AUTHORIZATION_STATUS_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { AuthorizationDossier, SanitaryOpinion, CommitteeVisit } from './authorizations/types'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: AuthSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'dossiers', label: 'ملفات الترخيص', icon: '📋' },
  { id: 'opinions', label: 'الآراء الصحية', icon: '📝' },
  { id: 'visits', label: 'زيارات اللجان', icon: '👥' },
]

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

export default function AuthView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { authSubTab, setAuthSubTab, selectedYear, user } = useAppStore()
  const [dossiers, setDossiers] = useState<AuthorizationDossier[]>([])
  const [opinions, setOpinions] = useState<SanitaryOpinion[]>([])
  const [visits, setVisits] = useState<CommitteeVisit[]>([])
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
      const [dRes, oRes, vRes] = await Promise.allSettled([
        fetch(`/api/auth-dossiers?${buildParams()}`),
        fetch(`/api/auth-opinions?${buildParams()}`),
        fetch(`/api/committee-visits?${buildParams()}`),
      ])
      if (dRes.status === 'fulfilled' && dRes.value.ok) { const d = await dRes.value.json(); setDossiers(d.dossiers || []) }
      if (oRes.status === 'fulfilled' && oRes.value.ok) { const d = await oRes.value.json(); setOpinions(d.opinions || []) }
      if (vRes.status === 'fulfilled' && vRes.value.ok) { const d = await vRes.value.json(); setVisits(d.visits || []) }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const reviewOpinion = useCallback(async (id: string, result: string) => {
    if (user?.role !== 'admin') {
      toast.error('المصادقة النهائية متاحة للمدير العام فقط')
      return
    }
    try {
      const response = await fetch(`/api/auth-opinions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ result, validationStatus: result === 'FAVORABLE' ? 'APPROVED' : 'REJECTED' }) })
      const data = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) { toast.error(data?.error || 'تعذرت المصادقة'); return }
      toast.success('تم تسجيل المصادقة اليدوية')
      await refresh()
    } catch { toast.error('تعذرت المصادقة حالياً') }
  }, [refresh, user])

  const reviewVisit = useCallback(async (id: string, recommendation: string) => {
    if (user?.role !== 'admin') {
      toast.error('المصادقة النهائية متاحة للمدير العام فقط')
      return
    }
    try {
      const response = await fetch(`/api/committee-visits/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recommendation, validationStatus: recommendation === 'FAVORABLE' ? 'APPROVED' : 'REJECTED' }) })
      const data = await response.json().catch(() => null) as { error?: string } | null
      if (!response.ok) { toast.error(data?.error || 'تعذرت المصادقة'); return }
      toast.success('تم تسجيل مصادقة اللجنة')
      await refresh()
    } catch { toast.error('تعذرت المصادقة حالياً') }
  }, [refresh, user])

  const stats = useMemo(() => {
    const pending = dossiers.filter(d => d.opinionStatus === 'PENDING').length
    const pendingOpinions = opinions.filter(o => o.validationStatus === 'PENDING').length
    const pendingVisits = visits.filter(v => v.validationStatus === 'PENDING').length
    return { pending, pendingOpinions, pendingVisits }
  }, [dossiers, opinions, visits])

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-blue-700 to-indigo-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">📋</span> التراخيص واللجان</h1>
            <p className="text-blue-50 text-xs sm:text-sm mt-0.5">ملفات الترخيص والآراء الصحية وزيارات اللجان — المكتب 08</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{dossiers.length}</div><div className="text-[10px] opacity-80 mt-0.5">ملف ترخيص</div></div>
            {stats.pending > 0 && <div className="bg-amber-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-amber-100">{stats.pending}</div><div className="text-[10px] opacity-80 mt-0.5">بانتظار رأي</div></div>}
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 text-xs text-amber-800 flex items-start gap-2">
        <span className="text-base">⚠️</span>
        <div><strong>تنبيه قانوني:</strong> كل رأي صحي وتوصية لجنة يتطلبان مصادقة يدوية. لا تُصدر المنصة رأياً تلقائياً. حقل <code className="bg-amber-100 px-1 rounded">rokhasReference</code> مرجع نصي فقط — لا تكامل API.</div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setAuthSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${authSubTab === tab.id ? 'bg-blue-700 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-blue-50 border border-slate-200'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={authSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {authSubTab === 'dashboard' && <Dashboard dossiers={dossiers} opinions={opinions} visits={visits} stats={stats} onNavigate={(t) => setAuthSubTab(t)} />}
          {authSubTab === 'dossiers' && <DossiersTab data={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'dossier'} setShowCreate={(v) => setShowCreate(v ? 'dossier' : null)} />}
          {authSubTab === 'opinions' && <OpinionsTab data={opinions} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'opinion'} setShowCreate={(v) => setShowCreate(v ? 'opinion' : null)} canValidate={user?.role === 'admin'} onReview={reviewOpinion} />}
          {authSubTab === 'visits' && <VisitsTab data={visits} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'visit'} setShowCreate={(v) => setShowCreate(v ? 'visit' : null)} canValidate={user?.role === 'admin'} onReview={reviewVisit} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ===== Dashboard =====
function Dashboard({ dossiers, opinions, visits, stats, onNavigate }: any) {
  if (dossiers.length === 0 && opinions.length === 0 && visits.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-6xl mb-4">📋</div><h3 className="text-lg font-bold text-slate-700">لا توجد ملفات ترخيص بعد</h3></div>
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[{ icon: '📋', v: dossiers.length, l: 'ملف ترخيص', go: 'dossiers' as const }, { icon: '📝', v: opinions.length, l: 'رأي صحي', go: 'opinions' as const }, { icon: '👥', v: visits.length, l: 'زيارة لجنة', go: 'visits' as const }, { icon: '⏳', v: stats.pending + stats.pendingOpinions + stats.pendingVisits, l: 'بانتظار', go: 'dossiers' as const }].map((k, i) => (
          <motion.button key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onNavigate(k.go)} className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md transition">
            <div className="flex items-center justify-between"><span className="text-xl">{k.icon}</span><span className="text-2xl font-black text-slate-800">{k.v}</span></div>
            <p className="text-xs text-slate-500 mt-1">{k.l}</p>
          </motion.button>
        ))}
      </div>
      {dossiers.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">📋 ملفات الترخيص حسب النوع</h3>
          <div className="space-y-1.5">
            {Object.entries((dossiers as AuthorizationDossier[]).reduce((acc: Record<string, number>, d) => { acc[d.requestType] = (acc[d.requestType] || 0) + 1; return acc }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
              <div key={t} className="flex items-center gap-2 text-xs"><span className="w-36 shrink-0">{AUTH_REQUEST_TYPE_ICONS[t]} {AUTH_REQUEST_TYPE_LABELS[t]}</span><div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden"><div className="h-full bg-blue-600 rounded-md" style={{ width: `${Math.max(5, (n / dossiers.length) * 100)}%` }} /></div><span className="font-bold w-6 text-left">{n}</span></div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ===== Shared UI =====
function Spinner() { return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div> }
function Empty({ icon, text }: { icon: string; text: string }) { return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">{icon}</div><p className="text-sm text-slate-500">{text}</p></div> }
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return <AnimatePresence>{open && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl"><div className="bg-gradient-to-l from-blue-700 to-indigo-800 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button></div><div className="p-5">{children}</div></motion.div></motion.div>)}</AnimatePresence>
}
const inp = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
async function submitForm(endpoint: string, body: any, onSuccess: () => void, savingFn: (v: boolean) => void) {
  savingFn(true); try { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) { const e = await res.json().catch(() => null); toast.error(e?.error || 'فشل'); return }; toast.success('تم الإنشاء — بانتظار المصادقة'); onSuccess() } catch { toast.error('حدث خطأ') } finally { savingFn(false) }
}

// ===== Dossiers Tab =====
function DossiersTab({ data, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const filtered = data.filter((d: AuthorizationDossier) => (filterType === 'ALL' || d.requestType === filterType) && (!search || d.reference.includes(search) || d.applicantName.toLowerCase().includes(search.toLowerCase()) || d.establishmentName.toLowerCase().includes(search.toLowerCase())))
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <input type="text" placeholder="🔍 بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل الأنواع</option>{Object.entries(AUTH_REQUEST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{AUTH_REQUEST_TYPE_ICONS[k]} {v}</option>)}</select>
      <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-blue-700 text-white hover:bg-blue-800">➕ ملف جديد</button>
    </div>
    {filtered.length === 0 ? <Empty icon="📋" text="لا توجد ملفات" /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((d: AuthorizationDossier, i: number) => {
          const sc = AUTH_STATUS_COLORS[d.status]; const oc = OPINION_RESULT_COLORS[d.opinionStatus] || '#94a3b8'
          return (
            <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: oc }} />
              <div className="flex items-start justify-between pr-1"><div className="min-w-0"><div className="text-sm font-bold">{AUTH_REQUEST_TYPE_ICONS[d.requestType]} {d.establishmentName || d.applicantName || d.reference}</div><div className="text-[10px] text-slate-400">{d.reference}</div></div>
                <div className="flex flex-col gap-1 items-end shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{AUTH_STATUS_LABELS[d.status]}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: oc + '15', color: oc }}>{OPINION_RESULT_LABELS[d.opinionStatus]}</span></div></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1"><span>{AUTH_REQUEST_TYPE_LABELS[d.requestType]}</span>{d.rokhasReference && <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono">Rokhas: {d.rokhasReference}</span>}<span style={{ color: COMMUNE_COLORS[d.commune] }}>{COMMUNE_LABELS[d.commune] || d.commune}</span></div>
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="📋 ملف ترخيص جديد"><DossierForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Opinions Tab =====
function OpinionsTab({ data, loading, onRefresh, buildParams, showCreate, setShowCreate, canValidate, onReview }: any) {
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex items-center gap-2"><button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-blue-700 text-white hover:bg-blue-800">➕ رأي جديد</button></div>
    {data.length === 0 ? <Empty icon="📝" text="لا توجد آراء" /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((o: SanitaryOpinion, i: number) => {
          const rc = OPINION_RESULT_COLORS[o.result] || '#94a3b8'
          return (
            <motion.div key={o.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: rc }} />
              <div className="flex items-start justify-between pr-1"><div className="min-w-0"><div className="text-sm font-bold">{o.establishmentName || o.reference}</div><div className="text-[10px] text-slate-400">{o.reference}</div></div>
                <div className="flex flex-col gap-1 items-end shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: rc + '15', color: rc }}>{OPINION_RESULT_LABELS[o.result]}</span>{o.validationStatus === 'PENDING' && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠️ بانتظار المصادقة</span>}</div></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">{o.observations && <span className="line-clamp-1">📝 {o.observations}</span>}<span>· {fmtDate(o.date)}</span></div>
              {canValidate && o.validationStatus === 'PENDING' && <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => onReview(o.id, 'FAVORABLE')} className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">اعتماد مؤيد</button><button type="button" onClick={() => onReview(o.id, 'UNFAVORABLE')} className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-red-700">رفض الرأي</button></div>}
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="📝 رأي صحي جديد"><OpinionForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Visits Tab =====
function VisitsTab({ data, loading, onRefresh, buildParams, showCreate, setShowCreate, canValidate, onReview }: any) {
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex items-center gap-2"><button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-blue-700 text-white hover:bg-blue-800">➹ زيارة لجنة</button></div>
    {data.length === 0 ? <Empty icon="👥" text="لا توجد زيارات" /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {data.map((v: CommitteeVisit, i: number) => {
          const sc = COMMITTEE_STATUS_COLORS[v.status]; const rc = OPINION_RESULT_COLORS[v.recommendation] || '#94a3b8'
          return (
            <motion.div key={v.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: rc }} />
              <div className="flex items-start justify-between pr-1"><div className="min-w-0"><div className="text-sm font-bold">👥 {v.establishmentName || v.reference}</div><div className="text-[10px] text-slate-400">{v.reference}</div></div>
                <div className="flex flex-col gap-1 items-end shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{COMMITTEE_STATUS_LABELS[v.status]}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: rc + '15', color: rc }}>{OPINION_RESULT_LABELS[v.recommendation]}</span></div></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1"><span>📅 {fmtDate(v.visitDate)}</span>{v.validationStatus === 'PENDING' && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold">⚠️ بانتظار المصادقة</span>}</div>
              {canValidate && v.validationStatus === 'PENDING' && <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><button type="button" onClick={() => onReview(v.id, 'FAVORABLE')} className="flex-1 rounded-lg bg-emerald-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">اعتماد التوصية</button><button type="button" onClick={() => onReview(v.id, 'UNFAVORABLE')} className="flex-1 rounded-lg bg-red-600 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-red-700">رفض التوصية</button></div>}
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="👥 زيارة لجنة جديدة"><VisitForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Forms =====
function DossierForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ applicantName: '', applicantCin: '', applicantPhone: '', establishmentName: '', activity: '', commune: '', quartier: '', adresse: '', requestType: 'COMMERCIAL', rokhasReference: '', competentAuthority: '', legalReference: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); const p = buildParams(); submitForm('/api/auth-dossiers', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL' }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">⚠️ الرأي يبدأ "بانتظار" ويتطلب مصادقة يدوية. rokhasReference مرجع نصي فقط.</div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">مقدم الطلب</label><input value={f.applicantName} onChange={(e) => setF({ ...f, applicantName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">المنشأة</label><input value={f.establishmentName} onChange={(e) => setF({ ...f, establishmentName: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">النشاط</label><input value={f.activity} onChange={(e) => setF({ ...f, activity: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">نوع الطلب</label><select value={f.requestType} onChange={(e) => setF({ ...f, requestType: e.target.value })} className={inp}>{Object.entries(AUTH_REQUEST_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{AUTH_REQUEST_TYPE_ICONS[k]} {v}</option>)}</select></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">مرجع Rokhas (اختياري — نص فقط)</label><input value={f.rokhasReference} onChange={(e) => setF({ ...f, rokhasReference: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الجهة المختصة</label><input value={f.competentAuthority} onChange={(e) => setF({ ...f, competentAuthority: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">المرجع القانوني</label><input value={f.legalReference} onChange={(e) => setF({ ...f, legalReference: e.target.value })} placeholder="قيد التحقق" className={inp} /></div></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function OpinionForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ establishmentName: '', commune: '', opinionType: 'COMMERCIAL', observations: '', reservations: '', correctiveActions: '', recommendation: '', legalReference: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); const p = buildParams(); submitForm('/api/auth-opinions', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL' }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">⚠️ الرأي يبدأ "بانتظار" + المصادقة يدوية.</div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">المنشأة</label><input value={f.establishmentName} onChange={(e) => setF({ ...f, establishmentName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">ملاحظات</label><textarea value={f.observations} onChange={(e) => setF({ ...f, observations: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">التحفّظات</label><input value={f.reservations} onChange={(e) => setF({ ...f, reservations: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">إجراءات تصحيحية</label><input value={f.correctiveActions} onChange={(e) => setF({ ...f, correctiveActions: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">التوصية الأولية</label><input value={f.recommendation} onChange={(e) => setF({ ...f, recommendation: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">المرجع القانوني</label><input value={f.legalReference} onChange={(e) => setF({ ...f, legalReference: e.target.value })} placeholder="قيد التحقق" className={inp} /></div></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function VisitForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ establishmentName: '', commune: '', visitDate: '', inspectionNotes: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); const p = buildParams(); submitForm('/api/committee-visits', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL', visitDate: f.visitDate || null }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">المنشأة</label><input value={f.establishmentName} onChange={(e) => setF({ ...f, establishmentName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الزيارة</label><input type="date" value={f.visitDate} onChange={(e) => setF({ ...f, visitDate: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">ملاحظات المعاينة</label><textarea value={f.inspectionNotes} onChange={(e) => setF({ ...f, inspectionNotes: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-blue-700 rounded-lg hover:bg-blue-800 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}
