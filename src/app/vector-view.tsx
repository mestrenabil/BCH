'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type VectorSubTab } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import {
  PEST_PRODUCT_CATEGORY_LABELS, PEST_PRODUCT_CATEGORY_ICONS, PEST_PRODUCT_UNIT_LABELS,
  PEST_MOVEMENT_TYPE_LABELS, PEST_MOVEMENT_TYPE_COLORS, PEST_TARGETS,
  BITE_ANIMAL_LABELS, BITE_ANIMAL_ICONS, BITE_ANIMAL_STATUS_LABELS,
  BITE_CASE_STATUS_LABELS, BITE_CASE_STATUS_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { PestProduct, PestStockMovement, BiteCase, VectorDashboardMetrics } from './vector/types'
import VaccinationTracker from './csvr/vaccination-tracker'
import { RABIES_EXPOSURE_LABELS, RABIES_PROTOCOL_LABELS, RABIES_ROUTE_LABELS, RABIES_VACCINE_LABELS } from './csvr/rabies-vaccination'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
}

const TABS: { id: VectorSubTab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'products', label: 'مخزون البيوسيدات', icon: '🧪' },
  { id: 'bites', label: 'السع والعضة', icon: '🐕' },
]

function fmtDate(d: string | null) { if (!d) return '—'; return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) }
function daysUntil(d: string | null): number | null { if (!d) return null; return Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) }

export default function VectorView({ selectedCommune, territoryFilter, useTerritoryFilter }: Props) {
  const { vectorSubTab, setVectorSubTab, selectedYear } = useAppStore()
  const [products, setProducts] = useState<PestProduct[]>([])
  const [bites, setBites] = useState<BiteCase[]>([])
  const [dashboardMetrics, setDashboardMetrics] = useState<VectorDashboardMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCreate, setShowCreate] = useState<string | null>(null)
  const [movementsFor, setMovementsFor] = useState<PestProduct | null>(null) // عرض حركات منتج

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
      const [pRes, bRes, statsRes] = await Promise.allSettled([
        fetch(`/api/pest-products?${buildParams()}`),
        fetch(`/api/bite-cases?${buildParams()}`),
        fetch(`/api/vector/statistics?${buildParams()}`),
      ])
      if (pRes.status === 'fulfilled' && pRes.value.ok) { const d = await pRes.value.json(); setProducts(d.products || []) }
      if (bRes.status === 'fulfilled' && bRes.value.ok) { const d = await bRes.value.json(); setBites(d.biteCases || []) }
      if (statsRes.status === 'fulfilled' && statsRes.value.ok) { const d = await statsRes.value.json(); setDashboardMetrics(d.metrics || null) }
    } catch { toast.error('حدث خطأ') } finally { setLoading(false) }
  }, [buildParams])

  useEffect(() => { refresh() }, [refresh])

  const stats = useMemo(() => {
    const lowStock = products.filter(p => p.quantityStock <= p.thresholdAlert).length
    const expiring = products.filter(p => {
      const d = daysUntil(p.expiryDate); return d !== null && d <= 90
    }).length
    const openBites = bites.filter(b => !['CLOSED', 'LOST_CONTACT'].includes(b.status)).length
    const suspect = bites.filter(b => b.animalStatus === 'SUSPECT' && b.status !== 'CLOSED').length
    return { lowStock, expiring, openBites, suspect }
  }, [products, bites])

  return (
    <div className="space-y-4" dir="rtl">
      <div className="bg-gradient-to-l from-lime-600 to-green-700 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">🐀</span> محاربة النواقل والتطهير</h1>
            <p className="text-lime-50 text-xs sm:text-sm mt-0.5">مخزون البيوسيدات وحالات السع والعضة — المكتب 04</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{products.length}</div><div className="text-[10px] opacity-80 mt-0.5">منتج بيوسيد</div></div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center"><div className="text-lg font-black leading-none">{bites.length}</div><div className="text-[10px] opacity-80 mt-0.5">حالة عضة</div></div>
            {stats.lowStock > 0 && <div className="bg-red-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-red-100">{stats.lowStock}</div><div className="text-[10px] opacity-80 mt-0.5">مخزون منخفض</div></div>}
            {stats.suspect > 0 && <div className="bg-amber-900/30 backdrop-blur-sm rounded-xl px-3 py-1.5 text-center border border-white/20"><div className="text-lg font-black leading-none text-amber-100">{stats.suspect}</div><div className="text-[10px] opacity-80 mt-0.5">حيوان مشتبه</div></div>}
          </div>
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setVectorSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all ${vectorSubTab === tab.id ? 'bg-lime-600 text-white shadow-md shadow-lime-200' : 'bg-white text-slate-600 hover:bg-lime-50 border border-slate-200'}`}>
            <span>{tab.icon}</span><span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={vectorSubTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
          {vectorSubTab === 'dashboard' && <DashboardTab products={products} bites={bites} stats={stats} dashboardMetrics={dashboardMetrics} onNavigate={(t) => setVectorSubTab(t)} />}
          {vectorSubTab === 'products' && <ProductsTab products={products} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'product'} setShowCreate={(v) => setShowCreate(v ? 'product' : null)} onShowMovements={setMovementsFor} />}
          {vectorSubTab === 'bites' && <BitesTab bites={bites} loading={loading} onRefresh={refresh} buildParams={buildParams} showCreate={showCreate === 'bite'} setShowCreate={(v) => setShowCreate(v ? 'bite' : null)} />}
        </motion.div>
      </AnimatePresence>

      {/* لوحة الحركات */}
      <AnimatePresence>
        {movementsFor && <MovementsPanel product={movementsFor} onClose={() => setMovementsFor(null)} buildParams={buildParams} onMoved={refresh} />}
      </AnimatePresence>
    </div>
  )
}

// ===== Dashboard =====
function DashboardTab({ products, bites, stats, dashboardMetrics, onNavigate }: {
  products: PestProduct[]; bites: BiteCase[]; stats: { lowStock: number; expiring: number; openBites: number; suspect: number }
  dashboardMetrics?: VectorDashboardMetrics | null
  onNavigate: (t: VectorSubTab) => void
}) {
  const byCategory: Record<string, number> = {}
  let totalStockValue = 0
  for (const p of products) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1
    totalStockValue += p.quantityStock * p.unitPrice
  }
  const bitesByAnimal: Record<string, number> = {}
  for (const b of bites) bitesByAnimal[b.animalType] = (bitesByAnimal[b.animalType] || 0) + 1

  if (!dashboardMetrics && products.length === 0 && bites.length === 0) {
    return <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-6xl mb-4">🧪</div><h3 className="text-lg font-bold text-slate-700">لا توجد بيانات بعد</h3><p className="text-sm text-slate-500 mt-2">ابدأ بإضافة منتجات البيوسيدات أو تسجيل حالات السع.</p><div className="flex gap-2 justify-center mt-4"><button onClick={() => onNavigate('products')} className="px-4 py-2 text-sm font-bold text-white bg-lime-600 rounded-lg hover:bg-lime-700">➕ منتج</button><button onClick={() => onNavigate('bites')} className="px-4 py-2 text-sm font-bold text-white bg-lime-600 rounded-lg hover:bg-lime-700">➕ حالة عضة</button></div></div>
  }

  return (
    <div className="space-y-4">
      {/* تنبيهات */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        {(dashboardMetrics ? [
          { icon: '📦', value: dashboardMetrics.productsTotal, label: 'منتجات بيوسيد', go: 'products' as const },
          { icon: '⚠️', value: dashboardMetrics.lowStockProducts, label: 'مخزون منخفض', go: 'products' as const },
          { icon: '📅', value: dashboardMetrics.expiringProducts, label: 'تنتهي خلال 90 يوماً', go: 'products' as const },
          { icon: '⛔', value: dashboardMetrics.expiredProducts, label: 'منتجات منتهية', go: 'products' as const },
          { icon: '🔁', value: dashboardMetrics.stockMovements, label: 'حركات المخزون', go: 'products' as const },
          { icon: '📤', value: dashboardMetrics.stockOutMovements, label: 'عمليات إخراج', go: 'products' as const },
          { icon: '🐕', value: dashboardMetrics.bitesTotal, label: 'حالات عضّات', go: 'bites' as const },
          { icon: '🩺', value: dashboardMetrics.openBites, label: 'عضّات مفتوحة', go: 'bites' as const },
          { icon: '🚨', value: dashboardMetrics.suspectBites, label: 'حالات مشتبهة', go: 'bites' as const },
          { icon: '💉', value: dashboardMetrics.rigPendingCases, label: 'حالات RIG معلّقة', go: 'bites' as const },
          { icon: '⏰', value: dashboardMetrics.overdueVaccinations, label: 'جرعات متأخرة', go: 'bites' as const },
          { icon: '💰', value: dashboardMetrics.stockValue.toLocaleString('ar-MA'), label: 'قيمة المخزون · درهم', go: 'products' as const },
        ] : [
          { icon: '📦', value: products.length, label: 'منتج بيوسيد', go: 'products' as const },
          { icon: '⚠️', value: stats.lowStock, label: 'مخزون منخفض', go: 'products' as const },
          { icon: '📅', value: stats.expiring, label: 'تنتهي خلال 90 يوم', go: 'products' as const },
          { icon: '🐕', value: stats.openBites, label: 'حالة عضة مفتوحة', go: 'bites' as const },
        ]).map((card, index) => (
          <motion.button key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} onClick={() => onNavigate(card.go)} className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md transition">
            <div className="flex items-center justify-between"><span className="text-2xl">{card.icon}</span><span className="text-2xl font-black text-slate-800">{card.value}</span></div><p className="text-xs text-slate-500 mt-1">{card.label}</p>
          </motion.button>
        ))}
      </div>

      {totalStockValue > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-700">💰 القيمة الإجمالية للمخزون</span>
          <span className="text-xl font-black text-emerald-600">{totalStockValue.toLocaleString('ar-MA')} درهم</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🧪 المنتجات حسب الفئة</h3>
          <div className="space-y-1.5">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <div key={c} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0">{PEST_PRODUCT_CATEGORY_ICONS[c]} {PEST_PRODUCT_CATEGORY_LABELS[c]}</span><div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden"><div className="h-full bg-lime-500 rounded-md" style={{ width: `${Math.max(5, (n / products.length) * 100)}%` }} /></div><span className="font-bold w-6 text-left">{n}</span></div>
            ))}
          </div>
        </div>
        {Object.keys(bitesByAnimal).length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 p-4">
            <h3 className="text-sm font-bold text-slate-700 mb-3">🐕 حالات العضة حسب الحيوان</h3>
            <div className="space-y-1.5">
              {Object.entries(bitesByAnimal).map(([a, n]) => (
                <div key={a} className="flex items-center gap-2 text-xs"><span className="w-32 shrink-0">{BITE_ANIMAL_ICONS[a]} {BITE_ANIMAL_LABELS[a]}</span><div className="flex-1 h-4 bg-slate-100 rounded-md overflow-hidden"><div className="h-full bg-orange-500 rounded-md" style={{ width: `${Math.max(5, (n / bites.length) * 100)}%` }} /></div><span className="font-bold w-6 text-left">{n}</span></div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ===== Products Tab =====
function ProductsTab({ products, loading, onRefresh, buildParams, showCreate, setShowCreate, onShowMovements }: any) {
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterLow, setFilterLow] = useState(false)
  const filtered = products.filter((p: PestProduct) => (filterCategory === 'ALL' || p.category === filterCategory) && (!filterLow || p.quantityStock <= p.thresholdAlert) && (!search || p.commercialName.toLowerCase().includes(search.toLowerCase()) || p.reference.toLowerCase().includes(search.toLowerCase()) || p.activeSubstance.toLowerCase().includes(search.toLowerCase()) || p.lotNumber.toLowerCase().includes(search.toLowerCase())))
  if (loading && products.length === 0) return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-lime-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (اسم/مادة/رزمة)..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-300" />
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الفئات</option>
          {Object.entries(PEST_PRODUCT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{PEST_PRODUCT_CATEGORY_ICONS[k]} {v}</option>)}
        </select>
        <button onClick={() => setFilterLow(!filterLow)} className={`px-3 py-2 text-xs font-bold rounded-xl border ${filterLow ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-500'}`}>⚠️ منخفض</button>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-lime-600 text-white hover:bg-lime-700">➕ منتج جديد</button>
      </div>
      {filtered.length === 0 ? <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">🧪</div><p className="text-sm text-slate-500">{products.length === 0 ? 'لا توجد منتجات بعد' : 'لا توجد نتائج'}</p></div> : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((p: PestProduct, i: number) => {
            const isLow = p.quantityStock <= p.thresholdAlert
            const expDays = daysUntil(p.expiryDate)
            const isExpiring = expDays !== null && expDays <= 90
            const isExpired = expDays !== null && expDays < 0
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-white rounded-2xl border border-slate-100 p-4 relative overflow-hidden">
                <div className="absolute right-0 top-0 bottom-0 w-1" style={{ background: isLow ? '#ef4444' : isExpired ? '#7f1d1d' : isExpiring ? '#f59e0b' : '#10b981' }} />
                <div className="flex items-start justify-between pr-1">
                  <div className="min-w-0">
                    <div className="text-sm font-bold truncate">{PEST_PRODUCT_CATEGORY_ICONS[p.category]} {p.commercialName}</div>
                    {p.activeSubstance && <div className="text-xs text-slate-500 line-clamp-1">⚗️ {p.activeSubstance}</div>}
                    <div className="text-[10px] text-slate-400">{p.reference}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className={`text-lg font-black ${isLow ? 'text-red-600' : 'text-slate-800'}`}>{p.quantityStock}</div>
                    <div className="text-[9px] text-slate-400">{PEST_PRODUCT_UNIT_LABELS[p.unit] || p.unit}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] flex-wrap pr-1">
                  {p.lotNumber && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">رزمة: {p.lotNumber}</span>}
                  {p.expiryDate && <span className={`px-1.5 py-0.5 rounded font-bold ${isExpired ? 'bg-red-100 text-red-700' : isExpiring ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>📅 {fmtDate(p.expiryDate)}</span>}
                  {p.target && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">🎯 {p.target}</span>}
                </div>
                <button onClick={() => onShowMovements(p)} className="w-full mt-2 px-3 py-1.5 text-xs font-bold text-lime-700 border border-lime-200 rounded-lg hover:bg-lime-50">📦 الحركات والتعديل</button>
              </motion.div>
            )
          })}
        </div>
      )}
      <div className="text-center"><span className="text-xs text-slate-400">عرض {filtered.length} من أصل {products.length} منتج</span></div>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🧪 منتج بيوسيد جديد" color="from-lime-600 to-green-700">
        <ProductForm buildParams={buildParams} onCreated={() => { setShowCreate(false); onRefresh() }} />
      </Modal>
    </div>
  )
}

// ===== Bites Tab =====
function BitesTab({ bites, loading, onRefresh, buildParams, showCreate, setShowCreate }: any) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterAnimal, setFilterAnimal] = useState('ALL')
  const [selectedCase, setSelectedCase] = useState<BiteCase | null>(null)
  const [animals, setAnimals] = useState<Array<{ id: string; csvrNumber: string; species: string; commune: string }>>([])
  useEffect(() => {
    let active = true
    fetch(`/api/csvr/animals?${buildParams().toString()}`).then((response) => response.ok ? response.json() : { animals: [] }).then((data) => { if (active) setAnimals(data.animals || []) }).catch(() => undefined)
    return () => { active = false }
  }, [buildParams])
  const filtered = bites.filter((b: BiteCase) => (filterStatus === 'ALL' || b.status === filterStatus) && (filterAnimal === 'ALL' || b.animalType === filterAnimal) && (!search || b.reference.toLowerCase().includes(search.toLowerCase()) || b.victimName.toLowerCase().includes(search.toLowerCase()) || b.quartier.toLowerCase().includes(search.toLowerCase())))
  if (loading && bites.length === 0) return <div className="flex items-center justify-center h-48"><div className="w-10 h-10 border-4 border-lime-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="🔍 بحث (مرجع/ضحية/حي)..." value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1 min-w-[140px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-300" />
        <select value={filterAnimal} onChange={(e) => setFilterAnimal(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحيوانات</option>
          {Object.entries(BITE_ANIMAL_LABELS).map(([k, v]) => <option key={k} value={k}>{BITE_ANIMAL_ICONS[k]} {v}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {Object.entries(BITE_CASE_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button onClick={() => setShowCreate(true)} className="mr-auto px-3 py-2 text-xs font-bold rounded-xl bg-lime-600 text-white hover:bg-lime-700">➕ حالة جديدة</button>
      </div>
      {filtered.length === 0 ? <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center"><div className="text-5xl mb-3">🐕</div><p className="text-sm text-slate-500">{bites.length === 0 ? 'لا توجد حالات عضة بعد' : 'لا توجد نتائج'}</p></div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-slate-500 border-b border-slate-100">
              <th className="text-right py-2 px-2">المرجع</th><th className="text-right py-2 px-2">المصاب</th><th className="text-right py-2 px-2">التعريف</th><th className="text-right py-2 px-2">الحيوان</th><th className="text-right py-2 px-2">حالة التسجيل</th><th className="text-right py-2 px-2">حالة الحيوان</th><th className="text-right py-2 px-2">التاريخ</th>
            </tr></thead>
            <tbody>
              {filtered.map((b: BiteCase) => {
                const sc = BITE_CASE_STATUS_COLORS[b.status]
                return (
                  <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 px-2 font-mono text-xs">{b.reference}</td>
                    <td className="py-2 px-2 font-bold">{b.victimName || '—'}{b.victimAge ? ` (${b.victimAge})` : ''}</td>
                    <td className="py-2 px-2 text-[10px] text-slate-500">{b.victimCin ? `بطاقة: ${b.victimCin}` : '—'}<br />{b.victimRegistrationNumber ? `تسجيل: ${b.victimRegistrationNumber}` : ''}</td>
                    <td className="py-2 px-2">{BITE_ANIMAL_ICONS[b.animalType]} {BITE_ANIMAL_LABELS[b.animalType]}</td>
                    <td className="py-2 px-2"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: sc + '15', color: sc }}>{BITE_CASE_STATUS_LABELS[b.status]}</span><br /><button type="button" onClick={() => setSelectedCase(b)} className="mt-1 rounded bg-lime-100 px-2 py-1 text-[10px] font-bold text-lime-700">🩺 التلقيح</button></td>
                    <td className="py-2 px-2 text-xs text-slate-600">{b.animal ? `🔗 ${b.animal.csvrNumber}` : (BITE_ANIMAL_STATUS_LABELS[b.animalStatus] || b.animalStatus)}</td>
                    <td className="py-2 px-2 text-xs">{fmtDate(b.biteDate)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-center"><span className="text-xs text-slate-400">عرض {filtered.length} من أصل {bites.length} حالة</span></div>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="🐕 حالة عضة/سع جديدة" color="from-lime-600 to-green-700">
        <BiteForm buildParams={buildParams} animals={animals} onCreated={() => { setShowCreate(false); onRefresh() }} />
      </Modal>
      {selectedCase && <VaccinationTracker biteCaseId={selectedCase.id} reference={selectedCase.reference} onClose={() => setSelectedCase(null)} />}
    </div>
  )
}

// ===== Movements Panel =====
function MovementsPanel({ product, onClose, buildParams, onMoved }: { product: PestProduct; onClose: () => void; buildParams: any; onMoved: () => void }) {
  const [movements, setMovements] = useState<PestStockMovement[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ type: 'ENTREE', quantity: '', reason: '', interventionRef: '' })
  const [saving, setSaving] = useState(false)

  const loadMovements = useCallback(async () => {
    try {
      const res = await fetch(`/api/pest-products/${product.id}/movements`)
      if (res.ok) { const d = await res.json(); setMovements(d.movements || []) }
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [product.id])

  useEffect(() => { loadMovements() }, [loadMovements])

  const handleMove = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.quantity || parseInt(form.quantity) <= 0) { toast.error('كمية غير صالحة'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/pest-products/${product.id}/movements`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }
      toast.success('تم تسجيل الحركة')
      setForm({ type: 'ENTREE', quantity: '', reason: '', interventionRef: '' })
      loadMovements()
      onMoved()
    } catch { toast.error('حدث خطأ') } finally { setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()} dir="rtl">
        <div className="bg-gradient-to-l from-lime-600 to-green-700 px-5 py-4 text-white flex items-center justify-between sticky top-0 z-10">
          <div><h3 className="text-lg font-bold">📦 حركات: {product.commercialName}</h3><p className="text-xs text-lime-100">المخزون الحالي: {product.quantityStock} {PEST_PRODUCT_UNIT_LABELS[product.unit]}</p></div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg">✕</button>
        </div>
        <div className="p-5 space-y-4">
          {/* نموذج حركة */}
          <form onSubmit={handleMove} className="space-y-2 bg-slate-50 rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 bg-white">
                {Object.entries(PEST_MOVEMENT_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="الكمية" className="px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-300" />
            </div>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="السبب (اختياري)" className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-300" />
            <input value={form.interventionRef} onChange={(e) => setForm({ ...form, interventionRef: e.target.value })} placeholder="مرجع التدخل (اختياري)" className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-300" />
            <button type="submit" disabled={saving} className="w-full px-3 py-1.5 text-xs font-bold text-white bg-lime-600 rounded-lg hover:bg-lime-700 disabled:opacity-50">{saving ? '...' : 'تسجيل الحركة'}</button>
          </form>
          {/* قائمة الحركات */}
          <div>
            <h4 className="text-xs font-bold text-slate-600 mb-2">السجل ({movements.length})</h4>
            {loading ? <p className="text-xs text-slate-400">جارٍ التحميل...</p> : movements.length === 0 ? <p className="text-xs text-slate-400">لا توجد حركات</p> : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {movements.map((m) => {
                  const c = PEST_MOVEMENT_TYPE_COLORS[m.type]
                  return (
                    <div key={m.id} className="flex items-center gap-2 bg-slate-50 rounded-lg p-2 text-xs">
                      <span className="px-1.5 py-0.5 rounded font-bold shrink-0" style={{ backgroundColor: c + '20', color: c }}>{PEST_MOVEMENT_TYPE_LABELS[m.type]}</span>
                      <span className={`font-bold ${m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{m.quantity > 0 ? '+' : ''}{m.quantity}</span>
                      {m.reason && <span className="text-slate-600 truncate flex-1">{m.reason}</span>}
                      <span className="text-slate-400 shrink-0">{fmtDate(m.createdAt)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ===== Shared UI =====
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
const inp = "w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-lime-300"

// ===== Forms =====
function ProductForm({ buildParams, onCreated }: any) {
  const [f, setF] = useState({ commercialName: '', activeSubstance: '', category: 'INSECTICIDE', formulation: '', concentration: '', lotNumber: '', unit: 'LITRE', quantityStock: '', thresholdAlert: '10', expiryDate: '', target: '', supplier: '', unitPrice: '', commune: '', description: '' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.commercialName.trim()) { toast.error('الاسم التجاري مطلوب'); return }
    setSaving(true)
    try {
      const p = buildParams()
      const res = await fetch('/api/pest-products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || accountCommune || p.get('commune') || '', quantityStock: f.quantityStock || '0', unitPrice: f.unitPrice || '0', expiryDate: f.expiryDate || null }) })
      if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }
      toast.success('تم إنشاء المنتج')
      onCreated()
    } catch { toast.error('حدث خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الاسم التجاري *</label><input value={f.commercialName} onChange={(e) => setF({ ...f, commercialName: e.target.value })} className={inp} /></div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">المادة الفعّالة</label><input value={f.activeSubstance} onChange={(e) => setF({ ...f, activeSubstance: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الفئة</label><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inp}>{Object.entries(PEST_PRODUCT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{PEST_PRODUCT_CATEGORY_ICONS[k]} {v}</option>)}</select></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">التركيز</label><input value={f.concentration} onChange={(e) => setF({ ...f, concentration: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">رقم الرزمة</label><input value={f.lotNumber} onChange={(e) => setF({ ...f, lotNumber: e.target.value })} className={inp} /></div>
    </div>
    <div className="grid grid-cols-3 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الكمية</label><input type="number" value={f.quantityStock} onChange={(e) => setF({ ...f, quantityStock: e.target.value })} placeholder="0" className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">عتبة التنبيه</label><input type="number" value={f.thresholdAlert} onChange={(e) => setF({ ...f, thresholdAlert: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الوحدة</label><select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} className={inp}>{Object.entries(PEST_PRODUCT_UNIT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">انتهاء الصلاحية</label><input type="date" value={f.expiryDate} onChange={(e) => setF({ ...f, expiryDate: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">السعر/وحدة</label><input type="number" step="0.01" value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value })} className={inp} /></div>
    </div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الهدف</label><input value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} list="pest-targets" placeholder="rats, mosquitoes..." className={inp} /><datalist id="pest-targets">{PEST_TARGETS.map((t) => <option key={t} value={t} />)}</datalist></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-lime-600 rounded-lg hover:bg-lime-700 disabled:opacity-50">{saving ? '...' : 'إنشاء'}</button>
  </form>
}

function BiteForm({ buildParams, animals, onCreated }: any) {
  const [f, setF] = useState({ victimName: '', victimAge: '', victimGender: 'M', victimPhone: '', victimCin: '', victimRegistrationNumber: '', victimAddress: '', guardianName: '', guardianPhone: '', declarantName: '', declarantPhone: '', medicalFacility: '', medicalReferralDate: '', exposureCategory: 'UNKNOWN', woundWashConfirmed: false, woundWashDate: '', woundCareNotes: '', vaccineType: 'UNKNOWN', vaccineRoute: 'UNKNOWN', pepProtocol: 'PENDING_ASSESSMENT', rigIndicated: false, rigAdministered: false, rigType: '', rigDate: '', vaccinationNotes: '', animalType: 'DOG', animalStatus: 'UNKNOWN', animalDescription: '', animalId: '', biteDate: '', biteLocation: '', commune: '', quartier: '', adresse: '', biteSite: '', description: '', source: 'INTERNAL' })
  const accountCommune = buildParams().get('commune') || ''
  const [saving, setSaving] = useState(false)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!f.victimName.trim() && !f.description.trim()) { toast.error('يرجى تقديم اسم أو وصف'); return }
    setSaving(true)
    try {
      const p = buildParams()
      const res = await fetch('/api/bite-cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, commune: f.commune || accountCommune || p.get('commune') || 'ALL', victimAge: f.victimAge || null, biteDate: f.biteDate || null }) })
      if (!res.ok) { const e2 = await res.json().catch(() => null); toast.error(e2?.error || 'فشل'); return }
      toast.success('تم تسجيل الحالة')
      onCreated()
    } catch { toast.error('حدث خطأ') } finally { setSaving(false) }
  }
  return <form onSubmit={submit} className="space-y-3">
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] text-amber-700">⚠️ هذه متابعة إدارية فقط — لا تشخيص طبي آلي. التلقيح يقرره المختصون.</div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">اسم المصاب</label><input value={f.victimName} onChange={(e) => setF({ ...f, victimName: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">رقم البطاقة الوطنية</label><input value={f.victimCin} onChange={(e) => setF({ ...f, victimCin: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">رقم تسجيل المصاب / الملف</label><input value={f.victimRegistrationNumber} onChange={(e) => setF({ ...f, victimRegistrationNumber: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">العمر</label><input type="number" min="0" value={f.victimAge} onChange={(e) => setF({ ...f, victimAge: e.target.value })} className={inp} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الجنس</label><select value={f.victimGender} onChange={(e) => setF({ ...f, victimGender: e.target.value })} className={inp}><option value="M">ذكر</option><option value="F">أنثى</option></select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الهاتف</label><input value={f.victimPhone} onChange={(e) => setF({ ...f, victimPhone: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">عنوان المصاب</label><input value={f.victimAddress} onChange={(e) => setF({ ...f, victimAddress: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">اسم ولي الأمر عند الحاجة</label><input value={f.guardianName} onChange={(e) => setF({ ...f, guardianName: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">هاتف ولي الأمر</label><input value={f.guardianPhone} onChange={(e) => setF({ ...f, guardianPhone: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">المبلّغ إن كان مختلفاً</label><input value={f.declarantName} onChange={(e) => setF({ ...f, declarantName: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">هاتف المبلّغ</label><input value={f.declarantPhone} onChange={(e) => setF({ ...f, declarantPhone: e.target.value })} className={inp} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">نوع الحيوان</label><select value={f.animalType} onChange={(e) => setF({ ...f, animalType: e.target.value })} className={inp}>{Object.entries(BITE_ANIMAL_LABELS).map(([k, v]) => <option key={k} value={k}>{BITE_ANIMAL_ICONS[k]} {v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">حالة الحيوان</label><select value={f.animalStatus} onChange={(e) => setF({ ...f, animalStatus: e.target.value })} className={inp}>{Object.entries(BITE_ANIMAL_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
    </div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">ربط بحيوان مسجل (اختياري)</label><select value={f.animalId} onChange={(e) => setF({ ...f, animalId: e.target.value })} className={inp}><option value="">— غير معروف / حيوان غير مسجل —</option>{animals.map((animal: { id: string; csvrNumber: string; species: string }) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species}</option>)}</select></div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ العضة</label><input type="date" value={f.biteDate} onChange={(e) => setF({ ...f, biteDate: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">الجماعة</label><input value={f.commune || accountCommune} onChange={(e) => setF({ ...f, commune: e.target.value })} placeholder="كود الجماعة" className={inp} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">مكان العضة</label><input value={f.biteLocation} onChange={(e) => setF({ ...f, biteLocation: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">المرفق الصحي المحال إليه</label><input value={f.medicalFacility} onChange={(e) => setF({ ...f, medicalFacility: e.target.value })} className={inp} /></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">تاريخ الإحالة الصحية</label><input type="date" value={f.medicalReferralDate} onChange={(e) => setF({ ...f, medicalReferralDate: e.target.value })} className={inp} /></div>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <div><label className="text-xs font-bold text-slate-600 block mb-1">تصنيف التعرض وفق WHO</label><select value={f.exposureCategory} onChange={(e) => setF({ ...f, exposureCategory: e.target.value })} className={inp}>{Object.entries(RABIES_EXPOSURE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">نوع اللقاح المستعمل</label><select value={f.vaccineType} onChange={(e) => setF({ ...f, vaccineType: e.target.value })} className={inp}>{Object.entries(RABIES_VACCINE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">طريق الإعطاء</label><select value={f.vaccineRoute} onChange={(e) => setF({ ...f, vaccineRoute: e.target.value })} className={inp}>{Object.entries(RABIES_ROUTE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <div><label className="text-xs font-bold text-slate-600 block mb-1">بروتوكول PEP</label><select value={f.pepProtocol} onChange={(e) => setF({ ...f, pepProtocol: e.target.value })} className={inp}>{Object.entries(RABIES_PROTOCOL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={f.woundWashConfirmed} onChange={(e) => setF({ ...f, woundWashConfirmed: e.target.checked })} /> غسل وتنظيف الجرح</label>
      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={f.rigIndicated} onChange={(e) => setF({ ...f, rigIndicated: e.target.checked })} /> الغلوبولين قيد تقييم المختص</label>
    </div>
    <div><label className="text-xs font-bold text-slate-600 block mb-1">الوصف</label><textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={2} className={inp + ' resize-none'} /></div>
    <button type="submit" disabled={saving} className="w-full px-4 py-2 text-sm font-bold text-white bg-lime-600 rounded-lg hover:bg-lime-700 disabled:opacity-50">{saving ? '...' : 'تسجيل'}</button>
  </form>
}
