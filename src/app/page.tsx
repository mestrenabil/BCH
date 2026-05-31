'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useAppStore, type ViewType, type InterventionType, type StatutType } from '@/lib/store'

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
  createdAt: string
  updatedAt: string
}

interface Statistics {
  total: number
  byType: Record<string, number>
  byStatut: Record<string, number>
  byQuartier: { quartier: string; count: number }[]
  monthly: Record<string, Record<string, number>>
  recent: Intervention[]
  quartiers: { id: string; nom: string; latitude: number; longitude: number }[]
}

interface Quartier {
  id: string
  nom: string
  latitude: number
  longitude: number
}

// ===== CONSTANTS =====
const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
}

const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة',
  EN_COURS: 'جارية',
  TERMINEE: 'منجزة',
  ANNULEE: 'ملغاة',
}

const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444',
  DESINSECTISATION: '#f59e0b',
  DESINFECTION: '#10b981',
}

const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6',
  EN_COURS: '#f59e0b',
  TERMINEE: '#10b981',
  ANNULEE: '#6b7280',
}

const TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀',
  DESINSECTISATION: '🦟',
  DESINFECTION: '🧴',
}

const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

// ===== MAIN PAGE COMPONENT =====
export default function HomePage() {
  const {
    currentView, setCurrentView,
    selectedType, setSelectedType,
    selectedYear, setSelectedYear,
    searchQuery, setSearchQuery,
    isFormOpen, setIsFormOpen,
    editingInterventionId, setEditingInterventionId,
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

  // Fetch statistics
  const fetchStats = useCallback(async () => {
    try {
      const url = selectedYear ? `/api/statistics?year=${selectedYear}` : '/api/statistics'
      const res = await fetch(url)
      const data = await res.json()
      setStats(data)
      setQuartiers(data.quartiers || [])
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    }
  }, [selectedYear])

  // Fetch interventions
  const fetchInterventions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: interventionsPage.toString(),
        limit: '50',
        ...(selectedType !== 'ALL' ? { type: selectedType } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedYear ? { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` } : {}),
      })
      const res = await fetch(`/api/interventions?${params}`)
      const data = await res.json()
      setInterventions(data.interventions || [])
      setInterventionsTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to fetch interventions:', err)
    }
  }, [interventionsPage, selectedType, searchQuery, selectedYear])

  // Seed database
  const seedDatabase = useCallback(async () => {
    if (isSeeding || isSeeded) return
    setIsSeeding(true)
    try {
      const res = await fetch('/api/seed', { method: 'POST' })
      const data = await res.json()
      console.log('Seed result:', data)
      setIsSeeded(true)
      // Fetch stats without year filter to get total
      const statsRes = await fetch('/api/statistics')
      const statsData = await statsRes.json()
      setStats(statsData)
      setQuartiers(statsData.quartiers || [])
      await fetchInterventions()
    } catch (err) {
      console.error('Seed failed:', err)
    } finally {
      setIsSeeding(false)
    }
  }, [isSeeding, isSeeded, fetchInterventions])

  // Initial data fetch
  useEffect(() => {
    const init = async () => {
      setIsLoading(true)
      try {
        // First check total without year filter (to decide if seeding is needed)
        const totalRes = await fetch('/api/statistics')
        const totalData = await totalRes.json()
        if (totalData.total === 0) {
          await seedDatabase()
        }
        // Now fetch with the selected year filter
        const yearRes = await fetch(`/api/statistics?year=2025`)
        const yearData = await yearRes.json()
        setStats(yearData)
        setQuartiers(yearData.quartiers || [])
        await fetchInterventions()
      } catch (err) {
        console.error('Init failed:', err)
      }
      setIsLoading(false)
    }
    init()
  }, [])

  // Refetch when filters change (after initial load)
  const initialLoadDone = React.useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) {
      fetchStats()
      fetchInterventions()
    }
  }, [selectedYear, selectedType, fetchStats, fetchInterventions])

  // Mark initial load as done
  useEffect(() => {
    if (!isLoading) {
      initialLoadDone.current = true
    }
  }, [isLoading])

  // Navigation items
  const navItems: { id: ViewType; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
    { id: 'map', label: 'الخريطة التفاعلية', icon: '🗺️' },
    { id: 'interventions', label: 'التدخلات', icon: '📋' },
    { id: 'reports', label: 'الإحصائيات والتقارير', icon: '📈' },
  ]

  return (
    <div className="min-h-screen flex flex-col" dir="rtl">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-xl">
                  🏛️
                </div>
                <div>
                  <h1 className="text-lg font-bold leading-tight">نظام 3D - مكتب النظافة المشترك</h1>
                  <p className="text-xs opacity-90">جماعة بوقنادل سلا - الدراقلة • مكافحة الحشرات • التطهير</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <span className="text-xs opacity-80">السنة:</span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
                >
                  <option value="" className="text-black">الكل</option>
                  <option value="2025" className="text-black">2025</option>
                  <option value="2024" className="text-black">2024</option>
                </select>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                <span className="text-xs opacity-80">النوع:</span>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value as InterventionType | 'ALL')}
                  className="bg-transparent text-sm font-semibold outline-none cursor-pointer"
                >
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

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex w-64 bg-card border-l border-border flex-col">
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                  currentView === item.id
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="p-4 border-t border-border">
            <button
              onClick={() => setIsFormOpen(true)}
              className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-md"
            >
              <span>➕</span>
              <span>إضافة تدخل جديد</span>
            </button>
          </div>
          {/* Quick Stats */}
          {stats && (
            <div className="p-4 border-t border-border space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase">ملخص سريع</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">إجمالي التدخلات</span>
                  <span className="font-bold text-primary">{stats.total}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">منجزة</span>
                  <span className="font-bold text-emerald-600">{stats.byStatut.TERMINEE || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">جارية</span>
                  <span className="font-bold text-amber-600">{stats.byStatut.EN_COURS || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">مبرمجة</span>
                  <span className="font-bold text-blue-600">{stats.byStatut.PLANIFIEE || 0}</span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Sidebar - Mobile */}
        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40">
            <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="fixed right-0 top-0 bottom-0 w-72 bg-card shadow-xl z-50 flex flex-col">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h2 className="font-bold text-primary">القائمة</h2>
                <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-accent rounded-lg">
                  ✕
                </button>
              </div>
              <nav className="flex-1 p-4 space-y-1">
                {navItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => { setCurrentView(item.id); setSidebarOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      currentView === item.id
                        ? 'bg-primary text-primary-foreground shadow-md'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
              <div className="p-4 border-t border-border">
                <button
                  onClick={() => { setIsFormOpen(true); setSidebarOpen(false) }}
                  className="w-full bg-primary text-primary-foreground px-4 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <span>➕</span>
                  <span>إضافة تدخل جديد</span>
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center space-y-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-muted-foreground">جاري تحميل البيانات...</p>
              </div>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && (
                <DashboardView stats={stats} onNavigate={setCurrentView} />
              )}
              {currentView === 'map' && (
                <MapView interventions={interventions} quartiers={quartiers} />
              )}
              {currentView === 'interventions' && (
                <InterventionsView
                  interventions={interventions}
                  total={interventionsTotal}
                  page={interventionsPage}
                  setPage={setInterventionsPage}
                  onEdit={setEditingInterventionId}
                  onRefresh={fetchInterventions}
                />
              )}
              {currentView === 'reports' && (
                <ReportsView stats={stats} />
              )}
            </>
          )}
        </main>
      </div>

      {/* Intervention Form Dialog */}
      {isFormOpen && (
        <InterventionFormDialog
          interventionId={editingInterventionId}
          quartiers={quartiers}
          onClose={() => { setIsFormOpen(false); setEditingInterventionId(null) }}
          onSave={async () => {
            await fetchStats()
            await fetchInterventions()
          }}
        />
      )}

      {/* Footer */}
      <footer className="bg-card border-t border-border py-3 px-4 mt-auto">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-muted-foreground">
          <p>© 2025 مكتب النظافة المشترك - جماعة بوقنادل سلا</p>
          <p>نظام تدبير عمليات 3D - الدراقلة • مكافحة الحشرات • التطهير</p>
        </div>
      </footer>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 safe-bottom">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${
                currentView === item.id ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setIsFormOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-lg text-primary"
          >
            <span className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-lg">+</span>
            <span className="text-[10px] font-medium">إضافة</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

// ===== DASHBOARD VIEW =====
function DashboardView({ stats, onNavigate }: { stats: Statistics | null; onNavigate: (v: ViewType) => void }) {
  if (!stats) return null

  const completionRate = stats.total > 0 ? Math.round(((stats.byStatut.TERMINEE || 0) / stats.total) * 100) : 0

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">لوحة القيادة</h2>
          <p className="text-muted-foreground text-sm">نظرة عامة على عمليات 3D لجماعة بوقنادل سلا</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="إجمالي التدخلات"
          value={stats.total}
          icon="📋"
          color="bg-gradient-to-br from-teal-500 to-teal-700"
        />
        <StatCard
          title="مكافحة القوارض"
          value={stats.byType.DERATISATION || 0}
          icon="🐀"
          color="bg-gradient-to-br from-red-500 to-red-700"
        />
        <StatCard
          title="مكافحة الحشرات"
          value={stats.byType.DESINSECTISATION || 0}
          icon="🦟"
          color="bg-gradient-to-br from-amber-500 to-amber-700"
        />
        <StatCard
          title="التطهير والتعقيم"
          value={stats.byType.DESINFECTION || 0}
          icon="🧴"
          color="bg-gradient-to-br from-emerald-500 to-emerald-700"
        />
      </div>

      {/* Progress and Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Completion Rate */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">نسبة الإنجاز</h3>
          <div className="flex items-center justify-center">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" className="text-muted" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke="oklch(0.55 0.18 160)" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${completionRate * 2.64} ${264 - completionRate * 2.64}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-primary">{completionRate}%</span>
                <span className="text-xs text-muted-foreground">منجزة</span>
              </div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">منجزة: {stats.byStatut.TERMINEE || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">جارية: {stats.byStatut.EN_COURS || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">مبرمجة: {stats.byStatut.PLANIFIEE || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-400" />
              <span className="text-muted-foreground">ملغاة: {stats.byStatut.ANNULEE || 0}</span>
            </div>
          </div>
        </div>

        {/* By Quartier */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">التدخلات حسب الأحياء</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.byQuartier.slice(0, 8).map((q) => (
              <div key={q.quartier} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground truncate flex-1">{q.quartier}</span>
                <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(100, (q.count / stats.total) * 300)}%` }}
                  />
                </div>
                <span className="text-sm font-semibold w-8 text-left">{q.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Interventions */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">آخر التدخلات</h3>
            <button onClick={() => onNavigate('interventions')} className="text-xs text-primary hover:underline">
              عرض الكل
            </button>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {stats.recent.slice(0, 6).map((intervention) => (
              <div key={intervention.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-accent/50 transition-colors">
                <span className="text-lg">{TYPE_ICONS[intervention.type]}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{intervention.quartier}</p>
                  <p className="text-xs text-muted-foreground">{intervention.reference}</p>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{
                    backgroundColor: STATUT_COLORS[intervention.statut] + '20',
                    color: STATUT_COLORS[intervention.statut],
                  }}
                >
                  {STATUT_LABELS[intervention.statut]}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Chart */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">التدخلات الشهرية</h3>
        <div className="h-64">
          <MonthlyChart data={stats.monthly} />
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigate('map')}
          className="bg-card rounded-xl border border-border p-6 text-right hover:shadow-md transition-all group"
        >
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">🗺️</span>
          <h3 className="font-semibold">الخريطة التفاعلية</h3>
          <p className="text-sm text-muted-foreground">استكشف مواقع التدخلات على الخريطة</p>
        </button>
        <button
          onClick={() => onNavigate('interventions')}
          className="bg-card rounded-xl border border-border p-6 text-right hover:shadow-md transition-all group"
        >
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">📋</span>
          <h3 className="font-semibold">إدارة التدخلات</h3>
          <p className="text-sm text-muted-foreground">إضافة وتعديل وحذف التدخلات</p>
        </button>
        <button
          onClick={() => onNavigate('reports')}
          className="bg-card rounded-xl border border-border p-6 text-right hover:shadow-md transition-all group"
        >
          <span className="text-3xl block mb-2 group-hover:scale-110 transition-transform">📈</span>
          <h3 className="font-semibold">التقارير والإحصائيات</h3>
          <p className="text-sm text-muted-foreground">تحليل مفصل لبيانات التدخلات</p>
        </button>
      </div>
    </div>
  )
}

// ===== STAT CARD =====
function StatCard({ title, value, icon, color }: { title: string; value: number; icon: string; color: string }) {
  return (
    <div className={`${color} text-white rounded-xl p-4 lg:p-6 shadow-lg`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl lg:text-3xl">{icon}</span>
      </div>
      <div className="text-2xl lg:text-3xl font-bold">{value}</div>
      <div className="text-sm opacity-90 mt-1">{title}</div>
    </div>
  )
}

// ===== MONTHLY CHART =====
function MonthlyChart({ data }: { data: Record<string, Record<string, number>> }) {
  const months = Object.keys(data).sort()
  if (months.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground">لا توجد بيانات</div>

  const maxVal = Math.max(
    ...months.map(m => (data[m].DERATISATION || 0) + (data[m].DESINSECTISATION || 0) + (data[m].DESINFECTION || 0)),
    1
  )

  return (
    <div className="h-full flex items-end gap-1 lg:gap-2">
      {months.map((month) => {
        const dr = data[month].DERATISATION || 0
        const di = data[month].DESINSECTISATION || 0
        const df = data[month].DESINFECTION || 0
        const total = dr + di + df
        const monthNum = parseInt(month.split('-')[1]) - 1

        return (
          <div key={month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <span className="text-[10px] text-muted-foreground font-medium">{total}</span>
            <div className="w-full flex flex-col gap-0.5" style={{ height: `${(total / maxVal) * 200}px` }}>
              {df > 0 && (
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: `${(df / total) * 100}%`, backgroundColor: TYPE_COLORS.DESINFECTION }}
                />
              )}
              {di > 0 && (
                <div
                  className="w-full transition-all"
                  style={{ height: `${(di / total) * 100}%`, backgroundColor: TYPE_COLORS.DESINSECTISATION }}
                />
              )}
              {dr > 0 && (
                <div
                  className="w-full rounded-b-sm transition-all"
                  style={{ height: `${(dr / total) * 100}%`, backgroundColor: TYPE_COLORS.DERATISATION }}
                />
              )}
            </div>
            <span className="text-[9px] lg:text-[10px] text-muted-foreground truncate w-full text-center">
              {MONTH_NAMES_AR[monthNum]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ===== MAP VIEW =====
function MapView({ interventions, quartiers }: { interventions: Intervention[]; quartiers: Quartier[] }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{
    interventions: Intervention[]
    quartiers: Quartier[]
  }> | null>(null)

  useEffect(() => {
    import('./map-component').then((mod) => {
      setMapComponent(() => mod.default)
      setMapLoaded(true)
    })
  }, [])

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] pb-16 lg:pb-0 relative">
      <div className="absolute top-4 right-4 z-10 bg-card/95 backdrop-blur rounded-xl border border-border p-4 max-w-xs shadow-lg">
        <h3 className="font-semibold mb-2">الخريطة التفاعلية - SIG</h3>
        <p className="text-xs text-muted-foreground mb-3">
          مواقع التدخلات في جماعة بوقنادل سلا
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.DERATISATION }} />
            <span>مكافحة القوارض ({interventions.filter(i => i.type === 'DERATISATION').length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.DESINSECTISATION }} />
            <span>مكافحة الحشرات ({interventions.filter(i => i.type === 'DESINSECTISATION').length})</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TYPE_COLORS.DESINFECTION }} />
            <span>التطهير والتعقيم ({interventions.filter(i => i.type === 'DESINFECTION').length})</span>
          </div>
        </div>
      </div>
      {mapLoaded && MapComponent ? (
        <MapComponent interventions={interventions} quartiers={quartiers} />
      ) : (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">جاري تحميل الخريطة...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ===== INTERVENTIONS VIEW =====
function InterventionsView({
  interventions,
  total,
  page,
  setPage,
  onEdit,
  onRefresh,
}: {
  interventions: Intervention[]
  total: number
  page: number
  setPage: (p: number) => void
  onEdit: (id: string) => void
  onRefresh: () => void
}) {
  const [localSearch, setLocalSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState<string>('ALL')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    onRefresh()
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/interventions/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      onRefresh()
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const filteredInterventions = interventions.filter(i =>
    filterStatut === 'ALL' || i.statut === filterStatut
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">إدارة التدخلات</h2>
          <p className="text-muted-foreground text-sm">{total} تدخل مسجل</p>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="بحث..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="flex-1 sm:w-64 px-4 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={filterStatut}
            onChange={(e) => setFilterStatut(e.target.value)}
            className="px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none"
          >
            <option value="ALL">كل الحالات</option>
            <option value="PLANIFIEE">مبرمجة</option>
            <option value="EN_COURS">جارية</option>
            <option value="TERMINEE">منجزة</option>
            <option value="ANNULEE">ملغاة</option>
          </select>
        </form>
      </div>

      {/* Interventions List */}
      <div className="space-y-3">
        {filteredInterventions.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-4xl mb-3">📋</p>
            <p>لا توجد تدخلات</p>
          </div>
        ) : (
          filteredInterventions.map((intervention) => (
            <div
              key={intervention.id}
              className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-all"
            >
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <span className="text-2xl">{TYPE_ICONS[intervention.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{intervention.reference}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: STATUT_COLORS[intervention.statut] + '20',
                          color: STATUT_COLORS[intervention.statut],
                        }}
                      >
                        {STATUT_LABELS[intervention.statut]}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{
                          backgroundColor: TYPE_COLORS[intervention.type] + '20',
                          color: TYPE_COLORS[intervention.type],
                        }}
                      >
                        {TYPE_LABELS[intervention.type]}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{intervention.quartier} - {intervention.adresse}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      <span>📅 {new Date(intervention.date).toLocaleDateString('ar-MA')}</span>
                      <span>👤 {intervention.agentNom}</span>
                      <span>💊 {intervention.produitUtilise}</span>
                      <span>📐 {intervention.superficie}</span>
                    </div>
                    {intervention.observations && (
                      <p className="text-xs text-muted-foreground mt-1 italic">💬 {intervention.observations}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:flex-col">
                  <button
                    onClick={() => onEdit(intervention.id)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border hover:bg-accent transition-colors"
                  >
                    ✏️ تعديل
                  </button>
                  {deleteConfirm === intervention.id ? (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleDelete(intervention.id)}
                        className="px-3 py-1.5 text-xs rounded-lg bg-destructive text-white hover:opacity-90"
                      >
                        تأكيد
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1.5 text-xs rounded-lg border border-border"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeleteConfirm(intervention.id)}
                      className="px-3 py-1.5 text-xs rounded-lg border border-border text-destructive hover:bg-destructive/10 transition-colors"
                    >
                      🗑️ حذف
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-accent transition-colors"
          >
            السابق
          </button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {Math.ceil(total / 50)}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 rounded-lg border border-border text-sm disabled:opacity-50 hover:bg-accent transition-colors"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  )
}

// ===== REPORTS VIEW =====
function ReportsView({ stats }: { stats: Statistics | null }) {
  if (!stats) return null

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      <div>
        <h2 className="text-2xl font-bold">الإحصائيات والتقارير</h2>
        <p className="text-muted-foreground text-sm">تحليل مفصل لبيانات التدخلات</p>
      </div>

      {/* Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">توزيع التدخلات حسب النوع</h3>
          <div className="space-y-4">
            {Object.entries(stats.byType).map(([type, count]) => {
              const percentage = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span>{TYPE_ICONS[type]}</span>
                      {TYPE_LABELS[type]}
                    </span>
                    <span className="text-sm text-muted-foreground">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: TYPE_COLORS[type],
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold mb-4">توزيع التدخلات حسب الحالة</h3>
          <div className="flex items-center justify-center py-4">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                {(() => {
                  let offset = 0
                  return Object.entries(stats.byStatut).map(([statut, count]) => {
                    const percentage = stats.total > 0 ? (count / stats.total) * 100 : 0
                    const circumference = 2 * Math.PI * 40
                    const dashArray = (percentage / 100) * circumference
                    const element = (
                      <circle
                        key={statut}
                        cx="50" cy="50" r="40" fill="none"
                        stroke={STATUT_COLORS[statut]}
                        strokeWidth="12"
                        strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                        strokeDashoffset={-offset * circumference / 100}
                        strokeLinecap="round"
                      />
                    )
                    offset += percentage
                    return element
                  })
                })()}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{stats.total}</span>
                <span className="text-xs text-muted-foreground">إجمالي</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-4">
            {Object.entries(stats.byStatut).map(([statut, count]) => (
              <div key={statut} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUT_COLORS[statut] }} />
                <span className="text-muted-foreground">{STATUT_LABELS[statut]}:</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quartier Statistics */}
      <div className="bg-card rounded-xl border border-border p-6">
        <h3 className="font-semibold mb-4">التدخلات حسب الأحياء</h3>
        <div className="space-y-3">
          {stats.byQuartier.map((q, index) => {
            const maxCount = stats.byQuartier[0]?.count || 1
            const percentage = Math.round((q.count / maxCount) * 100)
            return (
              <div key={q.quartier} className="flex items-center gap-4">
                <span className="text-sm w-36 truncate font-medium">{q.quartier}</span>
                <div className="flex-1 bg-muted rounded-full h-6 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end px-2 transition-all duration-500"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: `oklch(0.55 0.18 ${160 + index * 15})`,
                    }}
                  >
                    <span className="text-xs text-white font-medium">{q.count}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly Breakdown Table */}
      <div className="bg-card rounded-xl border border-border p-6 overflow-x-auto">
        <h3 className="font-semibold mb-4">الجدول الشهري التفصيلي</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 px-3 text-right font-semibold">الشهر</th>
              <th className="py-2 px-3 text-center font-semibold">🐀 مكافحة القوارض</th>
              <th className="py-2 px-3 text-center font-semibold">🦟 مكافحة الحشرات</th>
              <th className="py-2 px-3 text-center font-semibold">🧴 التطهير</th>
              <th className="py-2 px-3 text-center font-semibold">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats.monthly)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, data]) => {
                const dr = data.DERATISATION || 0
                const di = data.DESINSECTISATION || 0
                const df = data.DESINFECTION || 0
                const total = dr + di + df
                const monthNum = parseInt(month.split('-')[1]) - 1
                return (
                  <tr key={month} className="border-b border-border/50 hover:bg-accent/30 transition-colors">
                    <td className="py-2 px-3 font-medium">{MONTH_NAMES_AR[monthNum]} {month.split('-')[0]}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: TYPE_COLORS.DERATISATION + '20', color: TYPE_COLORS.DERATISATION }}>
                        {dr}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: TYPE_COLORS.DESINSECTISATION + '20', color: TYPE_COLORS.DESINSECTISATION }}>
                        {di}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: TYPE_COLORS.DESINFECTION + '20', color: TYPE_COLORS.DESINFECTION }}>
                        {df}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center font-bold">{total}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ===== INTERVENTION FORM DIALOG =====
function InterventionFormDialog({
  interventionId,
  quartiers,
  onClose,
  onSave,
}: {
  interventionId: string | null
  quartiers: Quartier[]
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [formData, setFormData] = useState({
    type: 'DERATISATION',
    date: new Date().toISOString().split('T')[0],
    quartier: '',
    adresse: '',
    latitude: '34.0520',
    longitude: '-6.7350',
    statut: 'PLANIFIEE',
    description: '',
    agentNom: '',
    produitUtilise: '',
    quantite: '',
    superficie: '',
    nombrePrestations: '1',
    observations: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Load existing intervention data
  useEffect(() => {
    if (interventionId) {
      setIsLoadingData(true)
      fetch(`/api/interventions/${interventionId}`)
        .then(res => res.json())
        .then(data => {
          setFormData({
            type: data.type,
            date: new Date(data.date).toISOString().split('T')[0],
            quartier: data.quartier,
            adresse: data.adresse,
            latitude: data.latitude.toString(),
            longitude: data.longitude.toString(),
            statut: data.statut,
            description: data.description || '',
            agentNom: data.agentNom,
            produitUtilise: data.produitUtilise || '',
            quantite: data.quantite || '',
            superficie: data.superficie || '',
            nombrePrestations: data.nombrePrestations?.toString() || '1',
            observations: data.observations || '',
          })
        })
        .catch(console.error)
        .finally(() => setIsLoadingData(false))
    }
  }, [interventionId])

  // Update coordinates when quartier changes
  useEffect(() => {
    const selectedQuartier = quartiers.find(q => q.nom === formData.quartier)
    if (selectedQuartier) {
      setFormData(prev => ({
        ...prev,
        latitude: selectedQuartier.latitude.toString(),
        longitude: selectedQuartier.longitude.toString(),
      }))
    }
  }, [formData.quartier, quartiers])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const url = interventionId ? `/api/interventions/${interventionId}` : '/api/interventions'
      const method = interventionId ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        await onSave()
        onClose()
      }
    } catch (err) {
      console.error('Submit failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">
            {interventionId ? 'تعديل التدخل' : 'إضافة تدخل جديد'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-accent rounded-lg transition-colors">
            ✕
          </button>
        </div>

        {isLoadingData ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Type and Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">نوع التدخل *</label>
                <select
                  value={formData.type}
                  onChange={(e) => updateField('type', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="DERATISATION">🐀 مكافحة القوارض</option>
                  <option value="DESINSECTISATION">🦟 مكافحة الحشرات</option>
                  <option value="DESINFECTION">🧴 التطهير والتعقيم</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الحالة *</label>
                <select
                  value={formData.statut}
                  onChange={(e) => updateField('statut', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="PLANIFIEE">مبرمجة</option>
                  <option value="EN_COURS">جارية</option>
                  <option value="TERMINEE">منجزة</option>
                  <option value="ANNULEE">ملغاة</option>
                </select>
              </div>
            </div>

            {/* Date and Agent */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">التاريخ *</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">اسم العون *</label>
                <input
                  type="text"
                  value={formData.agentNom}
                  onChange={(e) => updateField('agentNom', e.target.value)}
                  placeholder="اسم العون المكلف"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </div>

            {/* Quartier and Adresse */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">الحي *</label>
                <select
                  value={formData.quartier}
                  onChange={(e) => updateField('quartier', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="">اختر الحي</option>
                  {quartiers.map(q => (
                    <option key={q.id} value={q.nom}>{q.nom}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">العنوان</label>
                <input
                  type="text"
                  value={formData.adresse}
                  onChange={(e) => updateField('adresse', e.target.value)}
                  placeholder="رقم واسم الشارع"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">خط العرض</label>
                <input
                  type="text"
                  value={formData.latitude}
                  onChange={(e) => updateField('latitude', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">خط الطول</label>
                <input
                  type="text"
                  value={formData.longitude}
                  onChange={(e) => updateField('longitude', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Product details */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">المادة المستعملة</label>
                <input
                  type="text"
                  value={formData.produitUtilise}
                  onChange={(e) => updateField('produitUtilise', e.target.value)}
                  placeholder="اسم المادة"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">الكمية</label>
                <input
                  type="text"
                  value={formData.quantite}
                  onChange={(e) => updateField('quantite', e.target.value)}
                  placeholder="الكمية والوحدة"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">المساحة</label>
                <input
                  type="text"
                  value={formData.superficie}
                  onChange={(e) => updateField('superficie', e.target.value)}
                  placeholder="المساحة بالمتر المربع"
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1.5">الوصف</label>
              <textarea
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="وصف التدخل..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            {/* Observations */}
            <div>
              <label className="block text-sm font-medium mb-1.5">ملاحظات</label>
              <textarea
                value={formData.observations}
                onChange={(e) => updateField('observations', e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-primary text-primary-foreground px-4 py-3 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {isSubmitting ? 'جاري الحفظ...' : interventionId ? 'تحديث التدخل' : 'إضافة التدخل'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-xl border border-border text-muted-foreground hover:bg-accent transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
