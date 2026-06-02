'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type CommuneType } from '@/lib/store'
import { toast } from 'sonner'

// ===== TYPE DEFINITIONS =====
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
}

// ===== CONSTANTS =====
const ARABIC_MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

const ARABIC_DAYS = [
  'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
]

const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
}

const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444',
  DESINSECTISATION: '#f59e0b',
  DESINFECTION: '#10b981',
}

const TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀',
  DESINSECTISATION: '🦟',
  DESINFECTION: '🧴',
}

const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة',
  EN_COURS: 'جارية',
  TERMINEE: 'منجزة',
  ANNULEE: 'ملغاة',
}

const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6',
  EN_COURS: '#f59e0b',
  TERMINEE: '#10b981',
  ANNULEE: '#6b7280',
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

// ===== HELPER FUNCTIONS =====
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

function isToday(year: number, month: number, day: number): boolean {
  const today = new Date()
  return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day
}

function formatDateString(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

// ===== ANIMATION VARIANTS =====
const calendarVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? -300 : 300,
    opacity: 0,
  }),
}

const dayPopupVariants = {
  initial: { opacity: 0, scale: 0.95, y: 10 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15 } },
}

const statCardVariants = {
  initial: { opacity: 0, y: 10 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3 },
  }),
}

// ===== MAIN COMPONENT =====
export default function CalendarView() {
  const { user, selectedCommune, selectedYear } = useAppStore()
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'
  const effectiveCommune = canSeeAllCommunes ? selectedCommune : (user?.commune || 'ALL')

  // Calendar state
  const yearFromStore = parseInt(selectedYear) || new Date().getFullYear()
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [viewYear, setViewYear] = useState(yearFromStore)
  const [direction, setDirection] = useState(0)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [communeFilter, setCommuneFilter] = useState<CommuneType | 'ALL'>(effectiveCommune as CommuneType | 'ALL')

  // Sync year with store
  useEffect(() => {
    const y = parseInt(selectedYear) || new Date().getFullYear()
    setViewYear(y)
  }, [selectedYear])

  // Sync commune filter with store
  useEffect(() => {
    setCommuneFilter(effectiveCommune as CommuneType | 'ALL')
  }, [effectiveCommune])

  // Fetch interventions for the current month
  const fetchInterventions = useCallback(async () => {
    setIsLoading(true)
    try {
      const monthStr = String(viewMonth + 1).padStart(2, '0')
      const from = `${viewYear}-${monthStr}-01`
      const lastDay = getDaysInMonth(viewYear, viewMonth)
      const to = `${viewYear}-${monthStr}-${String(lastDay).padStart(2, '0')}`

      const params = new URLSearchParams({ from, to, limit: '500' })
      if (communeFilter && communeFilter !== 'ALL') {
        params.set('commune', communeFilter)
      }

      const res = await fetch(`/api/interventions?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setInterventions(data.interventions || [])
    } catch {
      toast.error('فشل في تحميل التدخلات')
    }
    setIsLoading(false)
  }, [viewYear, viewMonth, communeFilter])

  useEffect(() => {
    fetchInterventions()
  }, [fetchInterventions])

  // Group interventions by day
  const interventionsByDay = useMemo(() => {
    const map: Record<number, Intervention[]> = {}
    interventions.forEach((inv) => {
      const d = new Date(inv.date)
      const day = d.getDate()
      if (!map[day]) map[day] = []
      map[day].push(inv)
    })
    return map
  }, [interventions])

  // Month statistics
  const monthStats = useMemo(() => {
    const total = interventions.length
    const byType: Record<string, number> = {
      DERATISATION: 0,
      DESINSECTISATION: 0,
      DESINFECTION: 0,
    }
    const byStatut: Record<string, number> = {
      PLANIFIEE: 0,
      EN_COURS: 0,
      TERMINEE: 0,
      ANNULEE: 0,
    }
    interventions.forEach((inv) => {
      if (byType[inv.type] !== undefined) byType[inv.type]++
      if (byStatut[inv.statut] !== undefined) byStatut[inv.statut]++
    })
    return { total, byType, byStatut }
  }, [interventions])

  // Selected day interventions
  const selectedDayInterventions = useMemo(() => {
    if (selectedDay === null) return []
    return interventionsByDay[selectedDay] || []
  }, [selectedDay, interventionsByDay])

  // Calendar grid data
  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth)
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth)
    const prevMonthDays = getDaysInMonth(viewYear, viewMonth - 1)

    const days: { day: number; isCurrentMonth: boolean; month: number; year: number }[] = []

    // Previous month trailing days
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      days.push({ day: d, isCurrentMonth: false, month: m, year: y })
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      days.push({ day: d, isCurrentMonth: true, month: viewMonth, year: viewYear })
    }

    // Next month leading days
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      days.push({ day: d, isCurrentMonth: false, month: m, year: y })
    }

    return days
  }, [viewYear, viewMonth])

  // Navigation handlers
  const goToPrevMonth = () => {
    setDirection(-1)
    setSelectedDay(null)
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear(viewYear - 1)
    } else {
      setViewMonth(viewMonth - 1)
    }
  }

  const goToNextMonth = () => {
    setDirection(1)
    setSelectedDay(null)
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear(viewYear + 1)
    } else {
      setViewMonth(viewMonth + 1)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setDirection(0)
    setSelectedDay(today.getDate())
    setViewMonth(today.getMonth())
    setViewYear(today.getFullYear())
  }

  // Get dots for a day (unique types)
  const getDotsForDay = (day: number): string[] => {
    const dayInterventions = interventionsByDay[day]
    if (!dayInterventions) return []
    const types = new Set(dayInterventions.map((i) => i.type))
    return Array.from(types)
  }

  const today = new Date()

  return (
    <div className="p-4 lg:p-6 space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>📅</span> التقويم
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            عرض التدخلات حسب الأشهر والأيام — {ARABIC_MONTHS[viewMonth]} {viewYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Commune Filter */}
          {canSeeAllCommunes && (
            <div className="flex items-center gap-1.5 bg-white rounded-xl border border-slate-200 p-1">
              <button
                onClick={() => setCommuneFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  communeFilter === 'ALL'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                الكل
              </button>
              {Object.entries(COMMUNE_LABELS).map(([key, _label]) => (
                <button
                  key={key}
                  onClick={() => setCommuneFilter(key as CommuneType)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    communeFilter === key
                      ? 'text-white shadow-sm'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                  style={communeFilter === key ? { backgroundColor: COMMUNE_COLORS[key] } : {}}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: communeFilter === key ? 'white' : COMMUNE_COLORS[key] }}
                  />
                  {key}
                </button>
              ))}
            </div>
          )}
          {/* Today button */}
          <motion.button
            onClick={goToToday}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-emerald-200 flex items-center gap-1.5"
          >
            <span>📍</span> اليوم
          </motion.button>
        </div>
      </div>

      {/* Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <motion.div
          custom={0}
          variants={statCardVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">إجمالي الشهر</p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{monthStats.total}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">📊</div>
          </div>
        </motion.div>
        <motion.div
          custom={1}
          variants={statCardVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">مكافحة القوارض</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: TYPE_COLORS.DERATISATION }}>
                {monthStats.byType.DERATISATION}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: TYPE_COLORS.DERATISATION + '15' }}>
              🐀
            </div>
          </div>
        </motion.div>
        <motion.div
          custom={2}
          variants={statCardVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">مكافحة الحشرات</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: TYPE_COLORS.DESINSECTISATION }}>
                {monthStats.byType.DESINSECTISATION}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: TYPE_COLORS.DESINSECTISATION + '15' }}>
              🦟
            </div>
          </div>
        </motion.div>
        <motion.div
          custom={3}
          variants={statCardVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">التطهير والتعقيم</p>
              <p className="text-2xl font-extrabold mt-1" style={{ color: TYPE_COLORS.DESINFECTION }}>
                {monthStats.byType.DESINFECTION}
              </p>
            </div>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: TYPE_COLORS.DESINFECTION + '15' }}>
              🧴
            </div>
          </div>
        </motion.div>
        <motion.div
          custom={4}
          variants={statCardVariants}
          initial="initial"
          animate="animate"
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">المنجزة</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{monthStats.byStatut.TERMINEE}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">✅</div>
          </div>
        </motion.div>
      </div>

      {/* Type Distribution Bar */}
      {monthStats.total > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">التوزيع حسب نوع التدخل</h3>
          <div className="flex items-center gap-1 h-6 rounded-xl overflow-hidden">
            {Object.entries(monthStats.byType).map(([type, count]) => {
              const pct = monthStats.total > 0 ? (count / monthStats.total) * 100 : 0
              return (
                <div
                  key={type}
                  className="h-full transition-all duration-500 relative group cursor-pointer"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: TYPE_COLORS[type],
                    minWidth: pct > 0 ? '6px' : '0',
                  }}
                  title={`${TYPE_LABELS[type]}: ${count} (${Math.round(pct)}%)`}
                >
                  {pct > 15 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white truncate px-1">
                      {TYPE_ICONS[type]} {count}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-5 mt-2.5">
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
                <span className="text-[11px] text-slate-500">{label}</span>
                <span className="text-[11px] font-bold text-slate-700">({monthStats.byType[type]})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Month Navigation */}
        <div className="bg-gradient-to-l from-emerald-700 via-teal-600 to-emerald-800 text-white px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={goToNextMonth}
              className="p-2 hover:bg-white/15 rounded-xl transition-all active:scale-95"
              title="الشهر التالي"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </button>

            <div className="text-center">
              <motion.h3
                key={`${viewYear}-${viewMonth}`}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="text-xl font-extrabold"
              >
                {ARABIC_MONTHS[viewMonth]} {viewYear}
              </motion.h3>
              <p className="text-emerald-100/70 text-xs mt-0.5">
                {monthStats.total} تدخل هذا الشهر
              </p>
            </div>

            <button
              onClick={goToPrevMonth}
              className="p-2 hover:bg-white/15 rounded-xl transition-all active:scale-95"
              title="الشهر السابق"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
          {ARABIC_DAYS.map((day, i) => (
            <div
              key={day}
              className={`py-2.5 text-center text-xs font-bold ${
                i === 5 ? 'text-amber-600' : i === 0 ? 'text-red-500' : 'text-slate-500'
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={`${viewYear}-${viewMonth}`}
              custom={direction}
              variants={calendarVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
              className="grid grid-cols-7"
            >
              {calendarDays.map((dayInfo, idx) => {
                const dots = dayInfo.isCurrentMonth ? getDotsForDay(dayInfo.day) : []
                const isTodayCell = dayInfo.isCurrentMonth && isToday(dayInfo.year, dayInfo.month, dayInfo.day)
                const isSelected = dayInfo.isCurrentMonth && selectedDay === dayInfo.day
                const hasInterventions = dots.length > 0
                const dayOfWeek = idx % 7
                const isFriday = dayOfWeek === 5
                const isSunday = dayOfWeek === 0

                return (
                  <motion.button
                    key={`${dayInfo.year}-${dayInfo.month}-${dayInfo.day}`}
                    onClick={() => {
                      if (dayInfo.isCurrentMonth) {
                        setSelectedDay(selectedDay === dayInfo.day ? null : dayInfo.day)
                      }
                    }}
                    whileHover={dayInfo.isCurrentMonth ? { scale: 1.05 } : {}}
                    whileTap={dayInfo.isCurrentMonth ? { scale: 0.95 } : {}}
                    className={`relative min-h-[72px] sm:min-h-[90px] p-1.5 sm:p-2 border-b border-l border-slate-50 transition-colors flex flex-col items-center gap-1 ${
                      !dayInfo.isCurrentMonth
                        ? 'bg-slate-50/50'
                        : isSelected
                          ? 'bg-emerald-50'
                          : isTodayCell
                            ? 'bg-emerald-50/40'
                            : hasInterventions
                              ? 'hover:bg-emerald-50/30 cursor-pointer'
                              : 'hover:bg-slate-50/50 cursor-pointer'
                    }`}
                    disabled={!dayInfo.isCurrentMonth}
                  >
                    {/* Date number */}
                    <span
                      className={`text-sm sm:text-base font-bold leading-none ${
                        !dayInfo.isCurrentMonth
                          ? 'text-slate-300'
                          : isSelected
                            ? 'bg-emerald-600 text-white w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center'
                            : isTodayCell
                              ? 'ring-2 ring-emerald-500 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-emerald-700'
                              : isFriday
                                ? 'text-amber-600'
                                : isSunday
                                  ? 'text-red-400'
                                  : 'text-slate-700'
                      }`}
                    >
                      {dayInfo.day}
                    </span>

                    {/* Intervention dots */}
                    {dayInfo.isCurrentMonth && hasInterventions && (
                      <div className="flex items-center gap-0.5 flex-wrap justify-center mt-0.5">
                        {dots.map((type) => (
                          <div
                            key={type}
                            className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm"
                            style={{ backgroundColor: TYPE_COLORS[type] }}
                            title={TYPE_LABELS[type]}
                          />
                        ))}
                      </div>
                    )}

                    {/* Intervention count badge */}
                    {dayInfo.isCurrentMonth && hasInterventions && (
                      <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold mt-0.5">
                        {interventionsByDay[dayInfo.day]?.length || 0}
                      </span>
                    )}
                  </motion.button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <span className="text-xs font-bold text-slate-400">دليل الألوان:</span>
          {Object.entries(TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS[type] }} />
              <span className="text-xs text-slate-600">{TYPE_ICONS[type]} {label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full ring-2 ring-emerald-500 bg-white" />
            <span className="text-xs text-slate-600">اليوم</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-600" />
            <span className="text-xs text-slate-600">المحدد</span>
          </div>
        </div>
      </div>

      {/* Selected Day Interventions Panel */}
      <AnimatePresence>
        {selectedDay !== null && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
          >
            {/* Panel Header */}
            <div className="bg-gradient-to-l from-slate-50 to-white px-5 py-4 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                    <span className="text-lg">📋</span>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800">
                      تدخلات يوم {selectedDay} {ARABIC_MONTHS[viewMonth]} {viewYear}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {selectedDayInterventions.length} تدخل
                      {isToday(viewYear, viewMonth, selectedDay) && (
                        <span className="text-emerald-600 font-bold mr-1">— اليوم</span>
                      )}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Interventions List */}
            {selectedDayInterventions.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-4xl mb-3">📭</div>
                <h4 className="text-base font-bold text-slate-600 mb-1">لا توجد تدخلات</h4>
                <p className="text-sm text-slate-400">لم يتم تسجيل أي تدخل في هذا اليوم</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
                {selectedDayInterventions.map((inv, i) => (
                  <motion.div
                    key={inv.id}
                    variants={dayPopupVariants}
                    initial="initial"
                    animate="animate"
                    transition={{ delay: i * 0.04 }}
                    className="p-4 hover:bg-emerald-50/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Type icon */}
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: TYPE_COLORS[inv.type] + '15' }}
                      >
                        {TYPE_ICONS[inv.type] || '📋'}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Type badge */}
                          <span
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white"
                            style={{ backgroundColor: TYPE_COLORS[inv.type] }}
                          >
                            {TYPE_ICONS[inv.type]} {TYPE_LABELS[inv.type]}
                          </span>
                          {/* Statut badge */}
                          <span
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white"
                            style={{ backgroundColor: STATUT_COLORS[inv.statut] }}
                          >
                            {STATUT_LABELS[inv.statut]}
                          </span>
                          {/* Commune badge */}
                          {inv.commune && (
                            <span
                              className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white"
                              style={{ backgroundColor: COMMUNE_COLORS[inv.commune] || '#64748b' }}
                            >
                              {inv.commune}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            {inv.quartier}
                          </span>
                          <span className="flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            {inv.agentNom}
                          </span>
                        </div>

                        {/* Reference */}
                        <span className="text-[10px] text-slate-300 font-mono" dir="ltr">
                          {inv.reference}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[60] flex items-center justify-center pointer-events-auto"
          >
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-500">جاري تحميل التقويم...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
