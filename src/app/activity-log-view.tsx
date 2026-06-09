'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ACTIVITY_ACTION_LABELS, ACTIVITY_ACTION_COLORS, ACTIVITY_ACTION_ICONS,
  ENTITY_TYPE_LABELS, ENTITY_TYPE_ICONS,
} from '@/lib/constants'

// ===== TYPES =====
interface ActivityLog {
  id: string
  userId: string | null
  userName: string
  action: string
  entityType: string
  entityId: string | null
  details: string
  commune: string
  ipAddress: string | null
  createdAt: string
}

// ===== HELPERS =====
function formatRelativeTime(dateStr: string): string {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffWeek = Math.floor(diffDay / 7)
  const diffMonth = Math.floor(diffDay / 30)

  if (diffSec < 60) return 'الآن'
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`
  if (diffHour < 24) return `منذ ${diffHour} ساعة`
  if (diffDay < 7) return `منذ ${diffDay} يوم`
  if (diffWeek < 4) return `منذ ${diffWeek} أسبوع`
  if (diffMonth < 12) return `منذ ${diffMonth} شهر`
  return date.toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatFullDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('ar-MA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ===== MAIN COMPONENT =====
export default function ActivityLogView({ commune }: { commune: string }) {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('ALL')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 30
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchLogs = useCallback(async (newOffset = 0, append = false) => {
    try {
      if (!append) setIsLoading(true)
      else setIsLoadingMore(true)
      setError(null)

      const params = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: newOffset.toString(),
      })
      if (commune && commune !== 'ALL') params.set('commune', commune)
      if (actionFilter !== 'ALL') params.set('action', actionFilter)
      if (entityFilter !== 'ALL') params.set('entityType', entityFilter)

      const res = await fetch(`/api/activity-log?${params}`)
      if (!res.ok) throw new Error('فشل في تحميل السجل')
      const data = await res.json()

      if (append) {
        setLogs(prev => [...prev, ...data.logs])
      } else {
        setLogs(data.logs)
      }
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع')
    } finally {
      setIsLoading(false)
      setIsLoadingMore(false)
    }
  }, [commune, actionFilter, entityFilter])

  // Initial fetch + refetch on filter changes
  useEffect(() => {
    setOffset(0)
    fetchLogs(0, false)
  }, [fetchLogs])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    refreshIntervalRef.current = setInterval(() => {
      fetchLogs(0, false)
    }, 30000)
    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current)
    }
  }, [fetchLogs])

  const handleLoadMore = () => {
    const newOffset = offset + PAGE_SIZE
    setOffset(newOffset)
    fetchLogs(newOffset, true)
  }

  const hasMore = logs.length < total

  // Group logs by date
  const groupedLogs = logs.reduce<Record<string, ActivityLog[]>>((acc, log) => {
    const d = new Date(log.createdAt)
    const key = d.toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })
    if (!acc[key]) acc[key] = []
    acc[key].push(log)
    return acc
  }, {})

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
            📜 سجل النشاط
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تتبع جميع العمليات المنجزة في النظام
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-refresh indicator */}
          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            تحديث تلقائي
          </div>
          <button
            onClick={() => fetchLogs(0, false)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
            </svg>
            تحديث
          </button>
        </div>
      </motion.div>

      {/* Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm"
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">🔄 نوع العملية:</span>
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setOffset(0) }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-emerald-400 transition-colors"
            >
              <option value="ALL">الكل</option>
              {Object.entries(ACTIVITY_ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{ACTIVITY_ACTION_ICONS[key]} {label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500">📦 نوع الكيان:</span>
            <select
              value={entityFilter}
              onChange={(e) => { setEntityFilter(e.target.value); setOffset(0) }}
              className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 bg-white outline-none focus:border-emerald-400 transition-colors"
            >
              <option value="ALL">الكل</option>
              {Object.entries(ENTITY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{ENTITY_TYPE_ICONS[key]} {label}</option>
              ))}
            </select>
          </div>
          <div className="mr-auto text-xs text-slate-400">
            {total} سجل{total !== 1 ? 'ات' : ''}
          </div>
        </div>
      </motion.div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-slate-100 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-5 rounded-full bg-slate-100 animate-pulse" />
                    <div className="w-12 h-4 rounded bg-slate-100 animate-pulse" />
                  </div>
                  <div className="w-3/4 h-4 rounded bg-slate-100 animate-pulse" />
                  <div className="w-1/3 h-3 rounded bg-slate-100 animate-pulse" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : error ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl border border-red-200 p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-red-600 font-bold text-lg mb-2">حدث خطأ في تحميل السجل</p>
          <p className="text-red-400 text-sm mb-4">{error}</p>
          <button
            onClick={() => fetchLogs(0, false)}
            className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-bold hover:bg-red-100 transition-colors"
          >
            🔄 إعادة المحاولة
          </button>
        </motion.div>
      ) : logs.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-xl border border-slate-200/80 p-12 text-center"
        >
          <div className="w-24 h-24 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-6">
            <span className="text-5xl">📜</span>
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">لا توجد سجلات نشاط</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            لم يتم تسجيل أي نشاط بعد. ستظهر سجلات النشاط هنا بمجرد بدء استخدام النظام.
          </p>
          {(actionFilter !== 'ALL' || entityFilter !== 'ALL') && (
            <button
              onClick={() => { setActionFilter('ALL'); setEntityFilter('ALL') }}
              className="mt-4 px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-200 transition-colors"
            >
              🔄 إعادة تعيين الفلاتر
            </button>
          )}
        </motion.div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {Object.entries(groupedLogs).map(([dateGroup, dateLogs], groupIdx) => (
              <motion.div
                key={dateGroup}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIdx * 0.05 }}
                className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden"
              >
                {/* Date header */}
                <div className="bg-gradient-to-l from-slate-50 to-slate-100/50 px-4 py-2.5 border-b border-slate-200/60">
                  <h3 className="text-sm font-bold text-slate-600 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                    </svg>
                    {dateGroup}
                  </h3>
                </div>

                {/* Log entries */}
                <div className="p-4">
                  <div className="relative">
                    {/* Timeline vertical line */}
                    <div className="absolute right-[15px] top-2 bottom-2 w-px bg-slate-200/80" />

                    <div className="space-y-1">
                      {dateLogs.map((log, logIdx) => {
                        const actionColor = ACTIVITY_ACTION_COLORS[log.action] || '#6b7280'
                        const actionLabel = ACTIVITY_ACTION_LABELS[log.action] || log.action
                        const actionIcon = ACTIVITY_ACTION_ICONS[log.action] || '📌'
                        const entityLabel = ENTITY_TYPE_LABELS[log.entityType] || log.entityType
                        const entityIcon = ENTITY_TYPE_ICONS[log.entityType] || '📄'

                        return (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: logIdx * 0.03, duration: 0.25 }}
                            className="flex items-start gap-3 relative pb-4 group"
                          >
                            {/* Timeline dot */}
                            <div
                              className="relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 transition-transform group-hover:scale-110"
                              style={{ backgroundColor: actionColor + '15', color: actionColor }}
                            >
                              {actionIcon}
                            </div>
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                  style={{ backgroundColor: actionColor + '15', color: actionColor }}
                                >
                                  {actionLabel}
                                </span>
                                <span className="text-xs text-slate-500">
                                  {entityIcon} {entityLabel}
                                </span>
                              </div>
                              <p className="text-sm text-slate-700 mt-1 leading-relaxed">
                                <span className="font-semibold">{log.userName || 'مستخدم مجهول'}</span>
                                {' — '}
                                {log.details || 'لا توجد تفاصيل'}
                              </p>
                              <div className="flex items-center gap-3 mt-0.5">
                                <p className="text-[10px] text-slate-400" title={formatFullDate(log.createdAt)}>
                                  {formatRelativeTime(log.createdAt)}
                                </p>
                                {log.commune && (
                                  <span className="text-[10px] text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                                    {log.commune}
                                  </span>
                                )}
                                {log.ipAddress && (
                                  <span className="text-[10px] text-slate-300 font-mono" dir="ltr">
                                    {log.ipAddress}
                                  </span>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Load More */}
          {hasMore && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center"
            >
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingMore ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-300 border-t-transparent rounded-full animate-spin" />
                    جاري التحميل...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    عرض المزيد ({total - logs.length} متبقي)
                  </>
                )}
              </button>
            </motion.div>
          )}
        </div>
      )}
    </div>
  )
}
