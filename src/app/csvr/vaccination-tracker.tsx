'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { RABIES_ROUTE_LABELS, RABIES_VACCINE_LABELS, VACCINATION_STEP_STATUS_LABELS } from './rabies-vaccination'

interface VaccinationStep {
  id: string
  stepKey: string
  label: string
  status: string
  scheduledDate: string | null
  administeredDate: string | null
  vaccineType: string
  route: string
  lotNumber: string
  facility: string
  administeredBy: string
  notes: string
}

interface Props {
  biteCaseId: string
  reference: string
  onClose: () => void
}

const input = 'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100'

function dateInput(value: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : ''
}

export default function VaccinationTracker({ biteCaseId, reference, onClose }: Props) {
  const [steps, setSteps] = useState<VaccinationStep[]>([])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/bite-cases/${biteCaseId}/vaccinations`)
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر تحميل خطوات التلقيح'); return }
      setSteps(data.steps || [])
    } catch { toast.error('تعذر تحميل خطوات التلقيح') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [biteCaseId])

  const updateStep = (stepKey: string, field: keyof VaccinationStep, value: string) => {
    setSteps((current) => current.map((step) => step.stepKey === stepKey ? { ...step, [field]: value } : step))
  }

  const saveStep = async (step: VaccinationStep) => {
    setSavingKey(step.stepKey)
    try {
      const response = await fetch(`/api/bite-cases/${biteCaseId}/vaccinations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...step, scheduledDate: step.scheduledDate ? dateInput(step.scheduledDate) : null, administeredDate: step.administeredDate ? dateInput(step.administeredDate) : null }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر حفظ الخطوة'); return }
      toast.success('تم حفظ خطوة التلقيح')
      await load()
    } catch { toast.error('تعذر حفظ خطوة التلقيح') } finally { setSavingKey(null) }
  }

  const addManualStep = async () => {
    const stepKey = `FOLLOW_UP_${Date.now()}`
    setSavingKey(stepKey)
    try {
      const response = await fetch(`/api/bite-cases/${biteCaseId}/vaccinations`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepKey, label: 'متابعة إضافية', status: 'PLANNED' }),
      })
      if (!response.ok) { const data = await response.json().catch(() => ({})); toast.error(data.error || 'تعذر إضافة الخطوة'); return }
      await load()
    } catch { toast.error('تعذر إضافة الخطوة') } finally { setSavingKey(null) }
  }

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4" dir="rtl">
    <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <div className="flex items-center justify-between bg-gradient-to-l from-rose-800 to-red-600 px-5 py-4 text-white">
        <div><h3 className="text-base font-extrabold">🩺 تتبع الوقاية بعد التعرض</h3><p className="mt-1 text-[11px] text-rose-100">الحالة {reference} · سجل إداري وفق البروتوكول المعتمد من المرفق الصحي</p></div>
        <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-lg hover:bg-white/15">✕</button>
      </div>
      <div className="overflow-y-auto p-5">
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-6 text-amber-800">⚠️ هذه الشاشة لتوثيق الخطوات فقط. تصنيف التعرض، اختيار اللقاح، الغلوبولين المناعي، والمواعيد يحددها الطبيب أو المرفق الصحي وفق البروتوكول الوطني المعتمد؛ لا تعتبر المنصة بديلاً عن التقييم الطبي.</div>
        {loading ? <p className="p-8 text-center text-sm text-slate-400">جارٍ تحميل الخطوات...</p> : steps.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500"><p>لا توجد خطوات محفوظة لهذه الحالة.</p><button type="button" onClick={addManualStep} disabled={Boolean(savingKey)} className="mt-3 rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white">➕ إضافة خطوة يدوية</button></div> : <div className="space-y-3">{steps.map((step) => <div key={step.id || step.stepKey} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm text-slate-700">{step.label || step.stepKey}</strong><span className="mr-2 rounded-full bg-white px-2 py-1 text-[10px] text-slate-400">{step.stepKey}</span></div><button type="button" onClick={() => saveStep(step)} disabled={savingKey === step.stepKey} className="rounded-lg bg-rose-700 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">{savingKey === step.stepKey ? 'جارٍ الحفظ...' : 'حفظ الخطوة'}</button></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"><select value={step.status} onChange={(event) => updateStep(step.stepKey, 'status', event.target.value)} className={input}>{Object.entries(VACCINATION_STEP_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input type="date" value={dateInput(step.scheduledDate)} onChange={(event) => updateStep(step.stepKey, 'scheduledDate', event.target.value)} className={input} title="التاريخ المقرر" /><input type="date" value={dateInput(step.administeredDate)} onChange={(event) => updateStep(step.stepKey, 'administeredDate', event.target.value)} className={input} title="تاريخ التنفيذ" /><select value={step.vaccineType || ''} onChange={(event) => updateStep(step.stepKey, 'vaccineType', event.target.value)} className={input}><option value="">نوع اللقاح</option>{Object.entries(RABIES_VACCINE_LABELS).filter(([key]) => key !== 'UNKNOWN').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={step.route || ''} onChange={(event) => updateStep(step.stepKey, 'route', event.target.value)} className={input}><option value="">طريق الإعطاء</option>{Object.entries(RABIES_ROUTE_LABELS).filter(([key]) => key !== 'UNKNOWN').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={step.lotNumber || ''} onChange={(event) => updateStep(step.stepKey, 'lotNumber', event.target.value)} placeholder="رقم الدفعة" className={input} /><input value={step.facility || ''} onChange={(event) => updateStep(step.stepKey, 'facility', event.target.value)} placeholder="المرفق الصحي" className={input} /><input value={step.administeredBy || ''} onChange={(event) => updateStep(step.stepKey, 'administeredBy', event.target.value)} placeholder="المنفذ / المهني" className={input} /></div>
          <textarea value={step.notes || ''} onChange={(event) => updateStep(step.stepKey, 'notes', event.target.value)} placeholder="ملاحظات الخطوة" rows={2} className={`${input} mt-2 resize-none`} />
        </div>)}</div>}
        <button type="button" onClick={addManualStep} disabled={Boolean(savingKey)} className="mt-4 rounded-lg border border-rose-300 bg-white px-3 py-2 text-xs font-bold text-rose-700">➕ إضافة خطوة متابعة</button>
      </div>
    </div>
  </div>
}
