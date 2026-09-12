'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'
import LocationPicker from './location-picker'

interface Props { animals: StrayAnimal[]; buildParams: () => URLSearchParams; onRefresh: () => void; mapAllowedCommunes: string[] }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100'

export default function CentersTab({ animals, buildParams, onRefresh, mapAllowedCommunes }: Props) {
  const [centers, setCenters] = useState<Array<Record<string, any>>>([])
  const [centerId, setCenterId] = useState('')
  const [animalId, setAnimalId] = useState(animals[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [centerForm, setCenterForm] = useState({ name: '', type: 'REFUGE', commune: '', adresse: '', responsible: '', telephone: '', capacity: '', latitude: '', longitude: '', notes: '' })
  const [admissionForm, setAdmissionForm] = useState({ admittedAt: new Date().toISOString().slice(0, 10), boxOrZone: '', generalCondition: '', weight: '', temperature: '', observation: '', agent: '' })

  const loadCenters = async () => {
    const response = await fetch(`/api/csvr/centers?${buildParams().toString()}`)
    if (response.ok) {
      const data = await response.json()
      setCenters(data.centers || [])
      if (!centerId && data.centers?.[0]) setCenterId(data.centers[0].id)
    }
  }
  useEffect(() => { void loadCenters() }, [buildParams])

  const createCenter = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!centerForm.name.trim()) { toast.error('اسم المركز مطلوب'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/centers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...centerForm, commune: centerForm.commune || buildParams().get('commune') || '' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر إنشاء المركز'); return }
      toast.success('تم إنشاء المركز')
      setCenterForm({ name: '', type: 'REFUGE', commune: '', adresse: '', responsible: '', telephone: '', capacity: '', latitude: '', longitude: '', notes: '' })
      await loadCenters()
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء إنشاء المركز') } finally { setSaving(false) }
  }

  const createAdmission = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId || !centerId) { toast.error('اختر الحيوان والمركز'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/admissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...admissionForm, animalId, centerId }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر تسجيل الاستقبال'); return }
      toast.success('تم تسجيل دخول الحيوان إلى المركز')
      setAdmissionForm({ admittedAt: new Date().toISOString().slice(0, 10), boxOrZone: '', generalCondition: '', weight: '', temperature: '', observation: '', agent: '' })
      await loadCenters()
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء تسجيل الاستقبال') } finally { setSaving(false) }
  }

  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-l from-cyan-700 to-sky-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🏠 مراكز الإيواء والاستقبال</h2><p className="mt-1 text-xs text-cyan-50">إدارة المراكز، الطاقة الاستيعابية، ومراحل استقبال الحيوانات ميدانياً.</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <form onSubmit={createCenter} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-extrabold text-slate-700">إضافة مركز</h3><div className="grid gap-3 sm:grid-cols-2"><input required placeholder="اسم المركز *" value={centerForm.name} onChange={(event) => setCenterForm({ ...centerForm, name: event.target.value })} className={input} /><select value={centerForm.type} onChange={(event) => setCenterForm({ ...centerForm, type: event.target.value })} className={input}><option value="REFUGE">مركز إيواء</option><option value="CENTRE_VETERINAIRE">مركز بيطري</option><option value="QUARANTINE">حجر صحي</option><option value="OTHER">أخرى</option></select><input placeholder="العنوان" value={centerForm.adresse} onChange={(event) => setCenterForm({ ...centerForm, adresse: event.target.value })} className={input} /><input type="number" min="0" placeholder="الطاقة الاستيعابية" value={centerForm.capacity} onChange={(event) => setCenterForm({ ...centerForm, capacity: event.target.value })} className={input} /><input placeholder="المسؤول" value={centerForm.responsible} onChange={(event) => setCenterForm({ ...centerForm, responsible: event.target.value })} className={input} /><input placeholder="الهاتف" value={centerForm.telephone} onChange={(event) => setCenterForm({ ...centerForm, telephone: event.target.value })} className={input} /></div><div className="grid gap-3 sm:grid-cols-2"><input placeholder="خط العرض" value={centerForm.latitude} onChange={(event) => setCenterForm({ ...centerForm, latitude: event.target.value })} className={input} /><input placeholder="خط الطول" value={centerForm.longitude} onChange={(event) => setCenterForm({ ...centerForm, longitude: event.target.value })} className={input} /></div><LocationPicker latitude={centerForm.latitude} longitude={centerForm.longitude} allowedCommunes={mapAllowedCommunes} onSelect={({ latitude, longitude, commune }) => setCenterForm({ ...centerForm, commune, latitude: String(latitude), longitude: String(longitude) })} /><button disabled={saving} className="w-full rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ المركز'}</button></form>
      <form onSubmit={createAdmission} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-extrabold text-slate-700">تسجيل استقبال حيوان</h3><select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className={input}><option value="">اختر الحيوان</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.commune}</option>)}</select><select value={centerId} onChange={(event) => setCenterId(event.target.value)} className={input}><option value="">اختر المركز</option>{centers.map((center) => <option key={center.id} value={center.id}>{center.name} — {center.occupied}/{center.capacity || '∞'}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><input type="date" value={admissionForm.admittedAt} onChange={(event) => setAdmissionForm({ ...admissionForm, admittedAt: event.target.value })} className={input} /><input placeholder="الصندوق / المنطقة" value={admissionForm.boxOrZone} onChange={(event) => setAdmissionForm({ ...admissionForm, boxOrZone: event.target.value })} className={input} /><input type="number" step="0.1" placeholder="الوزن" value={admissionForm.weight} onChange={(event) => setAdmissionForm({ ...admissionForm, weight: event.target.value })} className={input} /><input type="number" step="0.1" placeholder="الحرارة" value={admissionForm.temperature} onChange={(event) => setAdmissionForm({ ...admissionForm, temperature: event.target.value })} className={input} /></div><textarea placeholder="الحالة والملاحظات" value={admissionForm.observation} onChange={(event) => setAdmissionForm({ ...admissionForm, observation: event.target.value })} rows={3} className={input} /><button disabled={saving} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ التسجيل...' : 'تسجيل الدخول إلى المركز'}</button></form>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{centers.map((center) => <button type="button" key={center.id} onClick={() => setCenterId(center.id)} className={`rounded-2xl border bg-white p-4 text-right shadow-sm transition ${centerId === center.id ? 'border-cyan-400 ring-2 ring-cyan-100' : 'border-slate-200'}`}><div className="flex items-start justify-between gap-2"><div><h3 className="text-sm font-extrabold text-slate-700">{center.name}</h3><p className="mt-1 text-[10px] text-slate-400">{center.adresse || center.commune}</p></div><span className="rounded-lg bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">{center.status === 'ACTIVE' ? 'نشط' : 'متوقف'}</span></div><div className="mt-3 flex items-end justify-between"><div><span className="text-2xl font-black text-slate-800">{center.occupied}</span><span className="text-xs text-slate-400"> / {center.capacity || '∞'} مشغول</span></div><span className="text-xs font-bold text-emerald-600">{center.available == null ? 'سعة غير محددة' : `${center.available} متاح`}</span></div></button>)}</div>
    {centers.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">لا توجد مراكز مسجلة في نطاق الحساب.</div>}
  </div>
}
