'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ESTABLISHMENT_STATUS_LABELS, ESTABLISHMENT_STATUS_COLORS,
  RISK_CATEGORY_LABELS, RISK_CATEGORY_COLORS,
  FOOD_ESTABLISHMENT_TYPES,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { Establishment } from './types'
import LocationPicker from '../csvr/location-picker'

interface Props {
  establishments: Establishment[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
  allowedCommunes: string[]
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function EstablishmentsTab({ establishments, loading, onRefresh, buildParams, allowedCommunes }: Props) {
  const [search, setSearch] = useState('')
  const [filterRisk, setFilterRisk] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [selected, setSelected] = useState<Establishment | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    return establishments.filter((e) => {
      if (filterRisk !== 'ALL' && e.riskCategory !== filterRisk) return false
      if (filterStatus !== 'ALL' && e.status !== filterStatus) return false
      if (search) {
        const q = search.toLowerCase()
        if (!e.reference.toLowerCase().includes(q) && !e.name.toLowerCase().includes(q) && !e.ownerName.toLowerCase().includes(q) && !e.activity.toLowerCase().includes(q) && !e.quartier.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [establishments, filterRisk, filterStatus, search])

  if (loading && establishments.length === 0) {
    return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-3" dir="rtl">
      {/* فلاتر */}
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (اسم/مرجع/مالك/نشاط)..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل المخاطر</option>
          {Object.entries(RISK_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {Object.entries(ESTABLISHMENT_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="px-3 py-2 text-xs font-bold rounded-xl bg-teal-600 text-white hover:bg-teal-700">
          ➕ منشأة جديدة
        </button>
      </div>

      {/* القائمة */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <div className="text-5xl mb-3">🏪</div>
          <p className="text-sm text-slate-500">{establishments.length === 0 ? 'لا توجد منشآت بعد' : 'لا توجد نتائج مطابقة'}</p>
          {establishments.length === 0 && (
            <button onClick={() => setShowCreate(true)} className="mt-3 text-xs font-bold text-teal-600">إضافة أول منشأة</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((e, i) => {
            const riskColor = RISK_CATEGORY_COLORS[e.riskCategory] || '#94a3b8'
            const statusColor = ESTABLISHMENT_STATUS_COLORS[e.status] || '#64748b'
            return (
              <motion.button
                key={e.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                onClick={() => setSelected(e)}
                className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md hover:border-teal-200 transition-all relative overflow-hidden"
              >
                <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: riskColor }} />
                <div className="flex items-start justify-between gap-2 pr-1">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 truncate">{e.name}</div>
                    <div className="text-xs text-slate-500 line-clamp-1">{e.activity || '—'}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{e.reference}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: statusColor + '15', color: statusColor }}>
                    {ESTABLISHMENT_STATUS_LABELS[e.status] || e.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">
                  {e.quartier && <span>📍 {e.quartier}</span>}
                  <span style={{ color: COMMUNE_COLORS[e.commune] || '#64748b' }}>{COMMUNE_LABELS[e.commune] || e.commune}</span>
                  {e._count && <span>🔍 {e._count.inspections} تفتيش</span>}
                  {e._count && e._count.healthCards > 0 && <span>🩺 {e._count.healthCards}</span>}
                </div>
                {/* شريط درجة المخاطر */}
                <div className="mt-2 pr-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 shrink-0">المخاطر:</span>
                    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${e.riskScore}%`, background: riskColor }} />
                    </div>
                    <span className="text-[10px] font-bold shrink-0" style={{ color: riskColor }}>{e.riskScore}</span>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      <div className="text-center"><span className="text-xs text-slate-400">عرض {filtered.length} من أصل {establishments.length} منشأة</span></div>

      {/* لوحة التفاصيل */}
      <AnimatePresence>
        {selected && <DetailPanel establishment={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>

      {/* نموذج إنشاء */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); onRefresh() }} buildParams={buildParams} allowedCommunes={allowedCommunes} />
        )}
      </AnimatePresence>
    </div>
  )
}

function DetailPanel({ establishment: e, onClose }: { establishment: Establishment; onClose: () => void }) {
  const riskColor = RISK_CATEGORY_COLORS[e.riskCategory] || '#94a3b8'
  const statusColor = ESTABLISHMENT_STATUS_COLORS[e.status] || '#64748b'
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(ev) => ev.stopPropagation()} dir="rtl">
        <div className="bg-gradient-to-l from-teal-600 to-cyan-700 px-5 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold">{e.name}</h3>
              <p className="text-teal-100 text-xs mt-0.5">{e.reference}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
          </div>
        </div>
        <div className="p-5 space-y-3 text-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: statusColor + '20', color: statusColor }}>
              {ESTABLISHMENT_STATUS_LABELS[e.status]}
            </span>
            <span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ backgroundColor: riskColor + '20', color: riskColor }}>
              {RISK_CATEGORY_LABELS[e.riskCategory]} ({e.riskScore}/100)
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><span className="text-slate-500 block text-xs">النشاط</span><span className="font-bold">{e.activity || '—'}</span></div>
            <div><span className="text-slate-500 block text-xs">المالك</span><span className="font-bold">{e.ownerName || '—'}</span></div>
            <div><span className="text-slate-500 block text-xs">الهاتف</span><span>{e.telephone || '—'}</span></div>
            <div><span className="text-slate-500 block text-xs">الجماعة</span><span className="font-bold" style={{ color: COMMUNE_COLORS[e.commune] || '#64748b' }}>{COMMUNE_LABELS[e.commune] || e.commune}</span></div>
            {e.quartier && <div><span className="text-slate-500 block text-xs">الحي</span>{e.quartier}</div>}
            {e.adresse && <div><span className="text-slate-500 block text-xs">العنوان</span>{e.adresse}</div>}
            {e.authorizationNumber && <div><span className="text-slate-500 block text-xs">رقم الرخصة</span><span className="font-mono">{e.authorizationNumber}</span></div>}
            {e.openingDate && <div><span className="text-slate-500 block text-xs">تاريخ الافتتاح</span>{fmtDate(e.openingDate)}</div>}
          </div>
          {e.latitude != null && (
            <div><span className="text-slate-500 block text-xs">الإحداثيات</span>
              <a href={`https://www.openstreetmap.org/?mlat=${e.latitude}&mlon=${e.longitude}#map=18/${e.latitude}/${e.longitude}`} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline font-mono text-xs" dir="ltr">{e.latitude.toFixed(5)}, {e.longitude?.toFixed(5)} ↗</a>
            </div>
          )}
          {e.description && <div className="pt-2 border-t border-slate-100"><span className="text-slate-500 block text-xs mb-1">ملاحظات</span><p className="text-slate-700">{e.description}</p></div>}
        </div>
      </motion.div>
    </motion.div>
  )
}

function CreateModal({ onClose, onCreated, buildParams, allowedCommunes }: { onClose: () => void; onCreated: () => void; buildParams: (extra?: Record<string, string>) => URLSearchParams; allowedCommunes: string[] }) {
  const accountCommune = buildParams().get('commune') || ''
  const [form, setForm] = useState({
    name: '', activity: '', category: '', ownerName: '', ownerCin: '', telephone: '',
    commune: '', quartier: '', adresse: '', latitude: '', longitude: '', authorizationNumber: '', openingDate: '', description: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('يرجى تقديم اسم المنشأة'); return }
    setSaving(true)
    try {
      const params = buildParams()
      const commune = form.commune || accountCommune || params.get('commune') || 'ALL'
      const res = await fetch('/api/establishments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commune, latitude: form.latitude ? Number(form.latitude) : null, longitude: form.longitude ? Number(form.longitude) : null, openingDate: form.openingDate || null }),
      })
      if (!res.ok) { const err = await res.json().catch(() => null); toast.error(err?.error || 'فشل الإنشاء'); return }
      toast.success('تم إنشاء المنشأة')
      onCreated()
    } catch { toast.error('حدث خطأ') } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="bg-gradient-to-l from-teal-600 to-cyan-700 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-lg font-bold">🏪 منشأة جديدة</h3>
          <button type="button" onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">اسم المنشأة *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">النشاط</label>
            <select value={form.activity} onChange={(e) => setForm({ ...form, activity: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
              <option value="">— اختر —</option>
              {FOOD_ESTABLISHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">المالك</label>
              <input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">الهاتف</label>
              <input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label>
              <input value={form.commune || accountCommune} onChange={(e) => setForm({ ...form, commune: e.target.value })} placeholder="كود الجماعة"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">الحي</label>
              <input value={form.quartier} onChange={(e) => setForm({ ...form, quartier: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-600 block mb-1">العنوان</label>
            <input value={form.adresse} onChange={(e) => setForm({ ...form, adresse: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-xs font-bold text-slate-700">📍 الموقع الجغرافي للمنشأة</div>
                <div className="mt-0.5 text-[10px] text-slate-500">حدد موقع المنشأة من الخريطة داخل حدود جماعة الحساب.</div>
              </div>
              <LocationPicker
                latitude={form.latitude}
                longitude={form.longitude}
                allowedCommunes={form.commune || accountCommune ? [form.commune || accountCommune] : allowedCommunes}
                label="تحديد موقع المنشأة"
                title="تحديد موقع المنشأة"
                description="انقر على موقع المنشأة بدقة؛ ستظهر النقطة مع الإحداثيات ويمكن اعتمادها عند الإغلاق."
                className="shrink-0"
                onSelect={({ latitude, longitude, commune, quartier }) => setForm({ ...form, commune, quartier: quartier || form.quartier, latitude: String(latitude), longitude: String(longitude) })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">خط العرض</label>
                <input inputMode="decimal" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="يُملأ من الخريطة" dir="ltr"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 block mb-1">خط الطول</label>
                <input inputMode="decimal" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="يُملأ من الخريطة" dir="ltr"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-teal-300" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">رقم الرخصة</label>
              <input value={form.authorizationNumber} onChange={(e) => setForm({ ...form, authorizationNumber: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الافتتاح</label>
              <input type="date" value={form.openingDate} onChange={(e) => setForm({ ...form, openingDate: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-300" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">إلغاء</button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
          </div>
        </div>
      </motion.form>
    </motion.div>
  )
}
