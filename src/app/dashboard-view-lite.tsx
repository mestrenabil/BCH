'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { type ViewType, type CommuneType } from '@/lib/store'
import { useAppStore } from '@/lib/store'
import { appendTerritoryParams, type TerritoryFilter, loadTerritoryCatalog, territoryFilterLabel } from '@/lib/geography'
import {
  type Statistics,
  TYPE_LABELS, STATUT_LABELS, TYPE_COLORS, STATUT_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS, TYPE_ICONS, MONTH_NAMES_AR,
  cardVariants,
} from '@/lib/constants'

// Helper: get Hijri date
function getHijriDate(date: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-nu-latn', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).formatToParts(date)
    const day = parts.find((part) => part.type === 'day')?.value
    const month = parts.find((part) => part.type === 'month')?.value
    const year = parts.find((part) => part.type === 'year')?.value
    return day && month && year ? `${day} ${month} ${year} هـ` : ''
  } catch {
    return ''
  }
}

// Helper: format relative time in Arabic
function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`
  if (diffHour < 24) return `منذ ${diffHour} ساعة`
  if (diffDay < 7) return `منذ ${diffDay} يوم`
  return date.toLocaleDateString('ar-MA')
}

// Weather data interface
interface DashboardOverview {
  year: number
  sections: Record<string, number>
  details: Record<string, Record<string, number>>
  totals: { records: number; activeAgents: number; lowStock: number; expiringStock: number }
  today: { total: number; interventions: number; complaints: number; workOrders: number; inspections: number; fieldOperations: number; activityLog: number }
  statuses: {
    interventions: Record<string, number>
    complaints: Record<string, number>
    workOrders: Record<string, number>
  }
  activityLog: Array<{ id: string; action: string; entityType: string; userName: string; commune: string; createdAt: string }>
}

const SECTION_DETAIL_LABELS: Record<string, Record<string, string>> = {
  map: { total: 'نقاط وبيانات مكانية' },
  interventions: { total: 'الإجمالي', DERATISATION: 'قوارض', DESINSECTISATION: 'حشرات', DESINFECTION: 'تطهير' },
  complaints: { total: 'الإجمالي', EN_ATTENTE: 'في الانتظار', EN_COURS: 'قيد المعالجة', TRAITEE: 'معالجة', REJETEE: 'مرفوضة' },
  workOrders: { total: 'الإجمالي', NOUVEAU: 'جديدة', ASSIGNE: 'مسندة', EN_COURS: 'قيد التنفيذ', TERMINE: 'منجزة' },
  agents: { total: 'الأعوان' },
  inventory: { total: 'الإجمالي', products: 'عام', vectorProducts: 'نواقل', lowStock: 'تنبيهات' },
  documents: { total: 'المستندات' },
  campagnes: { total: 'الحملات' },
  csvr: { reports: 'بلاغات', missions: 'مهام', animals: 'حيوانات' },
  food: { reports: 'بلاغات غذائية' },
  dossiers: { total: 'الملفات' },
  sanitary: { establishments: 'منشآت', inspections: 'تفتيشات', healthCards: 'بطاقات', samples: 'عينات' },
  water: { points: 'نقط', measurements: 'قياسات', pools: 'مسابح', sanitationIncidents: 'حوادث' },
  vector: { products: 'مواد', bites: 'عضات' },
  funeral: { deaths: 'وفيات', burials: 'دفن', cemeteries: 'مقابر', transports: 'نقل', exhumations: 'نبش' },
  environment: { dossiers: 'ملفات', pollution: 'تلوث', waste: 'نفايات', sites: 'مواقع', campaigns: 'حملات' },
  authorizations: { dossiers: 'طلبات', opinions: 'آراء', visits: 'لجان' },
  reports: { interventions: 'تدخلات', complaints: 'شكايات', workOrders: 'أوامر', dossiers: 'ملفات' },
  calendar: { workOrders: 'أوامر', campagnes: 'حملات', interventions: 'تدخلات' },
  operations: { interventions: 'تدخلات', workOrders: 'أوامر' },
  kpi: { interventions: 'تدخلات 3D' },
  alerts: { complaints: 'شكايات', workOrders: 'أوامر', lowStock: 'مخزون' },
  activityLog: { total: 'أنشطة' },
  timeline: { total: 'أحداث' },
  export: { total: 'سجلات' },
  users: { total: 'حسابات' },
  settings: { total: 'إعدادات' },
}

function getSectionDetailItems(key: string, details: Record<string, number>): string[] {
  const labels = SECTION_DETAIL_LABELS[key] || {}
  return Object.entries(details)
    .filter(([, value]) => value > 0)
    .slice(0, 4)
    .map(([detailKey, value]) => `${labels[detailKey] || detailKey}: ${value}`)
}

// Helper: compute trend badge between current and previous values
function getTrendBadge(current: number, previous: number | undefined): { text: string; color: string } | null {
  if (previous === undefined || previous === null) {
    return { text: '🆕 جديد', color: '#7c3aed' }
  }
  if (current === previous) {
    return { text: '— 0%', color: '#64748b' }
  }
  const pct = Math.round(((current - previous) / Math.max(previous, 1)) * 100)
  if (current > previous) {
    return { text: `↑ ${pct}%`, color: '#059669' }
  }
  return { text: `↓ ${Math.abs(pct)}%`, color: '#dc2626' }
}

const OVERVIEW_SECTION_CARDS: Array<{ key: string; view: ViewType; icon: string; title: string; description: string; tone: string; detail?: string }> = [
  { key: 'map', view: 'gis', icon: '🌐', title: 'الخريطة الموحدة', description: 'المعطيات ذات الموقع الجغرافي', tone: 'from-sky-500 to-blue-600' },
  { key: 'interventions', view: 'interventions', icon: '📋', title: 'التدخلات', description: 'عمليات 3D المنجزة والمبرمجة', tone: 'from-emerald-500 to-teal-600' },
  { key: 'complaints', view: 'complaints', icon: '📢', title: 'الشكايات والبلاغات', description: 'الاستقبال والمعالجة والتفاعل', tone: 'from-rose-500 to-pink-600' },
  { key: 'workOrders', view: 'workOrders', icon: '🧭', title: 'أوامر العمل', description: 'الإسناد والتنفيذ الميداني', tone: 'from-cyan-500 to-blue-600' },
  { key: 'agents', view: 'agents', icon: '👥', title: 'الأعوان', description: 'الموارد البشرية النشطة', tone: 'from-amber-500 to-orange-600' },
  { key: 'inventory', view: 'inventory', icon: '📦', title: 'المخزون الموحد', description: 'المخزون العام ومخزون النواقل', tone: 'from-orange-500 to-red-600', detail: 'lowStock' },
  { key: 'campagnes', view: 'campagnes', icon: '🎪', title: 'الحملات', description: 'البرامج والنتائج الميدانية', tone: 'from-fuchsia-500 to-purple-600' },
  { key: 'csvr', view: 'csvr', icon: '🐕', title: 'الحيوانات الشاردة', description: 'البلاغات والمهام والحيوانات', tone: 'from-cyan-500 to-teal-600' },
  { key: 'food', view: 'food', icon: '🍽️', title: 'السلامة الغذائية', description: 'بلاغات ومراقبة الأغذية', tone: 'from-orange-500 to-amber-600' },
  { key: 'sanitary', view: 'sanitary', icon: '🧪', title: 'المراقبة الصحية', description: 'المؤسسات والتفتيش والبطائق', tone: 'from-lime-500 to-green-600' },
  { key: 'water', view: 'water', icon: '💧', title: 'الماء والتطهير', description: 'النقط والقياسات والمسابح', tone: 'from-blue-500 to-indigo-600' },
  { key: 'vector', view: 'vector', icon: '🦟', title: 'محاربة النواقل', description: 'العضات والمواد المتخصصة', tone: 'from-fuchsia-500 to-rose-600' },
  { key: 'funeral', view: 'funeral', icon: '⚰️', title: 'الجنائز والمقابر', description: 'الوفيات والدفن والنقل', tone: 'from-slate-600 to-slate-800' },
  { key: 'environment', view: 'environment', icon: '🌿', title: 'البيئة', description: 'التلوث والنفايات والمواقع', tone: 'from-green-500 to-emerald-700' },
  { key: 'authorizations', view: 'authorizations', icon: '⚖️', title: 'التراخيص والآراء', description: 'الملفات الصحية واللجان', tone: 'from-indigo-500 to-violet-700' },
  { key: 'dossiers', view: 'dossiers', icon: '🗂️', title: 'الملفات الموحدة', description: 'حالات الملفات وتتبعها', tone: 'from-violet-500 to-purple-700' },
  { key: 'reports', view: 'reports', icon: '📈', title: 'التقارير والإحصائيات', description: 'تقارير شاملة قابلة للتصدير', tone: 'from-purple-500 to-indigo-700' },
  { key: 'calendar', view: 'calendar', icon: '📅', title: 'التقويم والبرمجة', description: 'المواعيد والمهام القادمة', tone: 'from-blue-500 to-cyan-600' },
  { key: 'operations', view: 'operations', icon: '⏱️', title: 'المتابعة التشغيلية', description: 'الآجال والإنجازات', tone: 'from-teal-500 to-emerald-600' },
  { key: 'kpi', view: 'kpi', icon: '🎯', title: 'مؤشرات الأداء', description: 'القياس والأهداف', tone: 'from-lime-500 to-green-600' },
  { key: 'alerts', view: 'alerts', icon: '⚡', title: 'التنبيهات', description: 'المخاطر والمهام المفتوحة', tone: 'from-yellow-500 to-orange-600' },
  { key: 'activityLog', view: 'activityLog', icon: '📝', title: 'سجل النشاط', description: 'آخر العمليات المسجلة', tone: 'from-slate-500 to-slate-700' },
  { key: 'timeline', view: 'timeline', icon: '📊', title: 'الخط الزمني', description: 'تسلسل الأحداث والنتائج', tone: 'from-stone-500 to-slate-700' },
  { key: 'export', view: 'export', icon: '📤', title: 'التصدير', description: 'نسخ ومشاركة البيانات', tone: 'from-purple-500 to-fuchsia-600' },
  { key: 'users', view: 'users', icon: '👤', title: 'المستخدمون', description: 'الحسابات والصلاحيات', tone: 'from-neutral-500 to-slate-700' },
  { key: 'settings', view: 'settings', icon: '⚙️', title: 'الإعدادات', description: 'تهيئة المنصة', tone: 'from-gray-500 to-slate-700' },
  { key: 'helpCenter', view: 'helpCenter', icon: '❓', title: 'مركز المساعدة', description: 'الدعم والإرشادات', tone: 'from-indigo-500 to-blue-700' },
]

function DashboardView({ stats, onNavigate, selectedCommune, canSeeAllCommunes, onRetry, selectedYear, territoryFilter, useTerritoryFilter }: { stats: Statistics | null; onNavigate: (v: ViewType) => void; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean; onRetry?: () => void; selectedYear?: string; territoryFilter: TerritoryFilter; useTerritoryFilter: boolean }) {
  // Previous year stats for trend comparison
  const [prevStats, setPrevStats] = useState<Pick<Statistics, 'total' | 'byType'> | null>(null)
  // Weather state
  const { setSelectedType, user } = useAppStore()
  const isCommuneScopedAccount = Boolean(user?.commune && user.commune !== 'ALL')
  const managedCommunes = user?.managedCommunes?.length
    ? Array.from(new Set(user.managedCommunes))
    : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])
  const isCommuneGroupAccount = managedCommunes.length > 1
  // Territory catalog — used to display the scope label in the commune distribution card
  const [territoryCatalog, setTerritoryCatalog] = useState<{ regions: unknown[]; provinces: unknown[]; communes: unknown[] } | null>(null)
  const territoryScopeLabel = useTerritoryFilter
    ? territoryFilterLabel(territoryFilter, territoryCatalog as never)
    : null
  const hasTerritoryScope = Boolean(territoryScopeLabel)
  const distributionCommuneKeys = managedCommunes.length
    ? managedCommunes
    : Object.keys(stats?.byCommune || {})
  const distributionTotal = distributionCommuneKeys.reduce(
    (total, commune) => total + (stats?.byCommune?.[commune]?.total || 0),
    0,
  )
  const shouldShowCommuneDistribution = Boolean(stats?.byCommune) && (
    managedCommunes.length > 0 || (canSeeAllCommunes && selectedCommune === 'ALL') ||
    // General manager with territory scope active — show even before catalog loads
    (useTerritoryFilter && canSeeAllCommunes)
  )
  const distributionTitle = isCommuneGroupAccount
    ? `التوزيع داخل ${user?.communeGroupName || 'مجموعة الجماعات'}`
    : hasTerritoryScope
      ? `التوزيع حسب الجماعة — ${territoryScopeLabel}`
      : 'التوزيع حسب الجماعة'
  const distributionDescription = isCommuneGroupAccount
    ? 'تفصيل مشترك للتدخلات في جماعات الحساب'
    : managedCommunes.length === 1
      ? `تفصيل تدخلات ${COMMUNE_LABELS[managedCommunes[0]] || `جماعة ${managedCommunes[0]}`}`
      : hasTerritoryScope
        ? `تفصيل التدخلات لكل جماعة ضمن ${territoryScopeLabel}`
        : 'تفصيل التدخلات لكل جماعة ترابية'
  // Live clock state
  const [currentTime, setCurrentTime] = useState(new Date())
  // Agents for leaderboard
  const [agents, setAgents] = useState<{ id: string; nom: string; prenom: string; commune: string; fonction: string; actif: boolean }[]>([])
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [overviewLoading, setOverviewLoading] = useState(true)

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Fetch agents for leaderboard
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const params = new URLSearchParams()
        if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
        const res = await fetch(`/api/agents?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setAgents(data.agents || data || [])
        }
      } catch { /* ignore */ }
    }
    fetchAgents()
  }, [selectedCommune, territoryFilter, useTerritoryFilter])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams()
    if (selectedYear) params.set('year', selectedYear)
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    const loadingTimer = window.setTimeout(() => setOverviewLoading(true), 0)
    fetch(`/api/dashboard/overview?${params.toString()}`, { signal: controller.signal, cache: 'no-store' })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.sections && data?.totals) setOverview(data as DashboardOverview)
        else setOverview(null)
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') setOverview(null)
      })
      .finally(() => setOverviewLoading(false))
    return () => { controller.abort(); window.clearTimeout(loadingTimer) }
  }, [selectedYear, selectedCommune, territoryFilter, useTerritoryFilter])

  // Load territory catalog (for scope label in the commune distribution card)
  useEffect(() => {
    if (!useTerritoryFilter) return
    let active = true
    loadTerritoryCatalog().then((cat) => { if (active && cat) setTerritoryCatalog(cat as never) })
    return () => { active = false }
  }, [useTerritoryFilter])

  useEffect(() => {
    if (!selectedYear) return
    const year = parseInt(selectedYear)
    if (isNaN(year) || year <= 2020) return
    const prevYear = year - 1
    const params = new URLSearchParams()
    params.set('year', prevYear.toString())
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    fetch(`/api/statistics?${params.toString()}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && typeof data.total === 'number') {
          setPrevStats({ total: data.total, byType: data.byType })
        } else {
          setPrevStats(null)
        }
      })
      .catch(() => setPrevStats(null))
  }, [selectedYear, selectedCommune, territoryFilter, useTerritoryFilter])

  // Clear previous stats when year is not selected
  const effectivePrevStats = selectedYear ? prevStats : null

  // Error state: stats failed to load
  if (!stats && onRetry) {
    return (
      <div className="flex items-center justify-center min-h-[400px]" dir="rtl">
        <div className="text-center space-y-4 max-w-md mx-auto px-4">
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-4xl mx-auto">
            ⚠️
          </div>
          <h3 className="text-xl font-bold text-slate-800">حدث خطأ في تحميل البيانات</h3>
          <p className="text-slate-500 text-sm">لم نتمكن من تحميل بيانات لوحة القيادة. يرجى التحقق من اتصالك والمحاولة مرة أخرى.</p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onRetry}
            className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 inline-flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            إعادة المحاولة
          </motion.button>
        </div>
      </div>
    )
  }

  // Loading skeleton state
  if (!stats) {
    return (
      <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
        {/* Title skeleton */}
        <div className="space-y-2">
          <div className="h-8 w-48 bg-slate-200 rounded-lg animate-pulse" />
          <div className="h-4 w-72 bg-slate-100 rounded-lg animate-pulse" />
        </div>
        {/* KPI Cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-slate-100 rounded-2xl p-5 animate-pulse">
              <div className="h-8 w-8 bg-slate-200 rounded-lg mb-3" />
              <div className="h-8 w-16 bg-slate-200 rounded-lg mb-2" />
              <div className="h-4 w-24 bg-slate-200 rounded-lg" />
            </div>
          ))}
        </div>
        {/* Commune breakdown skeleton */}
        <div className="bg-slate-50 rounded-2xl p-6 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded-lg mb-4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl p-4 border border-slate-100">
                <div className="h-4 w-20 bg-slate-200 rounded-lg mb-2" />
                <div className="h-6 w-12 bg-slate-200 rounded-lg mb-3" />
                <div className="h-2 w-full bg-slate-200 rounded-full" />
              </div>
            ))}
          </div>
        </div>
        {/* Main grid skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-slate-50 rounded-2xl p-6 animate-pulse">
              <div className="h-5 w-32 bg-slate-200 rounded-lg mb-2" />
              <div className="h-3 w-48 bg-slate-100 rounded-lg mb-4" />
              <div className="h-36 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
        {/* Chart skeleton */}
        <div className="bg-slate-50 rounded-2xl p-6 animate-pulse">
          <div className="h-5 w-40 bg-slate-200 rounded-lg mb-2" />
          <div className="h-3 w-56 bg-slate-100 rounded-lg mb-4" />
          <div className="h-72 bg-slate-100 rounded-xl" />
        </div>
      </div>
    )
  }
  const safeByStatut = stats.byStatut ?? {}
  const safeByType = stats.byType ?? {}
  const safeByQuartier = Array.isArray(stats.byQuartier) ? stats.byQuartier : []
  const safeMonthly = stats.monthly ?? {}
  const safeRecent = Array.isArray(stats.recent) ? stats.recent : []
  const safeActivityLog = Array.isArray(overview?.activityLog) ? overview.activityLog : []
  const safeByCommune = stats.byCommune ?? {}
  const safeByCommuneStatus = stats.byCommuneStatus ?? {}

  const completionRate = stats.total > 0 ? Math.round(((safeByStatut.TERMINEE || 0) / stats.total) * 100) : 0
  const inProgressRate = stats.total > 0 ? Math.round(((safeByStatut.EN_COURS || 0) / stats.total) * 100) : 0

  // Prepare chart data
  const monthlyChartData = Object.entries(safeMonthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({
    name: MONTH_NAMES_AR[parseInt(month.split('-')[1]) - 1],
    'مكافحة القوارض': data.DERATISATION || 0,
    'مكافحة الحشرات': data.DESINSECTISATION || 0,
    'التطهير والتعقيم': data.DESINFECTION || 0,
  }))

  const statusPieData = Object.entries(safeByStatut).map(([key, value]) => ({
    name: STATUT_LABELS[key], value, color: STATUT_COLORS[key],
  }))

  const radarData = safeByQuartier.slice(0, 6).map(q => ({
    quartier: q.quartier.replace('حي ', ''),
    تدخلات: q.count,
  }))

  // KPI cards with trend data
  const threeDKpiCards = [
    { title: 'إجمالي التدخلات', value: stats.total, prevValue: effectivePrevStats?.total, icon: '📋', gradient: 'from-slate-700 to-slate-900', shadow: 'shadow-slate-300', type: 'ALL' as const },
    { title: 'مكافحة القوارض', value: safeByType.DERATISATION || 0, prevValue: effectivePrevStats?.byType?.DERATISATION, icon: '🐀', gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-200', type: 'DERATISATION' as const },
    { title: 'مكافحة الحشرات', value: safeByType.DESINSECTISATION || 0, prevValue: effectivePrevStats?.byType?.DESINSECTISATION, icon: '🦟', gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-200', type: 'DESINSECTISATION' as const },
    { title: 'التطهير والتعقيم', value: safeByType.DESINFECTION || 0, prevValue: effectivePrevStats?.byType?.DESINFECTION, icon: '🧴', gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200', type: 'DESINFECTION' as const },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">لوحة القيادة</h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedCommune === 'ALL'
              ? 'نظرة عامة شاملة على جميع أقسام المنصة — حسب الجماعة'
              : `نظرة عامة شاملة على أقسام المنصة — ${COMMUNE_LABELS[selectedCommune]}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedCommune !== 'ALL' && (
            <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] + '18', color: COMMUNE_COLORS[selectedCommune] }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] }} />
              {COMMUNE_LABELS[selectedCommune]}
            </motion.span>
          )}
          <button
            onClick={() => {
              document.body.classList.add('classic-print-active')
              window.print()
              setTimeout(() => {
                document.body.classList.remove('classic-print-active')
              }, 100)
            }}
            className="no-print inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" /></svg>
            طباعة التقرير
          </button>
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-gradient-to-l from-emerald-600 via-teal-600 to-cyan-600 rounded-2xl p-5 shadow-lg shadow-emerald-200/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-8 -translate-y-8" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full -translate-x-4 translate-y-4" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-bold text-base flex items-center gap-2"><span>📊</span> ملخص اليوم لجميع الأقسام</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {(() => {
              const today = overview?.today
              return [
                { icon: '📚', label: 'سجلات اليوم', value: today?.total || 0, color: 'bg-white/20', view: 'reports' as ViewType },
                { icon: '🧴', label: 'عمليات 3D اليوم', value: today?.interventions || 0, color: 'bg-white/20', view: 'interventions' as ViewType },
                { icon: '📢', label: 'شكايات اليوم', value: today?.complaints || 0, color: 'bg-white/20', view: 'complaints' as ViewType },
                { icon: '🧭', label: 'عمليات الأقسام اليوم', value: (today?.workOrders || 0) + (today?.inspections || 0) + (today?.fieldOperations || 0), color: 'bg-white/20', view: 'operations' as ViewType },
              ].map((item, idx) => (
                <button key={idx} onClick={() => onNavigate(item.view)} className={`${item.color} rounded-xl p-3 text-center backdrop-blur-sm hover:bg-white/30 transition-colors`}>
                  <span className="text-lg">{item.icon}</span>
                  <div className="text-2xl font-extrabold text-white mt-1">{item.value}</div>
                  <div className="text-[10px] text-white/70 font-medium">{item.label}</div>
                </button>
              ))
            })()}
          </div>
        </div>
      </motion.div>

      {/* Live Clock & Hijri Date */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-gradient-to-l from-slate-800 via-slate-700 to-slate-800 rounded-2xl p-4 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-white/5 rounded-full -translate-x-8 -translate-y-8" />
        <div className="relative z-10 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-2xl">🕐</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-white font-mono tracking-wider">
                {currentTime.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-[11px] text-slate-300">
                {currentTime.toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="text-left">
            <div className="text-[10px] text-emerald-300/70 font-semibold uppercase tracking-wider">التاريخ الهجري</div>
            <div className="text-sm text-emerald-200 font-bold">{getHijriDate(currentTime)}</div>
          </div>
        </div>
      </motion.div>

      {/* مؤشرات المنصة الموحدة */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'إجمالي سجلات المنصة', value: overview?.totals.records || 0, icon: '📚', gradient: 'from-slate-700 to-slate-900', view: 'reports' as ViewType },
          { title: 'الأعوان النشطون', value: overview?.totals.activeAgents || 0, icon: '👥', gradient: 'from-amber-500 to-orange-600', view: 'agents' as ViewType },
          { title: 'تنبيهات تحتاج متابعة', value: overview?.sections.alerts || 0, icon: '⚠️', gradient: 'from-rose-500 to-red-700', view: 'alerts' as ViewType },
          { title: 'أقسام بها بيانات', value: Object.values(overview?.sections || {}).filter((value) => value > 0).length, icon: '🏢', gradient: 'from-emerald-500 to-teal-700', view: 'reports' as ViewType },
        ].map((card, i) => (
            <motion.button key={card.title} onClick={() => onNavigate(card.view)} variants={cardVariants} initial="initial" animate="animate" whileHover="hover"
              transition={{ delay: i * 0.08 }}
              className={`bg-gradient-to-br ${card.gradient} text-white rounded-2xl p-5 shadow-lg relative overflow-hidden text-right cursor-pointer`}>
              <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
              <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-4 translate-y-4" />
              <div className="relative z-10">
                <span className="text-3xl opacity-90">{card.icon}</span>
                <div className="text-3xl lg:text-4xl font-bold mt-3 tracking-tight">{overviewLoading ? '—' : card.value}</div>
                <div className="text-sm opacity-80 mt-1 font-medium">{card.title}</div>
              </div>
            </motion.button>
        ))}
      </div>

      <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
        className="space-y-4" aria-labelledby="dashboard-overview-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="dashboard-overview-title" className="font-bold text-slate-800">📊 ملخص شامل لجميع الأقسام</h3>
            <p className="text-xs text-slate-400">النتائج المسجلة خلال سنة {overview?.year || selectedYear || new Date().getFullYear()} حسب نطاق الحساب الحالي</p>
          </div>
          {overviewLoading && <span className="text-xs text-emerald-600 animate-pulse">جارٍ تحديث المؤشرات…</span>}
          {!overviewLoading && overview && <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{overview.totals.records} سجل موحّد</span>}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'كل السجلات', value: overview?.totals.records || 0, icon: '📚', tone: 'bg-slate-800 text-white' },
            { label: 'الأعوان النشطون', value: overview?.totals.activeAgents || 0, icon: '👥', tone: 'bg-amber-50 text-amber-800' },
            { label: 'تنبيهات المخزون', value: overview?.totals.lowStock || 0, icon: '⚠️', tone: 'bg-red-50 text-red-700' },
            { label: 'مواد تنتهي خلال 30 يوماً', value: overview?.totals.expiringStock || 0, icon: '⏳', tone: 'bg-orange-50 text-orange-700' },
          ].map((item) => (
            <div key={item.label} className={`rounded-2xl p-4 border border-white/70 shadow-sm ${item.tone}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xl">{item.icon}</span>
                <span className="text-2xl font-black">{overviewLoading ? '—' : item.value}</span>
              </div>
              <p className="text-xs font-semibold mt-2 opacity-80">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {OVERVIEW_SECTION_CARDS.map((card) => {
            const total = overview?.sections[card.key] || 0
            const details = overview?.details[card.key] || {}
            const open = card.key === 'complaints'
              ? (overview?.statuses.complaints.EN_ATTENTE || 0) + (overview?.statuses.complaints.EN_COURS || 0)
              : card.key === 'workOrders'
                ? (overview?.statuses.workOrders.NOUVEAU || 0) + (overview?.statuses.workOrders.EN_COURS || 0) + (overview?.statuses.workOrders.ASSIGNE || 0)
                : card.key === 'interventions'
                  ? (overview?.statuses.interventions.TERMINEE || 0)
                  : card.key === 'inventory'
                    ? overview?.totals.lowStock || 0
                    : 0
            const resultLabel = card.key === 'interventions' ? 'منجزة'
              : card.key === 'inventory' ? 'تنبيهات'
                : card.key === 'complaints' || card.key === 'workOrders' ? 'مفتوحة'
                  : 'تفاصيل'
            const detailItems = getSectionDetailItems(card.key, details)
            return (
              <motion.button key={card.key} onClick={() => onNavigate(card.view)} whileHover={{ y: -2 }} whileTap={{ scale: 0.99 }}
                className="bg-white rounded-2xl border border-slate-100 p-4 text-right shadow-sm hover:shadow-md hover:border-emerald-200 transition-all group">
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 shrink-0 rounded-xl bg-gradient-to-br ${card.tone} text-white flex items-center justify-center text-xl shadow-sm`}>{card.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-sm text-slate-800 truncate group-hover:text-emerald-700">{card.title}</h4>
                      <span className="text-2xl font-black text-slate-800">{overviewLoading ? '—' : total}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1 truncate">{card.description}</p>
                    <div className="flex items-center gap-2 mt-3 text-[10px]">
                      <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600">{resultLabel}: <strong>{overviewLoading ? '—' : (card.key === 'interventions' || card.key === 'complaints' || card.key === 'workOrders' || card.key === 'inventory' ? open : detailItems.length)}</strong></span>
                      {detailItems.slice(0, 2).map((item) => <span key={item} className="px-2 py-1 rounded-full bg-teal-50 text-teal-700">{item}</span>)}
                      <span className="text-emerald-600 font-semibold">فتح القسم ←</span>
                    </div>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.section>

      {/* Commune Breakdown - restricted to the account's assigned commune(s) */}
      {shouldShowCommuneDistribution && stats?.byCommune && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-teal-600 to-emerald-600 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">🏛️ {distributionTitle}</h3>
                <p className="text-emerald-100 text-xs mt-0.5">{distributionDescription}</p>
              </div>
              <div className="text-2xl font-extrabold">{distributionTotal}</div>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {distributionCommuneKeys.map((communeKey, i) => {
                const data = safeByCommune?.[communeKey]
                const color = COMMUNE_COLORS[communeKey] || ['#059669', '#7c3aed', '#d97706', '#0ea5e9'][i % 4]
                const label = COMMUNE_LABELS[communeKey] || `جماعة ${communeKey}`
                const total = data?.total || 0
                const pct = distributionTotal > 0 ? Math.round((total / distributionTotal) * 100) : 0
                const derat = data?.DERATISATION || 0
                const desins = data?.DESINSECTISATION || 0
                const desinf = data?.DESINFECTION || 0
                // Status breakdown (planned / in-progress / done / cancelled)
                const communeStatus = safeByCommuneStatus?.[communeKey]
                const sPlanifiee = communeStatus?.byStatut?.PLANIFIEE || 0
                const sEnCours = communeStatus?.byStatut?.EN_COURS || 0
                const sTerminee = communeStatus?.byStatut?.TERMINEE || 0
                const sAnnulee = communeStatus?.byStatut?.ANNULEE || 0

                return (
                  <motion.div key={communeKey} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + i * 0.08 }}
                    className="rounded-xl border-2 overflow-hidden hover:shadow-md transition-shadow"
                    style={{ borderColor: color + '30' }}>
                    {/* Header */}
                    <div className="px-4 py-3 flex items-center justify-between"
                      style={{ backgroundColor: color + '0A' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-sm font-bold" style={{ color }}>{label}</span>
                      </div>
                      <span className="text-lg font-extrabold" style={{ color }}>{total}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="px-4 pt-2">
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <motion.div className="h-full rounded-full"
                          style={{ backgroundColor: color }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: 0.5 }} />
                      </div>
                      <div className="flex justify-between mt-1 mb-2">
                        <span className="text-[10px] text-slate-400">{pct}% من الإجمالي</span>
                      </div>
                    </div>
                    {/* Type breakdown */}
                    <div className="px-4 pb-3 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🐀</span>
                          <span className="text-[11px] text-slate-500">مكافحة القوارض</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700">{derat}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🦟</span>
                          <span className="text-[11px] text-slate-500">مكافحة الحشرات</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700">{desins}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🧴</span>
                          <span className="text-[11px] text-slate-500">التطهير والتعقيم</span>
                        </div>
                        <span className="text-xs font-bold text-slate-700">{desinf}</span>
                      </div>
                    </div>
                    {/* Stacked mini bar */}
                    <div className="px-4 pb-3">
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
                        {total > 0 && (
                          <>
                            <div style={{ width: `${(derat / total) * 100}%`, backgroundColor: TYPE_COLORS.DERATISATION }} />
                            <div style={{ width: `${(desins / total) * 100}%`, backgroundColor: TYPE_COLORS.DESINSECTISATION }} />
                            <div style={{ width: `${(desinf / total) * 100}%`, backgroundColor: TYPE_COLORS.DESINFECTION }} />
                          </>
                        )}
                      </div>
                    </div>
                    {/* Status breakdown pills */}
                    {total > 0 && (sPlanifiee + sEnCours + sTerminee + sAnnulee) > 0 && (
                      <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
                        {sTerminee > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUT_COLORS.TERMINEE }}>
                            ✓ {sTerminee} منجز
                          </span>
                        )}
                        {sEnCours > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUT_COLORS.EN_COURS }}>
                            ⟳ {sEnCours} جار
                          </span>
                        )}
                        {sPlanifiee > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUT_COLORS.PLANIFIEE }}>
                            ◷ {sPlanifiee} مبرمج
                          </span>
                        )}
                        {sAnnulee > 0 && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUT_COLORS.ANNULEE }}>
                            ✕ {sAnnulee} ملغى
                          </span>
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
            {/* Commune comparison chart - only across the account's assigned communes */}
            {distributionCommuneKeys.length > 1 && (
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                    distributionCommuneKeys.map(key => ({
                      name: (COMMUNE_LABELS[key] || key).replace('جماعة ', ''),
                      'مكافحة القوارض': safeByCommune?.[key]?.DERATISATION || 0,
                      'مكافحة الحشرات': safeByCommune?.[key]?.DESINSECTISATION || 0,
                      'التطهير والتعقيم': safeByCommune?.[key]?.DESINFECTION || 0,
                    }))
                  } barGap={3}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="مكافحة القوارض" stackId="a" fill={TYPE_COLORS.DERATISATION} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="مكافحة الحشرات" stackId="a" fill={TYPE_COLORS.DESINSECTISATION} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="التطهير والتعقيم" stackId="a" fill={TYPE_COLORS.DESINFECTION} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Completion Rate */}
        <motion.div variants={cardVariants} initial="initial" animate="animate"
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">نسبة الإنجاز</h3>
          <p className="text-xs text-slate-400 mb-4">معدل إتمام التدخلات</p>
          <div className="flex items-center justify-center">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                <motion.circle cx="50" cy="50" r="42" fill="none" stroke="url(#grad)" strokeWidth="8"
                  strokeLinecap="round" initial={{ strokeDasharray: '0 264' }}
                  animate={{ strokeDasharray: `${completionRate * 2.64} ${264 - completionRate * 2.64}` }}
                  transition={{ duration: 1.5, ease: 'easeOut' }} />
                <defs>
                  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-bold text-emerald-600">{completionRate}%</span>
                <span className="text-[11px] text-slate-400 font-medium">منجزة</span>
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {[
              { label: 'منجزة', val: safeByStatut.TERMINEE || 0, color: 'bg-emerald-500', pct: completionRate },
              { label: 'جارية', val: safeByStatut.EN_COURS || 0, color: 'bg-amber-500', pct: inProgressRate },
              { label: 'مبرمجة', val: safeByStatut.PLANIFIEE || 0, color: 'bg-blue-500', pct: stats.total > 0 ? Math.round(((safeByStatut.PLANIFIEE || 0) / stats.total) * 100) : 0 },
              { label: 'ملغاة', val: safeByStatut.ANNULEE || 0, color: 'bg-slate-300', pct: stats.total > 0 ? Math.round(((safeByStatut.ANNULEE || 0) / stats.total) * 100) : 0 },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${s.color}`} />
                <span className="text-xs text-slate-500 flex-1">{s.label}</span>
                <span className="text-xs font-bold text-slate-700">{s.val}</span>
                <div className="w-16 bg-slate-100 rounded-full h-1.5">
                  <motion.div className={`h-full rounded-full ${s.color}`} initial={{ width: 0 }}
                    animate={{ width: `${s.pct}%` }} transition={{ duration: 1, delay: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Status Pie */}
        <motion.div variants={cardVariants} initial="initial" animate="animate"
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">توزيع الحالات</h3>
          <p className="text-xs text-slate-400 mb-4">حسب حالة التدخلات</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}
                  dataKey="value" stroke="none">
                  {statusPieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} تدخل`, name]}
                  contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {statusPieData.map(s => (
              <div key={s.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600">{s.name}: <strong>{s.value}</strong></span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Recent Interventions */}
        <motion.div variants={cardVariants} initial="initial" animate="animate"
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-slate-800">آخر التدخلات</h3>
              <p className="text-xs text-slate-400">أحدث العمليات المسجلة</p>
            </div>
            <button onClick={() => onNavigate('interventions')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline">عرض الكل →</button>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {safeRecent.slice(0, 8).map((intervention, i) => (
              <motion.div key={intervention.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: TYPE_COLORS[intervention.type] + '15' }}>
                  {TYPE_ICONS[intervention.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-700 truncate group-hover:text-emerald-600 transition-colors">{intervention.quartier}</p>
                  <p className="text-[11px] text-slate-400 font-mono">{intervention.reference}</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full font-bold"
                  style={{ backgroundColor: STATUT_COLORS[intervention.statut] + '15', color: STATUT_COLORS[intervention.statut] }}>
                  {STATUT_LABELS[intervention.statut]}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* مكتب 04 — عمليات 3D */}
      <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
        className="space-y-3" aria-labelledby="three-d-dashboard-title">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h3 id="three-d-dashboard-title" className="font-bold text-slate-800">🧴 مؤشرات عمليات 3D</h3>
            <p className="text-xs text-slate-400">تفصيل خاص بمكافحة القوارض والحشرات والتطهير، ضمن الملخص العام للمنصة</p>
          </div>
          <button onClick={() => onNavigate('interventions')} className="text-xs font-bold text-emerald-600 hover:underline">فتح إدارة التدخلات ←</button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {threeDKpiCards.map((card, i) => {
            const trend = getTrendBadge(card.value, card.prevValue)
            return (
              <motion.button key={card.title} onClick={() => { setSelectedType(card.type); onNavigate('interventions') }} variants={cardVariants} initial="initial" animate="animate" whileHover="hover"
                transition={{ delay: i * 0.06 }} className={`bg-gradient-to-br ${card.gradient} text-white rounded-2xl p-4 ${card.shadow} shadow-md relative overflow-hidden text-right`}>
                <div className="relative z-10">
                  <span className="text-2xl">{card.icon}</span>
                  <div className="text-2xl font-black mt-2">{card.value}</div>
                  <div className="text-xs opacity-80 mt-1">{card.title}</div>
                  {trend && <span className="mt-2 inline-flex rounded-md bg-white px-2 py-0.5 text-[10px] font-bold" style={{ color: trend.color }}>{trend.text}</span>}
                </div>
              </motion.button>
            )
          })}
        </div>
      </motion.section>

      {/* Monthly Chart - Recharts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">التدخلات الشهرية — 3D</h3>
            <p className="text-xs text-slate-400">التوزيع الشهري حسب نوع التدخل في المكتب 04</p>
          </div>
          <div className="flex gap-3">
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <div key={k} className="flex items-center gap-1.5 text-[11px]">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TYPE_COLORS[k] }} />
                <span className="text-slate-500">{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyChartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Bar dataKey="مكافحة القوارض" fill={TYPE_COLORS.DERATISATION} radius={[4, 4, 0, 0]} />
              <Bar dataKey="مكافحة الحشرات" fill={TYPE_COLORS.DESINSECTISATION} radius={[4, 4, 0, 0]} />
              <Bar dataKey="التطهير والتعقيم" fill={TYPE_COLORS.DESINFECTION} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Radar + Quartier Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">رادار الأحياء</h3>
          <p className="text-xs text-slate-400 mb-4">مقارنة التدخلات بين الأحياء</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis dataKey="quartier" tick={{ fontSize: 10, fill: '#64748b' }} />
                <PolarRadiusAxis tick={{ fontSize: 9 }} />
                <Radar name="التدخلات" dataKey="تدخلات" stroke="#10b981" fill="#10b981" fillOpacity={0.2} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
          className="space-y-4">
          {[
            { icon: '🗺️', title: 'الخريطة التفاعلية SIG', desc: 'استكشف مواقع التدخلات على الخريطة الجغرافية', view: 'map' as ViewType, gradient: 'from-blue-500 to-cyan-500' },
            { icon: '📋', title: 'إدارة التدخلات', desc: 'إضافة وتعديل وحذف عمليات 3D', view: 'interventions' as ViewType, gradient: 'from-emerald-500 to-teal-500' },
            { icon: '📈', title: 'التقارير والإحصائيات', desc: 'تحليل مفصل لبيانات التدخلات', view: 'reports' as ViewType, gradient: 'from-purple-500 to-pink-500' },
          ].map((action, i) => (
            <motion.button key={action.view} onClick={() => onNavigate(action.view)}
              whileHover={{ scale: 1.01, x: -4 }} whileTap={{ scale: 0.99 }}
              className="w-full bg-white rounded-2xl border border-slate-100 p-5 text-right shadow-sm hover:shadow-md transition-all group flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${action.gradient} flex items-center justify-center text-2xl shadow-lg`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-slate-800 group-hover:text-emerald-600 transition-colors">{action.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{action.desc}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300 group-hover:text-emerald-500 transition-colors" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </motion.button>
          ))}
        </motion.div>
      </div>

      {/* Agent Performance Leaderboard */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-amber-500 to-orange-500 text-white px-5 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <h3 className="font-bold text-sm">لوحة المتصدرين — الأعوان</h3>
            </div>
            <button onClick={() => onNavigate('agents')} className="text-[10px] text-white/70 font-medium hover:text-white hover:underline">{agents.filter(a => a.actif).length} عون نشط</button>
          </div>
        </div>
        <div className="p-4 max-h-72 overflow-y-auto">
          {agents.filter(a => a.actif).slice(0, 10).map((agent, i) => {
            const agentInterventions = safeRecent.filter(inv => inv.agentNom === `${agent.nom} ${agent.prenom}`.trim() || inv.agentNom === agent.nom)
            const completedCount = agentInterventions.filter(inv => inv.statut === 'TERMINEE').length
            const rank = i + 1
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : ''
            return (
              <div key={agent.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-100 to-amber-200 flex items-center justify-center text-xs font-bold text-amber-700 flex-shrink-0">
                  {medal || rank}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-slate-700 truncate">{agent.nom} {agent.prenom}</div>
                  <div className="text-[10px] text-slate-400">{agent.fonction} • {agent.commune || '—'}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-emerald-600">{completedCount}</div>
                  <div className="text-[9px] text-slate-400">منجز</div>
                </div>
              </div>
            )
          })}
          {agents.filter(a => a.actif).length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">لا توجد بيانات أعوان</div>
          )}
        </div>
      </motion.div>

      {/* Quality Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">🌟 نقاط الجودة</h3>
            <p className="text-xs text-slate-400">تقييم شامل لجودة التدخلات</p>
          </div>
        </div>
        {(() => {
          const completionPct = stats.total > 0 ? ((safeByStatut.TERMINEE || 0) / stats.total) * 100 : 0
          const cancelPct = stats.total > 0 ? ((safeByStatut.ANNULEE || 0) / stats.total) * 100 : 0
          const inProgressPct = stats.total > 0 ? ((safeByStatut.EN_COURS || 0) / stats.total) * 100 : 0
          const qualityScore = Math.min(100, Math.max(0, Math.round(completionPct - cancelPct * 2 + inProgressPct * 0.5)))
          const qualityLevel = qualityScore >= 90 ? { label: 'ممتاز', color: '#10b981', icon: '🌟' } 
            : qualityScore >= 70 ? { label: 'جيد', color: '#3b82f6', icon: '👍' }
            : qualityScore >= 50 ? { label: 'متوسط', color: '#f59e0b', icon: '😐' }
            : { label: 'ضعيف', color: '#ef4444', icon: '⚠️' }
          return (
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <motion.circle cx="50" cy="50" r="42" fill="none" stroke={qualityLevel.color} strokeWidth="8"
                    strokeLinecap="round" initial={{ strokeDasharray: '0 264' }}
                    animate={{ strokeDasharray: `${qualityScore * 2.64} ${264 - qualityScore * 2.64}` }}
                    transition={{ duration: 1.5, ease: 'easeOut' }} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold" style={{ color: qualityLevel.color }}>{qualityScore}</span>
                  <span className="text-[10px] text-slate-400">من 100</span>
                </div>
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{qualityLevel.icon}</span>
                  <span className="font-bold text-lg" style={{ color: qualityLevel.color }}>{qualityLevel.label}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">نسبة الإنجاز</span>
                    <span className="font-bold text-emerald-600">{Math.round(completionPct)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <motion.div className="h-full rounded-full bg-emerald-500" initial={{ width: 0 }} animate={{ width: `${completionPct}%` }} transition={{ duration: 1 }} />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">نسبة الإلغاء</span>
                    <span className="font-bold text-red-500">{Math.round(cancelPct)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <motion.div className="h-full rounded-full bg-red-400" initial={{ width: 0 }} animate={{ width: `${cancelPct}%` }} transition={{ duration: 1 }} />
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </motion.div>

      {/* ===== سجل النشاط الأخير (Recent Activity Timeline) ===== */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" dir="rtl">
        <div className="bg-gradient-to-l from-slate-700 to-slate-800 text-white px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🕐</span>
              <h3 className="font-bold text-sm">سجل النشاط الأخير — جميع الأقسام</h3>
            </div>
            <button onClick={() => onNavigate('activityLog')}
              className="text-[11px] text-slate-300 hover:text-white font-medium hover:underline transition-colors">عرض الكل</button>
          </div>
        </div>
        <div className="p-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute right-[15px] top-2 bottom-2 w-0.5 bg-slate-100" />
            <div className="space-y-0">
              {safeActivityLog.slice(0, 10).map((activity, i) => {
                const entityMeta: Record<string, { label: string; icon: string; color: string }> = {
                  INTERVENTION: { label: 'تدخل 3D', icon: '🧴', color: '#10b981' },
                  COMPLAINT: { label: 'شكاية', icon: '📢', color: '#f43f5e' },
                  WORK_ORDER: { label: 'أمر عمل', icon: '🧭', color: '#0891b2' },
                  ESTABLISHMENT: { label: 'منشأة', icon: '🏪', color: '#65a30d' },
                  INSPECTION: { label: 'تفتيش', icon: '🔎', color: '#16a34a' },
                  ENVIRONMENTAL_DOSSIER: { label: 'ملف بيئي', icon: '🌿', color: '#059669' },
                  FOOD_REPORT: { label: 'بلاغ غذائي', icon: '🍽️', color: '#f97316' },
                  STRAY_REPORT: { label: 'حيوان شارد', icon: '🐕', color: '#06b6d4' },
                }
                const meta = entityMeta[activity.entityType] || { label: activity.entityType || 'نشاط', icon: '📝', color: '#64748b' }
                const actionLabel: Record<string, string> = { CREATE: 'إنشاء', UPDATE: 'تحديث', DELETE: 'حذف', STATUS_CHANGE: 'تغيير الحالة' }
                return (
                  <motion.div key={activity.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-start gap-3 relative pb-3 last:pb-0"
                  >
                      {/* Timeline dot */}
                      <div className="relative z-10 shrink-0 mt-1">
                        <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-sm border-2 border-white shadow-sm"
                        style={{ backgroundColor: meta.color + '18' }}>
                        {meta.icon}
                      </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 bg-slate-50/70 rounded-xl px-3 py-2.5 hover:bg-slate-100/80 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-700 truncate">{meta.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: meta.color + '15', color: meta.color }}>{meta.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold">{actionLabel[activity.action] || activity.action}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-slate-400 font-mono">{activity.entityType || 'سجل'}</span>
                        <span className="text-[10px] text-slate-300">•</span>
                        <span className="text-[11px] text-slate-400">{activity.userName || 'النظام'}{activity.commune ? ` · ${activity.commune}` : ''}</span>
                      </div>
                      <span className="text-[10px] text-slate-300 mt-0.5 block">{formatRelativeTime(activity.createdAt)}</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
          {safeActivityLog.length === 0 && (
            <div className="text-center py-6 text-slate-400 text-sm">لا توجد أنشطة حديثة</div>
          )}
        </div>
      </motion.div>
    </div>
  )
}

export default DashboardView
