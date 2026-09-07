'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import { territoryCommuneName, useTerritoryCommunes } from '@/hooks/use-territory-communes'

const STATUS_LABELS: Record<string, string> = {
  NOUVEAU: 'جديد', ASSIGNE: 'مُسند', EN_ROUTE: 'في الطريق', EN_COURS: 'قيد الإنجاز', TERMINE: 'منجز', ANNULE: 'ملغى',
}

const STATUS_COLORS: Record<string, string> = {
  NOUVEAU: 'bg-slate-100 text-slate-700', ASSIGNE: 'bg-blue-50 text-blue-700', EN_ROUTE: 'bg-violet-50 text-violet-700', EN_COURS: 'bg-amber-50 text-amber-700', TERMINE: 'bg-emerald-50 text-emerald-700', ANNULE: 'bg-red-50 text-red-700',
}

const PRIORITY_LABELS: Record<string, string> = { URGENTE: 'عاجلة', HAUTE: 'عالية', NORMALE: 'عادية', BASSE: 'منخفضة' }

type Agent = { id: string; nom: string; prenom: string; telephone: string; fonction: string }
type ComplaintOption = { id: string; reference: string; nomCitoyen: string; adresse: string; commune: string; description: string }
type WorkOrderPhoto = { id: string; originalName: string; mimeType: string; size: number; type: string; caption: string | null; uploadedBy: string; createdAt: string }
type WorkOrder = {
  id: string; reference: string; commune: string; title: string; description: string; priority: string; status: string
  scheduledFor: string | null; dueAt: string | null; startedAt: string | null; completedAt: string | null; completionNotes: string | null; createdBy: string; createdAt: string
  assignedAgent: Agent | null; complaint: ComplaintOption | null
  intervention: { id: string; reference: string; type: string; adresse: string; statut: string } | null
  photos: WorkOrderPhoto[]
}

const initialForm = { commune: '', title: '', description: '', priority: 'NORMALE', assignedAgentId: '', complaintId: '', scheduledFor: '', dueAt: '' }

export default function WorkOrdersView() {
  const { selectedCommune, selectedYear, user, territoryFilter } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const { communes: scopedCommunes } = useTerritoryCommunes(territoryFilter, useTerritoryFilter)
  const scopedCommuneNames = useMemo(
    () => Array.from(new Set(scopedCommunes.map(territoryCommuneName).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'ar')),
    [scopedCommunes]
  )
  const accessibleCommuneNames = useMemo(() => {
    if (useTerritoryFilter) return scopedCommuneNames
    if (user?.managedCommunes?.length) return Array.from(new Set(user.managedCommunes))
    return user?.commune && user.commune !== 'ALL' ? [user.commune] : []
  }, [scopedCommuneNames, useTerritoryFilter, user?.commune, user?.managedCommunes])
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [complaints, setComplaints] = useState<ComplaintOption[]>([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(initialForm)

  const activeCommune = selectedCommune === 'ALL' ? '' : selectedCommune

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const orderParams = new URLSearchParams()
      if (activeCommune) orderParams.set('commune', activeCommune)
      if (useTerritoryFilter) appendTerritoryParams(orderParams, territoryFilter)
      if (selectedYear) orderParams.set('year', selectedYear)
      if (statusFilter !== 'ALL') orderParams.set('status', statusFilter)
      const complaintParams = new URLSearchParams()
      if (activeCommune) complaintParams.set('commune', activeCommune)
      if (useTerritoryFilter) appendTerritoryParams(complaintParams, territoryFilter)
      if (selectedYear) complaintParams.set('year', selectedYear)
      complaintParams.set('statut', 'EN_ATTENTE')
      const agentParams = new URLSearchParams(orderParams)
      agentParams.delete('status')
      agentParams.set('actif', 'true')
      const [ordersResponse, agentsResponse, complaintsResponse] = await Promise.all([
        fetch(`/api/work-orders?${orderParams.toString()}`),
        fetch(`/api/agents?${agentParams.toString()}`),
        fetch(`/api/complaints?${complaintParams.toString()}`),
      ])
      if (ordersResponse.ok) setWorkOrders((await ordersResponse.json()).workOrders || [])
      if (agentsResponse.ok) setAgents((await agentsResponse.json()).agents || [])
      if (complaintsResponse.ok) setComplaints((await complaintsResponse.json()).complaints || [])
    } catch {
      toast.error('تعذر تحميل أوامر العمل')
    } finally {
      setLoading(false)
    }
  }, [activeCommune, selectedYear, statusFilter, territoryFilter, useTerritoryFilter])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => {
    setForm((current) => {
      const commune = activeCommune || (!accessibleCommuneNames.includes(current.commune)
        ? (accessibleCommuneNames.length === 1 ? accessibleCommuneNames[0] : '')
        : current.commune)
      return commune === current.commune ? current : { ...current, commune }
    })
  }, [accessibleCommuneNames, activeCommune])

  const createWorkOrder = async () => {
    if (form.title.trim().length < 3) return toast.error('أدخل عنواناً واضحاً لأمر العمل')
    setSubmitting(true)
    try {
      const response = await fetch('/api/work-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, territoryFilter: useTerritoryFilter ? territoryFilter : undefined }) })
      const data = await response.json()
      if (!response.ok) return toast.error(data.error || 'تعذر إنشاء أمر العمل')
      toast.success('تم إنشاء أمر العمل')
      setShowCreate(false)
      setForm({ ...initialForm, commune: activeCommune || (accessibleCommuneNames.length === 1 ? accessibleCommuneNames[0] : '') })
      loadData()
    } catch {
      toast.error('تعذر الاتصال بالخدمة')
    } finally {
      setSubmitting(false)
    }
  }

  const updateStatus = async (workOrder: WorkOrder, status: string) => {
    try {
      const response = await fetch(`/api/work-orders/${workOrder.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
      const data = await response.json()
      if (!response.ok) return toast.error(data.error || 'تعذر تحديث الحالة')
      toast.success(`تم نقل أمر العمل إلى: ${STATUS_LABELS[status]}`)
      loadData()
    } catch {
      toast.error('تعذر الاتصال بالخدمة')
    }
  }

  const deletePhoto = async (photoId: string) => {
    try {
      const response = await fetch(`/api/work-orders/photos/${photoId}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) return toast.error(data.error || 'تعذر حذف الصورة')
      toast.success('تم حذف صورة التنفيذ')
      loadData()
    } catch {
      toast.error('تعذر الاتصال بالخدمة')
    }
  }

  const selectComplaint = (complaintId: string) => {
    const complaint = complaints.find((item) => item.id === complaintId)
    setForm((current) => ({
      ...current,
      complaintId,
      title: complaint && !current.title ? `معالجة الشكاية ${complaint.reference}` : current.title,
      description: complaint && !current.description ? complaint.description : current.description,
      commune: complaint?.commune || current.commune,
    }))
  }

  const counts = {
    open: workOrders.filter((item) => !['TERMINE', 'ANNULE'].includes(item.status)).length,
    inProgress: workOrders.filter((item) => ['EN_ROUTE', 'EN_COURS'].includes(item.status)).length,
    completed: workOrders.filter((item) => item.status === 'TERMINE').length,
  }

  return (
    <div className="space-y-5 p-4 pb-24 lg:p-6 lg:pb-6" dir="rtl">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-l from-indigo-950 via-slate-900 to-indigo-900 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold text-indigo-200">سير العمل الميداني</p><h1 className="mt-1 text-2xl font-black">أوامر العمل</h1><p className="mt-2 text-sm text-slate-300">حوّل الشكايات إلى مهام مسندة، وتابع التنفيذ من المكتب أو من الهاتف.</p></div>
        <div className="flex flex-wrap gap-2"><a href="/terrain" target="_blank" rel="noreferrer" className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold hover:bg-white/20">📱 الواجهة الميدانية</a><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-extrabold text-emerald-950 hover:bg-emerald-300">+ أمر عمل جديد</button></div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3"><Metric label="أوامر مفتوحة" value={counts.open} color="text-blue-700 bg-blue-50" /><Metric label="قيد الإنجاز" value={counts.inProgress} color="text-amber-700 bg-amber-50" /><Metric label="منجزة" value={counts.completed} color="text-emerald-700 bg-emerald-50" /></div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><label className="text-sm font-semibold text-slate-600">الحالة</label><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"><option value="ALL">كل الحالات</option>{Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select><button onClick={loadData} className="mr-auto rounded-xl px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-50">↻ تحديث</button></div>

      {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-slate-500">جارٍ تحميل أوامر العمل…</div> : workOrders.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><div className="text-4xl">🧭</div><h2 className="mt-3 font-extrabold text-slate-800">لا توجد أوامر عمل بهذه الحالة</h2><p className="mt-1 text-sm text-slate-500">أنشئ أمراً جديداً أو اربطه بشكاية واردة.</p></div> : <div className="grid gap-4 xl:grid-cols-2">
        {workOrders.map((workOrder) => <article key={workOrder.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-slate-400">{workOrder.reference}</p><h2 className="mt-1 text-base font-extrabold text-slate-900">{workOrder.title}</h2></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLORS[workOrder.status] || STATUS_COLORS.NOUVEAU}`}>{STATUS_LABELS[workOrder.status] || workOrder.status}</span></div>
          {workOrder.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{workOrder.description}</p>}
          <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2"><p>🏛️ {workOrder.commune}</p><p>👷 {workOrder.assignedAgent ? `${workOrder.assignedAgent.nom} ${workOrder.assignedAgent.prenom}` : 'غير مُسند'}</p>{workOrder.scheduledFor && <p>📅 {new Date(workOrder.scheduledFor).toLocaleString('ar-MA', { dateStyle: 'medium', timeStyle: 'short' })}</p>}<p>⚡ <span className={workOrder.priority === 'URGENTE' ? 'font-bold text-red-600' : ''}>{PRIORITY_LABELS[workOrder.priority] || workOrder.priority}</span></p></div>
          {deadlineLabel(workOrder) && <p className={`mt-3 rounded-xl px-3 py-2 text-xs font-bold ${deadlineLabel(workOrder)?.className}`}>⏱ {deadlineLabel(workOrder)?.text}</p>}
          {workOrder.complaint && <div className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">📢 شكاية {workOrder.complaint.reference}: {workOrder.complaint.adresse}</div>}
          {workOrder.completionNotes && <div className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-5 text-emerald-900">✓ {workOrder.completionNotes}</div>}
          {workOrder.photos?.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-bold text-slate-600">📷 أدلة التنفيذ ({workOrder.photos.length})</p><p className="text-[10px] text-slate-400">قبل / بعد</p></div><div className="flex flex-wrap gap-2">{workOrder.photos.map((photo) => <div key={photo.id} className="group relative"><a href={`/api/work-orders/photos/${photo.id}`} target="_blank" rel="noreferrer"><img src={`/api/work-orders/photos/${photo.id}`} alt={photo.caption || photo.originalName} className="h-16 w-16 rounded-lg border border-slate-200 object-cover" /></a><span className={`absolute bottom-1 right-1 rounded px-1 py-0.5 text-[9px] font-bold ${photo.type === 'BEFORE' ? 'bg-violet-600 text-white' : 'bg-emerald-600 text-white'}`}>{photo.type === 'BEFORE' ? 'قبل' : 'بعد'}</span><button onClick={() => deletePhoto(photo.id)} className="absolute -left-1 -top-1 hidden h-5 w-5 rounded-full bg-red-600 text-[11px] text-white shadow group-hover:block" aria-label="حذف الصورة">×</button></div>)}</div></div>}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{['NOUVEAU', 'ASSIGNE'].includes(workOrder.status) && <button onClick={() => updateStatus(workOrder, 'EN_ROUTE')} className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700">بدء التنقل</button>}{workOrder.status === 'EN_ROUTE' && <button onClick={() => updateStatus(workOrder, 'EN_COURS')} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-bold text-white hover:bg-amber-600">بدء الإنجاز</button>}{workOrder.status === 'EN_COURS' && <button onClick={() => updateStatus(workOrder, 'TERMINE')} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">تأكيد الإنجاز</button>}</div>
        </article>)}
      </div>}

      {showCreate && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-label="أمر عمل جديد"><div className="flex items-center justify-between"><h2 className="text-xl font-black">إنشاء أمر عمل</h2><button onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">✕</button></div><div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="العنوان *"><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} maxLength={160} className="field" /></Field>
        <Field label="الجماعة *"><select required value={form.commune} onChange={(event) => setForm({ ...form, commune: event.target.value })} disabled={user?.role !== 'admin'} className="field disabled:bg-slate-100">{accessibleCommuneNames.length !== 1 && <option value="">اختر الجماعة</option>}{accessibleCommuneNames.map((commune) => <option key={commune} value={commune}>{commune}</option>)}</select></Field>
        <Field label="الأولوية"><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className="field">{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
        <Field label="العون المكلف"><select value={form.assignedAgentId} onChange={(event) => setForm({ ...form, assignedAgentId: event.target.value })} className="field"><option value="">لاحقاً</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.nom} {agent.prenom}</option>)}</select></Field>
        <Field label="ربط بشكاية"><select value={form.complaintId} onChange={(event) => selectComplaint(event.target.value)} className="field"><option value="">بدون شكاية</option>{complaints.map((complaint) => <option key={complaint.id} value={complaint.id}>{complaint.reference} — {complaint.nomCitoyen}</option>)}</select></Field>
        <Field label="موعد التنفيذ"><input type="datetime-local" value={form.scheduledFor} onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })} className="field" /></Field>
        <Field label="آخر أجل (اختياري)"><input type="datetime-local" value={form.dueAt} onChange={(event) => setForm({ ...form, dueAt: event.target.value })} className="field" /></Field>
      </div><div className="mt-4"><Field label="التفاصيل"><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} maxLength={2000} rows={4} className="field resize-y" /></Field></div><div className="mt-6 flex gap-3"><button onClick={() => setShowCreate(false)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">إلغاء</button><button onClick={createWorkOrder} disabled={submitting} className="flex-1 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-800 disabled:opacity-60">{submitting ? 'جارٍ الإنشاء…' : 'إنشاء أمر العمل'}</button></div></div></div>}
    </div>
  )
}

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className={`rounded-2xl p-4 ${color}`}><p className="text-xs font-semibold opacity-80">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-sm font-semibold text-slate-700">{label}<span className="mt-1.5 block [&_.field]:w-full [&_.field]:rounded-xl [&_.field]:border [&_.field]:border-slate-300 [&_.field]:px-3 [&_.field]:py-2.5 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:outline-none [&_.field:focus]:border-indigo-500">{children}</span></label>
}

function deadlineLabel(workOrder: WorkOrder): { text: string; className: string } | null {
  if (!workOrder.dueAt || ['TERMINE', 'ANNULE'].includes(workOrder.status)) return null
  const remainingMinutes = Math.round((new Date(workOrder.dueAt).getTime() - Date.now()) / 60_000)
  const formattedDate = new Date(workOrder.dueAt).toLocaleString('ar-MA', { dateStyle: 'medium', timeStyle: 'short' })
  if (remainingMinutes < 0) return { text: `متأخر منذ ${Math.ceil(Math.abs(remainingMinutes) / 60)} ساعة · ${formattedDate}`, className: 'bg-red-50 text-red-700' }
  if (remainingMinutes <= 24 * 60) return { text: `ينتهي خلال ${Math.max(1, Math.ceil(remainingMinutes / 60))} ساعة · ${formattedDate}`, className: 'bg-amber-50 text-amber-800' }
  return { text: `آخر أجل: ${formattedDate}`, className: 'bg-slate-50 text-slate-600' }
}
