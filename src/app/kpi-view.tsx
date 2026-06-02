'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { useAppStore, type CommuneType } from '@/lib/store'

// ===== TYPE DEFINITIONS =====
interface Intervention {
  id: string; type: string; date: string; quartier: string; adresse: string
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
  commune: string; createdAt: string; updatedAt: string
}

interface CommuneBreakdown {
  total: number
  DERATISATION: number
  DESINSECTISATION: number
  DESINFECTION: number
}

interface Statistics {
  total: number; byType: Record<string, number>; byStatut: Record<string, number>
  byQuartier: { quartier: string; count: number }[]
  byCommune: Record<string, CommuneBreakdown>
  monthly: Record<string, Record<string, number>>
  recent: Intervention[]
  quartiers: { id: string; nom: string; latitude: number; longitude: number; commune?: string }[]
}

// ===== CONSTANTS =====
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
const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981',
}
const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم',
}
const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة', EN_COURS: 'جارية', TERMINEE: 'منجزة', ANNULEE: 'ملغاة',
}
const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6', EN_COURS: '#f59e0b', TERMINEE: '#10b981', ANNULEE: '#6b7280',
}
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

// ===== ANIMATED NUMBER COUNTER =====
function AnimatedCounter({ value, duration = 1200, suffix = '', decimals = 0 }: {
  value: number; duration?: number; suffix?: string; decimals?: number
}) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    const startTime = performance.now()

    const animate = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      const current = start + (end - start) * eased
      setDisplay(current)
      if (progress < 1) requestAnimationFrame(animate)
    }
    requestAnimationFrame(animate)
    prevValue.current = value
    return () => { prevValue.current = end }
  }, [value, duration])

  return (
    <span>
      {decimals > 0 ? display.toFixed(decimals) : Math.round(display)}
      {suffix}
    </span>
  )
}

// ===== KPI SCORE CARD =====
function KpiScoreCard({ title, value, suffix, icon, gradient, delay, decimals }: {
  title: string; value: number; suffix?: string; icon: string
  gradient: string; delay: number; decimals?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl p-5 shadow-sm border border-white/30"
      style={{ background: gradient }}
    >
      {/* Decorative circle */}
      <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-full bg-white/5" />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <span className="text-3xl">{icon}</span>
          <span className="text-white/70 text-xs font-bold bg-white/15 px-2.5 py-1 rounded-full backdrop-blur-sm">
            KPI
          </span>
        </div>
        <div className="text-4xl font-extrabold text-white mb-1.5 tracking-tight">
          <AnimatedCounter value={value} suffix={suffix} decimals={decimals ?? 0} />
        </div>
        <div className="text-white/80 text-sm font-semibold">{title}</div>
      </div>
    </motion.div>
  )
}

// ===== STATUS PROGRESS BAR =====
function StatusProgressBar({ statut, count, total, color, delay }: {
  statut: string; count: number; total: number; color: string; delay: number
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-bold text-slate-700">{STATUT_LABELS[statut] || statut}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500">{count}</span>
          <span className="text-xs font-extrabold px-2 py-0.5 rounded-full"
            style={{ backgroundColor: color + '15', color }}>
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: delay + 0.2, duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
    </motion.div>
  )
}

// ===== MAIN KPI VIEW =====
export default function KpiView() {
  const { selectedCommune, selectedYear, user } = useAppStore()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (selectedYear) params.set('year', selectedYear)
        if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
        const res = await fetch(`/api/statistics?${params.toString()}`)
        const data = await res.json()
        if (!cancelled) {
          setStats(data)
          setIsLoading(false)
        }
      } catch (err) {
        console.error('Failed to fetch stats:', err)
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [selectedYear, selectedCommune])

  // ===== Loading State =====
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 font-medium">جاري تحميل المؤشرات...</p>
        </div>
      </div>
    )
  }

  if (!stats) return null

  // ===== KPI Calculations =====
  const total = stats.total || 0
  const completionRate = total > 0 ? Math.round(((stats.byStatut.TERMINEE || 0) / total) * 100) : 0
  const avgMonthly = total > 0 ? +(total / 12).toFixed(1) : 0
  const cancellationRate = total > 0 ? Math.round(((stats.byStatut.ANNULEE || 0) / total) * 100) : 0
  const uniqueQuartiersWithInterventions = (stats.byQuartier || []).filter(q => q.count > 0).length
  const totalQuartiers = (stats.quartiers || []).length
  const coverageRate = totalQuartiers > 0 ? Math.round((uniqueQuartiersWithInterventions / totalQuartiers) * 100) : 0

  // ===== Monthly Area Chart Data =====
  const monthlyChartData = Object.entries(stats.monthly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      name: MONTH_NAMES_AR[parseInt(month.split('-')[1]) - 1],
      'مكافحة القوارض': data.DERATISATION || 0,
      'مكافحة الحشرات': data.DESINSECTISATION || 0,
      'التطهير والتعقيم': data.DESINFECTION || 0,
    }))

  // ===== Type Distribution Pie Data =====
  const typePieData = Object.entries(stats.byType)
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: TYPE_LABELS[key] || key,
      value,
      color: TYPE_COLORS[key] || '#94a3b8',
    }))

  // ===== Radar Data =====
  const radarDimensions = [
    { key: 'DERATISATION', label: 'مكافحة القوارض' },
    { key: 'DESINSECTISATION', label: 'مكافحة الحشرات' },
    { key: 'DESINFECTION', label: 'التطهير' },
    { key: 'completionRate', label: 'نسبة الإنجاز' },
    { key: 'coverageRate', label: 'تغطية الأحياء' },
  ]

  // Compute max values for normalization
  const maxType = Math.max(
    ...Object.values(stats.byCommune || {}).flatMap(c => [c.DERATISATION, c.DESINSECTISATION, c.DESINFECTION]),
    1
  )

  const buildRadarDataForCommune = (communeKey: string) => {
    const cd = stats.byCommune?.[communeKey]
    if (!cd) return null
    const cTotal = cd.total || 1
    const cQuartiers = (stats.quartiers || []).filter(q => q.commune === communeKey)
    const cQuartiersWithInterventions = (stats.byQuartier || []).filter(q =>
      cQuartiers.some(cq => cq.nom === q.quartier) && q.count > 0
    ).length
    const cTotalQuartiers = cQuartiers.length || 1
    return {
      'مكافحة القوارض': Math.round((cd.DERATISATION / maxType) * 100),
      'مكافحة الحشرات': Math.round((cd.DESINSECTISATION / maxType) * 100),
      'التطهير': Math.round((cd.DESINFECTION / maxType) * 100),
      'نسبة الإنجاز': Math.round(((cd.total > 0 ? (stats.byStatut.TERMINEE || 0) : 0) / Math.max(cTotal, 1)) * 100),
      'تغطية الأحياء': Math.round((cQuartiersWithInterventions / cTotalQuartiers) * 100),
    }
  }

  // If specific commune selected, show only that commune; otherwise all
  const activeCommunes = selectedCommune === 'ALL'
    ? Object.keys(COMMUNE_LABELS)
    : [selectedCommune]

  const radarData = radarDimensions.map(dim => {
    const entry: Record<string, string | number> = { dimension: dim.label }
    for (const ck of activeCommunes) {
      const rd = buildRadarDataForCommune(ck)
      if (rd) entry[COMMUNE_LABELS[ck] || ck] = rd[dim.label as keyof typeof rd] || 0
    }
    return entry
  })

  // ===== Commune Comparison Bar Data =====
  const communeComparisonData = selectedCommune === 'ALL'
    ? Object.entries(stats.byCommune || {}).map(([key, cd]) => ({
        name: COMMUNE_LABELS[key] || key,
        'مكافحة القوارض': cd.DERATISATION || 0,
        'مكافحة الحشرات': cd.DESINSECTISATION || 0,
        'التطهير والتعقيم': cd.DESINFECTION || 0,
      }))
    : []

  // ===== Top Quartiers Table =====
  const topQuartiers = (stats.byQuartier || [])
    .slice(0, 5)
    .map(q => ({
      quartier: q.quartier,
      count: q.count,
      types: {
        DERATISATION: 0,
        DESINSECTISATION: 0,
        DESINFECTION: 0,
      }
    }))

  // We don't have per-quartier type breakdown from the API, so show total count + percentage
  const topQuartiersWithPct = topQuartiers.map(q => ({
    ...q,
    pct: total > 0 ? Math.round((q.count / total) * 100) : 0,
  }))

  // ===== Custom Tooltip for RTL =====
  const rtlTooltipStyle = {
    direction: 'rtl' as const,
    borderRadius: '12px',
    border: 'none',
    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
    fontFamily: 'inherit',
  }

  // ===== Render =====
  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center gap-2"
      >
        <div>
          <h2 className="text-2xl font-bold text-slate-800">مؤشرات الأداء الرئيسية</h2>
          <p className="text-slate-400 text-sm mt-1">لوحة متابعة شاملة لمؤشرات التدخل</p>
        </div>
        {selectedCommune !== 'ALL' && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold self-start"
            style={{
              backgroundColor: COMMUNE_COLORS[selectedCommune] + '18',
              color: COMMUNE_COLORS[selectedCommune],
            }}
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] }} />
            {COMMUNE_LABELS[selectedCommune]}
          </motion.span>
        )}
      </motion.div>

      {/* ===== KPI SCORE CARDS ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiScoreCard
          title="نسبة الإنجاز"
          value={completionRate}
          suffix="%"
          icon="✅"
          gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
          delay={0}
        />
        <KpiScoreCard
          title="متوسط التدخلات الشهرية"
          value={avgMonthly}
          icon="📊"
          gradient="linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)"
          delay={0.1}
          decimals={1}
        />
        <KpiScoreCard
          title="معدل الإلغاء"
          value={cancellationRate}
          suffix="%"
          icon="❌"
          gradient="linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"
          delay={0.2}
        />
        <KpiScoreCard
          title="تغطية الأحياء"
          value={coverageRate}
          suffix="%"
          icon="🏘️"
          gradient="linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)"
          delay={0.3}
        />
      </div>

      {/* ===== PERFORMANCE RADAR + STATUS PROGRESS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Radar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <h3 className="font-bold text-slate-800 mb-1">أداء الجماعات</h3>
          <p className="text-xs text-slate-400 mb-4">مقارنة الأداء عبر الأبعاد المختلفة</p>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="#e2e8f0" />
                <PolarAngleAxis
                  dataKey="dimension"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                />
                {activeCommunes.map((ck) => (
                  <Radar
                    key={ck}
                    name={COMMUNE_LABELS[ck] || ck}
                    dataKey={COMMUNE_LABELS[ck] || ck}
                    stroke={COMMUNE_COLORS[ck] || '#94a3b8'}
                    fill={COMMUNE_COLORS[ck] || '#94a3b8'}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
                <Tooltip contentStyle={rtlTooltipStyle} />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={10}
                  formatter={(value: string) => (
                    <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600, marginRight: 4 }}>
                      {value}
                    </span>
                  )}
                  wrapperStyle={{ paddingTop: 8 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Status Progress Bars */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <h3 className="font-bold text-slate-800 mb-1">توزيع حالات التدخل</h3>
          <p className="text-xs text-slate-400 mb-5">تفصيل حالة كل تدخل</p>

          <div className="space-y-5">
            {Object.entries(STATUT_LABELS).map(([key, label], i) => (
              <StatusProgressBar
                key={key}
                statut={key}
                count={stats.byStatut[key] || 0}
                total={total}
                color={STATUT_COLORS[key]}
                delay={0.5 + i * 0.1}
              />
            ))}
          </div>

          {/* Summary Stats */}
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-extrabold text-emerald-600">
                  <AnimatedCounter value={stats.byStatut.TERMINEE || 0} />
                </div>
                <div className="text-[11px] font-semibold text-emerald-600 mt-0.5">تدخل منجز</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 text-center">
                <div className="text-2xl font-extrabold text-amber-600">
                  <AnimatedCounter value={(stats.byStatut.EN_COURS || 0) + (stats.byStatut.PLANIFIEE || 0)} />
                </div>
                <div className="text-[11px] font-semibold text-amber-600 mt-0.5">في الانتظار والتنفيذ</div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ===== MONTHLY TREND AREA CHART ===== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
      >
        <h3 className="font-bold text-slate-800 mb-1">الاتجاه الشهري للتدخلات</h3>
        <p className="text-xs text-slate-400 mb-4">التطور الشهري حسب نوع التدخل</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyChartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <defs>
                <linearGradient id="colorDerat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TYPE_COLORS.DERATISATION} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TYPE_COLORS.DERATISATION} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDesins" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TYPE_COLORS.DESINSECTISATION} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TYPE_COLORS.DESINSECTISATION} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDesinf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TYPE_COLORS.DESINFECTION} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TYPE_COLORS.DESINFECTION} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: '#64748b' }}
                interval={0}
                angle={-30}
                textAnchor="end"
                height={50}
              />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip contentStyle={rtlTooltipStyle} />
              <Legend
                verticalAlign="top"
                iconType="circle"
                iconSize={10}
                formatter={(value: string) => (
                  <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600, marginRight: 4 }}>
                    {value}
                  </span>
                )}
                wrapperStyle={{ paddingBottom: 8 }}
              />
              <Area
                type="monotone"
                dataKey="مكافحة القوارض"
                stackId="1"
                stroke={TYPE_COLORS.DERATISATION}
                fill="url(#colorDerat)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="مكافحة الحشرات"
                stackId="1"
                stroke={TYPE_COLORS.DESINSECTISATION}
                fill="url(#colorDesins)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="التطهير والتعقيم"
                stackId="1"
                stroke={TYPE_COLORS.DESINFECTION}
                fill="url(#colorDesinf)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* ===== TYPE PIE + COMMUNE COMPARISON ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut Pie Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
        >
          <h3 className="font-bold text-slate-800 mb-1">توزيع أنواع التدخلات</h3>
          <p className="text-xs text-slate-400 mb-4">النسبة المئوية لكل نوع</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={typePieData}
                  cx="50%"
                  cy="42%"
                  outerRadius={90}
                  innerRadius={55}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ percent, x, y, cx, cy, midAngle, outerRadius: or }) => {
                    const RADIAN = Math.PI / 180
                    const radius = or + 22
                    const lx = cx + radius * Math.cos(-midAngle * RADIAN)
                    const ly = cy + radius * Math.sin(-midAngle * RADIAN)
                    return (
                      <text
                        x={lx}
                        y={ly}
                        textAnchor={lx > cx ? 'start' : 'end'}
                        dominantBaseline="central"
                        style={{ fontSize: '12px', fontWeight: 700, fill: '#334155', direction: 'rtl' }}
                      >
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    )
                  }}
                  labelLine={false}
                  stroke="none"
                >
                  {typePieData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [`${value} تدخل`, name]}
                  contentStyle={rtlTooltipStyle}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={10}
                  formatter={(value: string) => (
                    <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600, marginRight: 4 }}>
                      {value}
                    </span>
                  )}
                  wrapperStyle={{ paddingTop: 16 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Type Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            {typePieData.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 border"
                style={{ backgroundColor: item.color + '08', borderColor: item.color + '20' }}
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate" style={{ color: item.color }}>{item.name}</div>
                  <div className="text-xs font-extrabold text-slate-700">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Commune Comparison Bar Chart */}
        {selectedCommune === 'ALL' ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
          >
            <h3 className="font-bold text-slate-800 mb-1">مقارنة الجماعات</h3>
            <p className="text-xs text-slate-400 mb-4">توزيع التدخلات حسب الجماعة والنوع</p>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={communeComparisonData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={rtlTooltipStyle} />
                  <Legend
                    verticalAlign="top"
                    iconType="circle"
                    iconSize={10}
                    formatter={(value: string) => (
                      <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600, marginRight: 4 }}>
                        {value}
                      </span>
                    )}
                    wrapperStyle={{ paddingBottom: 8 }}
                  />
                  <Bar dataKey="مكافحة القوارض" fill={TYPE_COLORS.DERATISATION} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="مكافحة الحشرات" fill={TYPE_COLORS.DESINSECTISATION} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="التطهير والتعقيم" fill={TYPE_COLORS.DESINFECTION} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ) : (
          /* Single Commune: Show type breakdown bar */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
          >
            <h3 className="font-bold text-slate-800 mb-1">توزيع التدخلات حسب النوع</h3>
            <p className="text-xs text-slate-400 mb-4">تفصيل {COMMUNE_LABELS[selectedCommune]}</p>
            <div className="space-y-4 mt-6">
              {Object.entries(TYPE_LABELS).map(([key, label], i) => {
                const count = stats.byType[key] || 0
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <motion.div
                    key={key}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[key] }} />
                        <span className="text-sm font-bold text-slate-700">{label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500">{count}</span>
                        <span
                          className="text-xs font-extrabold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[key] + '15', color: TYPE_COLORS[key] }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="h-4 bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.9 + i * 0.1, duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ backgroundColor: TYPE_COLORS[key] }}
                      />
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Commune summary */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(TYPE_LABELS).map(([key, label]) => {
                  const count = stats.byType[key] || 0
                  return (
                    <div key={key} className="rounded-xl p-3 text-center border"
                      style={{ backgroundColor: TYPE_COLORS[key] + '08', borderColor: TYPE_COLORS[key] + '20' }}>
                      <div className="text-xl font-extrabold" style={{ color: TYPE_COLORS[key] }}>
                        <AnimatedCounter value={count} />
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500 mt-0.5">{label}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ===== TOP QUARTIERS TABLE ===== */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8 }}
        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm"
      >
        <h3 className="font-bold text-slate-800 mb-1">أكثر الأحياء نشاطاً</h3>
        <p className="text-xs text-slate-400 mb-4">أعلى 5 أحياء من حيث عدد التدخلات</p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-right text-xs font-bold text-slate-500 pb-3 pr-4">#</th>
                <th className="text-right text-xs font-bold text-slate-500 pb-3 pr-4">الحي</th>
                <th className="text-right text-xs font-bold text-slate-500 pb-3 pr-4">عدد التدخلات</th>
                <th className="text-right text-xs font-bold text-slate-500 pb-3 pr-4">النسبة</th>
                <th className="text-right text-xs font-bold text-slate-500 pb-3">التوزيع</th>
              </tr>
            </thead>
            <tbody>
              {topQuartiersWithPct.map((q, i) => (
                <motion.tr
                  key={q.quartier}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9 + i * 0.05 }}
                  className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-extrabold text-white"
                      style={{
                        backgroundColor: i === 0 ? '#059669' : i === 1 ? '#0891b2' : i === 2 ? '#7c3aed' : '#94a3b8',
                      }}
                    >
                      {i + 1}
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm font-bold text-slate-700">{q.quartier}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-sm font-extrabold text-emerald-600">{q.count}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <span className="text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">
                      {q.pct}%
                    </span>
                  </td>
                  <td className="py-3">
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden w-24">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${q.pct}%` }}
                        transition={{ delay: 1 + i * 0.05, duration: 0.6 }}
                        className="h-full rounded-full bg-emerald-500"
                      />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {topQuartiersWithPct.length === 0 && (
          <div className="text-center py-8 text-slate-400 text-sm">لا توجد بيانات كافية</div>
        )}
      </motion.div>

      {/* ===== FOOTER STATS STRIP ===== */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="bg-gradient-to-l from-emerald-800 via-teal-700 to-emerald-900 rounded-2xl p-5 shadow-sm"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-extrabold text-white">
              <AnimatedCounter value={total} />
            </div>
            <div className="text-emerald-200/70 text-xs font-semibold mt-1">إجمالي التدخلات</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">
              <AnimatedCounter value={stats.byStatut.TERMINEE || 0} />
            </div>
            <div className="text-emerald-200/70 text-xs font-semibold mt-1">تدخل منجز</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">
              <AnimatedCounter value={uniqueQuartiersWithInterventions} />
            </div>
            <div className="text-emerald-200/70 text-xs font-semibold mt-1">حي مغطى</div>
          </div>
          <div>
            <div className="text-2xl font-extrabold text-white">
              <AnimatedCounter value={Object.keys(stats.byCommune || {}).length} />
            </div>
            <div className="text-emerald-200/70 text-xs font-semibold mt-1">جماعة نشطة</div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
