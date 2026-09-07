'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'

interface Alert { id: string; reportedAt: string; type: string; urgency: string; clinicalSuspicion: boolean; vaccinationStatus: string; measureTaken: string; healthServiceInformed: boolean; authorityInformed: boolean; animal?: { csvrNumber: string; species: string } }
interface Props { animals: StrayAnimal[]; onRefresh: () => void }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100'
const typeLabels: Record<string, string> = { RAGE_SUSPECT: 'اشتباه بالسعار', INJURY: 'إصابة', DISEASE_SUSPECT: 'اشتباه مرضي', QUARANTINE: 'حجر صحي', OTHER: 'أخرى' }
const urgencyLabels: Record<string, string> = { NORMAL: 'عادي', HIGH: 'مرتفع', URGENT: 'عاجل' }
const vaccinationLabels: Record<string, string> = { UNKNOWN: 'غير معلوم', VACCINATED: 'ملقح', NOT_VACCINATED: 'غير ملقح', PARTIAL: 'جزئي' }

export default function HealthTab({ animals, onRefresh }: Props) {
  const [animalId, setAnimalId] = useState(animals[0]?.id || '')
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ reportedAt: new Date().toISOString().slice(0, 10), type: 'RAGE_SUSPECT', urgency: 'URGENT', clinicalSuspicion: true, vaccinationStatus: 'UNKNOWN', measureTaken: '', healthServiceInformed: false, authorityInformed: false, notes: '' })

  useEffect(() => { if (!animalId && animals[0]) setAnimalId(animals[0].id) }, [animalId, animals])
  useEffect(() => { fetch(`/api/csvr/health-alerts${animalId ? `?animalId=${encodeURIComponent(animalId)}` : ''}`).then((response) => response.ok ? response.json() : { alerts: [] }).then((data) => setAlerts(data.alerts || [])).catch(() => setAlerts([])) }, [animalId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId || !form.measureTaken.trim()) { toast.error('اختر الحيوان وسجل الإجراء المتخذ'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/health-alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, animalId }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر التسجيل'); return }
      toast.success('تم تسجيل التنبيه وتحويل الحيوان للحجر عند الحاجة')
      setForm({ ...form, measureTaken: '', notes: '' })
      const list = await fetch(`/api/csvr/health-alerts?animalId=${encodeURIComponent(animalId)}`).then((result) => result.ok ? result.json() : { alerts: [] })
      setAlerts(list.alerts || [])
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  return <div className="space-y-4"><div className="rounded-2xl bg-gradient-to-l from-red-700 to-orange-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🩸 المراقبة الصحية والتنبيهات</h2><p className="mt-1 text-xs text-red-50">تسجيل الاشتباه والإجراءات الصحية دون إصدار تشخيص آلي.</p></div>{animals.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">لا توجد حيوانات مسجلة.</div> : <><form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className={input}><option value="">اختر الحيوان</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species}</option>)}</select><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={input}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={form.urgency} onChange={(event) => setForm({ ...form, urgency: event.target.value })} className={input}>{Object.entries(urgencyLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={form.vaccinationStatus} onChange={(event) => setForm({ ...form, vaccinationStatus: event.target.value })} className={input}>{Object.entries(vaccinationLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="date" value={form.reportedAt} onChange={(event) => setForm({ ...form, reportedAt: event.target.value })} className={input} /><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.clinicalSuspicion} onChange={(event) => setForm({ ...form, clinicalSuspicion: event.target.checked })} /> اشتباه يحتاج تقييماً</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.healthServiceInformed} onChange={(event) => setForm({ ...form, healthServiceInformed: event.target.checked })} /> إخبار المصالح الصحية</label><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.authorityInformed} onChange={(event) => setForm({ ...form, authorityInformed: event.target.checked })} /> إخبار السلطة</label><textarea required placeholder="الإجراء المتخذ *" value={form.measureTaken} onChange={(event) => setForm({ ...form, measureTaken: event.target.value })} rows={2} className={`${input} sm:col-span-2 lg:col-span-3`} /><button disabled={saving} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تسجيل التنبيه'}</button><textarea placeholder="ملاحظات" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={1} className={`${input} sm:col-span-2 lg:col-span-4`} /></form><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">سجل التنبيهات الصحية</div>{alerts.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">لا توجد تنبيهات صحية لهذا الحيوان.</p> : <div className="divide-y divide-slate-100">{alerts.map((alert) => <div key={alert.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[120px_1fr_90px_1fr]"><span className="text-slate-400">{new Date(alert.reportedAt).toLocaleDateString('ar-MA')}</span><span className="font-semibold text-slate-700">{alert.animal?.csvrNumber || '—'} · {typeLabels[alert.type] || alert.type}</span><span className={`font-black ${alert.urgency === 'URGENT' ? 'text-red-600' : 'text-orange-600'}`}>{urgencyLabels[alert.urgency] || alert.urgency}</span><span className="text-slate-500">{alert.measureTaken} · {alert.healthServiceInformed ? 'أُخبرت الصحة' : 'لم تُخبر الصحة'}</span></div>)}</div>}</div></>}</div>
}
