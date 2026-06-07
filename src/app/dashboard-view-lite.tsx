'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { type ViewType, type CommuneType } from '@/lib/store'
import {
  type Statistics,
  TYPE_LABELS, STATUT_LABELS, TYPE_COLORS, STATUT_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS, TYPE_ICONS, MONTH_NAMES_AR,
  cardVariants,
} from '@/lib/constants'

function DashboardView({ stats, onNavigate, selectedCommune, canSeeAllCommunes, onRetry }: { stats: Statistics | null; onNavigate: (v: ViewType) => void; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean; onRetry?: () => void }) {
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
  const completionRate = stats.total > 0 ? Math.round(((stats.byStatut.TERMINEE || 0) / stats.total) * 100) : 0
  const inProgressRate = stats.total > 0 ? Math.round(((stats.byStatut.EN_COURS || 0) / stats.total) * 100) : 0

  // Prepare chart data
  const monthlyChartData = Object.entries(stats.monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({
    name: MONTH_NAMES_AR[parseInt(month.split('-')[1]) - 1],
    'مكافحة القوارض': data.DERATISATION || 0,
    'مكافحة الحشرات': data.DESINSECTISATION || 0,
    'التطهير والتعقيم': data.DESINFECTION || 0,
  }))

  const statusPieData = Object.entries(stats.byStatut).map(([key, value]) => ({
    name: STATUT_LABELS[key], value, color: STATUT_COLORS[key],
  }))

  const radarData = stats.byQuartier.slice(0, 6).map(q => ({
    quartier: q.quartier.replace('حي ', ''),
    تدخلات: q.count,
  }))

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">لوحة القيادة</h2>
          <p className="text-slate-500 text-sm mt-1">
            {selectedCommune === 'ALL'
              ? 'نظرة عامة على عمليات 3D — حسب الجماعة'
              : `نظرة عامة على عمليات 3D — ${COMMUNE_LABELS[selectedCommune]}`}
          </p>
        </div>
        {selectedCommune !== 'ALL' && (
          <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold self-start"
            style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] + '18', color: COMMUNE_COLORS[selectedCommune] }}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] }} />
            {COMMUNE_LABELS[selectedCommune]}
          </motion.span>
        )}
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'إجمالي التدخلات', value: stats.total, icon: '📋', gradient: 'from-slate-700 to-slate-900', shadow: 'shadow-slate-300' },
          { title: 'مكافحة القوارض', value: stats.byType.DERATISATION || 0, icon: '🐀', gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-200' },
          { title: 'مكافحة الحشرات', value: stats.byType.DESINSECTISATION || 0, icon: '🦟', gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-200' },
          { title: 'التطهير والتعقيم', value: stats.byType.DESINFECTION || 0, icon: '🧴', gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200' },
        ].map((card, i) => (
          <motion.div key={card.title} variants={cardVariants} initial="initial" animate="animate" whileHover="hover"
            transition={{ delay: i * 0.08 }}
            className={`bg-gradient-to-br ${card.gradient} text-white rounded-2xl p-5 ${card.shadow} shadow-lg relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
            <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-full translate-x-4 translate-y-4" />
            <div className="relative z-10">
              <span className="text-3xl opacity-90">{card.icon}</span>
              <div className="text-3xl lg:text-4xl font-bold mt-3 tracking-tight">{card.value}</div>
              <div className="text-sm opacity-80 mt-1 font-medium">{card.title}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Commune Breakdown - Only show for admin users viewing ALL communes */}
      {canSeeAllCommunes && selectedCommune === 'ALL' && stats.byCommune && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-teal-600 to-emerald-600 text-white px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">🏛️ التوزيع حسب الجماعة</h3>
                <p className="text-emerald-100 text-xs mt-0.5">تفصيل التدخلات لكل جماعة ترابية</p>
              </div>
              <div className="text-2xl font-extrabold">{stats.total}</div>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {(['سلا', 'سيدي أبي القنادل', 'عامر'] as const).map((communeKey, i) => {
                const data = stats.byCommune?.[communeKey]
                const color = COMMUNE_COLORS[communeKey]
                const label = COMMUNE_LABELS[communeKey]
                const total = data?.total || 0
                const pct = stats.total > 0 ? Math.round((total / stats.total) * 100) : 0
                const derat = data?.DERATISATION || 0
                const desins = data?.DESINSECTISATION || 0
                const desinf = data?.DESINFECTION || 0

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
                  </motion.div>
                )
              })}
            </div>
            {/* Commune comparison chart - Only for admin users */}
            {canSeeAllCommunes && stats.byCommune && Object.keys(stats.byCommune).length > 0 && (
              <div className="mt-4 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                    (['سلا', 'سيدي أبي القنادل', 'عامر'] as const).map(key => ({
                      name: key === 'سلا' ? 'سلا' : key === 'سيدي أبي القنادل' ? 'أبي القنادل' : 'عامر',
                      'مكافحة القوارض': stats.byCommune?.[key]?.DERATISATION || 0,
                      'مكافحة الحشرات': stats.byCommune?.[key]?.DESINSECTISATION || 0,
                      'التطهير والتعقيم': stats.byCommune?.[key]?.DESINFECTION || 0,
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
              { label: 'منجزة', val: stats.byStatut.TERMINEE || 0, color: 'bg-emerald-500', pct: completionRate },
              { label: 'جارية', val: stats.byStatut.EN_COURS || 0, color: 'bg-amber-500', pct: inProgressRate },
              { label: 'مبرمجة', val: stats.byStatut.PLANIFIEE || 0, color: 'bg-blue-500', pct: stats.total > 0 ? Math.round(((stats.byStatut.PLANIFIEE || 0) / stats.total) * 100) : 0 },
              { label: 'ملغاة', val: stats.byStatut.ANNULEE || 0, color: 'bg-slate-300', pct: stats.total > 0 ? Math.round(((stats.byStatut.ANNULEE || 0) / stats.total) * 100) : 0 },
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
            {stats.recent.slice(0, 8).map((intervention, i) => (
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

      {/* Monthly Chart - Recharts */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-800">التدخلات الشهرية</h3>
            <p className="text-xs text-slate-400">التوزيع الشهري حسب نوع التدخل</p>
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
    </div>
  )
}

export default DashboardView
