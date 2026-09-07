'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type MapClickCoords } from '@/lib/store'
import { appendTerritoryParams, type TerritoryFilter } from '@/lib/geography'
import { GIS_LAYERS } from '@/lib/constants'
import GisView from './gis-view'

type Props = {
  selectedCommune: string
  territoryFilter: TerritoryFilter
  useTerritoryFilter: boolean
  onAddIntervention: () => void
  onMapClick: (location: MapClickCoords) => void
}

type GeoHealthPoint = {
  layer: string
  id: string
  reference: string
  title: string
  subtitle: string
  lat: number
  lng: number
  status: string
  commune: string
  createdAt: string
}

const ATTENTION_STATUSES = new Set([
  'CRITICAL',
  'HIGH',
  'URGENT',
  'SANITAIRE',
  'NON_CONFORM_MAJOR',
  'NON_CONFORM_CRITICAL',
])

function isAttentionStatus(status: string): boolean {
  return ATTENTION_STATUSES.has(status.toUpperCase())
}

export default function GeoHealthView({ selectedCommune, territoryFilter, useTerritoryFilter, onAddIntervention, onMapClick }: Props) {
  const { selectedYear, setGisFocusLayer } = useAppStore()
  const [points, setPoints] = useState<GeoHealthPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const buildParams = useCallback(() => {
    const params = new URLSearchParams()
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    if (selectedYear) params.set('year', selectedYear)
    params.set('layers', GIS_LAYERS.map((layer) => layer.key).join(','))
    return params
  }, [selectedCommune, selectedYear, territoryFilter, useTerritoryFilter])

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/geohealth/features?${buildParams().toString()}`)
      const data = await response.json() as { points?: GeoHealthPoint[]; error?: string }
      if (!response.ok) throw new Error(data.error || 'تعذر تحميل ملخص GeoHealth')
      setPoints(Array.isArray(data.points) ? data.points : [])
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : 'تعذر تحميل الملخص'
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [buildParams])

  useEffect(() => {
    // لا نريد فتح GeoHealth بطبقة مركزة موروثة من قسم آخر.
    setGisFocusLayer(null)
  }, [setGisFocusLayer])

  useEffect(() => {
    void loadSummary()
  }, [loadSummary])

  const summary = useMemo(() => {
    const sections = new Set<string>()
    const communes = new Set<string>()
    const layers = new Set<string>()
    let attention = 0
    let latest: string | null = null

    for (const point of points) {
      const layer = GIS_LAYERS.find((item) => item.key === point.layer)
      if (layer) sections.add(layer.section)
      layers.add(point.layer)
      if (point.commune) communes.add(point.commune)
      if (isAttentionStatus(point.status)) attention += 1
      if (point.createdAt && (!latest || point.createdAt > latest)) latest = point.createdAt
    }

    return { sections: sections.size, communes: communes.size, layers: layers.size, attention, latest }
  }, [points])

  const latestLabel = summary.latest
    ? new Date(summary.latest).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })
    : 'لا توجد بيانات مؤرخة'

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl bg-gradient-to-l from-emerald-800 via-teal-700 to-slate-800 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">BCH GeoHealth AI · Phase 1</p>
            <h1 className="flex items-center gap-2 text-2xl font-black"><span>🧭</span> التحليل الجغرافي للصحة والبيئة</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-emerald-50">
              مساحة موحّدة لاستكشاف بيانات الأقسام المكانية، مع احترام نطاق الحساب وربط كل نقطة بالقسم والملف الأصلي.
            </p>
          </div>
          <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs font-bold backdrop-blur-sm">
            <div>النطاق: {selectedCommune === 'ALL' ? 'كل النطاق المتاح' : selectedCommune}</div>
            <div className="mt-1 text-emerald-200">التحديث: يدوي عند فتح الوحدة أو الضغط على تحديث SIG</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'النقاط المكانية', value: points.length, icon: '📍', tone: 'text-slate-800', bg: 'bg-slate-50' },
          { label: 'الطبقات النشطة', value: summary.layers, icon: '🗂️', tone: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'الأقسام المرتبطة', value: summary.sections, icon: '🏢', tone: 'text-violet-700', bg: 'bg-violet-50' },
          { label: 'الجماعات المشمولة', value: summary.communes, icon: '🏛️', tone: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'تحتاج انتباهاً', value: summary.attention, icon: '⚠️', tone: 'text-rose-700', bg: 'bg-rose-50' },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border border-slate-100 ${card.bg} px-3 py-3 shadow-sm`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <div className={`mt-1 text-xl font-black ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3 text-xs text-emerald-900">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold">📊 مؤشر المتابعة</span>
          <span>الحالات ذات الأولوية: {summary.attention}</span>
          <span>آخر بيانات: {latestLabel}</span>
        </div>
        <button type="button" onClick={() => void loadSummary()} disabled={loading} className="rounded-xl bg-emerald-700 px-3 py-2 font-bold text-white hover:bg-emerald-800 disabled:opacity-50">
          {loading ? '⏳ جارٍ التحديث...' : '↻ تحديث الملخص'}
        </button>
      </div>

      {error && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
          تعذر تحميل الملخص: {error}
        </motion.div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-black text-slate-800">🗺️ الخريطة الموحدة لـ GeoHealth</h2>
            <p className="mt-1 text-xs text-slate-500">تبديل الطبقات، البحث، إظهار وإخفاء الكل، التصدير، والتركيز على نطاق الحساب متاح من لوحة SIG.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">البيانات المعروضة من النماذج الحالية فقط</span>
        </div>
        <GisView
          selectedCommune={selectedCommune}
          territoryFilter={territoryFilter}
          useTerritoryFilter={useTerritoryFilter}
          onAddIntervention={onAddIntervention}
          onMapClick={onMapClick}
          analysisMode
        />
      </div>
    </div>
  )
}
