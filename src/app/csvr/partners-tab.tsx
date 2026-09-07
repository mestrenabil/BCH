'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

interface Partner { id: string; name: string; type: string; status: string; contact: string; telephone: string; email: string; notes: string }
interface Props { buildParams: () => URLSearchParams; onRefresh: () => void }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
const types: Record<string, string> = { COMMUNE: 'الجماعة', BCH: 'قسم الوقاية وحفظ الصحة', LOCAL_AUTHORITY: 'السلطة المحلية', HEALTH: 'مصلحة صحية', VETERINARY: 'مصلحة بيطرية', ASSOCIATION: 'جمعية', SECURITY: 'الأمن أو الدرك', SHELTER: 'مركز إيواء', LABORATORY: 'مختبر', OTHER: 'أخرى' }

export default function PartnersTab({ buildParams, onRefresh }: Props) {
  const [partners, setPartners] = useState<Partner[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'ASSOCIATION', contact: '', telephone: '', email: '', notes: '' })
  const load = async () => { const response = await fetch(`/api/csvr/partners?${buildParams().toString()}`); if (response.ok) setPartners((await response.json()).partners || []) }
  useEffect(() => { void load() }, [buildParams])
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true)
    try {
      const response = await fetch('/api/csvr/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, commune: buildParams().get('commune') || '' }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر التسجيل'); return }
      toast.success('تمت إضافة الشريك'); setForm({ ...form, name: '', contact: '', telephone: '', email: '', notes: '' }); await load(); onRefresh()
    } catch { toast.error('حدث خطأ أثناء التسجيل') } finally { setSaving(false) }
  }
  const toggle = async (partner: Partner) => { const response = await fetch(`/api/csvr/partners/${partner.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: partner.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }) }); if (response.ok) { await load(); onRefresh() } else toast.error('تعذر تحديث الحالة') }
  return <div className="space-y-4"><div className="rounded-2xl bg-gradient-to-l from-teal-700 to-emerald-600 p-4 text-white shadow-lg"><h2 className="text-lg font-extrabold">🤝 دليل الشركاء والجهات</h2><p className="mt-1 text-xs text-teal-50">مرجع موحد للجهات المتعاونة في حملات وتدخلات الحيوانات الشاردة.</p></div><form onSubmit={submit} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4"><input required placeholder="اسم الجهة *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={input} /><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className={input}>{Object.entries(types).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input placeholder="جهة الاتصال" value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} className={input} /><input placeholder="الهاتف" value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} className={input} /><input type="email" placeholder="البريد الإلكتروني" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={input} /><textarea placeholder="ملاحظات" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={1} className={`${input} sm:col-span-2`} /><button disabled={saving} className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ...' : 'إضافة الشريك'}</button></form><div className="grid gap-3 lg:grid-cols-2">{partners.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400 lg:col-span-2">لا توجد جهات مسجلة في نطاق الحساب.</div> : partners.map((partner) => <div key={partner.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-700">{partner.name}</h3><p className="mt-1 text-[11px] text-slate-400">{types[partner.type] || partner.type} · {partner.contact || 'دون جهة اتصال'}</p></div><button type="button" onClick={() => toggle(partner)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${partner.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{partner.status === 'ACTIVE' ? 'نشط' : 'غير نشط'}</button></div><p className="mt-3 text-xs text-slate-500">{partner.telephone || '—'} {partner.email ? `· ${partner.email}` : ''}</p></div>)}</div></div>
}
