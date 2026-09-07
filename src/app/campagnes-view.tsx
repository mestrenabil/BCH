'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type CommuneType } from '@/lib/store'
import { appendTerritoryParams, hasTerritorySelection, type TerritoryFilter } from '@/lib/geography'
import { territoryCommuneName, useTerritoryCommunes } from '@/hooks/use-territory-communes'
import { t } from '@/lib/i18n'
import {
  type Campagne, type CampagneStats,
  TYPE_LABELS, TYPE_COLORS, TYPE_ICONS,
  CAMPAGNE_TYPE_LABELS, CAMPAGNE_TYPE_COLORS, CAMPAGNE_TYPE_ICONS,
  CAMPAGNE_STATUT_LABELS, CAMPAGNE_STATUT_COLORS,
  CAMPAGNE_COLOR_PRESETS, STATUT_LABELS, STATUT_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS, MONTH_NAMES_AR, CHART_COLORS,
} from '@/lib/constants'

const STATUT_FLOW = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE'] as const
const TYPE_OPTIONS = ['DERATISATION', 'DESINSECTISATION', 'DESINFECTION', 'MIXTE'] as const

const EMPTY_FORM = {
  nom: '',
  type: 'DERATISATION' as string,
  commune: '' as string,
  description: '',
  objectif: '',
  budgetPrevu: '',
  dateDebut: new Date().toISOString().slice(0, 10),
  dateFin: '',
  statut: 'PLANIFIEE' as string,
  responsable: '',
  couleur: '#10b981',
}

function formatDate(iso: string | null, withTime = false): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const date = `${d.getDate()} ${MONTH_NAMES_AR[d.getMonth()]} ${d.getFullYear()}`
  if (!withTime) return date
  return `${date} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function formatMoney(v: number | null | undefined): string {
  if (v == null) return '—'
  return new Intl.NumberFormat('fr-MA').format(Math.round(v)) + ' د.م'
}

// ===== SKELETON =====
function CampagneCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm animate-pulse">
      <div className="h-5 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
      <div className="h-4 w-3/4 bg-slate-100 dark:bg-slate-700/60 rounded mb-4" />
      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700/60 rounded mb-3" />
      <div className="flex gap-2">
        <div className="h-6 w-16 bg-slate-100 dark:bg-slate-700/60 rounded" />
        <div className="h-6 w-16 bg-slate-100 dark:bg-slate-700/60 rounded" />
      </div>
    </div>
  )
}

// ===== EMPTY STATE =====
function EmptyState({ onAdd, language }: { onAdd: () => void; language: 'ar' | 'fr' }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 px-4 text-center"
    >
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 flex items-center justify-center text-5xl mb-6 shadow-inner">
        🎪
      </div>
      <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">
        {t('noCampagnes', language)}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
        {t('noCampagnesDesc', language)}
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-medium shadow-lg shadow-emerald-200 dark:shadow-emerald-900/50 hover:shadow-xl hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
      >
        + {t('addCampagne', language)}
      </button>
    </motion.div>
  )
}

// ===== CAMPAGNE CARD =====
function CampagneCard({
  campagne,
  language,
  onOpen,
  onEdit,
  onDelete,
}: {
  campagne: Campagne
  language: 'ar' | 'fr'
  onOpen: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const count = campagne._count?.interventions ?? 0
  const statutColor = CAMPAGNE_STATUT_COLORS[campagne.statut] || '#6b7280'
  const typeColor = CAMPAGNE_TYPE_COLORS[campagne.type] || '#10b981'
  const isFinished = campagne.statut === 'TERMINEE'
  const isActive = campagne.statut === 'EN_COURS'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3 }}
      className="group rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm hover:shadow-lg transition-shadow overflow-hidden"
    >
      {/* Color bar */}
      <div className="h-1.5" style={{ background: `linear-gradient(to left, ${campagne.couleur}, ${typeColor})` }} />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xl shrink-0">{CAMPAGNE_TYPE_ICONS[campagne.type] || '🎪'}</span>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{campagne.nom}</h3>
              <span className="text-xs text-slate-400 font-mono">{campagne.reference}</span>
            </div>
          </div>
          <span
            className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: statutColor }}
          >
            {CAMPAGNE_STATUT_LABELS[campagne.statut] || campagne.statut}
          </span>
        </div>

        {campagne.objectif && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{campagne.objectif}</p>
        )}

        {/* Period */}
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-3">
          <span>📅</span>
          <span>{formatDate(campagne.dateDebut)}</span>
          <span className="text-slate-300">←</span>
          <span>{campagne.dateFin ? formatDate(campagne.dateFin) : '—'}</span>
        </div>

        {/* Progress bar (visual proxy based on count) */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="text-slate-500 dark:text-slate-400">{t('interventionsLinked', language)}</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">{count}</span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ backgroundColor: campagne.couleur }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, count * 10 + (isFinished ? 100 : 0))}%` }}
              transition={{ duration: 0.6 }}
            />
          </div>
        </div>

        {/* Budget */}
        <div className="flex items-center justify-between text-xs mb-4">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
            <span>💰</span>
            <span>{formatMoney(campagne.coutReel)}</span>
            {campagne.budgetPrevu ? (
              <span className="text-slate-400">/ {formatMoney(campagne.budgetPrevu)}</span>
            ) : null}
          </div>
          {campagne.commune && campagne.commune !== 'ALL' && (
            <span className="text-[11px] text-slate-400">{campagne.commune}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onOpen}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label={`${t('campagneDetails', language)} - ${campagne.nom}`}
          >
            {t('campagneDetails', language)}
          </button>
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={t('editCampagne', language)}
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            aria-label={t('delete', language)}
          >
            🗑️
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ===== ADD/EDIT DIALOG =====
function CampagneFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
  initial,
  language,
  title,
  territoryFilter,
  useTerritoryFilter,
  accountCommune,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (form: typeof EMPTY_FORM) => void
  submitting: boolean
  initial: typeof EMPTY_FORM | null
  language: 'ar' | 'fr'
  title: string
  territoryFilter: TerritoryFilter
  useTerritoryFilter: boolean
  accountCommune: string
}) {
  const [form, setForm] = useState(EMPTY_FORM)
  const { communes } = useTerritoryCommunes(territoryFilter, useTerritoryFilter)
  const scopedCommuneNames = useMemo(() => communes.map(territoryCommuneName), [communes])
  const mustChooseScopedCommune = useTerritoryFilter && hasTerritorySelection(territoryFilter)

  useEffect(() => {
    if (!open) return

    const nextForm = initial ?? EMPTY_FORM
    const firstCommune = scopedCommuneNames.length === 1 ? scopedCommuneNames[0] : ''
    const commune = accountCommune || (mustChooseScopedCommune && !scopedCommuneNames.includes(nextForm.commune)
      ? firstCommune
      : nextForm.commune)
    const resetTimer = window.setTimeout(() => setForm({ ...nextForm, commune }), 0)
    return () => window.clearTimeout(resetTimer)
  }, [open, initial, accountCommune, mustChooseScopedCommune, scopedCommuneNames])

  if (!open) return null

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent'
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 shadow-2xl"
      >
        <div className="sticky top-0 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold flex items-center gap-2">🎪 {title}</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={t('close', language)}>✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t('campagneName', language)} *</label>
            <input className={inputCls} value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder={t('campagneName', language)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('campagneType', language)} *</label>
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TYPE_OPTIONS.map((tp) => (
                  <option key={tp} value={tp}>{CAMPAGNE_TYPE_ICONS[tp]} {CAMPAGNE_TYPE_LABELS[tp]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('campagneStatut', language)}</label>
              <select className={inputCls} value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                {STATUT_FLOW.map((st) => (
                  <option key={st} value={st}>{CAMPAGNE_STATUT_LABELS[st]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('commune', language)} *</label>
              <select required className={inputCls} value={form.commune} onChange={(e) => setForm({ ...form, commune: e.target.value })}>
                {!accountCommune && <option value="">اختر الجماعة</option>}
                {accountCommune
                  ? <option value={accountCommune}>{COMMUNE_LABELS[accountCommune] || accountCommune}</option>
                  : useTerritoryFilter
                  ? communes.map((commune) => <option key={commune.code} value={territoryCommuneName(commune)}>{territoryCommuneName(commune)}</option>)
                  : Object.entries(COMMUNE_LABELS).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('responsable', language)}</label>
              <input className={inputCls} value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder={t('responsable', language)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>{t('dateDebut', language)} *</label>
              <input type="date" className={inputCls} value={form.dateDebut} onChange={(e) => setForm({ ...form, dateDebut: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>{t('dateFin', language)}</label>
              <input type="date" className={inputCls} value={form.dateFin} onChange={(e) => setForm({ ...form, dateFin: e.target.value })} />
            </div>
          </div>

          <div>
            <label className={labelCls}>{t('objectif', language)}</label>
            <textarea className={inputCls} rows={2} value={form.objectif} onChange={(e) => setForm({ ...form, objectif: e.target.value })} placeholder={t('objectif', language)} />
          </div>
          <div>
            <label className={labelCls}>{t('descComplaints' as never, language) || 'الوصف'}</label>
            <textarea className={inputCls} rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="—" />
          </div>

          <div>
            <label className={labelCls}>{t('budgetPrevu', language)} (د.م)</label>
            <input type="number" min="0" step="0.01" className={inputCls} value={form.budgetPrevu} onChange={(e) => setForm({ ...form, budgetPrevu: e.target.value })} placeholder="0.00" />
          </div>

          <div>
            <label className={labelCls}>{t('campagneColor', language)}</label>
            <div className="flex items-center gap-2 flex-wrap">
              {CAMPAGNE_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, couleur: c })}
                  className={`w-8 h-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${form.couleur === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                  aria-label={`${t('campagneColor', language)} ${c}`}
                />
              ))}
              <input type="color" className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent" value={form.couleur} onChange={(e) => setForm({ ...form, couleur: e.target.value })} aria-label={t('campagneColor', language)} />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900/50 px-6 py-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
            {t('cancel', language)}
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={submitting || !form.nom}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-gradient-to-l from-emerald-600 to-teal-600 text-white shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {submitting ? '...' : t('save', language)}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ===== DETAIL DIALOG =====
function CampagneDetailDialog({
  campagne,
  onClose,
  language,
  onEdit,
}: {
  campagne: Campagne | null
  onClose: () => void
  language: 'ar' | 'fr'
  onEdit: (c: Campagne) => void
}) {
  const [stats, setStats] = useState<CampagneStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [unlinking, setUnlinking] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const stateTimer = window.setTimeout(() => {
      if (!campagne) setStats(null)
      else setLoadingStats(true)
    }, 0)
    if (!campagne) return () => { cancelled = true; window.clearTimeout(stateTimer) }
    fetch(`/api/campagnes/${campagne.id}/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (!cancelled) setStats(d?.stats ?? null) })
      .catch(() => { if (!cancelled) setStats(null) })
      .finally(() => { if (!cancelled) setLoadingStats(false) })
    return () => { cancelled = true; window.clearTimeout(stateTimer) }
  }, [campagne])

  if (!campagne) return null

  const handleUnlink = async (interventionId: string) => {
    setUnlinking(interventionId)
    try {
      const res = await fetch(`/api/interventions/${interventionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campagneId: null }),
      })
      if (res.ok) {
        toast.success(t('unlinkIntervention', language))
        // Refresh campagne detail
        const refreshed = await fetch(`/api/campagnes/${campagne.id}`).then((r) => r.json())
        if (refreshed?.campagne) {
          // Re-fetch stats too
          const s = await fetch(`/api/campagnes/${campagne.id}/stats`).then((r) => r.json())
          setStats(s?.stats ?? null)
        }
      } else {
        toast.error('فشل الفصل')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setUnlinking(null)
  }

  const statutColor = CAMPAGNE_STATUT_COLORS[campagne.statut] || '#6b7280'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 text-white px-6 py-4 flex items-center justify-between z-10" style={{ background: `linear-gradient(to left, ${campagne.couleur}, ${campagne.couleur}dd)` }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl">{CAMPAGNE_TYPE_ICONS[campagne.type] || '🎪'}</span>
            <div className="min-w-0">
              <h2 className="text-lg font-bold truncate">{campagne.nom}</h2>
              <span className="text-xs opacity-80 font-mono">{campagne.reference}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white" aria-label={t('close', language)}>✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status & meta */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: statutColor }}>
              {CAMPAGNE_STATUT_LABELS[campagne.statut]}
            </span>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {CAMPAGNE_TYPE_LABELS[campagne.type]}
            </span>
            {campagne.responsable && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300">👤 {campagne.responsable}</span>
            )}
            {campagne.commune && campagne.commune !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-full text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300">📍 {campagne.commune}</span>
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center bg-slate-50 dark:bg-slate-900/40">
              <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{stats?.total ?? '—'}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('interventionsLinked', language)}</div>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 p-3 text-center bg-emerald-50 dark:bg-emerald-900/20">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-300">{stats?.completionRate ?? 0}%</div>
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">{t('completionRate', language)}</div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-center bg-slate-50 dark:bg-slate-900/40">
              <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatMoney(stats?.totalCost)}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('coutReel', language)}</div>
            </div>
            <div className="rounded-xl border border-amber-200 dark:border-amber-800 p-3 text-center bg-amber-50 dark:bg-amber-900/20">
              <div className="text-lg font-bold text-amber-600 dark:text-amber-300">{stats?.budgetUsage ?? 0}%</div>
              <div className="text-[11px] text-amber-600 dark:text-amber-400">{t('budgetUsage', language)}</div>
            </div>
          </div>

          {/* Objectif */}
          {campagne.objectif && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900/40">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">{t('objectif', language)}</h4>
              <p className="text-sm text-slate-700 dark:text-slate-200">{campagne.objectif}</p>
            </div>
          )}

          {/* Progression chart (simple bars) */}
          {stats && stats.progressionSeries.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-3">{t('progressionChart', language)}</h4>
              <div className="flex items-end gap-1 h-24">
                {stats.progressionSeries.slice(-15).map((p, i) => {
                  const max = stats.progressionSeries[stats.progressionSeries.length - 1]?.count || 1
                  const h = Math.max(8, (p.count / max) * 100)
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group/bar" title={`${formatDate(p.date)}: ${p.count}`}>
                      <div className="w-full rounded-t-md transition-all group-hover/bar:opacity-80" style={{ height: `${h}%`, backgroundColor: campagne.couleur, minHeight: 6 }} />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Linked interventions */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">{t('interventionsLinked', language)} ({campagne.interventions?.length ?? 0})</h4>
            {campagne.interventions && campagne.interventions.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {campagne.interventions.map((iv) => (
                  <div key={iv.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                    <span>{TYPE_ICONS[iv.type] || '📋'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono text-slate-600 dark:text-slate-300 truncate">{iv.reference}</div>
                      <div className="text-[11px] text-slate-400 truncate">{iv.quartier} • {formatDate(iv.date)}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: STATUT_COLORS[iv.statut] || '#6b7280' }}>
                      {STATUT_LABELS[iv.statut] || iv.statut}
                    </span>
                    <button
                      onClick={() => handleUnlink(iv.id)}
                      disabled={unlinking === iv.id}
                      className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      aria-label={t('unlinkIntervention', language)}
                      title={t('unlinkIntervention', language)}
                    >
                      {unlinking === iv.id ? '...' : '✕'}
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-3 text-center">—</p>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900/50 px-6 py-3 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-700">
          <button onClick={() => onEdit(campagne)} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            ✏️ {t('editCampagne', language)}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
            {t('close', language)}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

// ===== MAIN VIEW =====
export default function CampagnesView() {
  const { language, selectedCommune, selectedYear, territoryFilter, user } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const [campagnes, setCampagnes] = useState<Campagne[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatut, setFilterStatut] = useState('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Campagne | null>(null)
  const [detail, setDetail] = useState<Campagne | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchCampagnes = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
      if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
      if (selectedYear) params.set('year', selectedYear)
      if (filterStatut !== 'ALL') params.set('statut', filterStatut)
      if (filterType !== 'ALL') params.set('type', filterType)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/campagnes?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        return data.campagnes as Campagne[]
      }
    } catch { /* ignore */ }
    return null
  }, [selectedCommune, filterStatut, filterType, debouncedSearch, selectedYear, territoryFilter, useTerritoryFilter])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setIsLoading(true)
      const result = await fetchCampagnes()
      if (!cancelled && result) setCampagnes(result)
      if (!cancelled) setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [fetchCampagnes])

  const refreshList = useCallback(async () => {
    const result = await fetchCampagnes()
    if (result) setCampagnes(result)
  }, [fetchCampagnes])

  const handleOpenDetail = useCallback(async (c: Campagne) => {
    try {
      const res = await fetch(`/api/campagnes/${c.id}`)
      if (res.ok) {
        const data = await res.json()
        setDetail(data.campagne)
        return
      }
    } catch { /* ignore */ }
    setDetail(c)
  }, [])

  const handleSubmit = useCallback(async (form: typeof EMPTY_FORM) => {
    if (!form.commune) {
      toast.error('يرجى تحديد الجماعة')
      return
    }
    setSubmitting(true)
    try {
      const url = editing ? `/api/campagnes/${editing.id}` : '/api/campagnes'
      const method = editing ? 'PUT' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, territoryFilter: useTerritoryFilter ? territoryFilter : undefined }),
      })
      if (res.ok) {
        toast.success(editing ? 'تم تحديث الحملة' : 'تم إنشاء الحملة بنجاح')
        setShowForm(false)
        setEditing(null)
        refreshList()
      } else {
        const data = await res.json()
        toast.error(data.error || 'فشل العملية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setSubmitting(false)
  }, [editing, refreshList, territoryFilter, useTerritoryFilter])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      const res = await fetch(`/api/campagnes/${deleteId}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الحملة')
        setDeleteId(null)
        refreshList()
      } else {
        toast.error('فشل الحذف')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }, [deleteId, refreshList])

  // Summary
  const activeCount = campagnes.filter((c) => c.statut === 'EN_COURS' || c.statut === 'PLANIFIEE').length
  const finishedCount = campagnes.filter((c) => c.statut === 'TERMINEE').length
  const totalBudget = campagnes.reduce((s, c) => s + (c.budgetPrevu ?? 0), 0)

  const inputCls = 'px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500'

  return (
    <div className="space-y-5 p-4 sm:p-6 max-w-[1400px] mx-auto" role="region" aria-label={t('campagnes', language)}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            🎪 {t('campagnes', language)}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('descCampagnes', language)}</p>
        </div>
        <button
          onClick={() => { setEditing(null); setShowForm(true) }}
          className="px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-medium shadow-md hover:shadow-lg hover:scale-105 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          + {t('addCampagne', language)}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">{language === 'ar' ? 'إجمالي' : 'Total'}</div>
          <div className="text-xl font-bold text-slate-800 dark:text-slate-100">{campagnes.length}</div>
        </div>
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 shadow-sm">
          <div className="text-xs text-amber-600 dark:text-amber-400">{t('campagneActive', language)}</div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-300">{activeCount}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-3 shadow-sm">
          <div className="text-xs text-emerald-600 dark:text-emerald-400">{t('campagneTerminees', language)}</div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-300">{finishedCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400">{t('totalBudgetCampagnes', language)}</div>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatMoney(totalBudget)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          className={`${inputCls} flex-1 min-w-[200px]`}
          placeholder={t('searchPlaceholder', language)}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label={t('search', language)}
        />
        <select className={inputCls} value={filterStatut} onChange={(e) => setFilterStatut(e.target.value)} aria-label={t('campagneStatut', language)}>
          <option value="ALL">{t('all', language)}</option>
          {STATUT_FLOW.map((st) => (
            <option key={st} value={st}>{CAMPAGNE_STATUT_LABELS[st]}</option>
          ))}
        </select>
        <select className={inputCls} value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label={t('campagneType', language)}>
          <option value="ALL">{t('allTypes', language)}</option>
          {TYPE_OPTIONS.map((tp) => (
            <option key={tp} value={tp}>{CAMPAGNE_TYPE_LABELS[tp]}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <CampagneCardSkeleton key={i} />)}
        </div>
      ) : campagnes.length === 0 ? (
        <EmptyState onAdd={() => setShowForm(true)} language={language} />
      ) : (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {campagnes.map((c) => (
              <CampagneCard
                key={c.id}
                campagne={c}
                language={language}
                onOpen={() => handleOpenDetail(c)}
                onEdit={() => { setEditing(c); setShowForm(true) }}
                onDelete={() => setDeleteId(c.id)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Form dialog */}
      <CampagneFormDialog
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null) }}
        onSubmit={handleSubmit}
        submitting={submitting}
        initial={editing ? {
          nom: editing.nom,
          type: editing.type,
          commune: editing.commune || '',
          description: editing.description,
          objectif: editing.objectif,
          budgetPrevu: editing.budgetPrevu ? String(editing.budgetPrevu) : '',
          dateDebut: editing.dateDebut.slice(0, 10),
          dateFin: editing.dateFin ? editing.dateFin.slice(0, 10) : '',
          statut: editing.statut,
          responsable: editing.responsable,
          couleur: editing.couleur,
        } : null}
        language={language}
        title={editing ? t('editCampagne', language) : t('newCampagne', language)}
        territoryFilter={territoryFilter}
        useTerritoryFilter={useTerritoryFilter}
        accountCommune={user?.commune && user.commune !== 'ALL' ? user.commune : ''}
      />

      {/* Detail dialog */}
      <CampagneDetailDialog
        campagne={detail}
        onClose={() => setDetail(null)}
        language={language}
        onEdit={(c) => { setDetail(null); setEditing(c); setShowForm(true) }}
      />

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] flex items-center justify-center p-4"
            role="alertdialog"
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteId(null)} />
            <motion.div
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
              className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-2xl text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-2xl mb-3">🗑️</div>
              <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-1">{t('delete', language)}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">{language === 'ar' ? 'سيتم فصل التدخلات المرتبطة. هل أنت متأكد؟' : 'Les interventions seront dissociées. Confirmer ?'}</p>
              <div className="flex gap-2">
                <button onClick={() => setDeleteId(null)} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400">
                  {t('cancel', language)}
                </button>
                <button onClick={handleDelete} className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                  {t('delete', language)}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
