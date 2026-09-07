'use client'

import { useCallback, useEffect, useState } from 'react'

const STATUS_LABELS: Record<string, string> = {
  NOUVEAU: 'جديد', ASSIGNE: 'مُسند', EN_ROUTE: 'في الطريق', EN_COURS: 'قيد الإنجاز', TERMINE: 'منجز', ANNULE: 'ملغى',
}

type WorkOrder = {
  id: string
  reference: string
  commune: string
  title: string
  description: string
  priority: string
  status: string
  scheduledFor: string | null
  dueAt: string | null
  completionNotes: string | null
  assignedAgent: { nom: string; prenom: string } | null
  complaint: { reference: string; nomCitoyen: string; telephone: string | null; adresse: string; quartier: string | null; description: string; latitude: number | null; longitude: number | null } | null
  intervention: { reference: string; adresse: string } | null
  photos: { id: string; originalName: string; type: string; caption: string | null }[]
}

type FieldUser = { nom: string; commune: string; role: string }

function currentLocation(): Promise<{ latitude: number; longitude: number } | null> {
  if (!navigator.geolocation) return Promise.resolve(null)
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 },
    )
  })
}

export default function FieldAppPage() {
  const [user, setUser] = useState<FieldUser | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [completionOrder, setCompletionOrder] = useState<WorkOrder | null>(null)
  const [completionNotes, setCompletionNotes] = useState('')
  const [completionPhotos, setCompletionPhotos] = useState<File[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [authResponse, ordersResponse] = await Promise.all([fetch('/api/auth/me'), fetch('/api/work-orders')])
      if (!authResponse.ok) {
        setUser(null)
        return
      }
      const authData = await authResponse.json()
      setUser(authData.user)
      if (!ordersResponse.ok) throw new Error('orders')
      const orderData = await ordersResponse.json()
      setWorkOrders((orderData.workOrders || []).filter((order: WorkOrder) => order.status !== 'ANNULE'))
    } catch {
      setError('تعذر تحميل المهام. تحقق من الاتصال ثم أعد المحاولة.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const updateOrder = async (workOrder: WorkOrder, status: string, notes?: string): Promise<boolean> => {
    setBusyId(workOrder.id)
    setError('')
    try {
      const location = await currentLocation()
      const response = await fetch(`/api/work-orders/${workOrder.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(notes !== undefined && { completionNotes: notes }),
          ...(location || {}),
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'update')
      await loadData()
      return true
    } catch (updateError) {
      setError(updateError instanceof Error && updateError.message !== 'update' ? updateError.message : 'تعذر تحديث المهمة. حاول مجدداً.')
      return false
    } finally {
      setBusyId('')
    }
  }

  const uploadPhotos = async (workOrder: WorkOrder, files: File[], type: 'BEFORE' | 'AFTER'): Promise<boolean> => {
    const selectedFiles = files.slice(0, 4)
    if (!selectedFiles.length) return true
    if (selectedFiles.some((file) => file.size === 0 || file.size > 8 * 1024 * 1024)) {
      setError('يجب ألا يتجاوز حجم كل صورة 8 ميغابايت.')
      return false
    }

    setBusyId(workOrder.id)
    try {
      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('type', type)
        const response = await fetch(`/api/work-orders/${workOrder.id}/photos`, { method: 'POST', body: formData })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'upload')
      }
      await loadData()
      return true
    } catch (uploadError) {
      setError(uploadError instanceof Error && uploadError.message !== 'upload' ? uploadError.message : 'تعذر رفع صورة التنفيذ.')
      return false
    } finally {
      setBusyId('')
    }
  }

  const completeOrder = async () => {
    if (!completionOrder) return
    const completed = await updateOrder(completionOrder, 'TERMINE', completionNotes)
    if (!completed) return
    const uploaded = await uploadPhotos(completionOrder, completionPhotos, 'AFTER')
    if (uploaded) {
      setCompletionOrder(null)
      setCompletionNotes('')
      setCompletionPhotos([])
    }
  }

  if (!loading && !user) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-center text-white" dir="rtl"><div className="max-w-sm rounded-3xl bg-white/10 p-6"><div className="text-4xl">🔒</div><h1 className="mt-3 text-xl font-black">يلزم تسجيل الدخول</h1><p className="mt-2 text-sm leading-6 text-slate-300">واجهة الميدان مخصصة للفرق والمشرفين المسجلين في المنصة.</p><a href="/" className="mt-5 inline-block rounded-xl bg-emerald-400 px-4 py-2.5 font-bold text-emerald-950">الذهاب إلى تسجيل الدخول</a></div></main>
  }

  const activeOrders = workOrders.filter((order) => order.status !== 'TERMINE')
  const completedOrders = workOrders.filter((order) => order.status === 'TERMINE')

  return (
    <main className="min-h-screen bg-slate-100 pb-10 text-slate-900" dir="rtl">
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950 px-4 py-4 text-white shadow-lg">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3"><div><p className="text-xs font-semibold text-emerald-300">المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة · التطبيق الميداني</p><h1 className="text-lg font-black">مهامي اليوم</h1>{user && <p className="mt-0.5 text-xs text-slate-400">{user.nom} · {user.commune === 'ALL' ? 'كل الجماعات' : user.commune}</p>}</div><button onClick={loadData} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">↻ مزامنة</button></div>
      </header>

      <div className="mx-auto max-w-xl space-y-4 p-4">
        {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">{error}</div>}
        {loading ? <div className="rounded-2xl bg-white p-10 text-center text-slate-500">جارٍ مزامنة المهام…</div> : <>
          <div className="grid grid-cols-2 gap-3"><Stat label="مهام نشطة" value={activeOrders.length} color="bg-indigo-600" /><Stat label="مكتملة" value={completedOrders.length} color="bg-emerald-600" /></div>
          {activeOrders.length === 0 ? <div className="rounded-3xl bg-white p-9 text-center shadow-sm"><div className="text-4xl">✅</div><h2 className="mt-3 font-extrabold">لا توجد مهام نشطة</h2><p className="mt-1 text-sm text-slate-500">ستظهر أوامر العمل المسندة إليك هنا.</p></div> : activeOrders.map((order) => <FieldOrderCard key={order.id} order={order} busy={busyId === order.id} onRoute={() => updateOrder(order, 'EN_ROUTE')} onStart={() => updateOrder(order, 'EN_COURS')} onBeforePhoto={(files) => uploadPhotos(order, Array.from(files), 'BEFORE')} onComplete={() => { setCompletionOrder(order); setCompletionNotes(order.completionNotes || ''); setCompletionPhotos([]) }} />)}
          {completedOrders.length > 0 && <section><h2 className="px-1 pb-2 text-sm font-black text-slate-600">المهام المنجزة</h2><div className="space-y-2">{completedOrders.slice(0, 10).map((order) => <div key={order.id} className="rounded-2xl border border-emerald-100 bg-white p-4 text-sm"><div className="flex justify-between gap-2"><strong>{order.title}</strong><span className="font-bold text-emerald-700">✓ منجز</span></div><p className="mt-1 font-mono text-xs text-slate-400">{order.reference}</p></div>)}</div></section>}
        </>}
      </div>

      {completionOrder && <div className="fixed inset-0 z-50 flex items-end bg-slate-950/50 sm:items-center sm:justify-center sm:p-4"><div className="w-full max-w-md rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"><div className="flex items-center justify-between"><h2 className="text-lg font-black">إنهاء المهمة</h2><button onClick={() => setCompletionOrder(null)} className="rounded-lg p-2 text-slate-500">✕</button></div><p className="mt-2 text-sm text-slate-600">{completionOrder.title}</p><label className="mt-4 block text-sm font-bold">ملاحظات الإنجاز<textarea value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} maxLength={2000} rows={4} placeholder="ما الذي تم إنجازه؟" className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm font-normal outline-none focus:border-emerald-600" /></label><label className="mt-4 block rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">📷 صور بعد التنفيذ (حتى 4 صور)<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setCompletionPhotos(Array.from(event.target.files || []).slice(0, 4))} className="mt-2 block w-full text-xs font-normal text-slate-600" />{completionPhotos.length > 0 && <span className="mt-2 block text-xs font-normal">{completionPhotos.map((file) => file.name).join(' · ')}</span>}</label><p className="mt-2 text-xs leading-5 text-slate-500">سيتم تسجيل موقعك الحالي عند توفر الإذن، ثم إغلاق المهمة ورفع الصور بشكل خاص.</p><div className="mt-5 flex gap-3"><button onClick={() => setCompletionOrder(null)} className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold">إلغاء</button><button disabled={busyId === completionOrder.id} onClick={completeOrder} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{busyId === completionOrder.id ? 'جارٍ الحفظ…' : 'تأكيد الإنجاز'}</button></div></div></div>}
    </main>
  )
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className={`rounded-2xl p-4 text-white shadow-sm ${color}`}><p className="text-xs font-semibold text-white/75">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>
}

function FieldOrderCard({ order, busy, onRoute, onStart, onBeforePhoto, onComplete }: { order: WorkOrder; busy: boolean; onRoute: () => void; onStart: () => void; onBeforePhoto: (files: FileList) => void; onComplete: () => void }) {
  const location = order.complaint ? `${order.complaint.adresse}${order.complaint.quartier ? `، ${order.complaint.quartier}` : ''}` : order.intervention?.adresse
  const deadline = mobileDeadline(order)
  return <article className="overflow-hidden rounded-3xl bg-white shadow-sm"><div className="border-b border-slate-100 p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-slate-400">{order.reference}</p><h2 className="mt-1 text-lg font-black leading-7">{order.title}</h2></div><span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">{STATUS_LABELS[order.status] || order.status}</span></div>{order.priority === 'URGENTE' && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">⚡ أولوية عاجلة</p>}{deadline && <p className={`mt-3 rounded-lg px-3 py-2 text-xs font-bold ${deadline.className}`}>⏱ {deadline.text}</p>}{order.description && <p className="mt-3 text-sm leading-6 text-slate-600">{order.description}</p>}</div><div className="space-y-2 bg-slate-50 p-4 text-sm text-slate-700">{location && <p>📍 {location}</p>}{order.complaint?.telephone && <a href={`tel:${order.complaint.telephone}`} dir="ltr" className="block text-right font-bold text-emerald-700">☎ {order.complaint.telephone}</a>}{order.assignedAgent && <p className="text-xs text-slate-500">المسند إليه: {order.assignedAgent.nom} {order.assignedAgent.prenom}</p>}{order.photos?.length > 0 && <div className="flex gap-2 pt-1">{order.photos.slice(0, 4).map((photo) => <a key={photo.id} href={`/api/work-orders/photos/${photo.id}`} target="_blank" rel="noreferrer"><img src={`/api/work-orders/photos/${photo.id}`} alt={photo.caption || photo.originalName} className="h-12 w-12 rounded-lg border border-slate-200 object-cover" /></a>)}</div>}</div><div className="flex gap-2 p-4"><label className="flex-1 cursor-pointer rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-center text-xs font-bold text-violet-800">📷 صورة قبل التنفيذ<input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { if (event.target.files?.length) onBeforePhoto(event.target.files); event.currentTarget.value = '' }} className="hidden" /></label>{['NOUVEAU', 'ASSIGNE'].includes(order.status) && <button disabled={busy} onClick={onRoute} className="flex-1 rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{busy ? 'جارٍ التحديث…' : '🚗 في الطريق'}</button>}{order.status === 'EN_ROUTE' && <button disabled={busy} onClick={onStart} className="flex-1 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{busy ? 'جارٍ التحديث…' : '▶ بدء التنفيذ'}</button>}{order.status === 'EN_COURS' && <button disabled={busy} onClick={onComplete} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white disabled:opacity-60">{busy ? 'جارٍ التحديث…' : '✓ إنهاء المهمة'}</button>}</div></article>
}

function mobileDeadline(order: WorkOrder): { text: string; className: string } | null {
  if (!order.dueAt) return null
  const minutes = Math.round((new Date(order.dueAt).getTime() - Date.now()) / 60_000)
  if (minutes < 0) return { text: `متأخر منذ ${Math.ceil(Math.abs(minutes) / 60)} ساعة`, className: 'bg-red-50 text-red-700' }
  if (minutes <= 24 * 60) return { text: `المهلة المتبقية: ${Math.max(1, Math.ceil(minutes / 60))} ساعة`, className: 'bg-amber-50 text-amber-800' }
  return { text: `آخر أجل: ${new Date(order.dueAt).toLocaleString('ar-MA', { dateStyle: 'short', timeStyle: 'short' })}`, className: 'bg-slate-100 text-slate-700' }
}
