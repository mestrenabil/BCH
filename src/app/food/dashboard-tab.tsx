'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  FOOD_TYPE_LABELS, FOOD_TYPE_ICONS, FOOD_TYPE_COLORS,
  FOOD_REPORT_STATUS_LABELS, FOOD_REPORT_STATUS_COLORS,
  FOOD_PRIORITY_LABELS, FOOD_PRIORITY_COLORS,
  FOOD_TYPE_ADVICE,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { FoodReport, FoodStatistics } from './types'

interface Props {
  reports: FoodReport[]
  onOpenList: (filter?: { type?: string; status?: string }) => void
}

const REPORT_TYPES = ['RESTAURANT', 'EXPIRED_PRODUCT', 'STREET_VENDOR', 'PREMISES_HYGIENE']
const STATUS_FLOW = ['NOUVEAU', 'VERIFICATION', 'VALIDE', 'EN_COURS', 'TRAITE']
const RECENT_DAYS = 14

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function computeStats(reports: FoodReport[]): FoodStatistics {
  const byStatus: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const byPriority: Record<string, number> = {}
  const byCommune: Record<string, number> = {}
  let withPhotos = 0
  let withGeo = 0
  let publicCount = 0
  let internalCount = 0
  let urgentCount = 0

  const trendMap = new Map<string, number>()
  for (let i = RECENT_DAYS - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    trendMap.set(d.toISOString().slice(0, 10), 0)
  }

  let ageSum = 0
  let nonResolved = 0

  for (const r of reports) {
    byStatus[r.statut] = (byStatus[r.statut] || 0) + 1
    byType[r.reportType] = (byType[r.reportType] || 0) + 1
    byPriority[r.priority] = (byPriority[r.priority] || 0) + 1
    byCommune[r.commune] = (byCommune[r.commune] || 0) + 1
    if (r.photos && r.photos.length > 0) withPhotos++
    if (r.latitude != null) withGeo++
    if (r.source === 'PUBLIC') publicCount++; else internalCount++
    if (r.priority === 'URGENTE' || r.priority === 'SANITAIRE') urgentCount++

    const dayKey = r.createdAt.slice(0, 10)
    if (trendMap.has(dayKey)) trendMap.set(dayKey, (trendMap.get(dayKey) || 0) + 1)

    if (r.statut !== 'TRAITE' && r.statut !== 'REJETE' && r.statut !== 'CLASSE') {
      ageSum += daysSince(r.createdAt)
      nonResolved++
    }
  }

  const total = reports.length
  const resolved = (byStatus['TRAITE'] || 0) + (byStatus['REJETE'] || 0) + (byStatus['CLASSE'] || 0)
  const recentTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ date, count }))

  return {
    total,
    byStatus, byType, byPriority, byCommune,
    bySource: { PUBLIC: publicCount, INTERNAL: internalCount },
    withPhotos, withGeo,
    recentTrend,
    resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    urgentCount,
    avgAgeDays: nonResolved > 0 ? Math.round(ageSum / nonResolved) : 0,
  }
}

// شريط أفقي بسيط بدون مكتبات خارجية
function Bar({ label, value, total, color, onClick }: {
  label: React.ReactNode
  value: number
  total: number
  color: string
  onClick?: () => void
}) {
  const pct = total > 0 ? Math.max(2, (value / total) * 100) : 0
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`w-full flex items-center gap-2 text-right ${onClick ? 'hover:bg-slate-50 rounded-lg p-1 -m-1 transition' : ''}`}
    >
      <span className="text-xs text-slate-600 w-32 shrink-0 truncate text-right">{label}</span>
      <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden relative">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
          className="h-full rounded-md flex items-center justify-end pr-1.5"
          style={{ background: color }}
        >
          <span className="text-[10px] font-bold text-white">{value}</span>
        </motion.div>
      </div>
    </button>
  )
}

export default function DashboardTab({ reports, onOpenList }: Props) {
  const stats = useMemo(() => computeStats(reports), [reports])

  // أحدث 5 بلاغات
  const latest = useMemo(() => [...reports].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5), [reports])

  // تنبيهات: بلاغات عاجلة غير معالجة + بلاغات قديمة (> 7 أيام)
  const alerts = useMemo(() => {
    const urgent = reports.filter((r) =>
      (r.priority === 'URGENTE' || r.priority === 'SANITAIRE') &&
      !['TRAITE', 'REJETE', 'CLASSE'].includes(r.statut)
    )
    const stale = reports.filter((r) =>
      !['TRAITE', 'REJETE', 'CLASSE'].includes(r.statut) &&
      daysSince(r.createdAt) > 7
    )
    return { urgent, stale }
  }, [reports])

  const maxTrend = Math.max(1, ...stats.recentTrend.map((d) => d.count))

  if (reports.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center" dir="rtl">
        <div className="text-6xl mb-4">🥗</div>
        <h3 className="text-lg font-bold text-slate-700">لا توجد بلاغات غذائية بعد</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          ستظهر هنا إحصائيات تفصيلية، رسوم بيانية، وتنبيهات تلقائية بمجرد توفر البلاغات.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* صف KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">📊</span>
            <span className="text-3xl font-black text-slate-800">{stats.total}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">إجمالي البلاغات</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">🆕</span>
            <span className="text-3xl font-black text-blue-600">{stats.byStatus['NOUVEAU'] || 0}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">بلاغات جديدة</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">⚠️</span>
            <span className="text-3xl font-black text-red-600">{stats.urgentCount}</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">بلاغات عاجلة/صحية</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-2xl">✅</span>
            <span className="text-3xl font-black text-emerald-600">{stats.resolutionRate}%</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">نسبة المعالجة</p>
        </motion.div>
      </div>

      {/* صف الرسوم */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* توزيع حسب النوع */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>📋</span> التوزيع حسب نوع المخالفة
          </h3>
          <div className="space-y-2">
            {REPORT_TYPES.map((type) => (
              <Bar
                key={type}
                label={<>{FOOD_TYPE_ICONS[type]} {FOOD_TYPE_LABELS[type]}</>}
                value={stats.byType[type] || 0}
                total={stats.total}
                color={FOOD_TYPE_COLORS[type]}
                onClick={() => onOpenList({ type })}
              />
            ))}
          </div>
          {REPORT_TYPES.map((type) => (stats.byType[type] || 0) > 0 && (
            <p key={type} className="text-[10px] text-slate-400 mt-2 leading-relaxed">
              <span className="font-bold">{FOOD_TYPE_ICONS[type]} {FOOD_TYPE_LABELS[type]}:</span> {FOOD_TYPE_ADVICE[type]}
            </p>
          ))}
        </div>

        {/* التوزيع حسب الحالة */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>🔄</span> تدفق معالجة البلاغات
          </h3>
          <div className="space-y-2">
            {STATUS_FLOW.map((status) => (
              <Bar
                key={status}
                label={FOOD_REPORT_STATUS_LABELS[status]}
                value={stats.byStatus[status] || 0}
                total={stats.total}
                color={FOOD_REPORT_STATUS_COLORS[status]}
                onClick={() => onOpenList({ status })}
              />
            ))}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <Bar label="مرفوض" value={stats.byStatus['REJETE'] || 0} total={stats.total} color={FOOD_REPORT_STATUS_COLORS['REJETE']} />
              <Bar label="مؤرشف" value={stats.byStatus['CLASSE'] || 0} total={stats.total} color={FOOD_REPORT_STATUS_COLORS['CLASSE']} />
            </div>
          </div>
        </div>
      </div>

      {/* الاتجاه الزمني (آخر 14 يوم) */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span>📈</span> البلاغات خلال آخر {RECENT_DAYS} يوم
          <span className="mr-auto text-xs font-normal text-slate-400">
            المجموع: {stats.recentTrend.reduce((a, b) => a + b.count, 0)} بلاغ
          </span>
        </h3>
        <div className="flex items-end gap-1 h-32">
          {stats.recentTrend.map((d) => {
            const h = (d.count / maxTrend) * 100
            const dateLabel = new Date(d.date).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit' })
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="text-[9px] text-slate-500 font-bold opacity-0 group-hover:opacity-100 transition">{d.count}</div>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(2, h)}%` }}
                  transition={{ duration: 0.4 }}
                  className="w-full rounded-t-md bg-gradient-to-t from-rose-400 to-red-500 hover:from-rose-500 hover:to-red-600 transition-colors min-h-[2px]"
                  title={`${dateLabel}: ${d.count} بلاغ`}
                />
                <div className="text-[8px] text-slate-400">{dateLabel}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* صف: التنبيهات + أحدث البلاغات */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* التنبيهات */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>🔔</span> التنبيهات
          </h3>
          <div className="space-y-2">
            {alerts.urgent.length > 0 && (
              <button onClick={() => onOpenList()} className="w-full text-right bg-red-50 border border-red-200 rounded-xl p-3 hover:bg-red-100 transition">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚨</span>
                  <span className="text-sm font-bold text-red-700">{alerts.urgent.length} بلاغ عاجل/صحي</span>
                </div>
                <p className="text-xs text-red-600 mt-1">يتطلب تدخلاً فورياً</p>
              </button>
            )}
            {alerts.stale.length > 0 && (
              <button onClick={() => onOpenList()} className="w-full text-right bg-amber-50 border border-amber-200 rounded-xl p-3 hover:bg-amber-100 transition">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏰</span>
                  <span className="text-sm font-bold text-amber-700">{alerts.stale.length} بلاغ متأخر</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">باقٍ بدون معالجة أكثر من 7 أيام</p>
              </button>
            )}
            {alerts.urgent.length === 0 && alerts.stale.length === 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-2xl">✨</span>
                <p className="text-xs text-emerald-700 mt-1 font-bold">لا توجد تنبيهات — كل البلاغات تحت المتابعة</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-slate-700">{stats.avgAgeDays}</div>
                <div className="text-[10px] text-slate-500">متوسط العمر (يوم)</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-slate-700">{stats.bySource.PUBLIC}</div>
                <div className="text-[10px] text-slate-500">بلاغات عمومية</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-slate-700">{stats.withPhotos}</div>
                <div className="text-[10px] text-slate-500">بلاغات بصور</div>
              </div>
              <div className="bg-slate-50 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-slate-700">{stats.withGeo}</div>
                <div className="text-[10px] text-slate-500">محددة جغرافياً</div>
              </div>
            </div>
          </div>
        </div>

        {/* أحدث البلاغات */}
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>🕐</span> أحدث البلاغات
          </h3>
          <div className="space-y-2">
            {latest.map((r) => (
              <button
                key={r.id}
                onClick={() => onOpenList()}
                className="w-full text-right bg-slate-50 hover:bg-slate-100 rounded-xl p-2.5 transition flex items-center gap-2"
              >
                <span className="text-lg shrink-0">{FOOD_TYPE_ICONS[r.reportType]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-700 truncate">{r.reference}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {r.establishmentName || r.quartier || COMMUNE_LABELS[r.commune] || r.commune}
                  </div>
                </div>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
                  style={{ backgroundColor: (FOOD_REPORT_STATUS_COLORS[r.statut] || '#64748b') + '20', color: FOOD_REPORT_STATUS_COLORS[r.statut] }}
                >
                  {FOOD_REPORT_STATUS_LABELS[r.statut]}
                </span>
              </button>
            ))}
          </div>
          <button onClick={() => onOpenList()} className="w-full mt-3 text-xs font-bold text-rose-600 hover:text-rose-700">
            عرض كل البلاغات ←
          </button>
        </div>
      </div>

      {/* التوزيع حسب الأولوية + حسب الجماعة */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>🎚️</span> حسب درجة الأولوية
          </h3>
          <div className="space-y-2">
            {Object.keys(FOOD_PRIORITY_LABELS).map((p) => (
              <Bar
                key={p}
                label={FOOD_PRIORITY_LABELS[p]}
                value={stats.byPriority[p] || 0}
                total={stats.total}
                color={FOOD_PRIORITY_COLORS[p]}
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
            <span>📍</span> حسب الجماعة
          </h3>
          <div className="space-y-2">
            {Object.entries(stats.byCommune)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([commune, count]) => (
                <Bar
                  key={commune}
                  label={<span style={{ color: COMMUNE_COLORS[commune] || '#64748b' }}>{COMMUNE_LABELS[commune] || commune}</span>}
                  value={count}
                  total={stats.total}
                  color={COMMUNE_COLORS[commune] || '#6b7280'}
                />
              ))}
          </div>
        </div>
      </div>
    </div>
  )
}
