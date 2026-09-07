'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { COMMUNE_LABELS } from '@/lib/constants'
import { DEFAULT_SANITARY_SETTINGS, mergeSanitarySettings, type SanitarySettings } from './settings'

const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100'
const cloneDefaults = () => mergeSanitarySettings(DEFAULT_SANITARY_SETTINGS)

function Panel({ icon, title, description, children }: { icon: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-4 flex items-start gap-3"><span className="rounded-xl bg-teal-100 p-2 text-xl">{icon}</span><div><h3 className="text-sm font-extrabold text-slate-700">{title}</h3><p className="mt-1 text-xs text-slate-400">{description}</p></div></div>{children}</section>
}

export default function SanitarySettingsTab({ selectedCommune }: { selectedCommune: string }) {
  const { user } = useAppStore()
  const [settings, setSettings] = useState<SanitarySettings>(cloneDefaults())
  const [baseSettings, setBaseSettings] = useState<Record<string, unknown>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const managedCommunes = user?.managedCommunes?.length ? user.managedCommunes : user?.commune && user.commune !== 'ALL' ? [user.commune] : []
  const commune = selectedCommune !== 'ALL' ? selectedCommune : managedCommunes[0] || (user?.role === 'admin' ? 'ALL' : '')
  const update = <K extends keyof SanitarySettings>(key: K, value: SanitarySettings[K]) => setSettings((current) => ({ ...current, [key]: value }))

  useEffect(() => {
    if (!commune) { setLoading(false); return }
    setLoading(true)
    fetch(`/api/settings?commune=${encodeURIComponent(commune)}`).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setBaseSettings(data.settings || {})
      setSettings(mergeSanitarySettings(data.settings?.sanitary))
    }).catch((error) => toast.error(error instanceof Error ? error.message : 'تعذر تحميل إعدادات المراقبة الصحية')).finally(() => setLoading(false))
  }, [commune])

  const save = async () => {
    if (!commune) { toast.error('يرجى تحديد جماعة الحساب'); return }
    setSaving(true)
    try {
      const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commune, settings: { ...baseSettings, sanitary: settings } }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setBaseSettings(data.settings || {})
      toast.success('تم حفظ إعدادات المراقبة الصحية والسلامة الغذائية')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'فشل حفظ الإعدادات') } finally { setSaving(false) }
  }

  if (loading) return <div className="flex justify-center py-16"><div className="h-9 w-9 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" /></div>
  if (!commune) return <div className="py-16 text-center text-slate-400"><div className="text-4xl">⚙️</div><p className="mt-2 text-sm">يرجى تحديد جماعة الحساب</p></div>

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-teal-700 to-cyan-600 p-5 text-white shadow-lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">⚙️ إعدادات المراقبة الصحية والسلامة الغذائية</h2><p className="mt-1 text-xs text-teal-50">تهيئة سير العمل والتنبيهات والخريطة والتقارير حسب نطاق جماعة الحساب.</p></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">🏘️ {commune === 'ALL' ? 'كل الجماعات' : COMMUNE_LABELS[commune] || commune}</span></div></div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel icon="🎯" title="التشغيل والاستجابة" description="القيم الافتراضية لمعالجة السجلات الصحية."><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">الأولوية الافتراضية<select value={settings.operational.defaultPriority} onChange={(event) => update('operational', { ...settings.operational, defaultPriority: event.target.value })} className={`${input} mt-1`}><option value="FAIBLE">منخفضة</option><option value="NORMALE">عادية</option><option value="HAUTE">عالية</option><option value="URGENTE">عاجلة</option></select></label><label className="text-xs font-bold text-slate-600">هدف الاستجابة بالساعات<input type="number" min="1" max="720" value={settings.operational.responseTargetHours} onChange={(event) => update('operational', { ...settings.operational, responseTargetHours: Number(event.target.value) || 1 })} className={`${input} mt-1`} /></label></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.operational.requireLocation} onChange={(event) => update('operational', { ...settings.operational, requireLocation: event.target.checked })} /> إلزام تحديد الموقع</label><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.operational.requireEvidenceForClosure} onChange={(event) => update('operational', { ...settings.operational, requireEvidenceForClosure: event.target.checked })} /> دليل قبل الإغلاق</label></div></Panel>
      <Panel icon="🔔" title="التنبيهات" description="تحديد الأحداث التي تستحق متابعة داخل الحساب."><div className="grid gap-2 sm:grid-cols-2">{([['urgentAlerts', 'الحالات العاجلة'], ['inspectionReminders', 'تذكير التفتيشات'], ['sampleReminders', 'تذكير العينات'], ['expiryReminders', 'انتهاء البطاقات الصحية']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.notifications[key]} onChange={(event) => update('notifications', { ...settings.notifications, [key]: event.target.checked })} /> {label}</label>)}</div></Panel>
      <Panel icon="🔄" title="دورة المعالجة" description="تنظيم الانتقال بين المنشأة والتفتيش والنتيجة."><div className="grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.workflow.autoCreateInspection} onChange={(event) => update('workflow', { ...settings.workflow, autoCreateInspection: event.target.checked })} /> اقتراح تفتيش تلقائياً</label><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.workflow.lockClosedRecords} onChange={(event) => update('workflow', { ...settings.workflow, lockClosedRecords: event.target.checked })} /> قفل السجلات المغلقة</label><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600 sm:col-span-2"><input type="checkbox" checked={settings.workflow.requireClosureNote} onChange={(event) => update('workflow', { ...settings.workflow, requireClosureNote: event.target.checked })} /> إلزام ملاحظة عند الإغلاق</label></div></Panel>
      <Panel icon="📄" title="التقارير" description="توحيد المراجع ومحتوى المعاينة والتصدير."><div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-slate-600">بادئة المرجع<input value={settings.reporting.referencePrefix} onChange={(event) => update('reporting', { ...settings.reporting, referencePrefix: event.target.value })} className={`${input} mt-1`} /></label><label className="text-xs font-bold text-slate-600">الصيغة الافتراضية<select value={settings.reporting.defaultFormat} onChange={(event) => update('reporting', { ...settings.reporting, defaultFormat: event.target.value })} className={`${input} mt-1`}><option value="PDF">PDF</option><option value="CSV">CSV / Excel</option><option value="JSON">JSON</option></select></label></div><div className="mt-3 grid gap-2 sm:grid-cols-2"><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.reporting.includeCoordinates} onChange={(event) => update('reporting', { ...settings.reporting, includeCoordinates: event.target.checked })} /> الإحداثيات</label><label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.reporting.includeRiskSummary} onChange={(event) => update('reporting', { ...settings.reporting, includeRiskSummary: event.target.checked })} /> ملخص المخاطر</label></div></Panel>
    </div>
    <Panel icon="🗺️" title="إعدادات الخريطة الصحية" description="الطبقات الظاهرة افتراضياً عند فتح الخريطة وحدود الجماعة."><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"><label className="text-xs font-bold text-slate-600">مستوى التكبير<input type="number" min="5" max="19" value={settings.map.defaultZoom} onChange={(event) => update('map', { ...settings.map, defaultZoom: Number(event.target.value) || 13 })} className={`${input} mt-1`} /></label>{([['showBoundary', 'حدود الجماعة'], ['showEstablishments', 'المنشآت'], ['showInspections', 'التفتيشات'], ['showHealthCards', 'البطاقات الصحية'], ['showSamples', 'العينات']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-600"><input type="checkbox" checked={settings.map[key]} onChange={(event) => update('map', { ...settings.map, [key]: event.target.checked })} /> {label}</label>)}</div></Panel>
    <div className="flex justify-end"><button type="button" onClick={save} disabled={saving} className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ إعدادات الجماعة'}</button></div>
  </div>
}
