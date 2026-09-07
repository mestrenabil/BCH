'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  SAMPLE_CONFORMITY_LABELS, SAMPLE_CONFORMITY_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { Sample } from './types'

interface Props {
  samples: Sample[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
}

function fmtDate(d: string) { return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

export default function SamplesTab({ samples, loading, onRefresh, buildParams }: Props) {
  const [filterConformity, setFilterConformity] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => samples.filter((s) => {
    if (filterConformity !== 'ALL' && s.conformity !== filterConformity) return false
    return true
  }), [samples, filterConformity])

  if (loading && samples.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <select value={filterConformity} onChange={(e) => setFilterConformity(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {Object.entries(SAMPLE_CONFORMITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700">➕ عينة جديدة</button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🧪</div>
          <p className="text-sm text-slate-500">{samples.length === 0 ? 'لا توجد عينات بعد' : 'لا توجد نتائج'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-right py-2 px-2">المرجع</th>
                <th className="text-right py-2 px-2">المنتج</th>
                <th className="text-right py-2 px-2">المنشأة</th>
                <th className="text-right py-2 px-2">التاريخ</th>
                <th className="text-right py-2 px-2">المخبر</th>
                <th className="text-right py-2 px-2">الحرارة</th>
                <th className="text-right py-2 px-2">المطابقة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const color = SAMPLE_CONFORMITY_COLORS[s.conformity] || '#64748b'
                return (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-xs">{s.reference}</td>
                    <td className="py-2 px-2 font-bold">{s.product}</td>
                    <td className="py-2 px-2 text-xs text-slate-600">{s.establishment?.name || '—'}</td>
                    <td className="py-2 px-2 text-xs">{fmtDate(s.sampleDate)}</td>
                    <td className="py-2 px-2 text-xs text-slate-600">{s.laboratory || '—'}</td>
                    <td className="py-2 px-2 text-xs">{s.temperature != null ? `${s.temperature}°C` : '—'}</td>
                    <td className="py-2 px-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: color + '15', color }}>{SAMPLE_CONFORMITY_LABELS[s.conformity] || s.conformity}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center"><span className="text-xs text-slate-400">عرض {filtered.length} من أصل {samples.length} عينة</span></div>

      <AnimatePresence>
        {showCreate && <CreateSampleModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh() }} buildParams={buildParams} />}
      </AnimatePresence>
    </div>
  )
}

function CreateSampleModal({ onClose, onCreated, buildParams }: { onClose: () => void; onCreated: () => void; buildParams: (extra?: Record<string, string>) => URLSearchParams }) {
  const accountCommune = buildParams().get('commune') || ''
  const [form, setForm] = useState({
    product: '', commune: '', reason: '', laboratory: '', requestedTests: '', temperature: '', collectorName: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product.trim()) { toast.error('يرجى تحديد المنتج'); return }
    setSaving(true)
    try {
      const params = buildParams()
      const commune = form.commune || accountCommune || params.get('commune') || 'ALL'
      const res = await fetch('/api/samples', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commune, temperature: form.temperature ? parseFloat(form.temperature) : null }),
      })
      if (!res.ok) { const err = await res.json().catch(() => null); toast.error(err?.error || 'فشل الإنشاء'); return }
      toast.success('تم إنشاء العينة — الحالة: بانتظار النتائج')
      onCreated()
    } catch { toast.error('حدث خطأ') } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300"

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="bg-gradient-to-l from-teal-600 to-cyan-700 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold">🧪 عينة جديدة</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div><label className="text-xs font-bold text-slate-600 block mb-1">المنتج المفحوص *</label><input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} placeholder="مثال: لحم مفروم، حليب..." className={inputCls} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={form.commune || accountCommune} onChange={(e) => setForm({ ...form, commune: e.target.value })} placeholder="كود الجماعة" className={inputCls} /></div>
            <div><label className="text-xs font-bold text-slate-600 block mb-1">الحرارة (°C)</label><input type="number" step="0.1" value={form.temperature} onChange={(e) => setForm({ ...form, temperature: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-slate-600 block mb-1">جامع العينة</label><input value={form.collectorName} onChange={(e) => setForm({ ...form, collectorName: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-bold text-slate-600 block mb-1">المخبر</label><input value={form.laboratory} onChange={(e) => setForm({ ...form, laboratory: e.target.value })} className={inputCls} /></div>
          </div>
          <div><label className="text-xs font-bold text-slate-600 block mb-1">سبب الأخذ</label><input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="مثال: شكاية، روتيني..." className={inputCls} /></div>
          <div><label className="text-xs font-bold text-slate-600 block mb-1">الاختبارات المطلوبة</label><input value={form.requestedTests} onChange={(e) => setForm({ ...form, requestedTests: e.target.value })} placeholder="مثال: E. coli، Coliformes..." className={inputCls} /></div>
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-2 text-[11px] text-teal-700">💡 الحالة تبدأ "بانتظار النتائج"، تُحدّث لاحقاً بعد ورود نتائج المخبر.</div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">إلغاء</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
