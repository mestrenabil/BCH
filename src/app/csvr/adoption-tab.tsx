'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'

interface Adoption { id: string; date: string; adopterName: string; adopterPhone: string; adoptionDocument: string; adoptionCommitment: boolean; notes: string; animal?: { csvrNumber: string; species: string } }
interface FollowUp { id: string; type: string; scheduledDate: string | null; visitDate: string | null; status: string; contactName: string; contactPhone: string; welfareStatus: string; location: string; outcome: string; notes: string; animal?: { csvrNumber: string; species: string } }
interface Props { animals: StrayAnimal[]; onRefresh: () => void }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-100'
const eligibleStatuses = new Set(['ADOPTABLE', 'PRET_RELACHER', 'VACCINE', 'STERILISE', 'IDENTIFIE'])
const followUpTypes: Record<string, string> = { POST_ADOPTION: 'بعد التبني', POST_RELEASE: 'بعد الإطلاق', CENTER_CHECK: 'مراقبة بالمركز' }
const followUpStatuses: Record<string, string> = { PLANNED: 'مجدولة', CONTACTED: 'تم التواصل', COMPLETED: 'مكتملة', FAILED: 'تعذر التواصل', CANCELLED: 'ملغاة' }

export default function AdoptionTab({ animals, onRefresh }: Props) {
  const eligibleAnimals = useMemo(() => animals.filter((animal) => eligibleStatuses.has(animal.statut)), [animals])
  const [animalId, setAnimalId] = useState(eligibleAnimals[0]?.id || '')
  const [adoptions, setAdoptions] = useState<Adoption[]>([])
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), adopterName: '', adopterPhone: '', adoptionDocument: '', adoptionCommitment: false, notes: '' })
  const [followUpForm, setFollowUpForm] = useState({ type: 'POST_ADOPTION', scheduledDate: new Date().toISOString().slice(0, 10), contactName: '', contactPhone: '', location: '', notes: '' })

  useEffect(() => { if (!animalId && eligibleAnimals[0]) setAnimalId(eligibleAnimals[0].id) }, [animalId, eligibleAnimals])
  useEffect(() => { fetch('/api/csvr/destinations?type=ADOPTION').then((response) => response.ok ? response.json() : { destinations: [] }).then((data) => setAdoptions(data.destinations || [])).catch(() => setAdoptions([])) }, [animals])
  useEffect(() => { fetch('/api/csvr/follow-ups').then((response) => response.ok ? response.json() : { followUps: [] }).then((data) => setFollowUps(data.followUps || [])).catch(() => setFollowUps([])) }, [animals])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId || !form.adopterName.trim() || !form.adoptionCommitment) { toast.error('اختر الحيوان وأدخل بيانات المتبني وقبول الالتزام'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/destinations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, animalId, type: 'ADOPTION', site: 'تبنٍ', adopterName: form.adopterName.trim() }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر تسجيل التبني'); return }
      toast.success('تم تسجيل التبني وتحديث حالة الحيوان')
      setForm({ ...form, adopterName: '', adopterPhone: '', adoptionDocument: '', adoptionCommitment: false, notes: '' })
      const list = await fetch('/api/csvr/destinations?type=ADOPTION').then((result) => result.ok ? result.json() : { destinations: [] })
      setAdoptions(list.destinations || [])
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  const submitFollowUp = async (event: React.FormEvent) => {
    event.preventDefault()
    const followUpAnimalId = animalId || animals[0]?.id || ''
    if (!followUpAnimalId || !followUpForm.scheduledDate) { toast.error('اختر الحيوان وموعد المتابعة'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/follow-ups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...followUpForm, animalId: followUpAnimalId }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر حفظ المتابعة'); return }
      toast.success('تمت جدولة المتابعة')
      setFollowUpForm({ ...followUpForm, contactName: '', contactPhone: '', location: '', notes: '' })
      const list = await fetch('/api/csvr/follow-ups').then((result) => result.ok ? result.json() : { followUps: [] })
      setFollowUps(list.followUps || [])
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء حفظ المتابعة') } finally { setSaving(false) }
  }

  const updateFollowUp = async (id: string, status: string) => {
    const response = await fetch(`/api/csvr/follow-ups/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, visitDate: status === 'COMPLETED' ? new Date().toISOString() : null }) })
    if (!response.ok) { toast.error('تعذر تحديث المتابعة'); return }
    setFollowUps((current) => current.map((item) => item.id === id ? { ...item, status, visitDate: status === 'COMPLETED' ? new Date().toISOString() : null } : item))
  }

  const maskPhone = (phone: string) => phone.length > 4 ? `••••${phone.slice(-4)}` : phone || '—'
  return <div className="space-y-4"><div className="rounded-2xl bg-gradient-to-l from-pink-700 to-rose-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🤝 سجل التبني</h2><p className="mt-1 text-xs text-pink-50">تدبير الحيوانات المؤهلة للتبني مع احترام توثيق المتبني وسجل الحيوان.</p></div>{eligibleAnimals.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">لا توجد حيوانات مؤهلة للتبني حالياً.</div> : <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3"><select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className={input}><option value="">اختر الحيوان</option>{eligibleAnimals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species}</option>)}</select><input required placeholder="اسم المتبني *" value={form.adopterName} onChange={(event) => setForm({ ...form, adopterName: event.target.value })} className={input} /><input placeholder="الهاتف" value={form.adopterPhone} onChange={(event) => setForm({ ...form, adopterPhone: event.target.value })} className={input} /><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={input} /><input placeholder="مرجع الوثيقة" value={form.adoptionDocument} onChange={(event) => setForm({ ...form, adoptionDocument: event.target.value })} className={input} /><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.adoptionCommitment} onChange={(event) => setForm({ ...form, adoptionCommitment: event.target.checked })} /> أقرّ بالتزام المتبني</label><textarea placeholder="ملاحظات" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={2} className={`${input} sm:col-span-2 lg:col-span-3`} /><button disabled={saving} className="rounded-xl bg-pink-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تسجيل التبني'}</button></form>}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">سجل عمليات التبني</div>{adoptions.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">لا توجد عمليات تبنٍ مسجلة.</p> : <div className="divide-y divide-slate-100">{adoptions.map((adoption) => <div key={adoption.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[120px_1fr_1fr_120px]"><span className="text-slate-400">{new Date(adoption.date).toLocaleDateString('ar-MA')}</span><span className="font-semibold text-slate-700">{adoption.animal?.csvrNumber || '—'} · {adoption.animal?.species || '—'}</span><span className="text-slate-600">{adoption.adopterName} · {maskPhone(adoption.adopterPhone)}</span><span className="font-bold text-pink-700">{adoption.adoptionCommitment ? 'ملتزم' : 'غير مكتمل'}</span></div>)}</div>}</div>
    <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-extrabold text-violet-900">📅 المتابعة بعد التبني أو الإطلاق</h3><p className="mt-1 text-[11px] text-violet-700">تسجيل موعد المراقبة والنتيجة حتى لا تنتهي الحالة عند تسجيل الوجهة.</p></div><span className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-violet-700">{followUps.length} متابعة</span></div><form onSubmit={submitFollowUp} className="grid gap-3 rounded-xl border border-violet-100 bg-white p-3 sm:grid-cols-2 lg:grid-cols-3"><select value={animalId || animals[0]?.id || ''} onChange={(event) => setAnimalId(event.target.value)} className={input}><option value="">اختر الحيوان</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species} — {animal.commune}</option>)}</select><select value={followUpForm.type} onChange={(event) => setFollowUpForm({ ...followUpForm, type: event.target.value })} className={input}>{Object.entries(followUpTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input required type="date" value={followUpForm.scheduledDate} onChange={(event) => setFollowUpForm({ ...followUpForm, scheduledDate: event.target.value })} className={input} /><input placeholder="اسم جهة التواصل" value={followUpForm.contactName} onChange={(event) => setFollowUpForm({ ...followUpForm, contactName: event.target.value })} className={input} /><input placeholder="هاتف التواصل" value={followUpForm.contactPhone} onChange={(event) => setFollowUpForm({ ...followUpForm, contactPhone: event.target.value })} className={input} /><input placeholder="موقع الزيارة" value={followUpForm.location} onChange={(event) => setFollowUpForm({ ...followUpForm, location: event.target.value })} className={input} /><textarea placeholder="ملاحظات المتابعة" value={followUpForm.notes} onChange={(event) => setFollowUpForm({ ...followUpForm, notes: event.target.value })} rows={2} className={`${input} sm:col-span-2 lg:col-span-3`} /><button disabled={saving} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'جدولة المتابعة'}</button></form><div className="mt-3 space-y-2">{followUps.length === 0 ? <p className="rounded-xl bg-white p-5 text-center text-xs text-slate-400">لا توجد متابعات مسجلة.</p> : followUps.map((followUp) => <div key={followUp.id} className="grid gap-2 rounded-xl border border-white bg-white p-3 text-xs sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center"><div><b className="text-violet-800">{followUp.animal?.csvrNumber || '—'}</b><span className="mr-2 text-slate-500">{followUpTypes[followUp.type] || followUp.type}</span></div><span className="text-slate-500">الموعد: {followUp.scheduledDate ? new Date(followUp.scheduledDate).toLocaleDateString('ar-MA') : '—'}</span><span className="font-bold text-slate-600">{followUpStatuses[followUp.status] || followUp.status}</span>{followUp.status !== 'COMPLETED' && followUp.status !== 'CANCELLED' && <button type="button" onClick={() => updateFollowUp(followUp.id, 'COMPLETED')} className="rounded-lg bg-emerald-100 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700">تسجيل كمكتملة</button>}</div>)}</div></div>
  </div>
}
