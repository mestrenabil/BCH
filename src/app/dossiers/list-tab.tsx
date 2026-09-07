'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  OFFICES,
  DOSSIER_STATUS_LABELS, DOSSIER_STATUS_COLORS, DOSSIER_STATUS_FLOW,
  DOSSIER_TYPE_LABELS, DOSSIER_TYPE_ICONS,
  FOOD_PRIORITY_LABELS, FOOD_PRIORITY_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { Dossier } from './types'

interface Props {
  dossiers: Dossier[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
  onOpenDetail: (d: Dossier) => void
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// تصدير CSV
function exportCSV(rows: Dossier[]) {
  const headers = ['المرجع', 'العنوان', 'المكتب', 'النوع', 'الحالة', 'الأولوية', 'الجماعة', 'الحي', 'المكلف', 'المهلة', 'المنشئ', 'تاريخ الإنشاء']
  const lines = [headers.join(',')]
  for (const d of rows) {
    const cells = [
      d.reference,
      `"${(d.title || '').replace(/"/g, '""')}"`,
      OFFICES[d.office]?.nameAr || d.office || '',
      DOSSIER_TYPE_LABELS[d.type] || d.type,
      DOSSIER_STATUS_LABELS[d.status] || d.status,
      FOOD_PRIORITY_LABELS[d.priority] || d.priority,
      COMMUNE_LABELS[d.commune] || d.commune,
      d.quartier,
      d.assignedToName || '—',
      d.dueDate ? new Date(d.dueDate).toISOString() : '',
      d.createdByName || '—',
      new Date(d.createdAt).toISOString(),
    ]
    lines.push(cells.join(','))
  }
  const csv = '\uFEFF' + lines.join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `dossiers-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
  toast.success(`تم تصدير ${rows.length} ملف`)
}

export default function ListTab({ dossiers, loading, onRefresh, buildParams, onOpenDetail }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterOffice, setFilterOffice] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    return dossiers.filter((d) => {
      if (filterStatus !== 'ALL' && d.status !== filterStatus) return false
      if (filterOffice !== 'ALL' && d.office !== filterOffice) return false
      if (filterType !== 'ALL' && d.type !== filterType) return false
      if (search) {
        const q = search.toLowerCase()
        if (!d.reference.toLowerCase().includes(q) && !d.title.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q) && !d.quartier.toLowerCase().includes(q) && !d.assignedToName.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [dossiers, filterStatus, filterOffice, filterType, search])

  if (loading) {
    return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  const hasFilters = filterStatus !== 'ALL' || filterOffice !== 'ALL' || filterType !== 'ALL' || search

  return (
    <div className="space-y-3" dir="rtl">
      {/* فلاتر */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (مرجع/عنوان/وصف/حي/مكلف)..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
        <select value={filterOffice} onChange={(e) => setFilterOffice(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل المكاتب</option>
          {Object.entries(OFFICES).map(([code, o]) => <option key={code} value={code}>{o.icon} {o.nameAr}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {Object.entries(DOSSIER_TYPE_LABELS).map(([t, label]) => <option key={t} value={t}>{DOSSIER_TYPE_ICONS[t]} {label}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {DOSSIER_STATUS_FLOW.map((s) => <option key={s} value={s}>{DOSSIER_STATUS_LABELS[s]}</option>)}
        </select>
        <button onClick={() => exportCSV(filtered)} disabled={filtered.length === 0}
          className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
          📥 تصدير
        </button>
        <button onClick={() => setShowCreate(true)}
          className="px-3 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700">
          ➕ ملف جديد
        </button>
      </div>

      {/* القائمة */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🗂️</div>
          <p className="text-sm text-slate-500">{hasFilters ? 'لا توجد ملفات مطابقة' : 'لا توجد ملفات بعد — أنشئ أول ملف'}</p>
          {hasFilters && (
            <button onClick={() => { setSearch(''); setFilterStatus('ALL'); setFilterOffice('ALL'); setFilterType('ALL') }}
              className="mt-3 text-xs font-bold text-indigo-600">إزالة كل الفلاتر</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((d, i) => {
            const isUrgent = d.priority === 'URGENTE' || d.priority === 'SANITAIRE'
            const dueIn = daysUntil(d.dueDate)
            const isOverdue = dueIn !== null && dueIn < 0 && d.status !== 'CLOSED' && d.status !== 'ARCHIVED'
            const office = OFFICES[d.office]
            return (
              <motion.button
                key={d.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => onOpenDetail(d)}
                className={`bg-white rounded-2xl border p-4 text-right hover:shadow-md transition-all relative overflow-hidden ${
                  isUrgent ? 'border-red-300 hover:border-red-400' : 'border-slate-100 hover:border-indigo-200'
                }`}
              >
                <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: FOOD_PRIORITY_COLORS[d.priority] || '#94a3b8' }} />
                <div className="flex items-start justify-between gap-2 pr-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl shrink-0">{DOSSIER_TYPE_ICONS[d.type] || '📁'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-800 truncate">{d.reference}</div>
                      <div className="text-xs text-slate-600 line-clamp-1">{d.title || d.description?.slice(0, 50) || 'بدون عنوان'}</div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0"
                    style={{ backgroundColor: (DOSSIER_STATUS_COLORS[d.status] || '#64748b') + '15', color: DOSSIER_STATUS_COLORS[d.status] }}>
                    {DOSSIER_STATUS_LABELS[d.status] || d.status}
                  </span>
                </div>
                {d.description && (
                  <div className="text-xs text-slate-500 mt-2 line-clamp-2 pr-1">{d.description}</div>
                )}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">
                  {office && <span>{office.icon} {office.nameAr}</span>}
                  {d.quartier && <span>📍 {d.quartier}</span>}
                  <span style={{ color: COMMUNE_COLORS[d.commune] || '#64748b' }}>{COMMUNE_LABELS[d.commune] || d.commune}</span>
                  <span>· {fmtDate(d.createdAt)}</span>
                  {d.assignedToName && <span className="px-1.5 py-0.5 rounded bg-violet-50 text-violet-600 font-bold">👤 {d.assignedToName}</span>}
                  {isUrgent && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold">⚠️ {FOOD_PRIORITY_LABELS[d.priority]}</span>}
                  {isOverdue && <span className="px-1.5 py-0.5 rounded bg-orange-50 text-orange-600 font-bold">⏰ متأخر</span>}
                  {dueIn !== null && dueIn >= 0 && d.status !== 'CLOSED' && d.status !== 'ARCHIVED' && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold">📅 {dueIn} يوم</span>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      <div className="text-center">
        <span className="text-xs text-slate-400">عرض {filtered.length} من أصل {dossiers.length} ملف</span>
      </div>

      {/* نموذج إنشاء */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onCreated={(d) => { setShowCreate(false); onRefresh(); onOpenDetail(d) }}
            buildParams={buildParams}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== نموذج إنشاء ملف جديد =====
function CreateModal({ onClose, onCreated, buildParams }: {
  onClose: () => void
  onCreated: (d: Dossier) => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
}) {
  const accountCommune = buildParams().get('commune') || ''
  const [form, setForm] = useState({
    office: 'OFFICE_04',
    type: 'OTHER',
    title: '',
    description: '',
    priority: 'NORMALE',
    quartier: '',
    adresse: '',
    commune: '',
    assignedToName: '',
    dueDate: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() && !form.description.trim()) {
      toast.error('يرجى تقديم عنوان أو وصف')
      return
    }
    setSaving(true)
    try {
      const params = buildParams()
      const commune = form.commune || accountCommune || params.get('commune') || 'ALL'
      const res = await fetch('/api/dossiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          commune,
          assignedTo: form.assignedToName ? 'manual' : '',  // لا userId حقيقي هنا — فقط اسم
          dueDate: form.dueDate || null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error(err?.error || 'فشل إنشاء الملف')
        return
      }
      const created = await res.json()
      toast.success(`تم إنشاء الملف ${created.reference}`)
      onCreated(created)
    } catch {
      toast.error('حدث خطأ')
    } finally {
      setSaving(false)
    }
  }

  const PRIORITY_OPTIONS = ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE']

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
        <div className="bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold">🗂️ ملف جديد</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>

        <div className="p-5 space-y-3">
          {/* المكتب */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">المكتب المختص</label>
            <select value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
              {Object.entries(OFFICES).map(([code, o]) => <option key={code} value={code}>{o.icon} {o.nameAr}</option>)}
            </select>
          </div>

          {/* النوع */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">نوع الملف</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
              {Object.entries(DOSSIER_TYPE_LABELS).map(([t, label]) => <option key={t} value={t}>{DOSSIER_TYPE_ICONS[t]} {label}</option>)}
            </select>
          </div>

          {/* العنوان */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">العنوان *</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان مختصر للملف"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>

          {/* الوصف */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">الوصف</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3} placeholder="تفاصيل الملف..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none" />
          </div>

          {/* الجماعة + الحي + العنوان */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label>
              <input value={form.commune || accountCommune} onChange={(e) => setForm({ ...form, commune: e.target.value })}
                placeholder="كود الجماعة (مثال: sla)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">الحي</label>
              <input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {/* المكلف + المهلة */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">المكلف</label>
              <input value={form.assignedToName} onChange={(e) => setForm({ ...form, assignedToName: e.target.value })}
                placeholder="اسم المكلف (اختياري)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">المهلة (SLA)</label>
              <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
          </div>

          {/* الأولوية */}
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-2">الأولوية</label>
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
              className="flex-1 px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saving ? 'جارٍ الإنشاء...' : 'إنشاء الملف'}
            </button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
