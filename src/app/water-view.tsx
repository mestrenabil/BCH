'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type WaterSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import {
  WATER_POINT_TYPE_LABELS, WATER_POINT_TYPE_ICONS, WATER_POINT_STATUS_LABELS, WATER_POINT_STATUS_COLORS,
  WATER_MEAS_CONFORMITY_LABELS, WATER_MEAS_CONFORMITY_COLORS,
  POOL_TYPE_LABELS, POOL_TYPE_ICONS,
  SANITATION_TYPE_LABELS, SANITATION_TYPE_ICONS, SANITATION_STATUS_LABELS, SANITATION_STATUS_COLORS,
  SANITATION_RISK_LABELS, SANITATION_RISK_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { WaterPoint, WaterMeasurement, WaterSample, WaterInspection, WaterThreshold, WaterDevice, WaterAlert, WaterAction, WaterDisinfectionOperation, SanitationAsset, WaterEmergencyPlan, WaterIncident, WaterLaboratory, WaterMonitoringProgram, Pool, SanitationIncident, WaterDashboardMetrics } from './water/types'
import WaterMapTab from './water/map-tab'
import WaterIncidentsTab from './water/water-incidents-tab'
import WaterLaboratoriesTab from './water/water-laboratories-tab'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: WaterSubTab; label: string; icon: string; description: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊', description: 'مؤشرات نقاط المياه والقياسات والمسابح وحوادث الصرف.' },
  { id: 'map', label: 'الخريطة المائية', icon: '🗺️', description: 'عرض جغرافي لنقاط المياه والقياسات والمسابح وحوادث الصرف.' },
  { id: 'points', label: 'نقاط المياه', icon: '💧', description: 'جرد نقاط المياه ومواقعها ومشغليها وحالتها التشغيلية.' },
  { id: 'measurements', label: 'القياسات', icon: '🌡️', description: 'تسجيل وتتبع نتائج القياسات الفيزيائية والمخبرية للمياه.' },
  { id: 'samples', label: 'أخذ العينات', icon: '🧪', description: 'تسجيل العينات وتتبع سلسلة حيازتها من الجمع إلى المختبر.' },
  { id: 'inspections', label: 'المعاينات الميدانية', icon: '🔍', description: 'فحص نقاط المياه والمسابح وتقييم الخطر والإجراءات التصحيحية.' },
  { id: 'thresholds', label: 'المرجعيات والحدود', icon: '📐', description: 'ضبط حدود القياسات المحلية مع توثيق مصدرها وملاحظاتها.' },
  { id: 'devices', label: 'الأجهزة والمعايرة', icon: '🧰', description: 'تتبع أجهزة القياس وحالتها وشهادات المعايرة ومواعيدها.' },
  { id: 'alerts', label: 'التنبيهات والإجراءات', icon: '🚨', description: 'تجميع الحالات التي تتطلب تحققاً أو إجراءً أو متابعة.' },
  { id: 'reports', label: 'التقارير والتصدير', icon: '📊', description: 'تقارير شاملة قابلة للتنزيل والطباعة حول نشاط المكتب.' },
  { id: 'actions', label: 'التدخلات والمتابعة', icon: '🛠️', description: 'تعيين التدخلات ومتابعة التنفيذ والتحقق والإغلاق.' },
  { id: 'pools', label: 'المسابح', icon: '🏊', description: 'تتبع المسابح ومواقع السباحة ونتائج المراقبة.' },
  { id: 'sanitation', label: 'الصرف الصحي', icon: '🚿', description: 'رصد حوادث الصرف الصحي وتقييم المخاطر والإجراءات.' },
  { id: 'disinfection', label: 'سجل الكلورة والتطهير', icon: '🧴', description: 'تسجيل الجرعات والمواد ونتائج عمليات الكلورة والتطهير.' },
  { id: 'assets', label: 'أصول الصرف الصحي', icon: '🏗️', description: 'جرد المصارف ومحطات الضخ والخزانات ومواعيد الصيانة.' },
  { id: 'emergency', label: 'خطط الطوارئ', icon: '🆘', description: 'تدبير انقطاع المياه والتلوث والفيضانات ومصادر الإمداد البديلة.' },
  { id: 'incidents', label: 'حوادث المياه والانقطاعات', icon: '⚠️', description: 'تسجيل الحوادث الفعلية ومتابعة الاستجابة وعودة الخدمة.' },
  { id: 'laboratories', label: 'المختبرات والجهات المتعاونة', icon: '🧫', description: 'سجل المختبرات ونطاق التحاليل والاعتماد ومدة إنجاز النتائج.' },
  { id: 'programs', label: 'برامج الحملات', icon: '📣', description: 'تخطيط حملات المراقبة والتطهير وتتبع الإنجاز حسب المنطقة والفريق.' },
  { id: 'planning', label: 'البرمجة الدورية', icon: '📅', description: 'متابعة مواعيد أخذ العينات والمعاينات حسب دورية كل جماعة.' },
  { id: 'settings', label: 'إعدادات التطهير والمراقبة', icon: '⚙️', description: 'تهيئة دوريات المراقبة والتنبيهات ومتطلبات الإغلاق.' },
]

const TAB_GROUPS: { label: string; icon: string; description: string; panel: string; accent: string; ids: WaterSubTab[] }[] = [
  { label: 'نظرة عامة وميدانياً', icon: '🧭', description: 'المؤشرات والخريطة والسجلات الميدانية', panel: 'border-blue-200 bg-blue-50/60', accent: 'bg-blue-100 text-blue-700', ids: ['dashboard', 'map', 'points', 'measurements', 'samples', 'inspections', 'thresholds', 'devices', 'alerts', 'reports', 'actions'] },
  { label: 'التطهير والمراقبة', icon: '💧', description: 'المسابح وحوادث الصرف والأصول والكلورة والطوارئ والحملات', panel: 'border-sky-200 bg-sky-50/60', accent: 'bg-sky-100 text-sky-700', ids: ['pools', 'sanitation', 'assets', 'disinfection', 'emergency', 'incidents', 'laboratories', 'programs', 'planning', 'settings'] },
]

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

function WaterSideBySideLayout({ activeTab, onNavigate, children }: { activeTab: WaterSubTab; onNavigate: (tab: WaterSubTab) => void; children: React.ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openSidebarGroups, setOpenSidebarGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(TAB_GROUPS.map((group) => [group.label, true])))
  const contentTopRef = useRef<HTMLElement>(null)
  const previousTabRef = useRef(activeTab)
  const tab = TABS.find((entry) => entry.id === activeTab) || TABS[0]

  useEffect(() => {
    if (previousTabRef.current === activeTab) return
    previousTabRef.current = activeTab
    contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeTab])

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-sky-700 to-blue-700 p-4 text-white shadow-lg"><div className="flex flex-wrap items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15 text-2xl">{tab.icon}</span><div><p className="text-[10px] font-bold text-sky-100">الماء والتطهير الصحي · المكتب 03</p><h1 className="text-xl font-extrabold">{tab.label}</h1><p className="mt-1 text-xs text-sky-50">{tab.description}</p></div></div></div>
    <div className={`grid items-start gap-4 ${sidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
      <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1" onWheel={(event) => event.stopPropagation()}><div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${sidebarCollapsed ? 'p-2' : 'p-3'}`}><div className={`mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 ${sidebarCollapsed ? 'justify-center' : ''}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-lg">💧</span>{!sidebarCollapsed && <div className="min-w-0"><h2 className="text-sm font-extrabold text-slate-800">أقسام الماء والتطهير</h2><p className="mt-0.5 text-[10px] text-slate-500">اختر القسم المطلوب</p></div>}<button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="mr-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" aria-label={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'} title={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'}>{sidebarCollapsed ? '»' : '«'}</button></div><nav className="space-y-2" aria-label="أقسام الماء والتطهير">{TAB_GROUPS.map((group) => <section key={group.label} className={`rounded-xl border p-2 ${group.panel}`}><button type="button" onClick={() => setOpenSidebarGroups((current) => ({ ...current, [group.label]: !current[group.label] }))} aria-expanded={openSidebarGroups[group.label]} className={`mb-1.5 flex w-full items-center gap-1.5 rounded-lg px-1 text-right transition hover:bg-white/60 ${sidebarCollapsed ? 'justify-center' : ''}`} title={openSidebarGroups[group.label] ? 'طي المجموعة' : 'إظهار المجموعة'}><span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${group.accent}`}>{group.icon}</span>{!sidebarCollapsed && <span className="text-[11px] font-extrabold text-slate-700">{group.label}</span>}{!sidebarCollapsed && <span className="mr-auto text-[10px] text-slate-400">{openSidebarGroups[group.label] ? '⌃' : '⌄'}</span>}</button>{openSidebarGroups[group.label] && <div className="space-y-1">{group.ids.map((id) => { const entry = TABS.find((item) => item.id === id); if (!entry) return null; return <button key={entry.id} type="button" onClick={() => onNavigate(entry.id)} aria-label={entry.label} title={sidebarCollapsed ? entry.label : undefined} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-semibold transition-all ${sidebarCollapsed ? 'justify-center px-1' : ''} ${activeTab === entry.id ? 'bg-sky-600 text-white shadow-sm' : 'bg-white/85 text-slate-600 hover:bg-white hover:text-sky-700'}`}><span className="text-sm">{entry.icon}</span>{!sidebarCollapsed && <span>{entry.label}</span>}</button> })}</div>}</section>)}</nav></div></aside>
      <main ref={contentTopRef} className="min-w-0 scroll-mt-32"><div className="mb-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold text-sky-600">القسم الحالي</p><h2 className="mt-1 text-lg font-extrabold text-slate-800">{tab.label}</h2></div>{children}</main>
    </div>
  </div>
}

export default function WaterView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { waterSubTab, setWaterSubTab, user, selectedYear } = useAppStore()
  const [waterPoints, setWaterPoints] = useState<WaterPoint[]>([])
  const [measurements, setMeasurements] = useState<WaterMeasurement[]>([])
  const [samples, setSamples] = useState<WaterSample[]>([])
  const [inspections, setInspections] = useState<WaterInspection[]>([])
  const [thresholds, setThresholds] = useState<WaterThreshold[]>([])
  const [devices, setDevices] = useState<WaterDevice[]>([])
  const [alerts, setAlerts] = useState<WaterAlert[]>([])
  const [actions, setActions] = useState<WaterAction[]>([])
  const [disinfectionOperations, setDisinfectionOperations] = useState<WaterDisinfectionOperation[]>([])
  const [sanitationAssets, setSanitationAssets] = useState<SanitationAsset[]>([])
  const [emergencyPlans, setEmergencyPlans] = useState<WaterEmergencyPlan[]>([])
  const [waterIncidents, setWaterIncidents] = useState<WaterIncident[]>([])
  const [waterLaboratories, setWaterLaboratories] = useState<WaterLaboratory[]>([])
  const [monitoringPrograms, setMonitoringPrograms] = useState<WaterMonitoringProgram[]>([])
  const [pools, setPools] = useState<Pool[]>([])
  const [incidents, setIncidents] = useState<SanitationIncident[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<WaterDashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openSidebarGroups, setOpenSidebarGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(TAB_GROUPS.map((group) => [group.label, true])))
  const contentTopRef = useRef<HTMLElement>(null)
  const previousSubTabRef = useRef(waterSubTab)

  useEffect(() => {
    if (previousSubTabRef.current === waterSubTab) return
    previousSubTabRef.current = waterSubTab
    contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [waterSubTab])

  const selectWaterSection = useCallback((tab: WaterSubTab) => {
    setWaterSubTab(tab)
    window.setTimeout(() => contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }, [setWaterSubTab])

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    if (selectedYear) params.set('year', selectedYear)
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return params
  }, [selectedCommune, territoryFilter, useTerritoryFilter, selectedYear])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [wpRes, measRes, sampleRes, inspectionRes, thresholdRes, deviceRes, poolRes, incRes, alertRes, actionRes, disinfectionRes, assetsRes, emergencyRes, waterIncidentRes, laboratoryRes, programsRes, statsRes] = await Promise.allSettled([
        fetch(`/api/water-points?${buildParams()}`),
        fetch(`/api/water-measurements?${buildParams()}`),
        fetch(`/api/water-samples?${buildParams()}`),
        fetch(`/api/water-inspections?${buildParams()}`),
        fetch(`/api/water-thresholds?${buildParams()}`),
        fetch(`/api/water-devices?${buildParams()}`),
        fetch(`/api/pools?${buildParams()}`),
        fetch(`/api/sanitation-incidents?${buildParams()}`),
        fetch(`/api/water-alerts?${buildParams()}`),
        fetch(`/api/water-actions?${buildParams()}`),
        fetch(`/api/water-disinfection?${buildParams()}`),
        fetch(`/api/sanitation-assets?${buildParams()}`),
        fetch(`/api/water-emergency-plans?${buildParams()}`),
        fetch(`/api/water-incidents?${buildParams()}`),
        fetch(`/api/water-laboratories?${buildParams()}`),
        fetch(`/api/water-programs?${buildParams()}`),
        fetch(`/api/water/statistics?${buildParams()}`),
      ])
      if (wpRes.status === 'fulfilled' && wpRes.value.ok) { const d = await wpRes.value.json(); setWaterPoints(d.waterPoints || []) }
      if (measRes.status === 'fulfilled' && measRes.value.ok) { const d = await measRes.value.json(); setMeasurements(d.measurements || []) }
      if (sampleRes.status === 'fulfilled' && sampleRes.value.ok) { const d = await sampleRes.value.json(); setSamples(d.samples || []) }
      if (inspectionRes.status === 'fulfilled' && inspectionRes.value.ok) { const d = await inspectionRes.value.json(); setInspections(d.inspections || []) }
      if (thresholdRes.status === 'fulfilled' && thresholdRes.value.ok) { const d = await thresholdRes.value.json(); setThresholds(d.thresholds || []) }
      if (deviceRes.status === 'fulfilled' && deviceRes.value.ok) { const d = await deviceRes.value.json(); setDevices(d.devices || []) }
      if (poolRes.status === 'fulfilled' && poolRes.value.ok) { const d = await poolRes.value.json(); setPools(d.pools || []) }
      if (incRes.status === 'fulfilled' && incRes.value.ok) { const d = await incRes.value.json(); setIncidents(d.incidents || []) }
      if (alertRes.status === 'fulfilled' && alertRes.value.ok) { const d = await alertRes.value.json(); setAlerts(d.alerts || []) }
      if (actionRes.status === 'fulfilled' && actionRes.value.ok) { const d = await actionRes.value.json(); setActions(d.actions || []) }
      if (disinfectionRes.status === 'fulfilled' && disinfectionRes.value.ok) { const d = await disinfectionRes.value.json(); setDisinfectionOperations(d.operations || []) }
      if (assetsRes.status === 'fulfilled' && assetsRes.value.ok) { const d = await assetsRes.value.json(); setSanitationAssets(d.assets || []) }
      if (emergencyRes.status === 'fulfilled' && emergencyRes.value.ok) { const d = await emergencyRes.value.json(); setEmergencyPlans(d.plans || []) }
      if (waterIncidentRes.status === 'fulfilled' && waterIncidentRes.value.ok) { const d = await waterIncidentRes.value.json(); setWaterIncidents(d.incidents || []) }
      if (laboratoryRes.status === 'fulfilled' && laboratoryRes.value.ok) { const d = await laboratoryRes.value.json(); setWaterLaboratories(d.laboratories || []) }
      if (programsRes.status === 'fulfilled' && programsRes.value.ok) { const d = await programsRes.value.json(); setMonitoringPrograms(d.programs || []) }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) { const d = await statsRes.value.json(); setDashboardMetrics(d.metrics || null) }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => {
    const nonConfMeas = measurements.filter(m => m.conformity === 'NON_CONFORM').length
    const openIncidents = incidents.filter(i => i.status !== 'CLOSED').length
    const criticalInc = incidents.filter(i => i.riskLevel === 'CRITICAL' && i.status !== 'CLOSED').length
    return { nonConfMeas, openIncidents, criticalInc }
  }, [measurements, incidents])

  const accountCommunes = useMemo(() => {
    if (selectedCommune !== 'ALL') return [selectedCommune]
    if (user?.managedCommunes?.length) return Array.from(new Set(user.managedCommunes))
    if (user?.commune && user.commune !== 'ALL') return [user.commune]
    return []
  }, [selectedCommune, user?.commune, user?.managedCommunes])
  const activeTab = TABS.find((tab) => tab.id === waterSubTab) || TABS[0]
  if (waterSubTab === 'incidents') return <WaterSideBySideLayout activeTab={waterSubTab} onNavigate={selectWaterSection}><WaterIncidentsTab incidents={waterIncidents} loading={loading} onRefresh={refresh} showCreate={showCreate === 'water-incidents'} setShowCreate={(value) => setShowCreate(value ? 'water-incidents' : null)} buildParams={buildParams} /></WaterSideBySideLayout>
  if (waterSubTab === 'laboratories') return <WaterSideBySideLayout activeTab={waterSubTab} onNavigate={selectWaterSection}><WaterLaboratoriesTab laboratories={waterLaboratories} loading={loading} onRefresh={refresh} showCreate={showCreate === 'water-laboratories'} setShowCreate={(value) => setShowCreate(value ? 'water-laboratories' : null)} buildParams={buildParams} /></WaterSideBySideLayout>
  if (waterSubTab === 'settings') return <WaterSideBySideLayout activeTab={waterSubTab} onNavigate={selectWaterSection}><WaterSettingsTab selectedCommune={selectedCommune} /></WaterSideBySideLayout>
  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-sky-700 to-blue-700 p-4 sm:p-5 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl"><span className="text-2xl sm:text-3xl">💧</span> الماء والتطهير الصحي</h1><p className="mt-0.5 text-xs text-sky-50 sm:text-sm">نظام موحّد لتدبير نقاط المياه والقياسات والمسابح وحوادث الصرف الصحي — المكتب 03</p></div><div className="flex flex-wrap items-center gap-1.5 sm:gap-2"><div className="rounded-xl bg-white/15 px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{waterPoints.length}</div><div className="mt-0.5 text-[10px] opacity-80">نقطة مياه</div></div><div className="rounded-xl bg-white/15 px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{measurements.length}</div><div className="mt-0.5 text-[10px] opacity-80">قياس</div></div>{stats.nonConfMeas > 0 && <div className="rounded-xl border border-white/20 bg-red-900/30 px-3 py-1.5 text-center"><div className="text-lg font-black leading-none text-red-100">{stats.nonConfMeas}</div><div className="mt-0.5 text-[10px] opacity-80">غير مطابق</div></div>}{stats.openIncidents > 0 && <div className="rounded-xl border border-white/20 bg-amber-900/30 px-3 py-1.5 text-center"><div className="text-lg font-black leading-none text-amber-100">{stats.openIncidents}</div><div className="mt-0.5 text-[10px] opacity-80">حادث مفتوح</div></div>}</div></div></div>
    <div className={`grid items-start gap-4 ${sidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
      <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1" onWheel={(event) => event.stopPropagation()}><div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${sidebarCollapsed ? 'p-2' : 'p-3'}`}><div className={`mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 ${sidebarCollapsed ? 'justify-center' : ''}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-100 text-lg">💧</span>{!sidebarCollapsed && <div className="min-w-0"><h2 className="text-sm font-extrabold text-slate-800">أقسام الماء والتطهير</h2><p className="mt-0.5 text-[10px] text-slate-500">اختر القسم المطلوب</p></div>}<button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="mr-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700" aria-label={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'} title={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'}>{sidebarCollapsed ? '»' : '«'}</button></div><nav className="space-y-2" aria-label="أقسام الماء والتطهير">{TAB_GROUPS.map((group) => <section key={group.label} className={`rounded-xl border p-2 ${group.panel}`}><button type="button" onClick={() => setOpenSidebarGroups((current) => ({ ...current, [group.label]: !current[group.label] }))} aria-expanded={openSidebarGroups[group.label]} className={`mb-1.5 flex w-full items-center gap-1.5 rounded-lg px-1 text-right transition hover:bg-white/60 ${sidebarCollapsed ? 'justify-center' : ''}`} title={openSidebarGroups[group.label] ? 'طي المجموعة' : 'إظهار المجموعة'}><span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${group.accent}`}>{group.icon}</span>{!sidebarCollapsed && <span className="text-[11px] font-extrabold text-slate-700">{group.label}</span>}{!sidebarCollapsed && <span className="mr-auto text-[10px] text-slate-400">{openSidebarGroups[group.label] ? '⌃' : '⌄'}</span>}</button>{openSidebarGroups[group.label] && <div className="space-y-1">{group.ids.map((id) => { const tab = TABS.find((entry) => entry.id === id); if (!tab) return null; return <button key={tab.id} type="button" onClick={() => selectWaterSection(tab.id)} aria-label={tab.label} title={sidebarCollapsed ? tab.label : undefined} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-semibold transition-all ${sidebarCollapsed ? 'justify-center px-1' : ''} ${waterSubTab === tab.id ? 'bg-sky-600 text-white shadow-sm' : 'bg-white/85 text-slate-600 hover:bg-white hover:text-sky-700'}`}><span className="text-sm">{tab.icon}</span>{!sidebarCollapsed && <span>{tab.label}</span>}</button> })}</div>}</section>)}</nav></div></aside>
<main ref={contentTopRef} className="min-w-0 scroll-mt-32">{waterSubTab !== 'map' && <div className="mb-3 rounded-2xl bg-gradient-to-l from-sky-700 to-blue-700 p-4 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl">{activeTab.icon}</span><div className="min-w-0"><p className="text-[10px] font-bold text-sky-100">الماء والتطهير الصحي · المكتب 03</p><h2 className="truncate text-base font-extrabold sm:text-lg">{activeTab.label}</h2><p className="mt-1 text-xs text-sky-50">{activeTab.description}</p></div></div><span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold">القسم الحالي</span></div></div>}<AnimatePresence mode="wait"><motion.div key={waterSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>{waterSubTab === 'dashboard' && <DashboardTab waterPoints={waterPoints} measurements={measurements} samples={samples} pools={pools} incidents={incidents} dashboardMetrics={dashboardMetrics} onNavigate={selectWaterSection} />}{waterSubTab === 'map' && <WaterMapTab selectedCommune={selectedCommune} territoryFilter={territoryFilter} useTerritoryFilter={useTerritoryFilter} allowedCommunes={accountCommunes} />}{waterSubTab === 'points' && <PointsTab waterPoints={waterPoints} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'point'} setShowCreate={(v) => setShowCreate(v ? 'point' : null)} />}{waterSubTab === 'measurements' && <MeasurementsTab measurements={measurements} waterPoints={waterPoints} samples={samples} devices={devices} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'meas'} setShowCreate={(v) => setShowCreate(v ? 'meas' : null)} />}{waterSubTab === 'samples' && <SamplesTab samples={samples} waterPoints={waterPoints} pools={pools} loading={loading} onRefresh={refresh} showCreate={showCreate === 'sample'} setShowCreate={(v) => setShowCreate(v ? 'sample' : null)} />}{waterSubTab === 'inspections' && <InspectionsTab inspections={inspections} samples={samples} waterPoints={waterPoints} pools={pools} loading={loading} onRefresh={refresh} showCreate={showCreate === 'inspection'} setShowCreate={(v) => setShowCreate(v ? 'inspection' : null)} />}{waterSubTab === 'thresholds' && <ThresholdsTab thresholds={thresholds} loading={loading} onRefresh={refresh} buildParams={buildParams} />}{waterSubTab === 'devices' && <DevicesTab devices={devices} waterPoints={waterPoints} loading={loading} onRefresh={refresh} buildParams={buildParams} />}{waterSubTab === 'alerts' && <AlertsTab alerts={alerts} onNavigate={selectWaterSection} onRefresh={refresh} />}{waterSubTab === 'reports' && <WaterReportsTab waterPoints={waterPoints} measurements={measurements} samples={samples} inspections={inspections} devices={devices} pools={pools} incidents={incidents} alerts={alerts} />}{waterSubTab === 'actions' && <ActionsTab actions={actions} waterPoints={waterPoints} pools={pools} inspections={inspections} samples={samples} incidents={incidents} onRefresh={refresh} />}{waterSubTab === 'pools' && <PoolsTab pools={pools} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'pool'} setShowCreate={(v) => setShowCreate(v ? 'pool' : null)} />}{waterSubTab === 'sanitation' && <SanitationTab incidents={incidents} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'inc'} setShowCreate={(v) => setShowCreate(v ? 'inc' : null)} />}{waterSubTab === 'disinfection' && <DisinfectionTab operations={disinfectionOperations} waterPoints={waterPoints} pools={pools} loading={loading} onRefresh={refresh} showCreate={showCreate === 'disinfection'} setShowCreate={(v) => setShowCreate(v ? 'disinfection' : null)} />}{waterSubTab === 'assets' && <AssetsTab assets={sanitationAssets} loading={loading} onRefresh={refresh} showCreate={showCreate === 'assets'} setShowCreate={(v) => setShowCreate(v ? 'assets' : null)} buildParams={buildParams} />}{waterSubTab === 'emergency' && <EmergencyTab plans={emergencyPlans} loading={loading} onRefresh={refresh} showCreate={showCreate === 'emergency'} setShowCreate={(v) => setShowCreate(v ? 'emergency' : null)} buildParams={buildParams} />}{waterSubTab === 'programs' && <ProgramsTab programs={monitoringPrograms} loading={loading} onRefresh={refresh} showCreate={showCreate === 'programs'} setShowCreate={(v) => setShowCreate(v ? 'programs' : null)} buildParams={buildParams} />}{waterSubTab === 'planning' && <PlanningTab waterPoints={waterPoints} pools={pools} samples={samples} inspections={inspections} selectedCommune={selectedCommune} onNavigate={selectWaterSection} />}</motion.div></AnimatePresence></main>
    </div>
  </div>
}

const DEFAULT_WATER_SETTINGS = {
  samplingFrequencyDays: 30,
  inspectionFrequencyDays: 30,
  alertLeadDays: 7,
  defaultDisinfectant: 'الكلور الحر',
  defaultPriority: 'NORMAL',
  responsibleService: 'مصلحة الماء والتطهير الصحي',
  requireEvidencePhoto: false,
  requireClosureNote: true,
  enableAutomaticReminders: true,
}

function WaterSettingsTab({ selectedCommune }: { selectedCommune: string }) {
  const { setWaterSubTab } = useAppStore()
  const [settings, setSettings] = useState(DEFAULT_WATER_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/water/settings?commune=${encodeURIComponent(selectedCommune)}`).then((response) => response.ok ? response.json() : null).then((data) => { if (!cancelled && data?.settings) setSettings({ ...DEFAULT_WATER_SETTINGS, ...data.settings }) }).catch(() => undefined).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [selectedCommune])
  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch('/api/water/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commune: selectedCommune, settings }) })
      const data = await response.json().catch(() => null)
      if (!response.ok) { toast.error(data?.error || 'تعذر حفظ الإعدادات'); return }
      setSettings({ ...DEFAULT_WATER_SETTINGS, ...data.settings })
      toast.success('تم حفظ إعدادات التطهير والمراقبة')
    } catch { toast.error('حدث خطأ أثناء حفظ الإعدادات') } finally { setSaving(false) }
  }
  const update = (key: keyof typeof DEFAULT_WATER_SETTINGS, value: string | number | boolean) => setSettings((current) => ({ ...current, [key]: value }))
  return <div className="space-y-4" dir="rtl"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-l from-sky-800 to-blue-700 p-5 text-white shadow-lg"><div><h2 className="text-xl font-extrabold">⚙️ إعدادات التطهير والمراقبة</h2><p className="mt-1 text-xs text-sky-100">إعدادات تشغيلية محفوظة حسب جماعة الحساب ولا تغيّر صلاحيات المستخدم.</p></div><button type="button" onClick={() => setWaterSubTab('sanitation')} className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold hover:bg-white/25">← العودة إلى السجل</button></div><form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><label className="space-y-1 text-xs font-bold text-slate-700"><span>دورية أخذ العينات (يوم)</span><input type="number" min={1} max={365} value={settings.samplingFrequencyDays} onChange={(event) => update('samplingFrequencyDays', Number(event.target.value))} className={inp} /></label><label className="space-y-1 text-xs font-bold text-slate-700"><span>دورية المعاينات (يوم)</span><input type="number" min={1} max={365} value={settings.inspectionFrequencyDays} onChange={(event) => update('inspectionFrequencyDays', Number(event.target.value))} className={inp} /></label><label className="space-y-1 text-xs font-bold text-slate-700"><span>التنبيه قبل الموعد (يوم)</span><input type="number" min={1} max={90} value={settings.alertLeadDays} onChange={(event) => update('alertLeadDays', Number(event.target.value))} className={inp} /></label></div><div className="grid grid-cols-1 gap-3 md:grid-cols-3"><label className="space-y-1 text-xs font-bold text-slate-700"><span>المطهر الافتراضي</span><input value={settings.defaultDisinfectant} onChange={(event) => update('defaultDisinfectant', event.target.value)} className={inp} /></label><label className="space-y-1 text-xs font-bold text-slate-700"><span>أولوية الإجراء الافتراضية</span><select value={settings.defaultPriority} onChange={(event) => update('defaultPriority', event.target.value)} className={inp}><option value="LOW">منخفضة</option><option value="NORMAL">عادية</option><option value="HIGH">عالية</option><option value="URGENT">عاجلة</option></select></label><label className="space-y-1 text-xs font-bold text-slate-700"><span>المصلحة المسؤولة</span><input value={settings.responsibleService} onChange={(event) => update('responsibleService', event.target.value)} className={inp} /></label></div><div className="grid grid-cols-1 gap-2 md:grid-cols-3"><label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={settings.enableAutomaticReminders} onChange={(event) => update('enableAutomaticReminders', event.target.checked)} /> تفعيل التذكيرات التلقائية</label><label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={settings.requireClosureNote} onChange={(event) => update('requireClosureNote', event.target.checked)} /> إلزام ملاحظة الإغلاق</label><label className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={settings.requireEvidencePhoto} onChange={(event) => update('requireEvidencePhoto', event.target.checked)} /> طلب صورة إثبات عند الإغلاق</label></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3"><p className="text-[11px] text-slate-500">{loading ? 'جارٍ تحميل الإعدادات...' : `النطاق: ${selectedCommune === 'ALL' ? 'كل الجماعات' : `جماعة ${selectedCommune}`}`}</p><button type="submit" disabled={saving || loading} className="rounded-xl bg-sky-700 px-5 py-2.5 text-xs font-bold text-white hover:bg-sky-800 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ الإعدادات'}</button></div></form></div>
}

const SANITATION_ASSET_TYPE_LABELS: Record<string, string> = { SEWER_LINE: 'قناة صرف صحي', DRAIN: 'بالوعة / مصرف', PUMP_STATION: 'محطة ضخ', TANK: 'خزان', TREATMENT_PLANT: 'محطة معالجة' }
const EMERGENCY_TYPE_LABELS: Record<string, string> = { CONTAMINATION: 'تلوث مائي', OUTAGE: 'انقطاع التزويد', FLOOD: 'فيضان', SHORTAGE: 'نقص المياه', OTHER: 'طارئ آخر' }
const PROGRAM_TYPE_LABELS: Record<string, string> = { QUALITY: 'جودة المياه', DISINFECTION: 'التطهير والكلورة', SANITATION: 'الصرف الصحي', POOL: 'مراقبة المسابح', EMERGENCY: 'الطوارئ' }
const DISINFECTION_TYPE_LABELS: Record<string, string> = { CHLORINATION: 'كلورة عادية', DISINFECTION: 'تطهير', SHOCK: 'كلورة صادمة' }

function ProgramsTab({ programs, loading, onRefresh, showCreate, setShowCreate, buildParams }: { programs: WaterMonitoringProgram[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void; buildParams: () => URLSearchParams }) {
  const { submit, saving } = useCreateModal('/api/water-programs', () => { setShowCreate(false); onRefresh() })
  const activePrograms = programs.filter((program) => program.status === 'ACTIVE').length
  return <div className="space-y-4" dir="rtl"><div className="rounded-2xl border border-violet-100 bg-violet-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-violet-950">📣 برامج الحملات الدورية</h3><p className="mt-1 text-xs text-violet-800">تخطيط حملات المراقبة والتطهير وتتبع الهدف والإنجاز حسب الجماعة والفريق.</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-violet-700">{activePrograms} نشطة</span><button type="button" onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white hover:bg-violet-800">{showCreate ? 'إلغاء' : '➕ برنامج جديد'}</button></div></div>{showCreate && <ProgramForm buildParams={buildParams} onSubmit={submit} saving={saving} />}</div>{loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل البرامج...</div> : programs.length === 0 ? <Empty icon="📣" text="لا توجد برامج حملات مسجلة" /> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{programs.map((program) => { const progress = program.targetCount ? Math.min(100, Math.round((program.completedCount / program.targetCount) * 100)) : 0; return <div key={program.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h4 className="font-extrabold text-slate-800">{program.name}</h4><p className="mt-1 text-xs text-slate-500">{program.reference} · {PROGRAM_TYPE_LABELS[program.programType] || program.programType}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${program.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : program.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' : program.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>{program.status === 'ACTIVE' ? 'نشط' : program.status === 'COMPLETED' ? 'منجز' : program.status === 'CANCELLED' ? 'ملغى' : 'مبرمج'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600"><span>📍 جماعة {program.commune}</span><span>📌 المنطقة: {program.targetArea || 'كل النطاق'}</span><span>👥 الفريق: {program.team || 'غير محدد'}</span><span>👤 المسؤول: {program.responsible || 'غير محدد'}</span><span>📅 من: {fmtDate(program.startDate)}</span><span>⏭️ إلى: {fmtDate(program.endDate)}</span></div>{program.targetCount != null && <div className="mt-3"><div className="flex justify-between text-[11px] text-slate-500"><span>الإنجاز</span><span>{program.completedCount} / {program.targetCount} ({progress}%)</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${progress}%` }} /></div></div>}{program.objective && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">الهدف: {program.objective}</p>}</div>})}</div>}</div>
}

function ProgramForm({ buildParams, onSubmit, saving }: { buildParams: () => URLSearchParams; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({ name: '', commune: buildParams().get('commune') || '', programType: 'QUALITY', objective: '', targetArea: '', responsible: '', team: '', status: 'PLANNED', startDate: '', endDate: '', frequencyDays: '', targetCount: '', notes: '' })
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.name.trim() || !form.commune.trim() || form.commune === 'ALL') { toast.error('أدخل اسم البرنامج والجماعة المعنية'); return }; onSubmit({ ...form, startDate: form.startDate || null, endDate: form.endDate || null, frequencyDays: form.frequencyDays || null, targetCount: form.targetCount || null }) }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-violet-100 bg-white p-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="اسم البرنامج *" className={inp} /><input value={form.commune} onChange={(event) => update('commune', event.target.value)} placeholder="الجماعة *" className={inp} /><select value={form.programType} onChange={(event) => update('programType', event.target.value)} className={inp}>{Object.entries(PROGRAM_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={form.targetArea} onChange={(event) => update('targetArea', event.target.value)} placeholder="المنطقة المستهدفة" className={inp} /><input value={form.responsible} onChange={(event) => update('responsible', event.target.value)} placeholder="المسؤول" className={inp} /><input value={form.team} onChange={(event) => update('team', event.target.value)} placeholder="الفريق" className={inp} /><select value={form.status} onChange={(event) => update('status', event.target.value)} className={inp}><option value="PLANNED">مبرمج</option><option value="ACTIVE">نشط</option><option value="COMPLETED">منجز</option><option value="CANCELLED">ملغى</option></select><input type="date" value={form.startDate} onChange={(event) => update('startDate', event.target.value)} aria-label="تاريخ البداية" className={inp} /><input type="date" value={form.endDate} onChange={(event) => update('endDate', event.target.value)} aria-label="تاريخ النهاية" className={inp} /><input type="number" min="1" value={form.frequencyDays} onChange={(event) => update('frequencyDays', event.target.value)} placeholder="الدورية بالأيام" className={inp} /><input type="number" min="0" value={form.targetCount} onChange={(event) => update('targetCount', event.target.value)} placeholder="الهدف العددي" className={inp} /></div><textarea value={form.objective} onChange={(event) => update('objective', event.target.value)} placeholder="هدف البرنامج" rows={2} className={`${inp} resize-none`} /><button type="submit" disabled={saving} className="rounded-xl bg-violet-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ البرنامج'}</button></form>
}

function EmergencyTab({ plans, loading, onRefresh, showCreate, setShowCreate, buildParams }: { plans: WaterEmergencyPlan[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void; buildParams: () => URLSearchParams }) {
  const { submit, saving } = useCreateModal('/api/water-emergency-plans', () => { setShowCreate(false); onRefresh() })
  const activePlans = plans.filter((plan) => plan.status === 'ACTIVE' || plan.status === 'MONITORING').length
  return <div className="space-y-4" dir="rtl"><div className="rounded-2xl border border-red-100 bg-red-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-red-950">🆘 خطط الطوارئ واستمرارية التزويد</h3><p className="mt-1 text-xs text-red-800">توثيق خطة الاستجابة والبديل والتواصل عند انقطاع المياه أو التلوث أو الفيضانات.</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-red-700">{activePlans} نشطة</span><button type="button" onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800">{showCreate ? 'إلغاء' : '➕ خطة طوارئ جديدة'}</button></div></div>{showCreate && <EmergencyForm buildParams={buildParams} onSubmit={submit} saving={saving} />}</div>{loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الخطط...</div> : plans.length === 0 ? <Empty icon="🆘" text="لا توجد خطط طوارئ مسجلة" /> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{plans.map((plan) => <div key={plan.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h4 className="font-extrabold text-slate-800">{plan.title}</h4><p className="mt-1 text-xs text-slate-500">{plan.reference} · {EMERGENCY_TYPE_LABELS[plan.planType] || plan.planType}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${plan.status === 'ACTIVE' ? 'bg-red-100 text-red-700' : plan.status === 'MONITORING' ? 'bg-amber-100 text-amber-700' : plan.status === 'CLOSED' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-700'}`}>{plan.status === 'ACTIVE' ? 'نشطة' : plan.status === 'MONITORING' ? 'تحت المراقبة' : plan.status === 'CLOSED' ? 'مغلقة' : 'مسودة'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600"><span>📍 جماعة {plan.commune}</span><span>⚠️ مستوى الخطر: {plan.riskLevel}</span><span>👤 المسؤول: {plan.responsible || 'غير محدد'}</span><span>⏭️ الإغلاق المستهدف: {fmtDate(plan.targetCloseAt)}</span><span className="col-span-2">🔁 البديل: {plan.alternativeSource || 'لم يحدد'}</span></div>{plan.measures && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">التدابير: {plan.measures}</p>}{plan.communicationNote && <p className="mt-2 rounded-xl bg-blue-50 p-3 text-xs text-blue-800">التواصل: {plan.communicationNote}</p>}</div>)}</div>}</div>
}

function EmergencyForm({ buildParams, onSubmit, saving }: { buildParams: () => URLSearchParams; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({ title: '', commune: buildParams().get('commune') || '', planType: 'CONTAMINATION', trigger: '', riskLevel: 'HIGH', status: 'DRAFT', responsible: '', alternativeSource: '', activatedAt: '', targetCloseAt: '', measures: '', communicationNote: '', notes: '' })
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.title.trim() || !form.commune.trim() || form.commune === 'ALL') { toast.error('أدخل عنوان الخطة والجماعة المعنية'); return }; onSubmit({ ...form, activatedAt: form.activatedAt || null, targetCloseAt: form.targetCloseAt || null }) }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-red-100 bg-white p-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><input value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="عنوان الخطة *" className={inp} /><input value={form.commune} onChange={(event) => update('commune', event.target.value)} placeholder="الجماعة *" className={inp} /><select value={form.planType} onChange={(event) => update('planType', event.target.value)} className={inp}>{Object.entries(EMERGENCY_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={form.trigger} onChange={(event) => update('trigger', event.target.value)} placeholder="سبب التفعيل" className={inp} /><select value={form.riskLevel} onChange={(event) => update('riskLevel', event.target.value)} className={inp}><option value="MEDIUM">خطر متوسط</option><option value="HIGH">خطر مرتفع</option><option value="CRITICAL">خطر حرج</option></select><select value={form.status} onChange={(event) => update('status', event.target.value)} className={inp}><option value="DRAFT">مسودة</option><option value="ACTIVE">نشطة</option><option value="MONITORING">تحت المراقبة</option><option value="CLOSED">مغلقة</option></select><input value={form.responsible} onChange={(event) => update('responsible', event.target.value)} placeholder="المسؤول" className={inp} /><input value={form.alternativeSource} onChange={(event) => update('alternativeSource', event.target.value)} placeholder="مصدر التزويد البديل" className={inp} /><input type="date" value={form.activatedAt} onChange={(event) => update('activatedAt', event.target.value)} aria-label="تاريخ التفعيل" className={inp} /><input type="date" value={form.targetCloseAt} onChange={(event) => update('targetCloseAt', event.target.value)} aria-label="الإغلاق المستهدف" className={inp} /></div><textarea value={form.measures} onChange={(event) => update('measures', event.target.value)} placeholder="التدابير والإجراءات" rows={2} className={`${inp} resize-none`} /><textarea value={form.communicationNote} onChange={(event) => update('communicationNote', event.target.value)} placeholder="خطة التواصل والإشعار" rows={2} className={`${inp} resize-none`} /><button type="submit" disabled={saving} className="rounded-xl bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ خطة الطوارئ'}</button></form>
}

function AssetsTab({ assets, loading, onRefresh, showCreate, setShowCreate, buildParams }: { assets: SanitationAsset[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void; buildParams: () => URLSearchParams }) {
  const { submit, saving } = useCreateModal('/api/sanitation-assets', () => { setShowCreate(false); onRefresh() })
  return <div className="space-y-4" dir="rtl"><div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-orange-950">🏗️ أصول وشبكات الصرف الصحي</h3><p className="mt-1 text-xs text-orange-800">جرد المصارف ومحطات الضخ والخزانات وربطها بالموقع وبرنامج الصيانة.</p></div><button type="button" onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-orange-700 px-4 py-2 text-xs font-bold text-white hover:bg-orange-800">{showCreate ? 'إلغاء' : '➕ إضافة أصل'}</button></div>{showCreate && <AssetForm buildParams={buildParams} onSubmit={submit} saving={saving} />}</div>{loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأصول...</div> : assets.length === 0 ? <Empty icon="🏗️" text="لا توجد أصول صرف صحي مسجلة" /> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{assets.map((asset) => <div key={asset.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h4 className="font-extrabold text-slate-800">{asset.name}</h4><p className="mt-1 text-xs text-slate-500">{SANITATION_ASSET_TYPE_LABELS[asset.type] || asset.type} · {asset.reference}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${asset.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : asset.status === 'MAINTENANCE' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{asset.status === 'ACTIVE' ? 'نشط' : asset.status === 'MAINTENANCE' ? 'في الصيانة' : 'خارج الخدمة'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600"><span>📍 {asset.commune} · {asset.quartier || 'بدون حي'}</span><span>👤 {asset.operator || 'غير محدد'}</span><span>📅 آخر صيانة: {fmtDate(asset.lastMaintenanceAt)}</span><span>⏭️ القادمة: {fmtDate(asset.nextMaintenanceAt)}</span>{asset.capacity != null && <span>📦 السعة: {asset.capacity} {asset.capacityUnit}</span>}{asset.latitude != null && asset.longitude != null && <span>🗺️ {asset.latitude.toFixed(5)}, {asset.longitude.toFixed(5)}</span>}</div>{asset.description && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">{asset.description}</p>}</div>)}</div>}</div>
}

function AssetForm({ buildParams, onSubmit, saving }: { buildParams: () => URLSearchParams; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({ name: '', type: 'DRAIN', commune: buildParams().get('commune') || '', quartier: '', adresse: '', latitude: '', longitude: '', operator: '', status: 'ACTIVE', capacity: '', capacityUnit: 'm³/j', lastMaintenanceAt: '', nextMaintenanceAt: '', description: '' })
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }))
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.name.trim() || !form.commune.trim() || form.commune === 'ALL') { toast.error('أدخل اسم الأصل والجماعة المعنية'); return }; onSubmit({ ...form, latitude: form.latitude || null, longitude: form.longitude || null, capacity: form.capacity || null, lastMaintenanceAt: form.lastMaintenanceAt || null, nextMaintenanceAt: form.nextMaintenanceAt || null }) }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-orange-100 bg-white p-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><input value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="اسم الأصل *" className={inp} /><select value={form.type} onChange={(event) => update('type', event.target.value)} className={inp}>{Object.entries(SANITATION_ASSET_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={form.commune} onChange={(event) => update('commune', event.target.value)} placeholder="الجماعة *" className={inp} /><input value={form.quartier} onChange={(event) => update('quartier', event.target.value)} placeholder="الحي" className={inp} /><input value={form.adresse} onChange={(event) => update('adresse', event.target.value)} placeholder="العنوان" className={inp} /><input value={form.operator} onChange={(event) => update('operator', event.target.value)} placeholder="المشغل" className={inp} /><select value={form.status} onChange={(event) => update('status', event.target.value)} className={inp}><option value="ACTIVE">نشط</option><option value="MAINTENANCE">في الصيانة</option><option value="OUT_OF_SERVICE">خارج الخدمة</option></select><input type="number" step="0.01" min="0" value={form.capacity} onChange={(event) => update('capacity', event.target.value)} placeholder="السعة" className={inp} /><input value={form.capacityUnit} onChange={(event) => update('capacityUnit', event.target.value)} placeholder="وحدة السعة" className={inp} /><input type="number" step="any" value={form.latitude} onChange={(event) => update('latitude', event.target.value)} placeholder="خط العرض" className={inp} /><input type="number" step="any" value={form.longitude} onChange={(event) => update('longitude', event.target.value)} placeholder="خط الطول" className={inp} /><input type="date" value={form.lastMaintenanceAt} onChange={(event) => update('lastMaintenanceAt', event.target.value)} aria-label="آخر صيانة" className={inp} /><input type="date" value={form.nextMaintenanceAt} onChange={(event) => update('nextMaintenanceAt', event.target.value)} aria-label="الصيانة القادمة" className={inp} /></div><textarea value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="وصف الأصل وملاحظات الصيانة" rows={2} className={`${inp} resize-none`} /><button type="submit" disabled={saving} className="rounded-xl bg-orange-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ الأصل'}</button></form>
}

function DisinfectionTab({ operations, waterPoints, pools, loading, onRefresh, showCreate, setShowCreate }: { operations: WaterDisinfectionOperation[]; waterPoints: WaterPoint[]; pools: Pool[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void }) {
  const { submit, saving } = useCreateModal('/api/water-disinfection', () => { setShowCreate(false); onRefresh() })
  return <div className="space-y-4" dir="rtl"><div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-emerald-950">🧴 سجل الكلورة والتطهير</h3><p className="mt-1 text-xs text-emerald-800">توثيق المادة والجرعة ورقم الدفعة والنتيجة لكل عملية مرتبطة بمصدر واحد.</p></div><button type="button" onClick={() => setShowCreate(!showCreate)} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">{showCreate ? 'إلغاء' : '➕ عملية تطهير جديدة'}</button></div>{showCreate && <DisinfectionForm waterPoints={waterPoints} pools={pools} onSubmit={submit} saving={saving} />}</div>{loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل السجل...</div> : operations.length === 0 ? <Empty icon="🧴" text="لا توجد عمليات كلورة أو تطهير مسجلة" /> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{operations.map((operation) => <div key={operation.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h4 className="font-extrabold text-slate-800">{operation.reference}</h4><p className="mt-1 text-xs text-slate-500">{DISINFECTION_TYPE_LABELS[operation.operationType] || operation.operationType} · {fmtDate(operation.operationDate)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${operation.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : operation.status === 'PLANNED' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>{operation.status === 'VERIFIED' ? 'تم التحقق' : operation.status === 'PLANNED' ? 'مبرمج' : 'منجز'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600"><span>📍 {operation.waterPoint?.name || operation.pool?.name || 'مصدر غير محدد'}</span><span>👤 {operation.operator || 'غير محدد'}</span><span>🧪 {operation.productName || 'مادة غير محددة'}</span><span>📦 الدفعة: {operation.lotNumber || '—'}</span><span>⚖️ الجرعة: {operation.doseValue ?? '—'} {operation.doseUnit}</span><span>💧 المتبقي بعد التطهير: {operation.residualAfter ?? '—'}</span></div>{operation.result && <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">النتيجة: {operation.result}</p>}</div>)}</div>}</div>
}

function DisinfectionForm({ waterPoints, pools, onSubmit, saving }: { waterPoints: WaterPoint[]; pools: Pool[]; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [form, setForm] = useState({ waterPointId: '', poolId: '', operationDate: new Date().toISOString().slice(0, 10), operationType: 'CHLORINATION', productName: '', activeSubstance: '', lotNumber: '', doseValue: '', doseUnit: 'mg/L', treatedVolume: '', volumeUnit: 'm³', residualBefore: '', residualAfter: '', contactTimeMin: '', operator: '', status: 'COMPLETED', result: '', observation: '' })
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value, ...(key === 'waterPointId' && value ? { poolId: '' } : {}), ...(key === 'poolId' && value ? { waterPointId: '' } : {}) }))
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!form.waterPointId && !form.poolId) { toast.error('حدد نقطة مياه أو مسبحاً'); return }; onSubmit({ ...form, doseValue: form.doseValue || null, treatedVolume: form.treatedVolume || null, residualBefore: form.residualBefore || null, residualAfter: form.residualAfter || null, contactTimeMin: form.contactTimeMin || null }) }
  return <form onSubmit={submit} className="mt-4 space-y-3 rounded-2xl border border-emerald-100 bg-white p-4"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"><select value={form.waterPointId} onChange={(event) => update('waterPointId', event.target.value)} className={inp}><option value="">💧 نقطة المياه</option>{waterPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</select><select value={form.poolId} onChange={(event) => update('poolId', event.target.value)} className={inp}><option value="">🏊 المسبح</option>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name}</option>)}</select><input type="date" value={form.operationDate} onChange={(event) => update('operationDate', event.target.value)} className={inp} /><select value={form.operationType} onChange={(event) => update('operationType', event.target.value)} className={inp}>{Object.entries(DISINFECTION_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={form.productName} onChange={(event) => update('productName', event.target.value)} placeholder="اسم المادة المطهرة" className={inp} /><input value={form.activeSubstance} onChange={(event) => update('activeSubstance', event.target.value)} placeholder="المادة الفعالة" className={inp} /><input value={form.lotNumber} onChange={(event) => update('lotNumber', event.target.value)} placeholder="رقم الدفعة" className={inp} /><input type="number" step="0.01" min="0" value={form.doseValue} onChange={(event) => update('doseValue', event.target.value)} placeholder="الجرعة" className={inp} /><input value={form.doseUnit} onChange={(event) => update('doseUnit', event.target.value)} placeholder="وحدة الجرعة" className={inp} /><input type="number" step="0.01" min="0" value={form.treatedVolume} onChange={(event) => update('treatedVolume', event.target.value)} placeholder="الحجم المعالج" className={inp} /><input value={form.volumeUnit} onChange={(event) => update('volumeUnit', event.target.value)} placeholder="وحدة الحجم" className={inp} /><input type="number" step="0.01" min="0" value={form.residualBefore} onChange={(event) => update('residualBefore', event.target.value)} placeholder="المتبقي قبل التطهير" className={inp} /><input type="number" step="0.01" min="0" value={form.residualAfter} onChange={(event) => update('residualAfter', event.target.value)} placeholder="المتبقي بعد التطهير" className={inp} /><input type="number" min="0" value={form.contactTimeMin} onChange={(event) => update('contactTimeMin', event.target.value)} placeholder="مدة التماس بالدقائق" className={inp} /><input value={form.operator} onChange={(event) => update('operator', event.target.value)} placeholder="المسؤول عن العملية" className={inp} /><select value={form.status} onChange={(event) => update('status', event.target.value)} className={inp}><option value="PLANNED">مبرمج</option><option value="COMPLETED">منجز</option><option value="VERIFIED">تم التحقق</option></select></div><textarea value={form.result} onChange={(event) => update('result', event.target.value)} placeholder="النتيجة والملاحظات الفنية" rows={2} className={`${inp} resize-none`} /><button type="submit" disabled={saving} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ عملية التطهير'}</button></form>
}

function PlanningTab({ waterPoints, pools, samples, inspections, selectedCommune, onNavigate }: { waterPoints: WaterPoint[]; pools: Pool[]; samples: WaterSample[]; inspections: WaterInspection[]; selectedCommune: string; onNavigate: (tab: WaterSubTab) => void }) {
  const [settings, setSettings] = useState({ samplingFrequencyDays: 30, inspectionFrequencyDays: 30 })
  const [loadingSettings, setLoadingSettings] = useState(true)

  useEffect(() => {
    let cancelled = false
    const communeParam = selectedCommune !== 'ALL' ? `?commune=${encodeURIComponent(selectedCommune)}` : ''
    fetch(`/api/water/settings${communeParam}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled || !data?.settings) return
        setSettings({ samplingFrequencyDays: Number(data.settings.samplingFrequencyDays) || 30, inspectionFrequencyDays: Number(data.settings.inspectionFrequencyDays) || 30 })
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoadingSettings(false) })
    return () => { cancelled = true }
  }, [selectedCommune])

  const rows = useMemo(() => {
    const sources = [
      ...waterPoints.map((point) => ({ id: `point:${point.id}`, sourceId: point.id, name: point.name, type: 'نقطة مياه', createdAt: point.createdAt, sampleKind: 'waterPoint' as const })),
      ...pools.map((pool) => ({ id: `pool:${pool.id}`, sourceId: pool.id, name: pool.name, type: 'مسبح', createdAt: pool.createdAt, sampleKind: 'pool' as const })),
    ]
    const latest = (dates: string[]) => dates.sort((first, second) => new Date(second).getTime() - new Date(first).getTime())[0] || null
    const dueDate = (lastDate: string | null, frequencyDays: number) => lastDate ? new Date(new Date(lastDate).getTime() + frequencyDays * 86400000) : null
    const status = (lastDate: string | null, due: Date | null) => {
      if (!lastDate) return { label: 'لم يسجل بعد', color: 'bg-slate-100 text-slate-600' }
      if (due && due.getTime() <= Date.now()) return { label: 'متأخر', color: 'bg-red-100 text-red-700' }
      if (due && due.getTime() <= Date.now() + 7 * 86400000) return { label: 'قريب', color: 'bg-amber-100 text-amber-700' }
      return { label: 'مجدول', color: 'bg-emerald-100 text-emerald-700' }
    }
    return sources.map((source) => {
      const sourceSamples = samples.filter((sample) => source.sampleKind === 'waterPoint' ? sample.waterPointId === source.sourceId : sample.poolId === source.sourceId)
      const sourceInspections = inspections.filter((inspection) => source.sampleKind === 'waterPoint' ? inspection.waterPointId === source.sourceId : inspection.poolId === source.sourceId)
      const lastSample = latest(sourceSamples.map((sample) => sample.sampleDate))
      const lastInspection = latest(sourceInspections.map((inspection) => inspection.inspectionDate))
      const sampleDue = dueDate(lastSample, settings.samplingFrequencyDays)
      const inspectionDue = dueDate(lastInspection, settings.inspectionFrequencyDays)
      return { ...source, lastSample, lastInspection, sampleDue, inspectionDue, sampleStatus: status(lastSample, sampleDue), inspectionStatus: status(lastInspection, inspectionDue) }
    }).sort((first, second) => {
      const firstUrgent = first.sampleStatus.label === 'متأخر' || first.inspectionStatus.label === 'متأخر'
      const secondUrgent = second.sampleStatus.label === 'متأخر' || second.inspectionStatus.label === 'متأخر'
      return Number(secondUrgent) - Number(firstUrgent) || first.name.localeCompare(second.name, 'ar')
    })
  }, [waterPoints, pools, samples, inspections, settings])

  const overdue = rows.filter((row) => row.sampleStatus.label === 'متأخر' || row.inspectionStatus.label === 'متأخر').length
  return <div className="space-y-4" dir="rtl"><div className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-base font-extrabold text-indigo-950">📅 البرمجة الدورية للمراقبة</h3><p className="mt-1 text-xs text-indigo-800">متابعة الاستحقاقات الناتجة عن دورية العينات والمعاينات دون إنشاء سجل مكرر.</p></div><div className="flex items-center gap-2"><span className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-indigo-800">{rows.length} مصدر</span><span className={`rounded-xl px-3 py-2 text-xs font-bold ${overdue > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{overdue} متأخر</span></div></div></div><div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">دورية العينات</p><p className="mt-1 text-2xl font-black text-slate-800">{settings.samplingFrequencyDays} <span className="text-xs font-bold">يوماً</span></p></div><div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">دورية المعاينات</p><p className="mt-1 text-2xl font-black text-slate-800">{settings.inspectionFrequencyDays} <span className="text-xs font-bold">يوماً</span></p></div><div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">نطاق الحساب</p><p className="mt-1 truncate text-sm font-black text-slate-800">{selectedCommune === 'ALL' ? 'كل الجماعات' : `جماعة ${selectedCommune}`}</p></div></div>{loadingSettings ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل البرمجة...</div> : rows.length === 0 ? <Empty icon="📅" text="لا توجد نقاط مياه أو مسابح للبرمجة" /> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{rows.map((row) => <div key={row.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h4 className="font-extrabold text-slate-800">{row.name || 'بدون اسم'}</h4><p className="mt-1 text-xs text-slate-500">{row.type}</p></div><span className="rounded-full bg-sky-50 px-2 py-1 text-[10px] font-bold text-sky-700">{selectedCommune === 'ALL' ? 'كل الجماعات' : selectedCommune}</span></div><div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">🧪 أخذ العينة</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.sampleStatus.color}`}>{row.sampleStatus.label}</span></div><p className="mt-2 text-[11px] text-slate-500">آخر أخذ: {fmtDate(row.lastSample)}</p><p className="mt-1 text-[11px] text-slate-500">الاستحقاق: {row.sampleDue ? fmtDate(row.sampleDue.toISOString()) : 'بعد تسجيل أول عينة'}</p><button type="button" onClick={() => onNavigate('samples')} className="mt-2 text-[11px] font-bold text-sky-700 hover:underline">فتح سجل العينات ←</button></div><div className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">🔍 المعاينة</span><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.inspectionStatus.color}`}>{row.inspectionStatus.label}</span></div><p className="mt-2 text-[11px] text-slate-500">آخر معاينة: {fmtDate(row.lastInspection)}</p><p className="mt-1 text-[11px] text-slate-500">الاستحقاق: {row.inspectionDue ? fmtDate(row.inspectionDue.toISOString()) : 'بعد تسجيل أول معاينة'}</p><button type="button" onClick={() => onNavigate('inspections')} className="mt-2 text-[11px] font-bold text-sky-700 hover:underline">فتح سجل المعاينات ←</button></div></div></div>)}</div>}</div>
}

// ===== Dashboard =====
function DashboardTab({ waterPoints, measurements, samples, pools, incidents, dashboardMetrics, onNavigate }: {
  waterPoints: WaterPoint[]; measurements: WaterMeasurement[]; samples: WaterSample[]; pools: Pool[]; incidents: SanitationIncident[]
  dashboardMetrics?: WaterDashboardMetrics | null
  onNavigate: (t: WaterSubTab) => void
}) {
  const wpByType: Record<string, number> = {}
  for (const w of waterPoints) wpByType[w.type] = (wpByType[w.type] || 0) + 1
  const measByConf: Record<string, number> = {}
  for (const m of measurements) measByConf[m.conformity] = (measByConf[m.conformity] || 0) + 1
  const incByRisk: Record<string, number> = {}
  for (const i of incidents) incByRisk[i.riskLevel] = (incByRisk[i.riskLevel] || 0) + 1
  const sampleByStatus: Record<string, number> = {}
  for (const sample of samples) sampleByStatus[sample.status] = (sampleByStatus[sample.status] || 0) + 1
  const confRate = measurements.length > 0 ? Math.round(((measByConf['CONFORM'] || 0) / measurements.length) * 100) : 0
  const validatedSamples = (sampleByStatus.VALIDATED || 0) + (sampleByStatus.RESULT_RECEIVED || 0)
  const sampleTraceabilityRate = samples.length > 0 ? Math.round((validatedSamples / samples.length) * 100) : 0

  if (!dashboardMetrics && waterPoints.length === 0 && measurements.length === 0 && samples.length === 0 && incidents.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-6xl mb-4">💧</div><h3 className="text-lg font-bold text-slate-700">لا توجد بيانات بعد</h3><p className="text-sm text-slate-500 mt-2">ابدأ بإضافة نقاط المياه، القياسات، أو حوادث الصرف.</p><button onClick={() => onNavigate('points')} className="mt-4 px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700">➕ إضافة نقطة مياه</button></div>
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {(dashboardMetrics ? [
          { icon: '💧', v: dashboardMetrics.waterPointsRegistered, l: 'نقاط مسجلة', go: 'points' as const },
          { icon: '✅', v: dashboardMetrics.activeWaterPoints, l: 'نقاط نشطة', go: 'points' as const },
          { icon: '⏰', v: dashboardMetrics.overdueWaterPoints, l: 'نقاط متأخرة', go: 'planning' as const },
          { icon: '🌡️', v: dashboardMetrics.measurementsTotal, l: 'قياسات', go: 'measurements' as const },
          { icon: '🔴', v: dashboardMetrics.nonConformingMeasurements, l: 'قياسات غير مطابقة', go: 'measurements' as const },
          { icon: '🧪', v: dashboardMetrics.samplesTotal, l: 'عينات', go: 'samples' as const },
          { icon: '🔍', v: dashboardMetrics.inspectionsTotal, l: 'معاينات', go: 'inspections' as const },
          { icon: '🚨', v: dashboardMetrics.highRiskInspections, l: 'معاينات عالية الخطر', go: 'inspections' as const },
          { icon: '🏊', v: dashboardMetrics.activePools, l: 'مسابح نشطة', go: 'pools' as const },
          { icon: '⚠️', v: dashboardMetrics.openSanitationIncidents, l: 'حوادث صرف مفتوحة', go: 'sanitation' as const },
          { icon: '🛑', v: dashboardMetrics.criticalSanitationIncidents, l: 'حوادث حرجة', go: 'sanitation' as const },
          { icon: '🛠️', v: dashboardMetrics.openActions, l: 'إجراءات مفتوحة', go: 'actions' as const },
          { icon: '🧰', v: dashboardMetrics.overdueDevices, l: 'أجهزة تحتاج معايرة', go: 'devices' as const },
          { icon: '🧴', v: dashboardMetrics.disinfectionOperations, l: 'عمليات تطهير', go: 'disinfection' as const },
        ] : [
          { icon: '💧', v: waterPoints.length, l: 'نقطة مياه', go: 'points' as const }, { icon: '🌡️', v: measurements.length, l: 'قياس', go: 'measurements' as const }, { icon: '🧪', v: samples.length, l: 'عينة', go: 'samples' as const }, { icon: '🏊', v: pools.length, l: 'مسبح', go: 'pools' as const }, { icon: '🚿', v: incidents.length, l: 'حادث صرف', go: 'sanitation' as const }
        ]).map((k, i) => (
          <motion.button key={k.l} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} onClick={() => onNavigate(k.go)} className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md transition">
            <div className="flex items-center justify-between"><span className="text-2xl">{k.icon}</span><span className="text-3xl font-black text-slate-800">{k.v}</span></div>
            <p className="text-xs text-slate-500 mt-1">{k.l}</p>
          </motion.button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">💧 نقاط المياه حسب النوع</h3>
          <div className="space-y-1.5">
            {Object.entries(wpByType).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
              <div key={t} className="flex items-center gap-2 text-xs"><span className="w-40 shrink-0 truncate">{WATER_POINT_TYPE_ICONS[t]} {WATER_POINT_TYPE_LABELS[t]}</span><div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden"><div className="h-full bg-sky-500 rounded-md" style={{ width: `${Math.max(5, (c / waterPoints.length) * 100)}%` }} /></div><span className="font-bold w-6 text-left">{c}</span></div>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🌡️ مطابقة القياسات</h3>
          <div className="space-y-1.5">
            {Object.entries(measByConf).map(([c, n]) => (
              <div key={c} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0" style={{ color: WATER_MEAS_CONFORMITY_COLORS[c] }}>{WATER_MEAS_CONFORMITY_LABELS[c]}</span><div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden"><div className="h-full rounded-md" style={{ width: `${Math.max(5, (n / measurements.length) * 100)}%`, background: WATER_MEAS_CONFORMITY_COLORS[c] }} /></div><span className="font-bold w-6 text-left">{n}</span></div>
            ))}
          </div>
          {measurements.length > 0 && <div className="mt-3 pt-3 border-t border-slate-100 text-center"><div className="text-2xl font-black text-emerald-600">{confRate}%</div><div className="text-xs text-slate-500">نسبة المطابقة</div></div>}
        </div>
      </div>

      {Object.keys(incByRisk).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🚿 حوادث الصرف حسب مستوى الخطر</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {Object.keys(SANITATION_RISK_LABELS).map((r) => (
              <div key={r} className="rounded-xl p-3 text-center" style={{ backgroundColor: SANITATION_RISK_COLORS[r] + '15' }}>
                <div className="text-xl font-black" style={{ color: SANITATION_RISK_COLORS[r] }}>{incByRisk[r] || 0}</div>
                <div className="text-xs text-slate-600">{SANITATION_RISK_LABELS[r]}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-700">🧪 تتبع العينات</h3><button type="button" onClick={() => onNavigate('samples')} className="text-xs font-bold text-sky-700 hover:text-sky-900">فتح السجل ←</button></div>
          {samples.length === 0 ? <p className="text-xs text-slate-500">لا توجد عينات مسجلة بعد.</p> : <div className="space-y-1.5">{Object.entries(sampleByStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => <div key={status} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0 truncate text-slate-600">{SAMPLE_STATUS_LABELS[status] || status}</span><div className="h-4 flex-1 overflow-hidden rounded-md bg-slate-100"><div className="h-full rounded-md bg-violet-500" style={{ width: `${Math.max(5, (count / samples.length) * 100)}%` }} /></div><span className="w-6 text-left font-bold">{count}</span></div>)}</div>}
        </div>
        <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
          <h3 className="mb-3 text-sm font-bold text-violet-900">✅ جاهزية النتائج</h3>
          <div className="flex items-end gap-3"><span className="text-4xl font-black text-violet-700">{sampleTraceabilityRate}%</span><span className="pb-1 text-xs text-violet-800">عينات وصلت إلى النتيجة أو المصادقة</span></div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-violet-600" style={{ width: `${sampleTraceabilityRate}%` }} /></div>
          <p className="mt-2 text-[11px] text-violet-800">المؤشر للمتابعة التشغيلية، ولا يغني عن المصادقة المهنية على النتائج.</p>
        </div>
      </div>
    </div>
  )
}

// ===== Generic helpers =====
function useCreateModal<T>(endpoint: string, onSuccess: () => void) {
  const [saving, setSaving] = useState(false)
  const submit = async (body: T) => {
    setSaving(true)
    try {
      const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json().catch(() => null); toast.error(e?.error || 'فشل'); return false }
      toast.success('تم الإنشاء')
      onSuccess()
      return true
    } catch { toast.error('حدث خطأ'); return false } finally { setSaving(false) }
  }
  return { submit, saving }
}

// ===== Points Tab =====
function PointsTab({ waterPoints, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const filtered = waterPoints.filter((w: WaterPoint) => (filterType === 'ALL' || w.type === filterType) && (!search || w.name.toLowerCase().includes(search.toLowerCase()) || w.reference.toLowerCase().includes(search.toLowerCase()) || w.quartier.toLowerCase().includes(search.toLowerCase())))
  const { submit, saving } = useCreateModal('/api/water-points', () => { setShowCreate(false); onRefresh() })

  if (loading && waterPoints.length === 0) return <Spinner />

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300" />
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {Object.entries(WATER_POINT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{WATER_POINT_TYPE_ICONS[k]} {v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700">➕ نقطة جديدة</button>
      </div>
      {filtered.length === 0 ? <Empty icon="💧" text="لا توجد نقاط مياه" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((w: WaterPoint, i: number) => (
            <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between">
                <div><div className="text-sm font-bold text-slate-800">{WATER_POINT_TYPE_ICONS[w.type]} {w.name}</div><div className="text-[10px] text-slate-400">{w.reference}</div></div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: (WATER_POINT_STATUS_COLORS[w.status] || '#64748b') + '15', color: WATER_POINT_STATUS_COLORS[w.status] }}>{WATER_POINT_STATUS_LABELS[w.status]}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap">
                <span>{WATER_POINT_TYPE_LABELS[w.type]}</span>
                {w.quartier && <span>📍 {w.quartier}</span>}
                <span style={{ color: COMMUNE_COLORS[w.commune] }}>{COMMUNE_LABELS[w.commune] || w.commune}</span>
                {w._count && w._count.measurements > 0 && <span>🌡️ {w._count.measurements} قياس</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="💧 نقطة مياه جديدة" color="from-sky-600 to-blue-700">
        <PointForm buildParams={buildParams} onSubmit={submit} saving={saving} />
      </Modal>
    </div>
  )
}

// ===== Measurements Tab =====
function MeasurementsTab({ measurements, waterPoints, samples, devices, loading, onRefresh, buildParams, showCreate, setShowCreate }: { measurements: WaterMeasurement[]; waterPoints: WaterPoint[]; samples: WaterSample[]; devices: WaterDevice[]; loading: boolean; onRefresh: () => void; buildParams: () => URLSearchParams; showCreate: boolean; setShowCreate: (value: boolean) => void }) {
  const [filterConf, setFilterConf] = useState('ALL')
  const filtered = measurements.filter((m: WaterMeasurement) => filterConf === 'ALL' || m.conformity === filterConf)
  const { submit, saving } = useCreateModal('/api/water-measurements', () => { setShowCreate(false); onRefresh() })
  if (loading && measurements.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={filterConf} onChange={(e) => setFilterConf(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {Object.entries(WATER_MEAS_CONFORMITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} disabled={waterPoints.length === 0} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40">➕ قياس جديد</button>
        {waterPoints.length === 0 && <span className="text-[10px] text-slate-400">أضف نقطة مياه أولاً</span>}
      </div>
      {filtered.length === 0 ? <Empty icon="🌡️" text="لا توجد قياسات" /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 border-b border-slate-100">
              <th className="text-right py-2 px-2">المرجع</th><th className="text-right py-2 px-2">النقطة</th><th className="text-right py-2 px-2">العينة / الجهاز</th>
              <th className="text-right py-2 px-2">التاريخ</th><th className="text-right py-2 px-2">الكلور</th>
              <th className="text-right py-2 px-2">pH</th><th className="text-right py-2 px-2">الحرارة</th>
              <th className="text-right py-2 px-2">التعكّر</th><th className="text-right py-2 px-2">المطابقة</th>
            </tr></thead>
            <tbody>
              {filtered.map((m: WaterMeasurement) => {
                const c = WATER_MEAS_CONFORMITY_COLORS[m.conformity]
                return (
                  <tr key={m.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-xs">{m.reference}</td>
                    <td className="py-2 px-2 text-xs">{m.waterPoint?.name || '—'}</td>
                    <td className="py-2 px-2 text-[10px]">{m.sample?.reference || '—'}{m.device?.name ? ` · ${m.device.name}` : ''}</td>
                    <td className="py-2 px-2 text-xs">{fmtDate(m.measurementDate)}</td>
                    <td className="py-2 px-2 text-xs">{m.chlorineResidual != null ? `${m.chlorineResidual}` : '—'}</td>
                    <td className="py-2 px-2 text-xs">{m.ph != null ? m.ph : '—'}</td>
                    <td className="py-2 px-2 text-xs">{m.temperature != null ? `${m.temperature}°` : '—'}</td>
                    <td className="py-2 px-2 text-xs">{m.turbidity != null ? m.turbidity : '—'}</td>
                    <td className="py-2 px-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: c + '15', color: c }}>{WATER_MEAS_CONFORMITY_LABELS[m.conformity]}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🌡️ قياس جديد" color="from-sky-600 to-blue-700">
        <MeasurementForm waterPoints={waterPoints} samples={samples} devices={devices} buildParams={buildParams} onSubmit={submit} saving={saving} />
      </Modal>
    </div>
  )
}

// ===== Samples Tab =====
const SAMPLE_STATUS_LABELS: Record<string, string> = {
  COLLECTED: 'تم الجمع', LABELLED: 'تم الوسم', STORED: 'مخزنة', TRANSPORTED: 'قيد النقل',
  RECEIVED: 'وصلت للمختبر', ANALYZED: 'قيد التحليل', RESULT_RECEIVED: 'وصلت النتيجة', VALIDATED: 'تم التحقق', CANCELLED: 'ملغاة',
}
const SAMPLE_STATUS_COLORS: Record<string, string> = {
  COLLECTED: '#2563eb', LABELLED: '#4f46e5', STORED: '#7c3aed', TRANSPORTED: '#d97706',
  RECEIVED: '#0891b2', ANALYZED: '#0f766e', RESULT_RECEIVED: '#059669', VALIDATED: '#15803d', CANCELLED: '#64748b',
}
const SAMPLE_TYPE_LABELS: Record<string, string> = { DRINKING_WATER: 'مياه الشرب', POOL_WATER: 'مياه المسابح', WASTEWATER: 'مياه عادمة', OTHER: 'أخرى' }

function SamplesTab({ samples, waterPoints, pools, loading, onRefresh, showCreate, setShowCreate }: {
  samples: WaterSample[]; waterPoints: WaterPoint[]; pools: Pool[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const { submit, saving } = useCreateModal('/api/water-samples', () => { setShowCreate(false); onRefresh() })
  const filtered = samples.filter((sample) => {
    const haystack = [sample.reference, sample.collectorName, sample.laboratory, sample.waterPoint?.name, sample.pool?.name, sample.requestedTests].filter(Boolean).join(' ').toLowerCase()
    return (filterStatus === 'ALL' || sample.status === filterStatus) && (!search || haystack.includes(search.toLowerCase()))
  })
  const inChain = samples.filter((sample) => !['VALIDATED', 'CANCELLED'].includes(sample.status)).length
  const labReceived = samples.filter((sample) => ['RECEIVED', 'ANALYZED', 'RESULT_RECEIVED', 'VALIDATED'].includes(sample.status)).length
  const results = samples.filter((sample) => ['RESULT_RECEIVED', 'VALIDATED'].includes(sample.status)).length

  if (loading && samples.length === 0) return <Spinner />
  return <div className="space-y-4">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {[['🧪', samples.length, 'إجمالي العينات'], ['🔄', inChain, 'قيد التتبع'], ['🏛️', labReceived, 'وصلت للمختبر'], ['✅', results, 'نتيجة مستلمة']].map(([icon, value, label]) => <div key={String(label)} className="rounded-2xl border border-slate-100 bg-white p-3"><div className="flex items-center justify-between"><span className="text-xl">{icon}</span><strong className="text-2xl text-slate-800">{value}</strong></div><p className="mt-1 text-[11px] text-slate-500">{label}</p></div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="🔍 مرجع، جامع، مختبر، مصدر..." className="min-w-[200px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-300" />
      <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"><option value="ALL">كل الحالات</option>{Object.entries(SAMPLE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <button onClick={() => setShowCreate(true)} disabled={waterPoints.length === 0 && pools.length === 0} className="mr-auto rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-40">➕ أخذ عينة</button>
    </div>
    {waterPoints.length === 0 && pools.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">أضف نقطة مياه أو مسبحاً قبل تسجيل العينة.</div>}
    {filtered.length === 0 ? <Empty icon="🧪" text="لا توجد عينات مسجلة" /> : <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
      {filtered.map((sample, index) => {
        const color = SAMPLE_STATUS_COLORS[sample.status] || '#64748b'
        const source = sample.waterPoint ? `💧 ${sample.waterPoint.name}` : sample.pool ? `🏊 ${sample.pool.name}` : 'مصدر غير محدد'
        return <motion.article key={sample.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">🧪 {sample.reference}</h3><p className="mt-1 text-xs text-slate-600">{source} · {SAMPLE_TYPE_LABELS[sample.sampleType] || sample.sampleType}</p></div><span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: `${color}15`, color }}>{SAMPLE_STATUS_LABELS[sample.status] || sample.status}</span></div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500"><span>📅 {fmtDate(sample.sampleDate)} {sample.sampleTime && `· ${sample.sampleTime}`}</span><span>👤 {sample.collectorName || '—'}</span><span>🏛️ {sample.laboratory || 'مختبر غير محدد'}</span><span>🧫 {sample.requestedTests || 'اختبارات غير محددة'}</span></div>
          {sample.chainEvents && sample.chainEvents.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3"><p className="mb-2 text-[10px] font-bold text-slate-500">سلسلة الحيازة</p><div className="flex flex-wrap gap-1.5">{sample.chainEvents.map((event) => <span key={event.id} title={`${event.actorName || '—'} · ${fmtDate(event.occurredAt)}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-600">{SAMPLE_STATUS_LABELS[event.action] || event.action}</span>)}</div></div>}
          <SampleUpdateForm sample={sample} onSaved={onRefresh} />
        </motion.article>
      })}
    </div>}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🧪 تسجيل أخذ عينة" color="from-sky-600 to-blue-700"><SampleForm waterPoints={waterPoints} pools={pools} onSubmit={submit} saving={saving} /></Modal>
  </div>
}

function SampleUpdateForm({ sample, onSaved }: { sample: WaterSample; onSaved: () => void }) {
  const [status, setStatus] = useState(sample.status)
  const [laboratoryResult, setLaboratoryResult] = useState(sample.laboratoryResult || '')
  const [validationNote, setValidationNote] = useState(sample.validationNote || '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/water-samples/${sample.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, laboratoryResult, validationNote, note }) })
      const body = await response.json().catch(() => null)
      if (!response.ok) { toast.error(body?.error || 'تعذر تحديث العينة'); return }
      toast.success('تم تحديث سلسلة الحيازة')
      setNote('')
      onSaved()
    } catch { toast.error('حدث خطأ أثناء التحديث') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]"><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]">{Object.entries(SAMPLE_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={laboratoryResult} onChange={(event) => setLaboratoryResult(event.target.value)} placeholder="خلاصة نتيجة المختبر..." className="rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]" /><button type="submit" disabled={saving} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-slate-700 disabled:opacity-50">{saving ? '...' : 'تحديث'}</button></div>
    {(status === 'VALIDATED' || validationNote) && <input value={validationNote} onChange={(event) => setValidationNote(event.target.value)} placeholder="ملاحظة التحقق أو الاعتماد..." className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]" />}
    {status !== sample.status && <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة انتقال الحالة (اختياري)" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px]" />}
    {sample.validatedBy && <p className="text-[10px] text-emerald-700">✅ تم التحقق بواسطة {sample.validatedBy}{sample.validatedAt ? ` · ${fmtDate(sample.validatedAt)}` : ''}</p>}
  </form>
}

const INSPECTION_STATUS_LABELS: Record<string, string> = { PLANNED: 'مبرمجة', IN_PROGRESS: 'قيد الإنجاز', COMPLETED: 'منجزة', FOLLOW_UP: 'تحتاج متابعة', CLOSED: 'مغلقة' }
const INSPECTION_CONFORMITY_LABELS: Record<string, string> = { PENDING: 'في الانتظار', CONFORM: 'مطابق', PARTIAL: 'مطابقة جزئية', NON_CONFORM: 'غير مطابق' }

function InspectionsTab({ inspections, samples, waterPoints, pools, loading, onRefresh, showCreate, setShowCreate }: { inspections: WaterInspection[]; samples: WaterSample[]; waterPoints: WaterPoint[]; pools: Pool[]; loading: boolean; onRefresh: () => void; showCreate: boolean; setShowCreate: (value: boolean) => void }) {
  const [filter, setFilter] = useState('ALL')
  const { submit, saving } = useCreateModal('/api/water-inspections', () => { setShowCreate(false); onRefresh() })
  const filtered = inspections.filter((inspection) => filter === 'ALL' || inspection.status === filter)
  if (loading && inspections.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs"><option value="ALL">كل المعاينات</option>{Object.entries(INSPECTION_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><span className="text-xs text-slate-500">{filtered.length} معاينة</span><button onClick={() => setShowCreate(true)} disabled={waterPoints.length === 0 && pools.length === 0} className="mr-auto rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-40">➕ معاينة جديدة</button></div>
    {filtered.length === 0 ? <Empty icon="🔍" text="لا توجد معاينات ميدانية" /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{filtered.map((inspection) => { const source = inspection.waterPoint ? `💧 ${inspection.waterPoint.name}` : inspection.pool ? `🏊 ${inspection.pool.name}` : 'مصدر غير محدد'; const riskColor = inspection.riskLevel === 'CRITICAL' || inspection.riskLevel === 'HIGH' ? '#dc2626' : inspection.riskLevel === 'MEDIUM' ? '#d97706' : '#059669'; return <article key={inspection.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">🔍 {inspection.reference}</h3><p className="mt-1 text-xs text-slate-600">{source}</p></div><span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ backgroundColor: `${riskColor}15`, color: riskColor }}>{inspection.riskScore}/100 · {inspection.riskLevel}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500"><span>📅 {fmtDate(inspection.inspectionDate)}</span><span>👤 {inspection.inspectorName || '—'}</span><span>🎯 {INSPECTION_CONFORMITY_LABELS[inspection.conformity] || inspection.conformity}</span><span>📌 {INSPECTION_STATUS_LABELS[inspection.status] || inspection.status}</span></div><p className="mt-3 line-clamp-3 text-xs leading-5 text-slate-600">{inspection.observation || 'بدون ملاحظات'}</p>{inspection.correctiveAction && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">⚙️ {inspection.correctiveAction}</p>}{inspection.followUpDate && <p className="mt-2 text-[10px] font-bold text-amber-700">📅 المتابعة: {fmtDate(inspection.followUpDate)}</p>}</article> })}</div>}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🔍 تسجيل معاينة ميدانية" color="from-sky-600 to-blue-700"><InspectionForm waterPoints={waterPoints} pools={pools} samples={samples} onSubmit={submit} saving={saving} /></Modal>
  </div>
}

function InspectionForm({ waterPoints, pools, samples, onSubmit, saving }: { waterPoints: WaterPoint[]; pools: Pool[]; samples: WaterSample[]; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ waterPointId: '', poolId: '', sampleId: '', inspectionDate: new Date().toISOString().slice(0, 10), inspectorName: '', probability: '1', severity: '1', conformity: 'PENDING', status: 'COMPLETED', observation: '', correctiveAction: '', followUpDate: '' })
  const score = Math.min(100, (Number(f.probability) || 1) * (Number(f.severity) || 1) * 4)
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!f.waterPointId && !f.poolId) { toast.error('اختر نقطة المياه أو المسبح'); return }; onSubmit({ ...f, waterPointId: f.waterPointId || null, poolId: f.poolId || null, sampleId: f.sampleId || null, probability: Number(f.probability), severity: Number(f.severity), followUpDate: f.followUpDate || null }) }
  return <form onSubmit={submit} className="space-y-3"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select value={f.waterPointId} onChange={(event) => setF({ ...f, waterPointId: event.target.value })} className={inp}><option value="">💧 نقطة مياه — اختر</option>{waterPoints.map((point) => <option key={point.id} value={point.id}>{point.name} ({point.reference})</option>)}</select><select value={f.poolId} onChange={(event) => setF({ ...f, poolId: event.target.value })} className={inp}><option value="">🏊 مسبح — اختر</option>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name} ({pool.reference})</option>)}</select></div><select value={f.sampleId} onChange={(event) => setF({ ...f, sampleId: event.target.value })} className={inp}><option value="">🧪 عينة مرتبطة اختيارياً</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.reference} — {sample.waterPoint?.name || sample.pool?.name || 'مصدر'}</option>)}</select><div className="grid grid-cols-2 gap-2"><input required type="date" value={f.inspectionDate} onChange={(event) => setF({ ...f, inspectionDate: event.target.value })} className={inp} /><input value={f.inspectorName} onChange={(event) => setF({ ...f, inspectorName: event.target.value })} placeholder="اسم المعاين" className={inp} /></div><div className="grid grid-cols-2 gap-2"><label className="text-xs font-bold text-slate-600">احتمال الحدوث 1–5<input type="number" min="1" max="5" value={f.probability} onChange={(event) => setF({ ...f, probability: event.target.value })} className={`${inp} mt-1`} /></label><label className="text-xs font-bold text-slate-600">شدة الأثر 1–5<input type="number" min="1" max="5" value={f.severity} onChange={(event) => setF({ ...f, severity: event.target.value })} className={`${inp} mt-1`} /></label></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center"><span className="text-xs font-bold text-amber-800">مؤشر الخطر المحسوب</span><strong className="mr-2 text-2xl text-amber-800">{score}/100</strong><p className="mt-1 text-[10px] text-amber-700">الاحتمال × شدة الأثر × 4 · أداة دعم قرار وليست قراراً قانونياً</p></div><div className="grid grid-cols-2 gap-2"><select value={f.conformity} onChange={(event) => setF({ ...f, conformity: event.target.value })} className={inp}>{Object.entries(INSPECTION_CONFORMITY_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={f.status} onChange={(event) => setF({ ...f, status: event.target.value })} className={inp}>{Object.entries(INSPECTION_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><textarea required value={f.observation} onChange={(event) => setF({ ...f, observation: event.target.value })} rows={3} placeholder="الملاحظات والنتيجة الأساسية *" className={`${inp} resize-none`} /><textarea value={f.correctiveAction} onChange={(event) => setF({ ...f, correctiveAction: event.target.value })} rows={2} placeholder="الإجراء التصحيحي أو التوصية" className={`${inp} resize-none`} /><input type="date" value={f.followUpDate} onChange={(event) => setF({ ...f, followUpDate: event.target.value })} className={inp} aria-label="موعد المتابعة" /><button type="submit" disabled={saving} className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ المعاينة'}</button></form>
}

function ThresholdsTab({ thresholds, loading, onRefresh, buildParams }: { thresholds: WaterThreshold[]; loading: boolean; onRefresh: () => void; buildParams: () => URLSearchParams }) {
  const { submit, saving } = useCreateModal('/api/water-thresholds', onRefresh)
  if (loading && thresholds.length === 0) return <Spinner />
  return <div className="space-y-4"><div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><h3 className="font-bold text-slate-800">📐 مرجعيات القياسات</h3><p className="mt-1 text-xs leading-5 text-slate-600">أدخل الحدود المعتمدة محلياً أو المرجع المهني المعتمد. لا تُعتبر القيم المدخلة حكماً قانونياً تلقائياً.</p><ThresholdForm buildParams={buildParams} onSubmit={submit} saving={saving} /></div>{thresholds.length === 0 ? <Empty icon="📐" text="لا توجد مرجعيات مهيأة" /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{thresholds.map((threshold) => <ThresholdRow key={threshold.id} threshold={threshold} onSaved={onRefresh} />)}</div>}</div>
}

function ThresholdForm({ buildParams, onSubmit, saving }: { buildParams: () => URLSearchParams; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ commune: buildParams().get('commune') || 'ALL', parameter: '', label: '', unit: '', minValue: '', maxValue: '', notes: '' })
  return <form onSubmit={(event) => { event.preventDefault(); if (!f.parameter.trim()) { toast.error('اسم المؤشر مطلوب'); return }; onSubmit({ ...f, parameter: f.parameter.trim().toUpperCase(), minValue: f.minValue || null, maxValue: f.maxValue || null }) }} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"><input value={f.parameter} onChange={(event) => setF({ ...f, parameter: event.target.value })} placeholder="المؤشر: PH، CHLORINE... *" className={inp} /><input value={f.label} onChange={(event) => setF({ ...f, label: event.target.value })} placeholder="الاسم الظاهر" className={inp} /><input value={f.unit} onChange={(event) => setF({ ...f, unit: event.target.value })} placeholder="الوحدة" className={inp} /><input value={f.commune} onChange={(event) => setF({ ...f, commune: event.target.value })} placeholder="الجماعة أو ALL" className={inp} /><input type="number" step="any" value={f.minValue} onChange={(event) => setF({ ...f, minValue: event.target.value })} placeholder="الحد الأدنى" className={inp} /><input type="number" step="any" value={f.maxValue} onChange={(event) => setF({ ...f, maxValue: event.target.value })} placeholder="الحد الأقصى" className={inp} /><input value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} placeholder="المصدر أو ملاحظة" className={`${inp} sm:col-span-2`} /><button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? '...' : '➕ إضافة مرجعية'}</button></form>
}

function ThresholdRow({ threshold, onSaved }: { threshold: WaterThreshold; onSaved: () => void }) {
  const [f, setF] = useState({ label: threshold.label, unit: threshold.unit, minValue: threshold.minValue?.toString() || '', maxValue: threshold.maxValue?.toString() || '', notes: threshold.notes, active: threshold.active })
  const [saving, setSaving] = useState(false)
  const update = async (method: 'PUT' | 'DELETE') => { setSaving(true); try { const response = await fetch(`/api/water-thresholds/${threshold.id}`, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'PUT' ? JSON.stringify({ ...f, minValue: f.minValue || null, maxValue: f.maxValue || null }) : undefined }); const body = await response.json().catch(() => null); if (!response.ok) { toast.error(body?.error || 'تعذر تنفيذ العملية'); return }; toast.success(method === 'DELETE' ? 'تم حذف المرجعية' : 'تم تحديث المرجعية'); onSaved() } catch { toast.error('حدث خطأ') } finally { setSaving(false) } }
  return <form onSubmit={(event) => { event.preventDefault(); update('PUT') }} className={`rounded-2xl border bg-white p-4 shadow-sm ${f.active ? 'border-slate-100' : 'border-dashed border-slate-300 opacity-70'}`}><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">{threshold.parameter}</h3><p className="text-[10px] text-slate-400">{threshold.commune === 'ALL' ? 'مرجعية عامة' : `جماعة ${threshold.commune}`}</p></div><label className="flex items-center gap-1 text-[10px] text-slate-500"><input type="checkbox" checked={f.active} onChange={(event) => setF({ ...f, active: event.target.checked })} /> فعالة</label></div><div className="mt-3 grid grid-cols-2 gap-2"><input value={f.label} onChange={(event) => setF({ ...f, label: event.target.value })} placeholder="الاسم" className={inp} /><input value={f.unit} onChange={(event) => setF({ ...f, unit: event.target.value })} placeholder="الوحدة" className={inp} /><input type="number" step="any" value={f.minValue} onChange={(event) => setF({ ...f, minValue: event.target.value })} placeholder="الحد الأدنى" className={inp} /><input type="number" step="any" value={f.maxValue} onChange={(event) => setF({ ...f, maxValue: event.target.value })} placeholder="الحد الأقصى" className={inp} /></div><input value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} placeholder="ملاحظة أو مصدر المرجعية" className={`${inp} mt-2`} /><div className="mt-3 flex gap-2"><button type="submit" disabled={saving} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">💾 حفظ التعديل</button><button type="button" disabled={saving} onClick={() => update('DELETE')} className="rounded-lg bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 disabled:opacity-50">حذف</button></div></form>
}

const DEVICE_TYPE_LABELS: Record<string, string> = { MULTIMETER: 'جهاز متعدد القياسات', PHMETER: 'جهاز pH', CHLORINE: 'جهاز الكلور', TURBIDITY: 'جهاز التعكر', THERMOMETER: 'مقياس الحرارة', OTHER: 'أخرى' }

function DevicesTab({ devices, waterPoints, loading, onRefresh, buildParams }: { devices: WaterDevice[]; waterPoints: WaterPoint[]; loading: boolean; onRefresh: () => void; buildParams: () => URLSearchParams }) {
  const { submit, saving } = useCreateModal('/api/water-devices', onRefresh)
  const dueSoon = devices.filter((device) => device.calibrationDueDate && new Date(device.calibrationDueDate).getTime() <= Date.now() + 30 * 86400000).length
  if (loading && devices.length === 0) return <Spinner />
  return <div className="space-y-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><div className="rounded-2xl border border-slate-100 bg-white p-3"><b className="text-2xl text-slate-800">{devices.length}</b><p className="text-[11px] text-slate-500">إجمالي الأجهزة</p></div><div className="rounded-2xl border border-slate-100 bg-white p-3"><b className="text-2xl text-emerald-700">{devices.filter((device) => device.status === 'ACTIVE').length}</b><p className="text-[11px] text-slate-500">أجهزة فعالة</p></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-3"><b className="text-2xl text-amber-700">{dueSoon}</b><p className="text-[11px] text-amber-700">معايرة خلال 30 يوماً</p></div></div><div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><h3 className="font-bold text-slate-800">🧰 إضافة جهاز قياس</h3><DeviceForm waterPoints={waterPoints} buildParams={buildParams} onSubmit={submit} saving={saving} /></div>{devices.length === 0 ? <Empty icon="🧰" text="لا توجد أجهزة مسجلة" /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{devices.map((device) => <DeviceCard key={device.id} device={device} onSaved={onRefresh} />)}</div>}</div>
}

function DeviceForm({ waterPoints, buildParams, onSubmit, saving }: { waterPoints: WaterPoint[]; buildParams: () => URLSearchParams; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ name: '', type: 'MULTIMETER', commune: buildParams().get('commune') || 'ALL', waterPointId: '', serialNumber: '', manufacturer: '', model: '', calibrationDueDate: '', notes: '' })
  return <form onSubmit={(event) => { event.preventDefault(); if (!f.name.trim()) { toast.error('اسم الجهاز مطلوب'); return }; onSubmit({ ...f, waterPointId: f.waterPointId || null, calibrationDueDate: f.calibrationDueDate || null }) }} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"><input required value={f.name} onChange={(event) => setF({ ...f, name: event.target.value })} placeholder="اسم الجهاز *" className={inp} /><select value={f.type} onChange={(event) => setF({ ...f, type: event.target.value })} className={inp}>{Object.entries(DEVICE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={f.commune} onChange={(event) => setF({ ...f, commune: event.target.value })} placeholder="الجماعة أو ALL" className={inp} /><select value={f.waterPointId} onChange={(event) => setF({ ...f, waterPointId: event.target.value })} className={inp}><option value="">بدون نقطة مرتبطة</option>{waterPoints.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}</select><input value={f.serialNumber} onChange={(event) => setF({ ...f, serialNumber: event.target.value })} placeholder="الرقم التسلسلي" className={inp} /><input value={f.manufacturer} onChange={(event) => setF({ ...f, manufacturer: event.target.value })} placeholder="الصانع" className={inp} /><input value={f.model} onChange={(event) => setF({ ...f, model: event.target.value })} placeholder="الطراز" className={inp} /><input type="date" value={f.calibrationDueDate} onChange={(event) => setF({ ...f, calibrationDueDate: event.target.value })} aria-label="موعد المعايرة" className={inp} /><input value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} placeholder="ملاحظات" className={`${inp} sm:col-span-2`} /><button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? '...' : '➕ حفظ الجهاز'}</button></form>
}

function DeviceCard({ device, onSaved }: { device: WaterDevice; onSaved: () => void }) {
  const [showCalibration, setShowCalibration] = useState(false)
  const due = device.calibrationDueDate && new Date(device.calibrationDueDate).getTime() <= Date.now() + 30 * 86400000
  return <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">🧰 {device.name}</h3><p className="text-[10px] text-slate-400">{device.reference} · {DEVICE_TYPE_LABELS[device.type] || device.type}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${device.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : device.status === 'MAINTENANCE' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{device.status === 'ACTIVE' ? 'فعال' : device.status === 'MAINTENANCE' ? 'صيانة' : 'خارج الخدمة'}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500"><span>🔢 {device.serialNumber || 'بدون رقم'}</span><span>🏭 {device.manufacturer || 'الصانع غير محدد'}</span><span>💧 {device.waterPoint?.name || 'غير مرتبط بنقطة'}</span><span className={due ? 'font-bold text-amber-700' : ''}>📅 المعايرة: {device.calibrationDueDate ? fmtDate(device.calibrationDueDate) : 'غير محددة'}</span></div>{device.calibrations && device.calibrations.length > 0 && <div className="mt-3 border-t border-slate-100 pt-3"><p className="text-[10px] font-bold text-slate-500">آخر المعايرات</p>{device.calibrations.slice(0, 2).map((calibration) => <div key={calibration.id} className="mt-1 flex items-center justify-between text-[10px] text-slate-500"><span>{fmtDate(calibration.calibrationDate)} · {calibration.performedBy || '—'}</span><span className={calibration.result === 'CONFORM' ? 'text-emerald-700' : calibration.result === 'NON_CONFORM' ? 'text-red-700' : 'text-amber-700'}>{calibration.result === 'CONFORM' ? 'مطابق' : calibration.result === 'NON_CONFORM' ? 'غير مطابق' : 'في الانتظار'}</span></div>)}</div>}<button type="button" onClick={() => setShowCalibration((value) => !value)} className="mt-3 rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700">{showCalibration ? 'إخفاء المعايرة' : '➕ تسجيل معايرة'}</button>{showCalibration && <CalibrationForm deviceId={device.id} onSaved={() => { setShowCalibration(false); onSaved() }} />}</article>
}

const ACTION_TYPE_LABELS: Record<string, string> = { CONTROL: 'مراقبة', DISINFECTION: 'تطهير', REPAIR: 'إصلاح', CLEANING: 'تنظيف', SAMPLING: 'أخذ عينة', NOTICE: 'إشعار', OTHER: 'أخرى' }
const ACTION_STATUS_LABELS: Record<string, string> = { PLANNED: 'مبرمج', ASSIGNED: 'مسند', IN_PROGRESS: 'قيد التنفيذ', COMPLETED: 'منجز', VERIFIED: 'تم التحقق', CLOSED: 'مغلق' }

function ActionsTab({ actions, waterPoints, pools, inspections, samples, incidents, onRefresh }: { actions: WaterAction[]; waterPoints: WaterPoint[]; pools: Pool[]; inspections: WaterInspection[]; samples: WaterSample[]; incidents: SanitationIncident[]; onRefresh: () => void }) {
  const { submit, saving } = useCreateModal('/api/water-actions', onRefresh)
  return <div className="space-y-4"><div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><h3 className="font-bold text-slate-800">🛠️ إضافة تدخل ميداني</h3><p className="mt-1 text-xs text-slate-600">اربط التدخل بمصدر الرصد لتكوين مسار واضح من الملاحظة إلى التنفيذ والإغلاق.</p><ActionForm waterPoints={waterPoints} pools={pools} inspections={inspections} samples={samples} incidents={incidents} onSubmit={submit} saving={saving} /></div>{actions.length === 0 ? <Empty icon="🛠️" text="لا توجد تدخلات مسجلة" /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{actions.map((action) => <ActionCard key={action.id} action={action} onSaved={onRefresh} />)}</div>}</div>
}

function ActionForm({ waterPoints, pools, inspections, samples, incidents, onSubmit, saving }: { waterPoints: WaterPoint[]; pools: Pool[]; inspections: WaterInspection[]; samples: WaterSample[]; incidents: SanitationIncident[]; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ waterPointId: '', poolId: '', inspectionId: '', sampleId: '', sanitationIncidentId: '', actionType: 'CONTROL', priority: 'NORMAL', responsible: '', plannedDate: '', followUpDate: '', measures: '', observation: '' })
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (![f.waterPointId, f.poolId, f.inspectionId, f.sampleId, f.sanitationIncidentId].some(Boolean)) { toast.error('حدد مصدر التدخل'); return }; onSubmit({ ...f, waterPointId: f.waterPointId || null, poolId: f.poolId || null, inspectionId: f.inspectionId || null, sampleId: f.sampleId || null, sanitationIncidentId: f.sanitationIncidentId || null, plannedDate: f.plannedDate || null, followUpDate: f.followUpDate || null }) }
  return <form onSubmit={submit} className="mt-3 space-y-2"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select value={f.waterPointId} onChange={(event) => setF({ ...f, waterPointId: event.target.value })} className={inp}><option value="">💧 نقطة المياه</option>{waterPoints.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={f.poolId} onChange={(event) => setF({ ...f, poolId: event.target.value })} className={inp}><option value="">🏊 المسبح</option>{pools.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={f.inspectionId} onChange={(event) => setF({ ...f, inspectionId: event.target.value })} className={inp}><option value="">🔍 المعاينة</option>{inspections.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</select><select value={f.sampleId} onChange={(event) => setF({ ...f, sampleId: event.target.value })} className={inp}><option value="">🧪 العينة</option>{samples.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</select><select value={f.sanitationIncidentId} onChange={(event) => setF({ ...f, sanitationIncidentId: event.target.value })} className={inp}><option value="">🚿 حادث الصرف</option>{incidents.map((item) => <option key={item.id} value={item.id}>{item.reference}</option>)}</select><select value={f.actionType} onChange={(event) => setF({ ...f, actionType: event.target.value })} className={inp}>{Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={f.priority} onChange={(event) => setF({ ...f, priority: event.target.value })} className={inp}><option value="LOW">أولوية منخفضة</option><option value="NORMAL">عادية</option><option value="HIGH">عالية</option><option value="URGENT">عاجلة</option></select><input value={f.responsible} onChange={(event) => setF({ ...f, responsible: event.target.value })} placeholder="المسؤول" className={inp} /><input type="date" value={f.plannedDate} onChange={(event) => setF({ ...f, plannedDate: event.target.value })} aria-label="التاريخ المبرمج" className={inp} /><input type="date" value={f.followUpDate} onChange={(event) => setF({ ...f, followUpDate: event.target.value })} aria-label="المتابعة" className={inp} /></div><textarea value={f.measures} onChange={(event) => setF({ ...f, measures: event.target.value })} rows={2} placeholder="الإجراءات والتدابير" className={`${inp} resize-none`} /><textarea value={f.observation} onChange={(event) => setF({ ...f, observation: event.target.value })} rows={2} placeholder="ملاحظات التدخل" className={`${inp} resize-none`} /><button type="submit" disabled={saving} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? '...' : '💾 حفظ التدخل'}</button></form>
}

function ActionCard({ action, onSaved }: { action: WaterAction; onSaved: () => void }) {
  const [status, setStatus] = useState(action.status)
  const [outcome, setOutcome] = useState(action.outcome || '')
  const [saving, setSaving] = useState(false)
  const source = `${action.waterPoint?.name || action.pool?.name || action.inspection?.reference || action.sample?.reference || action.sanitationIncident?.reference || 'مصدر غير محدد'}${action.executedDate ? ` · التنفيذ ${fmtDate(action.executedDate)}` : ''}`
  const update = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { const response = await fetch(`/api/water-actions/${action.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, outcome }) }); const body = await response.json().catch(() => null); if (!response.ok) { toast.error(body?.error || 'تعذر تحديث التدخل'); return }; toast.success('تم تحديث التدخل'); onSaved() } catch { toast.error('حدث خطأ') } finally { setSaving(false) } }
  return <form onSubmit={update} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-slate-800">🛠️ {action.reference}</h3><p className="mt-1 text-xs text-slate-600">{ACTION_TYPE_LABELS[action.actionType] || action.actionType} · {source}</p></div><span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">{action.priority}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-500"><span>👤 {action.responsible || 'غير مسند'}</span><span>📅 {action.plannedDate ? fmtDate(action.plannedDate) : 'غير مبرمج'}</span><span>📍 جماعة {action.commune}</span><span>🔁 {action.followUpDate ? fmtDate(action.followUpDate) : 'بدون متابعة'}</span></div>{action.measures && <p className="mt-2 text-xs text-slate-600">⚙️ {action.measures}</p>}<div className="mt-3 flex gap-2 border-t border-slate-100 pt-3"><select value={status} onChange={(event) => setStatus(event.target.value)} className="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs">{Object.entries(ACTION_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="submit" disabled={saving} className="rounded-lg bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">{saving ? '...' : 'حفظ الحالة'}</button></div><input value={outcome} onChange={(event) => setOutcome(event.target.value)} placeholder="نتيجة التنفيذ أو ملاحظة الإغلاق" className={`${inp} mt-2`} /></form>
}

function WaterReportsTab({ waterPoints, measurements, samples, inspections, devices, pools, incidents, alerts }: { waterPoints: WaterPoint[]; measurements: WaterMeasurement[]; samples: WaterSample[]; inspections: WaterInspection[]; devices: WaterDevice[]; pools: Pool[]; incidents: SanitationIncident[]; alerts: WaterAlert[] }) {
  const { selectedCommune, territoryFilter } = useAppStore()
  const [reportActions, setReportActions] = useState<WaterAction[]>([])
  const [reportDisinfection, setReportDisinfection] = useState<WaterDisinfectionOperation[]>([])
  useEffect(() => {
    let cancelled = false
    const params = new URLSearchParams()
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    appendTerritoryParams(params, territoryFilter)
    Promise.all([fetch(`/api/water-actions?${params.toString()}`), fetch(`/api/water-disinfection?${params.toString()}`)]).then(async ([actionsResponse, disinfectionResponse]) => { const actionsData = actionsResponse.ok ? await actionsResponse.json() : null; const disinfectionData = disinfectionResponse.ok ? await disinfectionResponse.json() : null; if (!cancelled) { setReportActions(actionsData?.actions || []); setReportDisinfection(disinfectionData?.operations || []) } }).catch(() => { if (!cancelled) { setReportActions([]); setReportDisinfection([]) } })
    return () => { cancelled = true }
  }, [selectedCommune, territoryFilter])
  const rows = [
    ...waterPoints.map((item) => ({ category: 'نقطة مياه', reference: item.reference, commune: item.commune, status: item.status, date: item.createdAt, detail: item.name })),
    ...measurements.map((item) => ({ category: 'قياس', reference: item.reference, commune: item.commune, status: item.conformity, date: item.measurementDate, detail: item.waterPoint?.name || '' })),
    ...samples.map((item) => ({ category: 'عينة', reference: item.reference, commune: item.commune, status: item.status, date: item.sampleDate, detail: item.waterPoint?.name || item.pool?.name || '' })),
    ...inspections.map((item) => ({ category: 'معاينة', reference: item.reference, commune: item.commune, status: item.riskLevel, date: item.inspectionDate, detail: item.observation })),
    ...devices.map((item) => ({ category: 'جهاز', reference: item.reference, commune: item.commune, status: item.status, date: item.updatedAt, detail: item.name })),
    ...pools.map((item) => ({ category: 'مسبح', reference: item.reference, commune: item.commune, status: item.status, date: item.createdAt, detail: item.name })),
    ...incidents.map((item) => ({ category: 'حادث صرف', reference: item.reference, commune: item.commune, status: item.riskLevel, date: item.createdAt, detail: item.description })),
    ...alerts.map((item) => ({ category: 'تنبيه', reference: item.reference, commune: item.commune, status: item.severity, date: item.occurredAt, detail: `${item.title} — ${item.detail}` })),
    ...reportActions.map((item) => ({ category: 'إجراء مائي', reference: item.reference, commune: item.commune, status: item.status, date: item.executedDate || item.plannedDate || item.createdAt, detail: `${ACTION_TYPE_LABELS[item.actionType] || item.actionType} · ${item.outcome || item.measures || ''}` })),
    ...reportDisinfection.map((item) => ({ category: 'كلورة وتطهير', reference: item.reference, commune: item.commune, status: item.status, date: item.operationDate, detail: `${DISINFECTION_TYPE_LABELS[item.operationType] || item.operationType} · ${item.productName || 'مادة غير محددة'} · ${item.result || ''}` })),
  ]
  const report = { generatedAt: new Date().toISOString(), summary: { waterPoints: waterPoints.length, measurements: measurements.length, samples: samples.length, inspections: inspections.length, devices: devices.length, pools: pools.length, sanitationIncidents: incidents.length, alerts: alerts.length, actions: reportActions.length }, rows }
  const download = (content: string, filename: string, type: string) => { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
  const csv = [
    ['الفئة', 'المرجع', 'الجماعة', 'الحالة', 'التاريخ', 'التفصيل'],
    ...rows.map((row) => [row.category, row.reference, row.commune, row.status, row.date, row.detail]),
  ].map((line) => line.map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')
  const print = () => { const popup = window.open('', '_blank', 'noopener,noreferrer,width=1100,height=800'); if (!popup) { toast.error('تعذر فتح المعاينة'); return }; const summary = Object.entries(report.summary).map(([key, value]) => `<span><b>${key}</b>: ${value}</span>`).join(' · '); const table = rows.slice(0, 200).map((row) => `<tr><td>${row.category}</td><td>${row.reference}</td><td>${row.commune}</td><td>${row.status}</td><td>${fmtDate(row.date)}</td><td>${row.detail || ''}</td></tr>`).join(''); popup.document.write(`<html dir="rtl"><head><meta charset="utf-8"><title>تقرير الماء والتطهير</title><style>body{font-family:Arial,Tahoma,sans-serif;padding:28px;color:#172033}header{border-bottom:3px solid #0369a1;padding-bottom:14px;margin-bottom:18px}h1{color:#075985;margin:0 0 6px}p{color:#64748b}table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #cbd5e1;padding:7px;text-align:right}th{background:#e0f2fe;color:#075985}.summary{background:#f0f9ff;padding:10px;margin:12px 0}.summary span{margin-left:14px}</style></head><body><header><h1>تقرير الماء والتطهير الصحي</h1><p>قسم الوقاية وحفظ الصحة · تقرير موحد حسب نطاق الحساب</p></header><div class="summary">${summary}</div><table><thead><tr><th>الفئة</th><th>المرجع</th><th>الجماعة</th><th>الحالة</th><th>التاريخ</th><th>التفصيل</th></tr></thead><tbody>${table}</tbody></table><script>window.onload=function(){window.print()}</script></body></html>`); popup.document.close() }
  return <div className="space-y-4"><div className="rounded-2xl bg-gradient-to-l from-sky-800 to-blue-700 p-5 text-white shadow-lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-xl font-extrabold">📊 التقرير الشامل للماء والتطهير</h3><p className="mt-1 text-xs text-sky-100">ملخص موحد للنقاط والقياسات والعينات والمعاينات والأجهزة والمسابح وحوادث الصرف.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => download(JSON.stringify(report, null, 2), 'water-report.json', 'application/json')} className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">JSON تنزيل</button><button type="button" onClick={() => download(`\uFEFF${csv}`, 'water-report.csv', 'text/csv;charset=utf-8')} className="rounded-lg bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">CSV تنزيل</button><button type="button" onClick={print} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-50">🖨️ معاينة وطباعة</button></div></div></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">{[['💧', waterPoints.length, 'نقاط'], ['🌡️', measurements.length, 'قياسات'], ['🧪', samples.length, 'عينات'], ['🔍', inspections.length, 'معاينات'], ['🧰', devices.length, 'أجهزة'], ['🏊', pools.length, 'مسابح'], ['🚿', incidents.length, 'حوادث'], ['🚨', alerts.length, 'تنبيهات']].map(([icon, value, label]) => <div key={String(label)} className="rounded-xl border border-slate-100 bg-white p-3 text-center"><div className="text-xl">{icon}</div><b className="text-xl text-slate-800">{value}</b><p className="text-[10px] text-slate-500">{label}</p></div>)}</div><div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white"><table className="w-full text-xs"><thead><tr className="border-b border-slate-100 bg-slate-50 text-slate-500"><th className="p-3 text-right">الفئة</th><th className="p-3 text-right">المرجع</th><th className="p-3 text-right">الجماعة</th><th className="p-3 text-right">الحالة</th><th className="p-3 text-right">التاريخ</th><th className="p-3 text-right">التفصيل</th></tr></thead><tbody>{rows.slice(0, 100).map((row) => <tr key={`${row.category}-${row.reference}`} className="border-b border-slate-50"><td className="p-3">{row.category}</td><td className="p-3 font-mono">{row.reference}</td><td className="p-3">{row.commune}</td><td className="p-3">{row.status}</td><td className="p-3">{fmtDate(row.date)}</td><td className="max-w-xs truncate p-3">{row.detail || '—'}</td></tr>)}</tbody></table></div></div>
}

function AlertsTab({ alerts, onNavigate, onRefresh }: { alerts: WaterAlert[]; onNavigate: (tab: WaterSubTab) => void; onRefresh: () => void }) {
  const high = alerts.filter((alert) => alert.severity === 'HIGH').length
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-red-100 bg-red-50 p-4"><div><h3 className="font-bold text-red-900">🚨 تنبيهات تتطلب الانتباه</h3><p className="mt-1 text-xs text-red-700">تُستخرج مباشرة من القياسات والمعاينات والأجهزة وحوادث الصرف ضمن نطاق الحساب.</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-700">{high} عالية</span><span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-700">{alerts.length} إجمالي</span><button type="button" onClick={onRefresh} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100">↻ تحديث</button></div></div>{alerts.length === 0 ? <Empty icon="✅" text="لا توجد تنبيهات مفتوحة ضمن النطاق" /> : <div className="space-y-2">{alerts.map((alert) => <article key={alert.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-start gap-3"><span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg ${alert.severity === 'HIGH' ? 'bg-red-100' : 'bg-amber-100'}`}>{alert.severity === 'HIGH' ? '🚨' : '⚠️'}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="font-bold text-slate-800">{alert.title}</h4><span className="font-mono text-[10px] text-slate-400">{alert.reference}</span></div><p className="mt-1 text-xs text-slate-600">{alert.detail}</p><p className="mt-1 text-[10px] text-slate-400">جماعة {alert.commune} · {fmtDate(alert.occurredAt)}</p></div></div><button type="button" onClick={() => onNavigate(alert.targetTab)} className="rounded-lg bg-sky-50 px-3 py-2 text-[11px] font-bold text-sky-700 hover:bg-sky-100">فتح القسم المعني ←</button></article>)}</div>}</div>
}

function CalibrationForm({ deviceId, onSaved }: { deviceId: string; onSaved: () => void }) {
  const [f, setF] = useState({ calibrationDate: new Date().toISOString().slice(0, 10), nextDueDate: '', performedBy: '', certificateReference: '', result: 'CONFORM', notes: '' })
  const [saving, setSaving] = useState(false)
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); try { const response = await fetch(`/api/water-devices/${deviceId}/calibrations`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, nextDueDate: f.nextDueDate || null }) }); const body = await response.json().catch(() => null); if (!response.ok) { toast.error(body?.error || 'تعذر حفظ المعايرة'); return }; toast.success('تم تسجيل المعايرة'); onSaved() } catch { toast.error('حدث خطأ') } finally { setSaving(false) } }
  return <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl border border-blue-100 bg-blue-50/50 p-3"><div className="grid grid-cols-2 gap-2"><input required type="date" value={f.calibrationDate} onChange={(event) => setF({ ...f, calibrationDate: event.target.value })} className={inp} /><input type="date" value={f.nextDueDate} onChange={(event) => setF({ ...f, nextDueDate: event.target.value })} aria-label="المعايرة المقبلة" className={inp} /></div><div className="grid grid-cols-2 gap-2"><input value={f.performedBy} onChange={(event) => setF({ ...f, performedBy: event.target.value })} placeholder="منفذ المعايرة" className={inp} /><select value={f.result} onChange={(event) => setF({ ...f, result: event.target.value })} className={inp}><option value="CONFORM">مطابق</option><option value="NON_CONFORM">غير مطابق</option><option value="PENDING">في الانتظار</option></select></div><input value={f.certificateReference} onChange={(event) => setF({ ...f, certificateReference: event.target.value })} placeholder="مرجع الشهادة" className={inp} /><input value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} placeholder="ملاحظات" className={inp} /><button disabled={saving} className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{saving ? '...' : '💾 حفظ المعايرة'}</button></form>
}

// ===== Pools Tab =====
function PoolsTab({ pools, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const { submit, saving } = useCreateModal('/api/pools', () => { setShowCreate(false); onRefresh() })
  if (loading && pools.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700">➕ مسبح جديد</button>
      </div>
      {pools.length === 0 ? <Empty icon="🏊" text="لا توجد مسابح" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {pools.map((p: Pool, i: number) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between">
                <div><div className="text-sm font-bold">{POOL_TYPE_ICONS[p.type]} {p.name}</div><div className="text-[10px] text-slate-400">{p.reference}</div></div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: (WATER_POINT_STATUS_COLORS[p.status] || '#64748b') + '15', color: WATER_POINT_STATUS_COLORS[p.status] || '#64748b' }}>{WATER_POINT_STATUS_LABELS[p.status] || p.status}</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap">
                <span>{POOL_TYPE_LABELS[p.type]}</span>
                <span>· {p.waterType === 'TREATED' ? 'معالجة' : 'طبيعية'}</span>
                {p.lastPh != null && <span>pH: {p.lastPh}</span>}
                {p.lastChlorine != null && <span>كلور: {p.lastChlorine}</span>}
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🏊 مسبح جديد" color="from-sky-600 to-blue-700">
        <PoolForm buildParams={buildParams} onSubmit={submit} saving={saving} />
      </Modal>
    </div>
  )
}

// ===== Sanitation Tab =====
function SanitationTab({ incidents, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterRisk, setFilterRisk] = useState('ALL')
  const filtered = incidents.filter((i: SanitationIncident) => (filterStatus === 'ALL' || i.status === filterStatus) && (filterRisk === 'ALL' || i.riskLevel === filterRisk) && (!search || i.reference.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase()) || i.quartier.toLowerCase().includes(search.toLowerCase())))
  const { submit, saving } = useCreateModal('/api/sanitation-incidents', () => { setShowCreate(false); onRefresh() })
  if (loading && incidents.length === 0) return <Spinner />
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {Object.entries(SANITATION_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل المخاطر</option>
          {Object.entries(SANITATION_RISK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700">➕ حادث جديد</button>
      </div>
      {filtered.length === 0 ? <Empty icon="🚿" text="لا توجد حوادث صرف" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((inc: SanitationIncident, i: number) => {
            const riskC = SANITATION_RISK_COLORS[inc.riskLevel]
            const statC = SANITATION_STATUS_COLORS[inc.status]
            return (
              <motion.div key={inc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: riskC }} />
                <div className="flex items-start justify-between pr-1">
                  <div><div className="text-sm font-bold">{SANITATION_TYPE_ICONS[inc.type]} {inc.reference}</div><div className="text-xs text-slate-600 line-clamp-2 mt-1">{inc.description}</div></div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: statC + '15', color: statC }}>{SANITATION_STATUS_LABELS[inc.status]}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: riskC + '15', color: riskC }}>{SANITATION_RISK_LABELS[inc.riskLevel]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1">
                  <span>{SANITATION_TYPE_LABELS[inc.type]}</span>
                  {inc.quartier && <span>📍 {inc.quartier}</span>}
                  <span style={{ color: COMMUNE_COLORS[inc.commune] }}>{COMMUNE_LABELS[inc.commune] || inc.commune}</span>
                  <span>· {fmtDate(inc.createdAt)}</span>
                  {inc.source === 'PUBLIC' && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">عمومي</span>}
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🚿 حادث صرف صحي جديد" color="from-sky-600 to-blue-700">
        <SanitationForm buildParams={buildParams} onSubmit={submit} saving={saving} />
      </Modal>
    </div>
  )
}

// ===== Shared UI =====
function Spinner() { return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" /></div> }
function Empty({ icon, text }: { icon: string; text: string }) { return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">{icon}</div><p className="text-sm text-slate-500">{text}</p></div> }

function Modal({ open, onClose, title, color, children }: { open: boolean; onClose: () => void; title: string; color: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
            <div className={`bg-gradient-to-l ${color} px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10`}><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button></div>
            <div className="p-5">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const inp = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-300"

// ===== Forms =====
function PointForm({ buildParams, onSubmit, saving }: any) {
  const [f, setF] = useState({ name: '', type: 'NETWORK', commune: '', quartier: '', adresse: '', latitude: '', longitude: '', operator: '', description: '' })
  const accountCommune = buildParams().get('commune') || ''
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.name) { toast.error('الاسم مطلوب'); return }; const p = buildParams(); onSubmit({ ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL', latitude: f.latitude ? parseFloat(f.latitude) : null, longitude: f.longitude ? parseFloat(f.longitude) : null }) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الاسم *</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">النوع</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}>{Object.entries(WATER_POINT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{WATER_POINT_TYPE_ICONS[k]} {v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">المُشغّل</label><input value={f.operator} onChange={(e) => setF({ ...f, operator: e.target.value })} className={inp} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div>
    </div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">العنوان</label><input value={f.adresse} onChange={(e) => setF({ ...f, adresse: e.target.value })} className={inp} /></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function MeasurementForm({ waterPoints, samples, devices, buildParams, onSubmit, saving }: { waterPoints: WaterPoint[]; samples: WaterSample[]; devices: WaterDevice[]; buildParams: () => URLSearchParams; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ waterPointId: '', sampleId: '', deviceId: '', chlorineResidual: '', ph: '', temperature: '', turbidity: '', conductivity: '', collectorName: '', notes: '' })
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.waterPointId) { toast.error('اختر نقطة مياه'); return }; const p = buildParams(); onSubmit({ ...f, commune: p.get('commune') || 'ALL', sampleId: f.sampleId || null, deviceId: f.deviceId || null, chlorineResidual: f.chlorineResidual ? parseFloat(f.chlorineResidual) : null, ph: f.ph ? parseFloat(f.ph) : null, temperature: f.temperature ? parseFloat(f.temperature) : null, turbidity: f.turbidity ? parseFloat(f.turbidity) : null, conductivity: f.conductivity ? parseFloat(f.conductivity) : null }) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">نقطة المياه *</label><select value={f.waterPointId} onChange={(e) => setF({ ...f, waterPointId: e.target.value })} className={inp}><option value="">— اختر —</option>{waterPoints.map((w: WaterPoint) => <option key={w.id} value={w.id}>{w.name} ({w.reference})</option>)}</select></div>
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select value={f.sampleId} onChange={(e) => setF({ ...f, sampleId: e.target.value })} className={inp}><option value="">🧪 عينة مرتبطة اختيارياً</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.reference}</option>)}</select><select value={f.deviceId} onChange={(e) => setF({ ...f, deviceId: e.target.value })} className={inp}><option value="">🧰 جهاز القياس اختيارياً</option>{devices.map((device) => <option key={device.id} value={device.id}>{device.name} ({device.reference})</option>)}</select></div>
    <div className="grid grid-cols-3 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الكلور (mg/L)</label><input type="number" step="0.01" value={f.chlorineResidual} onChange={(e) => setF({ ...f, chlorineResidual: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">pH</label><input type="number" step="0.1" value={f.ph} onChange={(e) => setF({ ...f, ph: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الحرارة °C</label><input type="number" step="0.1" value={f.temperature} onChange={(e) => setF({ ...f, temperature: e.target.value })} className={inp} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">التعكّر (NTU)</label><input type="number" step="0.1" value={f.turbidity} onChange={(e) => setF({ ...f, turbidity: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الموصلية (μS/cm)</label><input type="number" value={f.conductivity} onChange={(e) => setF({ ...f, conductivity: e.target.value })} className={inp} /></div>
    </div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">جامع العينة</label><input value={f.collectorName} onChange={(e) => setF({ ...f, collectorName: e.target.value })} className={inp} /></div>
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">💡 تُقيّم المطابقة تلقائياً فقط عند وجود مرجعية مهيأة. خلاف ذلك تبقى القياسات في الانتظار للمراجعة المهنية.</div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function SampleForm({ waterPoints, pools, onSubmit, saving }: { waterPoints: WaterPoint[]; pools: Pool[]; onSubmit: (body: Record<string, unknown>) => void; saving: boolean }) {
  const [f, setF] = useState({ waterPointId: '', poolId: '', sampleType: 'DRINKING_WATER', sampleDate: new Date().toISOString().slice(0, 10), sampleTime: '', collectorName: '', volumeMl: '', containerType: '', sterile: true, preservative: '', transportTemperature: '', departureAt: '', laboratoryArrivalAt: '', laboratory: '', reason: '', requestedTests: '', observation: '', status: 'COLLECTED' })
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!f.waterPointId && !f.poolId) { toast.error('اختر نقطة المياه أو المسبح'); return }
    onSubmit({ ...f, waterPointId: f.waterPointId || null, poolId: f.poolId || null, volumeMl: f.volumeMl ? Number(f.volumeMl) : null, transportTemperature: f.transportTemperature ? Number(f.transportTemperature) : null, departureAt: f.departureAt || null, laboratoryArrivalAt: f.laboratoryArrivalAt || null })
  }
  const update = (key: keyof typeof f, value: string | boolean) => setF((current) => ({ ...current, [key]: value }))
  return <form onSubmit={submit} className="space-y-3">
    <div className="rounded-xl border border-sky-100 bg-sky-50 p-3"><p className="mb-2 text-xs font-bold text-sky-800">مصدر العينة *</p><div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><select value={f.waterPointId} onChange={(event) => update('waterPointId', event.target.value)} className={inp}><option value="">💧 نقطة مياه — اختر</option>{waterPoints.map((point) => <option key={point.id} value={point.id}>{point.name} ({point.reference})</option>)}</select><select value={f.poolId} onChange={(event) => update('poolId', event.target.value)} className={inp}><option value="">🏊 مسبح — اختر</option>{pools.map((pool) => <option key={pool.id} value={pool.id}>{pool.name} ({pool.reference})</option>)}</select></div><p className="mt-1 text-[10px] text-sky-700">اختر مصدراً واحداً فقط.</p></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">نوع المياه</label><select value={f.sampleType} onChange={(event) => update('sampleType', event.target.value)} className={inp}>{Object.entries(SAMPLE_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div><div><label className="mb-1 block text-xs font-bold text-slate-600">الحالة الأولية</label><select value={f.status} onChange={(event) => update('status', event.target.value)} className={inp}>{['COLLECTED', 'LABELLED', 'STORED', 'TRANSPORTED'].map((key) => <option key={key} value={key}>{SAMPLE_STATUS_LABELS[key]}</option>)}</select></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">تاريخ الجمع *</label><input type="date" value={f.sampleDate} onChange={(event) => update('sampleDate', event.target.value)} className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">ساعة الجمع</label><input type="time" value={f.sampleTime} onChange={(event) => update('sampleTime', event.target.value)} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">جامع العينة</label><input value={f.collectorName} onChange={(event) => update('collectorName', event.target.value)} className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">الحجم (مل)</label><input type="number" min="0" value={f.volumeMl} onChange={(event) => update('volumeMl', event.target.value)} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">نوع الحاوية</label><input value={f.containerType} onChange={(event) => update('containerType', event.target.value)} placeholder="قنينة معقمة..." className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">المادة الحافظة</label><input value={f.preservative} onChange={(event) => update('preservative', event.target.value)} className={inp} /></div></div>
    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"><input type="checkbox" checked={f.sterile} onChange={(event) => update('sterile', event.target.checked)} className="h-4 w-4 accent-sky-600" /> الحاوية معقمة</label>
    <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">حرارة النقل °C</label><input type="number" step="0.1" value={f.transportTemperature} onChange={(event) => update('transportTemperature', event.target.value)} className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">المختبر</label><input value={f.laboratory} onChange={(event) => update('laboratory', event.target.value)} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">وقت الانطلاق</label><input type="datetime-local" value={f.departureAt} onChange={(event) => update('departureAt', event.target.value)} className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">الوصول للمختبر</label><input type="datetime-local" value={f.laboratoryArrivalAt} onChange={(event) => update('laboratoryArrivalAt', event.target.value)} className={inp} /></div></div>
    <div><label className="mb-1 block text-xs font-bold text-slate-600">سبب أخذ العينة</label><input value={f.reason} onChange={(event) => update('reason', event.target.value)} className={inp} /></div>
    <div><label className="mb-1 block text-xs font-bold text-slate-600">التحاليل المطلوبة</label><textarea value={f.requestedTests} onChange={(event) => update('requestedTests', event.target.value)} rows={2} placeholder="ميكروبيولوجيا، كيمياء..." className={`${inp} resize-none`} /></div>
    <div><label className="mb-1 block text-xs font-bold text-slate-600">ملاحظات</label><textarea value={f.observation} onChange={(event) => update('observation', event.target.value)} rows={2} className={`${inp} resize-none`} /></div>
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-700">يتم إنشاء أول حدث في سلسلة الحيازة تلقائياً عند الحفظ. نتائج المختبر لا تُسجل هنا قبل اعتمادها من الموظف المختص.</div>
    <button type="submit" disabled={saving} className="w-full rounded-lg bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ العينة'}</button>
  </form>
}

function PoolForm({ buildParams, onSubmit, saving }: any) {
  const [f, setF] = useState({ name: '', type: 'SWIMMING', commune: '', quartier: '', adresse: '', operator: '', waterType: 'TREATED' })
  const accountCommune = buildParams().get('commune') || ''
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.name) { toast.error('الاسم مطلوب'); return }; const p = buildParams(); onSubmit({ ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL' }) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الاسم *</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">النوع</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}>{Object.entries(POOL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{POOL_TYPE_ICONS[k]} {v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">نوع المياه</label><select value={f.waterType} onChange={(e) => setF({ ...f, waterType: e.target.value })} className={inp}><option value="TREATED">معالجة</option><option value="NATURAL">طبيعية</option></select></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div>
    </div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function SanitationForm({ buildParams, onSubmit, saving }: any) {
  const [f, setF] = useState({ type: 'BLOCKAGE', commune: '', quartier: '', adresse: '', description: '', riskLevel: 'LOW', source: 'INTERNAL', declarantName: '', declarantPhone: '', assignedTo: '' })
  const accountCommune = buildParams().get('commune') || ''
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.description) { toast.error('الوصف مطلوب'); return }; const p = buildParams(); onSubmit({ ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL' }) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">نوع الحادث</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}>{Object.entries(SANITATION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{SANITATION_TYPE_ICONS[k]} {v}</option>)}</select></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوصف *</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className={inp + ' resize-none'} /></div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">مستوى الخطر</label><select value={f.riskLevel} onChange={(e) => setF({ ...f, riskLevel: e.target.value })} className={inp}>{Object.entries(SANITATION_RISK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">المصدر</label><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={inp}><option value="INTERNAL">داخلي</option><option value="PUBLIC">عمومي</option><option value="PHONE">هاتف</option></select></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div>
    </div>
    {f.source !== 'INTERNAL' && <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">المبلّغ</label><input value={f.declarantName} onChange={(e) => setF({ ...f, declarantName: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الهاتف</label><input value={f.declarantPhone} onChange={(e) => setF({ ...f, declarantPhone: e.target.value })} className={inp} /></div>
    </div>}
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}
