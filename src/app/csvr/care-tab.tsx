'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'

interface Props {
  animals: StrayAnimal[]
  onRefresh: () => void
}

type CareForm = {
  type: string
  date: string
  practitioner: string
  facility: string
  weight: string
  temperature: string
  generalCondition: string
  diagnosis: string
  treatment: string
  vaccineName: string
  vaccineLot: string
  vaccineExpiryDate: string
  dose: string
  surgeryType: string
  postoperativeNotes: string
  nextDate: string
  notes: string
}

type DestinationForm = {
  type: string
  date: string
  time: string
  site: string
  quartier: string
  latitude: string
  longitude: string
  structure: string
  adopterName: string
  adopterPhone: string
  vaccinationConfirmed: boolean
  sterilizationConfirmed: boolean
  identificationConfirmed: boolean
  notes: string
}

const emptyCare: CareForm = { type: 'EXAMINATION', date: new Date().toISOString().slice(0, 10), practitioner: '', facility: '', weight: '', temperature: '', generalCondition: '', diagnosis: '', treatment: '', vaccineName: '', vaccineLot: '', vaccineExpiryDate: '', dose: '', surgeryType: '', postoperativeNotes: '', nextDate: '', notes: '' }
const emptyDestination: DestinationForm = { type: 'RETURN', date: new Date().toISOString().slice(0, 10), time: '', site: '', quartier: '', latitude: '', longitude: '', structure: '', adopterName: '', adopterPhone: '', vaccinationConfirmed: false, sterilizationConfirmed: false, identificationConfirmed: false, notes: '' }
const careLabels: Record<string, string> = { EXAMINATION: 'فحص بيطري', TREATMENT: 'علاج', VACCINATION: 'تلقيح', STERILIZATION: 'تعقيم', CONTROL: 'مراقبة' }
const destinationLabels: Record<string, string> = { RETURN: 'إعادة إلى المجال', ADOPTION: 'تبنٍ', TRANSFER: 'نقل إلى بنية أخرى', DEATH: 'نفوق' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-600"><span className="mb-1 block">{label}</span>{children}</label>
}

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100'

export default function CareTab({ animals, onRefresh }: Props) {
  const [section, setSection] = useState<'care' | 'destination'>('care')
  const [animalId, setAnimalId] = useState(animals[0]?.id || '')
  const [care, setCare] = useState<CareForm>(emptyCare)
  const [destination, setDestination] = useState<DestinationForm>(emptyDestination)
  const [events, setEvents] = useState<Array<Record<string, any>>>([])
  const [destinations, setDestinations] = useState<Array<Record<string, any>>>([])
  const [eventFilter, setEventFilter] = useState('ALL')
  const [saving, setSaving] = useState(false)
  const selectedAnimal = useMemo(() => animals.find((animal) => animal.id === animalId), [animals, animalId])
  const filteredEvents = useMemo(() => eventFilter === 'ALL' ? events : events.filter((event) => event.type === eventFilter), [events, eventFilter])
  const vaccinationEvents = events.filter((event) => event.type === 'VACCINATION')
  const sterilizationEvents = events.filter((event) => event.type === 'STERILIZATION')
  const treatmentEvents = events.filter((event) => event.type === 'TREATMENT')
  const nextCareEvent = events.filter((event) => event.nextDate && new Date(event.nextDate).getTime() >= Date.now()).sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())[0]

  useEffect(() => {
    if (!animalId) { setEvents([]); setDestinations([]); return }
    let active = true
    Promise.all([
      fetch(`/api/csvr/care?animalId=${encodeURIComponent(animalId)}`).then((response) => response.ok ? response.json() : { events: [] }),
      fetch(`/api/csvr/destinations?animalId=${encodeURIComponent(animalId)}`).then((response) => response.ok ? response.json() : { destinations: [] }),
    ]).then(([careData, destinationData]) => {
      if (!active) return
      setEvents(careData.events || [])
      setDestinations(destinationData.destinations || [])
    }).catch(() => undefined)
    return () => { active = false }
  }, [animalId])

  const submitCare = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId) { toast.error('اختر الحيوان أولاً'); return }
    if (care.type === 'VACCINATION' && !care.vaccineName.trim()) { toast.error('اسم اللقاح مطلوب'); return }
    if (care.type === 'STERILIZATION' && !care.surgeryType.trim()) { toast.error('نوع عملية التعقيم مطلوب'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/care', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...care, animalId }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر حفظ المتابعة'); return }
      toast.success('تم حفظ المتابعة وتحديث حالة الحيوان عند الاقتضاء')
      setCare({ ...emptyCare, date: new Date().toISOString().slice(0, 10) })
      onRefresh()
      const eventsResponse = await fetch(`/api/csvr/care?animalId=${encodeURIComponent(animalId)}`)
      if (eventsResponse.ok) setEvents((await eventsResponse.json()).events || [])
    } catch { toast.error('حدث خطأ أثناء الحفظ') } finally { setSaving(false) }
  }

  const submitDestination = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId) { toast.error('اختر الحيوان أولاً'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/destinations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...destination, animalId, commune: selectedAnimal?.commune || '' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر حفظ الوجهة'); return }
      toast.success('تم حفظ الوجهة وتحديث حالة الحيوان')
      setDestination({ ...emptyDestination, date: new Date().toISOString().slice(0, 10) })
      onRefresh()
      const destinationResponse = await fetch(`/api/csvr/destinations?animalId=${encodeURIComponent(animalId)}`)
      if (destinationResponse.ok) setDestinations((await destinationResponse.json()).destinations || [])
    } catch { toast.error('حدث خطأ أثناء الحفظ') } finally { setSaving(false) }
  }

  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-600 p-4 text-white shadow-lg">
      <h2 className="text-lg font-extrabold">🩺 الرعاية البيطرية والمسار</h2>
      <p className="mt-1 text-xs text-emerald-50">فحص، تلقيح، تعقيم، علاج، تعريف، ثم تسجيل وجهة الحيوان مع حفظ التاريخ الكامل.</p>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <label className="mb-1 block text-xs font-bold text-slate-600">اختر الحيوان</label>
      <select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className={input}>
        <option value="">— اختر من السجل —</option>
        {animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species} — {animal.commune}</option>)}
      </select>
      {selectedAnimal && <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>🐾 {selectedAnimal.csvrNumber}</span><span>الحالة: {selectedAnimal.statut}</span><span>الجماعة: {selectedAnimal.commune}</span></div>}
    </div>
    {selectedAnimal && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3"><span className="text-[10px] font-bold text-emerald-700">💉 التلقيحات</span><strong className="mt-1 block text-2xl text-emerald-900">{vaccinationEvents.length}</strong></div>
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-3"><span className="text-[10px] font-bold text-cyan-700">✂️ عمليات التعقيم</span><strong className="mt-1 block text-2xl text-cyan-900">{sterilizationEvents.length}</strong></div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><span className="text-[10px] font-bold text-amber-700">🩺 العلاجات</span><strong className="mt-1 block text-2xl text-amber-900">{treatmentEvents.length}</strong></div>
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-3"><span className="text-[10px] font-bold text-violet-700">⏰ الموعد القادم</span><strong className="mt-1 block text-sm text-violet-900">{nextCareEvent ? new Date(nextCareEvent.nextDate).toLocaleDateString('ar-MA') : 'لا يوجد'}</strong></div>
    </div>}
    <div className="flex gap-2 overflow-x-auto">
      <button type="button" onClick={() => setSection('care')} className={`rounded-xl px-4 py-2 text-xs font-bold ${section === 'care' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>🩺 الرعاية والتلقيح والتعقيم</button>
      <button type="button" onClick={() => setSection('destination')} className={`rounded-xl px-4 py-2 text-xs font-bold ${section === 'destination' ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>📍 الوجهة والتتبع</button>
    </div>
    {section === 'care' ? <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={submitCare} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2"><Field label="نوع الإجراء"><select value={care.type} onChange={(event) => setCare({ ...care, type: event.target.value })} className={input}>{Object.entries(careLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="التاريخ"><input type="date" value={care.date} onChange={(event) => setCare({ ...care, date: event.target.value })} className={input} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="الطبيب / العون"><input value={care.practitioner} onChange={(event) => setCare({ ...care, practitioner: event.target.value })} className={input} /></Field><Field label="البنية / العيادة"><input value={care.facility} onChange={(event) => setCare({ ...care, facility: event.target.value })} className={input} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="الوزن"><input type="number" step="0.1" value={care.weight} onChange={(event) => setCare({ ...care, weight: event.target.value })} className={input} /></Field><Field label="الحرارة"><input type="number" step="0.1" value={care.temperature} onChange={(event) => setCare({ ...care, temperature: event.target.value })} className={input} /></Field></div>
        {(care.type === 'VACCINATION') && <div className="grid gap-3 sm:grid-cols-2"><Field label="اسم اللقاح *"><input value={care.vaccineName} onChange={(event) => setCare({ ...care, vaccineName: event.target.value })} className={input} required /></Field><Field label="رقم الدفعة"><input value={care.vaccineLot} onChange={(event) => setCare({ ...care, vaccineLot: event.target.value })} className={input} /></Field><Field label="الجرعة"><input value={care.dose} onChange={(event) => setCare({ ...care, dose: event.target.value })} className={input} /></Field><Field label="انتهاء الصلاحية"><input type="date" value={care.vaccineExpiryDate} onChange={(event) => setCare({ ...care, vaccineExpiryDate: event.target.value })} className={input} /></Field><Field label="موعد الجرعة التالية"><input type="date" value={care.nextDate} onChange={(event) => setCare({ ...care, nextDate: event.target.value })} className={input} /></Field></div>}
        {(care.type === 'STERILIZATION') && <div className="grid gap-3 sm:grid-cols-2"><Field label="نوع العملية *"><input value={care.surgeryType} onChange={(event) => setCare({ ...care, surgeryType: event.target.value })} className={input} required /></Field><Field label="موعد المراقبة"><input type="date" value={care.nextDate} onChange={(event) => setCare({ ...care, nextDate: event.target.value })} className={input} /></Field><Field label="ملاحظات ما بعد العملية"><textarea value={care.postoperativeNotes} onChange={(event) => setCare({ ...care, postoperativeNotes: event.target.value })} rows={2} className={input} /></Field></div>}
        <Field label="الحالة / التشخيص"><textarea value={care.generalCondition} onChange={(event) => setCare({ ...care, generalCondition: event.target.value })} rows={2} className={input} /></Field>
        <Field label="التشخيص أو العلاج"><textarea value={care.type === 'TREATMENT' ? care.treatment : care.diagnosis} onChange={(event) => setCare({ ...care, ...(care.type === 'TREATMENT' ? { treatment: event.target.value } : { diagnosis: event.target.value }) })} rows={3} className={input} /></Field>
        <Field label="ملاحظات"><textarea value={care.notes} onChange={(event) => setCare({ ...care, notes: event.target.value })} rows={2} className={input} /></Field>
        <button disabled={saving || !animalId} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ الإجراء البيطري'}</button>
      </form>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold text-slate-700">السجل الطبي</h3><select value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"><option value="ALL">كل الإجراءات</option>{Object.entries(careLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>{filteredEvents.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">لا توجد إجراءات مسجلة لهذا الحيوان.</p> : <div className="space-y-2">{filteredEvents.map((event) => <div key={event.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-emerald-700">{careLabels[event.type] || event.type}</b><span className="text-[10px] text-slate-400">{new Date(event.date).toLocaleDateString('ar-MA')}</span></div><p className="mt-1 text-xs text-slate-600">{event.vaccineName || event.diagnosis || event.treatment || event.generalCondition || event.surgeryType || 'دون تفاصيل إضافية'}</p>{event.vaccineLot && <p className="mt-1 text-[10px] text-slate-500">الدفعة: {event.vaccineLot}{event.vaccineExpiryDate ? ` · الانتهاء: ${new Date(event.vaccineExpiryDate).toLocaleDateString('ar-MA')}` : ''}</p>}{event.nextDate && <p className="mt-1 text-[10px] font-bold text-violet-600">المتابعة القادمة: {new Date(event.nextDate).toLocaleDateString('ar-MA')}</p>}<p className="mt-1 text-[10px] text-slate-400">{event.practitioner || '—'} · {event.facility || '—'}</p></div>)}</div>}</div>
    </div> : <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form onSubmit={submitDestination} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2"><Field label="الوجهة"><select value={destination.type} onChange={(event) => setDestination({ ...destination, type: event.target.value })} className={input}>{Object.entries(destinationLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="التاريخ"><input type="date" value={destination.date} onChange={(event) => setDestination({ ...destination, date: event.target.value })} className={input} /></Field></div><div className="grid gap-3 sm:grid-cols-2"><Field label="الموقع / البنية"><input value={destination.site} onChange={(event) => setDestination({ ...destination, site: event.target.value })} className={input} /></Field><Field label="الحي"><input value={destination.quartier} onChange={(event) => setDestination({ ...destination, quartier: event.target.value })} className={input} /></Field><Field label="خط العرض"><input value={destination.latitude} onChange={(event) => setDestination({ ...destination, latitude: event.target.value })} className={input} /></Field><Field label="خط الطول"><input value={destination.longitude} onChange={(event) => setDestination({ ...destination, longitude: event.target.value })} className={input} /></Field></div>{destination.type === 'ADOPTION' && <div className="grid gap-3 sm:grid-cols-2"><Field label="اسم المتبني"><input value={destination.adopterName} onChange={(event) => setDestination({ ...destination, adopterName: event.target.value })} className={input} /></Field><Field label="هاتف المتبني"><input value={destination.adopterPhone} onChange={(event) => setDestination({ ...destination, adopterPhone: event.target.value })} className={input} /></Field></div>}<div className="flex flex-wrap gap-2">{([['vaccinationConfirmed', 'التلقيح مؤكد'], ['sterilizationConfirmed', 'التعقيم مؤكد'], ['identificationConfirmed', 'التعريف مؤكد']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><input type="checkbox" checked={destination[key]} onChange={(event) => setDestination({ ...destination, [key]: event.target.checked })} />{label}</label>)}</div><Field label="ملاحظات"><textarea value={destination.notes} onChange={(event) => setDestination({ ...destination, notes: event.target.value })} rows={3} className={input} /></Field><button disabled={saving || !animalId} className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'حفظ الوجهة وتحديث الحالة'}</button></form>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-extrabold text-slate-700">تاريخ الوجهات</h3>{destinations.length === 0 ? <p className="py-10 text-center text-xs text-slate-400">لا توجد وجهة مسجلة لهذا الحيوان.</p> : <div className="space-y-2">{destinations.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><b className="text-xs text-teal-700">{destinationLabels[item.type] || item.type}</b><span className="text-[10px] text-slate-400">{new Date(item.date).toLocaleDateString('ar-MA')}</span></div><p className="mt-1 text-xs text-slate-600">{item.site || item.structure || '—'} {item.quartier ? `· ${item.quartier}` : ''}</p><p className="mt-1 text-[10px] text-slate-400">{item.createdBy || '—'}</p></div>)}</div>}</div>
    </div>}
  </div>
}
