'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'

interface Transport { id: string; departureDate: string; departureTime: string; arrivalDate?: string | null; arrivalTime: string; vehicle: string; driver: string; agent: string; destination: string; animalCount: number; incident: string; notes: string; animal?: { csvrNumber: string; species: string } }
interface Props { animals: StrayAnimal[]; onRefresh: () => void }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100'

export default function TransportTab({ animals, onRefresh }: Props) {
  const [animalId, setAnimalId] = useState(animals[0]?.id || '')
  const [transports, setTransports] = useState<Transport[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ departureDate: new Date().toISOString().slice(0, 10), departureTime: '', arrivalDate: '', arrivalTime: '', vehicle: '', driver: '', agent: '', destination: '', animalCount: '1', incident: '', notes: '' })

  useEffect(() => { if (!animalId && animals[0]) setAnimalId(animals[0].id) }, [animals, animalId])
  useEffect(() => {
    fetch(`/api/csvr/transports${animalId ? `?animalId=${encodeURIComponent(animalId)}` : ''}`).then((response) => response.ok ? response.json() : { transports: [] }).then((data) => setTransports(data.transports || [])).catch(() => setTransports([]))
  }, [animalId])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId || !form.destination.trim()) { toast.error('اختر الحيوان وأدخل الوجهة'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/transports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, animalId }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر التسجيل'); return }
      toast.success('تم تسجيل النقل وتحديث حالة الحيوان')
      setForm({ ...form, destination: '', incident: '', notes: '' })
      const list = await fetch(`/api/csvr/transports?animalId=${encodeURIComponent(animalId)}`).then((result) => result.ok ? result.json() : { transports: [] })
      setTransports(list.transports || [])
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  return <div className="space-y-4"><div className="rounded-2xl bg-gradient-to-l from-blue-700 to-indigo-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🚐 النقل الميداني</h2><p className="mt-1 text-xs text-blue-50">تتبع انتقال الحيوان من موقع الالتقاط إلى المركز أو الوجهة مع حفظ سجل الحالة.</p></div>{animals.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">لا توجد حيوانات مسجلة.</div> : <><form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className={input}><option value="">اختر الحيوان</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species}</option>)}</select><input type="date" value={form.departureDate} onChange={(event) => setForm({ ...form, departureDate: event.target.value })} className={input} /><input type="time" value={form.departureTime} onChange={(event) => setForm({ ...form, departureTime: event.target.value })} className={input} /><input required placeholder="الوجهة *" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} className={input} /><input placeholder="المركبة" value={form.vehicle} onChange={(event) => setForm({ ...form, vehicle: event.target.value })} className={input} /><input placeholder="السائق" value={form.driver} onChange={(event) => setForm({ ...form, driver: event.target.value })} className={input} /><input placeholder="العون" value={form.agent} onChange={(event) => setForm({ ...form, agent: event.target.value })} className={input} /><input type="number" min="1" value={form.animalCount} onChange={(event) => setForm({ ...form, animalCount: event.target.value })} className={input} /><input type="date" value={form.arrivalDate} onChange={(event) => setForm({ ...form, arrivalDate: event.target.value })} className={input} /><input type="time" value={form.arrivalTime} onChange={(event) => setForm({ ...form, arrivalTime: event.target.value })} className={input} /><input placeholder="حادث أثناء النقل" value={form.incident} onChange={(event) => setForm({ ...form, incident: event.target.value })} className={input} /><button disabled={saving} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تسجيل النقل'}</button><textarea placeholder="ملاحظات" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={1} className={`${input} sm:col-span-2 lg:col-span-4`} /></form><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">سجل النقل</div>{transports.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">لا توجد عمليات نقل لهذا الحيوان.</p> : <div className="divide-y divide-slate-100">{transports.map((transport) => <div key={transport.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[120px_1fr_120px_1fr]"><span className="text-slate-400">{new Date(transport.departureDate).toLocaleDateString('ar-MA')}</span><span className="font-semibold text-slate-700">{transport.destination}</span><span className="font-bold text-blue-700">{transport.vehicle || 'بدون مركبة'}</span><span className="text-slate-500">{transport.agent || '—'}{transport.incident ? ` · ${transport.incident}` : ''}</span></div>)}</div>}</div></>}</div>
}
