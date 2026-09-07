'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import {
  CSVR_SPECIES_ICONS, CSVR_SPECIES_LABELS, CSVR_SPECIES_COLORS,
  CSVR_REPORT_STATUS_COLORS, CSVR_REPORT_STATUS_LABELS,
  CSVR_PRIORITY_COLORS, CSVR_PRIORITY_LABELS,
  CSVR_REPORT_SOURCE_LABELS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { StrayReport } from './types'

interface Props {
  reports: StrayReport[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
}

const STATUS_OPTIONS = ['NOUVEAU', 'VERIFICATION', 'VALIDE', 'MISSION_PLANIFIEE', 'EN_COURS', 'TRAITE', 'PARTIEL', 'NON_LOCALISE', 'DOUBLON', 'CLASSE']
const PRIORITY_OPTIONS = ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE']
const SPECIES_OPTIONS = ['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER']
const SOURCE_OPTIONS = ['INTERNAL', 'PUBLIC', 'PHONE', 'AUTHORITY', 'COMMUNE', 'EDUCATIONAL', 'HEALTH', 'ASSOCIATION', 'SECURITY', 'AGENT', 'PROGRAMMED', 'OTHER']

const emptyForm = {
  source: 'INTERNAL',
  declarantName: '', declarantPhone: '', declarantRole: '',
  quartier: '', secteur: '', adresse: '',
  latitude: '', longitude: '',
  species: 'DOG', estimatedCount: '1',
  hasYoung: false, isAggressive: false, isInjured: false, isSick: false,
  rabiesSuspect: false, biteReported: false,
  nearSchool: false, nearMarket: false, nearHealth: false, nearDump: false,
  description: '', priority: 'NORMALE', observations: '',
}

export default function ReportsTab({ reports, loading, onRefresh, buildParams }: Props) {
  const { user } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [filterSpecies, setFilterSpecies] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [creatingMission, setCreatingMission] = useState(false)
  const [selected, setSelected] = useState<StrayReport | null>(null)

  const managedCommunes = user?.managedCommunes?.length ? user.managedCommunes : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])

  const [gpsState, setGpsState] = useState('')
  const captureGps = () => {
    setGpsState('جارٍ تحديد الموقع…')
    if (!navigator.geolocation) { setGpsState('الجهاز لا يدعم تحديد الموقع'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }))
        setGpsState('✓ تم تحديد الموقع')
      },
      () => setGpsState('تعذر تحديد الموقع'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filterStatus !== 'ALL' && r.statut !== filterStatus) return false
      if (filterPriority !== 'ALL' && r.priority !== filterPriority) return false
      if (filterSpecies !== 'ALL' && r.species !== filterSpecies) return false
      if (search) {
        const q = search.toLowerCase()
        if (!r.reference.toLowerCase().includes(q) && !r.adresse.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q) && !r.quartier.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [reports, filterStatus, filterPriority, filterSpecies, search])

  const openCreate = () => {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  const openEdit = (r: StrayReport) => {
    setForm({
      source: r.source, declarantName: r.declarantName, declarantPhone: r.declarantPhone, declarantRole: r.declarantRole,
      quartier: r.quartier, secteur: r.secteur, adresse: r.adresse,
      latitude: r.latitude?.toString() || '', longitude: r.longitude?.toString() || '',
      species: r.species, estimatedCount: String(r.estimatedCount),
      hasYoung: r.hasYoung, isAggressive: r.isAggressive, isInjured: r.isInjured, isSick: r.isSick,
      rabiesSuspect: r.rabiesSuspect, biteReported: r.biteReported,
      nearSchool: r.nearSchool, nearMarket: r.nearMarket, nearHealth: r.nearHealth, nearDump: r.nearDump,
      description: r.description, priority: r.priority, observations: r.observations,
    })
    setEditingId(r.id)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const params = buildParams()
      const commune = params.get('commune') || managedCommunes[0] || ''
      const body: Record<string, unknown> = {
        ...form,
        commune,
        estimatedCount: parseInt(form.estimatedCount) || 1,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      }
      const tf = Object.fromEntries(params)
      if (tf.regionCode) body.territoryFilter = { regionCode: tf.regionCode, provinceCode: tf.provinceCode || 'ALL', communeCode: tf.communeCode || 'ALL' }

      const res = await fetch(editingId ? `/api/csvr/reports/${editingId}` : '/api/csvr/reports', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'فشل الحفظ')
        return
      }
      toast.success(editingId ? 'تم تحديث البلاغ' : 'تم إنشاء البلاغ')
      setShowForm(false)
      onRefresh()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return
    try {
      const res = await fetch(`/api/csvr/reports/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('فشل الحذف'); return }
      toast.success('تم الحذف')
      setSelected(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  const createMissionFromReport = async (report: StrayReport) => {
    setCreatingMission(true)
    try {
      const params = buildParams()
      const response = await fetch('/api/csvr/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commune: report.commune || params.get('commune') || '',
          quartier: report.quartier,
          latitude: report.latitude,
          longitude: report.longitude,
          zone: report.adresse || report.quartier,
          priority: report.priority,
          estimatedAnimals: report.estimatedCount,
          preNotes: report.description,
          reportIds: [report.id],
          territoryFilter: Object.fromEntries(params),
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر إنشاء المهمة'); return }
      toast.success(`تم إنشاء المهمة ${data.reference || ''} وربطها بالبلاغ`)
      setSelected({ ...report, statut: 'MISSION_PLANIFIEE', missionId: data.id || report.missionId })
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء إنشاء المهمة') } finally { setCreatingMission(false) }
  }

  const handleStatusChange = async (id: string, statut: string) => {
    try {
      const res = await fetch(`/api/csvr/reports/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statut }),
      })
      if (!res.ok) { toast.error('فشل التحديث'); return }
      toast.success('تم تحديث الحالة')
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl">📢</span>
        <div><h2 className="text-base font-extrabold text-slate-800">البلاغات</h2><p className="mt-0.5 text-[11px] text-slate-500">استقبال البلاغات وتتبع معالجتها</p></div>
      </div>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          placeholder="بحث..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_REPORT_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأولويات</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{CSVR_PRIORITY_LABELS[p]}</option>)}
        </select>
        <select value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_SPECIES_LABELS[s]}</option>)}
        </select>
        <button onClick={openCreate} className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm whitespace-nowrap">
          + بلاغ جديد
        </button>
      </div>

      <div className="text-xs text-slate-500">{filtered.length} بلاغ</div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-2">📢</div>
          <p className="text-sm">لا توجد بلاغات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filtered.map((r, i) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelected(r)}
              className={`bg-white rounded-xl p-3 border shadow-sm hover:shadow-md transition-all cursor-pointer ${r.rabiesSuspect ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-100'}`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                  style={{ backgroundColor: CSVR_SPECIES_COLORS[r.species] + '15' }}
                >
                  {CSVR_SPECIES_ICONS[r.species]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400">{r.reference}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                      style={{ backgroundColor: CSVR_PRIORITY_COLORS[r.priority] + '15', color: CSVR_PRIORITY_COLORS[r.priority] }}
                    >
                      {CSVR_PRIORITY_LABELS[r.priority]}
                    </span>
                    {r.rabiesSuspect && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-100 text-red-700">🦠 اشتباه الكلب</span>}
                    {r.biteReported && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-100 text-orange-700">🦷 عضّة</span>}
                  </div>
                  <div className="text-sm text-slate-700 mt-1 line-clamp-1">{r.description || r.adresse || 'بدون وصف'}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span>📍 {r.quartier || r.adresse || '—'}</span>
                    <span>•</span>
                    <span>{r.estimatedCount} حيوان</span>
                    {r.commune && <><span>•</span><span style={{ color: COMMUNE_COLORS[r.commune] || '#64748b' }}>{COMMUNE_LABELS[r.commune] || r.commune}</span></>}
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: CSVR_REPORT_STATUS_COLORS[r.statut] + '15', color: CSVR_REPORT_STATUS_COLORS[r.statut] }}
                >
                  {CSVR_REPORT_STATUS_LABELS[r.statut]}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'تعديل البلاغ' : 'بلاغ جديد'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">المصدر</label>
                    <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                      {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_REPORT_SOURCE_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">النوع</label>
                    <select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                      {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_SPECIES_ICONS[s]} {CSVR_SPECIES_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">اسم المُبلِّغ</label>
                    <input value={form.declarantName} onChange={(e) => setForm({ ...form, declarantName: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الهاتف</label>
                    <input value={form.declarantPhone} onChange={(e) => setForm({ ...form, declarantPhone: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الحي</label>
                    <input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">القطاع</label>
                    <input value={form.secteur} onChange={(e) => setForm({ ...form, secteur: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">العنوان</label>
                  <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">العدد المقدر</label>
                    <input type="number" min="1" value={form.estimatedCount} onChange={(e) => setForm({ ...form, estimatedCount: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">خط العرض</label>
                    <input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">خط الطول</label>
                    <input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={captureGps} className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-bold hover:bg-blue-100">📡 تحديد موقعي تلقائياً</button>
                  {gpsState && <span className="text-xs text-slate-500">{gpsState}</span>}
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">الأولوية</label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITY_OPTIONS.map((p) => (
                      <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${form.priority === p ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-600'}`}
                        style={form.priority === p ? { backgroundColor: CSVR_PRIORITY_COLORS[p] } : {}}>
                        {CSVR_PRIORITY_LABELS[p]}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-2 block">الحالة والملامح</label>
                  <div className="flex flex-wrap gap-1.5">
                    {([['hasYoung', 'صغار'], ['isAggressive', 'عدواني'], ['isInjured', 'جريح'], ['isSick', 'مريض'], ['rabiesSuspect', 'اشتباه الكلب'], ['biteReported', 'حالة عض'], ['nearSchool', 'قرب مدرسة'], ['nearMarket', 'قرب سوق'], ['nearHealth', 'قرب مصحة'], ['nearDump', 'قرب مفرغة']] as const).map(([key, label]) => (
                      <button key={key} type="button" onClick={() => setForm({ ...form, [key]: !form[key] })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${form[key] ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-white text-slate-500 border-slate-200'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">الوصف</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none" />
                </div>

                <div>
                  <label className="text-xs text-slate-600 mb-1 block">ملاحظات</label>
                  <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none" />
                </div>

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50">إلغاء</button>
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 disabled:opacity-50">
                    {submitting ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail Panel */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono text-xs text-slate-400">{selected.reference}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-2xl">{CSVR_SPECIES_ICONS[selected.species]}</span>
                    <span className="text-lg font-bold text-slate-800">{CSVR_SPECIES_LABELS[selected.species]}</span>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: CSVR_PRIORITY_COLORS[selected.priority] + '15', color: CSVR_PRIORITY_COLORS[selected.priority] }}>
                  {CSVR_PRIORITY_LABELS[selected.priority]}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: CSVR_REPORT_STATUS_COLORS[selected.statut] + '15', color: CSVR_REPORT_STATUS_COLORS[selected.statut] }}>
                  {CSVR_REPORT_STATUS_LABELS[selected.statut]}
                </span>
                {selected.rabiesSuspect && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">🦠 اشتباه الكلب</span>}
              </div>

              <div className="space-y-2 text-sm">
                {selected.adresse && <div className="flex gap-2"><span className="text-slate-400 w-16">العنوان:</span><span className="text-slate-700">{selected.adresse}</span></div>}
                {selected.quartier && <div className="flex gap-2"><span className="text-slate-400 w-16">الحي:</span><span className="text-slate-700">{selected.quartier}</span></div>}
                <div className="flex gap-2"><span className="text-slate-400 w-16">العدد:</span><span className="text-slate-700">{selected.estimatedCount} حيوان</span></div>
                {selected.declarantName && <div className="flex gap-2"><span className="text-slate-400 w-16">المُبلِّغ:</span><span className="text-slate-700">{selected.declarantName} {selected.declarantPhone && `(${selected.declarantPhone})`}</span></div>}
                {selected.description && <div className="bg-slate-50 rounded-lg p-2.5 text-slate-700">{selected.description}</div>}
                {selected.observations && <div className="bg-amber-50 rounded-lg p-2.5 text-slate-700 text-xs">{selected.observations}</div>}
              </div>

              <div className="mt-4 space-y-2">
                <label className="text-xs text-slate-600 block">تغيير الحالة</label>
                <select value={selected.statut} onChange={(e) => { handleStatusChange(selected.id, e.target.value); setSelected({ ...selected, statut: e.target.value }) }} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_REPORT_STATUS_LABELS[s]}</option>)}
                </select>
              </div>

              <div className="flex gap-2 mt-4">
                {!selected.missionId && <button disabled={creatingMission} onClick={() => createMissionFromReport(selected)} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50">{creatingMission ? 'جارٍ الإنشاء...' : '🎯 إنشاء مهمة'}</button>}
                <button onClick={() => { openEdit(selected); setSelected(null) }} className="flex-1 px-4 py-2.5 rounded-xl bg-blue-500 text-white font-medium text-sm hover:bg-blue-600">تعديل</button>
                <button onClick={() => handleDelete(selected.id)} className="px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600">حذف</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
