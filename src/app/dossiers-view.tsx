'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type DossierSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import ListTab from './dossiers/list-tab'
import DetailTab from './dossiers/detail-tab'
import type { Dossier } from './dossiers/types'

interface DossiersViewProps {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

export default function DossiersView({ selectedCommune, territoryFilter, useTerritoryFilter }: DossiersViewProps) {
  const { dossierSubTab, setDossierSubTab, selectedYear } = useAppStore()
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Dossier | null>(null)

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
      const res = await fetch(`/api/dossiers?${buildParams().toString()}`)
      if (res.ok) {
        const data = await res.json()
        setDossiers(data.dossiers || [])
      }
    } catch {
      toast.error('حدث خطأ أثناء تحميل الملفات')
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  // إحصائيات سريعة للترويسة
  const stats = React.useMemo(() => {
    const total = dossiers.length
    const byStatus: Record<string, number> = {}
    const byOffice: Record<string, number> = {}
    let urgent = 0
    for (const d of dossiers) {
      byStatus[d.status] = (byStatus[d.status] || 0) + 1
      if (d.office) byOffice[d.office] = (byOffice[d.office] || 0) + 1
      if (d.priority === 'URGENTE' || d.priority === 'SANITAIRE') urgent++
    }
    const open = total - (byStatus['CLOSED'] || 0) - (byStatus['ARCHIVED'] || 0)
    return { total, byStatus, byOffice, urgent, open }
  }, [dossiers])

  const openDetail = useCallback((d: Dossier) => {
    setSelected(d)
    setDossierSubTab('detail')
  }, [setDossierSubTab])

  const backToList = useCallback(() => {
    setSelected(null)
    setDossierSubTab('list')
  }, [setDossierSubTab])

  return (
    <div className="space-y-4" dir="rtl">
      {/* الترويسة */}
      <div className="bg-gradient-to-l from-indigo-600 to-violet-600 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <span className="text-2xl sm:text-3xl">🗂️</span>
              الملفات الموحّدة
            </h1>
            <p className="text-indigo-50 text-xs sm:text-sm mt-0.5">
              نظام موحّد لتدبير كل الملفات عبر المكاتب التسعة
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none">{stats.total}</div>
              <div className="text-[10px] opacity-80 mt-0.5">الإجمالي</div>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none text-blue-200">{stats.open}</div>
              <div className="text-[10px] opacity-80 mt-0.5">مفتوح</div>
            </div>
            {stats.urgent > 0 && (
              <div className="bg-red-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20">
                <div className="text-lg font-black leading-none text-red-100">{stats.urgent}</div>
                <div className="text-[10px] opacity-80 mt-0.5">⚠️ عاجل</div>
              </div>
            )}
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center">
              <div className="text-lg font-black leading-none text-emerald-200">{stats.byStatus['CLOSED'] || 0}</div>
              <div className="text-[10px] opacity-80 mt-0.5">مغلق</div>
            </div>
          </div>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        <button
          onClick={backToList}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
            dossierSubTab === 'list'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'
          }`}
        >
          <span>📋</span>
          <span>القائمة</span>
          {stats.total > 0 && (
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-white/20">{stats.total}</span>
          )}
        </button>
        {selected && (
          <button
            onClick={() => setDossierSubTab('detail')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${
              dossierSubTab === 'detail'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-slate-600 hover:bg-indigo-50 border border-slate-200'
            }`}
          >
            <span>📄</span>
            <span className="max-w-[180px] truncate">{selected.reference}</span>
          </button>
        )}
      </div>

      {/* المحتوى */}
      <AnimatePresence mode="wait">
        <motion.div
          key={dossierSubTab + (selected?.id || '')}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {dossierSubTab === 'list' && (
            <ListTab
              dossiers={dossiers}
              loading={loading}
              onRefresh={refresh}
              buildParams={buildParams}
              onOpenDetail={openDetail}
            />
          )}
          {dossierSubTab === 'detail' && selected && (
            <DetailTab
              dossier={selected}
              onBack={backToList}
              onRefresh={async () => {
                await refresh()
                // أعد تحميل الملف المحدد بأحدث البيانات
                try {
                  const res = await fetch(`/api/dossiers/${selected.id}`)
                  if (res.ok) {
                    const data = await res.json()
                    if (data.dossier) setSelected(data.dossier)
                  }
                } catch { /* ignore */ }
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
