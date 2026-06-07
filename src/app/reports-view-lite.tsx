'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts'
import { type CommuneType } from '@/lib/store'
import {
  type Statistics, type Intervention,
  TYPE_LABELS, TYPE_COLORS, CHART_COLORS, COMMUNE_COLORS, COMMUNE_LABELS, MONTH_NAMES_AR,
} from '@/lib/constants'

function ReportsView({ stats, selectedCommune, canSeeAllCommunes, selectedYear }: { stats: Statistics | null; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean; selectedYear: string }) {
  const [monthlyCosts, setMonthlyCosts] = useState<Record<string, number>>({})

  // Fetch monthly costs
  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams({ limit: '9999' })
        if (selectedYear) { params.set('from', `${selectedYear}-01-01`); params.set('to', `${selectedYear}-12-31`) }
        if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
        const res = await fetch(`/api/interventions?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          const interventions: Intervention[] = data.interventions || []
          const costs: Record<string, number> = {}
          for (const iv of interventions) {
            if (iv.coutTotal && iv.date) {
              const monthKey = new Date(iv.date).toISOString().slice(0, 7)
              costs[monthKey] = (costs[monthKey] || 0) + iv.coutTotal
            }
          }
          setMonthlyCosts(costs)
        }
      } catch { /* ignore */ }
    }
    load()
  }, [selectedYear, selectedCommune])

  if (!stats) return null

  // Empty state check
  const isMonthlyEmpty = !stats.monthly || Object.keys(stats.monthly).length === 0
  const isQuartierEmpty = !stats.byQuartier || stats.byQuartier.length === 0

  if (isMonthlyEmpty && isQuartierEmpty) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center min-h-[400px]" dir="rtl">
        <div className="text-center space-y-4 max-w-md mx-auto">
          <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-5xl mx-auto">
            📊
          </div>
          <h3 className="text-xl font-bold text-slate-800">لا توجد بيانات كافية لعرض التقارير</h3>
          <p className="text-slate-500 text-sm">لم يتم تسجيل أي تدخلات بعد. ستظهر التقارير والإحصائيات تلقائياً بمجرد إضافة تدخلات جديدة.</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              أضف تدخلات لعرض التحليلات
            </div>
          </div>
        </div>
      </div>
    )
  }

  const monthlyChartData = Object.entries(stats.monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({
    name: MONTH_NAMES_AR[parseInt(month.split('-')[1]) - 1],
    'مكافحة القوارض': data.DERATISATION || 0,
    'مكافحة الحشرات': data.DESINSECTISATION || 0,
    'التطهير والتعقيم': data.DESINFECTION || 0,
    المجموع: (data.DERATISATION || 0) + (data.DESINSECTISATION || 0) + (data.DESINFECTION || 0),
  }))

  const typePieData = Object.entries(stats.byType).map(([key, value]) => ({
    name: TYPE_LABELS[key], value, color: TYPE_COLORS[key],
  }))

  const quartierBarData = stats.byQuartier.slice(0, 10).map((q, i) => ({
    name: q.quartier.replace('حي ', ''),
    تدخلات: q.count,
    fill: CHART_COLORS[i % CHART_COLORS.length],
  }))

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">الإحصائيات والتقارير</h2>
          <p className="text-slate-400 text-sm mt-1">تحليل مفصل لبيانات التدخلات</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution - Pie */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">توزيع حسب النوع</h3>
          <p className="text-xs text-slate-400 mb-4">النسبة المئوية لكل نوع تدخل</p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typePieData} cx="50%" cy="42%" outerRadius={80} innerRadius={50}
                  paddingAngle={5} dataKey="value"
                  label={({ percent, x, y, cx, cy, midAngle, outerRadius: or }) => {
                    const RADIAN = Math.PI / 180
                    const radius = or + 22
                    const lx = cx + radius * Math.cos(-midAngle * RADIAN)
                    const ly = cy + radius * Math.sin(-midAngle * RADIAN)
                    return (
                      <text x={lx} y={ly} textAnchor={lx > cx ? 'start' : 'end'} dominantBaseline="central"
                        style={{ fontSize: '11px', fontWeight: 700, fill: '#334155', direction: 'rtl' }}>
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    )
                  }}
                  labelLine={false}
                  stroke="none">
                  {typePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(value: number, name: string) => [`${value} تدخل`, name]}
                  contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={10}
                  formatter={(value: string) => <span style={{ color: '#475569', fontSize: '12px', fontWeight: 600, marginRight: 4 }}>{value}</span>}
                  wrapperStyle={{ paddingTop: 16 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Summary Cards below chart */}
          <div className="grid grid-cols-3 gap-3 mt-3">
            {typePieData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 rounded-xl px-3 py-2.5 border"
                style={{ backgroundColor: item.color + '08', borderColor: item.color + '20' }}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <div className="min-w-0">
                  <div className="text-[11px] font-bold truncate" style={{ color: item.color }}>{item.name}</div>
                  <div className="text-xs font-extrabold text-slate-700">{item.value}</div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quartier Bar */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">التدخلات حسب الأحياء</h3>
          <p className="text-xs text-slate-400 mb-4">أكثر 10 أحياء نشاطاً</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quartierBarData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="تدخلات" radius={[0, 6, 6, 0]}>
                  {quartierBarData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Monthly Area Chart */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-1">التطور الشهري</h3>
        <p className="text-xs text-slate-400 mb-4">منحنى تطور التدخلات خلال الشهور</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyChartData}>
              <defs>
                {Object.entries(TYPE_COLORS).map(([k, color]) => (
                  <linearGradient key={k} id={`grad-${k}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Legend />
              <Area type="monotone" dataKey="مكافحة القوارض" stroke={TYPE_COLORS.DERATISATION} fill={`url(#grad-DERATISATION)`} strokeWidth={2} />
              <Area type="monotone" dataKey="مكافحة الحشرات" stroke={TYPE_COLORS.DESINSECTISATION} fill={`url(#grad-DESINSECTISATION)`} strokeWidth={2} />
              <Area type="monotone" dataKey="التطهير والتعقيم" stroke={TYPE_COLORS.DESINFECTION} fill={`url(#grad-DESINFECTION)`} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 pb-3">
          <h3 className="font-bold text-slate-800">الجدول الشهري التفصيلي</h3>
          <p className="text-xs text-slate-400">تفصيل شهري حسب نوع التدخل</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-100">
                <th className="py-3 px-4 text-right font-semibold text-slate-600">الشهر</th>
                <th className="py-3 px-4 text-center font-semibold text-red-600">🐀 القوارض</th>
                <th className="py-3 px-4 text-center font-semibold text-amber-600">🦟 الحشرات</th>
                <th className="py-3 px-4 text-center font-semibold text-emerald-600">🧴 التطهير</th>
                <th className="py-3 px-4 text-center font-semibold text-slate-800">المجموع</th>
                <th className="py-3 px-4 text-center font-semibold text-amber-700">💰 التكلفة</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, data], i) => {
                const dr = data.DERATISATION || 0; const di = data.DESINSECTISATION || 0; const df = data.DESINFECTION || 0; const total = dr + di + df
                const monthNum = parseInt(month.split('-')[1]) - 1
                return (
                  <tr key={month} className={`border-b border-slate-50 hover:bg-emerald-50/30 transition-colors ${i % 2 ? 'bg-slate-50/50' : ''}`}>
                    <td className="py-2.5 px-4 font-medium text-slate-700">{MONTH_NAMES_AR[monthNum]} {month.split('-')[0]}</td>
                    <td className="py-2.5 px-4 text-center"><span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-600">{dr}</span></td>
                    <td className="py-2.5 px-4 text-center"><span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-600">{di}</span></td>
                    <td className="py-2.5 px-4 text-center"><span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600">{df}</span></td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-800">{total}</td>
                    <td className="py-2.5 px-4 text-center">
                      {monthlyCosts[month] ? (
                        <span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-700">{monthlyCosts[month].toLocaleString('ar-MA')} د.م</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}

export default ReportsView
