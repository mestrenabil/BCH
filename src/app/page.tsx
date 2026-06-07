'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import dynamic from 'next/dynamic'
import { useAppStore, type ViewType, type InterventionType, type CommuneType, type MapClickCoords, type AuthUser, getYearOptions } from '@/lib/store'
import { t, type Language, type TranslationKey } from '@/lib/i18n'
import { toast } from 'sonner'
import {
  type InterventionMaterial, type InterventionDocument, type Intervention,
  type CommuneBreakdown, type Statistics, type Quartier,
  TYPE_LABELS, STATUT_LABELS, TYPE_COLORS, STATUT_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS, TYPE_ICONS, MONTH_NAMES_AR,
  CHART_COLORS, COMMUNE_USER_INFO, pageVariants, cardVariants,
  INTERVENTION_TEMPLATES,
} from '@/lib/constants'

// Dynamic imports for extracted views (code-split to reduce initial bundle)
const DashboardView = dynamic(() => import('./dashboard-view-lite'), { ssr: false })
const MapView = dynamic(() => import('./map-view-lite'), { ssr: false })
const InterventionsView = dynamic(() => import('./interventions-view-lite'), { ssr: false })
const InventoryView = dynamic(() => import('./inventory-view-lite'), { ssr: false })
const ReportsView = dynamic(() => import('./reports-view-lite'), { ssr: false })
const UsersView = dynamic(() => import('./users-view-lite'), { ssr: false })
const SettingsView = dynamic(() => import('./settings-view-lite'), { ssr: false })
const DocumentsView = dynamic(() => import('./documents-view'), { ssr: false })
const ExportView = dynamic(() => import('./export-view'), { ssr: false })
const NotificationsView = dynamic(() => import('./notifications-view'), { ssr: false })
const AlertsView = dynamic(() => import('./alerts-view'), { ssr: false })
const CalendarView = dynamic(() => import('./calendar-view'), { ssr: false })
const KpiView = dynamic(() => import('./kpi-view'), { ssr: false })
const AgentsView = dynamic(() => import('./agents-view'), { ssr: false })
const ComplaintsView = dynamic(() => import('./complaints-view'), { ssr: false })

// ===== LOGIN PAGE =====
function LoginPage({ onLogin }: { onLogin: (user: AuthUser) => void }) {
  const [selectedCommuneKey, setSelectedCommuneKey] = useState<string>('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'select' | 'login'>('select')

  // Seed users on mount if they don't exist yet
  useEffect(() => {
    const ensureUsers = async () => {
      try {
        await fetch('/api/auth/seed-users', { method: 'POST' })
      } catch { /* ignore - users might already exist */ }
    }
    ensureUsers()
  }, [])

  const handleSelectCommune = (key: string) => {
    setSelectedCommuneKey(key)
    const info = COMMUNE_USER_INFO[key]
    if (info) {
      setUsername(info.username)
    }
    setMode('login')
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'حدث خطأ أثناء تسجيل الدخول')
        return
      }

      onLogin(data.user)
      toast.success(`مرحباً ${data.user.nom}!`)
    } catch {
      setError('حدث خطأ في الاتصال بالخادم')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-950 p-4" dir="rtl">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-400/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 w-full max-w-lg"
      >
        {/* Logo & Title */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-5xl mx-auto border border-white/20 shadow-2xl mb-5">
            🏛️
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2">عمالة سلا</h1>
          <p className="text-emerald-200/80 text-sm font-medium">قسم حفظ الصحة والبيئة</p>
          <p className="text-emerald-300/60 text-xs mt-1">نظام تدبير عمليات 3D — مكافحة الجرذان • مكافحة الحشرات • التطهير</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8"
            >
              <h2 className="text-xl font-bold text-white text-center mb-2">اختر جماعتك</h2>
              <p className="text-emerald-200/60 text-sm text-center mb-6">حدد الجماعة الترابية للدخول إلى حسابك</p>

              <div className="space-y-3">
                {Object.entries(COMMUNE_USER_INFO).map(([key, info], i) => (
                  <motion.button
                    key={key}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    onClick={() => handleSelectCommune(key)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      borderColor: info.color + '40',
                      backgroundColor: info.color + '10',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = info.color + '80'
                      e.currentTarget.style.backgroundColor = info.color + '20'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = info.color + '40'
                      e.currentTarget.style.backgroundColor = info.color + '10'
                    }}
                  >
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shadow-lg"
                      style={{ backgroundColor: info.color + '30' }}>
                      {info.icon}
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-white font-bold text-base">{COMMUNE_LABELS[key]}</div>
                      <div className="text-emerald-200/50 text-xs mt-0.5">المسؤول: {info.username}</div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/30 group-hover:text-white/70 transition-colors rotate-180" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.button>
                ))}

                {/* Admin login */}
                <motion.button
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={() => { setUsername('admin'); setSelectedCommuneKey('ALL'); setMode('login') }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-slate-400/30 bg-slate-500/10 transition-all duration-300 group hover:scale-[1.02] active:scale-[0.98] hover:border-slate-400/60 hover:bg-slate-500/20"
                >
                  <div className="w-14 h-14 rounded-xl bg-slate-500/30 flex items-center justify-center text-2xl shadow-lg">
                    🔐
                  </div>
                  <div className="flex-1 text-right">
                    <div className="text-white font-bold text-base">المسؤول العام</div>
                    <div className="text-emerald-200/50 text-xs mt-0.5">صلاحية كاملة لجميع الجماعات</div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white/30 group-hover:text-white/70 transition-colors rotate-180" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="login"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.3 }}
              className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl p-8"
            >
              {/* Back button */}
              <button
                onClick={() => { setMode('select'); setError(''); setPassword('') }}
                className="flex items-center gap-2 text-emerald-200/70 hover:text-white transition-colors mb-6 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                رجوع
              </button>

              {/* Commune indicator */}
              {selectedCommuneKey !== 'ALL' && (
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                    style={{ backgroundColor: COMMUNE_USER_INFO[selectedCommuneKey]?.color + '30' }}>
                    {COMMUNE_USER_INFO[selectedCommuneKey]?.icon}
                  </div>
                  <div>
                    <div className="text-white font-bold">{COMMUNE_LABELS[selectedCommuneKey]}</div>
                    <div className="text-emerald-200/50 text-xs">تسجيل الدخول</div>
                  </div>
                </div>
              )}
              {selectedCommuneKey === 'ALL' && (
                <div className="flex items-center justify-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-slate-500/30 flex items-center justify-center text-2xl">🔐</div>
                  <div>
                    <div className="text-white font-bold">المسؤول العام</div>
                    <div className="text-emerald-200/50 text-xs">تسجيل الدخول</div>
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-emerald-200/80 text-sm font-medium mb-2">اسم المستخدم</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 outline-none focus:border-emerald-400/60 focus:bg-white/15 transition-all"
                    placeholder="أدخل اسم المستخدم"
                    dir="ltr"
                    required
                  />
                </div>
                <div>
                  <label className="block text-emerald-200/80 text-sm font-medium mb-2">كلمة المرور</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/30 outline-none focus:border-emerald-400/60 focus:bg-white/15 transition-all"
                    placeholder="أدخل كلمة المرور"
                    dir="ltr"
                    required
                  />
                </div>

                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-red-200 text-sm text-center"
                  >
                    {error}
                  </motion.div>
                )}

                <motion.button
                  type="submit"
                  disabled={isLoading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 bg-gradient-to-l from-emerald-500 to-teal-500 text-white rounded-xl font-bold text-base shadow-lg shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>جاري تسجيل الدخول...</span>
                    </>
                  ) : (
                    <>
                      <span>تسجيل الدخول</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 rotate-180" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <p className="text-center text-emerald-200/30 text-xs mt-6">
          © 2025 عمالة سلا — نظام تدبير عمليات 3D
        </p>
      </motion.div>
    </div>
  )
}

// ===== MAIN PAGE =====
export default function HomePage() {
  const {
    currentView, setCurrentView, selectedType, setSelectedType,
    selectedYear, setSelectedYear, selectedCommune, setSelectedCommune,
    searchQuery, setSearchQuery,
    isFormOpen, setIsFormOpen, editingInterventionId, setEditingInterventionId,
    sidebarOpen, setSidebarOpen,
    mapClickCoords, setMapClickCoords,
    user, setUser, isAuthenticated, isAuthLoading, setAuthLoading,
    loadSettings, settingsCommune,
    language, setLanguage,
    theme, setTheme,
  } = useAppStore()

  const [stats, setStats] = useState<Statistics | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionsTotal, setInterventionsTotal] = useState(0)
  const [interventionsPage, setInterventionsPage] = useState(1)
  const [quartiers, setQuartiers] = useState<Quartier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSeeded, setIsSeeded] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)
  const [presetDate, setPresetDate] = useState<string | null>(null)
  const [unreadNotifCount, setUnreadNotifCount] = useState(0)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Direction based on language
  const isRtl = language === 'ar'
  const dir = isRtl ? 'rtl' : 'ltr'

  // Auth: check session on mount
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true)
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.authenticated && data.user) {
          setUser(data.user)
          // Set commune based on user's assigned commune
          if (data.user.commune !== 'ALL') {
            setSelectedCommune(data.user.commune as CommuneType)
          }
          // Load per-commune settings from DB
          await loadSettings(data.user.commune !== 'ALL' ? data.user.commune : undefined)
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      }
      setAuthLoading(false)
    }
    checkAuth()
  }, [])

  // Initialize dark mode class on mount
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [theme])

  // Auth: handle login
  const handleLogin = useCallback(async (loggedInUser: AuthUser) => {
    setUser(loggedInUser)
    if (loggedInUser.commune !== 'ALL') {
      setSelectedCommune(loggedInUser.commune as CommuneType)
    }
    // Load per-commune settings from DB
    await loadSettings(loggedInUser.commune !== 'ALL' ? loggedInUser.commune : undefined)
  }, [setUser, setSelectedCommune, loadSettings])

  // Auth: handle logout
  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch { /* ignore */ }
    setUser(null)
    setSelectedCommune('ALL')
    setCurrentView('dashboard')
    toast.success('تم تسجيل الخروج بنجاح')
  }, [setUser, setSelectedCommune, setCurrentView])

  // Whether the user can see all communes
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'

  const fetchStats = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedYear) params.set('year', selectedYear)
      if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
      const url = `/api/statistics?${params.toString()}`
      const res = await fetch(url)
      const data = await res.json()
      setStats(data)
      setQuartiers(data.quartiers || [])
    } catch (err) { console.error('Failed to fetch stats:', err) }
  }, [selectedYear, selectedCommune])

  const fetchInterventions = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: interventionsPage.toString(), limit: '50',
        ...(selectedType !== 'ALL' ? { type: selectedType } : {}),
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(selectedYear ? { from: `${selectedYear}-01-01`, to: `${selectedYear}-12-31` } : {}),
        ...(selectedCommune !== 'ALL' ? { commune: selectedCommune } : {}),
      })
      const res = await fetch(`/api/interventions?${params}`)
      const data = await res.json()
      setInterventions(data.interventions || [])
      setInterventionsTotal(data.total || 0)
    } catch (err) { console.error('Failed to fetch interventions:', err) }
  }, [interventionsPage, selectedType, searchQuery, selectedYear, selectedCommune])

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
    if (!isAuthenticated) return
    const init = async () => {
      setIsLoading(true)
      try {
        const totalRes = await fetch('/api/statistics')
        const totalData = await totalRes.json()
        if (totalData.total === 0) await seedDatabase()
        const yearRes = await fetch(`/api/statistics?year=${new Date().getFullYear()}`)
        const yearData = await yearRes.json()
        setStats(yearData)
        setQuartiers(yearData.quartiers || [])
        await fetchInterventions()
      } catch (err) { console.error('Init failed:', err) }
      setIsLoading(false)
    }
    init()
  }, [isAuthenticated])

  const initialLoadDone = useRef(false)
  useEffect(() => {
    if (initialLoadDone.current) { fetchStats(); fetchInterventions() }
  }, [selectedYear, selectedType, selectedCommune, fetchStats, fetchInterventions])
  useEffect(() => { if (!isLoading) initialLoadDone.current = true }, [isLoading])

  // Fetch unread notification count periodically
  useEffect(() => {
    if (!isAuthenticated) return
    const fetchCount = async () => {
      try {
        const res = await fetch('/api/notifications')
        if (res.ok) {
          const data = await res.json()
          const readIds: string[] = JSON.parse(localStorage.getItem('notification-read-ids') || '[]')
          const unread = (data.notifications || []).filter((n: { id: string }) => !readIds.includes(n.id))
          setUnreadNotifCount(unread.length)
        }
      } catch { /* ignore */ }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 60000)
    return () => clearInterval(interval)
  }, [isAuthenticated])

  const navItems: { id: ViewType; labelKey: TranslationKey; icon: string; descKey: TranslationKey; sectionKey: TranslationKey }[] = [
    { id: 'dashboard', labelKey: 'dashboard', icon: '📊', descKey: 'descDashboard', sectionKey: 'sectionMain' },
    { id: 'map', labelKey: 'map', icon: '🗺️', descKey: 'descMap', sectionKey: 'sectionMain' },
    { id: 'interventions', labelKey: 'interventions', icon: '📋', descKey: 'descInterventions', sectionKey: 'sectionMain' },
    { id: 'agents', labelKey: 'agents', icon: '👷', descKey: 'descAgents', sectionKey: 'sectionMain' },
    { id: 'inventory', labelKey: 'inventory', icon: '📦', descKey: 'descInventory', sectionKey: 'sectionMain' },
    { id: 'documents', labelKey: 'documents', icon: '📁', descKey: 'descDocuments', sectionKey: 'sectionMain' },
    { id: 'calendar', labelKey: 'calendar', icon: '📅', descKey: 'descCalendar', sectionKey: 'sectionMain' },
    { id: 'complaints', labelKey: 'complaints', icon: '📢', descKey: 'descComplaints', sectionKey: 'sectionMain' },
    { id: 'reports', labelKey: 'reports', icon: '📈', descKey: 'descReports', sectionKey: 'sectionTracking' },
    { id: 'kpi', labelKey: 'kpi', icon: '🎯', descKey: 'descKpi', sectionKey: 'sectionTracking' },
    { id: 'alerts', labelKey: 'alerts', icon: '⚡', descKey: 'descAlerts', sectionKey: 'sectionTracking' },
    { id: 'export', labelKey: 'export', icon: '📤', descKey: 'descExport', sectionKey: 'sectionReports' },
    { id: 'notifications', labelKey: 'notifications', icon: '🔔', descKey: 'descNotifications', sectionKey: 'sectionReports' },
    { id: 'users', labelKey: 'users', icon: '👥', descKey: 'descUsers', sectionKey: 'sectionAdmin' },
    { id: 'settings', labelKey: 'settings', icon: '⚙️', descKey: 'descSettings', sectionKey: 'sectionAdmin' },
  ]

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if (e.altKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        const views: ViewType[] = ['dashboard', 'map', 'interventions', 'agents', 'inventory', 'documents', 'calendar', 'complaints', 'reports', 'kpi']
        const idx = parseInt(e.key) - 1
        if (idx < views.length) setCurrentView(views[idx])
      }
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault()
        setIsFormOpen(true)
      }
      if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault()
        const searchInput = document.querySelector<HTMLInputElement>('input[placeholder*="بحث"], input[placeholder*="recherch"], input[data-search]')
        searchInput?.focus()
      }
      if (e.key === 'Escape') {
        if (isFormOpen) { setIsFormOpen(false); setEditingInterventionId(null); setMapClickCoords(null); setPresetDate(null) }
        if (showShortcuts) setShowShortcuts(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isFormOpen, showShortcuts, setCurrentView, setIsFormOpen, setEditingInterventionId, setMapClickCoords])

  // Show loading while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-950" dir={dir}>
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-emerald-200/70 font-medium">{t('loading', language)}</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-emerald-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800" dir={dir}>
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
                  <h1 className="text-lg font-extrabold leading-tight tracking-tight">{t('headerTitle', language)}</h1>
                  <p className="text-[12px] text-emerald-100/90 font-semibold">{t('headerSubtitle', language)}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <motion.button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/20 transition-all"
                title={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
              >
                <span className="text-lg transition-transform duration-300" style={{ transform: theme === 'dark' ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  {theme === 'dark' ? '☀️' : '🌙'}
                </span>
              </motion.button>
              {/* Language toggle */}
              <button
                onClick={() => setLanguage(language === 'ar' ? 'fr' : 'ar')}
                className="hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 hover:bg-white/20 transition-all text-xs font-bold"
                title={language === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}
              >
                🌐 {language === 'ar' ? 'Fr' : 'ع'}
              </button>
              {/* Help button */}
              <button
                onClick={() => setShowShortcuts(true)}
                className="hidden sm:flex items-center gap-1.5 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 hover:bg-white/20 transition-all text-xs font-bold"
                title="?"
              >
                ?
              </button>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">📅 {t('year', language)}:</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value="" className="text-black">{t('all', language)}</option>
                  {getYearOptions(10).map((y) => (
                    <option key={y.value} value={y.value} className="text-black">{y.label}</option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">🏛️ {t('commune', language)}:</span>
                {canSeeAllCommunes ? (
                  <select value={selectedCommune} onChange={(e) => setSelectedCommune(e.target.value as CommuneType | 'ALL')}
                    className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                    <option value="ALL" className="text-black">{t('allCommunes', language)}</option>
                    <option value="سلا" className="text-black">{t('communeSale', language)}</option>
                    <option value="سيدي أبي القنادل" className="text-black">{t('communeSidi', language)}</option>
                    <option value="عامر" className="text-black">{t('communeAmer', language)}</option>
                  </select>
                ) : (
                  <span className="text-sm font-bold">{COMMUNE_LABELS[selectedCommune] || selectedCommune}</span>
                )}
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">🏷️ {t('type', language)}:</span>
                <select value={selectedType} onChange={(e) => setSelectedType(e.target.value as InterventionType | 'ALL')}
                  className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value="ALL" className="text-black">{t('all', language)}</option>
                  <option value="DERATISATION" className="text-black">{t('DERATISATION', language)}</option>
                  <option value="DESINSECTISATION" className="text-black">{t('DESINSECTISATION', language)}</option>
                  <option value="DESINFECTION" className="text-black">{t('DESINFECTION', language)}</option>
                </select>
              </div>
              {/* User Info & Logout */}
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: (user?.commune && user.commune !== 'ALL' ? COMMUNE_COLORS[user.commune] : '#64748b') + '30' }}>
                  {user?.role === 'admin' ? '🔐' : '👤'}
                </div>
                <div className={`${isRtl ? 'text-right' : 'text-left'} leading-tight`}>
                  <div className="text-[11px] font-bold text-white">{user?.nom}</div>
                  <div className="text-[9px] text-emerald-200/60">
                    {user?.commune === 'ALL' ? t('adminGeneral', language) : COMMUNE_LABELS[user?.commune || ''] || user?.commune}
                  </div>
                </div>
                <button onClick={handleLogout}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all" title={t('logout', language)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-200/70 hover:text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Filters Bar */}
      <div className="sm:hidden bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border-b border-slate-100 dark:border-slate-700 px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">🏛️</span>
          {canSeeAllCommunes && (
            <button onClick={() => setSelectedCommune('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${selectedCommune === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
              {t('all', language)}
            </button>
          )}
          {Object.entries(COMMUNE_LABELS).map(([key, label]) => (
            <button key={key}
              onClick={() => canSeeAllCommunes ? setSelectedCommune(selectedCommune === key ? 'ALL' : key as CommuneType) : undefined}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${selectedCommune === key ? 'text-white shadow-md' : 'bg-slate-100 text-slate-600'} ${!canSeeAllCommunes && selectedCommune !== key ? 'opacity-40 pointer-events-none' : ''}`}
              style={selectedCommune === key ? { backgroundColor: COMMUNE_COLORS[key] } : {}}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedCommune === key ? 'white' : COMMUNE_COLORS[key] }} />
              {label.replace('جماعة ', '')}
            </button>
          ))}
          {/* Mobile user & logout */}
          <div className={`flex items-center gap-1 ${isRtl ? 'mr-2 pr-2 border-r border-slate-200' : 'ml-2 pl-2 border-l border-slate-200'}`}>
            <span className="text-[10px] text-slate-500 font-bold">{user?.nom}</span>
            <button onClick={handleLogout} className="p-1 hover:bg-slate-100 rounded" title={t('logout', language)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar Desktop */}
        <aside className={`hidden lg:flex w-72 bg-white/80 dark:bg-slate-800/90 backdrop-blur-sm ${isRtl ? 'border-l' : 'border-r'} border-slate-200/80 dark:border-slate-700/80 flex-col shadow-sm ${isRtl ? '' : 'order-first'}`}>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">{t('active', language)}</span>
            </div>
            {/* User card */}
            <div className="bg-gradient-to-l from-slate-50 to-slate-100 rounded-xl p-3 border border-slate-200/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
                  style={{ backgroundColor: (user?.commune && user.commune !== 'ALL' ? COMMUNE_COLORS[user.commune] : '#475569') + '20' }}>
                  {user?.role === 'admin' ? '🔐' : '👤'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-700 truncate">{user?.nom}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {user?.commune === 'ALL' ? `${t('adminGeneral', language)} — ${t('fullAccess', language)}` : COMMUNE_LABELS[user?.commune || ''] || user?.commune}
                  </div>
                </div>
                <button onClick={handleLogout} className="p-1.5 hover:bg-white rounded-lg transition-all" title={t('logout', language)}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 hover:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <nav className="flex-1 px-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
            {navItems.map((item, idx) => {
              const showSection = item.sectionKey && (idx === 0 || navItems[idx - 1].sectionKey !== item.sectionKey)
              return (
                <React.Fragment key={item.id}>
                  {showSection && (
                    <div className="px-4 pt-4 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t(item.sectionKey, language)}
                    </div>
                  )}
                  <motion.button
                    onClick={() => setCurrentView(item.id)}
                    whileHover={{ x: isRtl ? -4 : 4 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      currentView === item.id
                        ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
                        : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-700'
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div className={`${isRtl ? 'text-right' : 'text-left'} flex-1`}>
                      <div className="text-[13px] flex items-center gap-2">
                        {t(item.labelKey, language)}
                        {item.id === 'notifications' && unreadNotifCount > 0 && (
                          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>
                        )}
                      </div>
                      <div className={`text-[10px] ${currentView === item.id ? 'text-emerald-100' : 'text-slate-400'}`}>{t(item.descKey, language)}</div>
                    </div>
                  </motion.button>
                </React.Fragment>
              )
            })}
          </nav>
          <div className="p-4 border-t border-slate-100">
            <motion.button
              onClick={() => setIsFormOpen(true)}
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="w-full bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              <span>{t('addInterventionNew', language)}</span>
            </motion.button>
          </div>
          {stats && (
            <div className="p-4 border-t border-slate-100 space-y-3">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{t('quickSummary', language)}</h3>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-600">{stats.total}</div>
                  <div className="text-[10px] text-slate-500">{t('total', language)}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-emerald-600">{stats.byStatut.TERMINEE || 0}</div>
                  <div className="text-[10px] text-emerald-600">{t('TERMINEE', language)}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-amber-600">{stats.byStatut.EN_COURS || 0}</div>
                  <div className="text-[10px] text-amber-600">{t('EN_COURS', language)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                  <div className="text-lg font-bold text-blue-600">{stats.byStatut.PLANIFIEE || 0}</div>
                  <div className="text-[10px] text-blue-600">{t('PLANIFIEE', language)}</div>
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
              <motion.aside initial={{ x: isRtl ? 300 : -300 }} animate={{ x: 0 }} exit={{ x: isRtl ? 300 : -300 }}
                transition={{ type: 'spring', damping: 25 }}
                className={`fixed ${isRtl ? 'right-0' : 'left-0'} top-0 bottom-0 w-72 bg-white dark:bg-slate-800 shadow-2xl z-50 flex flex-col`}>
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-bold text-emerald-700">{t('menu', language)}</h2>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">✕</button>
                </div>
                <nav className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                  {navItems.map((item, idx) => {
                    const showSection = item.sectionKey && (idx === 0 || navItems[idx - 1].sectionKey !== item.sectionKey)
                    return (
                      <React.Fragment key={item.id}>
                        {showSection && (
                          <div className="px-4 pt-3 pb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            {t(item.sectionKey, language)}
                          </div>
                        )}
                        <button
                          onClick={() => { setCurrentView(item.id); setSidebarOpen(false) }}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                            currentView === item.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-600 hover:bg-slate-50'
                          }`}>
                          <span className="text-lg">{item.icon}</span>
                          <span className="text-[13px] flex items-center gap-2">
                            {t(item.labelKey, language)}
                            {item.id === 'notifications' && unreadNotifCount > 0 && (
                              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">{unreadNotifCount > 99 ? '99+' : unreadNotifCount}</span>
                            )}
                          </span>
                        </button>
                      </React.Fragment>
                    )
                  })}
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
                  <p className="text-slate-500 font-medium">{t('loadingData', language)}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key={currentView} variants={pageVariants} initial="initial" animate="animate" exit="exit">
                {currentView === 'dashboard' && <DashboardView stats={stats} onNavigate={setCurrentView} selectedCommune={selectedCommune} canSeeAllCommunes={canSeeAllCommunes} onRetry={fetchStats} selectedYear={selectedYear} />}
                {currentView === 'map' && <MapView interventions={interventions} quartiers={quartiers} selectedCommune={selectedCommune} canSeeAllCommunes={canSeeAllCommunes} onMapClick={(lat: number, lng: number, commune: string | null) => {
                  const { settings: currentSettings } = useAppStore.getState()
                  if (!currentSettings.mapClickEnabled) return
                  setMapClickCoords({ latitude: lat, longitude: lng, commune })
                  setEditingInterventionId(null)
                  setIsFormOpen(true)
                }} onRefresh={async () => { await fetchStats(); await fetchInterventions() }} />}
                {currentView === 'interventions' && (
                  <InterventionsView interventions={interventions} total={interventionsTotal}
                    page={interventionsPage} setPage={setInterventionsPage}
                    onEdit={setEditingInterventionId} onRefresh={fetchInterventions} selectedCommune={selectedCommune}
                    onAdd={() => setIsFormOpen(true)} />
                )}
                {currentView === 'reports' && <ReportsView stats={stats} selectedCommune={selectedCommune} canSeeAllCommunes={canSeeAllCommunes} selectedYear={selectedYear} />}
                {currentView === 'inventory' && <InventoryView />}
                {currentView === 'documents' && <DocumentsView />}
                {currentView === 'calendar' && <CalendarView onAdd={(date) => { setPresetDate(date); setEditingInterventionId(null); setMapClickCoords(null); setIsFormOpen(true) }} />}
                {currentView === 'notifications' && <NotificationsView />}
                {currentView === 'alerts' && <AlertsView />}
                {currentView === 'kpi' && <KpiView />}
                {currentView === 'export' && <ExportView />}
                {currentView === 'agents' && <AgentsView />}
                {currentView === 'complaints' && <ComplaintsView />}
                {currentView === 'users' && <UsersView />}
                {currentView === 'settings' && <SettingsView />}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Form Dialog */}
      <AnimatePresence>
        {isFormOpen && (
          <InterventionFormDialog interventionId={editingInterventionId} quartiers={quartiers}
            mapClickCoords={mapClickCoords} presetDate={presetDate} userCommune={user?.commune || 'ALL'}
            onClose={() => { setIsFormOpen(false); setEditingInterventionId(null); setMapClickCoords(null); setPresetDate(null) }}
            onSave={async () => { await fetchStats(); await fetchInterventions() }} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200 py-3 px-4 mt-auto">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-xs text-slate-500">{t('footerText', language)}</p>
          <div className="flex items-center gap-2">
            {user && user.commune !== 'ALL' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: COMMUNE_COLORS[user.commune] + '15', color: COMMUNE_COLORS[user.commune] }}>
                {COMMUNE_LABELS[user.commune]}
              </span>
            )}
            <p className="text-xs text-emerald-600 font-medium">{t('footerSystem', language)}</p>
          </div>
        </div>
      </footer>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-700 z-40 shadow-lg">
        <div className="flex items-center justify-around py-1.5 px-1">
          {['dashboard', 'map', 'interventions', 'agents', 'notifications'].map((viewId) => {
            const item = navItems.find(n => n.id === viewId)
            if (!item) return null
            return (
              <button key={item.id} onClick={() => setCurrentView(item.id)}
                className={`flex flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all ${
                  currentView === item.id ? 'text-emerald-600 bg-emerald-50' : 'text-slate-400'
                }`}>
                <span className="text-lg relative">
                  {item.icon}
                  {item.id === 'notifications' && unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold px-0.5">
                      {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-semibold">{t(item.labelKey, language)}</span>
              </button>
            )
          })}
          <motion.button onClick={() => setIsFormOpen(true)} whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-0.5 px-1.5 py-1.5">
            <span className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-full flex items-center justify-center text-lg shadow-lg shadow-emerald-200">+</span>
            <span className="text-[9px] font-semibold text-emerald-600">{t('add', language)}</span>
          </motion.button>
        </div>
      </nav>

      {/* Keyboard Shortcuts Help Dialog */}
      <AnimatePresence>
        {showShortcuts && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowShortcuts(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden">
              <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white p-5 flex items-center justify-between">
                <h2 className="text-lg font-bold">⌨️ {t('shortcutsTitle', language)}</h2>
                <button onClick={() => setShowShortcuts(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">✕</button>
              </div>
              <div className="p-5 space-y-3" dir={dir}>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <kbd className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold shadow-sm">Alt + 1-9</kbd>
                  <span className="text-sm text-slate-700">{t('shortcutNav', language)}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <kbd className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold shadow-sm">Alt + N</kbd>
                  <span className="text-sm text-slate-700">{t('shortcutAdd', language)}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <kbd className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold shadow-sm">Alt + S</kbd>
                  <span className="text-sm text-slate-700">{t('shortcutSearch', language)}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <kbd className="px-2 py-1 bg-white rounded-lg border border-slate-200 text-xs font-mono font-bold shadow-sm">Esc</kbd>
                  <span className="text-sm text-slate-700">{t('shortcutClose', language)}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== FORM DIALOG =====
interface DropdownProduct {
  id: string; nom: string; categorie: string; unite: string; quantiteStock: number; prixUnitaire: number; reference: string
}

function InterventionFormDialog({ interventionId, quartiers, mapClickCoords, presetDate, userCommune, onClose, onSave }: {
  interventionId: string | null; quartiers: Quartier[]
  mapClickCoords: MapClickCoords | null; presetDate: string | null; userCommune: string
  onClose: () => void; onSave: () => Promise<void>
}) {
  // For non-admin users, always use their assigned commune
  const enforcedCommune = userCommune !== 'ALL' ? userCommune : (mapClickCoords?.commune || '')

  const [formData, setFormData] = useState({
    type: 'DERATISATION', date: presetDate || new Date().toISOString().split('T')[0],
    heureDebut: '', heureFin: '',
    quartier: '', adresse: '', commune: enforcedCommune,
    latitude: mapClickCoords ? mapClickCoords.latitude.toString() : '34.052', 
    longitude: mapClickCoords ? mapClickCoords.longitude.toString() : '-6.735',
    statut: 'PLANIFIEE', description: '', agentNom: '', produitUtilise: '',
    quantite: '', superficie: '', nombrePrestations: '1', observations: '',
    coutMainOeuvre: '', coutMateriaux: '', coutTotal: '',
  })
  const [materials, setMaterials] = useState<{ productId: string; quantity: number }[]>([])
  const [dropdownProducts, setDropdownProducts] = useState<DropdownProduct[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')

  // Load products for dropdown
  useEffect(() => {
    fetch('/api/products/for-dropdown').then(res => res.json()).then(data => {
      setDropdownProducts(data.products || [])
    }).catch(console.error)
  }, [])

  // When presetDate changes, update the form's date field
  useEffect(() => {
    if (presetDate && !interventionId) {
      setFormData(prev => ({ ...prev, date: presetDate }))
    }
  }, [presetDate, interventionId])

  // When mapClickCoords changes, update the form's latitude/longitude/commune
  useEffect(() => {
    if (mapClickCoords && !interventionId) {
      setFormData(prev => ({
        ...prev,
        latitude: mapClickCoords.latitude.toString(),
        longitude: mapClickCoords.longitude.toString(),
        // Non-admin users always keep their assigned commune
        commune: userCommune !== 'ALL' ? userCommune : (mapClickCoords.commune || prev.commune),
      }))
    }
  }, [mapClickCoords, interventionId, userCommune])

  useEffect(() => {
    if (interventionId) {
      setIsLoadingData(true)
      fetch(`/api/interventions/${interventionId}`).then(res => res.json()).then(data => {
        setFormData({
          type: data.type, date: new Date(data.date).toISOString().split('T')[0],
          heureDebut: data.heureDebut || '', heureFin: data.heureFin || '',
          quartier: data.quartier, adresse: data.adresse, commune: data.commune || '',
          latitude: data.latitude.toString(), longitude: data.longitude.toString(),
          statut: data.statut, description: data.description || '', agentNom: data.agentNom,
          produitUtilise: data.produitUtilise || '', quantite: data.quantite || '',
          superficie: data.superficie || '', nombrePrestations: data.nombrePrestations?.toString() || '1',
          observations: data.observations || '',
          coutMainOeuvre: data.coutMainOeuvre?.toString() || '', coutMateriaux: data.coutMateriaux?.toString() || '', coutTotal: data.coutTotal?.toString() || '',
        })
        // Load existing materials
        if (data.materials && Array.isArray(data.materials)) {
          setMaterials(data.materials.map((m: InterventionMaterial) => ({
            productId: m.productId,
            quantity: m.quantity,
          })))
        }
      }).catch(console.error).finally(() => setIsLoadingData(false))
    }
  }, [interventionId])

  useEffect(() => {
    const q = quartiers.find(q => q.nom === formData.quartier)
    if (q) setFormData(prev => ({ ...prev, latitude: q.latitude.toString(), longitude: q.longitude.toString() }))
  }, [formData.quartier, quartiers])

  const addMaterial = () => {
    setMaterials(prev => [...prev, { productId: '', quantity: 0 }])
  }

  const removeMaterial = (index: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== index))
  }

  const updateMaterial = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    setMaterials(prev => prev.map((m, i) => i === index ? { ...m, [field]: field === 'quantity' ? Number(value) || 0 : value } : m))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const url = interventionId ? `/api/interventions/${interventionId}` : '/api/interventions'
      const payload = {
        ...formData,
        materials: materials.filter(m => m.productId && m.quantity > 0),
      }
      const res = await fetch(url, { method: interventionId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (res.ok) { toast.success(interventionId ? 'تم تحديث التدخل بنجاح' : 'تم إضافة التدخل بنجاح'); await onSave(); onClose() }
      else {
        const errData = await res.json().catch(() => ({}))
        toast.error(errData.error || 'حدث خطأ أثناء الحفظ')
      }
    } catch { toast.error('حدث خطأ أثناء الحفظ') }
    finally { setIsSubmitting(false) }
  }

  const updateField = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }))

  const PRODUCT_CATEGORIES: Record<string, string> = {
    DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم', GENERAL: 'مواد عامة',
  }

  // Filter products based on intervention type
  const filteredProducts = dropdownProducts.filter(p => {
    if (formData.type === 'DERATISATION') return p.categorie === 'DERATISATION' || p.categorie === 'GENERAL'
    if (formData.type === 'DESINSECTISATION') return p.categorie === 'DESINSECTISATION' || p.categorie === 'GENERAL'
    if (formData.type === 'DESINFECTION') return p.categorie === 'DESINFECTION' || p.categorie === 'GENERAL'
    return true
  })

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
            <p className="text-emerald-100/70 text-xs">
              {mapClickCoords && !interventionId 
                ? `📍 من الخريطة — ${mapClickCoords.latitude.toFixed(4)}, ${mapClickCoords.longitude.toFixed(4)}`
                : 'أدخل معلومات التدخل'
              }
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">✕</button>
        </div>

        {isLoadingData ? (
          <div className="p-8 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Template Selector */}
            {!interventionId && (
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">📋 استعمال قالب</label>
                <select value={selectedTemplate} onChange={(e) => {
                  const tplId = e.target.value
                  setSelectedTemplate(tplId)
                  if (tplId) {
                    const tpl = INTERVENTION_TEMPLATES.find(t => t.id === tplId)
                    if (tpl) {
                      setFormData(prev => ({
                        ...prev,
                        type: tpl.type,
                        produitUtilise: tpl.produitUtilise || prev.produitUtilise,
                        superficie: tpl.superficie || prev.superficie,
                        nombrePrestations: tpl.nombrePrestations || prev.nombrePrestations,
                        description: tpl.description || prev.description,
                        ...(tpl.statut ? { statut: tpl.statut } : {}),
                      }))
                    }
                  }
                }}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  <option value="">— اختر قالباً —</option>
                  {INTERVENTION_TEMPLATES.map(tpl => (
                    <option key={tpl.id} value={tpl.id}>{TYPE_ICONS[tpl.type]} {tpl.name}</option>
                  ))}
                </select>
              </div>
            )}
            {/* Map click indicator banner */}
            {mapClickCoords && !interventionId && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-lg shrink-0 shadow-md">📍</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-700">موقع محدد من الخريطة</p>
                  <p className="text-[11px] text-emerald-600">
                    الإحداثيات: {mapClickCoords.latitude.toFixed(6)}, {mapClickCoords.longitude.toFixed(6)}
                    {mapClickCoords.commune && (
                      <span className="mr-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                        🏛️ {mapClickCoords.commune}
                      </span>
                    )}
                  </p>
                </div>
              </motion.div>
            )}
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  🏛️ الجماعة
                  {userCommune !== 'ALL' && <span className="text-[10px] text-emerald-600 mr-1">✓ جماعتك</span>}
                </label>
                {userCommune !== 'ALL' ? (
                  <div className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-sm font-bold text-emerald-700">
                    {COMMUNE_LABELS[userCommune] || userCommune}
                  </div>
                ) : (
                  <select value={formData.commune} onChange={(e) => updateField('commune', e.target.value)}
                    className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 ${mapClickCoords && !mapClickCoords.commune && !interventionId ? 'border-amber-300 bg-amber-50/50' : 'border-slate-200 bg-white'}`}>
                    <option value="">— اختر الجماعة —</option>
                    <option value="سلا">جماعة سلا</option>
                    <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                    <option value="عامر">جماعة عامر</option>
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">التاريخ *</label>
                <input type="date" value={formData.date} onChange={(e) => updateField('date', e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">⏰ وقت البداية</label>
                <input type="time" value={formData.heureDebut} onChange={(e) => updateField('heureDebut', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">⏰ وقت النهاية</label>
                <input type="time" value={formData.heureFin} onChange={(e) => updateField('heureFin', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم العون *</label>
                <input type="text" value={formData.agentNom} onChange={(e) => updateField('agentNom', e.target.value)} required
                  placeholder="اسم العون المكلف"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">الحي *</label>
                <select value={formData.quartier} onChange={(e) => updateField('quartier', e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                  <option value="">اختر الحي</option>
                  {quartiers.map(q => (
                    <option key={q.id} value={q.nom}>
                      {q.nom}{q.commune ? ` — ${COMMUNE_LABELS[q.commune as keyof typeof COMMUNE_LABELS] || q.commune}` : ''}
                    </option>
                  ))}
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
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  خط العرض
                  {mapClickCoords && !interventionId && <span className="text-[10px] text-emerald-500 mr-1">📍 من الخريطة</span>}
                </label>
                <input type="text" value={formData.latitude} onChange={(e) => updateField('latitude', e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 ${mapClickCoords && !interventionId ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  خط الطول
                  {mapClickCoords && !interventionId && <span className="text-[10px] text-emerald-500 mr-1">📍 من الخريطة</span>}
                </label>
                <input type="text" value={formData.longitude} onChange={(e) => updateField('longitude', e.target.value)}
                  className={`w-full px-3 py-2.5 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 ${mapClickCoords && !interventionId ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'}`} />
              </div>
            </div>

            {/* Materials from Inventory Section */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📦</span>
                  <label className="text-sm font-semibold text-slate-700">المواد المستعملة من المخزون</label>
                </div>
                <button type="button" onClick={addMaterial}
                  className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200 transition-colors flex items-center gap-1">
                  <span>+</span> إضافة مادة
                </button>
              </div>
              {materials.length === 0 ? (
                <div className="text-center py-3">
                  <p className="text-xs text-slate-400">لم يتم إضافة مواد بعد. اضغط &quot;إضافة مادة&quot; لاختيار المواد من المخزون</p>
                  <p className="text-[10px] text-slate-300 mt-1">سيتم خصم الكميات من المخزون تلقائياً</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {materials.map((mat, index) => {
                    const selectedProduct = dropdownProducts.find(p => p.id === mat.productId)
                    const maxQty = selectedProduct?.quantiteStock || 0
                    return (
                      <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-slate-100">
                        <select value={mat.productId} onChange={(e) => updateMaterial(index, 'productId', e.target.value)}
                          className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-1 focus:ring-emerald-500/20">
                          <option value="">— اختر المادة —</option>
                          {filteredProducts.map(p => (
                            <option key={p.id} value={p.id}>
                              {p.nom} (المخزون: {p.quantiteStock} {p.unite})
                            </option>
                          ))}
                        </select>
                        <div className="flex items-center gap-1">
                          <input type="number" min="1" max={maxQty} value={mat.quantity || ''} 
                            onChange={(e) => updateMaterial(index, 'quantity', e.target.value)}
                            placeholder="الكمية"
                            className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 bg-white text-xs outline-none focus:ring-1 focus:ring-emerald-500/20 text-center" />
                          {selectedProduct && <span className="text-[10px] text-slate-400 whitespace-nowrap">{selectedProduct.unite}</span>}
                        </div>
                        {maxQty > 0 && mat.quantity > maxQty && (
                          <span className="text-[9px] text-red-500 font-bold whitespace-nowrap">⚠️ يتجاوز المخزون</span>
                        )}
                        <button type="button" onClick={() => removeMaterial(index)}
                          className="w-6 h-6 rounded-md bg-red-50 text-red-500 text-xs hover:bg-red-100 transition-colors flex items-center justify-center flex-shrink-0">✕</button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">المساحة</label>
                <input type="text" value={formData.superficie} onChange={(e) => updateField('superficie', e.target.value)}
                  placeholder="بالمتر المربع"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">المادة (نص حر)</label>
                <input type="text" value={formData.produitUtilise} onChange={(e) => updateField('produitUtilise', e.target.value)}
                  placeholder="اسم المادة إن لم تكن في المخزون"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
            </div>
            {/* Cost Fields */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">💰 تكلفة اليد العاملة</label>
                <input type="number" min="0" step="0.01" value={formData.coutMainOeuvre} onChange={(e) => {
                  updateField('coutMainOeuvre', e.target.value)
                  const mo = parseFloat(e.target.value) || 0
                  const mat = parseFloat(formData.coutMateriaux) || 0
                  updateField('coutTotal', (mo + mat).toString())
                }}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">🧪 تكلفة المواد</label>
                <input type="number" min="0" step="0.01" value={formData.coutMateriaux} onChange={(e) => {
                  updateField('coutMateriaux', e.target.value)
                  const mo = parseFloat(formData.coutMainOeuvre) || 0
                  const mat = parseFloat(e.target.value) || 0
                  updateField('coutTotal', (mo + mat).toString())
                }}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">📊 التكلفة الإجمالية</label>
                <input type="text" value={formData.coutTotal ? parseFloat(formData.coutTotal).toLocaleString('ar-MA') + ' درهم' : ''} readOnly
                  placeholder="تلقائي"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none cursor-not-allowed text-slate-500" />
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
