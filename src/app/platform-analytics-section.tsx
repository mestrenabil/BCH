'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

type AnalyticsData = {
  periodDays: number
  generatedAt: string
  summary: {
    totalVisits: number
    uniqueVisitors: number
    publicSiteVisits: number
    reportVisits: number
    completedPublicReports: number
    reportConversionRate: number
    platformVisits: number
    loginEvents: number
    onlineNow: number
    liveVisitors: number
    livePublicVisitors: number
    inactiveAccounts: number
    changePercent: number
  }
  daily: Array<{ date: string; publicSite: number; reports: number; platform: number }>
  communes: Array<{ commune: string; visits: number; visitors: number }>
  pages: Array<{ path: string; visits: number; visitors: number }>
  devices: Array<{ device: string; visits: number }>
  referrers: Array<{ source: string; visits: number }>
  users: Array<{
    id: string
    username: string
    nom: string
    role: string
    commune: string
    actif: boolean
    lastLogin: string | null
    lastSeen: string | null
    platformVisits: number
    logins: number
  }>
}

const PERIODS = [
  { value: 7, label: '7 أيام' },
  { value: 30, label: '30 يوماً' },
  { value: 90, label: '3 أشهر' },
  { value: 365, label: 'سنة' },
]

const DEVICE_LABELS: Record<string, { label: string; icon: string }> = {
  DESKTOP: { label: 'حاسوب', icon: '🖥️' },
  MOBILE: { label: 'هاتف', icon: '📱' },
  TABLET: { label: 'لوحة', icon: '📟' },
  BOT: { label: 'محرك آلي', icon: '🤖' },
  UNKNOWN: { label: 'غير محدد', icon: '❔' },
}

const PAGE_LABELS: Record<string, string> = {
  '/': 'الواجهة العمومية',
  '/signaler': 'التبليغ الموحد',
  '/signalerfood': 'بلاغ السلامة الغذائية',
  '/signaler-animal': 'بلاغ الحيوانات الشاردة',
}

const CARD_TONE_CLASSES: Record<string, { container: string; value: string }> = {
  blue: { container: 'border-blue-100 bg-blue-50/60', value: 'text-blue-700' },
  violet: { container: 'border-violet-100 bg-violet-50/60', value: 'text-violet-700' },
  cyan: { container: 'border-cyan-100 bg-cyan-50/60', value: 'text-cyan-700' },
  emerald: { container: 'border-emerald-100 bg-emerald-50/60', value: 'text-emerald-700' },
  amber: { container: 'border-amber-100 bg-amber-50/60', value: 'text-amber-700' },
  indigo: { container: 'border-indigo-100 bg-indigo-50/60', value: 'text-indigo-700' },
  green: { container: 'border-green-100 bg-green-50/60', value: 'text-green-700' },
  rose: { container: 'border-rose-100 bg-rose-50/60', value: 'text-rose-700' },
}

function pageLabel(path: string): string {
  if (PAGE_LABELS[path]) return PAGE_LABELS[path]
  if (path.startsWith('/app/')) return `المنصة — ${path.slice(5)}`
  return path
}

function formatDate(value: string | null): string {
  if (!value) return 'لم يسجل الدخول'
  return new Intl.DateTimeFormat('ar-MA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function number(value: number): string {
  return new Intl.NumberFormat('ar-MA').format(value)
}

export function PlatformAnalyticsSection() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const response = await fetch(`/api/platform-analytics?days=${days}`, { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'تعذر تحميل الإحصائيات')
      setData(result)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'تعذر تحميل الإحصائيات')
    } finally {
      if (silent) setRefreshing(false)
      else setLoading(false)
    }
  }, [days])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => void load(true), 15_000)
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void load(true)
    }
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [autoRefresh, load])

  const visibleDaily = useMemo(() => {
    if (!data) return []
    if (data.daily.length <= 31) return data.daily
    const step = Math.ceil(data.daily.length / 31)
    const grouped: AnalyticsData['daily'] = []
    for (let index = 0; index < data.daily.length; index += step) {
      const slice = data.daily.slice(index, index + step)
      grouped.push({
        date: slice[0].date,
        publicSite: slice.reduce((sum, row) => sum + row.publicSite, 0),
        reports: slice.reduce((sum, row) => sum + row.reports, 0),
        platform: slice.reduce((sum, row) => sum + row.platform, 0),
      })
    }
    return grouped
  }, [data])

  const maxDaily = Math.max(1, ...visibleDaily.map((row) => row.publicSite + row.reports + row.platform))
  const maxCommune = Math.max(1, ...(data?.communes.map((item) => item.visits) || [1]))

  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm"
    >
      <div className="bg-gradient-to-l from-violet-800 via-indigo-700 to-blue-700 px-6 py-5 text-white">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-bold">📊 إحصائيات استعمال المنصة</h3>
            <p className="mt-1 text-xs text-indigo-100">الزيارات العمومية، صفحات التبليغ، ودخول مسؤولي الجماعات</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((current) => !current)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${autoRefresh ? 'border-emerald-300/40 bg-emerald-400/20 text-emerald-50' : 'border-white/20 bg-white/10 text-indigo-100'}`}
              aria-pressed={autoRefresh}
            >
              <span className={`h-2 w-2 rounded-full ${autoRefresh ? 'animate-pulse bg-emerald-300' : 'bg-slate-300'}`} />
              {autoRefresh ? 'مباشر · كل 15 ثانية' : 'التحديث المباشر متوقف'}
            </button>
            <select
              value={days}
              onChange={(event) => setDays(Number(event.target.value))}
              className="rounded-xl border border-white/20 bg-white/15 px-3 py-2 text-xs font-bold text-white outline-none backdrop-blur [&>option]:text-slate-800"
              aria-label="الفترة الإحصائية"
            >
              {PERIODS.map((period) => <option key={period.value} value={period.value}>{period.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || refreshing}
              className="rounded-xl border border-white/20 bg-white/15 px-3 py-2 text-xs font-bold transition hover:bg-white/25 disabled:opacity-60"
            >
              {loading || refreshing ? 'جارٍ التحديث…' : '↻ تحديث'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4 sm:p-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
            ⚠️ {error}
          </div>
        )}

        {loading && !data ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[
                { label: 'مجموع الزيارات', value: data.summary.totalVisits, icon: '👁️', tone: 'blue' },
                { label: 'زوار فريدون', value: data.summary.uniqueVisitors, icon: '👤', tone: 'violet' },
                { label: 'زوار المنصة الآن', value: data.summary.liveVisitors, icon: '🟢', tone: 'green' },
                { label: 'زوار عموميون الآن', value: data.summary.livePublicVisitors, icon: '🌍', tone: 'emerald' },
                { label: 'الواجهة العمومية', value: data.summary.publicSiteVisits, icon: '🌐', tone: 'cyan' },
                { label: 'صفحات التبليغ', value: data.summary.reportVisits, icon: '📍', tone: 'emerald' },
                { label: 'بلاغات عمومية مكتملة', value: data.summary.completedPublicReports, icon: '✅', tone: 'green' },
                { label: 'تحويل الزيارة إلى بلاغ', value: `${data.summary.reportConversionRate}%`, icon: '🎯', tone: 'cyan' },
                { label: 'زيارات المنصة الداخلية', value: data.summary.platformVisits, icon: '🏛️', tone: 'amber' },
                { label: 'عمليات تسجيل الدخول', value: data.summary.loginEvents, icon: '🔐', tone: 'indigo' },
                { label: 'مسؤولون نشطون الآن', value: data.summary.onlineNow, icon: '🧑‍💼', tone: 'green' },
                { label: 'حسابات بلا دخول منذ 30 يوماً', value: data.summary.inactiveAccounts, icon: '⏳', tone: 'rose' },
                {
                  label: 'مقارنة بالفترة السابقة',
                  value: `${data.summary.changePercent > 0 ? '+' : ''}${data.summary.changePercent}%`,
                  icon: data.summary.changePercent >= 0 ? '↗️' : '↘️',
                  tone: data.summary.changePercent >= 0 ? 'green' : 'rose',
                },
              ].map((card) => {
                const tone = CARD_TONE_CLASSES[card.tone] || CARD_TONE_CLASSES.blue
                return (
                  <div key={card.label} className={`rounded-2xl border p-4 ${tone.container}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl">{card.icon}</span>
                      <span className={`text-2xl font-black ${tone.value}`}>
                        {typeof card.value === 'number' ? number(card.value) : card.value}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-600">{card.label}</p>
                  </div>
                )
              })}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-slate-800">تطور الزيارات</h4>
                  <p className="text-xs text-slate-400">تجميع يومي، أو مجموعات أيام عند اختيار فترة طويلة</p>
                </div>
                <div className="flex flex-wrap gap-3 text-[11px] font-bold text-slate-500">
                  <span><i className="ml-1 inline-block h-2.5 w-2.5 rounded bg-blue-500" />عمومي</span>
                  <span><i className="ml-1 inline-block h-2.5 w-2.5 rounded bg-emerald-500" />تبليغ</span>
                  <span><i className="ml-1 inline-block h-2.5 w-2.5 rounded bg-violet-500" />داخلي</span>
                </div>
              </div>
              <div className="flex h-52 items-end gap-1 overflow-hidden border-b border-slate-200 pt-4" dir="ltr">
                {visibleDaily.map((row) => {
                  const total = row.publicSite + row.reports + row.platform
                  const height = Math.max(total ? 5 : 1, (total / maxDaily) * 100)
                  return (
                    <div key={row.date} className="group relative flex h-full min-w-0 flex-1 items-end">
                      <div
                        className="flex w-full flex-col-reverse overflow-hidden rounded-t-sm transition-opacity hover:opacity-80"
                        style={{ height: `${height}%` }}
                        title={`${row.date}: ${total} زيارة`}
                      >
                        <div className="bg-blue-500" style={{ height: `${total ? (row.publicSite / total) * 100 : 0}%` }} />
                        <div className="bg-emerald-500" style={{ height: `${total ? (row.reports / total) * 100 : 0}%` }} />
                        <div className="bg-violet-500" style={{ height: `${total ? (row.platform / total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-400" dir="ltr">
                <span>{visibleDaily[0]?.date || '—'}</span>
                <span>{visibleDaily.at(-1)?.date || '—'}</span>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 font-bold text-slate-800">📍 الزوار حسب الجماعة</h4>
                <div className="space-y-3">
                  {data.communes.slice(0, 12).map((item) => (
                    <div key={item.commune}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="font-bold text-slate-700">{item.commune}</span>
                        <span className="text-slate-500">{number(item.visits)} زيارة · {number(item.visitors)} زائر</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-500" style={{ width: `${(item.visits / maxCommune) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  {data.communes.length === 0 && <p className="py-8 text-center text-sm text-slate-400">لا توجد زيارات بعد</p>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 font-bold text-slate-800">📄 أكثر الصفحات زيارة</h4>
                <div className="divide-y divide-slate-100">
                  {data.pages.map((item, index) => (
                    <div key={item.path} className="flex items-center gap-3 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-xs font-black text-indigo-600">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-700">{pageLabel(item.path)}</p>
                        <p className="truncate text-[10px] text-slate-400" dir="ltr">{item.path}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-black text-slate-700">{number(item.visits)}</p>
                        <p className="text-[10px] text-slate-400">{number(item.visitors)} فريد</p>
                      </div>
                    </div>
                  ))}
                  {data.pages.length === 0 && <p className="py-8 text-center text-sm text-slate-400">لا توجد بيانات بعد</p>}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
                <h4 className="font-bold text-slate-800">🏆 نشاط مسؤولي الجماعات</h4>
                <p className="mt-0.5 text-xs text-slate-400">مرتب حسب عدد مرات الدخول ثم الزيارات الداخلية خلال الفترة المحددة</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead className="bg-white text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-3">الترتيب</th>
                      <th className="px-4 py-3">المسؤول</th>
                      <th className="px-4 py-3">الجماعة</th>
                      <th className="px-4 py-3">مرات الدخول</th>
                      <th className="px-4 py-3">زيارات الأقسام</th>
                      <th className="px-4 py-3">آخر دخول</th>
                      <th className="px-4 py-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.users.map((account, index) => (
                      <tr key={account.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-black text-indigo-600">#{index + 1}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-700">{account.nom}</p>
                          <p className="text-[10px] text-slate-400" dir="ltr">@{account.username}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{account.commune === 'ALL' ? 'الإدارة العامة' : account.commune}</td>
                        <td className="px-4 py-3 font-black text-indigo-700">{number(account.logins)}</td>
                        <td className="px-4 py-3 font-black text-violet-700">{number(account.platformVisits)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(account.lastLogin)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${account.actif ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                            {account.actif ? 'نشط' : 'معطل'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 font-bold text-slate-800">📱 الأجهزة المستعملة</h4>
                <div className="grid grid-cols-2 gap-3">
                  {data.devices.map((item) => {
                    const device = DEVICE_LABELS[item.device] || DEVICE_LABELS.UNKNOWN
                    const percent = data.summary.totalVisits ? Math.round((item.visits / data.summary.totalVisits) * 100) : 0
                    return (
                      <div key={item.device} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{device.icon}</span>
                          <span className="font-black text-slate-700">{percent}%</span>
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-600">{device.label} · {number(item.visits)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <h4 className="mb-4 font-bold text-slate-800">🔗 مصادر الإحالة</h4>
                <div className="divide-y divide-slate-100">
                  {data.referrers.map((item) => (
                    <div key={item.source} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <span className="truncate text-slate-600" dir="ltr">{item.source}</span>
                      <span className="font-black text-slate-700">{number(item.visits)}</span>
                    </div>
                  ))}
                  {data.referrers.length === 0 && <p className="py-6 text-center text-sm text-slate-400">زيارات مباشرة فقط</p>}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-6 text-blue-800">
              🔒 <strong>الخصوصية:</strong> تُحفظ بصمة مجهولة للزائر ولا يُخزن عنوان IP الخام أو الإحداثيات الدقيقة.
              تظهر الجماعة فقط بعد تحديدها من صفحة التبليغ. يبدأ العد من تاريخ تفعيل هذه الميزة.
              آخر تحديث: {formatDate(data.generatedAt)}.
            </div>
          </>
        ) : null}
      </div>
    </motion.section>
  )
}
