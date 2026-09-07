'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import {
  CSVR_MISSION_STATUS_COLORS, CSVR_MISSION_STATUS_LABELS,
  CSVR_PRIORITY_COLORS, CSVR_PRIORITY_LABELS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { CaptureMission } from './types'

interface Props {
  missions: CaptureMission[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
}

const STATUS_OPTIONS = ['PLANIFIEE', 'CONFIRME', 'EN_ROUTE', 'SUR_PLACE', 'CAPTURE_EN_COURS', 'TERMINEE', 'PARTIEL', 'REPORTEE', 'ANNULEE']
const PRIORITY_OPTIONS = ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE']

const emptyForm = {
  quartier: '', zone: '', scheduledAt: '',
  priority: 'NORMALE', teamLead: '', driver: '', agents: '',
  veterinarian: '', vehicle: '', equipment: '',
  cagesAvailable: '4', estimatedAnimals: '2',
  safetyNotes: '', preNotes: '',
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function MissionsTab({ missions, loading, onRefresh, buildParams }: Props) {
  const { user } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<CaptureMission | null>(null)

  const managedCommunes = user?.managedCommunes?.length ? user.managedCommunes : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])

  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (filterStatus !== 'ALL' && m.statut !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        if (!m.reference.toLowerCase().includes(q) && !m.teamLead.toLowerCase().includes(q) && !m.quartier.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [missions, filterStatus, search])

  const openCreate = () => { setForm(emptyForm); setEditingId(null); setShowForm(true) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const params = buildParams()
      const commune = params.get('commune') || managedCommunes[0] || ''
      const body: Record<string, unknown> = {
        ...form,
        commune,
        cagesAvailable: parseInt(form.cagesAvailable) || 0,
        estimatedAnimals: parseInt(form.estimatedAnimals) || 0,
      }
      if (form.scheduledAt) body.scheduledAt = new Date(form.scheduledAt).toISOString()

      const res = await fetch(editingId ? `/api/csvr/missions/${editingId}` : '/api/csvr/missions', {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || 'فشل الحفظ'); return }
      toast.success(editingId ? 'تم تحديث المهمة' : 'تم إنشاء المهمة')
      setShowForm(false)
      onRefresh()
    } catch { toast.error('حدث خطأ') } finally { setSubmitting(false) }
  }

  const handleStatusChange = async (id: string, statut: string) => {
    try {
      const res = await fetch(`/api/csvr/missions/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ statut }) })
      if (!res.ok) { toast.error('فشل التحديث'); return }
      toast.success('تم تحديث الحالة')
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه المهمة؟')) return
    try {
      const res = await fetch(`/api/csvr/missions/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('فشل الحذف'); return }
      toast.success('تم الحذف')
      setSelected(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl">🎯</span>
        <div><h2 className="text-base font-extrabold text-slate-800">المهمات</h2><p className="mt-0.5 text-[11px] text-slate-500">تخطيط مهمات الاصطياد ومتابعة تنفيذها</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-300" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_MISSION_STATUS_LABELS[s]}</option>)}
        </select>
        <button onClick={openCreate} className="px-4 py-2 text-sm font-semibold text-white bg-purple-500 hover:bg-purple-600 rounded-xl shadow-sm whitespace-nowrap">
          + مهمة جديدة
        </button>
      </div>

      <div className="text-xs text-slate-500">{filtered.length} مهمة</div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400"><div className="text-4xl mb-2">🎯</div><p className="text-sm">لا توجد مهام</p></div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5">
          {filtered.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
              onClick={() => setSelected(m)}
              className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-lg shrink-0">🎯</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-400">{m.reference}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: CSVR_PRIORITY_COLORS[m.priority] + '15', color: CSVR_PRIORITY_COLORS[m.priority] }}>
                      {CSVR_PRIORITY_LABELS[m.priority]}
                    </span>
                  </div>
                  <div className="text-sm text-slate-700 mt-0.5">{m.quartier || m.zone || 'منطقة غير محددة'}</div>
                  <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-400">
                    <span>👤 {m.teamLead || '—'}</span>
                    {m._count && <><span>•</span><span>📢 {m._count.reports} بلاغ</span><span>🐾 {m._count.animals} حيوان</span></>}
                    {m.commune && <><span>•</span><span style={{ color: COMMUNE_COLORS[m.commune] || '#64748b' }}>{COMMUNE_LABELS[m.commune] || m.commune}</span></>}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold block" style={{ backgroundColor: CSVR_MISSION_STATUS_COLORS[m.statut] + '15', color: CSVR_MISSION_STATUS_COLORS[m.statut] }}>
                    {CSVR_MISSION_STATUS_LABELS[m.statut]}
                  </span>
                  <span className="text-[10px] text-slate-400 mt-1 block">🗓️ {fmtDate(m.scheduledAt)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-4">{editingId ? 'تعديل المهمة' : 'مهمة اصطياد جديدة'}</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الحي</label>
                    <input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">التاريخ والوقت</label>
                    <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">منطقة التدخل</label>
                  <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">مسؤول المهمة</label>
                    <input value={form.teamLead} onChange={(e) => setForm({ ...form, teamLead: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">السائق</label>
                    <input value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الأعوان (افصل بفاصلة)</label>
                    <input value={form.agents} onChange={(e) => setForm({ ...form, agents: e.target.value })} placeholder="العون 1، العون 2" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الطبيب البيطري</label>
                    <input value={form.veterinarian} onChange={(e) => setForm({ ...form, veterinarian: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">المركبة</label>
                    <input value={form.vehicle} onChange={(e) => setForm({ ...form, vehicle: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">المعدّات</label>
                    <input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الأقفاص المتوفرة</label>
                    <input type="number" min="0" value={form.cagesAvailable} onChange={(e) => setForm({ ...form, cagesAvailable: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">العدد المقدر للحيوانات</label>
                    <input type="number" min="0" value={form.estimatedAnimals} onChange={(e) => setForm({ ...form, estimatedAnimals: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
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
                  <label className="text-xs text-slate-600 mb-1 block">تعليمات السلامة</label>
                  <textarea value={form.safetyNotes} onChange={(e) => setForm({ ...form, safetyNotes: e.target.value })} rows={2} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50">إلغاء</button>
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl bg-purple-500 text-white font-medium text-sm hover:bg-purple-600 disabled:opacity-50">
                    {submitting ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setSelected(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono text-xs text-slate-400">{selected.reference}</div>
                  <div className="text-lg font-bold text-slate-800 mt-1">🎯 {selected.quartier || selected.zone || 'منطقة'}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>
              <div className="space-y-1.5 text-sm">
                <div className="flex gap-2"><span className="text-slate-400 w-20">المسؤول:</span><span className="text-slate-700">{selected.teamLead || '—'}</span></div>
                <div className="flex gap-2"><span className="text-slate-400 w-20">السائق:</span><span className="text-slate-700">{selected.driver || '—'}</span></div>
                <div className="flex gap-2"><span className="text-slate-400 w-20">الأعوان:</span><span className="text-slate-700">{selected.agents ? JSON.parse(selected.agents).join('، ') : '—'}</span></div>
                <div className="flex gap-2"><span className="text-slate-400 w-20">بيطري:</span><span className="text-slate-700">{selected.veterinarian || '—'}</span></div>
                <div className="flex gap-2"><span className="text-slate-400 w-20">مركبة:</span><span className="text-slate-700">{selected.vehicle || '—'}</span></div>
                <div className="flex gap-2"><span className="text-slate-400 w-20">مواعيد:</span><span className="text-slate-700">{fmtDate(selected.scheduledAt)}</span></div>
                {selected.safetyNotes && <div className="bg-amber-50 rounded-lg p-2 text-xs text-slate-700">{selected.safetyNotes}</div>}
              </div>
              <div className="mt-4">
                <label className="text-xs text-slate-600 block mb-1">تغيير الحالة</label>
                <select value={selected.statut} onChange={(e) => { handleStatusChange(selected.id, e.target.value); setSelected({ ...selected, statut: e.target.value }) }} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_MISSION_STATUS_LABELS[s]}</option>)}
                </select>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleDelete(selected.id)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600">حذف</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
