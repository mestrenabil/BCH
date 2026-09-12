'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'
import LocationPicker from './location-picker'
import VaccinationTracker from './vaccination-tracker'
import { RABIES_EXPOSURE_LABELS, RABIES_PROTOCOL_LABELS, RABIES_ROUTE_LABELS, RABIES_VACCINE_LABELS } from './rabies-vaccination'

interface BiteCase { id: string; reference: string; victimName: string; victimAge: number | null; victimCin: string; victimRegistrationNumber: string; victimAddress: string; guardianName: string; guardianPhone: string; declarantName: string; declarantPhone: string; medicalFacility: string; medicalReferralDate: string | null; exposureCategory: string; woundWashConfirmed: boolean; vaccineType: string; vaccineRoute: string; pepProtocol: string; rigIndicated: boolean; animalType: string; animalStatus: string; biteDate: string; biteLocation: string; commune: string; quartier: string; description: string; status: string; latitude: number | null; longitude: number | null; animal?: { csvrNumber: string; species: string } | null }
interface Props { animals: StrayAnimal[]; buildParams: () => URLSearchParams; onRefresh: () => void; mapAllowedCommunes: string[] }

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100'
const animalTypes: Record<string, string> = { DOG: 'كلب', CAT: 'قط', MONKEY: 'قرد', OTHER: 'أخرى' }
const statuses: Record<string, string> = { NEW: 'جديدة', REPORTED: 'مصرح بها', FOLLOWING: 'قيد المتابعة', VACCINATION_STARTED: 'بدأ التلقيح', VACCINATION_COMPLETE: 'اكتمل التلقيح', CLOSED: 'مغلقة', LOST_CONTACT: 'انقطع الاتصال' }

export default function BiteCasesTab({ animals, buildParams, onRefresh, mapAllowedCommunes }: Props) {
  const [cases, setCases] = useState<BiteCase[]>([])
  const [saving, setSaving] = useState(false)
  const [selectedCase, setSelectedCase] = useState<BiteCase | null>(null)
  const [form, setForm] = useState({ victimName: '', victimAge: '', victimGender: 'M', victimPhone: '', victimCin: '', victimRegistrationNumber: '', victimAddress: '', guardianName: '', guardianPhone: '', declarantName: '', declarantPhone: '', medicalFacility: '', medicalReferralDate: '', exposureCategory: 'UNKNOWN', woundWashConfirmed: false, vaccineType: 'UNKNOWN', vaccineRoute: 'UNKNOWN', pepProtocol: 'PENDING_ASSESSMENT', rigIndicated: false, rigAdministered: false, rigType: '', rigDate: '', woundWashDate: '', woundCareNotes: '', vaccinationNotes: '', animalType: 'DOG', animalStatus: 'UNKNOWN', biteDate: new Date().toISOString().slice(0, 10), biteLocation: '', commune: '', quartier: '', description: '', animalId: '', latitude: '', longitude: '' })
  const allowedCommunes = mapAllowedCommunes

  const load = async () => {
    const response = await fetch(`/api/bite-cases?${buildParams().toString()}`)
    if (response.ok) setCases((await response.json()).biteCases || [])
  }
  useEffect(() => { void load() }, [buildParams])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.victimName.trim() && !form.description.trim()) { toast.error('أدخل اسم المصاب أو وصف الحالة'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/bite-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, commune: form.commune || buildParams().get('commune') || allowedCommunes[0] || '', victimAge: form.victimAge || null, animalId: form.animalId || null, latitude: form.latitude || null, longitude: form.longitude || null, source: 'INTERNAL' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر تسجيل الحالة'); return }
      toast.success(`تم تسجيل حالة العض ${data.reference || ''}`)
      setForm({ ...form, victimName: '', victimAge: '', victimPhone: '', victimCin: '', victimRegistrationNumber: '', victimAddress: '', guardianName: '', guardianPhone: '', declarantName: '', declarantPhone: '', medicalFacility: '', medicalReferralDate: '', biteLocation: '', quartier: '', description: '', animalId: '', latitude: '', longitude: '' })
      await load(); onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-rose-700 to-red-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🦷 سجل العضّات والحوادث</h2><p className="mt-1 text-xs text-rose-50">تسجيل الحالات، ربطها بالحيوان والبلاغ، وتحديد موقع الحادث للمتابعة الصحية.</p></div>
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <input required={!form.description && !form.victimCin && !form.victimRegistrationNumber} placeholder="اسم المصاب *" value={form.victimName} onChange={(event) => setForm({ ...form, victimName: event.target.value })} className={input} />
      <input placeholder="رقم البطاقة الوطنية" value={form.victimCin} onChange={(event) => setForm({ ...form, victimCin: event.target.value })} className={input} />
      <input placeholder="رقم تسجيل المصاب / الملف" value={form.victimRegistrationNumber} onChange={(event) => setForm({ ...form, victimRegistrationNumber: event.target.value })} className={input} />
      <input type="number" min="0" placeholder="سن المصاب" value={form.victimAge} onChange={(event) => setForm({ ...form, victimAge: event.target.value })} className={input} />
      <select value={form.victimGender} onChange={(event) => setForm({ ...form, victimGender: event.target.value })} className={input}><option value="M">ذكر</option><option value="F">أنثى</option><option value="">غير محدد</option></select>
      <input placeholder="هاتف المصاب" value={form.victimPhone} onChange={(event) => setForm({ ...form, victimPhone: event.target.value })} className={input} />
      <input placeholder="عنوان المصاب" value={form.victimAddress} onChange={(event) => setForm({ ...form, victimAddress: event.target.value })} className={input} />
      <input placeholder="اسم ولي الأمر عند الحاجة" value={form.guardianName} onChange={(event) => setForm({ ...form, guardianName: event.target.value })} className={input} />
      <input placeholder="هاتف ولي الأمر" value={form.guardianPhone} onChange={(event) => setForm({ ...form, guardianPhone: event.target.value })} className={input} />
      <input placeholder="اسم المبلّغ إن كان مختلفاً" value={form.declarantName} onChange={(event) => setForm({ ...form, declarantName: event.target.value })} className={input} />
      <input placeholder="هاتف المبلّغ" value={form.declarantPhone} onChange={(event) => setForm({ ...form, declarantPhone: event.target.value })} className={input} />
      <select value={form.animalType} onChange={(event) => setForm({ ...form, animalType: event.target.value })} className={input}>{Object.entries(animalTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select value={form.animalId} onChange={(event) => setForm({ ...form, animalId: event.target.value })} className={input}><option value="">ربط بحيوان مسجل اختياري</option>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} · {animal.species}</option>)}</select>
      <select value={form.animalStatus} onChange={(event) => setForm({ ...form, animalStatus: event.target.value })} className={input}><option value="UNKNOWN">حالة الحيوان غير معروفة</option><option value="STRAY">شارد</option><option value="OWNED">مملوك</option><option value="SUSPECT">مشتبه بالسعار</option><option value="DEAD">نافق</option></select>
      <input type="date" value={form.biteDate} onChange={(event) => setForm({ ...form, biteDate: event.target.value })} className={input} />
      <input placeholder="مكان العضة" value={form.biteLocation} onChange={(event) => setForm({ ...form, biteLocation: event.target.value })} className={input} />
      <input placeholder="الحي" value={form.quartier} onChange={(event) => setForm({ ...form, quartier: event.target.value })} className={input} />
      <input placeholder="المرفق الصحي المحال إليه" value={form.medicalFacility} onChange={(event) => setForm({ ...form, medicalFacility: event.target.value })} className={input} />
      <input type="date" title="تاريخ الإحالة الصحية" value={form.medicalReferralDate} onChange={(event) => setForm({ ...form, medicalReferralDate: event.target.value })} className={input} />
      <select value={form.exposureCategory} onChange={(event) => setForm({ ...form, exposureCategory: event.target.value })} className={input}>{Object.entries(RABIES_EXPOSURE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select value={form.vaccineType} onChange={(event) => setForm({ ...form, vaccineType: event.target.value })} className={input}>{Object.entries(RABIES_VACCINE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select value={form.vaccineRoute} onChange={(event) => setForm({ ...form, vaccineRoute: event.target.value })} className={input}>{Object.entries(RABIES_ROUTE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <select value={form.pepProtocol} onChange={(event) => setForm({ ...form, pepProtocol: event.target.value })} className={input}>{Object.entries(RABIES_PROTOCOL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.woundWashConfirmed} onChange={(event) => setForm({ ...form, woundWashConfirmed: event.target.checked })} /> تم غسل وتنظيف الجرح</label>
      <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.rigIndicated} onChange={(event) => setForm({ ...form, rigIndicated: event.target.checked })} /> الغلوبولين المناعي قيد تقييم المختص</label>
      <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-4"><input placeholder="خط العرض" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className={input} /><input placeholder="خط الطول" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className={input} /><LocationPicker latitude={form.latitude} longitude={form.longitude} allowedCommunes={allowedCommunes} label="تحديد موقع الحادث" className="shrink-0" onSelect={({ latitude, longitude, commune, quartier }) => setForm({ ...form, commune, quartier: quartier || form.quartier, latitude: String(latitude), longitude: String(longitude) })} /></div>
      <textarea required={!form.victimName} placeholder="وصف الحالة والإجراء المتخذ *" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={2} className={`${input} sm:col-span-2 lg:col-span-3`} />
      <button disabled={saving} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تسجيل حالة العض'}</button>
    </form>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">الحالات المسجلة ضمن نطاق الحساب</div>{cases.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">لا توجد حالات عض مسجلة.</p> : <div className="divide-y divide-slate-100">{cases.map((biteCase) => <div key={biteCase.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[140px_1fr_150px_120px_1fr]"><span className="font-mono text-slate-400">{biteCase.reference}<br />{new Date(biteCase.biteDate).toLocaleDateString('ar-MA')}</span><span className="font-semibold text-slate-700">{biteCase.victimName || '—'} · {animalTypes[biteCase.animalType] || biteCase.animalType}<br /><span className="font-normal text-slate-400">بطاقة: {biteCase.victimCin || '—'} · تسجيل: {biteCase.victimRegistrationNumber || '—'}</span></span><span className="text-slate-500">{RABIES_EXPOSURE_LABELS[biteCase.exposureCategory] || 'غير مصنف'}<br />{RABIES_PROTOCOL_LABELS[biteCase.pepProtocol] || '—'}</span><span className="font-bold text-rose-600">{statuses[biteCase.status] || biteCase.status}<br /><button type="button" onClick={() => setSelectedCase(biteCase)} className="mt-1 rounded-lg bg-rose-100 px-2 py-1 text-[10px] text-rose-700">🩺 تتبع التلقيح</button></span><span className="text-slate-500">{biteCase.commune} · {biteCase.medicalFacility ? `إحالة: ${biteCase.medicalFacility} · ` : ''}{biteCase.description || '—'}</span></div>)}</div>}</div>
    {selectedCase && <VaccinationTracker biteCaseId={selectedCase.id} reference={selectedCase.reference} onClose={() => setSelectedCase(null)} />}
  </div>
}
