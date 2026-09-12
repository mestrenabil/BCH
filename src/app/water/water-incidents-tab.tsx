'use client'

import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import type { WaterIncident } from './types'
import LocationPicker from '../csvr/location-picker'

const TYPE_LABELS: Record<string, string> = {
  OUTAGE: 'انقطاع التزويد', CONTAMINATION: 'اشتباه تلوث', LOW_PRESSURE: 'انخفاض الضغط',
  PIPE_BURST: 'انفجار قناة', FLOOD: 'فيضان أو غمر', OTHER: 'حادث آخر',
}
const STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', INVESTIGATING: 'قيد التحقيق', RESPONDING: 'قيد الاستجابة', RESOLVED: 'تمت المعالجة', CLOSED: 'مغلق',
}
const inputClass = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-200'

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

function EmptyState() {
  return <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">⚠️ لا توجد حوادث مطابقة للفلاتر الحالية</div>
}

export default function WaterIncidentsTab({ incidents, loading, onRefresh, showCreate, setShowCreate, buildParams, allowedCommunes }: { incidents: WaterIncident[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void; buildParams: () => URLSearchParams; allowedCommunes: string[] }) {
  const { setCurrentView, setGisFocusLayer } = useAppStore()
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [severityFilter, setSeverityFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [form, setForm] = useState({
    commune: buildParams().get('commune') || '', quartier: '', adresse: '', latitude: '', longitude: '', incidentType: 'OUTAGE',
    severity: 'MEDIUM', description: '', affectedPopulation: '', affectedPoints: '', startedAt: new Date().toISOString().slice(0, 16),
    assignedTo: '', status: 'NEW', response: '',
  })
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const openCount = incidents.filter((incident) => !['RESOLVED', 'CLOSED'].includes(incident.status)).length
  const criticalCount = incidents.filter((incident) => incident.severity === 'CRITICAL' && !['RESOLVED', 'CLOSED'].includes(incident.status)).length
  const openInGis = () => {
    setGisFocusLayer('waterIncidents')
    setCurrentView('gis')
  }
  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [incident.reference, incident.description, incident.commune, incident.quartier, incident.adresse].some((value) => value.toLowerCase().includes(query))
    return matchesSearch && (statusFilter === 'ALL' || incident.status === statusFilter) && (severityFilter === 'ALL' || incident.severity === severityFilter) && (typeFilter === 'ALL' || incident.incidentType === typeFilter)
  }), [incidents, search, severityFilter, statusFilter, typeFilter])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.commune.trim() || form.commune === 'ALL' || !form.description.trim()) { toast.error('أدخل الجماعة ووصف الحادث'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/water-incidents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, latitude: form.latitude || null, longitude: form.longitude || null, affectedPopulation: form.affectedPopulation || 0, affectedPoints: form.affectedPoints || 0 }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'تعذر حفظ الحادث')
      toast.success(`تم تسجيل الحادث ${data.reference}`)
      setShowCreate(false)
      onRefresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر حفظ الحادث') } finally { setSaving(false) }
  }

  return <div className="space-y-4 rounded-2xl border border-rose-100 bg-rose-50/40 p-1" dir="rtl">
    <section className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-base font-extrabold text-rose-950">⚠️ سجل حوادث المياه والانقطاعات</h3><p className="mt-1 text-xs text-rose-800">تسجيل الحوادث الفعلية ومتابعة الاستجابة وعودة الخدمة داخل نطاق الجماعة.</p></div>
        <div className="flex flex-wrap items-center gap-2"><span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-700">{openCount} مفتوحة</span>{criticalCount > 0 && <span className="rounded-xl bg-red-700 px-3 py-2 text-xs font-bold text-white">{criticalCount} حرجة</span>}<button type="button" onClick={openInGis} className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">🗺️ فتح الخريطة</button><button type="button" onClick={onRefresh} disabled={loading} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">{loading ? 'جارٍ التحديث...' : '🔄 تحديث يدوي'}</button><button type="button" onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-800">{showCreate ? 'إلغاء' : '➕ تسجيل حادث'}</button></div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في المرجع أو الوصف أو الحي" className={inputClass} /><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className={inputClass}><option value="ALL">كل أنواع الحوادث</option>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className={inputClass}><option value="ALL">كل درجات الخطورة</option><option value="LOW">منخفض</option><option value="MEDIUM">متوسط</option><option value="HIGH">مرتفع</option><option value="CRITICAL">حرج</option></select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="ALL">كل الحالات</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
      {showCreate && <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-rose-100 bg-white p-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><input value={form.commune} onChange={(event) => update('commune', event.target.value)} placeholder="الجماعة *" className={inputClass} /><input value={form.quartier} onChange={(event) => update('quartier', event.target.value)} placeholder="الحي" className={inputClass} /><input value={form.adresse} onChange={(event) => update('adresse', event.target.value)} placeholder="العنوان" className={inputClass} /><select value={form.incidentType} onChange={(event) => update('incidentType', event.target.value)} className={inputClass}>{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={form.severity} onChange={(event) => update('severity', event.target.value)} className={inputClass}><option value="LOW">منخفض</option><option value="MEDIUM">متوسط</option><option value="HIGH">مرتفع</option><option value="CRITICAL">حرج</option></select><select value={form.status} onChange={(event) => update('status', event.target.value)} className={inputClass}>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="datetime-local" value={form.startedAt} onChange={(event) => update('startedAt', event.target.value)} aria-label="بداية الحادث" className={inputClass} /><input value={form.assignedTo} onChange={(event) => update('assignedTo', event.target.value)} placeholder="المسؤول عن الاستجابة" className={inputClass} /><input type="number" min="0" value={form.affectedPopulation} onChange={(event) => update('affectedPopulation', event.target.value)} placeholder="السكان المتضررون" className={inputClass} /><input type="number" min="0" value={form.affectedPoints} onChange={(event) => update('affectedPoints', event.target.value)} placeholder="النقاط المتأثرة" className={inputClass} /><input type="number" step="any" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} placeholder="خط العرض" className={inputClass} /><input type="number" step="any" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} placeholder="خط الطول" className={inputClass} /></div><div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-slate-700">📍 تحديد الجماعة والحي من الخريطة</p><p className="mt-0.5 text-[10px] text-slate-500">اختيار النقطة يملأ بيانات الموقع تلقائياً.</p></div><LocationPicker latitude={form.latitude} longitude={form.longitude} allowedCommunes={form.commune ? [form.commune] : allowedCommunes} label="تحديد الموقع" title="موقع حادث المياه" onSelect={({ latitude, longitude, commune, quartier }) => setForm((current) => ({ ...current, commune, quartier: quartier || current.quartier, latitude: String(latitude), longitude: String(longitude) }))} /></div></div><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="وصف الحادث *" rows={2} className={`${inputClass} resize-none`} /><textarea value={form.response} onChange={(event) => update('response', event.target.value)} placeholder="إجراءات الاستجابة أو إعادة الخدمة" rows={2} className={`${inputClass} resize-none`} /><button type="submit" disabled={saving} className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ حادث المياه'}</button></form>}
    </section>
    {loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الحوادث...</div> : filteredIncidents.length === 0 ? <EmptyState /> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{filteredIncidents.map((incident) => <div key={incident.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h4 className="font-extrabold text-slate-800">{TYPE_LABELS[incident.incidentType] || incident.incidentType}</h4><p className="mt-1 text-xs text-slate-500">{incident.reference} · {formatDate(incident.startedAt)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${incident.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : incident.severity === 'HIGH' ? 'bg-orange-100 text-orange-700' : incident.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-amber-100 text-amber-700'}`}>{incident.severity === 'CRITICAL' ? 'حرج' : incident.severity === 'HIGH' ? 'مرتفع' : STATUS_LABELS[incident.status] || incident.status}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600"><span>📍 جماعة {incident.commune} · {incident.quartier || 'بدون حي'}</span><span>👤 {incident.assignedTo || 'غير معين'}</span><span>👥 متضررون: {incident.affectedPopulation}</span><span>💧 نقاط متأثرة: {incident.affectedPoints}</span><span>📌 الحالة: {STATUS_LABELS[incident.status] || incident.status}</span><span>🗺️ {incident.latitude != null && incident.longitude != null ? `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}` : 'بدون إحداثيات'}</span></div><p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{incident.description}</p>{incident.response && <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">الاستجابة: {incident.response}</p>}</div>)}</div>}
  </div>
}
