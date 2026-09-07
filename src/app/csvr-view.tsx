'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type CsvrSubTab } from '@/lib/store'
import { appendTerritoryParams, ALL_TERRITORIES, hasTerritorySelection, type TerritoryCatalog, type TerritoryFilter } from '@/lib/geography'
import { COMMUNE_LABELS, COMMUNE_COLORS } from '@/lib/constants'
import DashboardTab from './csvr/dashboard-tab'
import AlertsTab from './csvr/alerts-tab'
import ReportsTab from './csvr/reports-tab'
import MapTab from './csvr/map-tab'
import MissionsTab from './csvr/missions-tab'
import AnimalsTab from './csvr/animals-tab'
import CareTab from './csvr/care-tab'
import CentersTab from './csvr/centers-tab'
import TransportTab from './csvr/transport-tab'
import AdoptionTab from './csvr/adoption-tab'
import HealthTab from './csvr/health-tab'
import BiteCasesTab from './csvr/bite-cases-tab'
import DeathReportsTab from './csvr/death-reports-tab'
import HotspotsTab from './csvr/hotspots-tab'
import PartnersTab from './csvr/partners-tab'
import IdentificationsTab from './csvr/identifications-tab'
import PhotosTab from './csvr/photos-tab'
import CampaignsTab from './csvr/campaigns-tab'
import CampaignFollowupTab from './csvr/campaign-followup-tab'
import ExportsTab from './csvr/exports-tab'
import SettingsTab from './csvr/settings-tab'
import type { StrayReport, CaptureMission, StrayAnimal, CsvrStatistics } from './csvr/types'

interface CsvrViewProps {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
  selectedYear: string
}

const TABS: { id: CsvrSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'alerts', label: 'التنبيهات الميدانية', icon: '🚨' },
  { id: 'reports', label: 'البلاغات', icon: '📢' },
  { id: 'map', label: 'الخريطة', icon: '🗺️' },
  { id: 'missions', label: 'المهمات', icon: '🎯' },
  { id: 'animals', label: 'السجل', icon: '🐾' },
  { id: 'care', label: 'الرعاية والوجهة', icon: '🩺' },
  { id: 'centers', label: 'المراكز والاستقبال', icon: '🏠' },
  { id: 'transport', label: 'النقل الميداني', icon: '🚐' },
  { id: 'adoption', label: 'التبني', icon: '🤝' },
  { id: 'health', label: 'المراقبة الصحية', icon: '🩸' },
  { id: 'bites', label: 'سجل العضّات والحوادث', icon: '🦷' },
  { id: 'deaths', label: 'الحيوانات النافقة', icon: '🕊️' },
  { id: 'hotspots', label: 'النقاط الساخنة', icon: '🔥' },
  { id: 'partners', label: 'الشركاء والجهات', icon: '🤝' },
  { id: 'identification', label: 'التعريف', icon: '🏷️' },
  { id: 'photos', label: 'التوثيق المصوّر', icon: '📸' },
  { id: 'campaigns', label: 'البرنامج السنوي', icon: '🗓️' },
  { id: 'followup', label: 'المتابعة الميدانية', icon: '📈' },
  { id: 'exports', label: 'التقارير والتصدير', icon: '📤' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
]

const TAB_GROUPS: { label: string; icon: string; description: string; panel: string; accent: string; ids: CsvrSubTab[] }[] = [
  { label: 'نظرة عامة وميدانياً', icon: '🧭', description: 'المؤشرات، التنبيهات والخريطة والعمليات اليومية', panel: 'border-blue-200 bg-blue-50/60', accent: 'bg-blue-100 text-blue-700', ids: ['dashboard', 'alerts', 'map', 'reports', 'missions'] },
  { label: 'التدبير والتكفل', icon: '🐾', description: 'السجل، الرعاية، المراكز والنقل', panel: 'border-amber-200 bg-amber-50/60', accent: 'bg-amber-100 text-amber-700', ids: ['animals', 'care', 'centers', 'transport', 'adoption'] },
  { label: 'الصحة واليقظة', icon: '🩺', description: 'المراقبة الصحية والعضّات والحالات الحساسة', panel: 'border-rose-200 bg-rose-50/60', accent: 'bg-rose-100 text-rose-700', ids: ['health', 'bites', 'deaths', 'hotspots'] },
  { label: 'التخطيط والتتبع', icon: '📋', description: 'البرامج، الشركاء، التقارير والتوثيق', panel: 'border-emerald-200 bg-emerald-50/60', accent: 'bg-emerald-100 text-emerald-700', ids: ['campaigns', 'followup', 'exports', 'identification', 'photos', 'partners', 'settings'] },
]

export default function CsvrView({ selectedCommune, territoryFilter, useTerritoryFilter, selectedYear }: CsvrViewProps) {
  const { user, csvrSubTab, setCsvrSubTab } = useAppStore()
  const [reports, setReports] = useState<StrayReport[]>([])
  const [missions, setMissions] = useState<CaptureMission[]>([])
  const [animals, setAnimals] = useState<StrayAnimal[]>([])
  const [stats, setStats] = useState<CsvrStatistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [openSidebarGroups, setOpenSidebarGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(TAB_GROUPS.map((group) => [group.label, true])))
  const contentTopRef = useRef<HTMLElement>(null)
  const previousSubTabRef = useRef(csvrSubTab)

  useEffect(() => {
    if (previousSubTabRef.current === csvrSubTab) return
    previousSubTabRef.current = csvrSubTab
    contentTopRef.current?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [csvrSubTab])

  // Load territory catalog for scope display
  const [catalog, setCatalog] = useState<TerritoryCatalog | null>(null)
  useEffect(() => {
    let active = true
    fetch('/geography/catalog.json')
      .then((r) => r.ok ? r.json() : null)
      .then((data: TerritoryCatalog | null) => { if (active && data) setCatalog(data) })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  // Compute the current scope label and covered communes count
  const territoryScope = useMemo(() => {
    const tf = territoryFilter as TerritoryFilter
    if (!useTerritoryFilter || !hasTerritorySelection(tf) || !catalog) {
      return { label: null, coveredCommunes: null, scopeParts: [] as { label: string; sub: string }[] }
    }
    const name = (code: string, entries: { code: string; nameAr?: string; name?: string; nameFr?: string }[]) => {
      const e = entries.find((x) => x.code === code)
      return e?.nameAr || e?.name || e?.nameFr || code
    }
    const parts: { label: string; sub: string }[] = []
    if (tf.regionCode !== ALL_TERRITORIES) {
      parts.push({ label: name(tf.regionCode, catalog.regions), sub: 'جهة' })
    }
    if (tf.provinceCode !== ALL_TERRITORIES) {
      parts.push({ label: name(tf.provinceCode, catalog.provinces), sub: 'إقليم/عمالة' })
    }
    if (tf.communeCode !== ALL_TERRITORIES) {
      parts.push({ label: name(tf.communeCode, catalog.communes), sub: 'جماعة' })
    }

    // Count covered communes
    const covered = catalog.communes.filter((c) => (
      (tf.regionCode === ALL_TERRITORIES || c.regionCode === tf.regionCode) &&
      (tf.provinceCode === ALL_TERRITORIES || c.provinceCode === tf.provinceCode) &&
      (tf.communeCode === ALL_TERRITORIES || c.code === tf.communeCode)
    ))

    return {
      label: parts.map((p) => p.label).join(' › '),
      coveredCommunes: covered.length,
      scopeParts: parts,
    }
  }, [territoryFilter, useTerritoryFilter, catalog])

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    if (selectedYear) params.set('year', selectedYear)
    if (extra) {
      for (const [k, v] of Object.entries(extra)) params.set(k, v)
    }
    return params
  }, [selectedCommune, territoryFilter, useTerritoryFilter, selectedYear])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [repRes, misRes, aniRes, statRes] = await Promise.all([
        fetch(`/api/csvr/reports?${buildParams().toString()}`),
        fetch(`/api/csvr/missions?${buildParams().toString()}`),
        fetch(`/api/csvr/animals?${buildParams().toString()}`),
        fetch(`/api/csvr/statistics?${buildParams().toString()}`),
      ])
      if (repRes.ok) {
        const data = await repRes.json()
        setReports(data.reports || [])
      }
      if (misRes.ok) {
        const data = await misRes.json()
        setMissions(data.missions || [])
      }
      if (aniRes.ok) {
        const data = await aniRes.json()
        setAnimals(data.animals || [])
      }
      if (statRes.ok) {
        setStats(await statRes.json())
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل بيانات CSVR')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const activeTab = TABS.find((tab) => tab.id === csvrSubTab) || TABS[0]
  const mapAllowedCommunes = useMemo(() => {
    const accountCommunes = user?.managedCommunes?.length
      ? Array.from(new Set(user.managedCommunes))
      : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])
    if (user && user.role !== 'admin' && accountCommunes.length > 0) return accountCommunes
    if (selectedCommune !== 'ALL') return [selectedCommune]
    return []
  }, [selectedCommune, user?.commune, user?.managedCommunes, user?.role])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-l from-amber-500 to-orange-500 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">🐾</span>
              إدارة الحيوانات الشاردة
            </h1>
            <p className="text-amber-50 text-xs sm:text-sm mt-0.5">
              برنامج Capture · Stérilisation · Vaccination · Relâcher
            </p>
          </div>

          {/* Territory Scope Badge */}
          <div className="flex flex-col items-end gap-1.5">
            {territoryScope.label && territoryScope.coveredCommunes != null ? (
              <div className="flex items-center gap-2 text-xs bg-white/25 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="opacity-80">🌐 النطاق الترابي:</span>
                <span className="font-bold">{territoryScope.label}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5">
                <span className="opacity-80">🌐 النطاق:</span>
                <span className="font-bold">كل الجماعات</span>
              </div>
            )}
            {selectedCommune !== 'ALL' && (
              <div className="flex items-center gap-1.5 text-[10px] bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1">
                <span className="opacity-70">الجماعة:</span>
                <span className="font-bold">{COMMUNE_LABELS[selectedCommune] || selectedCommune}</span>
              </div>
            )}
            {territoryScope.coveredCommunes != null && territoryScope.coveredCommunes > 0 && (
              <div className="flex items-center gap-1 text-[10px] bg-white/15 backdrop-blur-sm rounded-full px-2.5 py-1">
                <span>📍</span>
                <span className="font-semibold">{territoryScope.coveredCommunes} جماعة مشمولة</span>
              </div>
            )}
          </div>
        </div>

        {/* Scope breadcrumb chips (visible when territory is scoped) */}
        {territoryScope.scopeParts.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/20">
            {territoryScope.scopeParts.map((part, idx) => (
              <div key={idx} className="flex items-center gap-1">
                {idx > 0 && <span className="text-white/50 text-xs">←</span>}
                <div className="flex flex-col bg-white/15 backdrop-blur-sm rounded-lg px-2.5 py-1">
                  <span className="text-[9px] text-amber-50/70 leading-none">{part.sub}</span>
                  <span className="text-xs font-bold leading-tight">{part.label}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`grid items-start gap-4 ${sidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
        <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1" onWheel={(event) => event.stopPropagation()}>
          <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            <div className={`mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 ${sidebarCollapsed ? 'justify-center' : ''}`}>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-lg">🐾</span>
              {!sidebarCollapsed && <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-slate-800">أقسام الحيوانات الشاردة</h2>
                <p className="mt-0.5 text-[10px] text-slate-500">اختر القسم المطلوب</p>
              </div>}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                className="mr-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700"
                aria-label={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'}
                title={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'}
              >
                {sidebarCollapsed ? '»' : '«'}
              </button>
            </div>
            <nav className="space-y-2" aria-label="أقسام إدارة الحيوانات الشاردة">
              {TAB_GROUPS.map((group) => (
                <section key={group.label} className={`rounded-xl border p-2 ${group.panel}`}>
                  <button
                    type="button"
                    onClick={() => setOpenSidebarGroups((current) => ({ ...current, [group.label]: !current[group.label] }))}
                    aria-expanded={openSidebarGroups[group.label]}
                    className={`mb-1.5 flex w-full items-center gap-1.5 rounded-lg px-1 text-right transition hover:bg-white/60 ${sidebarCollapsed ? 'justify-center' : ''}`}
                    title={openSidebarGroups[group.label] ? 'طي المجموعة' : 'إظهار المجموعة'}
                  >
                    <span className={`flex h-6 w-6 items-center justify-center rounded-lg text-sm ${group.accent}`}>{group.icon}</span>
                    {!sidebarCollapsed && <span className="text-[11px] font-extrabold text-slate-700">{group.label}</span>}
                    {!sidebarCollapsed && <span className="mr-auto text-[10px] text-slate-400">{openSidebarGroups[group.label] ? '⌃' : '⌄'}</span>}
                  </button>
                  {openSidebarGroups[group.label] && <div className="space-y-1">
                    {group.ids.map((id) => {
                      const tab = TABS.find((entry) => entry.id === id)
                      if (!tab) return null
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setCsvrSubTab(tab.id)}
                          aria-label={tab.label}
                          title={sidebarCollapsed ? tab.label : undefined}
                          className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-semibold transition-all ${sidebarCollapsed ? 'justify-center px-1' : ''} ${
                            csvrSubTab === tab.id
                              ? 'bg-amber-500 text-white shadow-sm'
                              : 'bg-white/85 text-slate-600 hover:bg-white hover:text-amber-700'
                          }`}
                          >
                            <span className="text-sm">{tab.icon}</span>
                            {!sidebarCollapsed && <span>{tab.label}</span>}
                          </button>
                      )
                    })}
                  </div>}
                </section>
              ))}
            </nav>
          </div>
        </aside>

        <main ref={contentTopRef} className="min-w-0 scroll-mt-4">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white px-4 py-3 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-2xl">{activeTab.icon}</span>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-amber-600">إدارة الحيوانات الشاردة · القسم الحالي</p>
                <h2 className="truncate text-base font-extrabold text-slate-800 sm:text-lg">{activeTab.label}</h2>
              </div>
            </div>
            <span className="hidden rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-700 sm:inline-flex">عرض القسم</span>
          </div>

          {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={csvrSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {csvrSubTab === 'dashboard' && (
            <DashboardTab stats={stats} loading={loading} />
          )}
          {csvrSubTab === 'alerts' && (
            <AlertsTab reports={reports} animals={animals} missions={missions} onNavigate={setCsvrSubTab} />
          )}
          {csvrSubTab === 'reports' && (
            <ReportsTab
              reports={reports}
              loading={loading}
              onRefresh={refresh}
              buildParams={buildParams}
            />
          )}
          {csvrSubTab === 'map' && (
            <MapTab
              reports={reports}
              animals={animals}
              missions={missions}
              onRefresh={refresh}
              buildParams={buildParams}
              selectedCommune={selectedCommune}
              allowedCommunes={mapAllowedCommunes}
              onNavigate={setCsvrSubTab}
            />
          )}
          {csvrSubTab === 'missions' && (
            <MissionsTab
              missions={missions}
              loading={loading}
              onRefresh={refresh}
              buildParams={buildParams}
            />
          )}
          {csvrSubTab === 'animals' && (
            <AnimalsTab
              animals={animals}
              loading={loading}
              onRefresh={refresh}
              buildParams={buildParams}
            />
          )}
          {csvrSubTab === 'care' && (
            <CareTab animals={animals} onRefresh={refresh} />
          )}
          {csvrSubTab === 'centers' && (
            <CentersTab animals={animals} buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'transport' && (
            <TransportTab animals={animals} onRefresh={refresh} />
          )}
          {csvrSubTab === 'adoption' && (
            <AdoptionTab animals={animals} onRefresh={refresh} />
          )}
          {csvrSubTab === 'health' && (
            <HealthTab animals={animals} onRefresh={refresh} />
          )}
          {csvrSubTab === 'bites' && (
            <BiteCasesTab animals={animals} buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'deaths' && (
            <DeathReportsTab buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'hotspots' && (
            <HotspotsTab buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'partners' && (
            <PartnersTab buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'identification' && (
            <IdentificationsTab animals={animals} onRefresh={refresh} />
          )}
          {csvrSubTab === 'photos' && (
            <PhotosTab animals={animals} />
          )}
          {csvrSubTab === 'campaigns' && (
            <CampaignsTab buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'followup' && (
            <CampaignFollowupTab buildParams={buildParams} onRefresh={refresh} />
          )}
          {csvrSubTab === 'exports' && (
            <ExportsTab reports={reports} animals={animals} missions={missions} buildParams={buildParams} />
          )}
          {csvrSubTab === 'settings' && (
            <SettingsTab selectedCommune={selectedCommune} />
          )}
        </motion.div>
      </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
