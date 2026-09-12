'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  FOOD_TYPE_LABELS, FOOD_TYPE_ICONS, FOOD_TYPE_COLORS,
  FOOD_REPORT_STATUS_LABELS, FOOD_REPORT_STATUS_COLORS,
  FOOD_PRIORITY_LABELS, FOOD_PRIORITY_COLORS,
  FOOD_ESTABLISHMENT_TYPES,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { FoodReport } from './types'
import LocationPicker from '../csvr/location-picker'

interface Props {
  reports: FoodReport[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
  mapAllowedCommunes: string[]
  externalFilter?: { type?: string; status?: string } | null
  onClearExternalFilter?: () => void
}

const STATUS_OPTIONS = ['NOUVEAU', 'VERIFICATION', 'VALIDE', 'EN_COURS', 'TRAITE', 'REJETE', 'CLASSE']
const TYPE_OPTIONS = ['RESTAURANT', 'EXPIRED_PRODUCT', 'STREET_VENDOR', 'PREMISES_HYGIENE']
const PRIORITY_OPTIONS = ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE']

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// تصدير CSV للبلاغات المُفلترة
function exportCSV(rows: FoodReport[]) {
  const headers = ['المرجع', 'النوع', 'المنشأة', 'نوع المنشأة', 'الجماعة', 'الحي', 'العنوان', 'الوصف', 'الأولوية', 'الحالة', 'المصدر', 'المبلّغ', 'الهاتف', 'الإحداثيات', 'الصور', 'التاريخ']
  const lines = [headers.join(',')]
  for (const r of rows) {
    const cells = [
      r.reference, FOOD_TYPE_LABELS[r.reportType] || r.reportType,
      r.establishmentName, r.establishmentType,
      COMMUNE_LABELS[r.commune] || r.commune, r.quartier, r.adresse,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      FOOD_PRIORITY_LABELS[r.priority] || r.priority,
      FOOD_REPORT_STATUS_LABELS[r.statut] || r.statut,
      r.source, r.declarantName, r.declarantPhone,
      r.latitude != null ? `${r.latitude},${r.longitude}` : '',
      r.photos?.length?.toString() || '0',
      new Date(r.createdAt).toISOString(),
    ]
    lines.push(cells.join(','))
  }
  const csv = '\uFEFF' + lines.join('\n') // BOM لـ Excel العربي
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `food-reports-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`تم تصدير ${rows.length} بلاغ`)
}

export default function ListTab({ reports, loading, onRefresh, buildParams, mapAllowedCommunes, externalFilter, onClearExternalFilter }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [filterPriority, setFilterPriority] = useState('ALL')
  const [selected, setSelected] = useState<FoodReport | null>(null)
  const [statusChange, setStatusChange] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  // دمج الفلتر الخارجي (من dashboard) مع الفلاتر المحلية
  useEffect(() => {
    const filterTimer = window.setTimeout(() => {
      if (externalFilter?.type) setFilterType(externalFilter.type)
      if (externalFilter?.status) setFilterStatus(externalFilter.status)
    }, 0)
    return () => window.clearTimeout(filterTimer)
  }, [externalFilter])

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (filterStatus !== 'ALL' && r.statut !== filterStatus) return false
      if (filterType !== 'ALL' && r.reportType !== filterType) return false
      if (filterPriority !== 'ALL' && r.priority !== filterPriority) return false
      if (search) {
        const q = search.toLowerCase()
        if (!r.reference.toLowerCase().includes(q) && !r.establishmentName.toLowerCase().includes(q) && !r.description.toLowerCase().includes(q) && !r.quartier.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [reports, filterStatus, filterType, filterPriority, search])

  const handleStatusChange = async (id: string, statut: string) => {
    try {
      const res = await fetch(`/api/food-reports/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }),
      })
      if (!res.ok) { toast.error('فشل التحديث'); return }
      toast.success('تم تحديث الحالة')
      setSelected(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا البلاغ؟')) return
    try {
      const res = await fetch(`/api/food-reports/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('فشل الحذف'); return }
      toast.success('تم الحذف')
      setSelected(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const hasActiveFilters = filterStatus !== 'ALL' || filterType !== 'ALL' || filterPriority !== 'ALL' || search

  return (
    <div className="space-y-3" dir="rtl">
      {/* شارة الفلتر الخارجي */}
      {externalFilter && (
        <div className="flex items-center justify-between bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
          <span className="text-xs font-bold text-rose-700">
            📊 فلتر من لوحة القيادة:
            {externalFilter.type && ` ${FOOD_TYPE_ICONS[externalFilter.type]} ${FOOD_TYPE_LABELS[externalFilter.type]}`}
            {externalFilter.status && ` · ${FOOD_REPORT_STATUS_LABELS[externalFilter.status]}`}
          </span>
          <button
            onClick={() => { setFilterType('ALL'); setFilterStatus('ALL'); onClearExternalFilter?.() }}
            className="text-xs font-bold text-rose-600 hover:text-rose-800"
          >✕ إزالة</button>
        </div>
      )}

      {/* فلاتر + أزرار */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (مرجع/منشأة/وصف/حي)..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{FOOD_TYPE_ICONS[t]} {FOOD_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{FOOD_REPORT_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأولويات</option>
          {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{FOOD_PRIORITY_LABELS[p]}</option>)}
        </select>
        <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
          className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
          📥 تصدير CSV
        </button>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-2 text-xs font-bold rounded-xl bg-rose-600 text-white hover:bg-rose-700">
          ➕ بلاغ جديد
        </button>
      </div>

      {/* القائمة */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🥗</div>
          <p className="text-sm text-slate-500">{hasActiveFilters ? 'لا توجد بلاغات مطابقة للفلاتر' : 'لا توجد بلاغات غذائية'}</p>
          {hasActiveFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterType('ALL'); setFilterPriority('ALL') }}
              className="mt-3 text-xs font-bold text-rose-600">إزالة كل الفلاتر</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => { setSelected(r); setStatusChange('') }}
              className={`bg-white rounded-2xl border p-4 text-right hover:shadow-md transition-all relative overflow-hidden ${
                (r.priority === 'URGENTE' || r.priority === 'SANITAIRE') ? 'border-red-300 hover:border-red-400' : 'border-slate-100 hover:border-rose-200'
              }`}
            >
              {/* شريط جانبي بلون الأولوية */}
              <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: FOOD_PRIORITY_COLORS[r.priority] || '#94a3b8' }} />
              <div className="flex items-start justify-between gap-2 pr-1">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{FOOD_TYPE_ICONS[r.reportType]}</span>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{r.reference}</div>
                    {r.establishmentName && <div className="text-xs text-slate-500 line-clamp-1">🏪 {r.establishmentName}</div>}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: (FOOD_REPORT_STATUS_COLORS[r.statut] || '#64748b') + '15', color: FOOD_REPORT_STATUS_COLORS[r.statut] }}>
                  {FOOD_REPORT_STATUS_LABELS[r.statut] || r.statut}
                </span>
              </div>
              <div className="text-xs text-slate-600 mt-2 line-clamp-2 pr-1">{r.description || r.adresse || 'بدون وصف'}</div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">
                {r.quartier && <span>📍 {r.quartier}</span>}
                <span style={{ color: COMMUNE_COLORS[r.commune] || '#64748b' }}>{COMMUNE_LABELS[r.commune] || r.commune}</span>
                <span>· {fmtDate(r.createdAt)}</span>
                {r.source === 'PUBLIC' && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">عمومي</span>}
                {r.photos && r.photos.length > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold">📸 {r.photos.length}</span>}
                {(r.priority === 'URGENTE' || r.priority === 'SANITAIRE') && (
                  <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold">⚠️ {FOOD_PRIORITY_LABELS[r.priority]}</span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <div className="text-center">
        <span className="text-xs text-slate-400">عرض {filtered.length} من أصل {reports.length} بلاغ</span>
      </div>

      {/* لوحة التفاصيل */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()} dir="rtl"
            >
              <div className="bg-gradient-to-l from-rose-600 to-red-600 px-5 py-4 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2">{FOOD_TYPE_ICONS[selected.reportType]} {selected.reference}</h3>
                    <p className="text-rose-100 text-xs mt-0.5">{FOOD_TYPE_LABELS[selected.reportType]}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
                </div>
              </div>

              <div className="p-5 space-y-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-1 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: (FOOD_REPORT_STATUS_COLORS[selected.statut] || '#64748b') + '20', color: FOOD_REPORT_STATUS_COLORS[selected.statut] }}>
                    {FOOD_REPORT_STATUS_LABELS[selected.statut]}
                  </span>
                  <span className="px-2 py-1 rounded-lg text-xs font-bold"
                    style={{ backgroundColor: (FOOD_PRIORITY_COLORS[selected.priority] || '#64748b') + '20', color: FOOD_PRIORITY_COLORS[selected.priority] }}>
                    ⚠️ أولوية {FOOD_PRIORITY_LABELS[selected.priority] || selected.priority}
                  </span>
                  <span className="px-2 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600">
                    {selected.source === 'PUBLIC' ? '🌐 عمومي' : '🏢 داخلي'}
                  </span>
                </div>

                {selected.establishmentName && (
                  <div><span className="text-slate-500">المنشأة:</span> <span className="font-bold">🏪 {selected.establishmentName}{selected.establishmentType ? ` (${selected.establishmentType})` : ''}</span></div>
                )}
                <div><span className="text-slate-500">الجماعة:</span> <span className="font-bold" style={{ color: COMMUNE_COLORS[selected.commune] || '#64748b' }}>{COMMUNE_LABELS[selected.commune] || selected.commune}</span></div>
                {selected.quartier && <div><span className="text-slate-500">الحي:</span> {selected.quartier}</div>}
                {selected.adresse && <div><span className="text-slate-500">العنوان:</span> {selected.adresse}</div>}
                {selected.latitude != null && (
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">الإحداثيات:</span>
                    <a href={`https://www.openstreetmap.org/?mlat=${selected.latitude}&mlon=${selected.longitude}#map=18/${selected.latitude}/${selected.longitude}`}
                      target="_blank" rel="noreferrer"
                      className="text-rose-600 hover:underline font-mono text-xs" dir="ltr">
                      {selected.latitude.toFixed(5)}, {selected.longitude?.toFixed(5)} ↗
                    </a>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-slate-500 block mb-1">الوصف:</span>
                  <p className="text-slate-700">{selected.description || '—'}</p>
                </div>
                {selected.observations && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-500 block mb-1">ملاحظات المسؤول:</span>
                    <p className="text-slate-700 italic">{selected.observations}</p>
                  </div>
                )}
                {selected.declarantName && <div><span className="text-slate-500">المبلّغ:</span> {selected.declarantName}{selected.declarantPhone ? ` · ${selected.declarantPhone}` : ''}</div>}
                {selected.photos && selected.photos.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <span className="text-slate-500 block mb-2">الصور ({selected.photos.length}):</span>
                    <div className="grid grid-cols-3 gap-2">
                      {selected.photos.map((p) => (
                        <a key={p.id} href={`/api/public/food-photos/${p.id}`} target="_blank" rel="noreferrer">
                          <img src={`/api/public/food-photos/${p.id}`} alt={p.originalName} className="w-full h-20 object-cover rounded-lg border border-slate-200 hover:opacity-80" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* تغيير الحالة */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-500 block mb-2">تغيير الحالة:</label>
                  <div className="flex gap-2">
                    <select value={statusChange} onChange={(e) => setStatusChange(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                      <option value="">— اختر الحالة —</option>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{FOOD_REPORT_STATUS_LABELS[s]}</option>)}
                    </select>
                    <button disabled={!statusChange || statusChange === selected.statut}
                      onClick={() => handleStatusChange(selected.id, statusChange)}
                      className="px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg disabled:opacity-50">
                      تطبيق
                    </button>
                  </div>
                  {/* أزرار سريعة للحالات الشائعة */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <button onClick={() => handleStatusChange(selected.id, 'VALIDE')}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg" style={{ backgroundColor: FOOD_REPORT_STATUS_COLORS['VALIDE'] + '20', color: FOOD_REPORT_STATUS_COLORS['VALIDE'] }}>
                      ✅ مصادقة
                    </button>
                    <button onClick={() => handleStatusChange(selected.id, 'EN_COURS')}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg" style={{ backgroundColor: FOOD_REPORT_STATUS_COLORS['EN_COURS'] + '20', color: FOOD_REPORT_STATUS_COLORS['EN_COURS'] }}>
                      🔄 قيد المعالجة
                    </button>
                    <button onClick={() => handleStatusChange(selected.id, 'TRAITE')}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg" style={{ backgroundColor: FOOD_REPORT_STATUS_COLORS['TRAITE'] + '20', color: FOOD_REPORT_STATUS_COLORS['TRAITE'] }}>
                      ✓ تمت المعالجة
                    </button>
                    <button onClick={() => handleStatusChange(selected.id, 'REJETE')}
                      className="px-2.5 py-1 text-[11px] font-bold rounded-lg" style={{ backgroundColor: FOOD_REPORT_STATUS_COLORS['REJETE'] + '20', color: FOOD_REPORT_STATUS_COLORS['REJETE'] }}>
                      ✕ رفض
                    </button>
                  </div>
                </div>

                <button onClick={() => handleDelete(selected.id)} className="w-full mt-2 px-4 py-2 text-sm font-bold text-red-600 border border-red-200 rounded-lg hover:bg-red-50">
                  🗑️ حذف البلاغ
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* نموذج إنشاء بلاغ داخلي */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreated={() => { setShowCreate(false); onRefresh() }}
            buildParams={buildParams}
            mapAllowedCommunes={mapAllowedCommunes}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== نموذج إنشاء بلاغ داخلي =====
function CreateModal({ onClose, onCreated, buildParams, mapAllowedCommunes }: {
  onClose: () => void
  onCreated: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
  mapAllowedCommunes: string[]
}) {
  const accountCommune = buildParams().get('commune') || ''
  const [form, setForm] = useState({
    reportType: 'RESTAURANT',
    establishmentName: '',
    establishmentType: '',
    description: '',
    priority: 'NORMALE',
    quartier: '',
    adresse: '',
    commune: '',
    latitude: '',
    longitude: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.description && !form.establishmentName) {
      toast.error('يرجى تقديم وصف أو اسم المنشأة')
      return
    }
    setSaving(true)
    try {
      const params = buildParams()
      // إذا لم تُحدد جماعة عبر الفلتر، استخدم ALL أو خذ من params
      const commune = form.commune || accountCommune || params.get('commune') || 'ALL'
      const res = await fetch('/api/food-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commune, latitude: form.latitude || null, longitude: form.longitude || null }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'فشل إنشاء البلاغ')
        return
      }
      const created = await res.json()
      toast.success(`تم إنشاء البلاغ ${created.reference}`)
      onCreated()
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.form
        onSubmit={handleSubmit}
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()} dir="rtl"
      >
        <div className="bg-gradient-to-l from-rose-600 to-red-600 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold">➕ بلاغ غذائي جديد</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>

        <div className="p-5 space-y-3">
          {/* نوع البلاغ */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-2">نوع المخالفة *</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t} type="button"
                  onClick={() => setForm({ ...form, reportType: t })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-bold transition ${
                    form.reportType === t ? 'border-transparent text-white' : 'border-slate-200 text-slate-600 hover:border-rose-200'
                  }`}
                  style={form.reportType === t ? { background: FOOD_TYPE_COLORS[t] } : {}}
                >
                  <span className="text-base">{FOOD_TYPE_ICONS[t]}</span>
                  {FOOD_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* اسم المنشأة */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">اسم المنشأة</label>
            <input value={form.establishmentName} onChange={(e) => setForm({ ...form, establishmentName: e.target.value })}
              placeholder="مثال: مطعم الأمل"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>

          {/* نوع المنشأة */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">نوع المنشأة</label>
            <select value={form.establishmentType} onChange={(e) => setForm({ ...form, establishmentType: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
              <option value="">— اختر —</option>
              {FOOD_ESTABLISHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* الجماعة */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label>
            <input value={form.commune || accountCommune} onChange={(e) => setForm({ ...form, commune: e.target.value })}
              placeholder="كود الجماعة (مثال: sla)"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">الحي</label>
              <input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">العنوان</label>
              <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300" />
            </div>
          </div>

          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><p className="text-xs font-bold text-slate-700">📍 تحديد الجماعة والحي من الخريطة</p><p className="mt-0.5 text-[10px] text-slate-500">اختيار النقطة يملأ الجماعة والحي والإحداثيات تلقائياً.</p></div>
              <LocationPicker latitude={form.latitude} longitude={form.longitude} allowedCommunes={mapAllowedCommunes} label="تحديد الموقع" title="موقع البلاغ الغذائي" onSelect={({ latitude, longitude, commune, quartier }) => setForm({ ...form, commune, quartier: quartier || form.quartier, latitude: String(latitude), longitude: String(longitude) })} />
            </div>
          </div>

          {/* الوصف */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">الوصف *</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="تفاصيل المخالفة..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-300 resize-none" />
          </div>

          {/* الأولوية */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-2">درجة الأولوية</label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p} type="button"
                  onClick={() => setForm({ ...form, priority: p })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition ${
                    form.priority === p ? 'text-white border-transparent' : 'bg-white border-slate-200 text-slate-500'
                  }`}
                  style={form.priority === p ? { background: FOOD_PRIORITY_COLORS[p] } : {}}
                >
                  {FOOD_PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
              إلغاء
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg hover:bg-rose-700 disabled:opacity-50">
              {saving ? 'جارٍ الإنشاء...' : 'إنشاء البلاغ'}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
