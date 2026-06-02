'use client'

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type CommuneType } from '@/lib/store'
import { toast } from 'sonner'

// ===== TYPE DEFINITIONS =====
type NotificationCategory = 'urgent' | 'warning' | 'info' | 'success'

interface Notification {
  id: string
  category: NotificationCategory
  icon: string
  title: string
  description: string
  timestamp: Date
  commune: string
  actionLabel: string
  actionType: 'product' | 'intervention' | 'document'
  actionId: string
}

interface ProductRecord {
  id: string
  nom: string
  categorie: string
  commune: string
  unite: string
  quantiteStock: number
  seuilAlerte: number
  prixUnitaire: number
  fournisseur: string
  description: string
  reference: string
  createdAt: string
  updatedAt: string
}

interface InterventionRecord {
  id: string
  type: string
  date: string
  quartier: string
  adresse: string
  commune: string
  statut: string
  description: string
  agentNom: string
  reference: string
  createdAt: string
  updatedAt: string
}

interface DocumentRecord {
  id: string
  titre: string
  description: string
  categorie: string
  commune: string
  createdAt: string
  updatedAt: string
}

// ===== CONSTANTS =====
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

const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
}

const CATEGORY_CONFIG: Record<NotificationCategory, { label: string; emoji: string; color: string; bgColor: string; borderColor: string }> = {
  urgent: { label: 'عاجل', emoji: '🔴', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fca5a5' },
  warning: { label: 'تحذير', emoji: '🟡', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fcd34d' },
  info: { label: 'معلومة', emoji: '🔵', color: '#2563eb', bgColor: '#eff6ff', borderColor: '#93c5fd' },
  success: { label: 'نجاح', emoji: '🟢', color: '#059669', bgColor: '#ecfdf5', borderColor: '#6ee7b7' },
}

const CATEGORY_FILTERS: { id: 'all' | NotificationCategory; label: string; emoji: string }[] = [
  { id: 'all', label: 'الكل', emoji: '📋' },
  { id: 'urgent', label: 'عاجل', emoji: '🔴' },
  { id: 'warning', label: 'تحذير', emoji: '🟡' },
  { id: 'info', label: 'معلومة', emoji: '🔵' },
  { id: 'success', label: 'نجاح', emoji: '🟢' },
]

const NOTIFICATIONS_READ_KEY = 'notifications-read'

// ===== HELPER FUNCTIONS =====
function getReadState(): Set<string> {
  try {
    if (typeof window === 'undefined') return new Set()
    const stored = localStorage.getItem(NOTIFICATIONS_READ_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveReadState(readSet: Set<string>) {
  try {
    localStorage.setItem(NOTIFICATIONS_READ_KEY, JSON.stringify([...readSet]))
  } catch { /* ignore */ }
}

function relativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`
  if (diffMin < 120) return 'منذ ساعة'
  if (diffHour < 24) return `منذ ${diffHour} ساعة`
  if (diffDay === 1) return 'منذ يوم'
  if (diffDay === 2) return 'منذ يومين'
  if (diffDay < 7) return `منذ ${diffDay} أيام`
  if (diffDay < 30) return `منذ ${Math.floor(diffDay / 7)} أسبوع`
  return date.toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' })
}

function daysBetween(date1: Date, date2: Date): number {
  const diffTime = date2.getTime() - date1.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// ===== MAIN COMPONENT =====
export default function NotificationsView() {
  const { user, selectedCommune } = useAppStore()
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'
  const effectiveCommune = canSeeAllCommunes ? selectedCommune : (user?.commune as CommuneType || 'ALL')

  // State
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<'all' | NotificationCategory>('all')
  const [readIds, setReadIds] = useState<Set<string>>(() => getReadState())
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [notifSettings, setNotifSettings] = useState(() => {
    try {
      if (typeof window === 'undefined') return { stockAlerts: true, overdueAlerts: true, upcomingReminders: true, reminderDays: 3 }
      const stored = localStorage.getItem('notification-settings')
      if (stored) return JSON.parse(stored)
    } catch { /* ignore */ }
    return { stockAlerts: true, overdueAlerts: true, upcomingReminders: true, reminderDays: 3 }
  })

  // Refresh counter — incremented to trigger data fetches
  const [refreshKey, setRefreshKey] = useState(0)

  // Fetch data and generate notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (effectiveCommune && effectiveCommune !== 'ALL') params.set('commune', effectiveCommune)

      const [productsRes, interventionsRes, documentsRes] = await Promise.all([
        fetch(`/api/products?${params.toString()}`).catch(() => null),
        fetch(`/api/interventions?${params.toString()}&limit=100`).catch(() => null),
        fetch(`/api/documents?${params.toString()}`).catch(() => null),
      ])

      const productsData = productsRes?.ok ? await productsRes.json() : { products: [] }
      const interventionsData = interventionsRes?.ok ? await interventionsRes.json() : { interventions: [] }
      const documentsData = documentsRes?.ok ? await documentsRes.json() : { documents: [] }

      const products: ProductRecord[] = productsData.products || []
      const interventions: InterventionRecord[] = interventionsData.interventions || []
      const documents: DocumentRecord[] = documentsData.documents || []

      const generated: Notification[] = []
      const now = new Date()

      // === Stock Critical (quantiteStock === 0) ===
      if (notifSettings.stockAlerts) {
        products
          .filter(p => p.quantiteStock === 0)
          .forEach(p => {
            generated.push({
              id: `stock-critical-${p.id}`,
              category: 'urgent',
              icon: '🔴',
              title: 'نفاد المخزون',
              description: `${p.nom} — يجب إعادة التوريد فوراً`,
              timestamp: new Date(p.updatedAt),
              commune: p.commune,
              actionLabel: 'عرض المنتج',
              actionType: 'product',
              actionId: p.id,
            })
          })

        // === Stock Low (quantiteStock <= seuilAlerte && > 0) ===
        products
          .filter(p => p.quantiteStock > 0 && p.quantiteStock <= p.seuilAlerte)
          .forEach(p => {
            generated.push({
              id: `stock-low-${p.id}`,
              category: 'warning',
              icon: '⚠️',
              title: 'المخزون منخفض',
              description: `${p.nom} — الكمية المتبقية: ${p.quantiteStock} ${p.unite} (عتبة التنبيه: ${p.seuilAlerte})`,
              timestamp: new Date(p.updatedAt),
              commune: p.commune,
              actionLabel: 'عرض المنتج',
              actionType: 'product',
              actionId: p.id,
            })
          })
      }

      // === Overdue Interventions (PLANIFIEE/EN_COURS with date < today) ===
      if (notifSettings.overdueAlerts) {
        interventions
          .filter(i => (i.statut === 'PLANIFIEE' || i.statut === 'EN_COURS') && new Date(i.date) < now)
          .forEach(i => {
            const daysLate = daysBetween(new Date(i.date), now)
            const typeLabel = TYPE_LABELS[i.type] || i.type
            generated.push({
              id: `overdue-${i.id}`,
              category: 'urgent',
              icon: '⏰',
              title: 'تدخل متأخر',
              description: `${typeLabel} في ${i.quartier} — متأخر ${daysLate} يوم`,
              timestamp: new Date(i.updatedAt),
              commune: i.commune,
              actionLabel: 'عرض التدخل',
              actionType: 'intervention',
              actionId: i.id,
            })
          })
      }

      // === Upcoming Interventions (PLANIFIEE within next N days) ===
      if (notifSettings.upcomingReminders) {
        const reminderDays = notifSettings.reminderDays
        interventions
          .filter(i => {
            if (i.statut !== 'PLANIFIEE') return false
            const iDate = new Date(i.date)
            const daysAhead = daysBetween(now, iDate)
            return daysAhead >= 0 && daysAhead <= reminderDays
          })
          .forEach(i => {
            const typeLabel = TYPE_LABELS[i.type] || i.type
            const iDate = new Date(i.date)
            const formattedDate = iDate.toLocaleDateString('ar-MA', { month: 'short', day: 'numeric' })
            generated.push({
              id: `upcoming-${i.id}`,
              category: 'info',
              icon: '📅',
              title: 'تدخل مبرمج',
              description: `${typeLabel} في ${i.quartier} — ${formattedDate}`,
              timestamp: new Date(i.updatedAt),
              commune: i.commune,
              actionLabel: 'عرض التدخل',
              actionType: 'intervention',
              actionId: i.id,
            })
          })
      }

      // === Recent Completions (TERMINEE in last 2 days) ===
      interventions
        .filter(i => {
          if (i.statut !== 'TERMINEE') return false
          const updatedAt = new Date(i.updatedAt)
          const diffDays = daysBetween(updatedAt, now)
          return diffDays >= 0 && diffDays <= 2
        })
        .forEach(i => {
          const typeLabel = TYPE_LABELS[i.type] || i.type
          generated.push({
            id: `completed-${i.id}`,
            category: 'success',
            icon: '✅',
            title: 'تم إنجاز تدخل',
            description: `${typeLabel} في ${i.quartier}`,
            timestamp: new Date(i.updatedAt),
            commune: i.commune,
            actionLabel: 'عرض التدخل',
            actionType: 'intervention',
            actionId: i.id,
          })
        })

      // === New Documents (created in last 3 days) ===
      documents
        .filter(d => {
          const created = new Date(d.createdAt)
          const diffDays = daysBetween(created, now)
          return diffDays >= 0 && diffDays <= 3
        })
        .forEach(d => {
          generated.push({
            id: `doc-new-${d.id}`,
            category: 'info',
            icon: '📄',
            title: 'مستند جديد',
            description: d.titre,
            timestamp: new Date(d.createdAt),
            commune: d.commune,
            actionLabel: 'عرض المستند',
            actionType: 'document',
            actionId: d.id,
          })
        })

      // Sort by timestamp descending
      generated.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      setNotifications(generated)
    } catch (err) {
      console.error('Failed to fetch notifications:', err)
    }
    setIsLoading(false)
  }, [effectiveCommune, notifSettings.stockAlerts, notifSettings.overdueAlerts, notifSettings.upcomingReminders, notifSettings.reminderDays])

  // Data fetching: triggered by refreshKey and fetchNotifications changes
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      await fetchNotifications()
      void cancelled
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey, fetchNotifications])

  // Auto-refresh every 30 seconds — only increments the counter
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Save settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('notification-settings', JSON.stringify(notifSettings))
    } catch { /* ignore */ }
  }, [notifSettings])

  // Sync read state to localStorage
  useEffect(() => {
    saveReadState(readIds)
  }, [readIds])

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications
    return notifications.filter(n => n.category === activeFilter)
  }, [notifications, activeFilter])

  // Stats
  const stats = useMemo(() => {
    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length
    const byCategory = {
      urgent: notifications.filter(n => n.category === 'urgent').length,
      warning: notifications.filter(n => n.category === 'warning').length,
      info: notifications.filter(n => n.category === 'info').length,
      success: notifications.filter(n => n.category === 'success').length,
    }
    const unreadByCategory = {
      urgent: notifications.filter(n => n.category === 'urgent' && !readIds.has(n.id)).length,
      warning: notifications.filter(n => n.category === 'warning' && !readIds.has(n.id)).length,
      info: notifications.filter(n => n.category === 'info' && !readIds.has(n.id)).length,
      success: notifications.filter(n => n.category === 'success' && !readIds.has(n.id)).length,
    }
    return { total: notifications.length, unreadCount, byCategory, unreadByCategory }
  }, [notifications, readIds])

  // Handlers
  const toggleRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const markAllAsRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)))
    toast.success('تم تحديد الكل كمقروء')
  }

  const handleAction = (notif: Notification) => {
    const { setCurrentView } = useAppStore.getState()
    if (notif.actionType === 'product') {
      setCurrentView('inventory')
    } else if (notif.actionType === 'intervention') {
      setCurrentView('interventions')
    } else if (notif.actionType === 'document') {
      setCurrentView('documents')
    }
    // Mark as read on action
    toggleRead(notif.id)
  }

  // ===== RENDER =====
  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>🔔</span> مركز الإشعارات
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {stats.total} إشعار — {stats.unreadCount} غير مقروء
          </p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={markAllAsRead}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            disabled={stats.unreadCount === 0}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-medium text-sm hover:border-emerald-300 hover:text-emerald-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            تحديد الكل كمقروء
          </motion.button>
          <motion.button
            onClick={() => setSettingsOpen(!settingsOpen)}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-xl font-medium text-sm hover:border-emerald-300 hover:text-emerald-700 transition-all flex items-center gap-2 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
            الإعدادات
          </motion.button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { key: 'urgent' as const, label: 'عاجل', icon: '🔴', count: stats.byCategory.urgent, unread: stats.unreadByCategory.urgent },
          { key: 'warning' as const, label: 'تحذير', icon: '🟡', count: stats.byCategory.warning, unread: stats.unreadByCategory.warning },
          { key: 'info' as const, label: 'معلومة', icon: '🔵', count: stats.byCategory.info, unread: stats.unreadByCategory.info },
          { key: 'success' as const, label: 'نجاح', icon: '🟢', count: stats.byCategory.success, unread: stats.unreadByCategory.success },
        ]).map((cat, i) => (
          <motion.div
            key={cat.key}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 cursor-pointer hover:shadow-md transition-all"
            onClick={() => setActiveFilter(activeFilter === cat.key ? 'all' : cat.key)}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-slate-400 font-medium">{cat.label}</p>
                <p className="text-2xl font-extrabold mt-1" style={{ color: CATEGORY_CONFIG[cat.key].color }}>
                  {cat.count}
                </p>
                {cat.unread > 0 && (
                  <p className="text-[10px] font-medium mt-0.5" style={{ color: CATEGORY_CONFIG[cat.key].color }}>
                    {cat.unread} غير مقروء
                  </p>
                )}
              </div>
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl"
                style={{ backgroundColor: CATEGORY_CONFIG[cat.key].bgColor }}
              >
                {cat.icon}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Notification Settings (Collapsible) */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
                إعدادات الإشعارات
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Stock alerts toggle */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 group hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📦</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">تنبيهات المخزون</p>
                      <p className="text-[11px] text-slate-400">إشعارات انخفاض ونفاد المخزون</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifSettings(prev => ({ ...prev, stockAlerts: !prev.stockAlerts }))}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${notifSettings.stockAlerts ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifSettings.stockAlerts ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Overdue alerts toggle */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 group hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⏰</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">تنبيهات التأخير</p>
                      <p className="text-[11px] text-slate-400">تدخلات متأخرة عن الموعد</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifSettings(prev => ({ ...prev, overdueAlerts: !prev.overdueAlerts }))}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${notifSettings.overdueAlerts ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifSettings.overdueAlerts ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Upcoming reminders toggle */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3 group hover:bg-slate-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📅</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">تذكيرات التدخلات</p>
                      <p className="text-[11px] text-slate-400">تذكير بالتدخلات المبرمجة</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNotifSettings(prev => ({ ...prev, upcomingReminders: !prev.upcomingReminders }))}
                    className={`w-11 h-6 rounded-full relative transition-colors cursor-pointer ${notifSettings.upcomingReminders ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  >
                    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifSettings.upcomingReminders ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {/* Reminder days slider */}
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xl">🔢</span>
                    <div>
                      <p className="text-sm font-medium text-slate-700">أيام التذكير المسبق</p>
                      <p className="text-[11px] text-slate-400">عدد الأيام قبل التدخل للتذكير</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={7}
                      value={notifSettings.reminderDays}
                      onChange={(e) => setNotifSettings(prev => ({ ...prev, reminderDays: parseInt(e.target.value) }))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-sm font-bold text-emerald-700 min-w-[2rem] text-center">{notifSettings.reminderDays}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORY_FILTERS.map((filter) => {
          const count = filter.id === 'all'
            ? stats.total
            : stats.byCategory[filter.id as NotificationCategory]
          const unreadCount = filter.id === 'all'
            ? stats.unreadCount
            : stats.unreadByCategory[filter.id as NotificationCategory]

          return (
            <motion.button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${
                activeFilter === filter.id
                  ? 'bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <span>{filter.emoji}</span>
              <span>{filter.label}</span>
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  activeFilter === filter.id ? 'bg-white/20' : 'bg-slate-100'
                }`}>
                  {count}
                </span>
              )}
              {unreadCount > 0 && (
                <span className={`w-2 h-2 rounded-full ${
                  activeFilter === filter.id ? 'bg-white' : 'bg-red-500'
                }`} />
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل الإشعارات...</p>
          </div>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center"
        >
          <div className="text-6xl mb-4">🔔</div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">
            {activeFilter !== 'all' ? 'لا توجد إشعارات في هذه الفئة' : 'لا توجد إشعارات'}
          </h3>
          <p className="text-sm text-slate-500">
            {activeFilter !== 'all'
              ? 'جرب تصفية أخرى أو تحقق لاحقاً'
              : 'النظام يعمل بشكل طبيعي. ستظهر الإشعارات هنا عند الحاجة.'
            }
          </p>
        </motion.div>
      ) : (
        <div className="space-y-3 max-h-[calc(100vh-380px)] overflow-y-auto custom-scrollbar pr-1">
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((notif, i) => {
              const isRead = readIds.has(notif.id)
              const catConfig = CATEGORY_CONFIG[notif.category]

              return (
                <motion.div
                  key={notif.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20, height: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.25 }}
                  className={`bg-white rounded-2xl shadow-sm border overflow-hidden hover:shadow-md transition-all group ${
                    isRead ? 'border-slate-100' : 'border-slate-200'
                  }`}
                  style={{
                    borderRightWidth: '4px',
                    borderRightColor: catConfig.color,
                    backgroundColor: isRead ? 'white' : catConfig.bgColor,
                  }}
                >
                  <div className="p-4 flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                      style={{ backgroundColor: catConfig.bgColor }}
                    >
                      {notif.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className={`text-sm font-bold ${isRead ? 'text-slate-600' : 'text-slate-800'}`}>
                            {notif.title}
                          </h4>
                          <p className={`text-xs mt-0.5 ${isRead ? 'text-slate-400' : 'text-slate-600'}`}>
                            {notif.description}
                          </p>
                        </div>
                        {/* Unread indicator */}
                        {!isRead && (
                          <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: catConfig.color }} />
                        )}
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Timestamp */}
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                          {relativeTime(notif.timestamp)}
                        </span>

                        {/* Commune badge */}
                        {notif.commune && COMMUNE_COLORS[notif.commune] && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                            style={{ backgroundColor: COMMUNE_COLORS[notif.commune] }}
                          >
                            {COMMUNE_LABELS[notif.commune] || notif.commune}
                          </span>
                        )}

                        {/* Category badge */}
                        <span
                          className="text-[10px] font-medium px-2 py-0.5 rounded-md"
                          style={{ backgroundColor: catConfig.bgColor, color: catConfig.color }}
                        >
                          {catConfig.emoji} {catConfig.label}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <motion.button
                        onClick={() => handleAction(notif)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-all"
                        style={{
                          backgroundColor: catConfig.bgColor,
                          color: catConfig.color,
                        }}
                      >
                        {notif.actionLabel}
                      </motion.button>
                      <button
                        onClick={() => toggleRead(notif.id)}
                        className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                        title={isRead ? 'تحديد كغير مقروء' : 'تحديد كمقروء'}
                      >
                        {isRead ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Auto-refresh indicator */}
      <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400 pt-2">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>تحديث تلقائي كل 30 ثانية</span>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
    </div>
  )
}
