'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type SanitarySubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import DashboardTab from './sanitary/dashboard-tab'
import EstablishmentsTab from './sanitary/establishments-tab'
import InspectionsTab from './sanitary/inspections-tab'
import HealthCardsTab from './sanitary/healthcards-tab'
import SamplesTab from './sanitary/samples-tab'
import SanitaryMapTab from './sanitary/map-tab'
import SanitarySettingsTab from './sanitary/settings-tab'
import type { Establishment, Inspection, HealthCard, Sample } from './sanitary/types'
import type { SanitaryDashboardMetrics } from './sanitary/metrics'
import { useMapTerritoryScope } from '@/hooks/use-map-territory-scope'

interface SanitaryViewProps {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: SanitarySubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'map', label: 'الخريطة الصحية', icon: '🗺️' },
  { id: 'establishments', label: 'المنشآت', icon: '🏪' },
  { id: 'inspections', label: 'التفتيشات', icon: '🔍' },
  { id: 'healthCards', label: 'البطاقات الصحية', icon: '🩺' },
  { id: 'samples', label: 'العينات', icon: '🧪' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
]

const TAB_GROUP = { label: 'المراقبة الصحية والسلامة الغذائية', icon: '🍽️', description: 'المؤشرات والخريطة والسجلات الصحية' }

export default function SanitaryView({ selectedCommune, territoryFilter, useTerritoryFilter }: SanitaryViewProps) {
  const { sanitarySubTab, setSanitarySubTab, selectedYear, user } = useAppStore()
  const [establishments, setEstablishments] = useState<Establishment[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [healthCards, setHealthCards] = useState<HealthCard[]>([])
  const [samples, setSamples] = useState<Sample[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<SanitaryDashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const contentTopRef = useRef<HTMLElement>(null)
  const previousSubTabRef = useRef(sanitarySubTab)

  const { allowedCommunes } = useMapTerritoryScope(user, selectedCommune, territoryFilter, useTerritoryFilter)

  useEffect(() => {
    if (previousSubTabRef.current === sanitarySubTab) return
    previousSubTabRef.current = sanitarySubTab
    contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [sanitarySubTab])

  const selectSection = useCallback((tab: SanitarySubTab) => {
    setSanitarySubTab(tab)
    window.setTimeout(() => contentTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }, [setSanitarySubTab])

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
      const [estRes, inspRes, hcRes, sampRes, statsRes] = await Promise.allSettled([
        fetch(`/api/establishments?${buildParams().toString()}`),
        fetch(`/api/inspections?${buildParams().toString()}`),
        fetch(`/api/health-cards?${buildParams().toString()}`),
        fetch(`/api/samples?${buildParams().toString()}`),
        fetch(`/api/sanitary/statistics?${buildParams().toString()}`),
      ])
      if (estRes.status === 'fulfilled' && estRes.value.ok) {
        const d = await estRes.value.json()
        setEstablishments(d.establishments || [])
      }
      if (inspRes.status === 'fulfilled' && inspRes.value.ok) {
        const d = await inspRes.value.json()
        setInspections(d.inspections || [])
      }
      if (hcRes.status === 'fulfilled' && hcRes.value.ok) {
        const d = await hcRes.value.json()
        setHealthCards(d.healthCards || [])
      }
      if (sampRes.status === 'fulfilled' && sampRes.value.ok) {
        const d = await sampRes.value.json()
        setSamples(d.samples || [])
      }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        const d = await statsRes.value.json()
        setDashboardMetrics(d.metrics || null)
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const activeTab = TABS.find((tab) => tab.id === sanitarySubTab) || TABS[0]

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-teal-600 to-cyan-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">🍽️</span>
              المراقبة الصحية والسلامة الغذائية
            </h1>
            <p className="text-teal-50 text-xs sm:text-sm mt-0.5">
              سجل المنشآت والتفتيشات والبطاقات الصحية والعينات
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none">{establishments.length}</div>
              <div className="text-[10px] opacity-80 mt-0.5">منشأة</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none">{inspections.length}</div>
              <div className="text-[10px] opacity-80 mt-0.5">تفتيش</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none text-amber-200">
                {healthCards.filter(h => h.status === 'EXPIRED').length}
              </div>
              <div className="text-[10px] opacity-80 mt-0.5">بطاقة منتهية</div>
            </div>
          </div>
        </div>
      </div>

      <div className={`grid items-start gap-4 ${sidebarCollapsed ? 'lg:grid-cols-[72px_minmax(0,1fr)]' : 'lg:grid-cols-[250px_minmax(0,1fr)]'}`}>
        <aside className="space-y-3 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1" onWheel={(event) => event.stopPropagation()}>
          <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${sidebarCollapsed ? 'p-2' : 'p-3'}`}>
            <div className={`mb-3 flex items-center gap-2 border-b border-slate-100 pb-3 ${sidebarCollapsed ? 'justify-center' : ''}`}><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 text-lg">🍽️</span>{!sidebarCollapsed && <div className="min-w-0"><h2 className="text-sm font-extrabold text-slate-800">{TAB_GROUP.label}</h2><p className="mt-0.5 text-[10px] text-slate-500">{TAB_GROUP.description}</p></div>}<button type="button" onClick={() => setSidebarCollapsed((value) => !value)} className="mr-auto flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-500 hover:border-teal-300 hover:bg-teal-50" aria-label={sidebarCollapsed ? 'إظهار الشريط الجانبي' : 'تصغير الشريط الجانبي'}>{sidebarCollapsed ? '»' : '«'}</button></div>
            <nav className="space-y-1" aria-label={TAB_GROUP.label}>{TABS.map((tab) => <button key={tab.id} type="button" onClick={() => selectSection(tab.id)} aria-label={tab.label} title={sidebarCollapsed ? tab.label : undefined} className={`flex min-h-9 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-xs font-semibold transition-all ${sidebarCollapsed ? 'justify-center px-1' : ''} ${sanitarySubTab === tab.id ? 'bg-teal-600 text-white shadow-sm' : 'bg-slate-50 text-slate-600 hover:bg-teal-50 hover:text-teal-700'}`}><span className="text-sm">{tab.icon}</span>{!sidebarCollapsed && <span>{tab.label}</span>}</button>)}</nav>
          </div>
        </aside>
        <main ref={contentTopRef} className="min-w-0 scroll-mt-32">
          <div className="mb-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm"><p className="text-[10px] font-bold text-teal-600">المراقبة الصحية والسلامة الغذائية · المكتب 02</p><h2 className="mt-1 text-lg font-extrabold text-slate-800">{activeTab.label}</h2></div>
          <AnimatePresence mode="wait">
        <motion.div
          key={sanitarySubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {sanitarySubTab === 'dashboard' && (
            <DashboardTab
              establishments={establishments}
              inspections={inspections}
              healthCards={healthCards}
              samples={samples}
              dashboardMetrics={dashboardMetrics}
              onNavigate={(tab) => setSanitarySubTab(tab)}
            />
          )}
          {sanitarySubTab === 'map' && <SanitaryMapTab selectedCommune={selectedCommune} territoryFilter={territoryFilter} useTerritoryFilter={useTerritoryFilter} allowedCommunes={allowedCommunes} selectedYear={selectedYear} />}
          {sanitarySubTab === 'establishments' && (
            <EstablishmentsTab establishments={establishments} loading={loading} onRefresh={refresh} buildParams={buildParams} />
          )}
          {sanitarySubTab === 'inspections' && (
            <InspectionsTab inspections={inspections} establishments={establishments} loading={loading} onRefresh={refresh} buildParams={buildParams} />
          )}
          {sanitarySubTab === 'healthCards' && (
            <HealthCardsTab healthCards={healthCards} loading={loading} onRefresh={refresh} buildParams={buildParams} />
          )}
          {sanitarySubTab === 'samples' && (
            <SamplesTab samples={samples} loading={loading} onRefresh={refresh} buildParams={buildParams} />
          )}
          {sanitarySubTab === 'settings' && <SanitarySettingsTab selectedCommune={selectedCommune} />}
        </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
