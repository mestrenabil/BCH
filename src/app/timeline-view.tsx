'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  type Intervention,
  TYPE_LABELS, TYPE_COLORS, STATUT_LABELS, STATUT_COLORS, TYPE_ICONS,
  COMMUNE_LABELS, COMMUNE_COLORS, MONTH_NAMES_AR,
} from '@/lib/constants'

// ===== TYPES =====
type ZoomLevel = 'day' | 'week' | 'month'

interface InterventionWithPosition extends Intervention {
  leftPx: number
  widthPx: number
}

// ===== HELPERS =====
function formatDateAr(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getDate()} ${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000))
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ===== MAIN COMPONENT =====
export default function TimelineView({ interventions, commune }: { interventions: Intervention[]; commune: string }) {
  const [zoom, setZoom] = useState<ZoomLevel>('week')
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null)
  const scrollToDateRef = useRef<Date | null>(null)
  const [scrollKey, setScrollKey] = useState(0)
  const timelineRef = useRef<HTMLDivElement>(null)
  const today = useMemo(() => new Date(), [])

  // Zoom config: pixels per day
  const pxPerDay = useMemo(() => {
    switch (zoom) {
      case 'day': return 80
      case 'week': return 30
      case 'month': return 6
    }
  }, [zoom])

  // Calculate timeline range
  const { timelineStart, timelineEnd } = useMemo(() => {
    if (!interventions.length) {
      const now = new Date()
      return {
        timelineStart: addDays(now, -15),
        timelineEnd: addDays(now, 30),
      }
    }
    const dates = interventions.map(i => new Date(i.date).getTime())
    const minDate = new Date(Math.min(...dates))
    const maxDate = new Date(Math.max(...dates))
    // Add padding
    const start = addDays(minDate, -7)
    const end = addDays(maxDate, 21)
    return { timelineStart: start, timelineEnd: end }
  }, [interventions])

  const totalDays = useMemo(() => daysBetween(timelineStart, timelineEnd), [timelineStart, timelineEnd])
  const totalWidth = useMemo(() => totalDays * pxPerDay, [totalDays, pxPerDay])

  // Today position
  const todayOffsetPx = useMemo(() => {
    return daysBetween(timelineStart, today) * pxPerDay
  }, [timelineStart, today, pxPerDay])

  // Group interventions by month/week for display
  const groupedInterventions = useMemo(() => {
    const groups: Record<string, Intervention[]> = {}
    interventions.forEach(inv => {
      const d = new Date(inv.date)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!groups[key]) groups[key] = []
      groups[key].push(inv)
    })
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
  }, [interventions])

  // Assign rows to avoid overlap (simple approach: group by type)
  const rowsByType = useMemo(() => {
    const rows: Record<string, InterventionWithPosition[]> = {}
    const sorted = [...interventions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    sorted.forEach(inv => {
      const type = inv.type || 'UNKNOWN'
      if (!rows[type]) rows[type] = []

      const invDate = new Date(inv.date)
      const leftPx = daysBetween(timelineStart, invDate) * pxPerDay
      const widthPx = Math.max(pxPerDay * 2, 60) // minimum 2 days width or 60px

      rows[type].push({
        ...inv,
        leftPx,
        widthPx,
      })
    })
    return rows
  }, [interventions, timelineStart, pxPerDay])

  // Generate date headers based on zoom
  const dateHeaders = useMemo(() => {
    const headers: { label: string; sublabel?: string; px: number; isToday: boolean; isFriday: boolean; isSunday: boolean }[] = []
    const current = new Date(timelineStart)

    while (current <= timelineEnd) {
      const px = daysBetween(timelineStart, current) * pxPerDay
      const isTodayFlag = isSameDay(current, today)
      const dayOfWeek = current.getDay()
      const isFriday = dayOfWeek === 5
      const isSunday = dayOfWeek === 0

      if (zoom === 'day') {
        headers.push({
          label: `${current.getDate()}`,
          sublabel: MONTH_NAMES_AR[current.getMonth()],
          px,
          isToday: isTodayFlag,
          isFriday,
          isSunday,
        })
        current.setDate(current.getDate() + 1)
      } else if (zoom === 'week') {
        headers.push({
          label: `${current.getDate()} ${MONTH_NAMES_AR[current.getMonth()]}`,
          px,
          isToday: isTodayFlag,
          isFriday,
          isSunday,
        })
        current.setDate(current.getDate() + 1)
      } else {
        // Month view - show week markers
        if (current.getDay() === 1 || headers.length === 0) {
          headers.push({
            label: `${current.getDate()} ${MONTH_NAMES_AR[current.getMonth()]}`,
            px,
            isToday: isTodayFlag,
            isFriday,
            isSunday,
          })
        }
        current.setDate(current.getDate() + 1)
      }
    }
    return headers
  }, [timelineStart, timelineEnd, pxPerDay, zoom, today])

  // Month headers
  const monthHeaders = useMemo(() => {
    const months: { label: string; px: number; widthPx: number }[] = []
    const current = new Date(timelineStart)
    current.setDate(1)

    while (current <= timelineEnd) {
      const monthStart = new Date(current)
      const px = daysBetween(timelineStart, monthStart) * pxPerDay

      // Calculate next month
      const nextMonth = new Date(current)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      const nextPx = daysBetween(timelineStart, nextMonth) * pxPerDay

      months.push({
        label: `${MONTH_NAMES_AR[current.getMonth()]} ${current.getFullYear()}`,
        px: Math.max(0, px),
        widthPx: Math.max(nextPx - px, 50),
      })
      current.setMonth(current.getMonth() + 1)
    }
    return months
  }, [timelineStart, timelineEnd, pxPerDay])

  // Scroll to today on mount
  useEffect(() => {
    if (timelineRef.current && interventions.length > 0) {
      const todayPx = daysBetween(timelineStart, today) * pxPerDay
      timelineRef.current.scrollLeft = Math.max(0, todayPx - timelineRef.current.clientWidth / 2)
    }
  }, [interventions.length, timelineStart, today, pxPerDay])

  // Scroll to a specific date
  useEffect(() => {
    const target = scrollToDateRef.current
    if (target && timelineRef.current) {
      const px = daysBetween(timelineStart, target) * pxPerDay
      timelineRef.current.scrollTo({ left: Math.max(0, px - timelineRef.current.clientWidth / 2), behavior: 'smooth' })
      scrollToDateRef.current = null
    }
  }, [scrollKey, timelineStart, pxPerDay])

  const zoomButtons: { level: ZoomLevel; label: string }[] = [
    { level: 'day', label: 'يومي' },
    { level: 'week', label: 'أسبوعي' },
    { level: 'month', label: 'شهري' },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            📅 الجدول الزمني للتدخلات
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            عرض زمني بصري لجميع التدخلات حسب النوع والتاريخ
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden">
            {zoomButtons.map(btn => (
              <button
                key={btn.level}
                onClick={() => setZoom(btn.level)}
                className={`px-3 py-1.5 text-xs font-bold transition-all ${
                  zoom === btn.level
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
          {/* Today button */}
          <button
            onClick={() => { scrollToDateRef.current = new Date(); setScrollKey(k => k + 1) }}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            📍 اليوم
          </button>
        </div>
      </motion.div>

      {/* Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-4">
          {/* Type legend */}
          <span className="text-xs font-bold text-slate-500">نوع التدخل:</span>
          {Object.entries(TYPE_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TYPE_COLORS[key] }} />
              <span className="text-xs text-slate-600">{TYPE_ICONS[key]} {label}</span>
            </div>
          ))}
          {/* Status legend */}
          <span className="text-xs font-bold text-slate-500 mr-2">الحالة:</span>
          {Object.entries(STATUT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: STATUT_COLORS[key] }} />
              <span className="text-xs text-slate-600">{label}</span>
            </div>
          ))}
          {/* Today indicator */}
          <div className="flex items-center gap-1.5 mr-2">
            <div className="w-px h-4 bg-red-500" />
            <span className="text-xs text-slate-600">اليوم</span>
          </div>
        </div>
      </motion.div>

      {/* Timeline */}
      {interventions.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl border border-slate-200/80 p-12 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">📅</span>
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">لا توجد تدخلات</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            لم يتم تسجيل أي تدخل بعد. ستظهر التدخلات هنا بمجرد إضافتها.
          </p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden"
        >
          {/* Scrollable timeline container */}
          <div
            ref={timelineRef}
            className="overflow-x-auto"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div style={{ minWidth: totalWidth + 200, position: 'relative' }}>
              {/* Month headers */}
              <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200">
                <div className="relative h-8" style={{ width: totalWidth + 200 }}>
                  {monthHeaders.map((m, i) => (
                    <div
                      key={i}
                      className="absolute top-0 h-full flex items-center px-3 text-xs font-bold text-slate-600 border-l border-slate-200 first:border-r-0"
                      style={{ left: m.px, width: m.widthPx }}
                    >
                      {m.label}
                    </div>
                  ))}
                </div>
                {/* Day headers */}
                <div className="relative h-7 border-b border-slate-200" style={{ width: totalWidth + 200 }}>
                  {dateHeaders.map((h, i) => (
                    <div
                      key={i}
                      className={`absolute top-0 h-full flex items-center justify-center text-[10px] border-l border-slate-100 ${
                        h.isToday ? 'bg-red-50 text-red-600 font-bold' :
                        h.isFriday ? 'bg-amber-50/50 text-amber-700' :
                        h.isSunday ? 'bg-rose-50/30 text-rose-600' :
                        'text-slate-400'
                      }`}
                      style={{ left: h.px, width: pxPerDay }}
                    >
                      {h.label}
                    </div>
                  ))}
                </div>
              </div>

              {/* Today marker */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 z-10 pointer-events-none"
                style={{ left: todayOffsetPx + 100 }}
              >
                <div className="absolute -top-0 left-1/2 -translate-x-1/2 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-b">
                  اليوم
                </div>
              </div>

              {/* Intervention rows by type */}
              <div className="relative" style={{ paddingBottom: 16 }}>
                {Object.entries(rowsByType).map(([type, items]) => {
                  const typeColor = TYPE_COLORS[type] || '#6b7280'
                  const typeLabel = TYPE_LABELS[type] || type
                  const typeIcon = TYPE_ICONS[type] || '📋'

                  return (
                    <div key={type} className="border-b border-slate-100 last:border-b-0">
                      {/* Type section header */}
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50/50 sticky right-0 z-10">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: typeColor }} />
                        <span className="text-xs font-bold text-slate-700">
                          {typeIcon} {typeLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded-full border border-slate-200">
                          {items.length} تدخل
                        </span>
                      </div>

                      {/* Intervention bars */}
                      <div className="relative px-4 py-2" style={{ minHeight: 44 }}>
                        <div style={{ width: totalWidth + 100, position: 'relative', height: items.length > 0 ? Math.ceil(items.length / 1) * 40 : 40 }}>
                          {items.map((inv, idx) => {
                            const statusColor = STATUT_COLORS[inv.statut] || '#6b7280'
                            const isHovered = selectedIntervention?.id === inv.id

                            return (
                              <motion.div
                                key={inv.id}
                                initial={{ opacity: 0, scaleX: 0 }}
                                animate={{ opacity: 1, scaleX: 1 }}
                                transition={{ delay: idx * 0.02, duration: 0.3 }}
                                className="absolute cursor-pointer group"
                                style={{
                                  left: inv.leftPx + 100,
                                  top: idx * 40,
                                  width: inv.widthPx,
                                  height: 32,
                                }}
                                onClick={() => setSelectedIntervention(isHovered ? null : inv)}
                                whileHover={{ y: -2 }}
                              >
                                {/* Bar */}
                                <div
                                  className={`w-full h-full rounded-lg flex items-center gap-1.5 px-2 border transition-all ${
                                    isHovered ? 'shadow-lg ring-2 ring-offset-1' : 'shadow-sm hover:shadow-md'
                                  }`}
                                  style={{
                                    backgroundColor: typeColor + '18',
                                    borderColor: isHovered ? typeColor : typeColor + '40',
                                  }}
                                >
                                  {/* Status dot */}
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: statusColor }}
                                  />
                                  {/* Label */}
                                  <span className="text-[10px] font-bold truncate text-slate-700">
                                    {inv.reference}
                                  </span>
                                  {zoom !== 'month' && (
                                    <span className="text-[9px] text-slate-400 truncate hidden sm:inline">
                                      {inv.quartier}
                                    </span>
                                  )}
                                </div>
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Scroll hint */}
          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between">
            <span className="text-[10px] text-slate-400">
              ← اسحب للتمرير →  •  {interventions.length} تدخل  •  {groupedInterventions.length} شهر
            </span>
            <div className="flex items-center gap-2">
              {groupedInterventions.slice(0, 6).map(([key]) => {
                const [year, month] = key.split('-')
                const d = new Date(parseInt(year), parseInt(month) - 1, 1)
                return (
                  <button
                    key={key}
                    onClick={() => { scrollToDateRef.current = d; setScrollKey(k => k + 1) }}
                    className="text-[10px] px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-all"
                  >
                    {MONTH_NAMES_AR[parseInt(month) - 1]} {year}
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Selected Intervention Detail Panel */}
      <AnimatePresence>
        {selectedIntervention && (
          <motion.div
            initial={{ opacity: 0, y: 20, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: 20, height: 0 }}
            className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100" style={{ backgroundColor: (TYPE_COLORS[selectedIntervention.type] || '#6b7280') + '08' }}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: TYPE_COLORS[selectedIntervention.type] || '#6b7280' }} />
                <span className="text-sm font-bold text-slate-700">
                  {TYPE_ICONS[selectedIntervention.type]} {TYPE_LABELS[selectedIntervention.type] || selectedIntervention.type}
                </span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs font-mono text-slate-500">{selectedIntervention.reference}</span>
              </div>
              <button
                onClick={() => setSelectedIntervention(null)}
                className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            {/* Details */}
            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">📅 التاريخ</span>
                  <p className="text-sm text-slate-700 font-semibold mt-0.5">{formatDateAr(selectedIntervention.date)}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">📊 الحالة</span>
                  <p className="mt-0.5">
                    <span
                      className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{
                        backgroundColor: (STATUT_COLORS[selectedIntervention.statut] || '#6b7280') + '15',
                        color: STATUT_COLORS[selectedIntervention.statut] || '#6b7280',
                      }}
                    >
                      {STATUT_LABELS[selectedIntervention.statut] || selectedIntervention.statut}
                    </span>
                  </p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">🏙️ الجماعة</span>
                  <p className="text-sm text-slate-700 font-semibold mt-0.5">{COMMUNE_LABELS[selectedIntervention.commune] || selectedIntervention.commune}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">📍 الحي</span>
                  <p className="text-sm text-slate-700 font-semibold mt-0.5">{selectedIntervention.quartier}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">👤 العون</span>
                  <p className="text-sm text-slate-700 font-semibold mt-0.5">{selectedIntervention.agentNom}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">📍 العنوان</span>
                  <p className="text-sm text-slate-700 font-semibold mt-0.5">{selectedIntervention.adresse || '—'}</p>
                </div>
                {(selectedIntervention.heureDebut || selectedIntervention.heureFin) && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold">⏰ الوقت</span>
                    <p className="text-sm text-slate-700 font-semibold mt-0.5">
                      {selectedIntervention.heureDebut || '—'} - {selectedIntervention.heureFin || '—'}
                    </p>
                  </div>
                )}
                {selectedIntervention.superficie && (
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold">📐 المساحة</span>
                    <p className="text-sm text-slate-700 font-semibold mt-0.5">{selectedIntervention.superficie} م²</p>
                  </div>
                )}
              </div>
              {selectedIntervention.observations && (
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-bold">📝 الملاحظات</span>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{selectedIntervention.observations}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
