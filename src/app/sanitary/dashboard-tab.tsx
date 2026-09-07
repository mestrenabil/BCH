'use client'

import React, { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  RISK_CATEGORY_LABELS, RISK_CATEGORY_COLORS,
  INSPECTION_RESULT_LABELS, INSPECTION_RESULT_COLORS,
  HEALTH_CARD_STATUS_LABELS, HEALTH_CARD_STATUS_COLORS,
  ESTABLISHMENT_STATUS_LABELS, ESTABLISHMENT_STATUS_COLORS,
  SAMPLE_CONFORMITY_LABELS, SAMPLE_CONFORMITY_COLORS,
} from '@/lib/constants'
import type { SanitarySubTab } from '@/lib/store'
import type { Establishment, Inspection, HealthCard, Sample } from './types'
import { calculateSanitaryMetrics, type SanitaryDashboardMetrics } from './metrics'

interface Props {
  establishments: Establishment[]
  inspections: Inspection[]
  healthCards: HealthCard[]
  samples: Sample[]
  dashboardMetrics?: SanitaryDashboardMetrics | null
  onNavigate: (tab: SanitarySubTab) => void
}

function Bar({ label, value, total, color, onClick }: {
  label: React.ReactNode; value: number; total: number; color: string; onClick?: () => void
}) {
  const pct = total > 0 ? Math.max(2, (value / total) * 100) : 0
  return (
    <button onClick={onClick} disabled={!onClick} className={`w-full flex items-center gap-2 text-right ${onClick ? 'hover:bg-slate-50 rounded-lg p-1 -m-1 transition' : ''}`}>
      <span className="text-xs text-slate-600 w-32 shrink-0 truncate text-right">{label}</span>
      <div className="flex-1 h-5 bg-slate-100 rounded-md overflow-hidden relative">
        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
          className="h-full rounded-md flex items-center justify-end pr-1.5" style={{ background: color }}>
          <span className="text-[10px] font-bold text-white">{value}</span>
        </motion.div>
      </div>
    </button>
  )
}

export default function DashboardTab({ establishments, inspections, healthCards, samples, dashboardMetrics, onNavigate }: Props) {
  const stats = useMemo(() => {
    return calculateSanitaryMetrics(establishments, inspections, healthCards, samples)
  }, [establishments, inspections, healthCards, samples])

  if (!dashboardMetrics && establishments.length === 0 && inspections.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center" dir="rtl">
        <div className="text-6xl mb-4">🍽️</div>
        <h3 className="text-lg font-bold text-slate-700">لا توجد بيانات بعد</h3>
        <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
          ابدأ بإضافة المنشآت، ثم أنشئ التفتيشات والبطاقات الصحية والعينات.
        </p>
        <button onClick={() => onNavigate('establishments')} className="mt-4 px-4 py-2 text-sm font-bold text-white bg-teal-600 rounded-lg hover:bg-teal-700">
          ➕ إضافة منشأة
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {(dashboardMetrics ? [
          { icon: '🏪', value: dashboardMetrics.establishmentsRegistered, label: 'منشآت مسجلة', color: 'text-slate-800', onClick: () => onNavigate('establishments') },
          { icon: '✅', value: dashboardMetrics.activeEstablishments, label: 'منشآت نشطة', color: 'text-emerald-600', onClick: () => onNavigate('establishments') },
          { icon: '🩺', value: dashboardMetrics.healthCardsTotal, label: 'بطاقات صحية', color: 'text-violet-600', onClick: () => onNavigate('healthCards') },
          { icon: '⏰', value: dashboardMetrics.expiredHealthCards, label: 'بطاقات منتهية', color: 'text-orange-600', onClick: () => onNavigate('healthCards') },
          { icon: '🔍', value: dashboardMetrics.inspectionsThisMonth, label: 'تفتيش هذا الشهر', color: 'text-blue-600', onClick: () => onNavigate('inspections') },
          { icon: '📋', value: dashboardMetrics.inspectionsTotal, label: 'إجمالي التفتيشات', color: 'text-indigo-600', onClick: () => onNavigate('inspections') },
          { icon: '🟢', value: dashboardMetrics.conformingEstablishments, label: 'منشآت مطابقة', color: 'text-emerald-600', onClick: () => onNavigate('establishments') },
          { icon: '🔴', value: dashboardMetrics.nonConformingEstablishments, label: 'منشآت غير مطابقة', color: 'text-red-600', onClick: () => onNavigate('establishments') },
          { icon: '⚠️', value: dashboardMetrics.openNonConformities, label: 'مخالفات مفتوحة', color: 'text-amber-600', onClick: () => onNavigate('inspections') },
          { icon: '🚨', value: dashboardMetrics.criticalNonConformities, label: 'مخالفات حرجة', color: 'text-red-700', onClick: () => onNavigate('inspections') },
          { icon: '📅', value: dashboardMetrics.overdueControls, label: 'تفتيشات متأخرة', color: 'text-orange-700', onClick: () => onNavigate('inspections') },
          { icon: '🔁', value: dashboardMetrics.counterVisits, label: 'إعادة مراقبة', color: 'text-cyan-600', onClick: () => onNavigate('inspections') },
          { icon: '🧪', value: dashboardMetrics.samplesCollected, label: 'عينات مسجلة', color: 'text-teal-600', onClick: () => onNavigate('samples') },
          { icon: '🧬', value: dashboardMetrics.labNonConformities, label: 'تحاليل غير مطابقة', color: 'text-rose-600', onClick: () => onNavigate('samples') },
          { icon: '📣', value: dashboardMetrics.foodComplaints, label: 'بلاغات غذائية', color: 'text-fuchsia-600' },
          { icon: '🥫', value: dashboardMetrics.expiredProducts, label: 'منتجات منتهية', color: 'text-orange-600' },
          { icon: '🌡️', value: dashboardMetrics.temperatureAlerts, label: 'إنذارات الحرارة', color: 'text-red-600' },
          { icon: '🍳', value: dashboardMetrics.oilNonConformities, label: 'زيوت غير مطابقة', color: 'text-yellow-700' },
        ] : [
          { icon: '🏪', value: establishments.length, label: 'منشأة', color: 'text-slate-800', onClick: () => onNavigate('establishments') },
          { icon: '🔍', value: inspections.length, label: 'تفتيش', color: 'text-blue-600', onClick: () => onNavigate('inspections') },
          { icon: '🩺', value: healthCards.length, label: 'بطاقة صحية', color: 'text-violet-600', onClick: () => onNavigate('healthCards') },
          { icon: '🧪', value: samples.length, label: 'عينة', color: 'text-teal-600', onClick: () => onNavigate('samples') },
        ]).map((kpi, i) => (
          <motion.button
            key={kpi.label}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={kpi.onClick}
            className="bg-white rounded-2xl border border-slate-100 p-4 text-right hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-2xl">{kpi.icon}</span>
              <span className={`text-3xl font-black ${kpi.color}`}>{kpi.value}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">{kpi.label}</p>
          </motion.button>
        ))}
      </div>

      {/* تنبيهات */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {stats.criticalEstablishments > 0 && (
          <button onClick={() => onNavigate('establishments')} className="bg-red-50 border border-red-200 rounded-2xl p-4 text-right hover:bg-red-100 transition">
            <div className="text-2xl mb-1">🚨</div>
            <div className="text-lg font-black text-red-700">{stats.criticalEstablishments}</div>
            <div className="text-xs text-red-600">منشأة مخاطر حرجة</div>
          </button>
        )}
        {stats.expiredCards > 0 && (
          <button onClick={() => onNavigate('healthCards')} className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-right hover:bg-orange-100 transition">
            <div className="text-2xl mb-1">⚠️</div>
            <div className="text-lg font-black text-orange-700">{stats.expiredCards}</div>
            <div className="text-xs text-orange-600">بطاقة صحية منتهية</div>
          </button>
        )}
        {stats.expiringSoonCards > 0 && (
          <button onClick={() => onNavigate('healthCards')} className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-right hover:bg-amber-100 transition">
            <div className="text-2xl mb-1">⏰</div>
            <div className="text-lg font-black text-amber-700">{stats.expiringSoonCards}</div>
            <div className="text-xs text-amber-600">بطاقة تنتهي خلال 30 يوم</div>
          </button>
        )}
      </div>

      {/* الرسوم */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">📊 المنشآت حسب فئة المخاطر</h3>
          <div className="space-y-2">
            {Object.keys(RISK_CATEGORY_LABELS).map((cat) => (
              <Bar key={cat} label={RISK_CATEGORY_LABELS[cat]} value={stats.establishmentsByRisk[cat] || 0} total={establishments.length} color={RISK_CATEGORY_COLORS[cat]} onClick={() => onNavigate('establishments')} />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🔍 نتائج التفتيشات</h3>
          <div className="space-y-2">
            {Object.keys(INSPECTION_RESULT_LABELS).map((r) => (
              <Bar key={r} label={INSPECTION_RESULT_LABELS[r]} value={stats.inspectionsByResult[r] || 0} total={inspections.length} color={INSPECTION_RESULT_COLORS[r]} onClick={() => onNavigate('inspections')} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🩺 البطاقات الصحية</h3>
          <div className="space-y-2">
            {Object.keys(HEALTH_CARD_STATUS_LABELS).map((s) => (
              <Bar key={s} label={HEALTH_CARD_STATUS_LABELS[s]} value={stats.healthCardsByStatus[s] || 0} total={healthCards.length} color={HEALTH_CARD_STATUS_COLORS[s]} onClick={() => onNavigate('healthCards')} />
            ))}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-bold text-slate-700 mb-3">🧪 مطابقة العينات</h3>
          <div className="space-y-2">
            {Object.keys(SAMPLE_CONFORMITY_LABELS).map((c) => (
              <Bar key={c} label={SAMPLE_CONFORMITY_LABELS[c]} value={stats.samplesByConformity[c] || 0} total={samples.length} color={SAMPLE_CONFORMITY_COLORS[c]} onClick={() => onNavigate('samples')} />
            ))}
          </div>
          {samples.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100 text-center">
              <div className="text-2xl font-black text-emerald-600">{stats.sampleConformityRate}%</div>
              <div className="text-xs text-slate-500">نسبة المطابقة</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
