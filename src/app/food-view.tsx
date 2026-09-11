'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type FoodSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import DashboardTab from './food/dashboard-tab'
import ListTab from './food/list-tab'
import MapTab from './food/map-tab'
import type { FoodReport } from './food/types'
import { useMapTerritoryScope } from '@/hooks/use-map-territory-scope'

interface FoodViewProps {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: FoodSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'list', label: 'البلاغات', icon: '📢' },
  { id: 'map', label: 'الخريطة', icon: '🗺️' },
]

export default function FoodView({ selectedCommune, territoryFilter, useTerritoryFilter }: FoodViewProps) {
  const { user, foodSubTab, setFoodSubTab, selectedYear } = useAppStore()
  const [reports, setReports] = useState<FoodReport[]>([])
  const [loading, setLoading] = useState(false)
  const [externalFilter, setExternalFilter] = useState<{ type?: string; status?: string } | null>(null)

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
      const res = await fetch(`/api/food-reports?${buildParams().toString()}`)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل البلاغات الغذائية')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const { allowedCommunes: mapAllowedCommunes } = useMapTerritoryScope(user, selectedCommune, territoryFilter, useTerritoryFilter)

  // إحصائيات سريعة للترويسة
  const stats = React.useMemo(() => {
    const total = reports.length
    const nouveau = reports.filter((r) => r.statut === 'NOUVEAU').length
    const urgent = reports.filter((r) => r.priority === 'URGENTE' || r.priority === 'SANITAIRE').length
    const resolved = reports.filter((r) => ['TRAITE', 'REJETE', 'CLASSE'].includes(r.statut)).length
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0
    return { total, nouveau, urgent, resolutionRate }
  }, [reports])

  // فتح القائمة بفلتر خارجي (من dashboard)
  const openListWithFilter = useCallback((filter?: { type?: string; status?: string }) => {
    setExternalFilter(filter || null)
    setFoodSubTab('list')
  }, [setFoodSubTab])

  return (
    <div className="space-y-4" dir="rtl">
      {/* الترويسة الغنية */}
      <div className="bg-gradient-to-l from-rose-600 to-red-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">🥗</span>
              السلامة الغذائية
            </h1>
            <p className="text-rose-50 text-xs sm:text-sm mt-0.5">
              تدبير بلاغات ومخالفات السلامة الغذائية
            </p>
          </div>
          {/* KPIs مصغّرة في الترويسة */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none">{stats.total}</div>
              <div className="text-[10px] opacity-80 mt-0.5">الإجمالي</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none text-blue-200">{stats.nouveau}</div>
              <div className="text-[10px] opacity-80 mt-0.5">جديد</div>
            </div>
            {stats.urgent > 0 && (
              <div className="bg-red-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20">
                <div className="text-lg font-black leading-none text-red-100">{stats.urgent}</div>
                <div className="text-[10px] opacity-80 mt-0.5">⚠️ عاجل</div>
              </div>
            )}
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none text-emerald-200">{stats.resolutionRate}%</div>
              <div className="text-[10px] opacity-80 mt-0.5">معالَجة</div>
            </div>
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFoodSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              foodSubTab === tab.id
                ? 'bg-rose-600 text-white shadow-md shadow-rose-200'
                : 'bg-white text-slate-600 hover:bg-rose-50 border border-slate-200'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.id === 'list' && stats.total > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/20">{stats.total}</span>
            )}
            {tab.id === 'list' && stats.nouveau > 0 && (
              <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-blue-500 text-white">{stats.nouveau}</span>
            )}
          </button>
        ))}
      </div>

      {/* المحتوى */}
      <AnimatePresence mode="wait">
        <motion.div
          key={foodSubTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {foodSubTab === 'dashboard' && (
            <DashboardTab reports={reports} onOpenList={openListWithFilter} />
          )}
          {foodSubTab === 'list' && (
            <ListTab
              reports={reports}
              loading={loading}
              onRefresh={refresh}
              buildParams={buildParams}
              externalFilter={externalFilter}
              onClearExternalFilter={() => setExternalFilter(null)}
            />
          )}
          {foodSubTab === 'map' && (
            <MapTab reports={reports} selectedCommune={selectedCommune} allowedCommunes={mapAllowedCommunes} onRefresh={refresh} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
