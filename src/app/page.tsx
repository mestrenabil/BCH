'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { useAppStore, type ViewType, type InterventionType } from '@/lib/store'
import { toast } from 'sonner'

// ===== TYPE DEFINITIONS =====
interface Intervention {
  id: string; type: string; date: string; quartier: string; adresse: string
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
  createdAt: string; updatedAt: string
}

interface Statistics {
  total: number; byType: Record<string, number>; byStatut: Record<string, number>
  byQuartier: { quartier: string; count: number }[]
  monthly: Record<string, Record<string, number>>
  recent: Intervention[]
  quartiers: { id: string; nom: string; latitude: number; longitude: number }[]
}

interface Quartier { id: string; nom: string; latitude: number; longitude: number }

// ===== CONSTANTS =====
const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم',
}
const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة', EN_COURS: 'جارية', TERMINEE: 'منجزة', ANNULEE: 'ملغاة',
}
const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981',
}
const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6', EN_COURS: '#f59e0b', TERMINEE: '#10b981', ANNULEE: '#6b7280',
}
const TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴',
}
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// ===== ANIMATION VARIANTS =====
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
}

const cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
}

// ===== MAIN PAGE =====
export default function HomePage() {
  const {
    currentView, setCurrentView, selectedType, setSelectedType,
    selectedYear, setSelectedYear, searchQuery, setSearchQuery,
    isFormOpen, setIsFormOpen, editingInterventionId, setEditingInterventionId,
    sidebarOpen, setSidebarOpen,
  } = useAppStore()

  const [stats, setStats] = useState<Statistics | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionsTotal, setInterventionsTotal] = useState(0)
  const [interventionsPage, setInterventionsPage] = useState(1)
  const [quartiers, setQuartiers] = useState<Quartier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSeeded, setIsSeeded] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

  const fetchStats = useCallback(async () => {
    try {
      const url = selectedYear ? `/api/statistics?year=${selectedYear}` : '/api/statistics'
      const res = await fetch(url)
      const data = await res.json()
      setStats(data)
      setQuartiers(data.quartiers || [])
    } catch (err) { console.error('Failed to fetch stats:', err) }
  }, [selectedYear])

  const fetchInterventions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: interventionsPage.toString(), limit: '50',
        ...(selectedType !== 'ALL' ? { type: selectedType } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedYear ? { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` } : {}),
      })
      const res = await fetch(`/api/interventions?${params}`)
      const data = await res.json()
      setInterventions(data.interventions || [])
      setInterventionsTotal(data.total || 0)
    } catch (err) { console.error('Failed to fetch interventions:', err) }
  }, [interventionsPage, selectedType, searchQuery, selectedYear])

  const seedDatabase = useCallback(async () => {
    if (isSeeding || isSeeded) return
    setIsSeeding(true)
    try {
      await fetch('/api/seed', { method: 'POST' })
      setIsSeeded(true)
      const statsRes = await fetch('/api/statistics')
      const statsData = await statsRes.json()
      setStats(statsData)
      setQuartiers(statsData.quartiers || [])
      await fetchInterventions()
    } catch (err) { console.error('Seed failed:', err) }
    finally { setIsSeeding(false) }
  }, [isSeeding, isSeeded, fetchInterventions])

  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        const totalRes = await fetch('/api/statistics')
        const totalData = await totalRes.json()
        if (totalData.total === 0) await seedDatabase()
        const yearRes = await fetch(`/api/statistics?year=2025`)
        const yearData = await yearRes.json()
        setStats(yearData)
        setQuartiers(yearData.quartiers || [])
        await fetchInterventions()
      } catch (err) { console.error('Init failed:', err) }
      setIsLoading(false)
    }
    init()
  }, [])

  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) { fetchStats(); fetchInterventions() }
  }, [selectedYear, selectedType, fetchStats, fetchInterventions])
  useEffect(() => { if (!isLoading) initialLoadDone.current = true }, [isLoading])

  const navItems: { id: ViewType; label: string; icon: string; desc: string }[] = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: '📊', desc: 'نظرة شاملة' },
    { id: 'map', label: 'الخريطة', icon: '🗺️', desc: 'SIG تفاعلي' },
    { id: 'interventions', label: 'التدخلات', icon: '📋', desc: 'إدارة العمليات' },
    { id: 'reports', label: 'التقارير', icon: '📈', desc: 'إحصائيات مفصلة' },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30" dir="rtl">
      {/* Header */}
      <header className="bg-gradient-to-l from-emerald-800 via-teal-700 to-emerald-900 text-white shadow-xl sticky top-0 z-50 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl hover:bg-white/20 transition-all active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="flex items-center gap-3">
                <motion.div
                  className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center text-2xl border border-white/20 shadow-lg"
                  whileHover={{ scale: 1.05, rotate: 5 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                >
                  🏛️
                </motion.div>
                <div>
                  <h1 className="text-lg font-bold leading-tight tracking-tight">نظام 3D — مكتب النظافة المشترك</h1>
                  <p className="text-[11px] text-emerald-100/80 font-medium">جماعة بوقنادل سلا ⚡ الدراقلة • مكافحة الحشرات • التطهير</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">📅 السنة:</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value="" className="text-black">الكل</option>
                  <option value="2025" className="text-black">2025</option>
                  <option value="2024" className="text-black">2024</option>
                </select>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">🏷️ النوع:</span>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as InterventionType | 'ALL')}
                  className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value="ALL" className="text-black">الكل</option>
                  <option value="DERATISATION" className="text-black">مكافحة القوارض</option>
                  <option value="DESINSECTISATION" className="text-black">مكافحة الحشرات</option>
                  <option value="DESINFECTION" className="text-black">التطهير والتعقيم</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-72 bg-white/80 backdrop-blur-sm border-l border-slate-200/80 flex-col shadow-sm">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">نشط</span>
            </div>
          </div>
          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => (
              <motion.button key={item.id}
                onClick={() => setCurrentView(item.id)}
                whileHover={{ x: -4 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  currentView === item.id
                    ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
                    : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <div className="text-right">
                  <div>{item.label}</div>
                  <div className={`text-[10px] ${currentView === item.id ? 'text-emerald-100' : 'text-slate-400'}`}>{item.desc}</div>
                </div>
              </motion.button>
            ))}
          </nav>
          <div className="p-4 border-t border-slate-100">
            <motion.button
              onClick={() => setIsFormOpen(true)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              <span>إضافة تدخل جديد</span>
            </motion.button>
          </div>
          {stats && (
            <div className="p-4 border-t border-slate-100 space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ملخص سريع</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-600">{stats.total}</div>
                  <div className="text-[10px] text-slate-500">الإجمالي</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-600">{stats.byStatut.TERMINEE || 0}</div>
                  <div className="text-[10px] text-emerald-600">منجزة</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-amber-600">{stats.byStatut.EN_COURS || 0}</div>
                  <div className="text-[10px] text-amber-600">جارية</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.byStatut.PLANIFIEE || 0}</div>
                  <div className="text-[10px] text-blue-600">مبرمجة</div>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Sidebar Mobile */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="lg:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
              <motion.aside initial={{ x: 300 }} animate={{ x: 0 }} exit={{ x: 300 }}
                transition={{ type: 'spring', damping: 25 }}
                className="fixed right-0 top-0 bottom-0 w-72 bg-white shadow-2xl z-50 flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-emerald-700">القائمة</h2>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
                </div>
                <nav className="flex-1 p-3 space-y-1">
                  {navItems.map((item) => (
                    <button key={item.id}
                      onClick={() => { setCurrentView(item.id); setSidebarOpen(false) }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        currentView === item.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'
                      }`}>
                      <span className="text-xl">{item.icon}</span><span>{item.label}</span>
                    </button>
                  ))}
                </nav>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {isLoading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex items-center justify-center h-64">
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-slate-500 font-medium">جاري تحميل البيانات...</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={currentView} variants={pageVariants} initial="initial" animate="animate" exit="exit">
                {currentView === 'dashboard' && <DashboardView stats={stats} onNavigate={setCurrentView} />}
                {currentView === 'map' && <MapView interventions={interventions} quartiers={quartiers} />}
                {currentView === 'interventions' && (
                  <InterventionsView interventions={interventions} total={interventionsTotal}
                    page={interventionsPage} setPage={setInterventionsPage}
                    onEdit={setEditingInterventionId} onRefresh={fetchInterventions} />
                )}
                {currentView === 'reports' && <ReportsView stats={stats} />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Form Dialog */}
      <AnimatePresence>
        {isFormOpen && (
          <InterventionFormDialog interventionId={editingInterventionId} quartiers={quartiers}
            onClose={() => { setIsFormOpen(false); setEditingInterventionId(null) }}
            onSave={async () => { await fetchStats(); await fetchInterventions() }} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200 py-3 px-4 mt-auto">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-xs text-slate-500">© 2025 مكتب النظافة المشترك — جماعة بوقنادل سلا</p>
          <p className="text-xs text-emerald-600 font-medium">نظام تدبير عمليات 3D ⚡ الدراقلة • مكافحة الحشرات • التطهير</p>
        </div>
      </footer>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 shadow-lg">
        <div className="flex items-center justify-around py-1.5 px-2">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setCurrentView(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all ${
                currentView === item.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'
              }`}>
              <span className="text-lg">{item.icon}</span>
              <span className="text-[9px] font-semibold">{item.label}</span>
            </button>
          ))}
          <motion.button onClick={() => setIsFormOpen(true)} whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5 px-2 py-1.5">
            <span className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center text-lg shadow-lg shadow-emerald-200">+</span>
            <span className="text-[9px] font-semibold text-emerald-600">إضافة</span>
          </motion.button>
        </div>
      </nav>
    </div>
  )
}

// ===== DASHBOARD =====
function DashboardView({ stats, onNavigate }: { stats: Statistics | null; onNavigate: (v: ViewType) => void }) {
  if (!stats) return null
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
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-slate-800">لوحة القيادة</h2>
        <p className="text-slate-500 text-sm mt-1">نظرة عامة على عمليات 3D — جماعة بوقنادل سلا</p>
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
              className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold hover:underline">عرض الكل ←</button>
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

// ===== MAP VIEW =====
function MapView({ interventions, quartiers }: { interventions: Intervention[]; quartiers: Quartier[] }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{ interventions: Intervention[]; quartiers: Quartier[] }> | null>(null)

  useEffect(() => {
    import('./map-component').then((mod) => {
      setMapComponent(() => mod.default)
      setMapLoaded(true)
    })
  }, [])

  const COMMUNE_COLORS: Record<string, string> = {
    'جماعة سلا': '#059669', 'جماعة سيدي أبي القنادل': '#7c3aed', 'جماعة عامر': '#d97706',
  }

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] pb-16 lg:pb-0 relative">
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
        className="absolute top-4 right-4 z-10 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 p-5 max-w-xs shadow-xl">
        <h3 className="font-bold text-slate-800 mb-1">الخريطة التفاعلية — SIG</h3>
        <p className="text-[11px] text-slate-400 mb-3">الحدود الترابية الرسمية — 🇲🇦 الجريدة الرسمية</p>
        {/* Commune Boundaries Legend */}
        <div className="space-y-1.5 mb-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">الحدود الترابية</p>
          {Object.entries(COMMUNE_COLORS).map(([name, color]) => (
            <div key={name} className="flex items-center gap-2 text-xs">
              <div className="w-4 h-4 rounded border-2 flex items-center justify-center" style={{ borderColor: color, backgroundColor: color + '20' }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
              </div>
              <span className="text-slate-600 font-medium">{name}</span>
              {name === 'جماعة سيدي أبي القنادل' && <span className="text-[9px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold">مقر المكتب</span>}
            </div>
          ))}
        </div>
        {/* Intervention Types */}
        <div className="space-y-2 border-t border-slate-100 pt-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">أنواع التدخلات</p>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: TYPE_COLORS[k] }} />
              <span className="text-slate-600">{v}</span>
              <span className="font-bold text-slate-800 mr-auto">{interventions.filter(i => i.type === k).length}</span>
            </div>
          ))}
          <div className="border-t border-slate-100 pt-2 mt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">المجموع</span>
              <span className="font-bold text-emerald-600">{interventions.length}</span>
            </div>
          </div>
        </div>
      </motion.div>
      {mapLoaded && MapComponent ? <MapComponent interventions={interventions} quartiers={quartiers} /> : (
        <div className="h-full flex items-center justify-center bg-slate-50">
          <div className="text-center space-y-4">
            <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-slate-500">جاري تحميل الخريطة...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== INTERVENTIONS VIEW =====
function InterventionsView({ interventions, total, page, setPage, onEdit, onRefresh }: {
  interventions: Intervention[]; total: number; page: number; setPage: (p: number) => void
  onEdit: (id: string) => void; onRefresh: () => void
}) {
  const [localSearch, setLocalSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState('ALL')

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/interventions/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      onRefresh()
      toast.success('تم حذف التدخل بنجاح')
    } catch (err) { console.error('Delete failed:', err); toast.error('حدث خطأ أثناء الحذف') }
  }

  const filteredInterventions = interventions.filter(i => filterStatut === 'ALL' || i.statut === filterStatut)

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة التدخلات</h2>
          <p className="text-slate-400 text-sm">{total} تدخل مسجل</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="بحث..." value={localSearch} onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
          </div>
          <select value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="ALL">كل الحالات</option>
            {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        {Object.entries(STATUT_LABELS).map(([k, v]) => {
          const count = interventions.filter(i => i.statut === k).length
          return (
            <button key={k} onClick={() => setFilterStatut(filterStatut === k ? 'ALL' : k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                filterStatut === k ? 'shadow-md ring-2 ring-offset-1' : 'bg-white border border-slate-100'
              }`}
              style={filterStatut === k ? { backgroundColor: STATUT_COLORS[k] + '15', color: STATUT_COLORS[k], ringColor: STATUT_COLORS[k] + '30' } : {}}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUT_COLORS[k] }} />
              {v}: {count}
            </button>
          )
        })}
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {filteredInterventions.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-16 text-slate-400">
              <p className="text-5xl mb-3">📋</p>
              <p className="font-medium">لا توجد تدخلات</p>
            </motion.div>
          ) : (
            filteredInterventions.map((intervention, i) => (
              <motion.div key={intervention.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-lg hover:border-emerald-100 transition-all group">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: TYPE_COLORS[intervention.type] + '12' }}>
                      {TYPE_ICONS[intervention.type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 font-mono">{intervention.reference}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: STATUT_COLORS[intervention.statut] + '15', color: STATUT_COLORS[intervention.statut] }}>
                          {STATUT_LABELS[intervention.statut]}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: TYPE_COLORS[intervention.type] + '15', color: TYPE_COLORS[intervention.type] }}>
                          {TYPE_LABELS[intervention.type]}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{intervention.quartier} — {intervention.adresse}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">📅 {new Date(intervention.date).toLocaleDateString('ar-MA')}</span>
                        <span className="flex items-center gap-1">👤 {intervention.agentNom}</span>
                        {intervention.produitUtilise && <span className="flex items-center gap-1">💊 {intervention.produitUtilise}</span>}
                        {intervention.superficie && <span className="flex items-center gap-1">📐 {intervention.superficie}</span>}
                      </div>
                      {intervention.observations && (
                        <p className="text-xs text-amber-600/70 mt-1 bg-amber-50 px-2 py-1 rounded-lg inline-block">💬 {intervention.observations}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => onEdit(intervention.id)}
                      className="px-3 py-2 text-xs rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-600 font-medium transition-colors">
                      ✏️ تعديل
                    </motion.button>
                    {deleteConfirm === intervention.id ? (
                      <div className="flex gap-1">
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleDelete(intervention.id)}
                          className="px-3 py-2 text-xs rounded-xl bg-red-500 text-white font-medium">تأكيد</motion.button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-2 text-xs rounded-xl bg-slate-50 font-medium">إلغاء</button>
                      </div>
                    ) : (
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => setDeleteConfirm(intervention.id)}
                        className="px-3 py-2 text-xs rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-600 font-medium transition-colors">
                        🗑️
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {total > 50 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50 hover:bg-emerald-50 transition-colors">السابق</button>
          <span className="text-sm text-slate-500">صفحة {page} من {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50 hover:bg-emerald-50 transition-colors">التالي</button>
        </div>
      )}
    </div>
  )
}

// ===== REPORTS VIEW =====
function ReportsView({ stats }: { stats: Statistics | null }) {
  if (!stats) return null

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
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-slate-800">الإحصائيات والتقارير</h2>
        <p className="text-slate-400 text-sm mt-1">تحليل مفصل لبيانات التدخلات</p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Distribution - Pie */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm">
          <h3 className="font-bold text-slate-800 mb-1">توزيع حسب النوع</h3>
          <p className="text-xs text-slate-400 mb-4">النسبة المئوية لكل نوع تدخل</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={typePieData} cx="50%" cy="50%" outerRadius={90} innerRadius={55}
                  paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: '#94a3b8' }}>
                  {typePieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              </PieChart>
            </ResponsiveContainer>
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
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.monthly).sort(([a], [b]) => a.localeCompare(b)).map(([month, data], i) => {
                const dr = data.DERATISATION || 0; const di = data.DESINSECTISATION || 0; const df = data.DESINFECTION || 0; const total = dr + di + df
                const monthNum = parseInt(month.split('-')[1]) - 1
                return (
                  <tr key={month} className={`border-b border-slate-50 hover:bg-emerald-50/30 transition-colors ${i % 2 ? 'bg-slate-25' : ''}`}>
                    <td className="py-2.5 px-4 font-medium text-slate-700">{MONTH_NAMES_AR[monthNum]} {month.split('-')[0]}</td>
                    <td className="py-2.5 px-4 text-center"><span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-red-50 text-red-600">{dr}</span></td>
                    <td className="py-2.5 px-4 text-center"><span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-600">{di}</span></td>
                    <td className="py-2.5 px-4 text-center"><span className="inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-600">{df}</span></td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-800">{total}</td>
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

// ===== FORM DIALOG =====
function InterventionFormDialog({ interventionId, quartiers, onClose, onSave }: {
  interventionId: string | null; quartiers: Quartier[]
  onClose: () => void; onSave: () => Promise<void>
}) {
  const [formData, setFormData] = useState({
    type: 'DERATISATION', date: new Date().toISOString().split('T')[0],
    quartier: '', adresse: '', latitude: '34.052', longitude: '-6.735',
    statut: 'PLANIFIEE', description: '', agentNom: '', produitUtilise: '',
    quantite: '', superficie: '', nombrePrestations: '1', observations: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  useEffect(() => {
    if (interventionId) {
      setIsLoadingData(true)
      fetch(`/api/interventions/${interventionId}`).then(res => res.json()).then(data => {
        setFormData({
          type: data.type, date: new Date(data.date).toISOString().split('T')[0],
          quartier: data.quartier, adresse: data.adresse,
          latitude: data.latitude.toString(), longitude: data.longitude.toString(),
          statut: data.statut, description: data.description || '', agentNom: data.agentNom,
          produitUtilise: data.produitUtilise || '', quantite: data.quantite || '',
          superficie: data.superficie || '', nombrePrestations: data.nombrePrestations?.toString() || '1',
          observations: data.observations || '',
        })
      }).catch(console.error).finally(() => setIsLoadingData(false))
    }
  }, [interventionId])

  useEffect(() => {
    const q = quartiers.find(q => q.nom === formData.quartier)
    if (q) setFormData(prev => ({ ...prev, latitude: q.latitude.toString(), longitude: q.longitude.toString() }))
  }, [formData.quartier, quartiers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const url = interventionId ? `/api/interventions/${interventionId}` : '/api/interventions'
      const res = await fetch(url, { method: interventionId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) })
      if (res.ok) { toast.success(interventionId ? 'تم تحديث التدخل بنجاح' : 'تم إضافة التدخل بنجاح'); await onSave(); onClose() }
      else toast.error('حدث خطأ أثناء الحفظ')
    } catch { toast.error('حدث خطأ أثناء الحفظ') }
    finally { setIsSubmitting(false) }
  }

  const updateField = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }))

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-100">
        <div className="sticky top-0 bg-gradient-to-l from-emerald-700 to-teal-700 text-white p-5 flex items-center justify-between rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold">{interventionId ? 'تعديل التدخل' : 'إضافة تدخل جديد'}</h2>
            <p className="text-emerald-100/70 text-xs">أدخل معلومات التدخل</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">✕</button>
        </div>

        {isLoadingData ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">نوع التدخل *</label>
                <select value={formData.type} onChange={(e) => updateField('type', e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  <option value="DERATISATION">🐀 مكافحة القوارض</option>
                  <option value="DESINSECTISATION">🦟 مكافحة الحشرات</option>
                  <option value="DESINFECTION">🧴 التطهير والتعقيم</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">الحالة *</label>
                <select value={formData.statut} onChange={(e) => updateField('statut', e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  {Object.entries(STATUT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">التاريخ *</label>
                <input type="date" value={formData.date} onChange={(e) => updateField('date', e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم العون *</label>
                <input type="text" value={formData.agentNom} onChange={(e) => updateField('agentNom', e.target.value)} required
                  placeholder="اسم العون المكلف"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">الحي *</label>
                <select value={formData.quartier} onChange={(e) => updateField('quartier', e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  <option value="">اختر الحي</option>
                  {quartiers.map(q => <option key={q.id} value={q.nom}>{q.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">العنوان</label>
                <input type="text" value={formData.adresse} onChange={(e) => updateField('adresse', e.target.value)}
                  placeholder="رقم واسم الشارع"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">خط العرض</label>
                <input type="text" value={formData.latitude} onChange={(e) => updateField('latitude', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">خط الطول</label>
                <input type="text" value={formData.longitude} onChange={(e) => updateField('longitude', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">المادة المستعملة</label>
                <input type="text" value={formData.produitUtilise} onChange={(e) => updateField('produitUtilise', e.target.value)}
                  placeholder="اسم المادة"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">الكمية</label>
                <input type="text" value={formData.quantite} onChange={(e) => updateField('quantite', e.target.value)}
                  placeholder="الكمية والوحدة"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">المساحة</label>
                <input type="text" value={formData.superficie} onChange={(e) => updateField('superficie', e.target.value)}
                  placeholder="بالمتر المربع"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">الوصف</label>
              <textarea value={formData.description} onChange={(e) => updateField('description', e.target.value)}
                placeholder="وصف التدخل..." rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">ملاحظات</label>
              <textarea value={formData.observations} onChange={(e) => updateField('observations', e.target.value)}
                placeholder="ملاحظات إضافية..." rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 resize-none" />
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button type="submit" disabled={isSubmitting} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 disabled:opacity-50">
                {isSubmitting ? 'جاري الحفظ...' : interventionId ? 'تحديث التدخل' : 'إضافة التدخل'}
              </motion.button>
              <button type="button" onClick={onClose}
                className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">إلغاء</button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}
