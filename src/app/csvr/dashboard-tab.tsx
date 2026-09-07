'use client'

import React from 'react'
import { motion } from 'framer-motion'
import {
  CSVR_SPECIES_ICONS, CSVR_SPECIES_LABELS,
  CSVR_REPORT_STATUS_COLORS, CSVR_REPORT_STATUS_LABELS,
  CSVR_PRIORITY_COLORS, CSVR_PRIORITY_LABELS,
} from '@/lib/constants'
import type { CsvrStatistics } from './types'

interface Props {
  stats: CsvrStatistics | null
  loading: boolean
}

function StatCard({ icon, label, value, color, delay = 0 }: { icon: string; label: string; value: number | string; color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
      className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl sm:text-2xl shrink-0"
          style={{ backgroundColor: color + '15' }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xl sm:text-2xl font-bold text-slate-800 leading-none">{value}</div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-0.5 truncate">{label}</div>
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardTab({ stats, loading }: Props) {
  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="text-center py-20 text-slate-400">
        <div className="text-5xl mb-3">📊</div>
        <p>لا توجد بيانات متاحة</p>
      </div>
    )
  }

  const cards = [
    { icon: '📢', label: 'إجمالي البلاغات', value: stats.reports.total, color: '#3b82f6' },
    { icon: '📥', label: 'بلاغات اليوم', value: stats.reports.today, color: '#06b6d4' },
    { icon: '🚨', label: 'بلاغات عاجلة', value: stats.reports.urgent, color: '#ef4444' },
    { icon: '🦠', label: 'اشتباه الكلب', value: stats.reports.rabiesSuspect, color: '#b91c1c' },
    { icon: '🦴', label: 'مهمات الاصطياد', value: stats.missions.total, color: '#8b5cf6' },
    { icon: '⏰', label: 'مهمات مؤجلة', value: stats.missions.overdue, color: '#f59e0b' },
    { icon: '🐾', label: 'حيوانات مسجلة', value: stats.animals.total, color: '#f59e0b' },
    { icon: '🏠', label: 'بالمركز', value: stats.animals.atCenter, color: '#0ea5e9' },
    { icon: '🔬', label: 'في الحجر', value: stats.animals.inQuarantine, color: '#dc2626' },
    { icon: '✂️', label: 'مُعقَّمة', value: stats.animals.sterilized, color: '#22c55e' },
    { icon: '💉', label: 'مُلقَّحة', value: stats.animals.vaccinated, color: '#10b981' },
    { icon: '🏷️', label: 'مُعرَّفة', value: stats.animals.byStatus.IDENTIFIE || 0, color: '#0f766e' },
    { icon: '↩️', label: 'جاهزة للإعادة', value: stats.animals.byStatus.PRET_RELACHER || 0, color: '#0891b2' },
    { icon: '🕊️', label: 'مُطلقة', value: stats.animals.byStatus.RELACHE || 0, color: '#16a34a' },
    { icon: '🏠', label: 'متبناة', value: stats.animals.adopted, color: '#ec4899' },
    { icon: '💀', label: 'متوفاة', value: stats.animals.deceased, color: '#64748b' },
    { icon: '🩹', label: 'حالات العض', value: stats.reports.bites, color: '#f97316' },
    { icon: '✅', label: 'مهمات منجزة', value: stats.missions.completed, color: '#16a34a' },
  ]

  const speciesData = Object.entries(stats.reports.bySpecies)
  const statusData = Object.entries(stats.reports.byStatus).filter(([, v]) => v > 0)
  const maxQuartier = Math.max(...stats.reports.byQuartier.map((q) => q.count), 1)

  const rates = [
    { label: 'معدل التعقيم', value: stats.animals.sterilizationRate, color: '#22c55e', icon: '✂️' },
    { label: 'معدل التلقيح', value: stats.animals.vaccinationRate, color: '#10b981', icon: '💉' },
    { label: 'معدل التبني', value: stats.animals.adoptionRate, color: '#ec4899', icon: '🏠' },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl">📊</span>
        <div><h2 className="text-base font-extrabold text-slate-800">لوحة القيادة</h2><p className="mt-0.5 text-[11px] text-slate-500">المؤشرات العامة والتقدم الميداني</p></div>
      </div>
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
        {cards.map((c, i) => (
          <StatCard key={c.label} {...c} delay={i * 0.03} />
        ))}
      </div>

      {/* Rates */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {rates.map((r) => (
          <div key={r.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <span>{r.icon}</span>{r.label}
              </span>
              <span className="text-lg font-bold" style={{ color: r.color }}>{r.value}%</span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${r.value}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ backgroundColor: r.color }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Species Distribution */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-1.5">
            <span>🐾</span> التوزيع حسب النوع
          </h3>
          <div className="space-y-2.5">
            {speciesData.length === 0 && <p className="text-xs text-slate-400">لا توجد بيانات</p>}
            {speciesData.map(([sp, count]) => {
              const total = speciesData.reduce((s, [, c]) => s + c, 0) || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={sp} className="flex items-center gap-2">
                  <span className="text-lg w-7 text-center">{CSVR_SPECIES_ICONS[sp] || '🐾'}</span>
                  <span className="text-xs text-slate-600 w-16">{CSVR_SPECIES_LABELS[sp] || sp}</span>
                  <div className="flex-1 h-6 bg-slate-100 rounded-lg overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full flex items-center justify-end pr-2"
                      style={{ backgroundColor: sp === 'DOG' ? '#f59e0b' : sp === 'CAT' ? '#8b5cf6' : '#64748b' }}
                    >
                      <span className="text-[10px] font-bold text-white">{count}</span>
                    </motion.div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Reports by Status */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-1.5">
            <span>📋</span> البلاغات حسب الحالة
          </h3>
          <div className="flex flex-wrap gap-2">
            {statusData.length === 0 && <p className="text-xs text-slate-400">لا توجد بيانات</p>}
            {statusData.map(([st, count]) => (
              <div
                key={st}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: (CSVR_REPORT_STATUS_COLORS[st] || '#64748b') + '15', color: CSVR_REPORT_STATUS_COLORS[st] || '#64748b' }}
              >
                <span>{CSVR_REPORT_STATUS_LABELS[st] || st}</span>
                <span className="bg-white/60 rounded-full px-1.5">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quartiers */}
      {stats.reports.byQuartier.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <h3 className="font-bold text-slate-700 mb-3 text-sm flex items-center gap-1.5">
            <span>📍</span> البلاغات حسب الحي
          </h3>
          <div className="space-y-2">
            {stats.reports.byQuartier.slice(0, 8).map((q) => (
              <div key={q.quartier} className="flex items-center gap-2">
                <span className="text-xs text-slate-600 w-28 truncate">{q.quartier}</span>
                <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(q.count / maxQuartier) * 100}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full bg-gradient-to-l from-amber-400 to-orange-400 flex items-center justify-end pr-2"
                  >
                    <span className="text-[10px] font-bold text-white">{q.count}</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
