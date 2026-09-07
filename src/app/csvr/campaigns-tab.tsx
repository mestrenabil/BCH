'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Props { buildParams: () => URLSearchParams; onRefresh: () => void }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'
const labels: Record<string, string> = { CENSUS: 'إحصاء', CAPTURE: 'التقاط', VACCINATION: 'تلقيح', STERILIZATION: 'تعقيم', IDENTIFICATION: 'تعريف', AWARENESS: 'تحسيس', TARGETED: 'تدخل موجه', OTHER: 'أخرى' }
const statusLabels: Record<string, string> = { PLANNED: 'مبرمجة', IN_PROGRESS: 'جارية', COMPLETED: 'منجزة', CANCELLED: 'ملغاة' }

export default function CampaignsTab({ buildParams, onRefresh }: Props) {
  const [campaigns, setCampaigns] = useState<Array<Record<string, any>>>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', year: String(new Date().getFullYear()), type: 'CAPTURE', zone: '', objective: '', responsible: '', partners: '', startDate: new Date().toISOString().slice(0, 10), endDate: '', indicator: '', quantitativeTarget: '', achieved: '', status: 'PLANNED', notes: '' })

  const load = async () => {
    const response = await fetch(`/api/csvr/campaigns?${buildParams().toString()}`)
    if (response.ok) setCampaigns((await response.json()).campaigns || [])
  }
  useEffect(() => { void load() }, [buildParams])

  const create = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.name.trim()) { toast.error('اسم الحملة مطلوب'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/csvr/campaigns', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, commune: buildParams().get('commune') || '' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر إنشاء الحملة'); return }
      toast.success('تم إنشاء الحملة السنوية')
      setForm({ ...form, name: '', zone: '', objective: '', partners: '', quantitativeTarget: '', achieved: '' })
      await load(); onRefresh()
    } catch { toast.error('حدث خطأ أثناء الحفظ') } finally { setSaving(false) }
  }

  const update = async (campaign: Record<string, any>, data: Record<string, unknown>) => {
    const response = await fetch(`/api/csvr/campaigns/${campaign.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    if (!response.ok) { toast.error('تعذر تحديث الحملة'); return }
    await load(); onRefresh()
  }

  return <div className="space-y-4">
    <div className="rounded-2xl bg-gradient-to-l from-violet-700 to-indigo-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🗓️ البرنامج والحملات السنوية</h2><p className="mt-1 text-xs text-violet-50">برمجة حملات الإحصاء والالتقاط والتلقيح والتعقيم وقياس الإنجاز حسب جماعة الحساب.</p></div>
    <form onSubmit={create} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><input required placeholder="اسم الحملة *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={input} /><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={input}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="number" placeholder="السنة" value={form.year} onChange={(event) => setForm({ ...form, year: event.target.value })} className={input} /><input placeholder="المنطقة" value={form.zone} onChange={(event) => setForm({ ...form, zone: event.target.value })} className={input} /><input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={input} /><input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className={input} /><input placeholder="المؤشر" value={form.indicator} onChange={(event) => setForm({ ...form, indicator: event.target.value })} className={input} /><input type="number" min="0" placeholder="الهدف الكمي" value={form.quantitativeTarget} onChange={(event) => setForm({ ...form, quantitativeTarget: event.target.value })} className={input} /></div><div className="grid gap-3 sm:grid-cols-3"><input placeholder="المسؤول" value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} className={input} /><input placeholder="الشركاء" value={form.partners} onChange={(event) => setForm({ ...form, partners: event.target.value })} className={input} /><textarea placeholder="الهدف والملاحظات" value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} rows={1} className={input} /></div><button disabled={saving} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : 'إضافة إلى البرنامج السنوي'}</button></form>
    {campaigns.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">لا توجد حملات في نطاق الحساب.</div> : <div className="grid gap-3 lg:grid-cols-2">{campaigns.map((campaign) => <div key={campaign.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="font-mono text-[10px] text-slate-400">{campaign.reference}</span><h3 className="mt-1 text-sm font-extrabold text-slate-700">{campaign.name}</h3><p className="mt-1 text-[11px] text-slate-400">{labels[campaign.type] || campaign.type} · {campaign.zone || 'كل المنطقة'}</p></div><select value={campaign.status} onChange={(event) => update(campaign, { status: event.target.value })} className="rounded-lg border border-slate-200 px-2 py-1 text-[10px]"><option value="PLANNED">{statusLabels.PLANNED}</option><option value="IN_PROGRESS">{statusLabels.IN_PROGRESS}</option><option value="COMPLETED">{statusLabels.COMPLETED}</option><option value="CANCELLED">{statusLabels.CANCELLED}</option></select></div><div className="mt-4 flex items-end justify-between"><div><span className="text-2xl font-black text-violet-700">{campaign.progress == null ? '—' : `${campaign.progress}%`}</span><p className="text-[10px] text-slate-400">{campaign.achieved} / {campaign.quantitativeTarget || '—'} منجز</p></div><input type="number" min="0" value={campaign.achieved} onChange={(event) => setCampaigns((items) => items.map((item) => item.id === campaign.id ? { ...item, achieved: event.target.value } : item))} onBlur={(event) => update(campaign, { achieved: event.target.value })} className="w-28 rounded-lg border border-slate-200 px-2 py-1 text-xs" /></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-l from-violet-500 to-indigo-500" style={{ width: `${Math.min(campaign.progress || 0, 100)}%` }} /></div></div>)}</div>}
  </div>
}
