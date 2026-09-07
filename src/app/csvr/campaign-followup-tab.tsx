'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import LocationPicker from './location-picker'

interface Campaign { id: string; reference: string; name: string; achieved: number; quantitativeTarget: number }
interface Activity { id: string; date: string; type: string; zone: string; quantity: number; staff: string; latitude: number | null; longitude: number | null; notes: string }
interface Props { buildParams: () => URLSearchParams; onRefresh: () => void }

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100'
const types: Record<string, string> = { RESULT: 'حصيلة عامة', CAPTURE: 'التقاط', VACCINATION: 'تلقيح', STERILIZATION: 'تعقيم', IDENTIFICATION: 'تعريف', RELEASE: 'إرجاع' }

export default function CampaignFollowupTab({ buildParams, onRefresh }: Props) {
  const { user } = useAppStore()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [campaignId, setCampaignId] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), type: 'RESULT', zone: '', quantity: '', staff: '', latitude: '', longitude: '', notes: '' })
  const managedCommunes = user?.managedCommunes?.length ? user.managedCommunes : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])
  const selectedMapCommune = buildParams().get('commune') || ''
  const mapAllowedCommunes = selectedMapCommune ? [selectedMapCommune] : managedCommunes

  const loadCampaigns = async () => {
    const response = await fetch(`/api/csvr/campaigns?${buildParams().toString()}`)
    if (!response.ok) return
    const data = await response.json()
    const next = (data.campaigns || []) as Campaign[]
    setCampaigns(next)
    setCampaignId((current) => current || next[0]?.id || '')
  }

  const loadActivities = async (id: string) => {
    if (!id) { setActivities([]); return }
    const response = await fetch(`/api/csvr/campaigns/${id}/activities`)
    if (response.ok) setActivities(((await response.json()).activities || []) as Activity[])
  }

  useEffect(() => { void loadCampaigns() }, [buildParams])
  useEffect(() => { void loadActivities(campaignId) }, [campaignId])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!campaignId) { toast.error('اختر حملة أولاً'); return }
    setSaving(true)
    try {
      const response = await fetch(`/api/csvr/campaigns/${campaignId}/activities`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر تسجيل الحصيلة'); return }
      toast.success('تم تسجيل الحصيلة وتحديث الإنجاز')
      setForm({ ...form, quantity: '', latitude: '', longitude: '', notes: '' })
      await Promise.all([loadActivities(campaignId), loadCampaigns()])
      onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }

  const selected = campaigns.find((campaign) => campaign.id === campaignId)
  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-l from-cyan-700 to-sky-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">📈 المتابعة الميدانية</h2><p className="mt-1 text-xs text-cyan-50">سجل الحصائل اليومية للحملات وتحديث المؤشر الإجمالي تلقائياً.</p></div>
    {campaigns.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">أنشئ حملة من تبويب البرنامج السنوي أولاً.</div> : <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className={`${input} max-w-xl`}><option value="">اختر الحملة</option>{campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name} — {campaign.reference}</option>)}</select>{selected && <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">الإنجاز: {selected.achieved} / {selected.quantitativeTarget || '—'}</span>}</div>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className={input} /><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={input}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="number" min="1" required placeholder="العدد *" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className={input} /><input placeholder="المنطقة" value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} className={input} /><input placeholder="الفريق أو العون" value={form.staff} onChange={(event) => setForm({ ...form, staff: event.target.value })} className={input} /><button disabled={saving} className="rounded-xl bg-cyan-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'تسجيل الحصيلة'}</button><div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3 sm:col-span-2 lg:col-span-6"><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><div className="text-xs font-bold text-slate-700">📍 مكان المتابعة</div><div className="mt-0.5 text-[10px] text-slate-500">حدد المكان من الخريطة لتعبئة الإحداثيات تلقائياً.</div></div><LocationPicker latitude={form.latitude} longitude={form.longitude} allowedCommunes={mapAllowedCommunes} onSelect={({ latitude, longitude }) => setForm({ ...form, latitude: String(latitude), longitude: String(longitude) })} /></div><div className="grid gap-3 sm:grid-cols-2"><input placeholder="خط العرض" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: event.target.value })} className={input} /><input placeholder="خط الطول" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: event.target.value })} className={input} /></div></div><textarea placeholder="ملاحظات المتابعة" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={1} className={`${input} sm:col-span-2 lg:col-span-6`} /></form>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-700">سجل الحصائل المسجلة</div>{activities.length === 0 ? <p className="p-8 text-center text-sm text-slate-400">لا توجد حصائل لهذه الحملة.</p> : <div className="divide-y divide-slate-100">{activities.map((activity) => <div key={activity.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[110px_1fr_90px_1fr] sm:items-center"><span className="text-slate-400">{new Date(activity.date).toLocaleDateString('ar-MA')}</span><span className="font-semibold text-slate-700">{types[activity.type] || activity.type} · {activity.zone || 'كل المنطقة'}{activity.latitude != null && activity.longitude != null ? ` · 📍 ${activity.latitude.toFixed(5)}, ${activity.longitude.toFixed(5)}` : ''}</span><span className="font-black text-cyan-700">{activity.quantity}</span><span className="text-slate-500">{activity.staff || '—'} {activity.notes ? `· ${activity.notes}` : ''}</span></div>)}</div>}</div>
    </>}
  </div>
}
