'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  HEALTH_CARD_STATUS_LABELS, HEALTH_CARD_STATUS_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { Establishment, HealthCard } from './types'

interface Props {
  healthCards: HealthCard[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
}

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function daysUntil(d: string | null): number | null { if (!d) return null; return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) }

export default function HealthCardsTab({ healthCards, loading, onRefresh, buildParams }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => healthCards.filter((h) => {
    if (filterStatus !== 'ALL' && h.status !== filterStatus) return false
    if (search) {
      const q = search.toLowerCase()
      if (!h.reference.toLowerCase().includes(q) && !h.workerName.toLowerCase().includes(q) && !h.cardNumber.toLowerCase().includes(q) && !h.occupation.toLowerCase().includes(q)) return false
    }
    return true
  }), [healthCards, filterStatus, search])

  if (loading && healthCards.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (عامل/مرجع/رقم بطاقة)..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {Object.entries(HEALTH_CARD_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700">➕ بطاقة جديدة</button>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🩺</div>
          <p className="text-sm text-slate-500">{healthCards.length === 0 ? 'لا توجد بطاقات صحية بعد' : 'لا توجد نتائج'}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-100">
                <th className="text-right py-2 px-2">المرجع</th>
                <th className="text-right py-2 px-2">العامل</th>
                <th className="text-right py-2 px-2">المهنة</th>
                <th className="text-right py-2 px-2">المنشأة</th>
                <th className="text-right py-2 px-2">رقم البطاقة</th>
                <th className="text-right py-2 px-2">الانتهاء</th>
                <th className="text-right py-2 px-2">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const dueIn = daysUntil(h.expiryDate)
                const isExpiring = dueIn !== null && dueIn <= 30 && h.status !== 'EXPIRED'
                const color = HEALTH_CARD_STATUS_COLORS[h.status] || '#64748b'
                return (
                  <tr key={h.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-xs">{h.reference}</td>
                    <td className="py-2 px-2 font-bold">{h.workerName}</td>
                    <td className="py-2 px-2 text-xs text-slate-600">{h.occupation || '—'}</td>
                    <td className="py-2 px-2 text-xs text-slate-600">{h.establishment?.name || '—'}</td>
                    <td className="py-2 px-2 text-xs font-mono">{h.cardNumber || '—'}</td>
                    <td className="py-2 px-2 text-xs">
                      <span className={isExpiring ? 'text-amber-600 font-bold' : ''}>{fmtDate(h.expiryDate)}</span>
                      {isExpiring && <span className="block text-[10px] text-amber-500">باقٍ {dueIn} يوم</span>}
                    </td>
                    <td className="py-2 px-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: color + '15', color }}>{HEALTH_CARD_STATUS_LABELS[h.status] || h.status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center"><span className="text-xs text-slate-400">عرض {filtered.length} من أصل {healthCards.length} بطاقة</span></div>

      <AnimatePresence>
        {showCreate && <CreateHealthCardModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh() }} buildParams={buildParams} />}
      </AnimatePresence>
    </div>
  )
}

function CreateHealthCardModal({ onClose, onCreated, buildParams }: { onClose: () => void; onCreated: () => void; buildParams: (extra?: Record<string, string>) => URLSearchParams }) {
  const accountCommune = buildParams().get('commune') || ''
  const [form, setForm] = useState({
    workerName: '', workerCin: '', occupation: '', commune: '', cardNumber: '', issueDate: '', expiryDate: '', examinationDate: '', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.workerName.trim()) { toast.error('يرجى تقديم اسم العامل'); return }
    setSaving(true)
    try {
      const params = buildParams()
      const commune = form.commune || accountCommune || params.get('commune') || 'ALL'
      const res = await fetch('/api/health-cards', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commune, issueDate: form.issueDate || null, expiryDate: form.expiryDate || null, examinationDate: form.examinationDate || null }),
      })
      if (!res.ok) { const err = await res.json().catch(() => null); toast.error(err?.error || 'فشل الإنشاء'); return }
      toast.success('تم إنشاء البطاقة الصحية')
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
          <h3 className="text-lg font-bold">🩺 بطاقة صحية جديدة</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-slate-600 block mb-1">اسم العامل *</label><input value={form.workerName} onChange={(e) => setForm({ ...form, workerName: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-bold text-slate-600 block mb-1">البطاقة الوطنية</label><input value={form.workerCin} onChange={(e) => setForm({ ...form, workerCin: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs font-bold text-slate-600 block mb-1">المهنة</label><input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={form.commune || accountCommune} onChange={(e) => setForm({ ...form, commune: e.target.value })} placeholder="كود الجماعة" className={inputCls} /></div>
          </div>
          <div><label className="text-xs font-bold text-slate-600 block mb-1">رقم البطاقة الصحية</label><input value={form.cardNumber} onChange={(e) => setForm({ ...form, cardNumber: e.target.value })} className={inputCls} /></div>
          <div className="grid grid-cols-3 gap-2">
            <div><label className="text-xs font-bold text-slate-600 block mb-1">إصدار</label><input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-bold text-slate-600 block mb-1">فحص</label><input type="date" value={form.examinationDate} onChange={(e) => setForm({ ...form, examinationDate: e.target.value })} className={inputCls} /></div>
            <div><label className="text-xs font-bold text-slate-600 block mb-1">انتهاء</label><input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputCls} /></div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">💡 يتم تحديد الحالة تلقائياً (سارية/منتهية) من تاريخ الانتهاء، مع تنبيهات قبل 30 يوماً.</div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">إلغاء</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
