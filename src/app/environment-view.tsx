'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type EnvironmentSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import {
  ENV_DOSSIER_CATEGORY_LABELS, ENV_DOSSIER_CATEGORY_ICONS,
  POLLUTION_TYPE_LABELS, POLLUTION_TYPE_ICONS, POLLUTION_SEVERITY_LABELS, POLLUTION_SEVERITY_COLORS, POLLUTION_STATUS_LABELS, POLLUTION_STATUS_COLORS,
  WASTE_TYPE_LABELS, WASTE_STATUS_LABELS, WASTE_STATUS_COLORS,
  NATURAL_SITE_TYPE_LABELS, NATURAL_SITE_TYPE_ICONS, SITE_PROTECTION_LABELS, SITE_STATUS_LABELS, SITE_STATUS_COLORS,
  CAMPAIGN_THEME_LABELS, CAMPAIGN_THEME_ICONS, CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { EnvironmentalDossier, EnvironmentalInspection, EnvironmentalProgram, EnvironmentalFollowUp, EnvironmentalComplaint, PollutionIncident, WasteBlackSpot, NaturalSite, AwarenessCampaign, EnvironmentalWaterPoint, EnvironmentalWaterMeasurement, EnvironmentalDashboardMetrics } from './environment/types'
import EnvironmentDossierDetail from './environment/detail-tab'
import EnvironmentSettingsTab from './environment/settings-tab'
import EnvironmentMapTab from './environment/map-tab'
import { useMapTerritoryScope } from '@/hooks/use-map-territory-scope'
import LocationPicker from './csvr/location-picker'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: EnvironmentSubTab; label: string; icon: string; description: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊', description: 'مؤشرات شاملة للملفات والمخاطر والبرامج والنتائج.' },
  { id: 'dossiers', label: 'الملفات البيئية', icon: '📁', description: 'سجل موحّد لتتبع الحالات البيئية من الفتح إلى الإغلاق.' },
  { id: 'map', label: 'الخريطة البيئية', icon: '🗺️', description: 'عرض جغرافي للملفات والتلوث والمياه والنفايات والمواقع الطبيعية.' },
  { id: 'inspections', label: 'المعاينات والمتابعة', icon: '🔍', description: 'توثيق المعاينات وتقييم الخطر وتحديد الإجراءات اللاحقة.' },
  { id: 'programs', label: 'البرنامج السنوي', icon: '🗓️', description: 'تخطيط العمليات البيئية وقياس الإنجاز والميزانية.' },
  { id: 'followup', label: 'المتابعة والإجراءات', icon: '📈', description: 'متابعة الإجراءات التصحيحية والآجال وإعادة المعاينة.' },
  { id: 'complaints', label: 'الشكايات البيئية', icon: '📢', description: 'استقبال الشكايات وربطها بالملفات والموقع والإجراء.' },
  { id: 'establishments', label: 'المنشآت المؤثرة', icon: '🏭', description: 'حصر المنشآت ذات التأثير البيئي ومتابعة مستوى المخاطر.' },
  { id: 'pollution', label: 'التلوث', icon: '🏭', description: 'تسجيل حوادث التلوث وتصنيف شدتها ومتابعة إجراءات التخفيف.' },
  { id: 'water', label: 'الرصد المائي والقياسات', icon: '💧', description: 'متابعة نقاط المياه وحداثة القياسات والنتائج غير المطابقة.' },
  { id: 'waste', label: 'النفايات', icon: '🗑️', description: 'رصد النقط السوداء والتكرار ونتائج التنظيف والمعالجة.' },
  { id: 'sites', label: 'المواقع الطبيعية', icon: '🌳', description: 'تتبع المواقع الطبيعية وحالتها والتهديدات الواقعة عليها.' },
  { id: 'vigilance', label: 'اليقظة والمخاطر', icon: '🚨', description: 'تجميع التنبيهات البيئية التي تستوجب التدخل أو المتابعة.' },
  { id: 'campaigns', label: 'حملات التحسيس', icon: '📢', description: 'برمجة الحملات وقياس الجمهور والنتائج وربطها بالملفات.' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️', description: 'تهيئة سير العمل والتنبيهات والخريطة والتقارير.' },
]

const TAB_GROUPS: { label: string; icon: string; description: string; panel: string; accent: string; ids: EnvironmentSubTab[] }[] = [
  { label: 'نظرة عامة وميدانياً', icon: '🧭', description: 'المؤشرات والملفات والمعاينات والبرنامج السنوي', panel: 'border-blue-200 bg-blue-50/60', accent: 'bg-blue-100 text-blue-700', ids: ['dashboard', 'map', 'dossiers', 'inspections', 'programs', 'followup', 'complaints'] },
  { label: 'المجالات البيئية', icon: '🌿', description: 'المنشآت والتلوث والمياه والنفايات والمواقع الطبيعية', panel: 'border-amber-200 bg-amber-50/60', accent: 'bg-amber-100 text-amber-700', ids: ['establishments', 'pollution', 'water', 'waste', 'sites'] },
  { label: 'اليقظة والتواصل', icon: '🚨', description: 'رصد المخاطر والحملات والإعدادات والقوالب', panel: 'border-rose-200 bg-rose-50/60', accent: 'bg-rose-100 text-rose-700', ids: ['vigilance', 'campaigns', 'settings'] },
]

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }

export default function EnvironmentView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { environmentSubTab, setEnvironmentSubTab, setCurrentView, user, selectedYear } = useAppStore()
  const [dossiers, setDossiers] = useState<EnvironmentalDossier[]>([])
  const [pollution, setPollution] = useState<PollutionIncident[]>([])
  const [waste, setWaste] = useState<WasteBlackSpot[]>([])
  const [sites, setSites] = useState<NaturalSite[]>([])
  const [campaigns, setCampaigns] = useState<AwarenessCampaign[]>([])
  const [inspections, setInspections] = useState<EnvironmentalInspection[]>([])
  const [programs, setPrograms] = useState<EnvironmentalProgram[]>([])
  const [followUps, setFollowUps] = useState<EnvironmentalFollowUp[]>([])
  const [complaints, setComplaints] = useState<EnvironmentalComplaint[]>([])
  const [waterPoints, setWaterPoints] = useState<EnvironmentalWaterPoint[]>([])
  const [waterMeasurements, setWaterMeasurements] = useState<EnvironmentalWaterMeasurement[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<EnvironmentalDashboardMetrics | null>(null)
  const [establishments, setEstablishments] = useState<Array<{ id: string; reference: string; name: string; activity: string; ownerName: string; telephone: string; commune: string; quartier: string; adresse: string; latitude: number | null; longitude: number | null; riskCategory: string; riskScore: number; status: string; _count?: { inspections: number } }>>([])
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState<string | null>(null)
  const [selectedDossier, setSelectedDossier] = useState<EnvironmentalDossier | null>(null)
  const [mapFocusDossierId, setMapFocusDossierId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openSidebarGroups, setOpenSidebarGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(TAB_GROUPS.map((group) => [group.label, true])))
  const contentTopRef = useRef<HTMLElement>(null)
  const previousSubTabRef = useRef(environmentSubTab)

  useEffect(() => {
    if (previousSubTabRef.current === environmentSubTab) return
    previousSubTabRef.current = environmentSubTab
    contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [environmentSubTab])

  const selectEnvironmentSection = useCallback((tab: EnvironmentSubTab) => {
    setEnvironmentSubTab(tab)
    window.setTimeout(() => contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }, [setEnvironmentSubTab])

  const { allowedCommunes: accountCommunes } = useMapTerritoryScope(user, selectedCommune, territoryFilter, useTerritoryFilter)

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
      const [dRes, pRes, wRes, sRes, cRes, iRes, pgRes, eRes, fRes, jRes, wpRes, wmRes, statsRes] = await Promise.allSettled([
        fetch(`/api/env-dossiers?${buildParams()}`),
        fetch(`/api/pollution-incidents?${buildParams()}`),
        fetch(`/api/waste-black-spots?${buildParams()}`),
        fetch(`/api/natural-sites?${buildParams()}`),
        fetch(`/api/awareness-campaigns?${buildParams()}`),
        fetch(`/api/environmental-inspections?${buildParams()}`),
        fetch(`/api/environmental-programs?${buildParams()}`),
        fetch(`/api/establishments?${buildParams()}`),
        fetch(`/api/environmental-followups?${buildParams()}`),
        fetch(`/api/complaints?${buildParams({ type: 'ENVIRONMENT' })}`),
        fetch(`/api/water-points?${buildParams()}`),
        fetch(`/api/water-measurements?${buildParams()}`),
        fetch(`/api/environment/statistics?${buildParams()}`),
      ])
      if (dRes.status === 'fulfilled' && dRes.value.ok) { const d = await dRes.value.json(); setDossiers(d.dossiers || []) }
      if (pRes.status === 'fulfilled' && pRes.value.ok) { const d = await pRes.value.json(); setPollution(d.incidents || []) }
      if (wRes.status === 'fulfilled' && wRes.value.ok) { const d = await wRes.value.json(); setWaste(d.spots || []) }
      if (sRes.status === 'fulfilled' && sRes.value.ok) { const d = await sRes.value.json(); setSites(d.sites || []) }
      if (cRes.status === 'fulfilled' && cRes.value.ok) { const d = await cRes.value.json(); setCampaigns(d.campaigns || []) }
      if (iRes.status === 'fulfilled' && iRes.value.ok) { const d = await iRes.value.json(); setInspections(d.inspections || []) }
      if (pgRes.status === 'fulfilled' && pgRes.value.ok) { const d = await pgRes.value.json(); setPrograms(d.programs || []) }
      if (eRes.status === 'fulfilled' && eRes.value.ok) { const d = await eRes.value.json(); setEstablishments(d.establishments || []) }
      if (fRes.status === 'fulfilled' && fRes.value.ok) { const d = await fRes.value.json(); setFollowUps(d.followUps || []) }
      if (jRes.status === 'fulfilled' && jRes.value.ok) { const d = await jRes.value.json(); setComplaints(d.complaints || []) }
      if (wpRes.status === 'fulfilled' && wpRes.value.ok) { const d = await wpRes.value.json(); setWaterPoints(d.waterPoints || []) }
      if (wmRes.status === 'fulfilled' && wmRes.value.ok) { const d = await wmRes.value.json(); setWaterMeasurements(d.measurements || []) }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) { const d = await statsRes.value.json(); setDashboardMetrics(d.metrics || null) }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => {
    const critical = pollution.filter(p => p.severity === 'CRITICAL' || p.severity === 'HIGH').length
    const recurring = waste.filter(w => w.recurring).length
    const threatened = sites.filter(s => s.status === 'THREATENED' || s.status === 'DEGRADED').length
    const open = dossiers.filter(d => d.status !== 'CLOSED').length
    return { critical, recurring, threatened, open }
  }, [pollution, waste, sites, dossiers])
  const activeTab = TABS.find((tab) => tab.id === environmentSubTab) || TABS[0]

  return (
    <div className="environment-module space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-amber-700 to-orange-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">🌿</span> المحافظة على البيئة</h1>
            <p className="text-amber-50 text-xs sm:text-sm mt-0.5">نظام تدبير بيئي موحّد — الملفات، المعاينات، التلوث، النفايات والمواقع الطبيعية — المكتب 06</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            {stats.critical > 0 && <div className="bg-red-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-red-100">{stats.critical}</div><div className="text-[10px] opacity-80 mt-0.5">تلوث خطير</div></div>}
            {stats.recurring > 0 && <div className="bg-amber-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-amber-100">{stats.recurring}</div><div className="text-[10px] opacity-80 mt-0.5">رمي متكرر</div></div>}
            {stats.threatened > 0 && <div className="bg-orange-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-orange-100">{stats.threatened}</div><div className="text-[10px] opacity-80 mt-0.5">موقع مهدّد</div></div>}
          </div>
        </div>
      </div>

      <div className={`grid items-start gap-4 ${sidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
        <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1" onWheel={(event) => event.stopPropagation()}>
          <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            <div className={`mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg">🌿</span>
              {!sidebarCollapsed && <div className="min-w-0"><h2 className="text-sm font-extrabold text-slate-800">أقسام المحافظة على البيئة</h2><p className="mt-0.5 text-[10px] text-slate-500">اختر القسم المطلوب</p></div>}
              <button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="mr-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700" aria-label={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'} title={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'}>{sidebarCollapsed ? '»' : '«'}</button>
            </div>
            <nav className="space-y-2" aria-label="أقسام المحافظة على البيئة">
              {TAB_GROUPS.map((group) => <section key={group.label} className={`rounded-xl border p-2 ${group.panel}`}>
                <button type="button" onClick={() => setOpenSidebarGroups((current) => ({ ...current, [group.label]: !current[group.label] }))} aria-expanded={openSidebarGroups[group.label]} className={`mb-1.5 flex w-full items-center gap-1.5 rounded-lg px-1 text-right transition hover:bg-white/60 ${sidebarCollapsed ? 'justify-center' : ''}`} title={openSidebarGroups[group.label] ? 'طي المجموعة' : 'إظهار المجموعة'}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${group.accent}`}>{group.icon}</span>
                  {!sidebarCollapsed && <span className="text-[11px] font-extrabold text-slate-700">{group.label}</span>}
                  {!sidebarCollapsed && <span className="mr-auto text-[10px] text-slate-400">{openSidebarGroups[group.label] ? '⌃' : '⌄'}</span>}
                </button>
                {openSidebarGroups[group.label] && <div className="space-y-1">{group.ids.map((id) => { const tab = TABS.find((entry) => entry.id === id); if (!tab) return null; return <button key={tab.id} type="button" onClick={() => selectEnvironmentSection(tab.id)} aria-label={tab.label} title={sidebarCollapsed ? tab.label : undefined} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-semibold transition-all ${sidebarCollapsed ? 'justify-center px-1' : ''} ${environmentSubTab === tab.id ? 'bg-amber-500 text-white shadow-sm' : 'bg-white/85 text-slate-600 hover:bg-white hover:text-amber-700'}`}><span className="text-sm">{tab.icon}</span>{!sidebarCollapsed && <span>{tab.label}</span>}</button> })}</div>}
              </section>)}
            </nav>
          </div>
        </aside>

        <main ref={contentTopRef} className="min-w-0 scroll-mt-32">
          {environmentSubTab !== 'map' && environmentSubTab !== 'water' && environmentSubTab !== 'vigilance' && environmentSubTab !== 'settings' && <div className="mb-3 rounded-2xl bg-gradient-to-l from-amber-800 to-orange-500 p-4 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-2xl">{activeTab.icon}</span><div className="min-w-0"><p className="text-[10px] font-bold text-amber-100">المحافظة على البيئة · المكتب 06</p><h2 className="truncate text-base font-extrabold sm:text-lg">{activeTab.label}</h2><p className="mt-1 text-xs text-amber-50">{activeTab.description}</p></div></div><span className="rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold">القسم الحالي</span></div></div>}
          <AnimatePresence mode="wait">
            <motion.div key={environmentSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {environmentSubTab === 'dashboard' && <Dashboard dossiers={dossiers} pollution={pollution} waste={waste} sites={sites} campaigns={campaigns} inspections={inspections} programs={programs} followUps={followUps} complaints={complaints} establishments={establishments} waterPoints={waterPoints} waterMeasurements={waterMeasurements} dashboardMetrics={dashboardMetrics} onNavigate={selectEnvironmentSection} />}
          {environmentSubTab === 'dossiers' && <DossiersTab data={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} allowedCommunes={accountCommunes} showCreate={showCreate === 'dossier'} setShowCreate={(v) => setShowCreate(v ? 'dossier' : null)} onOpenDetail={(dossier: EnvironmentalDossier) => { setSelectedDossier(dossier); setEnvironmentSubTab('detail') }} />}
              {environmentSubTab === 'map' && <EnvironmentMapTab selectedCommune={selectedCommune} territoryFilter={territoryFilter} useTerritoryFilter={useTerritoryFilter} allowedCommunes={accountCommunes} focusDossierId={mapFocusDossierId} onOpenDossier={(id) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} />}
          {environmentSubTab === 'detail' && selectedDossier && <EnvironmentDossierDetail dossier={selectedDossier} onBack={() => setEnvironmentSubTab('dossiers')} onRefresh={refresh} />}
          {environmentSubTab === 'inspections' && <InspectionsTab data={inspections} dossiers={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'inspection'} setShowCreate={(value: boolean) => setShowCreate(value ? 'inspection' : null)} onOpenDossier={(id: string) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} onOpenMap={(id: string) => { setMapFocusDossierId(id); setEnvironmentSubTab('map') }} />}
          {environmentSubTab === 'programs' && <ProgramsTab data={programs} dossiers={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'program'} setShowCreate={(value: boolean) => setShowCreate(value ? 'program' : null)} />}
              {environmentSubTab === 'followup' && <FollowUpsTab data={followUps} dossiers={dossiers} onRefresh={refresh} onOpenDossiers={() => setEnvironmentSubTab('dossiers')} onOpenDossier={(id: string) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} onOpenMap={(id: string) => { setMapFocusDossierId(id); setEnvironmentSubTab('map') }} />}
              {environmentSubTab === 'complaints' && <EnvironmentalComplaintsTab complaints={complaints} dossiers={dossiers} onRefresh={refresh} onOpenDossier={(id: string) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} onOpenMap={(id: string) => { setMapFocusDossierId(id); setEnvironmentSubTab('map') }} />}
          {environmentSubTab === 'establishments' && <EnvironmentalEstablishmentsTab data={establishments} loading={loading} />}
          {environmentSubTab === 'pollution' && <PollutionTab data={pollution} dossiers={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} allowedCommunes={accountCommunes} showCreate={showCreate === 'pollution'} setShowCreate={(v) => setShowCreate(v ? 'pollution' : null)} onOpenDossier={(id: string) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} onOpenMap={(id: string) => { setMapFocusDossierId(id); setEnvironmentSubTab('map') }} />}
          {environmentSubTab === 'water' && <EnvironmentalWaterMonitoringTab waterPoints={waterPoints} measurements={waterMeasurements} loading={loading} onRefresh={refresh} onOpenWaterOffice={() => setCurrentView('water')} />}
          {environmentSubTab === 'waste' && <WasteTab data={waste} dossiers={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} allowedCommunes={accountCommunes} showCreate={showCreate === 'waste'} setShowCreate={(v) => setShowCreate(v ? 'waste' : null)} onOpenDossier={(id: string) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} onOpenMap={(id: string) => { setMapFocusDossierId(id); setEnvironmentSubTab('map') }} />}
          {environmentSubTab === 'sites' && <SitesTab data={sites} dossiers={dossiers} loading={loading} onRefresh={refresh} buildParams={buildParams} allowedCommunes={accountCommunes} showCreate={showCreate === 'site'} setShowCreate={(v) => setShowCreate(v ? 'site' : null)} onOpenDossier={(id: string) => { const dossier = dossiers.find((item) => item.id === id); if (dossier) { setSelectedDossier(dossier); setEnvironmentSubTab('detail') } }} onOpenMap={(id: string) => { setMapFocusDossierId(id); setEnvironmentSubTab('map') }} />}
              {environmentSubTab === 'vigilance' && <VigilanceTab dossiers={dossiers} pollution={pollution} waste={waste} waterPoints={waterPoints} waterMeasurements={waterMeasurements} onNavigate={selectEnvironmentSection} />}
          {environmentSubTab === 'campaigns' && <CampaignsTab data={campaigns} dossiers={dossiers} programs={programs} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'campaign'} setShowCreate={(v) => setShowCreate(v ? 'campaign' : null)} />}
              {environmentSubTab === 'settings' && <EnvironmentSettingsTab selectedCommune={selectedCommune} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

// ===== Dashboard =====
type DashboardEstablishment = { id: string; name: string; riskCategory: string; riskScore: number; status: string }

function Dashboard({ dossiers, pollution, waste, sites, campaigns, inspections, programs, followUps, complaints, establishments, waterPoints, waterMeasurements, dashboardMetrics, onNavigate }: { dossiers: EnvironmentalDossier[]; pollution: PollutionIncident[]; waste: WasteBlackSpot[]; sites: NaturalSite[]; campaigns: AwarenessCampaign[]; inspections: EnvironmentalInspection[]; programs: EnvironmentalProgram[]; followUps: EnvironmentalFollowUp[]; complaints: EnvironmentalComplaint[]; establishments: DashboardEstablishment[]; waterPoints: EnvironmentalWaterPoint[]; waterMeasurements: EnvironmentalWaterMeasurement[]; dashboardMetrics?: EnvironmentalDashboardMetrics | null; onNavigate: (tab: EnvironmentSubTab) => void }) {
  const closedStatuses = ['RESOLVED', 'CLOSED', 'ARCHIVED']
  const now = Date.now()
  const sevenDays = now + 7 * 86400000
  const openDossiers = dossiers.filter((item) => !closedStatuses.includes(item.status))
  const resolvedDossiers = dossiers.filter((item) => closedStatuses.includes(item.status))
  const overdueDossiers = openDossiers.filter((item) => item.dueDate && new Date(item.dueDate).getTime() < now)
  const dueSoonDossiers = openDossiers.filter((item) => item.dueDate && new Date(item.dueDate).getTime() >= now && new Date(item.dueDate).getTime() <= sevenDays)
  const highRiskDossiers = openDossiers.filter((item) => item.riskLevel === 'HIGH' || item.riskLevel === 'CRITICAL')
  const openPollution = pollution.filter((item) => !closedStatuses.includes(item.status))
  const criticalPollution = openPollution.filter((item) => item.severity === 'CRITICAL' || item.severity === 'HIGH')
  const activeWaste = waste.filter((item) => !closedStatuses.includes(item.status))
  const recurringWaste = activeWaste.filter((item) => item.recurring || item.recurrenceCount > 1)
  const threatenedSites = sites.filter((item) => item.status === 'THREATENED' || item.status === 'DEGRADED')
  const dueInspections = inspections.filter((item) => item.nextFollowUpDate && new Date(item.nextFollowUpDate).getTime() < now)
  const openFollowUps = followUps.filter((item) => item.damageRemoved !== 'YES')
  const overdueFollowUps = openFollowUps.filter((item) => item.nextFollowUpDate && new Date(item.nextFollowUpDate).getTime() < now)
  const activePrograms = programs.filter((item) => !closedStatuses.includes(item.status))
  const programProgress = programs.length ? Math.round(programs.reduce((sum, item) => sum + Math.min(100, Math.max(0, item.progress || 0)), 0) / programs.length) : 0
  const activeCampaigns = campaigns.filter((item) => !closedStatuses.includes(item.status))
  const openComplaints = complaints.filter((item) => !closedStatuses.includes(item.statut))
  const unlinkedComplaints = complaints.filter((item) => !item.environmentalDossierId)
  const highRiskEstablishments = establishments.filter((item) => item.riskCategory === 'HIGH' || item.riskCategory === 'CRITICAL' || item.riskScore >= 70)
  const latestMeasurementByPoint = new Map<string, EnvironmentalWaterMeasurement>()
  for (const measurement of waterMeasurements) { const current = latestMeasurementByPoint.get(measurement.waterPointId); if (!current || new Date(measurement.measurementDate).getTime() > new Date(current.measurementDate).getTime()) latestMeasurementByPoint.set(measurement.waterPointId, measurement) }
  const staleWaterPoints = waterPoints.filter((point) => { const latest = latestMeasurementByPoint.get(point.id); return !latest || now - new Date(latest.measurementDate).getTime() > 90 * 86400000 })
  const nonConformingWaterMeasurements = waterMeasurements.filter((item) => item.conformity === 'NON_CONFORM')
  const totalRecords = dossiers.length + pollution.length + waste.length + sites.length + campaigns.length + inspections.length + programs.length + followUps.length + complaints.length + establishments.length + waterPoints.length + waterMeasurements.length
  const linkedRecords = pollution.filter((item) => item.environmentalDossierId).length + waste.filter((item) => item.environmentalDossierId).length + sites.filter((item) => item.environmentalDossierId).length + campaigns.filter((item) => item.environmentalDossierId).length + complaints.filter((item) => item.environmentalDossierId).length
  const closedWithDates = resolvedDossiers.filter((item) => item.closedAt)
  const averageDays = closedWithDates.length ? Math.round(closedWithDates.reduce((sum, item) => sum + Math.max(0, (new Date(item.closedAt as string).getTime() - new Date(item.createdAt).getTime()) / 86400000), 0) / closedWithDates.length) : 0

  if (!dashboardMetrics && totalRecords === 0) return <div className="rounded-2xl border border-slate-100 bg-white p-12 text-center"><div className="text-6xl mb-4">🌳</div><h3 className="text-lg font-bold text-slate-700">لا توجد بيانات بيئية بعد</h3><p className="mt-2 text-sm text-slate-500">سجّل ملفاً بيئياً أو أضف معاينة أو نقطة بيئية لبدء لوحة القيادة.</p></div>

  const kpis: { icon: string; value: number | string; label: string; detail: string; go: EnvironmentSubTab; tone: string }[] = [
    { icon: '📁', value: dashboardMetrics?.dossiersTotal ?? dossiers.length, label: 'الملفات البيئية', detail: `${dashboardMetrics?.openDossiers ?? openDossiers.length} مفتوح`, go: 'dossiers', tone: 'from-blue-50 to-white border-blue-100 text-blue-800' },
    { icon: '🔍', value: dashboardMetrics?.inspectionsTotal ?? inspections.length, label: 'المعاينات', detail: `${dashboardMetrics?.overdueInspections ?? dueInspections.length} تحتاج متابعة`, go: 'inspections', tone: 'from-violet-50 to-white border-violet-100 text-violet-800' },
    { icon: '🏭', value: dashboardMetrics?.pollutionTotal ?? pollution.length, label: 'حوادث التلوث', detail: `${dashboardMetrics?.criticalPollution ?? criticalPollution.length} عالية الخطورة`, go: 'pollution', tone: 'from-red-50 to-white border-red-100 text-red-800' },
    { icon: '💧', value: dashboardMetrics?.waterPoints ?? waterPoints.length, label: 'نقاط الرصد المائي', detail: `${dashboardMetrics?.nonConformingWaterMeasurements ?? nonConformingWaterMeasurements.length} غير مطابقة`, go: 'water', tone: 'from-sky-50 to-white border-sky-100 text-sky-800' },
    { icon: '🗑️', value: dashboardMetrics?.wasteTotal ?? waste.length, label: 'نقاط النفايات', detail: `${dashboardMetrics?.recurringWaste ?? recurringWaste.length} متكررة`, go: 'waste', tone: 'from-amber-50 to-white border-amber-100 text-amber-800' },
    { icon: '🌳', value: sites.length, label: 'المواقع الطبيعية', detail: `${dashboardMetrics?.threatenedSites ?? threatenedSites.length} مهددة`, go: 'sites', tone: 'from-emerald-50 to-white border-emerald-100 text-emerald-800' },
    { icon: '🗓️', value: dashboardMetrics?.programsTotal ?? programs.length, label: 'البرامج السنوية', detail: `${dashboardMetrics?.activePrograms ?? activePrograms.length} نشط · ${programProgress}% إنجاز`, go: 'programs', tone: 'from-cyan-50 to-white border-cyan-100 text-cyan-800' },
    { icon: '📈', value: dashboardMetrics?.followUpsTotal ?? followUps.length, label: 'المتابعات', detail: `${dashboardMetrics?.overdueFollowUps ?? overdueFollowUps.length} متأخرة`, go: 'followup', tone: 'from-orange-50 to-white border-orange-100 text-orange-800' },
    { icon: '📢', value: dashboardMetrics?.environmentalComplaints ?? complaints.length, label: 'الشكايات البيئية', detail: `${dashboardMetrics?.openEnvironmentalComplaints ?? openComplaints.length} مفتوح · ${unlinkedComplaints.length} دون ملف`, go: 'complaints', tone: 'from-pink-50 to-white border-pink-100 text-pink-800' },
    { icon: '🏢', value: establishments.length, label: 'المنشآت المؤثرة', detail: `${highRiskEstablishments.length} عالية الخطورة`, go: 'establishments', tone: 'from-slate-100 to-white border-slate-200 text-slate-800' },
    { icon: '📣', value: dashboardMetrics?.campaignsTotal ?? campaigns.length, label: 'حملات التحسيس', detail: `${dashboardMetrics?.activeCampaigns ?? activeCampaigns.length} نشطة`, go: 'campaigns', tone: 'from-fuchsia-50 to-white border-fuchsia-100 text-fuchsia-800' },
  ]
  const priorities = [
    { icon: '⏰', title: 'ملفات تجاوزت الأجل', count: overdueDossiers.length, text: 'تحتاج إلى إجراء وتصحيح فوري', go: 'dossiers' as const, tone: 'border-red-200 bg-red-50 text-red-800' },
    { icon: '🚨', title: 'تلوث عالي الخطورة', count: criticalPollution.length, text: 'يلزم التحقق من التدابير والنتيجة', go: 'pollution' as const, tone: 'border-orange-200 bg-orange-50 text-orange-800' },
    { icon: '📍', title: 'متابعات ميدانية متأخرة', count: overdueFollowUps.length + dueInspections.length, text: 'معاينات أو إجراءات لم تُغلق بعد', go: 'followup' as const, tone: 'border-amber-200 bg-amber-50 text-amber-800' },
    { icon: '🗑️', title: 'نقاط رمي متكررة', count: recurringWaste.length, text: 'تستوجب حملة أو إجراءاً وقائياً', go: 'waste' as const, tone: 'border-yellow-200 bg-yellow-50 text-yellow-800' },
    { icon: '📢', title: 'شكايات دون ملف بيئي', count: unlinkedComplaints.length, text: 'يمكن ربطها بملف للتتبع الموحد', go: 'complaints' as const, tone: 'border-pink-200 bg-pink-50 text-pink-800' },
    { icon: '💧', title: 'رصد مائي غير مطابق أو متأخر', count: nonConformingWaterMeasurements.length + staleWaterPoints.length, text: 'يلزم إعادة أخذ العينات والتحقق الميداني', go: 'water' as const, tone: 'border-sky-200 bg-sky-50 text-sky-800' },
  ].filter((item) => item.count > 0)
  const activity = [
    ...dossiers.map((item) => ({ date: item.createdAt, reference: item.reference, label: item.title || 'ملف بيئي', icon: '📁', go: 'dossiers' as const })),
    ...pollution.map((item) => ({ date: item.createdAt, reference: item.reference, label: POLLUTION_TYPE_LABELS[item.type] || 'حادث تلوث', icon: '🏭', go: 'pollution' as const })),
    ...inspections.map((item) => ({ date: item.createdAt, reference: item.reference, label: 'معاينة ميدانية', icon: '🔍', go: 'inspections' as const })),
    ...complaints.map((item) => ({ date: item.createdAt, reference: item.reference, label: 'شكاية بيئية', icon: '📢', go: 'complaints' as const })),
    ...waterMeasurements.map((item) => ({ date: item.createdAt, reference: item.reference, label: item.conformity === 'NON_CONFORM' ? 'قياس مائي غير مطابق' : 'قياس مائي', icon: '💧', go: 'water' as const })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6)
  const months = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index)); const count = dossiers.filter((item) => { const created = new Date(item.createdAt); return created.getFullYear() === date.getFullYear() && created.getMonth() === date.getMonth() }).length; return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('ar-MA', { month: 'short' }), count } })
  const maxMonth = Math.max(1, ...months.map((item) => item.count))
  const resolvedPercentage = dossiers.length ? Math.round((resolvedDossiers.length / dossiers.length) * 100) : 0

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 via-white to-emerald-50 p-4"><div><h3 className="text-base font-extrabold text-slate-800">📊 لوحة القيادة البيئية الموحدة</h3><p className="mt-1 text-xs text-slate-500">تجميع حي للملفات والمعاينات والمخاطر والبرامج والشكايات ضمن نطاق الحساب الحالي.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-600 shadow-sm">{totalRecords} سجل إجمالاً</span><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-[11px] font-bold text-emerald-700">{linkedRecords} مرتبط بملف</span></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{kpis.map((kpi, index) => <motion.button key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }} onClick={() => onNavigate(kpi.go)} className={`rounded-2xl border bg-gradient-to-br p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${kpi.tone}`}><div className="flex items-center justify-between gap-2"><span className="text-xl">{kpi.icon}</span><span className="text-2xl font-black">{kpi.value}</span></div><p className="mt-1 text-xs font-bold">{kpi.label}</p><p className="mt-1 text-[10px] opacity-70">{kpi.detail}</p></motion.button>)}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4"><p className="text-xs font-bold text-emerald-700">نسبة الملفات المحلولة</p><p className="mt-1 text-2xl font-black text-emerald-800">{resolvedPercentage}%</p><p className="mt-1 text-[11px] text-emerald-700">{resolvedDossiers.length} من أصل {dossiers.length}</p></div><div className="rounded-2xl border border-red-100 bg-red-50/70 p-4"><p className="text-xs font-bold text-red-700">ملفات متأخرة</p><p className="mt-1 text-2xl font-black text-red-800">{overdueDossiers.length}</p><p className="mt-1 text-[11px] text-red-700">من أصل {openDossiers.length} ملف مفتوح</p></div><div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-4"><p className="text-xs font-bold text-blue-700">متوسط مدة المعالجة</p><p className="mt-1 text-2xl font-black text-blue-800">{averageDays} <span className="text-xs font-normal">يوماً</span></p><p className="mt-1 text-[11px] text-blue-700">اعتماداً على الملفات المغلقة</p></div><div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4"><p className="text-xs font-bold text-amber-700">آجال خلال 7 أيام</p><p className="mt-1 text-2xl font-black text-amber-800">{dueSoonDossiers.length}</p><p className="mt-1 text-[11px] text-amber-700">ملفات تستوجب التخطيط المسبق</p></div></div>
    <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="text-sm font-extrabold text-slate-800">🎯 قائمة الأولويات التشغيلية</h3><p className="mt-1 text-[11px] text-slate-500">اضغط على أي بطاقة للانتقال إلى القسم ومعالجة الوضعية.</p></div><span className="rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold text-red-700">{priorities.reduce((sum, item) => sum + item.count, 0)} أولوية</span></div>{priorities.length === 0 ? <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-5 text-center text-sm font-bold text-emerald-700">✅ لا توجد تنبيهات تشغيلية عاجلة ضمن النطاق الحالي</div> : <div className="grid gap-2 sm:grid-cols-2">{priorities.map((item) => <button key={item.title} type="button" onClick={() => onNavigate(item.go)} className={`flex items-center gap-3 rounded-xl border p-3 text-right transition hover:shadow-sm ${item.tone}`}><span className="text-xl">{item.icon}</span><span className="min-w-0 flex-1"><span className="block text-xs font-extrabold">{item.title}</span><span className="mt-1 block text-[10px] opacity-75">{item.text}</span></span><b className="text-xl">{item.count}</b></button>)}</div>}</section>
      <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-extrabold text-slate-800">🧭 مؤشرات التغطية والإنجاز</h3><div className="space-y-3"><div><div className="mb-1 flex justify-between text-[11px] font-bold text-slate-600"><span>إنجاز البرامج السنوية</span><span>{programProgress}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${programProgress}%` }} /></div></div><div><div className="mb-1 flex justify-between text-[11px] font-bold text-slate-600"><span>ربط السجلات بالملفات</span><span>{totalRecords ? Math.round((linkedRecords / Math.max(1, pollution.length + waste.length + sites.length + campaigns.length + complaints.length)) * 100) : 0}%</span></div><div className="h-2.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, totalRecords ? (linkedRecords / Math.max(1, pollution.length + waste.length + sites.length + campaigns.length + complaints.length)) * 100 : 0)}%` }} /></div></div><div className="grid grid-cols-2 gap-2 pt-1"><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] text-slate-500">متابعات مفتوحة</p><b className="text-lg text-slate-800">{openFollowUps.length}</b></div><div className="rounded-xl bg-slate-50 p-2.5"><p className="text-[10px] text-slate-500">منشآت عالية الخطورة</p><b className="text-lg text-slate-800">{highRiskEstablishments.length}</b></div></div></div></section>
    </div>
    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-extrabold text-slate-800">🏭 توزيع حوادث التلوث حسب النوع</h3>{pollution.length === 0 ? <Empty icon="🏭" text="لا توجد حوادث تلوث ضمن النطاق" /> : <div className="space-y-2">{Object.entries(pollution.reduce((acc: Record<string, number>, item) => { acc[item.type] = (acc[item.type] || 0) + 1; return acc }, {})).sort((a, b) => b[1] - a[1]).map(([type, count]) => <div key={type} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0 truncate">{POLLUTION_TYPE_ICONS[type]} {POLLUTION_TYPE_LABELS[type] || type}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.max(5, (count / pollution.length) * 100)}%` }} /></div><b className="w-6 text-left">{count}</b></div>)}</div>}</section><section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-extrabold text-slate-800">⚠️ توزيع مخاطر الملفات</h3>{(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((level) => { const count = dossiers.filter((item) => item.riskLevel === level).length; const colors: Record<string, string> = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626' }; const labels: Record<string, string> = { LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'عالٍ', CRITICAL: 'حرج' }; return <div key={level} className="mb-2 flex items-center gap-2 text-xs"><span className="w-16">{labels[level]}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${dossiers.length ? Math.max(count ? 4 : 0, (count / dossiers.length) * 100) : 0}%`, backgroundColor: colors[level] }} /></div><b className="w-6 text-left">{count}</b></div> })}</section></div>
    <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><h3 className="mb-3 text-sm font-extrabold text-slate-800">📈 تطور الملفات خلال آخر 6 أشهر</h3><div className="flex h-36 items-end justify-between gap-2">{months.map((month) => <div key={month.key} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><span className="text-[10px] font-bold text-slate-600">{month.count}</span><div className="w-full rounded-t-lg bg-emerald-500" style={{ height: `${Math.max(6, (month.count / maxMonth) * 100)}%` }} /><span className="text-[10px] text-slate-400">{month.label}</span></div>)}</div></section><section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-extrabold text-slate-800">🕘 آخر النشاطات</h3><span className="text-[10px] text-slate-400">الأحدث أولاً</span></div>{activity.length === 0 ? <Empty icon="🕘" text="لا توجد نشاطات حديثة" /> : <div className="space-y-2">{activity.map((item) => <button key={`${item.reference}-${item.date}`} type="button" onClick={() => onNavigate(item.go)} className="flex w-full items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-right transition hover:bg-amber-50"><span className="text-lg">{item.icon}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-slate-700">{item.label}</span><span className="block text-[10px] text-slate-400">{item.reference} · {fmtDate(item.date)}</span></span><span className="text-xs text-amber-600">←</span></button>)}</div>}</section></div>
  </div>
}

function EnvironmentalWaterMonitoringTab({ waterPoints, measurements, loading, onRefresh, onOpenWaterOffice }: { waterPoints: EnvironmentalWaterPoint[]; measurements: EnvironmentalWaterMeasurement[]; loading: boolean; onRefresh: () => void; onOpenWaterOffice: () => void }) {
  const [search, setSearch] = useState('')
  const [conformityFilter, setConformityFilter] = useState('ALL')
  const [staleOnly, setStaleOnly] = useState(false)
  const now = Date.now()
  const conformityLabels: Record<string, string> = { CONFORM: 'مطابق', NON_CONFORM: 'غير مطابق', PENDING: 'في انتظار النتيجة' }
  const conformityColors: Record<string, string> = { CONFORM: 'bg-emerald-50 text-emerald-700', NON_CONFORM: 'bg-red-50 text-red-700', PENDING: 'bg-amber-50 text-amber-700' }
  const typeLabels: Record<string, string> = { NETWORK: 'شبكة التوزيع', RESERVOIR: 'خزان', TOWER: 'برج مائي', FOUNTAIN: 'نافورة', WELL: 'بئر', BOREHOLE: 'ثقب مائي', SOURCE: 'نبع', CISTERN: 'صهريج', INSTITUTION: 'مؤسسة' }
  const latestMeasurementByPoint = useMemo(() => {
    const latest = new Map<string, EnvironmentalWaterMeasurement>()
    for (const measurement of measurements) { const current = latest.get(measurement.waterPointId); if (!current || new Date(measurement.measurementDate).getTime() > new Date(current.measurementDate).getTime()) latest.set(measurement.waterPointId, measurement) }
    return latest
  }, [measurements])
  const isStale = (point: EnvironmentalWaterPoint) => { const latest = latestMeasurementByPoint.get(point.id); return !latest || now - new Date(latest.measurementDate).getTime() > 90 * 86400000 }
  const stalePoints = waterPoints.filter(isStale)
  const nonConforming = measurements.filter((measurement) => measurement.conformity === 'NON_CONFORM')
  const filteredMeasurements = measurements.filter((measurement) => conformityFilter === 'ALL' || measurement.conformity === conformityFilter).filter((measurement) => !search || `${measurement.reference} ${measurement.waterPoint?.name || ''} ${measurement.waterPoint?.reference || ''}`.toLowerCase().includes(search.toLowerCase()))
  const filteredPoints = waterPoints.filter((point) => (!staleOnly || isStale(point)) && (!search || `${point.name} ${point.reference} ${point.quartier}`.toLowerCase().includes(search.toLowerCase())))
  if (loading && waterPoints.length === 0 && measurements.length === 0) return <Spinner />
  return <div className="space-y-4" dir="rtl">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-sky-100 bg-gradient-to-l from-sky-700 to-cyan-600 p-4 text-white shadow-sm"><div><h3 className="text-base font-extrabold">💧 الرصد المائي والقياسات البيئية</h3><p className="mt-1 text-xs text-sky-50">متابعة جودة نقاط المياه داخل نطاق الحساب وربط النتائج بالمعاينة والإجراء التصحيحي.</p></div><div className="flex gap-2"><button type="button" onClick={onRefresh} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">🔄 تحديث</button><button type="button" onClick={onOpenWaterOffice} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-50">فتح مكتب الماء والتطهير</button></div></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><div className="rounded-2xl border border-sky-100 bg-sky-50 p-4"><p className="text-[11px] font-bold text-sky-700">نقاط الرصد</p><b className="text-2xl text-sky-900">{waterPoints.length}</b></div><div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-[11px] font-bold text-indigo-700">إجمالي القياسات</p><b className="text-2xl text-indigo-900">{measurements.length}</b></div><div className="rounded-2xl border border-red-100 bg-red-50 p-4"><p className="text-[11px] font-bold text-red-700">غير مطابق</p><b className="text-2xl text-red-900">{nonConforming.length}</b></div><div className="rounded-2xl border border-amber-100 bg-amber-50 p-4"><p className="text-[11px] font-bold text-amber-700">رصد متأخر</p><b className="text-2xl text-amber-900">{stalePoints.length}</b><p className="mt-1 text-[10px] text-amber-700">أكثر من 90 يوماً أو دون قياس</p></div></div>
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث في النقاط والقياسات..." className="min-w-[210px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-sky-400" /><select value={conformityFilter} onChange={(event) => setConformityFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل نتائج القياسات</option><option value="CONFORM">مطابق</option><option value="NON_CONFORM">غير مطابق</option><option value="PENDING">في انتظار النتيجة</option></select><button type="button" onClick={() => setStaleOnly((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${staleOnly ? 'border-amber-300 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600'}`}>⏱️ النقاط المتأخرة فقط</button></div>
    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]"><section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-extrabold text-slate-800">📍 حالة نقاط الرصد</h4><p className="mt-1 text-[10px] text-slate-500">تُعتبر النقطة متأخرة إذا لم تسجل قياساً خلال 90 يوماً.</p></div><span className="text-xs font-bold text-slate-400">{filteredPoints.length} نقطة</span></div>{filteredPoints.length === 0 ? <Empty icon="💧" text="لا توجد نقاط مطابقة للفلتر" /> : <div className="space-y-2">{filteredPoints.slice(0, 12).map((point) => { const latest = latestMeasurementByPoint.get(point.id); const stale = isStale(point); return <div key={point.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-extrabold text-slate-800">💧 {point.name || point.reference}</p><p className="mt-1 text-[10px] text-slate-400">{point.reference} · {typeLabels[point.type] || point.type} · {point.quartier || point.commune}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${stale ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{stale ? 'يحتاج قياساً' : 'مغطى بالرصد'}</span></div><div className="mt-2 flex flex-wrap gap-2 text-[10px] text-slate-500">{latest ? <><span>آخر قياس: {fmtDate(latest.measurementDate)}</span><span>pH: {latest.ph ?? '—'}</span><span>الكلور: {latest.chlorineResidual ?? '—'}</span><span>التعكر: {latest.turbidity ?? '—'}</span></> : <span>لم تسجل قياسات بعد</span>}</div></div>})}</div>}</section><section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><div><h4 className="text-sm font-extrabold text-slate-800">🧪 آخر نتائج القياسات</h4><p className="mt-1 text-[10px] text-slate-500">النتائج غير المطابقة تظهر ضمن الأولويات التشغيلية.</p></div><span className="text-xs font-bold text-slate-400">{filteredMeasurements.length} قياس</span></div>{filteredMeasurements.length === 0 ? <Empty icon="🧪" text="لا توجد قياسات مطابقة للفلتر" /> : <div className="space-y-2">{filteredMeasurements.slice(0, 12).map((measurement) => <div key={measurement.id} className="rounded-xl border border-slate-100 p-3"><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-extrabold text-slate-800">{measurement.waterPoint?.name || measurement.waterPoint?.reference || 'نقطة مياه'}</p><p className="mt-1 text-[10px] text-slate-400">{measurement.reference} · {fmtDate(measurement.measurementDate)}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${conformityColors[measurement.conformity] || 'bg-slate-50 text-slate-600'}`}>{conformityLabels[measurement.conformity] || measurement.conformity}</span></div><div className="mt-2 grid grid-cols-3 gap-2 text-center text-[10px] text-slate-500"><span className="rounded-lg bg-slate-50 p-1.5">pH<br /><b className="text-slate-700">{measurement.ph ?? '—'}</b></span><span className="rounded-lg bg-slate-50 p-1.5">الكلور<br /><b className="text-slate-700">{measurement.chlorineResidual ?? '—'}</b></span><span className="rounded-lg bg-slate-50 p-1.5">التعكر<br /><b className="text-slate-700">{measurement.turbidity ?? '—'}</b></span></div></div>)}</div>}</section></div>
    {((filteredPoints.length > 12) || (filteredMeasurements.length > 12)) && <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center text-[11px] text-slate-500">تظهر أول 12 نتيجة للتلخيص. افتح مكتب الماء والتطهير للوصول إلى السجل الكامل والإدخال.</p>}
  </div>
}

function FollowUpsTab({ data, dossiers, onRefresh, onOpenDossiers, onOpenDossier, onOpenMap }: { data: EnvironmentalFollowUp[]; dossiers: EnvironmentalDossier[]; onRefresh: () => void; onOpenDossiers: () => void; onOpenDossier: (id: string) => void; onOpenMap: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [form, setForm] = useState({ environmentalDossierId: '', followUpDate: new Date().toISOString().slice(0, 10), damageRemoved: 'PENDING', currentStatus: '', notes: '', nextAction: '', nextFollowUpDate: '' })
  const dossierNames = useMemo(() => Object.fromEntries(dossiers.map((dossier) => [dossier.id, `${dossier.reference} — ${dossier.title || 'ملف بيئي'}`])), [dossiers])
  const filtered = data.filter((item) => { const overdue = item.nextFollowUpDate && new Date(item.nextFollowUpDate).getTime() < Date.now() && item.damageRemoved !== 'YES'; return (statusFilter === 'ALL' || item.damageRemoved === statusFilter) && (!overdueOnly || overdue) })
  const openCount = data.filter((item) => item.damageRemoved !== 'YES').length
  const overdueCount = data.filter((item) => item.nextFollowUpDate && new Date(item.nextFollowUpDate).getTime() < Date.now() && item.damageRemoved !== 'YES').length
  const save = async (event: React.FormEvent) => { event.preventDefault(); if (!form.environmentalDossierId) { toast.error('اختر الملف البيئي'); return } await submitForm('/api/environmental-followups', form, () => { setOpen(false); setForm({ environmentalDossierId: '', followUpDate: new Date().toISOString().slice(0, 10), damageRemoved: 'PENDING', currentStatus: '', notes: '', nextAction: '', nextFollowUpDate: '' }); onRefresh() }, setSaving) }
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div><h3 className="text-base font-extrabold text-slate-800">📈 المتابعة والإجراءات التصحيحية</h3><p className="mt-1 text-xs text-slate-500">تتبع نتائج إعادة المعاينة، الآجال، والإجراءات المرتبطة بكل ملف بيئي.</p></div><div className="flex gap-2"><button type="button" onClick={onOpenDossiers} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">📁 فتح الملفات</button><button type="button" onClick={() => setOpen((value) => !value)} className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white">➕ تسجيل متابعة</button></div></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">إجمالي المتابعات</p><b className="text-xl text-blue-900">{data.length}</b></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">ملفات قيد التتبع</p><b className="text-xl text-amber-900">{openCount}</b></div><div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-[10px] font-bold text-red-700">آجال متأخرة</p><b className="text-xl text-red-900">{overdueCount}</b></div></div>
    {open && <form onSubmit={save} className="grid gap-3 rounded-2xl border border-amber-200 bg-amber-50/40 p-4 md:grid-cols-2"><label className="text-xs font-bold text-slate-600 md:col-span-2">الملف البيئي<select required value={form.environmentalDossierId} onChange={(event) => setForm({ ...form, environmentalDossierId: event.target.value })} className={`${inp} mt-1`}><option value="">اختر الملف</option>{dossiers.map((dossier) => <option key={dossier.id} value={dossier.id}>{dossierNames[dossier.id]}</option>)}</select></label><label className="text-xs font-bold text-slate-600">تاريخ المتابعة<input type="date" value={form.followUpDate} onChange={(event) => setForm({ ...form, followUpDate: event.target.value })} className={`${inp} mt-1`} /></label><label className="text-xs font-bold text-slate-600">نتيجة الإجراء<select value={form.damageRemoved} onChange={(event) => setForm({ ...form, damageRemoved: event.target.value })} className={`${inp} mt-1`}><option value="YES">تمت المعالجة</option><option value="PARTIAL">معالجة جزئية</option><option value="NO">لم تتم المعالجة</option><option value="PENDING">قيد التتبع</option></select></label><input value={form.currentStatus} onChange={(event) => setForm({ ...form, currentStatus: event.target.value })} className={inp} placeholder="الوضعية الحالية" /><input type="date" value={form.nextFollowUpDate} onChange={(event) => setForm({ ...form, nextFollowUpDate: event.target.value })} className={inp} aria-label="تاريخ المتابعة المقبلة" /><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={`${inp} md:col-span-2`} rows={2} placeholder="ملاحظات المتابعة" /><input value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} className={`${inp} md:col-span-2`} placeholder="الإجراء المقبل" /><button disabled={saving} className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50 md:col-span-2">{saving ? 'جارٍ الحفظ...' : '💾 حفظ المتابعة'}</button></form>}
    <div className="flex flex-wrap items-center gap-2"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل النتائج</option><option value="YES">تمت المعالجة</option><option value="PARTIAL">معالجة جزئية</option><option value="NO">لم تتم المعالجة</option><option value="PENDING">قيد التتبع</option></select><button type="button" onClick={() => setOverdueOnly((value) => !value)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${overdueOnly ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}>⏱️ الآجال المتأخرة فقط</button></div>
    {filtered.length === 0 ? <Empty icon="📈" text={data.length === 0 ? 'لا توجد متابعات مسجلة ضمن النطاق' : 'لا توجد نتائج مطابقة للفلتر'} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((item) => { const dossier = dossiers.find((entry) => entry.id === item.environmentalDossierId); const overdue = item.nextFollowUpDate && new Date(item.nextFollowUpDate).getTime() < Date.now() && item.damageRemoved !== 'YES'; return <div key={item.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-800">{item.reference}</p><p className="mt-1 text-[10px] text-slate-400">{dossierNames[item.environmentalDossierId] || item.environmentalDossierId}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${item.damageRemoved === 'YES' ? 'bg-emerald-50 text-emerald-700' : item.damageRemoved === 'NO' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{item.damageRemoved === 'YES' ? 'تمت المعالجة' : item.damageRemoved === 'NO' ? 'لم تتم المعالجة' : item.damageRemoved === 'PARTIAL' ? 'معالجة جزئية' : 'قيد التتبع'}</span></div><p className="mt-3 text-xs text-slate-600">{item.notes || item.nextAction || 'بدون ملاحظات'}</p><p className={`mt-2 text-[10px] ${overdue ? 'font-bold text-red-700' : 'text-slate-400'}`}>{fmtDate(item.followUpDate)} · {item.employeeName || '—'}{item.nextFollowUpDate ? ` · المقبلة: ${fmtDate(item.nextFollowUpDate)}` : ''}{overdue ? ' · متأخرة' : ''}</p><div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{dossier && <button type="button" onClick={() => onOpenDossier(item.environmentalDossierId)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">فتح الملف</button>}<button type="button" onClick={() => onOpenMap(item.environmentalDossierId)} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">🗺️ فتح الموقع</button></div></div> })}</div>}
  </div>
}

function EnvironmentalComplaintsTab({ complaints, dossiers, onRefresh, onOpenDossier, onOpenMap }: { complaints: EnvironmentalComplaint[]; dossiers: EnvironmentalDossier[]; onRefresh: () => void; onOpenDossier: (id: string) => void; onOpenMap: (id: string) => void }) {
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const filtered = complaints.filter((complaint) => statusFilter === 'ALL' || (statusFilter === 'LINKED' ? Boolean(complaint.environmentalDossierId) : !complaint.environmentalDossierId))
  const linkedCount = complaints.filter((complaint) => complaint.environmentalDossierId).length
  const linkComplaint = async (complaintId: string) => {
    setLinkingId(complaintId)
    try {
      const response = await fetch(`/api/complaints/${complaintId}/environment`, { method: 'POST' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'تعذر تحويل الشكاية')
      toast.success(result?.alreadyLinked ? 'الشكاية مرتبطة مسبقاً بملف بيئي' : 'تم تحويل الشكاية إلى ملف بيئي')
      onRefresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر تحويل الشكاية') } finally { setLinkingId(null) }
  }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><div><h3 className="text-base font-extrabold text-slate-800">📢 الشكايات والبلاغات البيئية</h3><p className="mt-1 text-xs text-slate-500">استقبال الشكاية، تحويلها إلى ملف بيئي، ثم معاينتها ومتابعتها من نفس المسار.</p></div><span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-extrabold text-blue-700">{complaints.length} شكاية</span></div><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">إجمالي الوارد</p><b className="text-xl text-blue-900">{complaints.length}</b></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-700">مرتبطة بملف</p><b className="text-xl text-emerald-900">{linkedCount}</b></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">تحتاج إلى تحويل</p><b className="text-xl text-amber-900">{complaints.length - linkedCount}</b></div></div><div className="flex flex-wrap items-center gap-2"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل الشكايات</option><option value="UNLINKED">تحتاج إلى تحويل</option><option value="LINKED">مرتبطة بملف</option></select></div>{filtered.length === 0 ? <Empty icon="📢" text={complaints.length === 0 ? 'لا توجد شكايات بيئية ضمن نطاق الحساب' : 'لا توجد نتائج مطابقة للفلتر'} /> : <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((complaint) => { const dossier = complaint.environmentalDossierId ? dossiers.find((item) => item.id === complaint.environmentalDossierId) : null; const statusLabel = complaint.statut === 'TRAITEE' ? 'تمت المعالجة' : complaint.statut === 'EN_COURS' ? 'قيد المعالجة' : complaint.statut === 'REJETEE' ? 'مرفوضة' : 'في الانتظار'; const priorityLabel = complaint.priorite === 'URGENTE' ? 'عاجلة' : complaint.priorite === 'HAUTE' ? 'عالية' : complaint.priorite === 'BASSE' ? 'منخفضة' : 'عادية'; return <div key={complaint.id} className="rounded-2xl border border-slate-100 bg-white p-4 text-right shadow-sm"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-800">{complaint.reference}</p><p className="mt-1 text-[10px] text-slate-400">{complaint.nomCitoyen || 'مبلغ غير محدد'} · {complaint.commune}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${complaint.statut === 'TRAITEE' ? 'bg-emerald-50 text-emerald-700' : complaint.priorite === 'URGENTE' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{statusLabel}</span></div><p className="mt-3 line-clamp-2 text-xs text-slate-600">{complaint.description || 'بدون وصف مسجل'}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400"><span>🔺 أولوية {priorityLabel}</span><span>📍 {complaint.quartier || complaint.adresse || 'الموقع غير محدد'}</span><span>📅 {fmtDate(complaint.dateReception || complaint.createdAt)}</span></div>{dossier ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">📁 مرتبط بالملف: <b>{dossier.reference}</b><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => onOpenDossier(dossier.id)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-emerald-700">فتح الملف</button><button type="button" onClick={() => onOpenMap(dossier.id)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-amber-700">🗺️ فتح الموقع</button></div></div> : <button type="button" onClick={() => linkComplaint(complaint.id)} disabled={linkingId === complaint.id} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{linkingId === complaint.id ? 'جارٍ التحويل...' : '🔗 تحويل إلى ملف بيئي ومعاينة'}</button>}</div> })}</div>}</div>
}

function VigilanceTab({ dossiers, pollution, waste, waterPoints, waterMeasurements, onNavigate }: { dossiers: EnvironmentalDossier[]; pollution: PollutionIncident[]; waste: WasteBlackSpot[]; waterPoints: EnvironmentalWaterPoint[]; waterMeasurements: EnvironmentalWaterMeasurement[]; onNavigate: (tab: EnvironmentSubTab) => void }) {
  const criticalDossiers = dossiers.filter((item) => ['HIGH', 'CRITICAL'].includes(item.riskLevel) && !['CLOSED', 'RESOLVED', 'ARCHIVED'].includes(item.status))
  const criticalPollution = pollution.filter((item) => ['HIGH', 'CRITICAL'].includes(item.severity) && item.status !== 'CLOSED')
  const recurringWaste = waste.filter((item) => item.recurring)
  const latestMeasurementByPoint = new Map<string, EnvironmentalWaterMeasurement>()
  for (const measurement of waterMeasurements) { const current = latestMeasurementByPoint.get(measurement.waterPointId); if (!current || new Date(measurement.measurementDate).getTime() > new Date(current.measurementDate).getTime()) latestMeasurementByPoint.set(measurement.waterPointId, measurement) }
  const staleWaterPoints = waterPoints.filter((point) => { const latest = latestMeasurementByPoint.get(point.id); return !latest || Date.now() - new Date(latest.measurementDate).getTime() > 90 * 86400000 })
  const nonConformingWater = waterMeasurements.filter((item) => item.conformity === 'NON_CONFORM')
  const total = criticalDossiers.length + criticalPollution.length + recurringWaste.length + staleWaterPoints.length + nonConformingWater.length
  return <div className="space-y-4"><div className="rounded-2xl bg-gradient-to-l from-rose-700 to-orange-500 p-5 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">🚨 اليقظة والمخاطر البيئية</h3><p className="mt-1 text-xs text-rose-50">رصد الحالات التي تحتاج إلى تدخل أو متابعة ذات أولوية ضمن جميع المجالات البيئية.</p></div><div className="rounded-2xl bg-white/15 px-4 py-2 text-center"><b className="block text-2xl">{total}</b><span className="text-[10px]">حالة تستحق الانتباه</span></div></div></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5"><button type="button" onClick={() => onNavigate('dossiers')} className="rounded-2xl border border-red-100 bg-red-50 p-4 text-right"><p className="text-xs font-bold text-red-700">📁 ملفات عالية الخطورة</p><p className="mt-1 text-3xl font-black text-red-800">{criticalDossiers.length}</p><span className="text-[10px] text-red-600">فتح الملفات</span></button><button type="button" onClick={() => onNavigate('pollution')} className="rounded-2xl border border-orange-100 bg-orange-50 p-4 text-right"><p className="text-xs font-bold text-orange-700">🏭 تلوث خطير</p><p className="mt-1 text-3xl font-black text-orange-800">{criticalPollution.length}</p><span className="text-[10px] text-orange-600">فتح حوادث التلوث</span></button><button type="button" onClick={() => onNavigate('waste')} className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-right"><p className="text-xs font-bold text-amber-700">🗑️ نقط رمي متكررة</p><p className="mt-1 text-3xl font-black text-amber-800">{recurringWaste.length}</p><span className="text-[10px] text-amber-600">فتح النفايات</span></button><button type="button" onClick={() => onNavigate('water')} className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-right"><p className="text-xs font-bold text-sky-700">💧 رصد مائي يحتاج تدخلاً</p><p className="mt-1 text-3xl font-black text-sky-800">{staleWaterPoints.length + nonConformingWater.length}</p><span className="text-[10px] text-sky-600">فتح الرصد المائي</span></button><div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-right"><p className="text-xs font-bold text-slate-700">📊 مجموع التنبيهات</p><p className="mt-1 text-3xl font-black text-slate-800">{total}</p><span className="text-[10px] text-slate-500">بعد إزالة الحالات السليمة</span></div></div><div className="rounded-2xl border border-slate-100 bg-white p-4"><h4 className="mb-3 text-sm font-extrabold text-slate-700">قواعد الأولوية التشغيلية</h4><div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2 xl:grid-cols-5"><p className="rounded-xl bg-slate-50 p-3">🔴 خطر حرج أو عالٍ: معاينة عاجلة</p><p className="rounded-xl bg-slate-50 p-3">🟠 تلوث مفتوح: إجراء تصحيحي</p><p className="rounded-xl bg-slate-50 p-3">🟡 تكرار الرمي: خطة متابعة</p><p className="rounded-xl bg-slate-50 p-3">💧 عدم مطابقة المياه: إعادة عينة</p><p className="rounded-xl bg-slate-50 p-3">⏱️ قياس متأخر: جدولة رصد</p></div></div></div>
}

// ===== Shared UI =====
function Spinner() { return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div> }
function Empty({ icon, text }: { icon: string; text: string }) { return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">{icon}</div><p className="text-sm text-slate-500">{text}</p></div> }
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return <AnimatePresence>{open && (<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}><motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl"><div className="bg-gradient-to-l from-amber-700 to-orange-500 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10"><h3 className="text-lg font-bold">{title}</h3><button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button></div><div className="p-5">{children}</div></motion.div></motion.div>)}</AnimatePresence>
}
const inp = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-400"

async function submitForm(endpoint: string, body: any, onSuccess: () => void, savingFn: (v: boolean) => void) {
  savingFn(true)
  try { const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!res.ok) { const e = await res.json().catch(() => null); toast.error(e?.error || 'فشل'); return }; toast.success('تم الإنشاء'); onSuccess() } catch { toast.error('حدث خطأ') } finally { savingFn(false) }
}

// ===== Dossiers Tab =====
function DossiersTab({ data, loading, onRefresh, buildParams, allowedCommunes, showCreate, setShowCreate, onOpenDetail }: any) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('ALL')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const filtered = data.filter((d: EnvironmentalDossier) => {
    const searchMatch = !search || d.reference.toLowerCase().includes(search.toLowerCase()) || d.title.toLowerCase().includes(search.toLowerCase()) || d.description.toLowerCase().includes(search.toLowerCase()) || d.quartier.toLowerCase().includes(search.toLowerCase())
    const overdue = d.dueDate && new Date(d.dueDate).getTime() < Date.now() && !['CLOSED', 'RESOLVED', 'ARCHIVED'].includes(d.status)
    return searchMatch && (statusFilter === 'ALL' || d.status === statusFilter) && (riskFilter === 'ALL' || d.riskLevel === riskFilter) && (sourceFilter === 'ALL' || d.source === sourceFilter) && (!overdueOnly || overdue)
  })
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2"><input type="text" placeholder="🔍 بحث بالمرجع أو العنوان أو الحي..." value={search} onChange={(e) => setSearch(e.target.value)} className="min-w-[180px] flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" /><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs"><option value="ALL">كل الحالات</option><option value="NEW">جديد</option><option value="TO_VERIFY">للتحقق</option><option value="IN_PROGRESS">قيد المعالجة</option><option value="FORMAL_NOTICE">إعذار</option><option value="FOLLOW_UP">قيد التتبع</option><option value="RESOLVED">تم الحل</option><option value="CLOSED">مغلق</option></select><select value={riskFilter} onChange={(e) => setRiskFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs"><option value="ALL">كل المخاطر</option><option value="LOW">منخفض</option><option value="MEDIUM">متوسط</option><option value="HIGH">عالٍ</option><option value="CRITICAL">حرج</option></select><select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs"><option value="ALL">كل المصادر</option><option value="PUBLIC">شكاية مواطن</option><option value="INTERNAL">معاينة BCH</option><option value="AUTHORITY">سلطة محلية</option><option value="PROGRAMMED">مبرمج</option></select><button onClick={() => setOverdueOnly(!overdueOnly)} className={`rounded-xl border px-2 py-2 text-xs font-bold ${overdueOnly ? 'border-red-200 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-500'}`}>⏱️ المتأخرة فقط</button><button onClick={() => setShowCreate(true)} className="mr-auto rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">➕ ملف جديد</button></div>
    <p className="text-[11px] text-slate-400">عرض {filtered.length} من أصل {data.length} ملفاً بيئياً</p>
    {filtered.length === 0 ? <Empty icon="📁" text="لا توجد ملفات" /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((d: EnvironmentalDossier, i: number) => (
          <motion.button type="button" onClick={() => onOpenDetail(d)} key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:border-emerald-300 hover:shadow-md transition">
            <div className="flex items-start justify-between"><div className="min-w-0"><div className="text-sm font-bold truncate">{ENV_DOSSIER_CATEGORY_ICONS[d.category]} {d.title || d.reference}</div><div className="text-[10px] text-slate-400">{d.reference}</div></div></div>
            <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap"><span>{ENV_DOSSIER_CATEGORY_LABELS[d.category]}</span><span style={{ color: COMMUNE_COLORS[d.commune] }}>{COMMUNE_LABELS[d.commune] || d.commune}</span>{d.company && <span>· {d.company}</span>}</div>
          </motion.button>
        ))}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="📁 ملف بيئي جديد"><DossierForm buildParams={buildParams} allowedCommunes={allowedCommunes} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

function InspectionsTab({ data, dossiers, loading, onRefresh, showCreate, setShowCreate, onOpenDossier, onOpenMap }: any) {
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">سجل المعاينات الميدانية</p><p className="text-[11px] text-slate-500">كل معاينة مرتبطة بملف بيئي، بدرجة خطر، وقرار متابعة قابل للتتبع.</p></div><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">➕ معاينة جديدة</button></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs"><b className="text-blue-800">1. المعاينة</b><p className="mt-1 text-blue-700">توثيق الملاحظة والموقع والوسط المتأثر.</p></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs"><b className="text-amber-800">2. التقييم</b><p className="mt-1 text-amber-700">احتساب الخطر من الاحتمال وشدة الأثر.</p></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs"><b className="text-emerald-800">3. الإجراء</b><p className="mt-1 text-emerald-700">تحديد النتيجة والإجراء وموعد المتابعة.</p></div></div>
    {data.length === 0 ? <Empty icon="🔍" text="لا توجد معاينات بيئية" /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{data.map((inspection: EnvironmentalInspection) => { const dossier = dossiers.find((item: EnvironmentalDossier) => item.id === inspection.environmentalDossierId); const highRisk = inspection.riskLevel === 'CRITICAL' || inspection.riskLevel === 'HIGH'; return <div key={inspection.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-bold text-slate-800">🔍 {dossier?.title || inspection.environmentalDossier?.title || inspection.reference}</p><p className="text-[10px] text-slate-400">{inspection.reference} · {fmtDate(inspection.inspectionDate)}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${highRisk ? 'bg-red-50 text-red-700' : inspection.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{inspection.riskScore}/100 · {inspection.riskLevel === 'CRITICAL' ? 'حرج' : inspection.riskLevel === 'HIGH' ? 'عالٍ' : inspection.riskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'}</span></div><div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-500"><span>👤 {inspection.inspectorName || 'المعاين غير محدد'}</span><span>📍 {inspection.commune}</span><span>🎯 {inspection.resolution === 'YES' ? 'مطابق' : inspection.resolution === 'PARTIAL' ? 'مطابقة جزئية' : inspection.resolution === 'NO' ? 'غير مطابق' : 'في الانتظار'}</span><span>📅 {inspection.nextFollowUpDate ? fmtDate(inspection.nextFollowUpDate) : 'لا موعد لاحق'}</span></div><p className="mt-2 line-clamp-2 text-xs text-slate-600">{inspection.observation || 'بدون ملاحظات'}</p><div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">{dossier && <button type="button" onClick={() => onOpenDossier(inspection.environmentalDossierId)} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">فتح الملف</button>}<button type="button" onClick={() => onOpenMap(inspection.environmentalDossierId)} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">🗺️ فتح الموقع</button></div></div> })}</div>}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🔍 معاينة بيئية"><InspectionForm dossiers={dossiers} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

function ProgramsTab({ data, dossiers, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [yearFilter, setYearFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const filtered = data.filter((program: EnvironmentalProgram) => (yearFilter === 'ALL' || String(program.year) === yearFilter) && (statusFilter === 'ALL' || program.status === statusFilter))
  const totals = filtered.reduce((summary: { target: number; achieved: number; budget: number }, program: EnvironmentalProgram) => ({ target: summary.target + (program.quantitativeTarget || 0), achieved: summary.achieved + (program.achieved || 0), budget: summary.budget + (program.budget || 0) }), { target: 0, achieved: 0, budget: 0 })
  const overallProgress = totals.target > 0 ? Math.min(100, Math.round((totals.achieved / totals.target) * 100)) : 0
  const years = Array.from(new Set((data as EnvironmentalProgram[]).map((program) => program.year))).sort((a, b) => b - a)
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">البرنامج السنوي البيئي</p><p className="text-[11px] text-slate-500">تخطيط قابل للقياس، مرتبط بالملفات، ومتابع حسب جماعة الحساب.</p></div><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">➕ عملية مبرمجة</button></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">العمليات المعروضة</p><b className="text-xl text-blue-900">{filtered.length}</b></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-700">الإنجاز الإجمالي</p><b className="text-xl text-emerald-900">{overallProgress}%</b></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">الميزانية المبرمجة</p><b className="text-xl text-amber-900">{totals.budget.toLocaleString('ar-MA')} درهم</b></div></div>
    <div className="flex flex-wrap items-center gap-2"><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل السنوات</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل الحالات</option><option value="PLANNED">مخطط</option><option value="IN_PROGRESS">قيد الإنجاز</option><option value="COMPLETED">مكتمل</option><option value="DELAYED">متأخر</option><option value="CANCELLED">ملغى</option></select></div>
    {filtered.length === 0 ? <Empty icon="🗓️" text="لا توجد عمليات مبرمجة" /> : <div className="space-y-3">{filtered.map((program: EnvironmentalProgram) => { const statusLabel = program.status === 'COMPLETED' ? 'مكتمل' : program.status === 'IN_PROGRESS' ? 'قيد الإنجاز' : program.status === 'DELAYED' ? 'متأخر' : program.status === 'CANCELLED' ? 'ملغى' : 'مخطط'; const statusClass = program.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : program.status === 'DELAYED' ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-700'; return <div key={program.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-bold text-slate-800">🗓️ {program.operation}</p><p className="text-xs text-slate-400">{program.reference} · {program.year} · {program.axis || 'محور عام'} · {program.commune}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span><span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">{program.progress}%</span></div></div>{program.objective && <p className="mt-2 text-xs text-slate-600">🎯 {program.objective}</p>}<div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${program.status === 'DELAYED' ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${program.progress}%` }} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-500"><span>📊 {program.indicator || 'المؤشر غير محدد'}: {program.achieved}/{program.quantitativeTarget || '—'}</span><span>👤 {program.responsible || 'مسؤول غير محدد'}</span>{program.budget != null && <span>💰 {program.budget.toLocaleString('ar-MA')} درهم</span>}</div>{program.environmentalDossier && <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">📁 مرتبط بالملف: <b>{program.environmentalDossier.reference}</b> — {program.environmentalDossier.title}</div>}</div> })}</div>}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🗓️ عملية في البرنامج السنوي"><ProgramForm dossiers={dossiers} buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Pollution Tab =====
function PollutionTab({ data, dossiers, loading, onRefresh, buildParams, allowedCommunes, showCreate, setShowCreate, onOpenDossier, onOpenMap }: any) {
  const [filterType, setFilterType] = useState('ALL')
  const [filterSeverity, setFilterSeverity] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const filtered = data.filter((p: PollutionIncident) => (filterType === 'ALL' || p.type === filterType) && (filterSeverity === 'ALL' || p.severity === filterSeverity) && (filterStatus === 'ALL' || p.status === filterStatus))
  const criticalCount = data.filter((p: PollutionIncident) => ['HIGH', 'CRITICAL'].includes(p.severity) && p.status !== 'CLOSED').length
  const openCount = data.filter((p: PollutionIncident) => p.status !== 'CLOSED').length
  const linkIncident = async (id: string) => {
    setLinkingId(id)
    try {
      const response = await fetch(`/api/pollution-incidents/${id}/environment`, { method: 'POST' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'تعذر تحويل الحادث')
      toast.success(result?.alreadyLinked ? 'الحادث مرتبط مسبقاً بملف بيئي' : 'تم تحويل حادث التلوث إلى ملف بيئي')
      onRefresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر تحويل الحادث') } finally { setLinkingId(null) }
  }
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">سجل حوادث التلوث</p><p className="text-[11px] text-slate-500">رصد الحادث، تقييم شدته، تحويله إلى ملف، ثم معاينته وتتبع إجراءات التخفيف.</p></div><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">➕ حادث تلوث</button></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">إجمالي الحوادث</p><b className="text-xl text-blue-900">{data.length}</b></div><div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-[10px] font-bold text-red-700">حوادث عالية الخطورة</p><b className="text-xl text-red-900">{criticalCount}</b></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">حوادث مفتوحة</p><b className="text-xl text-amber-900">{openCount}</b></div></div>
    <div className="flex flex-wrap items-center gap-2">
      <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل الأنواع</option>{Object.entries(POLLUTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{POLLUTION_TYPE_ICONS[k]} {v}</option>)}</select>
      <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل الخطورة</option>{Object.entries(POLLUTION_SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white"><option value="ALL">كل الحالات</option><option value="NEW">جديد</option><option value="INVESTIGATING">قيد التحقيق</option><option value="MITIGATING">إجراءات تخفيف</option><option value="CLOSED">مغلق</option></select>
    </div>
    {filtered.length === 0 ? <Empty icon="🏭" text="لا توجد حوادث تلوث" /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((p: PollutionIncident, i: number) => {
          const sc = POLLUTION_STATUS_COLORS[p.status]; const sv = POLLUTION_SEVERITY_COLORS[p.severity]
          const dossier = p.environmentalDossierId ? dossiers.find((item: EnvironmentalDossier) => item.id === p.environmentalDossierId) : null
          return (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
              <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: sv }} />
              <div className="flex items-start justify-between pr-1"><div className="min-w-0"><div className="text-sm font-bold">{POLLUTION_TYPE_ICONS[p.type]} {p.reference}</div><div className="text-xs text-slate-600 line-clamp-2 mt-1">{p.description}</div></div>
                <div className="flex flex-col gap-1 shrink-0"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{POLLUTION_STATUS_LABELS[p.status]}</span><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sv + '15', color: sv }}>{POLLUTION_SEVERITY_LABELS[p.severity]}</span></div></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap pr-1"><span>{POLLUTION_TYPE_LABELS[p.type]}</span>{p.pollutantName && <span>🧪 {p.pollutantName}</span>}{p.company && <span>· {p.company}</span>}{p.source === 'PUBLIC' && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">عمومي</span>}</div>
              {dossier ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">📁 مرتبط بالملف: <b>{dossier.reference}</b><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => onOpenDossier(dossier.id)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-emerald-700">فتح الملف</button><button type="button" onClick={() => onOpenMap(dossier.id)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-amber-700">🗺️ فتح الموقع</button></div></div> : <button type="button" onClick={() => linkIncident(p.id)} disabled={linkingId === p.id} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{linkingId === p.id ? 'جارٍ التحويل...' : '🔗 تحويل إلى ملف بيئي ومعاينة'}</button>}
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🏭 حادث تلوث جديد"><PollutionForm buildParams={buildParams} allowedCommunes={allowedCommunes} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Waste Tab =====
function WasteTab({ data, dossiers, loading, onRefresh, buildParams, allowedCommunes, showCreate, setShowCreate, onOpenDossier, onOpenMap }: any) {
  const [filterRecurring, setFilterRecurring] = useState(false)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const filtered = data.filter((w: WasteBlackSpot) => (!filterRecurring || w.recurring) && (filterStatus === 'ALL' || w.status === filterStatus))
  const recurringCount = data.filter((w: WasteBlackSpot) => w.recurring).length
  const activeCount = data.filter((w: WasteBlackSpot) => w.status !== 'CLOSED').length
  const linkSpot = async (id: string) => {
    setLinkingId(id)
    try {
      const response = await fetch(`/api/waste-black-spots/${id}/environment`, { method: 'POST' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'تعذر تحويل نقطة النفايات')
      toast.success(result?.alreadyLinked ? 'النقطة مرتبطة مسبقاً بملف بيئي' : 'تم تحويل نقطة النفايات إلى ملف بيئي')
      onRefresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر تحويل النقطة') } finally { setLinkingId(null) }
  }
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">النفايات والنقط السوداء</p><p className="text-[11px] text-slate-500">رصد النقطة، قياس التكرار، تحديد الحالة، ثم تحويلها إلى ملف للتدخل والمتابعة.</p></div><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">➕ نقطة رمي</button></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">إجمالي النقط</p><b className="text-xl text-blue-900">{data.length}</b></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">نقط متكررة</p><b className="text-xl text-amber-900">{recurringCount}</b></div><div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-[10px] font-bold text-red-700">نقط نشطة</p><b className="text-xl text-red-900">{activeCount}</b></div></div>
    <div className="flex flex-wrap items-center gap-2"><button onClick={() => setFilterRecurring(!filterRecurring)} className={`px-3 py-2 text-xs font-bold rounded-xl border ${filterRecurring ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-white border-slate-200 text-slate-500'}`}>🔄 متكرر فقط</button><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل الحالات</option><option value="ACTIVE">نشطة</option><option value="CLEANED">تم التنظيف</option><option value="MONITORING">قيد المراقبة</option><option value="CLOSED">مغلقة</option></select></div>
    {filtered.length === 0 ? <Empty icon="🗑️" text="لا توجد نقاط رمي" /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((w: WasteBlackSpot, i: number) => {
          const sc = WASTE_STATUS_COLORS[w.status]
          return (
            <motion.div key={w.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between"><div className="min-w-0"><div className="text-sm font-bold">{w.reference}</div><div className="text-xs text-slate-600 line-clamp-2 mt-1">{w.description || w.adresse || '—'}</div></div><span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: sc + '15', color: sc }}>{WASTE_STATUS_LABELS[w.status]}</span></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap"><span>{WASTE_TYPE_LABELS[w.wasteType]}</span>{w.recurring && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 font-bold">🔄 متكرر ({w.recurrenceCount})</span>}{w.quartier && <span>📍 {w.quartier}</span>}</div>
              {w.environmentalDossierId ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">📁 مرتبط بالملف البيئي<div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => onOpenDossier(w.environmentalDossierId)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-emerald-700">فتح الملف</button><button type="button" onClick={() => onOpenMap(w.environmentalDossierId)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-amber-700">🗺️ فتح الموقع</button></div></div> : <button type="button" onClick={() => linkSpot(w.id)} disabled={linkingId === w.id} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{linkingId === w.id ? 'جارٍ التحويل...' : '🔗 تحويل إلى ملف بيئي ومتابعة'}</button>}
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🗑️ نقطة رمي جديدة"><WasteForm buildParams={buildParams} allowedCommunes={allowedCommunes} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Sites Tab =====
function SitesTab({ data, dossiers, loading, onRefresh, buildParams, allowedCommunes, showCreate, setShowCreate, onOpenDossier, onOpenMap }: any) {
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterProtection, setFilterProtection] = useState('ALL')
  const [linkingId, setLinkingId] = useState<string | null>(null)
  const filtered = data.filter((site: NaturalSite) => (filterStatus === 'ALL' || site.status === filterStatus) && (filterProtection === 'ALL' || site.protectionLevel === filterProtection))
  const threatenedCount = data.filter((site: NaturalSite) => ['THREATENED', 'DEGRADED'].includes(site.status)).length
  const protectedCount = data.filter((site: NaturalSite) => site.protectionLevel !== 'NONE').length
  const linkSite = async (id: string) => {
    setLinkingId(id)
    try {
      const response = await fetch(`/api/natural-sites/${id}/environment`, { method: 'POST' })
      const result = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result?.error || 'تعذر تحويل الموقع الطبيعي')
      toast.success(result?.alreadyLinked ? 'الموقع مرتبط مسبقاً بملف بيئي' : 'تم تحويل الموقع الطبيعي إلى ملف بيئي')
      onRefresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر تحويل الموقع') } finally { setLinkingId(null) }
  }
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">المواقع الطبيعية والمجالات الحساسة</p><p className="text-[11px] text-slate-500">سجل الحماية والتهديدات والموقع الجغرافي مع ربط المعالجة بالملف البيئي.</p></div><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">➕ موقع طبيعي</button></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">إجمالي المواقع</p><b className="text-xl text-blue-900">{data.length}</b></div><div className="rounded-xl border border-red-100 bg-red-50 p-3"><p className="text-[10px] font-bold text-red-700">مواقع مهددة</p><b className="text-xl text-red-900">{threatenedCount}</b></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-700">مواقع محمية</p><b className="text-xl text-emerald-900">{protectedCount}</b></div></div>
    <div className="flex flex-wrap items-center gap-2"><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل الحالات</option><option value="INTACT">سليم</option><option value="THREATENED">مهدد</option><option value="DEGRADED">متدهور</option><option value="PROTECTED">محمِي</option></select><select value={filterProtection} onChange={(event) => setFilterProtection(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل مستويات الحماية</option>{Object.entries(SITE_PROTECTION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
    {filtered.length === 0 ? <Empty icon="🌳" text={data.length === 0 ? 'لا توجد مواقع' : 'لا توجد نتائج مطابقة للفلتر'} /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((s: NaturalSite, i: number) => {
          const sc = SITE_STATUS_COLORS[s.status]
          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between"><div className="min-w-0"><div className="text-sm font-bold">{NATURAL_SITE_TYPE_ICONS[s.type]} {s.name}</div><div className="text-[10px] text-slate-400">{s.reference}</div></div><span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: sc + '15', color: sc }}>{SITE_STATUS_LABELS[s.status]}</span></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap"><span>{NATURAL_SITE_TYPE_LABELS[s.type]}</span><span>🛡️ {SITE_PROTECTION_LABELS[s.protectionLevel]}</span>{s.area && <span>· {s.area} هكتار</span>}{s.threats && <span>⚠️ {s.threats}</span>}</div>
              {s.environmentalDossierId ? <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">📁 مرتبط بالملف البيئي<div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => onOpenDossier(s.environmentalDossierId)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-emerald-700">فتح الملف</button><button type="button" onClick={() => onOpenMap(s.environmentalDossierId)} className="rounded-lg bg-white px-2.5 py-1.5 font-bold text-amber-700">🗺️ فتح الموقع</button></div></div> : <button type="button" onClick={() => linkSite(s.id)} disabled={linkingId === s.id} className="mt-3 w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{linkingId === s.id ? 'جارٍ التحويل...' : '🔗 تحويل إلى ملف بيئي وحماية'}</button>}
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🌳 موقع طبيعي جديد"><SiteForm buildParams={buildParams} allowedCommunes={allowedCommunes} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Campaigns Tab =====
function CampaignsTab({ data, dossiers, programs, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [filterTheme, setFilterTheme] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const filtered = data.filter((campaign: AwarenessCampaign) => (filterTheme === 'ALL' || campaign.theme === filterTheme) && (filterStatus === 'ALL' || campaign.status === filterStatus))
  const activeCount = data.filter((campaign: AwarenessCampaign) => campaign.status === 'ACTIVE').length
  const participants = data.reduce((total: number, campaign: AwarenessCampaign) => total + (campaign.participantsCount || 0), 0)
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-bold text-slate-700">حملات التحسيس والتواصل البيئي</p><p className="text-[11px] text-slate-500">تخطيط الحملة، تحديد الجمهور، قياس المشاركة، وربطها بالملف أو البرنامج السنوي.</p></div><button onClick={() => setShowCreate(true)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">➕ حملة جديدة</button></div>
    <div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border border-blue-100 bg-blue-50 p-3"><p className="text-[10px] font-bold text-blue-700">إجمالي الحملات</p><b className="text-xl text-blue-900">{data.length}</b></div><div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-[10px] font-bold text-emerald-700">حملات نشطة</p><b className="text-xl text-emerald-900">{activeCount}</b></div><div className="rounded-xl border border-amber-100 bg-amber-50 p-3"><p className="text-[10px] font-bold text-amber-700">المستفيدون المسجلون</p><b className="text-xl text-amber-900">{participants.toLocaleString('ar-MA')}</b></div></div>
    <div className="flex flex-wrap items-center gap-2"><select value={filterTheme} onChange={(event) => setFilterTheme(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل المحاور</option>{Object.entries(CAMPAIGN_THEME_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"><option value="ALL">كل الحالات</option><option value="PLANNED">مخططة</option><option value="ACTIVE">نشطة</option><option value="COMPLETED">مكتملة</option><option value="CANCELLED">ملغاة</option></select></div>
    {filtered.length === 0 ? <Empty icon="📢" text={data.length === 0 ? 'لا توجد حملات' : 'لا توجد نتائج مطابقة للفلتر'} /> : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.map((c: AwarenessCampaign, i: number) => {
          const sc = CAMPAIGN_STATUS_COLORS[c.status]
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4">
              <div className="flex items-start justify-between"><div className="min-w-0"><div className="text-sm font-bold">{CAMPAIGN_THEME_ICONS[c.theme]} {c.title}</div><div className="text-[10px] text-slate-400">{c.reference}</div></div><span className="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style={{ backgroundColor: sc + '15', color: sc }}>{CAMPAIGN_STATUS_LABELS[c.status]}</span></div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-400 flex-wrap"><span>{CAMPAIGN_THEME_LABELS[c.theme]}</span>{c.startDate && <span>· {fmtDate(c.startDate)}</span>}{c.participantsCount > 0 && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-bold">👥 {c.participantsCount}</span>}</div>
              {c.targetAudience && <p className="mt-2 text-xs text-slate-600">👥 الجمهور: {c.targetAudience}</p>}{c.environmentalDossier && <div className="mt-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">📁 ملف مرتبط: <b>{c.environmentalDossier.reference}</b></div>}{c.environmentalProgram && <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] text-blue-800">🗓️ برنامج مرتبط: <b>{c.environmentalProgram.reference}</b> — {c.environmentalProgram.operation}</div>}
            </motion.div>
          )
        })}
      </div>
    )}
    <Modal open={showCreate} onClose={() => setShowCreate(false)} title="📢 حملة تحسيس جديدة"><CampaignForm dossiers={dossiers} programs={programs} buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} /></Modal>
  </div>
}

// ===== Forms =====
function DossierForm({ buildParams, allowedCommunes = [], onCreated }: any) {
  const [f, setF] = useState({ title: '', category: 'POLLUTION', commune: '', quartier: '', adresse: '', description: '', priority: 'NORMALE', company: '', notes: '', riskScore: '0', riskLevel: 'LOW', probability: '1', severity: '1', extent: 'LOCAL', milieu: '', dueDate: '', source: 'INTERNAL', probableSource: '', exposedPopulation: '0', servicesConcerned: '', measuresTaken: '', latitude: '', longitude: '', legalReference: '' })
  const accountCommune = buildParams().get('commune') || allowedCommunes[0] || ''
  const [saving, setSaving] = useState(false)
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const calculatedRiskScore = Math.max(0, Math.min(100, (Number(f.probability) || 1) * (Number(f.severity) || 1) * 4))
  const calculatedRiskLevel = calculatedRiskScore >= 80 ? 'CRITICAL' : calculatedRiskScore >= 48 ? 'HIGH' : calculatedRiskScore >= 24 ? 'MEDIUM' : 'LOW'
  const handleLocationSelect = useCallback((latitude: number, longitude: number, commune: string, quartier: string) => {
    setF((current) => ({ ...current, commune, quartier: quartier || current.quartier, latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) }))
  }, [])
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.title.trim()) { toast.error('العنوان مطلوب'); return }; const p = buildParams(); submitForm('/api/env-dossiers', { ...f, riskScore: calculatedRiskScore, riskLevel: calculatedRiskLevel, commune: f.commune || accountCommune || p.get('commune') || 'ALL', servicesConcerned: f.servicesConcerned.split(',').map((item) => item.trim()).filter(Boolean) }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">العنوان *</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الفئة</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inp}>{Object.entries(ENV_DOSSIER_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{ENV_DOSSIER_CATEGORY_ICONS[k]} {v}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} placeholder="يُملأ تلقائياً عند تحديد الموقع" /></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-amber-800">🧮 التقييم العلمي للخطر</p><p className="mt-1 text-[10px] text-amber-700">الاحتمال × شدة الأثر × 4 = درجة من 100</p></div><div className="text-left"><b className="text-2xl text-amber-800">{calculatedRiskScore}/100</b><p className="text-[10px] font-bold text-amber-700">{calculatedRiskLevel === 'CRITICAL' ? 'حرج' : calculatedRiskLevel === 'HIGH' ? 'عالٍ' : calculatedRiskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'}</p></div></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الاحتمال 1–5</label><input type="number" min="1" max="5" value={f.probability} onChange={(e) => setF({ ...f, probability: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">شدة الأثر 1–5</label><input type="number" min="1" max="5" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">النطاق</label><select value={f.extent} onChange={(e) => setF({ ...f, extent: e.target.value })} className={inp}><option value="LOCAL">محلي</option><option value="QUARTER">حي</option><option value="COMMUNAL">جماعي</option><option value="INTERCOMMUNAL">بين جماعات</option></select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">مهلة المعالجة</label><input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوصف</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <div className="grid grid-cols-2 gap-2"><select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={inp}><option value="INTERNAL">معاينة BCH</option><option value="PUBLIC">شكاية مواطن</option><option value="AUTHORITY">سلطة محلية</option><option value="COMMUNE">الجماعة</option><option value="PROGRAMMED">تدخل مبرمج</option><option value="OTHER">مصدر آخر</option></select><input value={f.probableSource} onChange={(e) => setF({ ...f, probableSource: e.target.value })} className={inp} placeholder="مصدر التلوث المحتمل" /></div>
    <div className="grid grid-cols-2 gap-2"><input value={f.milieu} onChange={(e) => setF({ ...f, milieu: e.target.value })} className={inp} placeholder="الوسط: ماء، هواء، تربة..." /><input type="number" min="0" value={f.exposedPopulation} onChange={(e) => setF({ ...f, exposedPopulation: e.target.value })} className={inp} placeholder="السكان المعرّضون" /></div>
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold text-emerald-800">📍 الموقع الجغرافي</p><p className="mt-0.5 text-[10px] text-emerald-700">حدد الموقع من الخريطة لتعبئة الإحداثيات تلقائياً.</p></div><button type="button" onClick={() => setLocationPickerOpen(true)} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">🗺️ تحديد من الخريطة</button></div><div className="mt-2 grid grid-cols-2 gap-2"><input value={f.latitude} onChange={(e) => setF({ ...f, latitude: e.target.value })} className={inp} placeholder="خط العرض" /><input value={f.longitude} onChange={(e) => setF({ ...f, longitude: e.target.value })} className={inp} placeholder="خط الطول" /></div>{f.latitude && f.longitude && <p className="mt-2 text-[10px] font-bold text-emerald-700">✓ تم تحديد الموقع: {Number(f.latitude).toFixed(6)}, {Number(f.longitude).toFixed(6)}</p>}</div>
    <input value={f.servicesConcerned} onChange={(e) => setF({ ...f, servicesConcerned: e.target.value })} className={inp} placeholder="الجهات المعنية مفصولة بفاصلة" />
    <textarea value={f.measuresTaken} onChange={(e) => setF({ ...f, measuresTaken: e.target.value })} rows={2} className={inp} placeholder="الإجراءات المتخذة" />
    <input value={f.legalReference} onChange={(e) => setF({ ...f, legalReference: e.target.value })} className={inp} placeholder="مرجع قانوني قيد التحقق (اختياري)" />
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
    {locationPickerOpen && <EnvironmentalLocationPicker commune={f.commune || accountCommune} allowedCommunes={allowedCommunes} latitude={f.latitude} longitude={f.longitude} onSelect={handleLocationSelect} onClose={() => setLocationPickerOpen(false)} />}
  </form>
}

function EnvironmentalLocationPicker({ commune, allowedCommunes = [], latitude, longitude, onSelect, onClose }: { commune: string; allowedCommunes?: string[]; latitude: string; longitude: string; onSelect: (latitude: number, longitude: number, commune: string, quartier: string) => void; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const initialLocationRef = useRef({ latitude: Number(latitude), longitude: Number(longitude) })
  const initialLocation = initialLocationRef.current
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(Number.isFinite(initialLocation.latitude) && Number.isFinite(initialLocation.longitude) ? initialLocation : null)

  useEffect(() => {
    let cancelled = false
    const invalidateTimers: number[] = []
    const initialize = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current) return
      const hasInitialLocation = Number.isFinite(initialLocation.latitude) && Number.isFinite(initialLocation.longitude)
      const scopeCommunes = Array.from(new Set(allowedCommunes.filter(Boolean).concat(commune && !allowedCommunes.length ? [commune] : [])))
      const communeDataList = await Promise.all(scopeCommunes.map(async (scopeCommune) => {
        try {
          const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(scopeCommune)}`)
          return response.ok ? await response.json() as { commune?: string; lat?: number; lng?: number; bounds?: [[number, number], [number, number]]; geometry?: GeoJSON.Geometry } : null
        } catch { return null }
      }))
      const communeData = communeDataList.find((item) => item?.commune === commune) || communeDataList[0] || null
      if (cancelled || !containerRef.current) return
      const communeLatitude = Number(communeData?.lat)
      const communeLongitude = Number(communeData?.lng)
      const hasCommuneCenter = Number.isFinite(communeLatitude) && Number.isFinite(communeLongitude)
      const map = L.map(containerRef.current, { center: hasInitialLocation ? [initialLocation.latitude, initialLocation.longitude] : hasCommuneCenter ? [communeLatitude, communeLongitude] : [34.05, -6.8], zoom: hasInitialLocation ? 16 : hasCommuneCenter ? 13 : 12, zoomControl: true, doubleClickZoom: false })
      mapRef.current = map
      L.DomEvent.disableScrollPropagation(containerRef.current)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      const boundaryLayer = L.featureGroup()
      for (const data of communeDataList) {
        if (!data?.geometry) continue
        L.geoJSON({ type: 'Feature', properties: { commune: data.commune }, geometry: data.geometry } as GeoJSON.Feature, { style: { color: '#047857', weight: 5, opacity: 1, fillColor: '#10b981', fillOpacity: 0.12, dashArray: '10 6' } }).addTo(boundaryLayer)
      }
      if (boundaryLayer.getLayers().length) {
        boundaryLayer.addTo(map)
        if (!hasInitialLocation) map.fitBounds(boundaryLayer.getBounds(), { padding: [24, 24] })
      } else if (!hasInitialLocation && communeData?.bounds) map.fitBounds(communeData.bounds, { padding: [24, 24] })
      const placeMarker = (latitudeValue: number, longitudeValue: number) => {
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.circleMarker([latitudeValue, longitudeValue], { radius: 9, color: '#047857', weight: 3, fillColor: '#10b981', fillOpacity: 0.85 }).addTo(map)
        markerRef.current.bindTooltip(`خط العرض: ${latitudeValue.toFixed(6)}<br>خط الطول: ${longitudeValue.toFixed(6)}`, { permanent: true, direction: 'top', className: 'environment-location-tooltip' }).openTooltip()
      }
      if (hasInitialLocation) placeMarker(initialLocation.latitude, initialLocation.longitude)
      map.on('click', async (event: { latlng: { lat: number; lng: number } }) => {
        try {
          const response = await fetch(`/api/geocode/reverse?lat=${event.latlng.lat}&lng=${event.latlng.lng}`)
          const data = response.ok ? await response.json() as { found?: boolean; commune?: string; quartier?: string | null } : null
          if (!data?.found || !data.commune) {
            toast.error('تعذر تحديد الجماعة من هذه النقطة')
            return
          }
          if (scopeCommunes.length && !scopeCommunes.includes(data.commune)) {
            toast.error('لا يمكن اختيار موقع خارج حدود جماعة الحساب')
            return
          }
          const nextLocation = { latitude: event.latlng.lat, longitude: event.latlng.lng }
          setSelected(nextLocation)
          onSelect(nextLocation.latitude, nextLocation.longitude, data.commune, data.quartier || '')
          placeMarker(nextLocation.latitude, nextLocation.longitude)
        } catch {
          toast.error('تعذر تحديد الجماعة والحي من الموقع')
        }
      })
      map.on('dblclick', () => map.zoomIn(1, { animate: true }))
      for (const delay of [100, 400, 1000]) invalidateTimers.push(window.setTimeout(() => map.invalidateSize(), delay))
    }
    void initialize()
    return () => { cancelled = true; invalidateTimers.forEach((timer) => window.clearTimeout(timer)); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [allowedCommunes, commune, onSelect])

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4" dir="rtl"><div className="flex h-[min(760px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><div className="flex items-center justify-between gap-3 bg-gradient-to-l from-emerald-800 to-teal-700 px-4 py-3 text-white"><div><h3 className="text-sm font-extrabold">🗺️ تحديد موقع الملف البيئي</h3><p className="text-[11px] text-emerald-100">انقر على الخريطة، وستظهر الإحداثيات تلقائياً في النموذج.</p></div><button type="button" onClick={onClose} className="rounded-lg bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25">✕</button></div><div ref={containerRef} className="min-h-0 flex-1 bg-slate-200" style={{ touchAction: 'none' }} /><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3"><p className="text-xs font-bold text-slate-600">{selected ? `✓ ${selected.latitude.toFixed(6)}, ${selected.longitude.toFixed(6)}` : 'لم يتم تحديد موقع بعد'}</p><button type="button" onClick={onClose} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">اعتماد الموقع والعودة للنموذج</button></div></div></div>
}

function InspectionForm({ dossiers, onCreated }: any) {
  const [f, setF] = useState({ environmentalDossierId: '', inspectionDate: new Date().toISOString().slice(0, 10), inspectorName: '', observation: '', probability: '1', severity: '1', extent: '', exposedPopulation: '0', milieu: '', probableSource: '', resolution: 'PENDING', nextAction: '', nextFollowUpDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const riskScore = Math.max(0, Math.min(100, (Number(f.probability) || 1) * (Number(f.severity) || 1) * 4))
  const riskLevel = riskScore >= 80 ? 'CRITICAL' : riskScore >= 48 ? 'HIGH' : riskScore >= 24 ? 'MEDIUM' : 'LOW'
  const selectedDossier = dossiers.find((dossier: EnvironmentalDossier) => dossier.id === f.environmentalDossierId)
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!f.environmentalDossierId) { toast.error('اختر ملفاً بيئياً'); return }; if (!f.observation.trim()) { toast.error('وصف المعاينة مطلوب'); return }; submitForm('/api/environmental-inspections', { ...f, exposedPopulation: Number(f.exposedPopulation) || 0, probability: Number(f.probability) || 1, severity: Number(f.severity) || 1, nextFollowUpDate: f.nextFollowUpDate || null }, onCreated, setSaving) }
  return <form onSubmit={submit} className="space-y-3"><div><label className="mb-1 block text-xs font-bold text-slate-600">الملف البيئي *</label><select required value={f.environmentalDossierId} onChange={(event) => setF({ ...f, environmentalDossierId: event.target.value })} className={inp}><option value="">اختر الملف</option>{dossiers.map((dossier: EnvironmentalDossier) => <option key={dossier.id} value={dossier.id}>{dossier.reference} — {dossier.title}</option>)}</select>{selectedDossier && <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">📁 {selectedDossier.title} · جماعة {selectedDossier.commune} · {selectedDossier.latitude != null && selectedDossier.longitude != null ? 'موقع جغرافي متوفر' : 'الموقع الجغرافي غير محدد'}</div>}</div><div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">تاريخ المعاينة *</label><input required type="date" value={f.inspectionDate} onChange={(event) => setF({ ...f, inspectionDate: event.target.value })} className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">اسم المعاين</label><input value={f.inspectorName} onChange={(event) => setF({ ...f, inspectorName: event.target.value })} className={inp} placeholder="يملأ تلقائياً إن ترك فارغاً" /></div></div><div className="grid grid-cols-2 gap-2"><div><label className="mb-1 block text-xs font-bold text-slate-600">احتمال الحدوث 1–5</label><input type="number" min="1" max="5" value={f.probability} onChange={(event) => setF({ ...f, probability: event.target.value })} className={inp} /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">شدة الأثر 1–5</label><input type="number" min="1" max="5" value={f.severity} onChange={(event) => setF({ ...f, severity: event.target.value })} className={inp} /></div></div><div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold text-amber-800">🧮 التقييم العلمي للمعاينة</p><p className="mt-1 text-[10px] text-amber-700">الاحتمال × شدة الأثر × 4</p></div><div className="text-left"><b className="text-2xl text-amber-800">{riskScore}/100</b><p className="text-[10px] font-bold text-amber-700">{riskLevel === 'CRITICAL' ? 'حرج' : riskLevel === 'HIGH' ? 'عالٍ' : riskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'}</p></div></div></div><textarea required value={f.observation} onChange={(event) => setF({ ...f, observation: event.target.value })} rows={3} className={inp} placeholder="المعاينة الميدانية والنتيجة الأساسية *" /><div className="grid grid-cols-2 gap-2"><input value={f.extent} onChange={(event) => setF({ ...f, extent: event.target.value })} className={inp} placeholder="النطاق المتأثر" /><input type="number" min="0" value={f.exposedPopulation} onChange={(event) => setF({ ...f, exposedPopulation: event.target.value })} className={inp} placeholder="السكان المتأثرون" /></div><div className="grid grid-cols-2 gap-2"><input value={f.probableSource} onChange={(event) => setF({ ...f, probableSource: event.target.value })} className={inp} placeholder="المصدر المحتمل" /><input value={f.milieu} onChange={(event) => setF({ ...f, milieu: event.target.value })} className={inp} placeholder="الوسط: ماء، هواء، تربة..." /></div><div className="grid grid-cols-2 gap-2"><select value={f.resolution} onChange={(event) => setF({ ...f, resolution: event.target.value })} className={inp}><option value="PENDING">نتيجة المعاينة: في الانتظار</option><option value="YES">مطابق / تمت المعالجة</option><option value="PARTIAL">مطابقة جزئية</option><option value="NO">غير مطابق / إجراء مطلوب</option></select><input type="date" value={f.nextFollowUpDate} onChange={(event) => setF({ ...f, nextFollowUpDate: event.target.value })} className={inp} aria-label="موعد المتابعة المقبلة" /></div><input value={f.nextAction} onChange={(event) => setF({ ...f, nextAction: event.target.value })} className={inp} placeholder="الإجراء التالي أو التوصية" /><textarea value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} rows={2} className={inp} placeholder="ملاحظات مهنية إضافية" /><button disabled={saving} className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ المعاينة وربطها بالملف'}</button></form>
}

function ProgramForm({ dossiers, buildParams, onCreated }: any) {
  const [f, setF] = useState({ year: String(new Date().getFullYear()), operation: '', axis: '', commune: '', environmentalDossierId: '', objective: '', responsible: '', indicator: '', quantitativeTarget: '0', achieved: '0', budget: '', status: 'PLANNED', startDate: '', endDate: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const accountCommune = buildParams().get('commune') || ''
  const calculatedProgress = Number(f.quantitativeTarget) > 0 ? Math.min(100, Math.round((Number(f.achieved || 0) / Number(f.quantitativeTarget)) * 100)) : 0
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!f.operation.trim()) { toast.error('اسم العملية مطلوب'); return }; submitForm('/api/environmental-programs', { ...f, commune: f.commune || accountCommune, startDate: f.startDate || null, endDate: f.endDate || null, budget: f.budget || null }, onCreated, setSaving) }
  return <form onSubmit={submit} className="space-y-3"><input required value={f.operation} onChange={(event) => setF({ ...f, operation: event.target.value })} className={inp} placeholder="العملية المبرمجة *" /><div className="grid grid-cols-2 gap-2"><input value={f.year} onChange={(event) => setF({ ...f, year: event.target.value })} type="number" min="2020" max="2100" className={inp} placeholder="السنة" /><input value={f.axis} onChange={(event) => setF({ ...f, axis: event.target.value })} className={inp} placeholder="المحور البيئي" /></div><div><label className="mb-1 block text-xs font-bold text-slate-600">الملف البيئي المرتبط</label><select value={f.environmentalDossierId} onChange={(event) => setF({ ...f, environmentalDossierId: event.target.value })} className={inp}><option value="">عملية عامة بدون ملف محدد</option>{dossiers.map((dossier: EnvironmentalDossier) => <option key={dossier.id} value={dossier.id}>{dossier.reference} — {dossier.title}</option>)}</select></div><textarea value={f.objective} onChange={(event) => setF({ ...f, objective: event.target.value })} className={inp} placeholder="الهدف المتوقع من العملية" /><div className="grid grid-cols-2 gap-2"><input value={f.indicator} onChange={(event) => setF({ ...f, indicator: event.target.value })} className={inp} placeholder="مؤشر القياس" /><input value={f.responsible} onChange={(event) => setF({ ...f, responsible: event.target.value })} className={inp} placeholder="المسؤول" /></div><div className="grid grid-cols-2 gap-2"><input value={f.quantitativeTarget} onChange={(event) => setF({ ...f, quantitativeTarget: event.target.value })} type="number" min="0" className={inp} placeholder="الهدف الكمي" /><input value={f.achieved} onChange={(event) => setF({ ...f, achieved: event.target.value })} type="number" min="0" className={inp} placeholder="المنجز الحالي" /></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs"><b className="text-emerald-800">📊 نسبة الإنجاز المحسوبة: {calculatedProgress}%</b><p className="mt-1 text-emerald-700">تُحسب تلقائياً من المنجز ÷ الهدف الكمي، ولا تُدخل يدوياً.</p></div><div className="grid grid-cols-2 gap-2"><select value={f.status} onChange={(event) => setF({ ...f, status: event.target.value })} className={inp}><option value="PLANNED">مخطط</option><option value="IN_PROGRESS">قيد الإنجاز</option><option value="COMPLETED">مكتمل</option><option value="DELAYED">متأخر</option><option value="CANCELLED">ملغى</option></select><input value={f.budget} onChange={(event) => setF({ ...f, budget: event.target.value })} type="number" min="0" className={inp} placeholder="الميزانية بالدرهم" /></div><div className="grid grid-cols-2 gap-2"><input type="date" value={f.startDate} onChange={(event) => setF({ ...f, startDate: event.target.value })} className={inp} aria-label="تاريخ البداية" /><input type="date" value={f.endDate} onChange={(event) => setF({ ...f, endDate: event.target.value })} className={inp} aria-label="تاريخ النهاية" /></div><textarea value={f.notes} onChange={(event) => setF({ ...f, notes: event.target.value })} rows={2} className={inp} placeholder="ملاحظات التنفيذ" /><button disabled={saving} className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ العملية في البرنامج'}</button></form>
}

function EnvironmentalEstablishmentsTab({ data, loading }: { data: Array<{ id: string; reference: string; name: string; activity: string; ownerName: string; telephone: string; commune: string; quartier: string; adresse: string; latitude: number | null; longitude: number | null; riskCategory: string; riskScore: number; status: string; _count?: { inspections: number } }>; loading: boolean }) {
  const [search, setSearch] = useState('')
  const filtered = data.filter((establishment) => !search || `${establishment.name} ${establishment.activity} ${establishment.quartier} ${establishment.reference}`.toLowerCase().includes(search.toLowerCase()))
  if (loading && data.length === 0) return <Spinner />
  return <div className="space-y-3"><div className="flex items-center gap-2"><input value={search} onChange={(event) => setSearch(event.target.value)} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="🔍 بحث عن مؤسسة أو نشاط أو حي" /><span className="text-xs text-slate-400">{filtered.length} منشأة</span></div>{filtered.length === 0 ? <Empty icon="🏭" text="لا توجد منشآت ذات أثر بيئي ضمن النطاق" /> : <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((establishment) => <div key={establishment.id} className="rounded-2xl border border-slate-100 bg-white p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-800">🏭 {establishment.name}</p><p className="text-[10px] text-slate-400">{establishment.reference} · {establishment.activity || 'النشاط غير محدد'}</p></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${establishment.riskCategory === 'HIGH' || establishment.riskCategory === 'CRITICAL' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{establishment.riskCategory || 'غير مصنف'}</span></div><div className="mt-2 space-y-1 text-xs text-slate-500"><p>👤 {establishment.ownerName || 'المسؤول غير محدد'} {establishment.telephone ? `· ${establishment.telephone}` : ''}</p><p>📍 {establishment.quartier || establishment.adresse || establishment.commune}</p><p>🔍 {establishment._count?.inspections || 0} معاينة · خطر {establishment.riskScore || 0}/100</p></div>{establishment.latitude != null && establishment.longitude != null && <a className="mt-3 inline-block text-xs font-bold text-emerald-700 hover:underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${establishment.latitude}&mlon=${establishment.longitude}#map=18/${establishment.latitude}/${establishment.longitude}`}>🗺️ فتح الموقع</a>}</div>)}</div>}</div>
}

function PollutionForm({ buildParams, allowedCommunes = [], onCreated }: any) {
  const [f, setF] = useState({ type: 'AIR', commune: '', quartier: '', adresse: '', latitude: '', longitude: '', description: '', severity: 'LOW', pollutantName: '', company: '', source: 'INTERNAL' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.description.trim()) { toast.error('الوصف مطلوب'); return }; const p = buildParams(); submitForm('/api/pollution-incidents', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL' }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">النوع</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}>{Object.entries(POLLUTION_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{POLLUTION_TYPE_ICONS[k]} {v}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الخطورة</label><select value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={inp}>{Object.entries(POLLUTION_SEVERITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوصف *</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الملوّث</label><input value={f.pollutantName} onChange={(e) => setF({ ...f, pollutantName: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">المصدر المتسبب</label><input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div></div>
    <LocationPicker latitude={f.latitude} longitude={f.longitude} allowedCommunes={f.commune || accountCommune ? [f.commune || accountCommune] : allowedCommunes} label="تحديد الموقع والجماعة والحي" title="موقع حادث التلوث" onSelect={({ latitude, longitude, commune, quartier }) => setF({ ...f, commune, quartier: quartier || f.quartier, latitude: String(latitude), longitude: String(longitude) })} />
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function WasteForm({ buildParams, allowedCommunes = [], onCreated }: any) {
  const [f, setF] = useState({ commune: '', quartier: '', adresse: '', latitude: '', longitude: '', description: '', wasteType: 'MIXED', recurring: false, source: 'INTERNAL' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); const p = buildParams(); submitForm('/api/waste-black-spots', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL' }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">نوع النفايات</label><select value={f.wasteType} onChange={(e) => setF({ ...f, wasteType: e.target.value })} className={inp}>{Object.entries(WASTE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">متكررة؟</label><select value={f.recurring ? '1' : '0'} onChange={(e) => setF({ ...f, recurring: e.target.value === '1' })} className={inp}><option value="0">لا</option><option value="1">نعم</option></select></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div></div>
    <LocationPicker latitude={f.latitude} longitude={f.longitude} allowedCommunes={f.commune || accountCommune ? [f.commune || accountCommune] : allowedCommunes} label="تحديد الموقع والجماعة والحي" title="موقع نقطة الرمي" onSelect={({ latitude, longitude, commune, quartier }) => setF({ ...f, commune, quartier: quartier || f.quartier, latitude: String(latitude), longitude: String(longitude) })} />
    <div><label className="text-xs font-bold text-slate-600 block mb-1">العنوان/الوصف</label><input value={f.description || f.adresse} onChange={(e) => setF({ ...f, description: e.target.value, adresse: e.target.value })} className={inp} /></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function SiteForm({ buildParams, allowedCommunes = [], onCreated }: any) {
  const [f, setF] = useState({ name: '', type: 'FOREST', commune: '', quartier: '', adresse: '', latitude: '', longitude: '', area: '', description: '', protectionLevel: 'NONE', status: 'INTACT', threats: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.name.trim()) { toast.error('الاسم مطلوب'); return }; const p = buildParams(); submitForm('/api/natural-sites', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL', area: f.area || null }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الاسم *</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">النوع</label><select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} className={inp}>{Object.entries(NATURAL_SITE_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{NATURAL_SITE_TYPE_ICONS[k]} {v}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">مستوى الحماية</label><select value={f.protectionLevel} onChange={(e) => setF({ ...f, protectionLevel: e.target.value })} className={inp}>{Object.entries(SITE_PROTECTION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">المساحة (هكتار)</label><input type="number" step="0.1" value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الحي</label><input value={f.quartier} onChange={(e) => setF({ ...f, quartier: e.target.value })} className={inp} /></div>
    <LocationPicker latitude={f.latitude} longitude={f.longitude} allowedCommunes={f.commune || accountCommune ? [f.commune || accountCommune] : allowedCommunes} label="تحديد الموقع والجماعة والحي" title="موقع المجال الطبيعي" onSelect={({ latitude, longitude, commune, quartier }) => setF({ ...f, commune, quartier: quartier || f.quartier, latitude: String(latitude), longitude: String(longitude) })} />
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوصف</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function CampaignForm({ dossiers, programs, buildParams, onCreated }: any) {
  const [f, setF] = useState({ title: '', theme: 'GENERAL', commune: '', environmentalDossierId: '', environmentalProgramId: '', description: '', targetAudience: '', startDate: '', endDate: '', organizerName: '', participantsCount: '', budget: '', status: 'PLANNED', outcomes: '', notes: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (!f.title.trim()) { toast.error('العنوان مطلوب'); return }; const p = buildParams(); submitForm('/api/awareness-campaigns', { ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL', startDate: f.startDate || null, endDate: f.endDate || null, participantsCount: f.participantsCount || '0', budget: f.budget || null }, () => onCreated(), setSaving) }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">العنوان *</label><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">الموضوع</label><select value={f.theme} onChange={(e) => setF({ ...f, theme: e.target.value })} className={inp}>{Object.entries(CAMPAIGN_THEME_LABELS).map(([k, v]) => <option key={k} value={k}>{CAMPAIGN_THEME_ICONS[k]} {v}</option>)}</select></div><div><label className="text-xs font-bold text-slate-600 block mb-1">المنظّم</label><input value={f.organizerName} onChange={(e) => setF({ ...f, organizerName: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">البداية</label><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">النهاية</label><input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><div><label className="text-xs font-bold text-slate-600 block mb-1">عدد المشاركين</label><input type="number" value={f.participantsCount} onChange={(e) => setF({ ...f, participantsCount: e.target.value })} className={inp} /></div><div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div></div>
    <div className="grid grid-cols-2 gap-2"><select value={f.environmentalDossierId} onChange={(e) => setF({ ...f, environmentalDossierId: e.target.value })} className={inp}><option value="">ملف بيئي اختياري</option>{dossiers.map((dossier: EnvironmentalDossier) => <option key={dossier.id} value={dossier.id}>{dossier.reference} — {dossier.title}</option>)}</select><select value={f.environmentalProgramId} onChange={(e) => setF({ ...f, environmentalProgramId: e.target.value })} className={inp}><option value="">برنامج سنوي اختياري</option>{programs.map((program: EnvironmentalProgram) => <option key={program.id} value={program.id}>{program.reference} — {program.operation}</option>)}</select></div>
    <div className="grid grid-cols-2 gap-2"><select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} className={inp}><option value="PLANNED">مخططة</option><option value="ACTIVE">نشطة</option><option value="COMPLETED">مكتملة</option><option value="CANCELLED">ملغاة</option></select><input type="number" min="0" value={f.budget} onChange={(e) => setF({ ...f, budget: e.target.value })} className={inp} placeholder="الميزانية بالدرهم" /></div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوصف</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <textarea value={f.outcomes} onChange={(e) => setF({ ...f, outcomes: e.target.value })} rows={2} className={inp} placeholder="النتائج المحققة أو المتوقعة" /><textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} rows={2} className={inp} placeholder="ملاحظات التنفيذ" />
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}
