'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import LocationPicker from './location-picker'

interface Report {
  id: string
  reference: string
  reportedAt: string
  species: string
  quantity: number
  commune: string
  quartier: string
  location: string
  apparentCause: string
  accident: boolean
  healthSuspicion: boolean
  removalDate?: string | null
  team: string
  destination: string
  handlingMode: string
}

interface Props { buildParams: () => URLSearchParams; onRefresh: () => void }

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-100'
const speciesLabels: Record<string, string> = { DOG: 'كلب', CAT: 'قط', HORSE: 'حصان', DONKEY: 'حمار', FARM: 'حيوان مزرعة', OTHER: 'أخرى' }

export default function DeathReportsTab({ buildParams, onRefresh }: Props) {
  const { user } = useAppStore()
  const [reports, setReports] = useState<Report[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ reportedAt: new Date().toISOString().slice(0, 10), species: 'DOG', quantity: '1', quartier: '', location: '', latitude: '', longitude: '', apparentCause: '', accident: false, healthSuspicion: false, removalDate: '', team: '', destination: '', handlingMode: '', observations: '' })

  const selectedMapCommune = buildParams().get('commune') || ''
  const allowedCommunes = selectedMapCommune
    ? [selectedMapCommune]
    : user?.managedCommunes?.length
    ? Array.from(new Set(user.managedCommunes))
    : user?.commune && user.commune !== 'ALL'
    ? [user.commune]
    : []

  const load = async () => {
    const response = await fetch(`/api/csvr/death-reports?${buildParams().toString()}`)
    if (response.ok) setReports((await response.json()).reports || [])
  }

  useEffect(() => { void load() }, [buildParams])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/death-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, commune: buildParams().get('commune') || allowedCommunes[0] || '' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر التسجيل'); return }
      toast.success('تم تسجيل الحيوان النافق')
      setForm({ ...form, quantity: '1', quartier: '', location: '', latitude: '', longitude: '', apparentCause: '', observations: '' })
      await load()
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-l from-slate-800 to-slate-600 p-4 text-white shadow-lg">
        <h2 className="text-lg font-extrabold">🕊️ الحيوانات النافقة</h2>
        <p className="mt-1 text-xs text-slate-200">تسجيل الموقع والتكفل والإزالة مع إبراز الحالات التي تستدعي انتباهاً صحياً.</p>
      </div>

      <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <input type="date" value={form.reportedAt} onChange={(event) => setForm({ ...form, reportedAt: event.target.value })} className={input} />
        <select value={form.species} onChange={(event) => setForm({ ...form, species: event.target.value })} className={input}>
          {Object.entries(speciesLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className={input} />
        <input placeholder="الحي" value={form.quartier} onChange={(event) => setForm({ ...form, quartier: event.target.value })} className={input} />
        <input placeholder="الموقع" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className={input} />
        <div className="flex items-center gap-2 sm:col-span-2">
          <input placeholder="خط العرض" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className={input} />
          <input placeholder="خط الطول" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className={input} />
          <LocationPicker
            latitude={form.latitude}
            longitude={form.longitude}
            allowedCommunes={allowedCommunes}
            label="حدد النقطة من الخريطة"
            className="shrink-0"
            onSelect={({ latitude, longitude }) => setForm({ ...form, latitude: String(latitude), longitude: String(longitude) })}
          />
        </div>
        <input placeholder="السبب الظاهر" value={form.apparentCause} onChange={(event) => setForm({ ...form, apparentCause: event.target.value })} className={input} />
        <input placeholder="الفريق" value={form.team} onChange={(event) => setForm({ ...form, team: event.target.value })} className={input} />
        <input placeholder="الوجهة" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} className={input} />
        <input placeholder="طريقة التكفل" value={form.handlingMode} onChange={(event) => setForm({ ...form, handlingMode: event.target.value })} className={input} />
        <input type="date" value={form.removalDate} onChange={(event) => setForm({ ...form, removalDate: event.target.value })} className={input} />
        <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={form.accident} onChange={(event) => setForm({ ...form, accident: event.target.checked })} /> حادث</label>
        <label className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700"><input type="checkbox" checked={form.healthSuspicion} onChange={(event) => setForm({ ...form, healthSuspicion: event.target.checked })} /> اشتباه صحي</label>
        <textarea placeholder="ملاحظات" value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} rows={2} className={`${input} sm:col-span-2 lg:col-span-3`} />
        <button disabled={saving} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تسجيل الحالة'}</button>
      </form>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">سجل الحيوانات النافقة</div>
        {reports.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">لا توجد حالات في نطاق الحساب.</p> : <div className="divide-y divide-slate-100">
          {reports.map((report) => <div key={report.id} className="grid gap-1 px-4 py-3 text-xs sm:grid-cols-[150px_1fr_100px_1fr]"><span className="font-mono text-slate-400">{report.reference}</span><span className="font-semibold text-slate-700">{speciesLabels[report.species] || report.species} · {report.quantity} · {report.quartier || report.location || '—'}</span><span className={report.healthSuspicion ? 'font-black text-red-600' : 'text-slate-500'}>{report.healthSuspicion ? 'اشتباه صحي' : report.accident ? 'حادث' : 'عادي'}</span><span className="text-slate-500">{report.removalDate ? `أزيل: ${new Date(report.removalDate).toLocaleDateString('ar-MA')}` : 'في انتظار الإزالة'} · {report.destination || '—'}</span></div>)}
        </div>}
      </div>
    </div>
  )
}
