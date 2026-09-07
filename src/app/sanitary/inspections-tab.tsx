'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  INSPECTION_TYPE_LABELS, INSPECTION_TYPE_ICONS,
  INSPECTION_RESULT_LABELS, INSPECTION_RESULT_COLORS,
  INSPECTION_CATEGORIES,
  FINDING_SEVERITY_LABELS, FINDING_SEVERITY_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { Establishment, Inspection } from './types'

interface Props {
  inspections: Inspection[]
  establishments: Establishment[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

interface NewFinding { category: string; description: string; severity: string }

export default function InspectionsTab({ inspections, establishments, loading, onRefresh }: Props) {
  const [filterType, setFilterType] = useState('ALL')
  const [filterResult, setFilterResult] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    return inspections.filter((i) => {
      if (filterType !== 'ALL' && i.type !== filterType) return false
      if (filterResult !== 'ALL' && i.overallResult !== filterResult) return false
      return true
    })
  }, [inspections, filterType, filterResult])

  if (loading && inspections.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {Object.entries(INSPECTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{INSPECTION_TYPE_ICONS[k]} {v}</option>)}
        </select>
        <select value={filterResult} onChange={(e) => setFilterResult(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل النتائج</option>
          {Object.entries(INSPECTION_RESULT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} disabled={establishments.length === 0}
          className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40">
          ➕ تفتيش جديد
        </button>
        {establishments.length === 0 && <span className="text-[10px] text-slate-400">أضف منشأة أولاً</span>}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🔍</div>
          <p className="text-sm text-slate-500">{inspections.length === 0 ? 'لا توجد تفتيشات بعد' : 'لا توجد نتائج مطابقة'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((insp, i) => {
            const resultColor = INSPECTION_RESULT_COLORS[insp.overallResult] || '#64748b'
            return (
              <motion.div key={insp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: resultColor }} />
                <div className="flex items-start justify-between gap-2 pr-1">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{INSPECTION_TYPE_ICONS[insp.type]} {insp.reference}</div>
                    <div className="text-xs text-slate-600 line-clamp-1">{insp.establishment?.name || '—'}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: resultColor + '15', color: resultColor }}>
                    {INSPECTION_RESULT_LABELS[insp.overallResult] || insp.overallResult}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">
                  <span>{INSPECTION_TYPE_LABELS[insp.type] || insp.type}</span>
                  <span>· {fmtDate(insp.inspectionDate)}</span>
                  {insp.inspectorName && <span>👤 {insp.inspectorName}</span>}
                  {insp._count && insp._count.findings > 0 && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold">⚠️ {insp._count.findings} نقص</span>}
                </div>
                {/* شريط درجة المخاطر */}
                <div className="mt-2 pr-1 flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 shrink-0">المخاطر:</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${insp.riskScore}%`, background: resultColor }} />
                  </div>
                  <span className="text-[10px] font-bold shrink-0" style={{ color: resultColor }}>{insp.riskScore}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <div className="text-center"><span className="text-xs text-slate-400">عرض {filtered.length} من أصل {inspections.length} تفتيش</span></div>

      <AnimatePresence>
        {showCreate && <CreateInspectionModal establishments={establishments} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh() }} />}
      </AnimatePresence>
    </div>
  )
}

function CreateInspectionModal({ establishments, onClose, onCreated }: { establishments: Establishment[]; onClose: () => void; onCreated: () => void }) {
  const [establishmentId, setEstablishmentId] = useState('')
  const [type, setType] = useState('PERIODIC')
  const [inspectorName, setInspectorName] = useState('')
  const [notes, setNotes] = useState('')
  const [findings, setFindings] = useState<NewFinding[]>([])
  const [newFinding, setNewFinding] = useState<NewFinding>({ category: '', description: '', severity: 'MINOR' })
  const [saving, setSaving] = useState(false)

  const addFinding = () => {
    if (!newFinding.description.trim()) { toast.error('أضف وصف النقص'); return }
    setFindings([...findings, newFinding])
    setNewFinding({ category: '', description: '', severity: 'MINOR' })
  }

  const removeFinding = (idx: number) => setFindings(findings.filter((_, i) => i !== idx))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!establishmentId) { toast.error('اختر منشأة'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/inspections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ establishmentId, type, inspectorName, notes, findings }),
      })
      if (!res.ok) { const err = await res.json().catch(() => null); toast.error(err?.error || 'فشل الإنشاء'); return }
      toast.success(`تم إنشاء التفتيش بدرجة مخاطر محسوبة`)
      onCreated()
    } catch { toast.error('حدث خطأ') } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="bg-gradient-to-l from-teal-600 to-cyan-700 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold">🔍 تفتيش جديد</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">المنشأة *</label>
            <select value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
              <option value="">— اختر منشأة —</option>
              {establishments.map((est) => <option key={est.id} value={est.id}>{est.name} ({est.reference})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">نوع التفتيش</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                {Object.entries(INSPECTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{INSPECTION_TYPE_ICONS[k]} {v}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">المفتّش</label>
              <input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder="اسم المفتّش"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
          </div>

          {/* النقائص */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-600 block mb-2">النقائص المكتشفة</label>
            {findings.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {findings.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0" style={{ backgroundColor: FINDING_SEVERITY_COLORS[f.severity] + '20', color: FINDING_SEVERITY_COLORS[f.severity] }}>
                      {FINDING_SEVERITY_LABELS[f.severity]}
                    </span>
                    <span className="text-xs text-slate-700 flex-1 truncate">{f.description}</span>
                    <button type="button" onClick={() => removeFinding(idx)} className="text-red-500 text-xs">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <select value={newFinding.category} onChange={(e) => setNewFinding({ ...newFinding, category: e.target.value })}
                  className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white">
                  <option value="">— الفئة —</option>
                  {INSPECTION_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
                </select>
                <select value={newFinding.severity} onChange={(e) => setNewFinding({ ...newFinding, severity: e.target.value })}
                  className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white">
                  {Object.entries(FINDING_SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="flex gap-1.5">
                <input value={newFinding.description} onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                  placeholder="وصف النقص..." onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addFinding() } }}
                  className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
                <button type="button" onClick={addFinding} className="px-3 py-1.5 text-xs font-bold text-teal-600 border border-teal-200 rounded-lg hover:bg-teal-50">➕</button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">ملاحظات</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300 resize-none" />
          </div>

          <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-[11px] text-teal-700">
            💡 سيتم حساب درجة المخاطر (0-100) تلقائياً من النقائص، وتُحدّث فئة مخاطر المنشأة.
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">إلغاء</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">{saving ? '...' : 'إنشاء التفتيش'}</button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
