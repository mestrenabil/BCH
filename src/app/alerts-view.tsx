'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'

// ===== TYPE DEFINITIONS =====
interface Product {
  id: string
  nom: string
  categorie: string
  commune: string
  unite: string
  quantiteStock: number
  seuilAlerte: number
  prixUnitaire: number
  fournisseur: string
  description: string
  reference: string
  dateExpiration: string | null
  createdAt: string
  updatedAt: string
}

interface InterventionMaterial {
  id: string
  interventionId: string
  productId: string
  quantity: number
  createdAt: string
  product: { id: string; nom: string; unite: string; quantiteStock: number }
}

interface Intervention {
  id: string
  type: string
  date: string
  quartier: string
  adresse: string
  latitude: number
  longitude: number
  statut: string
  description: string
  agentNom: string
  produitUtilise: string
  quantite: string
  superficie: string
  nombrePrestations: number
  observations: string
  reference: string
  commune: string
  createdAt: string
  updatedAt: string
  materials?: InterventionMaterial[]
}

interface Statistics {
  total: number
  byType: Record<string, number>
  byStatut: Record<string, number>
  byQuartier: { quartier: string; count: number }[]
  byCommune: Record<string, { total: number; DERATISATION: number; DESINSECTISATION: number; DESINFECTION: number }>
  monthly: Record<string, Record<string, number>>
  recent: Intervention[]
}

// ===== CONSTANTS =====
const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
}
const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة',
  EN_COURS: 'جارية',
  TERMINEE: 'منجزة',
  ANNULEE: 'ملغاة',
}
const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444',
  DESINSECTISATION: '#f59e0b',
  DESINFECTION: '#10b981',
}
const COMMUNE_LABELS: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
}
const COMMUNE_COLORS: Record<string, string> = {
  'سلا': '#059669',
  'سيدي أبي القنادل': '#7c3aed',
  'عامر': '#d97706',
}

// ===== ANIMATION VARIANTS =====
const containerVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { staggerChildren: 0.06 } },
}

const itemVariants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

const cardHover = {
  hover: { scale: 1.01, transition: { duration: 0.15 } },
}

// ===== HELPER FUNCTIONS =====
function isToday(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isPast(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return dateOnly < now
}

function isWithinNext7Days(dateStr: string): boolean {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const future = new Date(now)
  future.setDate(future.getDate() + 7)
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return dateOnly >= now && dateOnly <= future
}

function daysOverdue(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((now.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))
}

function daysUntil(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const dateOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.floor((dateOnly.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

function formatDateAr(dateStr: string): string {
  const d = new Date(dateStr)
  const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

function formatRelativeTime(dateStr: string): string {
  const d = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'الآن'
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`
  if (diffHours < 24) return `منذ ${diffHours} ساعة`
  if (diffDays < 7) return `منذ ${diffDays} يوم`
  return formatDateAr(dateStr)
}

// ===== MAIN COMPONENT =====
export default function AlertsView() {
  const { selectedCommune, setCurrentView } = useAppStore()

  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [stats, setStats] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  // Commune param for API calls
  const communeParam = selectedCommune !== 'ALL' ? selectedCommune : ''

  // Refresh handler for the button
  const handleRefresh = useCallback(() => {
    setIsLoading(true)
    setRefreshKey(k => k + 1)
  }, [])

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [productsRes, allProductsRes, interventionsRes, statsRes] = await Promise.all([
          fetch(`/api/products?${communeParam ? `commune=${communeParam}&` : ''}alerte=true`),
          fetch(`/api/products?${communeParam ? `commune=${communeParam}` : ''}`),
          fetch(`/api/interventions?${communeParam ? `commune=${communeParam}&` : ''}limit=100`),
          fetch(`/api/statistics?${communeParam ? `commune=${communeParam}` : ''}`),
        ])

        if (productsRes.ok) {
          const productsData = await productsRes.json()
          const alertProducts = (productsData.products || productsData || []).filter(
            (p: Product) => p.quantiteStock <= p.seuilAlerte
          )
          if (!cancelled) setProducts(alertProducts)
        }
        if (allProductsRes.ok) {
          const allProductsData = await allProductsRes.json()
          if (!cancelled) setAllProducts(allProductsData.products || [])
        }
        if (interventionsRes.ok) {
          const interventionsData = await interventionsRes.json()
          if (!cancelled) setInterventions(interventionsData.interventions || [])
        }
        if (statsRes.ok) {
          const statsData = await statsRes.json()
          if (!cancelled) setStats(statsData)
        }
      } catch (error) {
        console.error('Failed to fetch alerts data:', error)
        if (!cancelled) toast.error('حدث خطأ أثناء تحميل بيانات التنبيهات')
      }
      if (!cancelled) setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [communeParam, refreshKey])

  // ===== COMPUTED VALUES =====

  // Stock alerts: products below seuilAlerte
  const stockAlerts = products.filter(p => p.quantiteStock <= p.seuilAlerte)
  const criticalStock = stockAlerts.filter(p => p.quantiteStock === 0)
  const warningStock = stockAlerts.filter(p => p.quantiteStock > 0 && p.quantiteStock <= p.seuilAlerte)

  // Expired products alerts
  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const expiredProducts = allProducts.filter(p => {
    if (!p.dateExpiration) return false
    return new Date(p.dateExpiration) < now
  })
  const expiringProducts = allProducts.filter(p => {
    if (!p.dateExpiration) return false
    const expDate = new Date(p.dateExpiration)
    return expDate >= now && expDate <= thirtyDaysFromNow
  })

  // Overdue interventions: PLANIFIEE/EN_COURS with date in the past
  const overdueInterventions = interventions.filter(
    i => (i.statut === 'PLANIFIEE' || i.statut === 'EN_COURS') && isPast(i.date)
  )

  // Completed today
  const completedToday = interventions.filter(i => i.statut === 'TERMINEE' && isToday(i.date))

  // Upcoming planned: PLANIFIEE within next 7 days
  const upcomingInterventions = interventions
    .filter(i => i.statut === 'PLANIFIEE' && isWithinNext7Days(i.date))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Recent activity: last 10 interventions sorted by updatedAt
  const recentActivity = [...interventions]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10)

  // Progress tracker
  const planifieeCount = stats?.byStatut?.PLANIFIEE || 0
  const enCoursCount = stats?.byStatut?.EN_COURS || 0
  const termineeCount = stats?.byStatut?.TERMINEE || 0
  const totalForProgress = planifieeCount + enCoursCount + termineeCount
  const completionPercent = totalForProgress > 0 ? Math.round((termineeCount / totalForProgress) * 100) : 0

  // ===== RENDER =====
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 font-medium">جاري تحميل التنبيهات...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            🔔 التنبيهات والتتبع
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">متابعة المخزون والتدخلات في الوقت الحقيقي</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleRefresh}
          className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors"
          title="تحديث البيانات"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
          </svg>
        </motion.button>
      </motion.div>

      {/* ===== ALERT SUMMARY CARDS ===== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Stock Alerts */}
        <motion.div variants={itemVariants} initial="initial" animate="animate" whileHover="hover" {...cardHover}
          className="bg-white rounded-2xl p-5 shadow-sm border border-red-100 border-r-4 border-r-red-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center text-xl">🔴</div>
            <span className="text-3xl font-extrabold text-red-600">{stockAlerts.length}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-700">تنبيهات المخزون</h3>
          <p className="text-xs text-slate-400 mt-1">
            {criticalStock.length} نفاد · {warningStock.length} انخفاض
          </p>
        </motion.div>

        {/* Expired Products */}
        <motion.div variants={itemVariants} initial="initial" animate="animate" whileHover="hover" {...cardHover}
          className="bg-white rounded-2xl p-5 shadow-sm border border-rose-100 border-r-4 border-r-rose-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-rose-50 flex items-center justify-center text-xl">💊</div>
            <span className="text-3xl font-extrabold text-rose-600">{expiredProducts.length}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-700">منتجات منتهية الصلاحية</h3>
          <p className="text-xs text-slate-400 mt-1">
            {expiringProducts.length} قريب الانتهاء
          </p>
        </motion.div>

        {/* Overdue Interventions */}
        <motion.div variants={itemVariants} initial="initial" animate="animate" whileHover="hover" {...cardHover}
          className="bg-white rounded-2xl p-5 shadow-sm border border-amber-100 border-r-4 border-r-amber-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-xl">🟡</div>
            <span className="text-3xl font-extrabold text-amber-600">{overdueInterventions.length}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-700">تدخلات متأخرة</h3>
          <p className="text-xs text-slate-400 mt-1">
            لم تُنجز بعد الموعد المحدد
          </p>
        </motion.div>

        {/* Completed Today */}
        <motion.div variants={itemVariants} initial="initial" animate="animate" whileHover="hover" {...cardHover}
          className="bg-white rounded-2xl p-5 shadow-sm border border-green-100 border-r-4 border-r-green-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-xl">🟢</div>
            <span className="text-3xl font-extrabold text-green-600">{completedToday.length}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-700">تدخلات مكتملة اليوم</h3>
          <p className="text-xs text-slate-400 mt-1">
            أُنجزت خلال اليوم الحالي
          </p>
        </motion.div>

        {/* Upcoming Planned */}
        <motion.div variants={itemVariants} initial="initial" animate="animate" whileHover="hover" {...cardHover}
          className="bg-white rounded-2xl p-5 shadow-sm border border-blue-100 border-r-4 border-r-blue-500 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl">🔵</div>
            <span className="text-3xl font-extrabold text-blue-600">{upcomingInterventions.length}</span>
          </div>
          <h3 className="text-sm font-bold text-slate-700">تدخلات مبرمجة قريباً</h3>
          <p className="text-xs text-slate-400 mt-1">
            خلال الـ 7 أيام القادمة
          </p>
        </motion.div>
      </div>

      {/* ===== TWO-COLUMN LAYOUT ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ===== STOCK ALERT SECTION ===== */}
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-red-50 to-white">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">📦</span>
              تنبيهات المخزون
              <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{stockAlerts.length}</span>
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {stockAlerts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-sm text-slate-500 font-medium">المخزون في حالة جيدة</p>
                <p className="text-xs text-slate-400 mt-1">لا توجد منتجات تحت عتبة التنبيه</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {stockAlerts.map((product, idx) => {
                  const isCritical = product.quantiteStock === 0
                  const stockPercent = product.seuilAlerte > 0 ? Math.min((product.quantiteStock / product.seuilAlerte) * 100, 100) : 0
                  const progressColor = isCritical ? 'bg-red-500' : stockPercent < 50 ? 'bg-amber-500' : 'bg-yellow-400'
                  const borderColor = isCritical ? 'border-r-red-500' : 'border-r-amber-400'
                  const bgColor = isCritical ? 'bg-red-50/50' : 'bg-amber-50/30'

                  return (
                    <motion.div
                      key={product.id}
                      variants={itemVariants}
                      onClick={() => setCurrentView('inventory')}
                      className={`p-4 border-r-4 ${borderColor} ${bgColor} hover:bg-slate-50/50 transition-colors cursor-pointer`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className="font-bold text-sm text-slate-800 truncate">{product.nom}</span>
                            {isCritical && (
                              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                نفاد!
                              </span>
                            )}
                            {!isCritical && (
                              <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                تحذير
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 mb-2">
                            {product.quantiteStock} / {product.seuilAlerte} {product.unite}
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${stockPercent}%` }}
                              transition={{ duration: 0.6, delay: idx * 0.05 }}
                              className={`h-full rounded-full ${progressColor}`}
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {product.commune && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: COMMUNE_COLORS[product.commune] || '#64748b' }}
                            >
                              {COMMUNE_LABELS[product.commune] || product.commune}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">{product.reference}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* ===== EXPIRED PRODUCTS SECTION ===== */}
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-rose-50 to-white">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">💊</span>
              صلاحية المنتجات
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">{expiredProducts.length + expiringProducts.length}</span>
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {expiredProducts.length === 0 && expiringProducts.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">✅</div>
                <p className="text-sm text-slate-500 font-medium">جميع المنتجات صالحة</p>
                <p className="text-xs text-slate-400 mt-1">لا توجد منتجات منتهية أو قريبة الانتهاء</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {expiredProducts.map((product) => (
                  <motion.div
                    key={`expired-${product.id}`}
                    variants={itemVariants}
                    onClick={() => setCurrentView('inventory')}
                    className="p-4 border-r-4 border-r-red-500 bg-red-50/50 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-sm text-slate-800 truncate">{product.nom}</span>
                          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            ⚠️ منتهي الصلاحية
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          انتهت في: {product.dateExpiration ? new Date(product.dateExpiration).toLocaleDateString('ar-MA') : '—'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {product.commune && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: COMMUNE_COLORS[product.commune] || '#64748b' }}>
                            {COMMUNE_LABELS[product.commune] || product.commune}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{product.reference}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
                {expiringProducts.map((product) => (
                  <motion.div
                    key={`expiring-${product.id}`}
                    variants={itemVariants}
                    onClick={() => setCurrentView('inventory')}
                    className="p-4 border-r-4 border-r-amber-400 bg-amber-50/30 hover:bg-slate-50/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-sm text-slate-800 truncate">{product.nom}</span>
                          <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            ⏰ قريب الانتهاء
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          تنتهي في: {product.dateExpiration ? new Date(product.dateExpiration).toLocaleDateString('ar-MA') : '—'}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {product.commune && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: COMMUNE_COLORS[product.commune] || '#64748b' }}>
                            {COMMUNE_LABELS[product.commune] || product.commune}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{product.reference}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* ===== OVERDUE INTERVENTIONS SECTION ===== */}
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
          <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-amber-50 to-white">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">⏰</span>
              تدخلات متأخرة
              <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{overdueInterventions.length}</span>
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {overdueInterventions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">🎉</div>
                <p className="text-sm text-slate-500 font-medium">لا توجد تدخلات متأخرة</p>
                <p className="text-xs text-slate-400 mt-1">جميع التدخلات في موعدها المحدد</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {overdueInterventions.map((intervention, idx) => {
                  const overdue = daysOverdue(intervention.date)
                  const urgency = overdue > 7 ? 'critical' : overdue > 3 ? 'high' : 'medium'
                  const urgencyColor = urgency === 'critical' ? 'border-r-red-500 bg-red-50/30' : urgency === 'high' ? 'border-r-amber-500 bg-amber-50/30' : 'border-r-yellow-400 bg-yellow-50/30'
                  const urgencyBadge = urgency === 'critical' ? 'bg-red-100 text-red-700' : urgency === 'high' ? 'bg-amber-100 text-amber-700' : 'bg-yellow-100 text-yellow-700'
                  const urgencyLabel = urgency === 'critical' ? 'عاجل' : urgency === 'high' ? 'متأخر' : 'متأخر قليلاً'

                  return (
                    <motion.div
                      key={intervention.id}
                      variants={itemVariants}
                      onClick={() => setCurrentView('interventions')}
                      className={`p-4 border-r-4 ${urgencyColor} hover:bg-slate-50/50 transition-colors cursor-pointer`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: TYPE_COLORS[intervention.type] || '#64748b' }}
                            >
                              {TYPE_LABELS[intervention.type] || intervention.type}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${urgencyBadge}`}>
                              {urgencyLabel}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-800 mb-1">{intervention.quartier}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              👤 {intervention.agentNom}
                            </span>
                            <span className="flex items-center gap-1">
                              📅 {formatDateAr(intervention.date)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <div className="text-center">
                            <div className={`text-lg font-extrabold ${urgency === 'critical' ? 'text-red-600' : urgency === 'high' ? 'text-amber-600' : 'text-yellow-600'}`}>
                              {overdue}
                            </div>
                            <div className="text-[10px] text-slate-400">يوم تأخير</div>
                          </div>
                          {intervention.commune && (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: COMMUNE_COLORS[intervention.commune] || '#64748b' }}
                            >
                              {COMMUNE_LABELS[intervention.commune] || intervention.commune}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">{STATUT_LABELS[intervention.statut]}</span>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

      {/* ===== UPCOMING INTERVENTIONS SECTION ===== */}
      <motion.div
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-blue-50 to-white">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <span className="text-lg">📅</span>
            تدخلات مبرمجة قريباً
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">{upcomingInterventions.length}</span>
          </h3>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {upcomingInterventions.length === 0 ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-slate-500 font-medium">لا توجد تدخلات مبرمجة قريباً</p>
              <p className="text-xs text-slate-400 mt-1">لا تدخلات مبرمجة خلال الـ 7 أيام القادمة</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingInterventions.map((intervention, idx) => {
                const days = daysUntil(intervention.date)
                const daysLabel = days === 0 ? 'اليوم' : days === 1 ? 'غداً' : `بعد ${days} أيام`

                return (
                  <motion.div
                    key={intervention.id}
                    variants={itemVariants}
                    className="p-4 border-r-4 border-r-blue-400 bg-blue-50/20 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {/* Date badge */}
                        <div className="w-14 h-14 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                          <div className="text-lg font-extrabold text-blue-600 leading-none">
                            {new Date(intervention.date).getDate()}
                          </div>
                          <div className="text-[9px] text-blue-400 font-bold">
                            {['يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو', 'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'][new Date(intervention.date).getMonth()]}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: TYPE_COLORS[intervention.type] || '#64748b' }}
                            >
                              {TYPE_LABELS[intervention.type] || intervention.type}
                            </span>
                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                              {daysLabel}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-800">{intervention.quartier}</div>
                          <div className="text-xs text-slate-500">👤 {intervention.agentNom}</div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {intervention.commune && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: COMMUNE_COLORS[intervention.commune] || '#64748b' }}
                          >
                            {COMMUNE_LABELS[intervention.commune] || intervention.commune}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400">{intervention.reference}</span>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* ===== BOTTOM TWO-COLUMN: PROGRESS TRACKER & RECENT ACTIVITY ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ===== INTERVENTION PROGRESS TRACKER ===== */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-emerald-50 to-white">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">📊</span>
              تتبع سير التدخلات
            </h3>
          </div>
          <div className="p-5">
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700">نسبة الإنجاز</span>
                <span className="text-lg font-extrabold text-emerald-600">{completionPercent}%</span>
              </div>
              <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex">
                {totalForProgress > 0 && (
                  <>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(termineeCount / totalForProgress) * 100}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full bg-emerald-500"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(enCoursCount / totalForProgress) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.2 }}
                      className="h-full bg-amber-400"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(planifieeCount / totalForProgress) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                      className="h-full bg-blue-400"
                    />
                  </>
                )}
              </div>
            </div>

            {/* Status Steps */}
            <div className="space-y-4">
              {/* PLANIFIEE */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border-2 border-blue-200 flex items-center justify-center text-lg shrink-0">
                  📋
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700">مبرمجة</span>
                    <span className="text-sm font-extrabold text-blue-600">{planifieeCount}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalForProgress > 0 ? (planifieeCount / totalForProgress) * 100 : 0}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full bg-blue-400 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>

              {/* EN_COURS */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-lg shrink-0">
                  ⚡
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700">جارية</span>
                    <span className="text-sm font-extrabold text-amber-600">{enCoursCount}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalForProgress > 0 ? (enCoursCount / totalForProgress) * 100 : 0}%` }}
                      transition={{ duration: 0.6, delay: 0.15 }}
                      className="h-full bg-amber-400 rounded-full"
                    />
                  </div>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 rotate-90" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>

              {/* TERMINEE */}
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-lg shrink-0">
                  ✅
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-700">منجزة</span>
                    <span className="text-sm font-extrabold text-emerald-600">{termineeCount}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${totalForProgress > 0 ? (termineeCount / totalForProgress) * 100 : 0}%` }}
                      transition={{ duration: 0.6, delay: 0.3 }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ===== RECENT ACTIVITY FEED ===== */}
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
        >
          <div className="p-5 border-b border-slate-100 bg-gradient-to-l from-teal-50 to-white">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span className="text-lg">🕐</span>
              النشاط الأخير
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {recentActivity.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">📭</div>
                <p className="text-sm text-slate-500 font-medium">لا يوجد نشاط حالياً</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {recentActivity.map((intervention, idx) => {
                  const created = new Date(intervention.createdAt)
                  const updated = new Date(intervention.updatedAt)
                  const isUpdated = updated.getTime() - created.getTime() > 60000 // more than 1 minute difference
                  const activityType = isUpdated ? 'تحديث' : 'إنشاء'
                  const activityIcon = isUpdated ? '✏️' : '🆕'

                  return (
                    <motion.div
                      key={intervention.id}
                      variants={itemVariants}
                      className="p-4 hover:bg-slate-50/50 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center text-sm shrink-0 mt-0.5">
                          {activityIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {activityType}
                            </span>
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                              style={{ backgroundColor: TYPE_COLORS[intervention.type] || '#64748b' }}
                            >
                              {TYPE_LABELS[intervention.type] || intervention.type}
                            </span>
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                backgroundColor: intervention.statut === 'TERMINEE' ? '#dcfce7' : intervention.statut === 'EN_COURS' ? '#fef3c7' : intervention.statut === 'PLANIFIEE' ? '#dbeafe' : '#f3f4f6',
                                color: intervention.statut === 'TERMINEE' ? '#15803d' : intervention.statut === 'EN_COURS' ? '#b45309' : intervention.statut === 'PLANIFIEE' ? '#1d4ed8' : '#6b7280',
                              }}
                            >
                              {STATUT_LABELS[intervention.statut]}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-slate-800 truncate">
                            {intervention.quartier} — {intervention.agentNom}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-2">
                            <span>{formatRelativeTime(isUpdated ? intervention.updatedAt : intervention.createdAt)}</span>
                            {intervention.commune && (
                              <span
                                className="px-1.5 py-0 rounded text-white"
                                style={{ backgroundColor: COMMUNE_COLORS[intervention.commune] || '#64748b', fontSize: '9px' }}
                              >
                                {COMMUNE_LABELS[intervention.commune] || intervention.commune}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
