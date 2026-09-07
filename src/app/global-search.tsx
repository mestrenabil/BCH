'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type ViewType } from '@/lib/store'
import { t } from '@/lib/i18n'
import {
  TYPE_ICONS, TYPE_LABELS, STATUT_LABELS, STATUT_COLORS,
} from '@/lib/constants'

// ===== TYPES =====
interface SearchHit {
  id: string
  label: string
  sublabel?: string
  icon: string
  badge?: string
  badgeColor?: string
  kind: 'intervention' | 'product' | 'agent' | 'document' | 'complaint'
  navigateTo?: ViewType
  onSelect: () => void
}

interface QuickAction {
  id: string
  label: string
  icon: string
  hint?: string
  onSelect: () => void
}

interface GlobalSearchProps {
  open: boolean
  onClose: () => void
  selectedCommune: string
}

// ===== MAIN COMPONENT =====
export default function GlobalSearch({ open, onClose, selectedCommune }: GlobalSearchProps) {
  const { language, setCurrentView, setIsFormOpen, setTheme, theme, setLanguage } = useAppStore()
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<{
    interventions: SearchHit[]
    products: SearchHit[]
    agents: SearchHit[]
    documents: SearchHit[]
    complaints: SearchHit[]
  }>({ interventions: [], products: [], agents: [], documents: [], complaints: [] })
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset on open/close
  useEffect(() => {
    if (!open) return
    const resetTimer = window.setTimeout(() => {
      setQuery('')
      setDebounced('')
      setResults({ interventions: [], products: [], agents: [], documents: [], complaints: [] })
      setActiveIndex(0)
    }, 0)
    return () => window.clearTimeout(resetTimer)
  }, [open])

  // Debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250)
    return () => clearTimeout(timer)
  }, [query])

  // Fetch results
  useEffect(() => {
    if (!open) return
    if (debounced.length < 2) {
      const resetTimer = window.setTimeout(() => {
        setResults({ interventions: [], products: [], agents: [], documents: [], complaints: [] })
        setLoading(false)
      }, 0)
      return () => window.clearTimeout(resetTimer)
    }
    let cancelled = false
    const loadingTimer = window.setTimeout(() => {
      if (!cancelled) setLoading(true)
    }, 0)
    const params = new URLSearchParams({ search: debounced, limit: '5' })
    if (selectedCommune !== 'ALL') params.set('commune', selectedCommune)
    const qs = params.toString()

    Promise.allSettled([
      fetch(`/api/interventions?${qs}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/products?${qs}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/agents?${qs}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/documents?${qs}`).then((r) => r.ok ? r.json() : null),
      fetch(`/api/complaints?${qs}`).then((r) => r.ok ? r.json() : null),
    ]).then(([iv, pr, ag, doc, cp]) => {
      if (cancelled) return
      setResults({
        interventions: (iv.status === 'fulfilled' && iv.value?.interventions ? iv.value.interventions : []).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          label: String(x.reference || ''),
          sublabel: [x.quartier, x.adresse].filter(Boolean).join(' • '),
          icon: TYPE_ICONS[String(x.type)] || '📋',
          badge: STATUT_LABELS[String(x.statut)] || '',
          badgeColor: STATUT_COLORS[String(x.statut)] || '#6b7280',
          kind: 'intervention' as const,
          navigateTo: 'interventions' as ViewType,
          onSelect: () => { setCurrentView('interventions'); onClose() },
        })),
        products: (pr.status === 'fulfilled' && pr.value?.products ? pr.value.products : []).slice(0, 5).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          label: String(x.nom || ''),
          sublabel: `${x.quantiteStock ?? 0} ${x.unite ?? ''} • ${x.reference ?? ''}`,
          icon: '📦',
          badge: x.categorie ? String(x.categorie) : undefined,
          kind: 'product' as const,
          navigateTo: 'inventory' as ViewType,
          onSelect: () => { setCurrentView('inventory'); onClose() },
        })),
        agents: (ag.status === 'fulfilled' && ag.value?.agents ? ag.value.agents : []).slice(0, 5).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          label: `${x.prenom ?? ''} ${x.nom ?? ''}`.trim(),
          sublabel: [x.fonction, x.commune].filter(Boolean).join(' • '),
          icon: x.actif === false ? '🚫' : '👥',
          kind: 'agent' as const,
          navigateTo: 'agents' as ViewType,
          onSelect: () => { setCurrentView('agents'); onClose() },
        })),
        documents: (doc.status === 'fulfilled' && doc.value?.documents ? doc.value.documents : []).slice(0, 5).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          label: String(x.titre || ''),
          sublabel: [x.categorie, x.reference].filter(Boolean).join(' • '),
          icon: '📄',
          kind: 'document' as const,
          navigateTo: 'documents' as ViewType,
          onSelect: () => { setCurrentView('documents'); onClose() },
        })),
        complaints: (cp.status === 'fulfilled' && cp.value?.complaints ? cp.value.complaints : []).slice(0, 5).map((x: Record<string, unknown>) => ({
          id: String(x.id),
          label: String(x.reference || ''),
          sublabel: String(x.nomCitoyen || ''),
          icon: '📢',
          kind: 'complaint' as const,
          navigateTo: 'complaints' as ViewType,
          onSelect: () => { setCurrentView('complaints'); onClose() },
        })),
      })
      setLoading(false)
    })
    return () => { cancelled = true; window.clearTimeout(loadingTimer) }
  }, [debounced, open, selectedCommune, setCurrentView, onClose])

  // Quick actions (filtered by query too)
  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [
      { id: 'add-intervention', label: t('addIntervention', language), icon: '➕', hint: 'Alt+N', onSelect: () => { setIsFormOpen(true); onClose() } },
      { id: 'go-dashboard', label: t('dashboard', language), icon: '📊', onSelect: () => { setCurrentView('dashboard'); onClose() } },
      { id: 'go-interventions', label: t('interventions', language), icon: '📋', onSelect: () => { setCurrentView('interventions'); onClose() } },
      { id: 'go-map', label: t('map', language), icon: '🗺️', onSelect: () => { setCurrentView('map'); onClose() } },
      { id: 'go-campagnes', label: t('campagnes', language), icon: '🎪', onSelect: () => { setCurrentView('campagnes'); onClose() } },
      { id: 'go-reports', label: t('reports', language), icon: '📈', onSelect: () => { setCurrentView('reports'); onClose() } },
      { id: 'toggle-theme', label: theme === 'dark' ? '☀️ ' + (language === 'ar' ? 'الوضع النهاري' : 'Mode clair') : '🌙 ' + (language === 'ar' ? 'الوضع الليلي' : 'Mode sombre'), icon: theme === 'dark' ? '☀️' : '🌙', onSelect: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose() } },
      { id: 'toggle-lang', label: language === 'ar' ? '🌐 Français' : '🌐 العربية', icon: '🌐', onSelect: () => { setLanguage(language === 'ar' ? 'fr' : 'ar'); onClose() } },
    ]
    if (!debounced) return actions
    return actions.filter((a) => a.label.toLowerCase().includes(debounced.toLowerCase()))
  }, [language, theme, debounced, setCurrentView, setIsFormOpen, setTheme, setLanguage, onClose])

  // Flatten all results for keyboard navigation
  const flatHits = useMemo(() => {
    const all = [
      ...results.interventions,
      ...results.products,
      ...results.agents,
      ...results.documents,
      ...results.complaints,
    ]
    return all
  }, [results])

  const totalHits = flatHits.length + quickActions.length

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, Math.max(totalHits - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const idx = activeIndex
      if (idx < quickActions.length) {
        quickActions[idx]?.onSelect()
      } else {
        flatHits[idx - quickActions.length]?.onSelect()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }, [activeIndex, totalHits, quickActions, flatHits, onClose])

  // Reset active index when results change
  useEffect(() => {
    const resetTimer = window.setTimeout(() => setActiveIndex(0), 0)
    return () => window.clearTimeout(resetTimer)
  }, [debounced])

  const showResults = debounced.length >= 2
  const noResults = showResults && !loading && flatHits.length === 0 && quickActions.length === 0

  const inputCls = 'w-full bg-transparent text-slate-800 dark:text-slate-100 text-base focus:outline-none placeholder:text-slate-400'
  const itemCls = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/60'}`

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-start justify-center p-4 pt-[10vh]"
          role="dialog" aria-modal="true" aria-label={t('globalSearch', language)}
          onKeyDown={handleKeyDown}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative w-full max-w-xl rounded-2xl bg-white dark:bg-slate-800 shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-700">
              <span className="text-xl text-slate-400" aria-hidden>🔍</span>
              <input
                autoFocus
                type="search"
                className={inputCls}
                placeholder={t('searchPlaceholder', language)}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label={t('search', language)}
                role="combobox"
                aria-expanded="true"
                aria-controls="global-search-list"
              />
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div id="global-search-list" className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
              {loading && (
                <div className="px-3 py-6 text-center text-sm text-slate-400">
                  <span className="inline-block w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin align-middle ml-2" />
                </div>
              )}

              {/* Quick actions */}
              {!loading && quickActions.length > 0 && (
                <div className="mb-1">
                  {!showResults && (
                    <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {t('searchQuickActions', language)}
                    </div>
                  )}
                  {quickActions.map((a, i) => (
                    <button
                      key={a.id}
                      className={itemCls(activeIndex === i)}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={a.onSelect}
                      role="option"
                      aria-selected={activeIndex === i}
                    >
                      <span className="text-lg shrink-0">{a.icon}</span>
                      <span className="flex-1 text-left text-sm font-medium">{a.label}</span>
                      {a.hint && (
                        <kbd className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-1.5 py-0.5">{a.hint}</kbd>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Search results grouped */}
              {!loading && showResults && flatHits.length > 0 && (
                <div className="mt-2">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('searchNavigate', language)}
                  </div>
                  {([
                    ['intervention', '📋', results.interventions],
                    ['product', '📦', results.products],
                    ['agent', '👥', results.agents],
                    ['document', '📄', results.documents],
                    ['complaint', '📢', results.complaints],
                  ] as const).map(([kind, kindIcon, hits]) => {
                    if (hits.length === 0) return null
                    return (
                      <div key={kind} className="mb-1">
                        <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 flex items-center gap-1.5">
                          <span>{kindIcon}</span>
                          <span>{kind === 'intervention' ? t('interventions', language) : kind === 'product' ? t('inventory', language) : kind === 'agent' ? t('agents', language) : kind === 'document' ? t('documents', language) : t('complaints', language)}</span>
                          <span className="text-slate-300">({hits.length})</span>
                        </div>
                        {hits.map((h) => {
                          // Compute global index
                          const globalIdx = quickActions.length +
                            [...results.interventions, ...results.products, ...results.agents, ...results.documents, ...results.complaints]
                              .findIndex((x) => x.id === h.id && x.kind === h.kind)
                          return (
                            <button
                              key={`${h.kind}-${h.id}`}
                              className={itemCls(activeIndex === globalIdx)}
                              onMouseEnter={() => setActiveIndex(globalIdx)}
                              onClick={h.onSelect}
                              role="option"
                              aria-selected={activeIndex === globalIdx}
                            >
                              <span className="text-lg shrink-0">{h.icon}</span>
                              <div className="flex-1 min-w-0 text-left">
                                <div className="text-sm font-medium truncate">{h.label}</div>
                                {h.sublabel && <div className="text-[11px] text-slate-400 truncate">{h.sublabel}</div>}
                              </div>
                              {h.badge && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0" style={{ backgroundColor: h.badgeColor || '#6b7280' }}>
                                  {h.badge}
                                </span>
                              )}
                              <span className="text-slate-300 text-xs shrink-0">↵</span>
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* No results */}
              {!loading && noResults && (
                <div className="px-3 py-10 text-center">
                  <div className="text-4xl mb-2">🔍</div>
                  <p className="text-sm text-slate-400">{t('searchNoResults', language)}</p>
                  <p className="text-xs text-slate-300 mt-1">&quot;{debounced}&quot;</p>
                </div>
              )}

              {/* Initial hint */}
              {!loading && !showResults && quickActions.length === 0 && (
                <div className="px-3 py-10 text-center text-sm text-slate-400">
                  {t('searchOpenHint', language)}
                </div>
              )}
            </div>

            {/* Footer hint */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 text-[11px] text-slate-400">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 rounded px-1">↑↓</kbd> {language === 'ar' ? 'تنقل' : 'Naviguer'}</span>
                <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-200 dark:bg-slate-700 rounded px-1">↵</kbd> {language === 'ar' ? 'اختيار' : 'Sélectionner'}</span>
              </div>
              <span className="text-slate-300">Ctrl+K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
