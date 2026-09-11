'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LocationPicker from './location-picker'

interface Hotspot { id: string; reference: string; name: string; commune: string; quartier: string; location: string; priority: string; status: string; reportCount: number; groupCount: number; biteCount: number; interventionCount: number; nextReviewDate?: string | null }
interface Props { buildParams: () => URLSearchParams; onRefresh: () => void; mapAllowedCommunes: string[] }

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
const priorities: Record<string, string> = { LOW: 'ضعيفة', MODERATE: 'متوسطة', HIGH: 'مرتفعة', CRITICAL: 'حرجة' }
const statuses: Record<string, string> = { ACTIVE: 'نشطة', MONITORING: 'قيد المراقبة', RESOLVED: 'محلولة', ARCHIVED: 'مؤرشفة' }

export default function HotspotsTab({ buildParams, onRefresh, mapAllowedCommunes }: Props) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', quartier: '', location: '', latitude: '', longitude: '', priority: 'MODERATE', status: 'ACTIVE', reportCount: '0', groupCount: '0', biteCount: '0', interventionCount: '0', lastReviewDate: '', nextReviewDate: '', resolutionNotes: '', notes: '' })

  const allowedCommunes = mapAllowedCommunes

  const load = async () => {
    const response = await fetch(`/api/csvr/hotspots?${buildParams().toString()}`)
    if (response.ok) setHotspots((await response.json()).hotspots || [])
  }

  useEffect(() => { void load() }, [buildParams])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/hotspots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, commune: buildParams().get('commune') || allowedCommunes[0] || '' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر التسجيل'); return }
      toast.success('تم إنشاء النقطة الساخنة')
      setForm({ ...form, name: '', quartier: '', location: '', latitude: '', longitude: '', notes: '' })
      await load()
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-l from-amber-600 to-orange-500 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🔥 النقاط الساخنة</h2><p className="mt-1 text-xs text-amber-50">تحديد المناطق ذات التكرار المرتفع اعتماداً على البلاغات والعضات والتدخلات.</p></div>
      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <input required placeholder="اسم النقطة *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={input} />
        <input placeholder="الحي" value={form.quartier} onChange={(event) => setForm({ ...form, quartier: event.target.value })} className={input} />
        <input placeholder="الموقع" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className={input} />
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className={input}>{Object.entries(priorities).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <div className="flex items-center gap-2 rounded-xl border border-amber-100 bg-amber-50/50 p-2 sm:col-span-2">
          <input placeholder="خط العرض" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className={input} />
          <input placeholder="خط الطول" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className={input} />
          <LocationPicker latitude={form.latitude} longitude={form.longitude} allowedCommunes={allowedCommunes} label="📍 تحديد الإحداثيات تلقائياً" className="shrink-0" onSelect={({ latitude, longitude }) => setForm({ ...form, latitude: String(latitude), longitude: String(longitude) })} />
        </div>
        <input type="number" min="0" placeholder="عدد البلاغات" value={form.reportCount} onChange={(event) => setForm({ ...form, reportCount: event.target.value })} className={input} />
        <input type="number" min="0" placeholder="عدد المجموعات" value={form.groupCount} onChange={(event) => setForm({ ...form, groupCount: event.target.value })} className={input} />
        <input type="number" min="0" placeholder="عدد العضات" value={form.biteCount} onChange={(event) => setForm({ ...form, biteCount: event.target.value })} className={input} />
        <input type="number" min="0" placeholder="عدد التدخلات" value={form.interventionCount} onChange={(event) => setForm({ ...form, interventionCount: event.target.value })} className={input} />
        <input type="date" value={form.nextReviewDate} onChange={(event) => setForm({ ...form, nextReviewDate: event.target.value })} className={input} />
        <button disabled={saving} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'إضافة نقطة ساخنة'}</button>
        <textarea placeholder="ملاحظات ومعالجة النقطة" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} className={`${input} sm:col-span-2 lg:col-span-4`} />
      </form>
      <div className="grid gap-3 lg:grid-cols-2">
        {hotspots.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400 lg:col-span-2">لا توجد نقاط ساخنة في نطاق الحساب.</div> : hotspots.map((hotspot) => <div key={hotspot.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[10px] text-slate-400">{hotspot.reference}</span><h3 className="mt-1 text-sm font-extrabold text-slate-700">{hotspot.name}</h3><p className="text-[11px] text-slate-400">{hotspot.quartier || hotspot.location || '—'}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${hotspot.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : hotspot.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>{priorities[hotspot.priority] || hotspot.priority}</span></div><div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><div className="rounded-lg bg-slate-50 p-2"><b>{hotspot.reportCount}</b><span className="mt-1 block text-[9px] text-slate-400">بلاغ</span></div><div className="rounded-lg bg-slate-50 p-2"><b>{hotspot.groupCount}</b><span className="mt-1 block text-[9px] text-slate-400">مجموعة</span></div><div className="rounded-lg bg-slate-50 p-2"><b>{hotspot.biteCount}</b><span className="mt-1 block text-[9px] text-slate-400">عضة</span></div><div className="rounded-lg bg-slate-50 p-2"><b>{hotspot.interventionCount}</b><span className="mt-1 block text-[9px] text-slate-400">تدخل</span></div></div><p className="mt-3 text-[10px] text-slate-500">الحالة: {statuses[hotspot.status] || hotspot.status}{hotspot.nextReviewDate ? ` · المتابعة: ${new Date(hotspot.nextReviewDate).toLocaleDateString('ar-MA')}` : ''}</p></div>)}
      </div>
    </div>
  )
}
