'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts'
import { useAppStore, type ViewType, type InterventionType, type CommuneType, type MapClickCoords, type AuthUser, getYearOptions } from '@/lib/store'
import { toast } from 'sonner'

// ===== AUTH CONSTANTS =====
const COMMUNE_USER_INFO: Record<string, { username: string; password: string; color: string; icon: string }> = {
  'سلا': { username: 'sla', password: 'sla2025', color: '#059669', icon: '🏙️' },
  'سيدي أبي القنادل': { username: 'bouknadel', password: 'bouknadel2025', color: '#7c3aed', icon: '🏘️' },
  'عامر': { username: 'ameur', password: 'ameur2025', color: '#d97706', icon: '🌄' },
}

// ===== TYPE DEFINITIONS =====
interface InterventionMaterial {
  id: string; interventionId: string; productId: string; quantity: number; createdAt: string
  product: { id: string; nom: string; unite: string; quantiteStock: number }
}

interface Intervention {
  id: string; type: string; date: string; quartier: string; adresse: string
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
  commune: string; createdAt: string; updatedAt: string
  materials?: InterventionMaterial[]
}

interface CommuneBreakdown {
  total: number
  DERATISATION: number
  DESINSECTISATION: number
  DESINFECTION: number
}

interface Statistics {
  total: number; byType: Record<string, number>; byStatut: Record<string, number>
  byQuartier: { quartier: string; count: number }[]
  byCommune: Record<string, CommuneBreakdown>
  monthly: Record<string, Record<string, number>>
  recent: Intervention[]
  quartiers: { id: string; nom: string; latitude: number; longitude: number }[]
}

interface Quartier { id: string; nom: string; commune: string; latitude: number; longitude: number }

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
  } = useAppStore()

  const [stats, setStats] = useState<Statistics | null>(null)
  const [interventions, setInterventions] = useState<Intervention[]>([])
  const [interventionsTotal, setInterventionsTotal] = useState(0)
  const [interventionsPage, setInterventionsPage] = useState(1)
  const [quartiers, setQuartiers] = useState<Quartier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSeeded, setIsSeeded] = useState(false)
  const [isSeeding, setIsSeeding] = useState(false)

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

  const navItems: { id: ViewType; label: string; icon: string; desc: string }[] = [
    { id: 'dashboard', label: 'لوحة القيادة', icon: '📊', desc: 'نظرة شاملة' },
    { id: 'map', label: 'الخريطة', icon: '🗺️', desc: 'SIG تفاعلي' },
    { id: 'interventions', label: 'التدخلات', icon: '📋', desc: 'إدارة العمليات' },
    { id: 'inventory', label: 'المخزون', icon: '📦', desc: 'تدبير المواد' },
    { id: 'reports', label: 'التقارير', icon: '📈', desc: 'إحصائيات مفصلة' },
    { id: 'users', label: 'المستخدمون', icon: '👥', desc: 'إدارة الحسابات' },
    { id: 'settings', label: 'الإعدادات', icon: '⚙️', desc: 'تهيئة التطبيق' },
  ]

  // Show loading while checking auth
  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-900 via-teal-800 to-emerald-950" dir="rtl">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-emerald-200/70 font-medium">جاري التحقق...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />
  }

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
                  <h1 className="text-lg font-extrabold leading-tight tracking-tight">عمالة سلا</h1>
                  <p className="text-[12px] text-emerald-100/90 font-semibold">قسم حفظ الصحة والبيئة ⚡ مكتب مكافحة الجرذان • مكافحة الحشرات • التطهير</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">📅 السنة:</span>
                <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)}
                  className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                  <option value="" className="text-black">الكل</option>
                  {getYearOptions(10).map((y) => (
                    <option key={y.value} value={y.value} className="text-black">{y.label}</option>
                  ))}
                </select>
              </div>
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <span className="text-xs text-emerald-100/70">🏛️ الجماعة:</span>
                {canSeeAllCommunes ? (
                  <select value={selectedCommune} onChange={(e) => setSelectedCommune(e.target.value as CommuneType | 'ALL')}
                    className="bg-transparent text-sm font-bold outline-none cursor-pointer">
                    <option value="ALL" className="text-black">كل الجماعات</option>
                    <option value="سلا" className="text-black">جماعة سلا</option>
                    <option value="سيدي أبي القنادل" className="text-black">جماعة سيدي أبي القنادل</option>
                    <option value="عامر" className="text-black">جماعة عامر</option>
                  </select>
                ) : (
                  <span className="text-sm font-bold">{COMMUNE_LABELS[selectedCommune] || selectedCommune}</span>
                )}
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
              {/* User Info & Logout */}
              <div className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
                  style={{ backgroundColor: (user?.commune && user.commune !== 'ALL' ? COMMUNE_COLORS[user.commune] : '#64748b') + '30' }}>
                  {user?.role === 'admin' ? '🔐' : '👤'}
                </div>
                <div className="text-right leading-tight">
                  <div className="text-[11px] font-bold text-white">{user?.nom}</div>
                  <div className="text-[9px] text-emerald-200/60">
                    {user?.commune === 'ALL' ? 'مسؤول عام' : COMMUNE_LABELS[user?.commune || ''] || user?.commune}
                  </div>
                </div>
                <button onClick={handleLogout}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-all" title="تسجيل الخروج">
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
      <div className="sm:hidden bg-white/90 backdrop-blur-sm border-b border-slate-100 px-3 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-slate-400 font-bold whitespace-nowrap">🏛️</span>
          {canSeeAllCommunes && (
            <button onClick={() => setSelectedCommune('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${selectedCommune === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-100 text-slate-600'}`}>
              الكل
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
          <div className="flex items-center gap-1 mr-2 pr-2 border-r border-slate-200">
            <span className="text-[10px] text-slate-500 font-bold">{user?.nom}</span>
            <button onClick={handleLogout} className="p-1 hover:bg-slate-100 rounded" title="خروج">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-72 bg-white/80 backdrop-blur-sm border-l border-slate-200/80 flex-col shadow-sm">
          <div className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">نشط</span>
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
                    {user?.commune === 'ALL' ? 'مسؤول عام — صلاحية كاملة' : COMMUNE_LABELS[user?.commune || ''] || user?.commune}
                  </div>
                </div>
                <button onClick={handleLogout} className="p-1.5 hover:bg-white rounded-lg transition-all" title="تسجيل الخروج">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400 hover:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
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
          <div className="p-3 border-t border-slate-100">
            <button
              onClick={() => setCurrentView('settings')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                currentView === 'settings'
                  ? 'bg-gradient-to-l from-slate-600 to-slate-700 text-white shadow-lg'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              <span className="text-lg">⚙️</span>
              <div className="text-right">
                <div>الإعدادات</div>
                <div className={`text-[10px] ${currentView === 'settings' ? 'text-slate-200' : 'text-slate-400'}`}>تهيئة التطبيق</div>
              </div>
            </button>
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
                {currentView === 'dashboard' && <DashboardView stats={stats} onNavigate={setCurrentView} selectedCommune={selectedCommune} canSeeAllCommunes={canSeeAllCommunes} />}
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
                    onEdit={setEditingInterventionId} onRefresh={fetchInterventions} selectedCommune={selectedCommune} />
                )}
                {currentView === 'reports' && <ReportsView stats={stats} selectedCommune={selectedCommune} canSeeAllCommunes={canSeeAllCommunes} />}
                {currentView === 'inventory' && <InventoryView />}
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
            mapClickCoords={mapClickCoords} userCommune={user?.commune || 'ALL'}
            onClose={() => { setIsFormOpen(false); setEditingInterventionId(null); setMapClickCoords(null) }}
            onSave={async () => { await fetchStats(); await fetchInterventions() }} />
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-slate-200 py-3 px-4 mt-auto">
        <div className="max-w-[1800px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <p className="text-xs text-slate-500">© 2025 عمالة سلا — قسم حفظ الصحة والبيئة</p>
          <div className="flex items-center gap-2">
            {user && user.commune !== 'ALL' && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: COMMUNE_COLORS[user.commune] + '15', color: COMMUNE_COLORS[user.commune] }}>
                {COMMUNE_LABELS[user.commune]}
              </span>
            )}
            <p className="text-xs text-emerald-600 font-medium">نظام تدبير عمليات 3D ⚡ مكتب مكافحة الجرذان • مكافحة الحشرات • التطهير</p>
          </div>
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
function DashboardView({ stats, onNavigate, selectedCommune, canSeeAllCommunes }: { stats: Statistics | null; onNavigate: (v: ViewType) => void; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean }) {
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
function MapView({ interventions, quartiers, selectedCommune, canSeeAllCommunes, onMapClick, onRefresh }: { interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean; onMapClick: (lat: number, lng: number, commune: string | null) => void; onRefresh?: () => void }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{ interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: string; onMapClick?: (lat: number, lng: number, commune: string | null) => void; mapClickEnabled?: boolean; showCommunePopups?: boolean; onInterventionCreated?: () => void }> | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hoveredCommune, setHoveredCommune] = useState<string | null>(null)
  const { setSelectedCommune, settings } = useAppStore()

  useEffect(() => {
    import('./map-component').then((mod) => {
      setMapComponent(() => mod.default)
      setMapLoaded(true)
    })
  }, [])

  const COMMUNE_INFO: { name: string; key: string; color: string; population: string; populationMunicipale: string; populationCompteeAPart: string; menages: string; isBouknadel: boolean }[] = [
    { name: 'جماعة سلا', key: 'سلا', color: '#059669', population: '945,101', populationMunicipale: '938,475', populationCompteeAPart: '6,626', menages: '256,144', isBouknadel: false },
    { name: 'جماعة سيدي أبي القنادل', key: 'سيدي أبي القنادل', color: '#7c3aed', population: '43,598', populationMunicipale: '43,550', populationCompteeAPart: '48', menages: '10,439', isBouknadel: true },
    { name: 'جماعة عامر', key: 'عامر', color: '#d97706', population: '75,942', populationMunicipale: '75,896', populationCompteeAPart: '46', menages: '18,540', isBouknadel: false },
  ]

  const totalPopulation = COMMUNE_INFO.reduce((sum, c) => sum + parseInt(c.population.replace(/,/g, '')), 0)
  const activeCommune = COMMUNE_INFO.find(c => c.key === selectedCommune)

  // Intervention counts by type for current filter
  const typeCounts = Object.entries(TYPE_LABELS).map(([key, label]) => ({
    key, label, color: TYPE_COLORS[key], icon: TYPE_ICONS[key],
    count: interventions.filter(i => i.type === key).length,
  }))

  // Status counts
  const statusCounts = Object.entries(STATUT_LABELS).map(([key, label]) => ({
    key, label, color: STATUT_COLORS[key],
    count: interventions.filter(i => i.statut === key).length,
  }))

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] pb-16 lg:pb-0 relative flex">
      {/* Professional Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0, width: sidebarCollapsed ? 56 : 340 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute top-0 right-0 bottom-0 z-20 flex flex-col bg-white/95 backdrop-blur-xl border-l border-slate-200/60 shadow-2xl overflow-hidden"
        style={{ width: sidebarCollapsed ? 56 : 340 }}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-3 left-3 z-30 w-8 h-8 bg-white rounded-lg shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <motion.svg
            animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
            xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor"
          >
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </motion.svg>
        </button>

        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-l from-emerald-800 via-teal-700 to-emerald-900 text-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-lg">🗺️</div>
                <div>
                  <h3 className="font-bold text-sm">الخريطة التفاعلية — SIG</h3>
                  <p className="text-[10px] text-emerald-200/80">نظام المعلومات الجغرافية</p>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2 text-[10px] text-emerald-100/80 space-y-0.5">
                <div>🗺️ حدود سلا — قرار رقم 1954.24 (الجريدة الرسمية عدد 7340)</div>
                <div>👥 السكان — HCP إحصاء 2024</div>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 p-3">
              <div className="bg-emerald-50 rounded-xl p-2 text-center border border-emerald-100">
                <div className="text-lg font-bold text-emerald-700">{interventions.length}</div>
                <div className="text-[9px] text-emerald-600 font-semibold">التدخلات</div>
              </div>
              <div className="bg-violet-50 rounded-xl p-2 text-center border border-violet-100">
                <div className="text-lg font-bold text-violet-700">{quartiers.length}</div>
                <div className="text-[9px] text-violet-600 font-semibold">الأحياء</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-2 text-center border border-amber-100">
                <div className="text-lg font-bold text-amber-700">{COMMUNE_INFO.length}</div>
                <div className="text-[9px] text-amber-600 font-semibold">الجماعات</div>
              </div>
            </div>

            {/* Commune Filter */}
            <div className="px-3 pb-2">
              {canSeeAllCommunes ? (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">🏛️ فلترة الجماعات</p>
                    <span className="text-[9px] text-slate-400">👥 {totalPopulation.toLocaleString('ar-MA')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSelectedCommune('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${selectedCommune === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                      الكل
                    </button>
                    {COMMUNE_INFO.map((info) => (
                      <button key={info.key}
                        onClick={() => setSelectedCommune(selectedCommune === info.key ? 'ALL' : info.key as CommuneType)}
                        onMouseEnter={() => setHoveredCommune(info.key)}
                        onMouseLeave={() => setHoveredCommune(null)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                          selectedCommune === info.key ? 'text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                        style={selectedCommune === info.key ? { backgroundColor: info.color } : {}}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedCommune === info.key ? 'white' : info.color }} />
                        {info.name.replace('جماعة ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">🏛️ جماعتك</p>
                  {activeCommune && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-white font-bold text-sm"
                      style={{ backgroundColor: activeCommune.color }}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                      {activeCommune.name}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Commune Detail */}
            {activeCommune && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 pb-2"
              >
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: activeCommune.color + '40' }}>
                  <div className="px-3 py-2.5 text-white" style={{ background: `linear-gradient(135deg, ${activeCommune.color}, ${activeCommune.color}dd)` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-xs">🏛️</div>
                        <span className="font-bold text-sm">{activeCommune.name}</span>
                      </div>
                      {activeCommune.isBouknadel && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold">مقر المكتب</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-white space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="text-sm font-bold" style={{ color: activeCommune.color }}>{activeCommune.population}</div>
                        <div className="text-[9px] text-slate-500">السكان القانونيون</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="text-sm font-bold" style={{ color: activeCommune.color }}>{activeCommune.menages}</div>
                        <div className="text-[9px] text-slate-500">الأسر</div>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-slate-500">
                      <span>المغاربة: <strong className="text-slate-700">{activeCommune.populationMunicipale}</strong></span>
                      <span>🌍 الأجانب: <strong className="text-slate-700">{activeCommune.populationCompteeAPart}</strong></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Commune Boundaries List */}
            <div className="px-3 pb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">الحدود الترابية • السكان القانونيون 2024</p>
              <div className="space-y-1.5">
                {COMMUNE_INFO.filter(info => canSeeAllCommunes || info.key === selectedCommune).map((info) => (
                  <motion.div
                    key={info.name}
                    onMouseEnter={() => setHoveredCommune(info.key)}
                    onMouseLeave={() => setHoveredCommune(null)}
                    onClick={() => canSeeAllCommunes ? setSelectedCommune(selectedCommune === info.key ? 'ALL' : info.key as CommuneType) : undefined}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-all ${
                      canSeeAllCommunes ? 'cursor-pointer' : ''
                    } ${
                      selectedCommune !== 'ALL' && selectedCommune !== info.key ? 'opacity-40' : 'hover:bg-slate-50'
                    } ${hoveredCommune === info.key ? 'bg-slate-50 ring-1 ring-slate-200' : ''}`}
                  >
                    <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: info.color, backgroundColor: info.color + '20' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-700 font-semibold truncate">{info.name}</span>
                        {info.isBouknadel && <span className="text-[8px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">مقر المكتب</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">👥 {info.population} نسمة</div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 flex-shrink-0">
                      {interventions.length > 0 && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {interventions.length}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Intervention Types */}
            <div className="px-3 pb-2">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">أنواع التدخلات</p>
                <div className="space-y-2">
                  {typeCounts.map((t) => (
                    <div key={t.key} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: t.color + '15' }}>
                        {t.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-600 font-medium">{t.label}</div>
                        <div className="w-full bg-slate-200 rounded-full h-1 mt-0.5">
                          <div className="h-full rounded-full transition-all duration-500" style={{
                            width: `${interventions.length > 0 ? (t.count / interventions.length * 100) : 0}%`,
                            backgroundColor: t.color,
                          }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 min-w-[1.5rem] text-center">{t.count}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 mt-2 pt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">المجموع</span>
                  <span className="text-sm font-bold text-emerald-600">{interventions.length}</span>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="px-3 pb-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">حالات التدخلات</p>
                <div className="flex gap-1.5">
                  {statusCounts.map((s) => (
                    <div key={s.key} className="flex-1 rounded-lg p-1.5 text-center" style={{ backgroundColor: s.color + '12' }}>
                      <div className="text-xs font-bold" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-[8px] text-slate-500 font-medium">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {mapLoaded && MapComponent ? <MapComponent interventions={interventions} quartiers={quartiers} selectedCommune={selectedCommune} onMapClick={onMapClick} mapClickEnabled={settings.mapClickEnabled} showCommunePopups={settings.showCommunePopups} onInterventionCreated={onRefresh} /> : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 font-medium">جاري تحميل الخريطة...</p>
            </div>
          </div>
        )}
        {/* Map click instruction overlay */}
        {settings.mapClickEnabled && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-4 left-4 z-10"
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border border-emerald-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm shadow-md">📍</div>
            <div>
              <p className="text-[11px] font-bold text-emerald-700">انقر على الخريطة لإضافة تدخل</p>
              <p className="text-[9px] text-slate-400">اضغط على أي موقع لملء استمارة التدخل</p>
            </div>
          </div>
        </motion.div>
        )}
      </div>
    </div>
  )
}

// ===== INTERVENTIONS VIEW =====
function InterventionsView({ interventions, total, page, setPage, onEdit, onRefresh, selectedCommune }: {
  interventions: Intervention[]; total: number; page: number; setPage: (p: number) => void
  onEdit: (id: string) => void; onRefresh: () => void; selectedCommune: CommuneType | 'ALL'
}) {
  const [localSearch, setLocalSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState('ALL')
  const [localCommuneFilter, setLocalCommuneFilter] = useState('ALL')

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/interventions/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      onRefresh()
      toast.success('تم حذف التدخل بنجاح')
    } catch (err) { console.error('Delete failed:', err); toast.error('حدث خطأ أثناء الحذف') }
  }

  const filteredInterventions = interventions.filter(i => 
    (filterStatut === 'ALL' || i.statut === filterStatut) && 
    (localCommuneFilter === 'ALL' || i.commune === localCommuneFilter)
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة التدخلات</h2>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-slate-400 text-sm">{total} تدخل مسجل</p>
            {selectedCommune !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
                style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] + '18', color: COMMUNE_COLORS[selectedCommune] }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[selectedCommune] }} />
                {COMMUNE_LABELS[selectedCommune]}
              </span>
            )}
          </div>
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
          <select value={localCommuneFilter} onChange={(e) => setLocalCommuneFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
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
                        {intervention.commune && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: COMMUNE_COLORS[intervention.commune as keyof typeof COMMUNE_COLORS] + '15', color: COMMUNE_COLORS[intervention.commune as keyof typeof COMMUNE_COLORS] }}>
                            {COMMUNE_LABELS[intervention.commune as keyof typeof COMMUNE_LABELS]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{intervention.quartier} — {intervention.adresse}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">📅 {new Date(intervention.date).toLocaleDateString('ar-MA')}</span>
                        <span className="flex items-center gap-1">👤 {intervention.agentNom}</span>
                        {intervention.materials && intervention.materials.length > 0 ? (
                          <span className="flex items-center gap-1">📦 {intervention.materials.map(m => `${m.product.nom} (${m.quantity} ${m.product.unite})`).join('، ')}</span>
                        ) : intervention.produitUtilise ? (
                          <span className="flex items-center gap-1">💊 {intervention.produitUtilise}</span>
                        ) : null}
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

// ===== INVENTORY VIEW =====
interface Product {
  id: string; nom: string; categorie: string; unite: string; quantiteStock: number
  seuilAlerte: number; prixUnitaire: number; fournisseur: string; description: string
  reference: string; commune: string; createdAt: string; updatedAt: string
}

function InventoryView() {
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState({ totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('ALL')
  const [filterCommune, setFilterCommune] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const PRODUCT_CATEGORIES: Record<string, string> = {
    DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم', GENERAL: 'مواد عامة',
  }
  const PRODUCT_ICONS: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴', GENERAL: '📦' }
  const PRODUCT_COLORS: Record<string, string> = { DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981', GENERAL: '#6366f1' }
  const UNITS = ['لتر', 'كيلوغرام', 'علبة', 'وحدة', 'كيس', 'طن', 'ملل']

  const refreshProducts = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => { 
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCategorie !== 'ALL') params.set('categorie', filterCategorie)
        if (searchQuery) params.set('search', searchQuery)
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        const res = await fetch(`/api/products?${params}`)
        const data = await res.json()
        if (!cancelled) {
          setProducts(data.products || [])
          setStats(data.stats || { totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 })
          setIsLoading(false)
        }
      } catch (err) { console.error('Failed to fetch products:', err); if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filterCategorie, searchQuery, filterCommune, refreshKey])

  const handleSave = async (formData: FormData, isEdit: boolean, productId?: string) => {
    const data = {
      nom: formData.get('nom') as string,
      categorie: formData.get('categorie') as string,
      commune: formData.get('commune') as string,
      unite: formData.get('unite') as string,
      quantiteStock: formData.get('quantiteStock') as string,
      seuilAlerte: formData.get('seuilAlerte') as string,
      prixUnitaire: formData.get('prixUnitaire') as string,
      fournisseur: formData.get('fournisseur') as string,
      description: formData.get('description') as string,
    }
    if (!data.nom || !data.categorie) { toast.error('يرجى ملء جميع الحقول المطلوبة'); return }
    try {
      const res = await fetch(isEdit ? `/api/products/${productId}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast.success(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح')
        setShowForm(false); setEditingProduct(null); refreshProducts()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'حدث خطأ')
      }
    } catch { toast.error('حدث خطأ أثناء الحفظ') }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('تم حذف المنتج بنجاح'); refreshProducts() }
      else { toast.error('حدث خطأ أثناء الحذف') }
    } catch { toast.error('حدث خطأ') }
    setShowDeleteConfirm(null)
  }

  const handleStockUpdate = async (id: string, newQty: number) => {
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantiteStock: newQty }),
      })
      refreshProducts()
    } catch { toast.error('حدث خطأ') }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة المخزون</h2>
          <p className="text-slate-500 text-sm mt-1">تدبير المواد والمستلزمات المستعملة في عمليات 3D</p>
        </div>
        <motion.button onClick={() => { setEditingProduct(null); setShowForm(true) }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2 self-start">
          <span className="text-lg">+</span> إضافة منتج جديد
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'إجمالي المنتجات', value: stats.totalProducts, icon: '📦', gradient: 'from-indigo-500 to-indigo-700', shadow: 'shadow-indigo-200' },
          { title: 'قيمة المخزون', value: `${stats.totalStockValue.toLocaleString('ar-MA')} د.م`, icon: '💰', gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200' },
          { title: 'مخزون منخفض', value: stats.lowStockCount, icon: '⚠️', gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-200' },
          { title: 'نفذ المخزون', value: stats.outOfStockCount, icon: '🚫', gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-200' },
        ].map((card, i) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`bg-gradient-to-br ${card.gradient} text-white rounded-2xl p-4 ${card.shadow} shadow-lg relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-6 -translate-y-6" />
            <span className="text-2xl opacity-90">{card.icon}</span>
            <div className="text-2xl font-bold mt-2">{card.value}</div>
            <div className="text-xs opacity-80 mt-1 font-medium">{card.title}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 بحث عن منتج..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCategorie('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterCategorie === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            الكل
          </button>
          {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
            <button key={key} onClick={() => setFilterCategorie(key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterCategorie === key ? 'text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              style={filterCategorie === key ? { backgroundColor: PRODUCT_COLORS[key] } : {}}>
              <span>{PRODUCT_ICONS[key]}</span> {label}
            </button>
          ))}
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
          </select>
        </div>
      </div>

      {/* Products Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <span className="text-4xl mb-2">📦</span>
            <p className="text-sm font-medium">لا توجد منتجات في المخزون</p>
            <button onClick={() => { setEditingProduct(null); setShowForm(true) }}
              className="mt-3 text-xs text-emerald-600 font-bold hover:underline">إضافة منتج جديد</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">المنتج</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">الفئة</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">الجماعة</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الكمية</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الوحدة</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">السعر</th>
                  <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">المورد</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الحالة</th>
                  <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, i) => {
                  const isLow = product.quantiteStock <= product.seuilAlerte && product.quantiteStock > 0
                  const isOut = product.quantiteStock === 0
                  return (
                    <motion.tr key={product.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isOut ? 'bg-red-50/30' : isLow ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                            style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15' }}>
                            {PRODUCT_ICONS[product.categorie]}
                          </div>
                          <div>
                            <div className="font-bold text-slate-700 text-xs">{product.nom}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{product.reference}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15', color: PRODUCT_COLORS[product.categorie] }}>
                          {PRODUCT_CATEGORIES[product.categorie] || product.categorie}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {product.commune ? (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: COMMUNE_COLORS[product.commune as keyof typeof COMMUNE_COLORS] + '15', color: COMMUNE_COLORS[product.commune as keyof typeof COMMUNE_COLORS] || '#64748b' }}>
                            {COMMUNE_LABELS[product.commune as keyof typeof COMMUNE_LABELS] || product.commune}
                          </span>
                        ) : (
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">مشترك</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleStockUpdate(product.id, Math.max(0, product.quantiteStock - 1))}
                            className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold transition-colors flex items-center justify-center">−</button>
                          <span className={`min-w-[2.5rem] text-center font-bold text-sm ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                            {product.quantiteStock}
                          </span>
                          <button onClick={() => handleStockUpdate(product.id, product.quantiteStock + 1)}
                            className="w-6 h-6 rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-600 text-xs font-bold transition-colors flex items-center justify-center">+</button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">{product.unite}</td>
                      <td className="px-4 py-3 text-center text-slate-700 text-xs font-bold">{product.prixUnitaire > 0 ? `${product.prixUnitaire.toLocaleString('ar-MA')} د.م` : '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{product.fournisseur || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        {isOut ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">🚫 نفذ</span> :
                         isLow ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠️ منخفض</span> :
                         <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✅ متوفر</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => { setEditingProduct(product); setShowForm(true) }}
                            className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 text-sm flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                          <button onClick={() => setShowDeleteConfirm(product.id)}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 text-sm flex items-center justify-center transition-colors" title="حذف">🗑️</button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Product Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <ProductFormDialog product={editingProduct} categories={PRODUCT_CATEGORIES} units={UNITS}
            onSave={handleSave} onClose={() => { setShowForm(false); setEditingProduct(null) }} />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🗑️</span></div>
                <h3 className="font-bold text-slate-800 mb-1">حذف المنتج</h3>
                <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button onClick={() => handleDelete(showDeleteConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200">حذف</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== PRODUCT FORM DIALOG =====
function ProductFormDialog({ product, categories, units, onSave, onClose }: {
  product: Product | null; categories: Record<string, string>; units: string[]
  onSave: (formData: FormData, isEdit: boolean, productId?: string) => void; onClose: () => void
}) {
  const isEdit = !!product
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-l from-emerald-600 to-teal-600 p-5 rounded-t-2xl text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
                {isEdit ? '✏️' : '📦'}
              </div>
              <div>
                <h3 className="font-bold text-lg">{isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
                <p className="text-emerald-100 text-xs">{isEdit ? 'تحديث بيانات المنتج' : 'إدخال منتج جديد في المخزون'}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
          </div>
        </div>
        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget), isEdit, product?.id) }}
          className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">* اسم المنتج</label>
              <input name="nom" defaultValue={product?.nom || ''} required placeholder="اسم المنتج أو المادة"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">* الفئة</label>
              <select name="categorie" defaultValue={product?.categorie || ''} required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                <option value="">اختر الفئة</option>
                {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الجماعة</label>
              <select name="commune" defaultValue={product?.commune || ''}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                <option value="">مشترك (كل الجماعات)</option>
                <option value="سلا">جماعة سلا</option>
                <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                <option value="عامر">جماعة عامر</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">وحدة القياس</label>
              <select name="unite" defaultValue={product?.unite || 'لتر'}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الكمية في المخزون</label>
              <input name="quantiteStock" type="number" min="0" defaultValue={product?.quantiteStock ?? 0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">عتبة التنبيه</label>
              <input name="seuilAlerte" type="number" min="0" defaultValue={product?.seuilAlerte ?? 10}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">السعر الوحدة (د.م)</label>
              <input name="prixUnitaire" type="number" min="0" step="0.01" defaultValue={product?.prixUnitaire ?? 0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">المورد</label>
              <input name="fournisseur" defaultValue={product?.fournisseur || ''} placeholder="اسم المورد"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">وصف المنتج</label>
              <textarea name="description" defaultValue={product?.description || ''} rows={2} placeholder="وصف مختصر للمنتج..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-medium text-sm shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all">
              {isEdit ? '💾 تحديث المنتج' : '📦 إضافة المنتج'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ===== REPORTS VIEW =====
function ReportsView({ stats, selectedCommune, canSeeAllCommunes }: { stats: Statistics | null; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean }) {
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

// ===== QUARTIER MANAGEMENT SECTION =====
function QuartierManagementSection() {
  const [quartiers, setQuartiers] = useState<Quartier[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingQuartier, setEditingQuartier] = useState<Quartier | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterCommune, setFilterCommune] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        const res = await fetch(`/api/quartiers?${params}`)
        const data = await res.json()
        if (!cancelled) {
          setQuartiers(data.quartiers || [])
          setIsLoading(false)
        }
      } catch (err) { console.error('Failed to fetch quartiers:', err); if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filterCommune])

  const refreshQuartiers = useCallback(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        const res = await fetch(`/api/quartiers?${params}`)
        const data = await res.json()
        setQuartiers(data.quartiers || [])
      } catch (err) { console.error('Failed to fetch quartiers:', err) }
    }
    load()
  }, [filterCommune])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      nom: form.get('nom') as string,
      commune: form.get('commune') as string,
      latitude: form.get('latitude') as string,
      longitude: form.get('longitude') as string,
    }
    if (!data.nom) { toast.error('يرجى إدخال اسم الحي'); return }
    try {
      const res = await fetch(editingQuartier ? `/api/quartiers/${editingQuartier.id}` : '/api/quartiers', {
        method: editingQuartier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast.success(editingQuartier ? 'تم تحديث الحي بنجاح' : 'تم إضافة الحي بنجاح')
        setShowForm(false); setEditingQuartier(null); refreshQuartiers()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'حدث خطأ')
      }
    } catch { toast.error('حدث خطأ أثناء الحفظ') }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/quartiers/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الحي بنجاح')
        refreshQuartiers()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'حدث خطأ أثناء الحذف')
      }
    } catch { toast.error('حدث خطأ') }
    setDeleteConfirm(null)
  }

  const filteredQuartiers = quartiers.filter(q =>
    !searchQuery || q.nom.includes(searchQuery) || q.commune.includes(searchQuery)
  )

  // Group quartiers by commune
  const groupedQuartiers: Record<string, Quartier[]> = {}
  for (const q of filteredQuartiers) {
    const key = q.commune || 'بدون جماعة'
    if (!groupedQuartiers[key]) groupedQuartiers[key] = []
    groupedQuartiers[key].push(q)
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-l from-teal-600 to-cyan-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">🏘️ إدارة الأحياء</h3>
            <p className="text-teal-200 text-xs mt-0.5">إضافة وتعديل وحذف الأحياء السكنية</p>
          </div>
          <motion.button onClick={() => { setEditingQuartier(null); setShowForm(true) }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-white/30 transition-colors">
            <span>+</span> إضافة حي
          </motion.button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 بحث عن حي..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm" />
          </div>
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500/20">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
          </select>
        </div>

        {/* Stats Row */}
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 border border-teal-100">
            <span className="text-sm">🏘️</span>
            <span className="text-xs font-bold text-teal-700">{quartiers.length} حي</span>
          </div>
          {Object.entries(COMMUNE_LABELS).map(([key, label]) => {
            const count = quartiers.filter(q => q.commune === key).length
            return (
              <div key={key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border"
                style={{ backgroundColor: COMMUNE_COLORS[key as keyof typeof COMMUNE_COLORS] + '08', borderColor: COMMUNE_COLORS[key as keyof typeof COMMUNE_COLORS] + '20' }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[key as keyof typeof COMMUNE_COLORS] }} />
                <span className="text-xs font-bold" style={{ color: COMMUNE_COLORS[key as keyof typeof COMMUNE_COLORS] }}>{count}</span>
              </div>
            )
          })}
        </div>

        {/* Quartier List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filteredQuartiers.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">🏘️</p>
            <p className="text-sm font-medium">لا توجد أحياء</p>
            <button onClick={() => { setEditingQuartier(null); setShowForm(true) }}
              className="mt-2 text-xs text-teal-600 font-bold hover:underline">إضافة حي جديد</button>
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {Object.entries(groupedQuartiers).map(([communeKey, items]) => (
              <div key={communeKey}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: communeKey !== 'بدون جماعة' ? COMMUNE_COLORS[communeKey as keyof typeof COMMUNE_COLORS] || '#64748b' : '#94a3b8' }} />
                  <span className="text-xs font-bold text-slate-600">{communeKey !== 'بدون جماعة' ? COMMUNE_LABELS[communeKey as keyof typeof COMMUNE_LABELS] || communeKey : 'بدون جماعة'}</span>
                  <span className="text-[10px] text-slate-400">({items.length})</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map((q) => (
                    <motion.div key={q.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100 rounded-xl px-3 py-2.5 border border-slate-100 transition-all group">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-sm">📍</span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{q.nom}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{q.latitude.toFixed(4)}, {q.longitude.toFixed(4)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setEditingQuartier(q); setShowForm(true) }}
                          className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 text-xs flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                        <button onClick={() => setDeleteConfirm(q.id)}
                          className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 text-xs flex items-center justify-center transition-colors" title="حذف">🗑️</button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowForm(false); setEditingQuartier(null) }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
              <div className="bg-gradient-to-l from-teal-600 to-cyan-600 p-5 rounded-t-2xl text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
                      {editingQuartier ? '✏️' : '🏘️'}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{editingQuartier ? 'تعديل الحي' : 'إضافة حي جديد'}</h3>
                      <p className="text-teal-100 text-xs">{editingQuartier ? 'تحديث بيانات الحي' : 'إدخال حي سكني جديد'}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowForm(false); setEditingQuartier(null) }}
                    className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
                </div>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">* اسم الحي</label>
                  <input name="nom" defaultValue={editingQuartier?.nom || ''} required placeholder="مثال: حي الأمل"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">الجماعة</label>
                  <select name="commune" defaultValue={editingQuartier?.commune || ''}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm">
                    <option value="">— اختر الجماعة —</option>
                    <option value="سلا">جماعة سلا</option>
                    <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                    <option value="عامر">جماعة عامر</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">خط العرض</label>
                    <input name="latitude" type="number" step="any" defaultValue={editingQuartier?.latitude ?? 34.052} placeholder="34.052"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">خط الطول</label>
                    <input name="longitude" type="number" step="any" defaultValue={editingQuartier?.longitude ?? -6.735} placeholder="-6.735"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditingQuartier(null) }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-teal-600 to-cyan-600 text-white font-medium text-sm shadow-lg shadow-teal-200 hover:shadow-teal-300 transition-all">
                    {editingQuartier ? '💾 تحديث الحي' : '🏘️ إضافة الحي'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🗑️</span></div>
                <h3 className="font-bold text-slate-800 mb-1">حذف الحي</h3>
                <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا الحي؟ التدخلات المرتبطة به لن تُحذف.</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200">حذف</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ===== AGENT MANAGEMENT SECTION =====
function AgentManagementSection() {
  const [agents, setAgents] = useState<{ id: string; nom: string; prenom: string; telephone: string; commune: string; fonction: string; actif: boolean }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingAgent, setEditingAgent] = useState<{ id: string; nom: string; prenom: string; telephone: string; commune: string; fonction: string; actif: boolean } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterCommune, setFilterCommune] = useState('ALL')

  const FONCTION_LABELS: Record<string, string> = {
    'عون صحية': 'عون صحية',
    'مراقب': 'مراقب صحي',
    'مسؤول': 'مسؤول المصالح',
    'تقني': 'تقني',
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        const res = await fetch(`/api/agents?${params}`)
        const data = await res.json()
        if (!cancelled) { setAgents(data.agents || []); setIsLoading(false) }
      } catch { if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filterCommune])

  const refreshAgents = useCallback(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        const res = await fetch(`/api/agents?${params}`)
        const data = await res.json()
        setAgents(data.agents || [])
      } catch { /* */ }
    }
    load()
  }, [filterCommune])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      nom: form.get('nom') as string,
      prenom: form.get('prenom') as string,
      telephone: form.get('telephone') as string,
      commune: form.get('commune') as string,
      fonction: form.get('fonction') as string,
      actif: form.get('actif') === 'on',
    }
    if (!data.nom) { toast.error('يرجى إدخال اسم العون'); return }
    try {
      const res = await fetch(editingAgent ? `/api/agents/${editingAgent.id}` : '/api/agents', {
        method: editingAgent ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        toast.success(editingAgent ? 'تم تحديث العون بنجاح' : 'تم إضافة العون بنجاح')
        setShowForm(false); setEditingAgent(null); refreshAgents()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'حدث خطأ')
      }
    } catch { toast.error('حدث خطأ أثناء الحفظ') }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/agents/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('تم حذف العون بنجاح'); refreshAgents() }
      else { toast.error('حدث خطأ أثناء الحذف') }
    } catch { toast.error('حدث خطأ') }
    setDeleteConfirm(null)
  }

  const handleToggleActive = async (id: string, currentActif: boolean) => {
    try {
      const res = await fetch(`/api/agents/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !currentActif }),
      })
      if (res.ok) { refreshAgents(); toast.success(!currentActif ? 'تم تفعيل العون' : 'تم تعطيل العون') }
    } catch { toast.error('حدث خطأ') }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="bg-gradient-to-l from-orange-600 to-amber-600 text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">👤 إدارة الأعوان</h3>
            <p className="text-amber-200 text-xs mt-0.5">إضافة وتعديل وحذف الأعوان المكلفين بالتدخلات</p>
          </div>
          <motion.button onClick={() => { setEditingAgent(null); setShowForm(true) }}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-white/20 backdrop-blur-sm rounded-xl text-sm font-bold flex items-center gap-1.5 hover:bg-white/30 transition-colors">
            <span>+</span> إضافة عون
          </motion.button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-3">
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
          </select>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100">
            <span className="text-sm">👤</span>
            <span className="text-xs font-bold text-amber-700">{agents.length} عون</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
            <span className="text-sm">✅</span>
            <span className="text-xs font-bold text-emerald-700">{agents.filter(a => a.actif).length} نشط</span>
          </div>
        </div>

        {/* Agent List */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32"><div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : agents.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <p className="text-4xl mb-2">👤</p>
            <p className="text-sm font-medium">لا يوجد أعوان مسجلون</p>
            <button onClick={() => { setEditingAgent(null); setShowForm(true) }}
              className="mt-2 text-xs text-amber-600 font-bold hover:underline">إضافة عون جديد</button>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {agents.map((agent) => (
              <motion.div key={agent.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 border transition-all group ${
                  agent.actif ? 'bg-white border-slate-100 hover:bg-slate-50' : 'bg-slate-50/50 border-slate-100 opacity-60'
                }`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                    agent.actif ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {agent.nom.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-700 truncate">{agent.nom} {agent.prenom}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                        agent.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                      }`}>{agent.actif ? 'نشط' : 'معطل'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>{agent.fonction}</span>
                      {agent.commune && <span>🏛️ {agent.commune}</span>}
                      {agent.telephone && <span>📞 {agent.telephone}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleToggleActive(agent.id, agent.actif)}
                    className="w-7 h-7 rounded-lg hover:bg-emerald-50 text-xs flex items-center justify-center transition-colors"
                    title={agent.actif ? 'تعطيل' : 'تفعيل'}>{agent.actif ? '⏸️' : '▶️'}</button>
                  <button onClick={() => { setEditingAgent(agent); setShowForm(true) }}
                    className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 text-xs flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                  <button onClick={() => setDeleteConfirm(agent.id)}
                    className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 text-xs flex items-center justify-center transition-colors" title="حذف">🗑️</button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => { setShowForm(false); setEditingAgent(null) }}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
              <div className="bg-gradient-to-l from-orange-600 to-amber-600 p-5 rounded-t-2xl text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
                      {editingAgent ? '✏️' : '👤'}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{editingAgent ? 'تعديل العون' : 'إضافة عون جديد'}</h3>
                      <p className="text-amber-100 text-xs">{editingAgent ? 'تحديث بيانات العون' : 'تسجيل عون مكلف بالتدخلات'}</p>
                    </div>
                  </div>
                  <button onClick={() => { setShowForm(false); setEditingAgent(null) }}
                    className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
                </div>
              </div>
              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">* الاسم</label>
                    <input name="nom" defaultValue={editingAgent?.nom || ''} required placeholder="محمد"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اللقب</label>
                    <input name="prenom" defaultValue={editingAgent?.prenom || ''} placeholder="بنعلي"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">📞 رقم الهاتف</label>
                  <input name="telephone" defaultValue={editingAgent?.telephone || ''} placeholder="06XXXXXXXX" dir="ltr"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm text-right" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">🏛️ الجماعة</label>
                    <select name="commune" defaultValue={editingAgent?.commune || ''}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm">
                      <option value="">— اختر —</option>
                      <option value="سلا">جماعة سلا</option>
                      <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                      <option value="عامر">جماعة عامر</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">🎯 الوظيفة</label>
                    <select name="fonction" defaultValue={editingAgent?.fonction || 'عون صحية'}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm">
                      {Object.entries(FONCTION_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input type="checkbox" name="actif" id="agent-actif" defaultChecked={editingAgent?.actif !== false}
                    className="w-4 h-4 rounded accent-amber-600" />
                  <label htmlFor="agent-actif" className="text-sm font-medium text-slate-700">عون نشط</label>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditingAgent(null) }}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button type="submit"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-orange-600 to-amber-600 text-white font-medium text-sm shadow-lg shadow-amber-200 hover:shadow-amber-300 transition-all">
                    {editingAgent ? '💾 تحديث العون' : '👤 إضافة العون'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🗑️</span></div>
                <h3 className="font-bold text-slate-800 mb-1">حذف العون</h3>
                <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا العون؟</p>
                <div className="flex gap-3">
                  <button onClick={() => setDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button onClick={() => handleDelete(deleteConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200">حذف</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ===== USER MANAGEMENT SECTION =====
interface ManagedUser {
  id: string; username: string; nom: string; commune: string; role: string; actif: boolean; lastLogin: string | null; createdAt: string
}

function UserManagementSection() {
  const { user: authUser } = useAppStore()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null)
  const [changingPasswordUser, setChangingPasswordUser] = useState<ManagedUser | null>(null)
  const [filterCommune, setFilterCommune] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    username: '', password: '', nom: '', commune: 'سلا', role: 'responsable',
  })
  const [editFormData, setEditFormData] = useState({
    nom: '', commune: 'سلا', role: 'responsable', actif: true,
  })
  const [newPassword, setNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const canSeeAllCommunes = authUser?.role === 'admin' || authUser?.commune === 'ALL'

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch { /* */ }
    setIsLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Filtered users based on search and commune
  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm || u.nom.includes(searchTerm) || u.username.includes(searchTerm)
    let matchesCommune = filterCommune === 'ALL'
    if (filterCommune === 'ALL_ADMIN') {
      matchesCommune = u.commune === 'ALL'
    } else if (filterCommune !== 'ALL') {
      matchesCommune = u.commune === filterCommune
    }
    return matchesSearch && matchesCommune
  })

  // Group users by commune
  const usersByCommune: Record<string, ManagedUser[]> = {}
  for (const u of filteredUsers) {
    const key = u.commune || 'غير محدد'
    if (!usersByCommune[key]) usersByCommune[key] = []
    usersByCommune[key].push(u)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          nom: formData.nom,
          commune: canSeeAllCommunes ? formData.commune : authUser?.commune,
          role: canSeeAllCommunes ? formData.role : 'responsable',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم إنشاء المستخدم ${formData.nom} بنجاح`)
      setShowAddForm(false)
      setFormData({ username: '', password: '', nom: '', commune: 'سلا', role: 'responsable' })
      await loadUsers()
    } catch {
      setFormError('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFormError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: editFormData.nom,
          commune: canSeeAllCommunes ? editFormData.commune : undefined,
          role: canSeeAllCommunes ? editFormData.role : undefined,
          actif: editFormData.actif,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم تحديث المستخدم ${editFormData.nom} بنجاح`)
      setEditingUser(null)
      await loadUsers()
    } catch {
      setFormError('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/users/${deletingUser.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم حذف المستخدم ${deletingUser.nom} بنجاح`)
      setDeletingUser(null)
      await loadUsers()
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changingPasswordUser) return
    setFormError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/users/${changingPasswordUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم تغيير كلمة مرور ${changingPasswordUser.nom} بنجاح`)
      setChangingPasswordUser(null)
      setNewPassword('')
    } catch {
      setFormError('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (u: ManagedUser) => {
    try {
      const res = await fetch(`/api/auth/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !u.actif }),
      })
      if (res.ok) {
        toast.success(u.actif ? `تم تعطيل ${u.nom}` : `تم تفعيل ${u.nom}`)
        await loadUsers()
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const openEditForm = (u: ManagedUser) => {
    setEditingUser(u)
    setEditFormData({
      nom: u.nom,
      commune: u.commune,
      role: u.role,
      actif: u.actif,
    })
    setFormError('')
  }

  const handleResetUsers = async () => {
    try {
      await fetch('/api/auth/seed-users', { method: 'POST' })
      await loadUsers()
      toast.success('تم إعادة إنشاء المستخدمين الافتراضيين')
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-600">{users.length} مستخدم مسجل</span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-400">{users.filter(u => u.actif).length} نشط</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetUsers}
            className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all border border-slate-200">
            🔄 الافتراضيون
          </button>
          <motion.button onClick={() => { setShowAddForm(true); setFormError(''); setFormData({ username: '', password: '', nom: '', commune: authUser?.commune !== 'ALL' ? authUser?.commune || 'سلا' : 'سلا', role: 'responsable' }) }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="px-4 py-1.5 bg-gradient-to-l from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-200 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            إضافة مستخدم
          </motion.button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو اسم المستخدم..."
            className="w-full pr-9 pl-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
        </div>
        {canSeeAllCommunes && (
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
            <option value="ALL_ADMIN">المسؤولون العامون</option>
          </select>
        )}
      </div>

      {/* Users grouped by commune */}
      {canSeeAllCommunes && filterCommune === 'ALL' ? (
        // Admin: show all grouped by commune
        <div className="space-y-4">
          {Object.entries(usersByCommune).sort(([a], [b]) => {
            if (a === 'ALL') return -1
            if (b === 'ALL') return 1
            return a.localeCompare(b)
          }).map(([commune, communeUsers]) => (
            <div key={commune} className="bg-slate-50/70 rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100"
                style={{ backgroundColor: (commune !== 'ALL' && COMMUNE_COLORS[commune] ? COMMUNE_COLORS[commune] : '#475569') + '10' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ backgroundColor: (commune !== 'ALL' && COMMUNE_COLORS[commune] ? COMMUNE_COLORS[commune] : '#475569') + '20' }}>
                  {commune === 'ALL' ? '🔐' : (COMMUNE_USER_INFO[commune]?.icon || '🏠')}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">
                    {commune === 'ALL' ? 'المسؤولون العامون' : COMMUNE_LABELS[commune] || commune}
                  </div>
                  <div className="text-[10px] text-slate-400">{communeUsers.length} مستخدم</div>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {communeUsers.map(u => (
                  <UserRow key={u.id} user={u} authUser={authUser} canSeeAllCommunes={canSeeAllCommunes}
                    onEdit={() => openEditForm(u)} onToggleActive={() => handleToggleActive(u)}
                    onDelete={() => setDeletingUser(u)} onChangePassword={() => { setChangingPasswordUser(u); setNewPassword(''); setFormError('') }}
                    formatDate={formatDate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Non-admin or filtered: flat list
        <div className="space-y-2">
          {filteredUsers.map(u => (
            <UserRow key={u.id} user={u} authUser={authUser} canSeeAllCommunes={canSeeAllCommunes}
              onEdit={() => openEditForm(u)} onToggleActive={() => handleToggleActive(u)}
              onDelete={() => setDeletingUser(u)} onChangePassword={() => { setChangingPasswordUser(u); setNewPassword(''); setFormError('') }}
              formatDate={formatDate} />
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">لا يوجد مستخدمون مطابقون</div>
          )}
        </div>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
                <h3 className="font-bold text-base">👤 إضافة مستخدم جديد</h3>
                <p className="text-emerald-200 text-xs mt-0.5">إنشاء حساب جديد للوصول إلى النظام</p>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">الاسم الكامل *</label>
                  <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    placeholder="مثال: أحمد بنعلي" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم المستخدم *</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    placeholder="مثال: ahmed" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور *</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    placeholder="4 أحرف على الأقل" />
                </div>
                {canSeeAllCommunes && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الجماعة الترابية</label>
                      <select value={formData.commune} onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                        <option value="ALL">مسؤول عام (كل الجماعات)</option>
                        <option value="سلا">جماعة سلا</option>
                        <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                        <option value="عامر">جماعة عامر</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الدور</label>
                      <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                        <option value="responsable">مسؤول جماعة</option>
                        <option value="admin">مسؤول عام</option>
                      </select>
                    </div>
                  </>
                )}
                {!canSeeAllCommunes && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <div>
                      <div className="text-xs font-bold text-emerald-700">سيتم تعيين هذا المستخدم لجماعة {COMMUNE_LABELS[authUser?.commune || '']}</div>
                      <div className="text-[10px] text-emerald-500">بصفتك مسؤول جماعة، يمكنك فقط إضافة مستخدمين لجماعتك</div>
                    </div>
                  </div>
                )}
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingUser(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-blue-700 to-indigo-700 text-white px-6 py-4">
                <h3 className="font-bold text-base">✏️ تعديل المستخدم</h3>
                <p className="text-blue-200 text-xs mt-0.5">@{editingUser.username}</p>
              </div>
              <form onSubmit={handleEditUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">الاسم الكامل</label>
                  <input type="text" value={editFormData.nom} onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
                </div>
                {canSeeAllCommunes && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الجماعة الترابية</label>
                      <select value={editFormData.commune} onChange={(e) => setEditFormData({ ...editFormData, commune: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
                        <option value="ALL">مسؤول عام (كل الجماعات)</option>
                        <option value="سلا">جماعة سلا</option>
                        <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                        <option value="عامر">جماعة عامر</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الدور</label>
                      <select value={editFormData.role} onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
                        <option value="responsable">مسؤول جماعة</option>
                        <option value="admin">مسؤول عام</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">الحالة</label>
                    <p className="text-[10px] text-slate-400">{editFormData.actif ? 'المستخدم يمكنه الدخول' : 'المستخدم لا يمكنه الدخول'}</p>
                  </div>
                  <button type="button" onClick={() => setEditFormData({ ...editFormData, actif: !editFormData.actif })}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${editFormData.actif ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                      animate={{ left: editFormData.actif ? '2rem' : '0.25rem' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                  </button>
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {changingPasswordUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setChangingPasswordUser(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-amber-600 to-orange-600 text-white px-6 py-4">
                <h3 className="font-bold text-base">🔑 تغيير كلمة المرور</h3>
                <p className="text-amber-200 text-xs mt-0.5">{changingPasswordUser.nom} — @{changingPasswordUser.username}</p>
              </div>
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور الجديدة</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
                    placeholder="4 أحرف على الأقل" />
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setChangingPasswordUser(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={isSubmitting || newPassword.length < 4}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-amber-600 to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingUser(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-red-600 to-rose-600 text-white px-6 py-4">
                <h3 className="font-bold text-base">⚠️ تأكيد الحذف</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <div className="text-lg mb-2">🗑️</div>
                  <p className="text-sm font-bold text-red-800">
                    هل أنت متأكد من حذف المستخدم
                  </p>
                  <p className="text-base font-extrabold text-red-600 mt-1">{deletingUser.nom}</p>
                  <p className="text-xs text-red-400 mt-0.5">@{deletingUser.username}</p>
                </div>
                <p className="text-xs text-slate-400 text-center">هذا الإجراء لا يمكن التراجع عنه</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeletingUser(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button onClick={handleDeleteUser} disabled={isSubmitting}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري الحذف...' : 'حذف نهائي'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Default login info */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-amber-800 mb-2">🔑 معلومات الدخول الافتراضية</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(COMMUNE_USER_INFO).map(([key, info]) => (
            <div key={key} className="bg-white rounded-lg p-2.5 border border-amber-100">
              <div className="font-bold text-slate-700 mb-1" style={{ color: info.color }}>
                {COMMUNE_LABELS[key]}
              </div>
              <div className="text-slate-500">المستخدم: <span className="font-mono text-slate-700" dir="ltr">{info.username}</span></div>
              <div className="text-slate-500">كلمة المرور: <span className="font-mono text-slate-700" dir="ltr">{info.password}</span></div>
            </div>
          ))}
          <div className="bg-white rounded-lg p-2.5 border border-amber-100">
            <div className="font-bold text-slate-700 mb-1">🔐 المسؤول العام</div>
            <div className="text-slate-500">المستخدم: <span className="font-mono text-slate-700" dir="ltr">admin</span></div>
            <div className="text-slate-500">كلمة المرور: <span className="font-mono text-slate-700" dir="ltr">admin123</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ===== USER ROW COMPONENT =====
function UserRow({ user, authUser, canSeeAllCommunes, onEdit, onToggleActive, onDelete, onChangePassword, formatDate }: {
  user: ManagedUser; authUser: AuthUser | null; canSeeAllCommunes: boolean
  onEdit: () => void; onToggleActive: () => void; onDelete: () => void; onChangePassword: () => void
  formatDate: (d: string | null) => string
}) {
  const [showActions, setShowActions] = useState(false)
  const isSelf = user.id === authUser?.id
  const canEdit = canSeeAllCommunes || user.commune === authUser?.commune

  return (
    <div className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50/80 transition-colors group relative">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
        style={{ backgroundColor: (user.commune !== 'ALL' ? COMMUNE_COLORS[user.commune] || '#64748b' : '#475569') + '15' }}>
        {user.role === 'admin' ? '🔐' : '👤'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 truncate">{user.nom}</span>
          {isSelf && (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">أنت</span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span dir="ltr">@{user.username}</span>
          <span className="text-slate-200">•</span>
          <span>{user.commune === 'ALL' ? 'مسؤول عام' : COMMUNE_LABELS[user.commune] || user.commune}</span>
          {user.lastLogin && (
            <>
              <span className="text-slate-200">•</span>
              <span>آخر دخول: {formatDate(user.lastLogin)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {user.actif ? 'نشط' : 'معطل'}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
          {user.role === 'admin' ? 'مسؤول' : 'مسؤول جماعة'}
        </span>
      </div>
      {/* Actions dropdown */}
      {canEdit && (
        <div className="relative">
          <button onClick={() => setShowActions(!showActions)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          <AnimatePresence>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20 min-w-[180px]">
                  <button onClick={() => { onEdit(); setShowActions(false) }}
                    className="w-full text-right px-4 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                    ✏️ تعديل
                  </button>
                  <button onClick={() => { onChangePassword(); setShowActions(false) }}
                    className="w-full text-right px-4 py-2 text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors">
                    🔑 تغيير كلمة المرور
                  </button>
                  <button onClick={() => { onToggleActive(); setShowActions(false) }}
                    className="w-full text-right px-4 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                    {user.actif ? '🚫 تعطيل' : '✅ تفعيل'}
                  </button>
                  {!isSelf && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={() => { onDelete(); setShowActions(false) }}
                        className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                        🗑️ حذف
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ===== USERS VIEW =====
function UsersView() {
  const { user: authUser } = useAppStore()

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-200">
            👥
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">إدارة المستخدمين</h2>
            <p className="text-slate-500 text-sm mt-0.5">الحسابات المرخصة للدخول لكل جماعة ترابية</p>
          </div>
        </div>
      </motion.div>

      {/* Current user card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner"
            style={{ backgroundColor: (authUser?.commune !== 'ALL' ? COMMUNE_COLORS[authUser?.commune || ''] || '#475569' : '#475569') + '20' }}>
            {authUser?.role === 'admin' ? '🔐' : '👤'}
          </div>
          <div className="flex-1">
            <div className="font-bold text-slate-700">{authUser?.nom}</div>
            <div className="text-xs text-slate-400">
              @{authUser?.username} • {authUser?.commune === 'ALL' ? 'مسؤول عام — صلاحية كاملة' : COMMUNE_LABELS[authUser?.commune || ''] || authUser?.commune}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-600">متصل</span>
          </div>
        </div>
      </motion.div>

      {/* User management section */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
          <h3 className="font-bold text-base">👥 الحسابات المرخصة</h3>
          <p className="text-emerald-200 text-xs mt-0.5">
            {authUser?.role === 'admin'
              ? 'يمكنك إدارة جميع حسابات المستخدمين عبر الجماعات'
              : `يمكنك إدارة حسابات مستخدمي جماعة ${COMMUNE_LABELS[authUser?.commune || '']} فقط`}
          </p>
        </div>
        <div className="p-6">
          <UserManagementSection />
        </div>
      </motion.div>
    </div>
  )
}

// ===== SETTINGS VIEW =====
function SettingsView() {
  const { settings, updateSettings, resetSettings, saveSettings, loadSettings, settingsCommune, settingsLoaded, setSelectedYear, setSelectedCommune, user } = useAppStore()
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmResetData, setConfirmResetData] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isAdminViewingCommune, setIsAdminViewingCommune] = useState<string | null>(null)

  // For admin users: allow switching which commune's settings to view/edit
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'
  const currentSettingsCommune = isAdminViewingCommune || settingsCommune || user?.commune || 'ALL'

  // Load settings on mount
  useEffect(() => {
    if (!settingsLoaded) {
      loadSettings(user?.commune !== 'ALL' ? user?.commune : undefined)
    }
  }, [settingsLoaded, loadSettings, user?.commune])

  // Admin: load different commune's settings
  const handleAdminSwitchCommune = async (commune: string) => {
    setIsAdminViewingCommune(commune === 'ALL' ? null : commune)
    await loadSettings(commune === 'ALL' ? undefined : commune)
  }

  // Auto-save settings with debounce
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const handleUpdateAndSave = (partial: Partial<typeof settings>) => {
    updateSettings(partial)
    // Debounce save: 800ms after last change
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const ok = await saveSettings()
      if (!ok) toast.error('حدث خطأ أثناء حفظ الإعدادات')
    }, 800)
  }

  const handleApplyDefaults = () => {
    setSelectedYear(settings.defaultYear)
    setSelectedCommune(settings.defaultCommune)
    toast.success('تم تطبيق الإعدادات الافتراضية')
  }

  const handleResetData = async () => {
    try {
      await fetch('/api/seed', { method: 'POST' })
      setConfirmResetData(false)
      toast.success('تم إعادة تهيئة البيانات بنجاح')
    } catch {
      toast.error('حدث خطأ أثناء إعادة التهيئة')
    }
  }

  const handleDeleteAllData = async () => {
    try {
      const res = await fetch('/api/statistics')
      const data = await res.json()
      if (data.recent) {
        for (const intervention of data.recent) {
          await fetch(`/api/interventions/${intervention.id}`, { method: 'DELETE' })
        }
      }
      setConfirmResetData(false)
      toast.success('تم حذف جميع البيانات')
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6 max-w-4xl">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h2 className="text-2xl font-bold text-slate-800">⚙️ الإعدادات</h2>
        <p className="text-slate-500 text-sm mt-1">تهيئة مكونات التطبيق وتخصيص الإعدادات</p>
      </motion.div>

      {/* Commune Settings Selector — for admin users */}
      {canSeeAllCommunes && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
            <h3 className="font-bold text-base">🏛️ إعدادات الجماعة</h3>
            <p className="text-emerald-200 text-xs mt-0.5">كل جماعة لها إعداداتها المنفصلة — اختر الجماعة لتعديل إعداداتها</p>
          </div>
          <div className="p-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'ALL', label: 'عام (المشترك)', icon: '🌐', color: '#475569' },
                { key: 'سلا', label: 'جماعة سلا', icon: '🏙️', color: '#059669' },
                { key: 'سيدي أبي القنادل', label: 'جماعة سيدي أبي القنادل', icon: '🏘️', color: '#7c3aed' },
                { key: 'عامر', label: 'جماعة عامر', icon: '🌄', color: '#d97706' },
              ].map((c) => (
                <button key={c.key}
                  onClick={() => handleAdminSwitchCommune(c.key)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    currentSettingsCommune === c.key
                      ? 'text-white shadow-lg'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                  style={currentSettingsCommune === c.key ? { backgroundColor: c.color } : {}}>
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Current commune indicator — for non-admin users */}
      {!canSeeAllCommunes && user?.commune && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="flex items-center gap-3 bg-white rounded-xl border border-slate-100 shadow-sm px-4 py-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
            style={{ backgroundColor: (COMMUNE_COLORS[user.commune] || '#475569') + '20' }}>
            {COMMUNE_USER_INFO[user.commune]?.icon || '🏠'}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-700">إعدادات {COMMUNE_LABELS[user.commune] || user.commune}</div>
            <div className="text-[11px] text-slate-400">هذه الإعدادات خاصة بجماعتك فقط</div>
          </div>
          <div className="mr-auto">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </motion.div>
      )}

      {/* User Management — prominent section */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
          <h3 className="font-bold text-base">👥 إدارة المستخدمين</h3>
          <p className="text-emerald-200 text-xs mt-0.5">الحسابات المرخصة للدخول لكل جماعة</p>
        </div>
        <div className="p-6">
          <UserManagementSection />
        </div>
      </motion.div>

      {/* General Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-slate-700 to-slate-800 text-white px-6 py-4">
          <h3 className="font-bold text-base">🏠 الإعدادات العامة</h3>
          <p className="text-slate-300 text-xs mt-0.5">الإعدادات الأساسية للتطبيق</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Default Year */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📅 السنة الافتراضية</label>
              <p className="text-xs text-slate-400 mt-0.5">السنة المعروضة عند فتح التطبيق</p>
            </div>
            <select value={settings.defaultYear} onChange={(e) => handleUpdateAndSave({ defaultYear: e.target.value })}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 w-full sm:w-40">
              <option value="">الكل</option>
              {getYearOptions(10).map((y) => (
                <option key={y.value} value={y.value}>{y.label}</option>
              ))}
            </select>
          </div>

          <div className="border-t border-slate-100" />

          {/* Default Commune */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">🏛️ الجماعة الافتراضية</label>
              <p className="text-xs text-slate-400 mt-0.5">الجماعة المعروضة عند فتح التطبيق</p>
            </div>
            {!canSeeAllCommunes ? (
              <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[user?.commune || ''] || '#475569' }} />
                <span className="text-sm font-medium text-slate-700">{COMMUNE_LABELS[user?.commune || ''] || user?.commune}</span>
                <span className="text-[10px] text-slate-400">(ثابت)</span>
              </div>
            ) : (
              <select value={settings.defaultCommune} onChange={(e) => handleUpdateAndSave({ defaultCommune: e.target.value as CommuneType | 'ALL' })}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 w-full sm:w-48">
                <option value="ALL">كل الجماعات</option>
                <option value="سلا">جماعة سلا</option>
                <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                <option value="عامر">جماعة عامر</option>
              </select>
            )}
          </div>

          <div className="border-t border-slate-100" />

          {/* Interventions Per Page */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📋 عدد التدخلات في كل صفحة</label>
              <p className="text-xs text-slate-400 mt-0.5">الحد الأقصى للتدخلات المعروضة</p>
            </div>
            <select value={settings.interventionsPerPage} onChange={(e) => handleUpdateAndSave({ interventionsPerPage: parseInt(e.target.value) })}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 w-full sm:w-40">
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
          </div>

          <div className="border-t border-slate-100" />

          {/* Apply Defaults Button */}
          <div className="flex justify-end">
            <motion.button onClick={handleApplyDefaults} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-colors">
              ✓ تطبيق الإعدادات الافتراضية الآن
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Map Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-blue-600 to-cyan-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">🗺️ إعدادات الخريطة</h3>
          <p className="text-blue-200 text-xs mt-0.5">تخصيص عرض الخريطة SIG</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Default Tile */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">🗺️ نوع الخريطة الافتراضية</label>
              <p className="text-xs text-slate-400 mt-0.5">نوع الخريطة المعروضة عند فتح صفحة الخريطة</p>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'light' as const, label: 'خريطة عادية', icon: '🗺️' },
                { value: 'satellite' as const, label: 'صورة ساتلية', icon: '🛰️' },
              ].map((tile) => (
                <button key={tile.value} onClick={() => handleUpdateAndSave({ mapDefaultTile: tile.value })}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                    settings.mapDefaultTile === tile.value
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}>
                  <span>{tile.icon}</span>
                  {tile.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Map Click to Add */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📍 إضافة تدخل بالنقر على الخريطة</label>
              <p className="text-xs text-slate-400 mt-0.5">تفعيل أو تعطيل إمكانية إضافة تدخل جديد بالضغط على موقع في الخريطة</p>
            </div>
            <button onClick={() => handleUpdateAndSave({ mapClickEnabled: !settings.mapClickEnabled })}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${settings.mapClickEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: settings.mapClickEnabled ? '2rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* Commune Boundary Popups */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">🏛️ نوافذ الحدود الإدارية الترابية</label>
              <p className="text-xs text-slate-400 mt-0.5">عرض أو إخفاء النوافذ المنبثقة عند النقر على حدود الجماعات</p>
            </div>
            <button onClick={() => handleUpdateAndSave({ showCommunePopups: !settings.showCommunePopups })}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${settings.showCommunePopups ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: settings.showCommunePopups ? '2rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* Cluster Radius */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">🔵 نصف قطر التجميع</label>
              <p className="text-xs text-slate-400 mt-0.5">المسافة القصوى لتجميع العلامات المتقاربة (بكسل)</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input type="range" min="20" max="120" step="10" value={settings.mapClusterRadius}
                onChange={(e) => handleUpdateAndSave({ mapClusterRadius: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
              <span className="text-sm font-bold text-slate-700 bg-slate-50 px-3 py-1 rounded-lg min-w-[3rem] text-center">{settings.mapClusterRadius}</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Display Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-purple-600 to-pink-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">🎨 إعدادات العرض</h3>
          <p className="text-purple-200 text-xs mt-0.5">تخصيص المظهر والرسوم المتحركة</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Animations */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">✨ الرسوم المتحركة</label>
              <p className="text-xs text-slate-400 mt-0.5">تفعيل أو تعطيل التأثيرات الحركية في التطبيق</p>
            </div>
            <button onClick={() => handleUpdateAndSave({ animationsEnabled: !settings.animationsEnabled })}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${settings.animationsEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: settings.animationsEnabled ? '2rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* Font Size */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📝 حجم الخط</label>
              <p className="text-xs text-slate-400 mt-0.5">حجم النصوص في التطبيق</p>
            </div>
            <div className="flex gap-2">
              {[
                { value: 'small' as const, label: 'صغير', icon: '🔤' },
                { value: 'medium' as const, label: 'متوسط', icon: '🔠' },
                { value: 'large' as const, label: 'كبير', icon: '🔡' },
              ].map((opt) => (
                <button key={opt.value} onClick={() => handleUpdateAndSave({ fontSize: opt.value })}
                  className={`px-3 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${
                    settings.fontSize === opt.value
                      ? 'bg-purple-600 text-white shadow-lg shadow-purple-200'
                      : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}>
                  <span className="text-xs">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Compact Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📐 الوضع المضغوط</label>
              <p className="text-xs text-slate-400 mt-0.5">تقليل المسافات لعرض بيانات أكثر</p>
            </div>
            <button onClick={() => handleUpdateAndSave({ compactMode: !settings.compactMode })}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${settings.compactMode ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: settings.compactMode ? '2rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Alert Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-rose-600 to-red-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">🔔 إعدادات التنبيهات</h3>
          <p className="text-rose-200 text-xs mt-0.5">تنبيهات المخزون والمواعيد</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Stock Alert */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📦 تنبيه المخزون المنخفض</label>
              <p className="text-xs text-slate-400 mt-0.5">تنبيه عند انخفاض كمية مادة في المخزون عن العتبة</p>
            </div>
            <button onClick={() => handleUpdateAndSave({ stockAlertEnabled: !settings.stockAlertEnabled })}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${settings.stockAlertEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: settings.stockAlertEnabled ? '2rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* Stock Alert Threshold */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📊 عتبة تنبيه المخزون</label>
              <p className="text-xs text-slate-400 mt-0.5">الحد الأدنى قبل إطلاق التنبيه</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input type="range" min="1" max="50" step="1" value={settings.stockAlertThreshold}
                onChange={(e) => handleUpdateAndSave({ stockAlertThreshold: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
              <span className="text-sm font-bold text-slate-700 bg-slate-50 px-3 py-1 rounded-lg min-w-[3rem] text-center">{settings.stockAlertThreshold}</span>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Deadline Reminder */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">⏰ تذكير المواعيد</label>
              <p className="text-xs text-slate-400 mt-0.5">تذكير بالتدخلات المبرمجة قبل موعدها</p>
            </div>
            <button onClick={() => handleUpdateAndSave({ deadlineReminderEnabled: !settings.deadlineReminderEnabled })}
              className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${settings.deadlineReminderEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
              <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ left: settings.deadlineReminderEnabled ? '2rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
            </button>
          </div>

          <div className="border-t border-slate-100" />

          {/* Deadline Reminder Days */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">📅 أيام قبل التذكير</label>
              <p className="text-xs text-slate-400 mt-0.5">عدد الأيام قبل موعد التدخل للتنبيه</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-64">
              <input type="range" min="1" max="14" step="1" value={settings.deadlineReminderDays}
                onChange={(e) => handleUpdateAndSave({ deadlineReminderDays: parseInt(e.target.value) })}
                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-rose-600" />
              <span className="text-sm font-bold text-slate-700 bg-slate-50 px-3 py-1 rounded-lg min-w-[3rem] text-center">{settings.deadlineReminderDays} يوم</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Agent Management */}
      <AgentManagementSection />

      {/* Data Export */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-indigo-600 to-violet-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">📤 تصدير البيانات</h3>
          <p className="text-indigo-200 text-xs mt-0.5">تصدير التدخلات والتقارير بتنسيقات مختلفة</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Export CSV */}
            <motion.button onClick={() => {
              const params = new URLSearchParams({ format: 'csv' })
              if (settings.defaultYear) params.set('year', settings.defaultYear)
              if (settings.defaultCommune !== 'ALL') params.set('commune', settings.defaultCommune)
              window.open(`/api/export?${params.toString()}`, '_blank')
              toast.success('جاري تحميل ملف CSV...')
            }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📊</div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-700">تصدير CSV</div>
                <div className="text-[11px] text-slate-400">ملف جدول بيانات متوافق مع Excel</div>
              </div>
            </motion.button>

            {/* Export JSON */}
            <motion.button onClick={() => {
              const params = new URLSearchParams({ format: 'json' })
              if (settings.defaultYear) params.set('year', settings.defaultYear)
              if (settings.defaultCommune !== 'ALL') params.set('commune', settings.defaultCommune)
              window.open(`/api/export?${params.toString()}`, '_blank')
              toast.success('جاري تحميل ملف JSON...')
            }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📋</div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-700">تصدير JSON</div>
                <div className="text-[11px] text-slate-400">بيانات مهيكلة للمطورين</div>
              </div>
            </motion.button>
          </div>

          {/* Export options info */}
          <div className="bg-slate-50 rounded-xl p-3.5 flex items-start gap-3">
            <span className="text-lg mt-0.5">💡</span>
            <div className="text-xs text-slate-500 leading-relaxed">
              <strong className="text-slate-600">ملاحظة:</strong> يتم تصدير البيانات حسب السنة والجماعة المختارة حالياً. يمكنك تغيير الفلترات قبل التصدير.
            </div>
          </div>
        </div>
      </motion.div>

      {/* Backup & Restore */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-cyan-600 to-sky-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">💾 النسخ الاحتياطي</h3>
          <p className="text-cyan-200 text-xs mt-0.5">حفظ واستعادة بيانات التطبيق</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Backup */}
            <motion.button onClick={async () => {
              try {
                const [interventions, products, quartiers, agents] = await Promise.all([
                  fetch('/api/export?format=json').then(r => r.json()),
                  fetch('/api/products').then(r => r.json()),
                  fetch('/api/quartiers').then(r => r.json()),
                  fetch('/api/agents').then(r => r.json()),
                ])
                const backup = {
                  version: '2.0',
                  date: new Date().toISOString(),
                  interventions,
                  products: products.products || [],
                  quartiers: quartiers.quartiers || [],
                  agents: agents.agents || [],
                  settings,
                }
                const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `backup-3d-${new Date().toISOString().split('T')[0]}.json`
                a.click(); URL.revokeObjectURL(url)
                toast.success('تم تحميل النسخة الاحتياطية بنجاح')
              } catch { toast.error('حدث خطأ أثناء النسخ الاحتياطي') }
            }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-cyan-50 border border-cyan-100 hover:bg-cyan-100/70 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-cyan-200/70 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">💾</div>
              <div className="text-right">
                <div className="text-sm font-bold text-cyan-800">إنشاء نسخة احتياطية</div>
                <div className="text-[11px] text-cyan-600">تحميل جميع البيانات كملف JSON</div>
              </div>
            </motion.button>

            {/* Restore */}
            <motion.button onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'; input.accept = '.json'
              input.onchange = async (e) => {
                const file = (e.target as HTMLInputElement).files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const backup = JSON.parse(text)
                  if (!backup.version) { toast.error('ملف النسخة الاحتياطية غير صالح'); return }
                  toast.success(`تم العثور على ${backup.interventions?.total || 0} تدخل، ${backup.quartiers?.length || 0} حي، ${backup.agents?.length || 0} عون`)
                } catch { toast.error('حدث خطأ أثناء قراءة الملف') }
              }
              input.click()
            }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100/70 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-slate-200/70 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📂</div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-700">استعادة من نسخة</div>
                <div className="text-[11px] text-slate-500">استيراد بيانات من ملف احتياطي</div>
              </div>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Data Management */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-amber-600 to-orange-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">🗄️ إدارة البيانات</h3>
          <p className="text-amber-200 text-xs mt-0.5">إعادة تهيئة وإدارة بيانات التطبيق</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Re-seed Data */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">🔄 إعادة تهيئة البيانات</label>
              <p className="text-xs text-slate-400 mt-0.5">إعادة إنشاء البيانات التجريبية (الأحياء، الوكلاء، التدخلات)</p>
            </div>
            {confirmResetData ? (
              <div className="flex gap-2">
                <motion.button onClick={handleResetData} whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-medium shadow-lg">
                  ⚠️ تأكيد
                </motion.button>
                <button onClick={() => setConfirmResetData(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">
                  إلغاء
                </button>
              </div>
            ) : (
              <motion.button onClick={() => setConfirmResetData(true)} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="px-5 py-2.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-sm font-medium hover:bg-amber-100 transition-colors">
                🔄 إعادة تهيئة
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quartier Management */}
      <QuartierManagementSection />

      {/* Reset Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="bg-white rounded-2xl border border-red-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-red-600 to-rose-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">⚠️ منطقة الخطر</h3>
          <p className="text-red-200 text-xs mt-0.5">إجراءات لا يمكن التراجع عنها</p>
        </div>
        <div className="p-6 space-y-5">
          {/* Reset All Settings */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-sm font-semibold text-slate-700">🔁 إعادة ضبط الإعدادات</label>
              <p className="text-xs text-slate-400 mt-0.5">استعادة جميع الإعدادات إلى قيمها الافتراضية</p>
            </div>
            {confirmReset ? (
              <div className="flex gap-2">
                <motion.button onClick={async () => { const ok = await resetSettings(); setConfirmReset(false); toast.success(ok ? 'تم إعادة ضبط الإعدادات' : 'حدث خطأ أثناء إعادة الضبط') }} whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-medium shadow-lg">
                  ⚠️ تأكيد
                </motion.button>
                <button onClick={() => setConfirmReset(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium">
                  إلغاء
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmReset(true)}
                className="px-5 py-2.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm font-medium hover:bg-red-100 transition-colors">
                🔁 إعادة ضبط
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* About — moved to end */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
          <h3 className="font-bold text-base">ℹ️ حول التطبيق</h3>
          <p className="text-emerald-200 text-xs mt-0.5">معلومات النظام</p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'اسم التطبيق', value: 'عمالة سلا — قسم حفظ الصحة والبيئة' },
              { label: 'الإصدار', value: '2.0.0' },
              { label: 'المصالح', value: 'مكتب مكافحة الجرذان • مكافحة الحشرات • التطهير' },
              { label: 'الحدود الترابية', value: 'قرار رقم 1954.24 — الجريدة الرسمية عدد 7340' },
              { label: 'السكان', value: 'RGPH 2024 — HCP المندوبية السامية للتخطيط' },
              { label: 'التطوير', value: 'Nabil EL BOUOSSI — 2026' },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.05 }}
                className="bg-slate-50 rounded-xl p-3.5">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</div>
                <div className="text-sm font-semibold text-slate-700 mt-1">{item.value}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ===== FORM DIALOG =====
interface DropdownProduct {
  id: string; nom: string; categorie: string; unite: string; quantiteStock: number; prixUnitaire: number; reference: string
}

function InterventionFormDialog({ interventionId, quartiers, mapClickCoords, userCommune, onClose, onSave }: {
  interventionId: string | null; quartiers: Quartier[]
  mapClickCoords: MapClickCoords | null; userCommune: string
  onClose: () => void; onSave: () => Promise<void>
}) {
  // For non-admin users, always use their assigned commune
  const enforcedCommune = userCommune !== 'ALL' ? userCommune : (mapClickCoords?.commune || '')

  const [formData, setFormData] = useState({
    type: 'DERATISATION', date: new Date().toISOString().split('T')[0],
    quartier: '', adresse: '', commune: enforcedCommune,
    latitude: mapClickCoords ? mapClickCoords.latitude.toString() : '34.052', 
    longitude: mapClickCoords ? mapClickCoords.longitude.toString() : '-6.735',
    statut: 'PLANIFIEE', description: '', agentNom: '', produitUtilise: '',
    quantite: '', superficie: '', nombrePrestations: '1', observations: '',
  })
  const [materials, setMaterials] = useState<{ productId: string; quantity: number }[]>([])
  const [dropdownProducts, setDropdownProducts] = useState<DropdownProduct[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(false)

  // Load products for dropdown
  useEffect(() => {
    fetch('/api/products/for-dropdown').then(res => res.json()).then(data => {
      setDropdownProducts(data.products || [])
    }).catch(console.error)
  }, [])

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
          quartier: data.quartier, adresse: data.adresse, commune: data.commune || '',
          latitude: data.latitude.toString(), longitude: data.longitude.toString(),
          statut: data.statut, description: data.description || '', agentNom: data.agentNom,
          produitUtilise: data.produitUtilise || '', quantite: data.quantite || '',
          superficie: data.superficie || '', nombrePrestations: data.nombrePrestations?.toString() || '1',
          observations: data.observations || '',
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
