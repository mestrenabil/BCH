'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type CommuneType, type OverlaySectionKey, type ViewType, OVERLAY_SECTION_LABELS, DEFAULT_NAV_ORDER } from '@/lib/store'
import { getYearOptions } from '@/lib/store'
import { appendTerritoryParams, hasTerritorySelection } from '@/lib/geography'
import { territoryCommuneName, useTerritoryCommunes } from '@/hooks/use-territory-communes'
import {
  type Quartier,
  COMMUNE_LABELS, COMMUNE_COLORS, COMMUNE_USER_INFO,
} from '@/lib/constants'
import { UserManagementSection } from './users-view-lite'

const NAV_SETTINGS_ITEMS: { id: ViewType; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'لوحة القيادة', icon: '📊' },
  { id: 'map', label: 'الخريطة التفاعلية', icon: '🗺️' },
  { id: 'interventions', label: 'التدخلات', icon: '📋' },
  { id: 'agents', label: 'الفرق والأعوان', icon: '👥' },
  { id: 'inventory', label: 'المخزون', icon: '📦' },
  { id: 'documents', label: 'المستندات', icon: '📁' },
  { id: 'calendar', label: 'التقويم', icon: '📅' },
  { id: 'complaints', label: 'الشكايات والبلاغات', icon: '📢' },
  { id: 'workOrders', label: 'أوامر العمل', icon: '🧭' },
  { id: 'campagnes', label: 'الحملات', icon: '🎪' },
  { id: 'csvr', label: 'الحيوانات الشاردة', icon: '🐾' },
  { id: 'food', label: 'السلامة الغذائية', icon: '🥗' },
  { id: 'dossiers', label: 'الملفات', icon: '🗂️' },
  { id: 'sanitary', label: 'المراقبة الصحية', icon: '🍽️' },
  { id: 'water', label: 'مراقبة المياه', icon: '💧' },
  { id: 'vector', label: 'محاربة النواقل والتطهير', icon: '🐀' },
  { id: 'funeral', label: 'المقابر والوفيات', icon: '⚱️' },
  { id: 'environment', label: 'البيئة', icon: '🌳' },
  { id: 'vigilance', label: 'اليقظة الصحية', icon: '📢' },
  { id: 'authorizations', label: 'التراخيص', icon: '📋' },
  { id: 'gis', label: 'نظام المعلومات الجغرافية', icon: '🌐' },
  { id: 'reportsOffice', label: 'التقارير والإحصائيات', icon: '📊' },
  { id: 'calendarUnified', label: 'التقويم الموحد', icon: '📅' },
  { id: 'reports', label: 'التقارير', icon: '📈' },
  { id: 'operations', label: 'العمليات', icon: '⏱️' },
  { id: 'kpi', label: 'مؤشرات الأداء', icon: '🎯' },
  { id: 'alerts', label: 'التنبيهات', icon: '⚡' },
  { id: 'export', label: 'التصدير', icon: '📤' },
  { id: 'notifications', label: 'الإشعارات', icon: '🔔' },
  { id: 'activityLog', label: 'سجل النشاط', icon: '📝' },
  { id: 'timeline', label: 'الخط الزمني', icon: '📊' },
  { id: 'users', label: 'المستخدمون', icon: '👥' },
  { id: 'settings', label: 'الإعدادات', icon: '⚙️' },
  { id: 'helpCenter', label: 'مركز المساعدة', icon: '❓' },
]

// ===== CSV IMPORT BUTTON =====
function CSVImportButton({ type, label, icon, color }: { type: 'interventions' | 'agents' | 'products'; label: string; icon: string; color: string }) {
  const { user, territoryFilter } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const [dialogOpen, setDialogOpen] = useState(false)
  const [csvData, setCsvData] = useState<Record<string, string>[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ success: number; failed: number; total: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const colorClasses: Record<string, string> = {
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100',
    amber: 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100',
    blue: 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100',
  }

  const sampleFormats: Record<string, string> = {
    interventions: 'type, date, quartier, adresse, commune, statut, agentNom, reference, description',
    agents: 'nom, prenom, telephone, commune, fonction, actif',
    products: 'nom, categorie, commune, unite, quantiteStock, seuilAlerte, prixUnitaire, fournisseur, reference',
  }

  // Simple CSV parser — handles basic quoted fields
  const parseCSV = (text: string): Record<string, string>[] => {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) return []
    const parseLine = (line: string): string[] => {
      const result: string[] = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else { inQuotes = !inQuotes }
        } else if (ch === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      result.push(current.trim())
      return result
    }
    const headers = parseLine(lines[0])
    const rows: Record<string, string>[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = parseLine(lines[i])
      const obj: Record<string, string> = {}
      headers.forEach((h, idx) => { obj[h] = values[idx] || '' })
      rows.push(obj)
    }
    return rows
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCSV(text)
      setCsvData(parsed)
      setImportResult(null)
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (csvData.length === 0) return
    setIsImporting(true)
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data: csvData, territoryFilter: useTerritoryFilter ? territoryFilter : undefined }),
      })
      const result = await res.json()
      if (res.ok) {
        setImportResult({ success: result.success, failed: result.failed, total: result.total })
        toast.success(`تم استيراد ${result.success} من ${result.total} سجل${result.failed > 0 ? ` (${result.failed} فشل)` : ''}`)
        if (result.errors?.length > 0) {
          console.warn('Import errors:', result.errors)
        }
      } else {
        toast.error(result.error || 'حدث خطأ أثناء الاستيراد')
      }
    } catch {
      toast.error('حدث خطأ في الاتصال')
    }
    setIsImporting(false)
  }

  const handleClose = () => {
    setDialogOpen(false)
    setCsvData([])
    setImportResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setDialogOpen(true)}
        className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${colorClasses[color] || colorClasses.emerald}`}
      >
        <span className="text-2xl">{icon}</span>
        <span className="text-xs font-bold">{label}</span>
      </motion.button>

      <AnimatePresence>
        {dialogOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl max-w-lg w-full shadow-2xl"
              dir="rtl"
            >
              <div className="bg-gradient-to-l from-amber-600 to-yellow-600 p-5 rounded-t-2xl text-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
                      {icon}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{label}</h3>
                      <p className="text-amber-100 text-xs">استيراد بيانات من ملف CSV</p>
                    </div>
                  </div>
                  <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
                </div>
              </div>
              <div className="p-5 space-y-4">
                {/* File input */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">📁 اختر ملف CSV</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100"
                  />
                </div>

                {/* Format note */}
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-bold text-slate-600 mb-1">📝 التنسيق المتوقع: CSV مع عناوين الأعمدة</p>
                  <p className="text-[11px] text-slate-400 font-mono" dir="ltr">
                    {sampleFormats[type]}
                  </p>
                </div>

                {/* Preview */}
                {csvData.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-600 mb-2">
                      👁️ معاينة ({Math.min(5, csvData.length)} من {csvData.length} صف)
                    </p>
                    <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            {Object.keys(csvData[0]).map((key) => (
                              <th key={key} className="px-2 py-1.5 text-right font-bold text-slate-600 whitespace-nowrap">{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="border-t border-slate-100">
                              {Object.values(row).map((val, i) => (
                                <td key={i} className="px-2 py-1 text-slate-500 whitespace-nowrap max-w-[120px] truncate">{val || '—'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Import result */}
                {importResult && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-sm font-bold text-emerald-700">
                      ✅ تم استيراد {importResult.success} من {importResult.total} سجل
                      {importResult.failed > 0 && <span className="text-red-600"> ({importResult.failed} فشل)</span>}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
                  >
                    {importResult ? 'إغلاق' : 'إلغاء'}
                  </button>
                  {!importResult && (
                    <button
                      onClick={handleImport}
                      disabled={csvData.length === 0 || isImporting}
                      className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-amber-600 to-yellow-600 text-white font-medium text-sm shadow-lg shadow-amber-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isImporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          جاري الاستيراد...
                        </>
                      ) : (
                        <>📥 استيراد {csvData.length} سجل</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ===== QUARTIER MANAGEMENT SECTION =====
function QuartierManagementSection() {
  const { user, territoryFilter } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const { communes: scopedCommunes } = useTerritoryCommunes(territoryFilter, useTerritoryFilter)
  const scopedCommuneNames = useMemo(
    () => Array.from(new Set(scopedCommunes.map(territoryCommuneName).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'ar')),
    [scopedCommunes]
  )
  const mustChooseScopedCommune = useTerritoryFilter && hasTerritorySelection(territoryFilter)
  const accountCommune = user?.commune && user.commune !== 'ALL' ? user.commune : ''
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
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
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
  }, [filterCommune, territoryFilter, useTerritoryFilter])

  const refreshQuartiers = useCallback(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
        const res = await fetch(`/api/quartiers?${params}`)
        const data = await res.json()
        setQuartiers(data.quartiers || [])
      } catch (err) { console.error('Failed to fetch quartiers:', err) }
    }
    load()
  }, [filterCommune, territoryFilter, useTerritoryFilter])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      nom: form.get('nom') as string,
      commune: accountCommune || form.get('commune') as string,
      latitude: form.get('latitude') as string,
      longitude: form.get('longitude') as string,
      territoryFilter: useTerritoryFilter ? territoryFilter : undefined,
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
            {useTerritoryFilter
              ? scopedCommunes.map((commune) => <option key={commune.code} value={territoryCommuneName(commune)}>{territoryCommuneName(commune)}</option>)
              : <><option value="سلا">جماعة سلا</option><option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option><option value="عامر">جماعة عامر</option><option value="السهول">جماعة السهول</option></>}
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
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">الجماعة *</label>
                  <select name="commune" required defaultValue={accountCommune || editingQuartier?.commune || (mustChooseScopedCommune && scopedCommuneNames.length === 1 ? scopedCommuneNames[0] : '')}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none text-sm">
                    {!accountCommune && <option value="">— اختر الجماعة —</option>}
                    {accountCommune
                      ? <option value={accountCommune}>{COMMUNE_LABELS[accountCommune] || accountCommune}</option>
                      : useTerritoryFilter
                      ? scopedCommunes.map((commune) => <option key={commune.code} value={territoryCommuneName(commune)}>{territoryCommuneName(commune)}</option>)
                      : <><option value="سلا">جماعة سلا</option><option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option><option value="عامر">جماعة عامر</option><option value="السهول">جماعة السهول</option></>}
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
  const { user, territoryFilter } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const { communes: scopedCommunes } = useTerritoryCommunes(territoryFilter, useTerritoryFilter)
  const scopedCommuneNames = useMemo(
    () => Array.from(new Set(scopedCommunes.map(territoryCommuneName).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'ar')),
    [scopedCommunes]
  )
  const mustChooseScopedCommune = useTerritoryFilter && hasTerritorySelection(territoryFilter)
  const accountCommune = user?.commune && user.commune !== 'ALL' ? user.commune : ''
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
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
        const res = await fetch(`/api/agents?${params}`)
        const data = await res.json()
        if (!cancelled) { setAgents(data.agents || []); setIsLoading(false) }
      } catch { if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filterCommune, territoryFilter, useTerritoryFilter])

  const refreshAgents = useCallback(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
        const res = await fetch(`/api/agents?${params}`)
        const data = await res.json()
        setAgents(data.agents || [])
      } catch { /* */ }
    }
    load()
  }, [filterCommune, territoryFilter, useTerritoryFilter])

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const data = {
      nom: form.get('nom') as string,
      prenom: form.get('prenom') as string,
      telephone: form.get('telephone') as string,
      commune: accountCommune || form.get('commune') as string,
      fonction: form.get('fonction') as string,
      actif: form.get('actif') === 'on',
      territoryFilter: useTerritoryFilter ? territoryFilter : undefined,
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
            {useTerritoryFilter
              ? scopedCommunes.map((commune) => <option key={commune.code} value={territoryCommuneName(commune)}>{territoryCommuneName(commune)}</option>)
              : <><option value="سلا">جماعة سلا</option><option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option><option value="عامر">جماعة عامر</option><option value="السهول">جماعة السهول</option></>}
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
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">🏛️ الجماعة *</label>
                    <select name="commune" required defaultValue={accountCommune || editingAgent?.commune || (mustChooseScopedCommune && scopedCommuneNames.length === 1 ? scopedCommuneNames[0] : '')}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm">
                      {!accountCommune && <option value="">— اختر —</option>}
                      {accountCommune
                        ? <option value={accountCommune}>{COMMUNE_LABELS[accountCommune] || accountCommune}</option>
                        : useTerritoryFilter
                        ? scopedCommunes.map((commune) => <option key={commune.code} value={territoryCommuneName(commune)}>{territoryCommuneName(commune)}</option>)
                        : <><option value="سلا">جماعة سلا</option><option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option><option value="عامر">جماعة عامر</option><option value="السهول">جماعة السهول</option></>}
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
  const normalizedNavOrder = useMemo(() => {
    const configured = Array.isArray(settings.navOrder) ? settings.navOrder : []
    return [
      ...configured.filter((id) => DEFAULT_NAV_ORDER.includes(id)),
      ...DEFAULT_NAV_ORDER.filter((id) => !configured.includes(id)),
    ]
  }, [settings.navOrder])

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

  const handleNavVisibility = (id: ViewType) => {
    if (id === 'settings') return
    handleUpdateAndSave({
      navVisibility: {
        ...settings.navVisibility,
        [id]: !(settings.navVisibility?.[id] ?? true),
        settings: true,
      },
    })
  }

  const handleNavMove = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= normalizedNavOrder.length) return
    const nextOrder = [...normalizedNavOrder]
    const [movedItem] = nextOrder.splice(index, 1)
    nextOrder.splice(targetIndex, 0, movedItem)
    handleUpdateAndSave({ navOrder: nextOrder })
  }

  const handleShowAllNav = () => {
    handleUpdateAndSave({
      navVisibility: Object.fromEntries(DEFAULT_NAV_ORDER.map((id) => [id, true])) as Record<ViewType, boolean>,
    })
  }

  const handleResetNav = () => {
    handleUpdateAndSave({
      navOrder: [...DEFAULT_NAV_ORDER],
      navVisibility: Object.fromEntries(DEFAULT_NAV_ORDER.map((id) => [id, true])) as Record<ViewType, boolean>,
    })
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
                ...Object.keys(COMMUNE_LABELS).map((commune) => ({
                  key: commune,
                  label: COMMUNE_LABELS[commune],
                  icon: COMMUNE_USER_INFO[commune]?.icon || '🏘️',
                  color: COMMUNE_COLORS[commune] || '#64748b',
                })),
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

      {/* Navigation visibility and order — managed by the general administrator */}
      {user?.role === 'admin' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.07 }}
          className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-l from-indigo-700 to-violet-700 text-white px-6 py-4">
            <h3 className="font-bold text-base">🧭 أقسام مسؤولي الجماعات</h3>
            <p className="text-indigo-200 text-xs mt-0.5">تحكم في ما يظهر لموظفي الجماعة المختارة من الأقسام وترتيبها حسب الأولوية</p>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-500">إعداد «عام (المشترك)» يطبق على حسابات جميع الجماعات، ويمكن تخصيص إعدادات جماعة بعينها. يبقى وصول المدير العام كاملاً دائماً.</p>
              <div className="flex gap-2">
                <button type="button" onClick={handleShowAllNav} className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-bold hover:bg-indigo-100">إظهار الكل</button>
                <button type="button" onClick={handleResetNav} className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50">الافتراضي</button>
              </div>
            </div>
            <div className="space-y-2 max-h-[30rem] overflow-y-auto pr-1">
              {normalizedNavOrder.map((id, index) => {
                const item = NAV_SETTINGS_ITEMS.find((candidate) => candidate.id === id)
                if (!item) return null
                const visible = id === 'settings' || (settings.navVisibility?.[id] ?? true)
                return (
                  <div key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${visible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'}`}>
                    <span className="w-7 text-center text-xs font-bold text-slate-400">{index + 1}</span>
                    <span className="text-lg">{item.icon}</span>
                    <span className="flex-1 text-sm font-semibold text-slate-700">{item.label}</span>
                    <button type="button" onClick={() => handleNavVisibility(id)} disabled={id === 'settings'}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${id === 'settings' ? 'cursor-not-allowed bg-slate-100 text-slate-400' : visible ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-200 text-slate-500 hover:bg-slate-300'}`}>
                      {visible ? 'ظاهر' : 'مخفي'}
                    </button>
                    <div className="flex gap-1">
                      <button type="button" onClick={() => handleNavMove(index, -1)} disabled={index === 0} aria-label="تحريك القسم للأعلى"
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">↑</button>
                      <button type="button" onClick={() => handleNavMove(index, 1)} disabled={index === normalizedNavOrder.length - 1} aria-label="تحريك القسم للأسفل"
                        className="w-7 h-7 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-30">↓</button>
                    </div>
                  </div>
                )
              })}
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
                <option value="السهول">جماعة السهول</option>
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
                animate={{ right: settings.mapClickEnabled ? '0.25rem' : '2rem' }}
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
                animate={{ right: settings.showCommunePopups ? '0.25rem' : '2rem' }}
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

      {/* Overlay Section Visibility Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-teal-600 to-emerald-600 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base">🪟 أقسام لوحة التدخل</h3>
              <p className="text-teal-200 text-xs mt-0.5">إظهار أو إخفاء أقسام لوحة تفاصيل التدخل على الخريطة</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  const allVisible = Object.fromEntries(
                    (Object.keys(OVERLAY_SECTION_LABELS) as OverlaySectionKey[]).map(k => [k, true])
                  ) as Record<OverlaySectionKey, boolean>
                  handleUpdateAndSave({ overlaySectionVisibility: allVisible })
                }}
                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold hover:bg-white/30 transition-colors"
              >
                إظهار الكل
              </button>
              <button
                onClick={() => {
                  const allHidden = Object.fromEntries(
                    (Object.keys(OVERLAY_SECTION_LABELS) as OverlaySectionKey[]).map(k => [k, false])
                  ) as Record<OverlaySectionKey, boolean>
                  handleUpdateAndSave({ overlaySectionVisibility: allHidden })
                }}
                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold hover:bg-white/30 transition-colors"
              >
                إخفاء الكل
              </button>
              <button
                onClick={() => {
                  const defaults = Object.fromEntries(
                    Object.entries(OVERLAY_SECTION_LABELS).map(([key, val]) => [key, val.defaultVisible])
                  ) as Record<OverlaySectionKey, boolean>
                  handleUpdateAndSave({ overlaySectionVisibility: defaults })
                }}
                className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-lg text-xs font-bold hover:bg-white/30 transition-colors"
              >
                الافتراضي
              </button>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-1" dir="rtl">
          {/* Group: Default visible sections */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-1">الأقسام الأساسية</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(OVERLAY_SECTION_LABELS) as OverlaySectionKey[])
              .filter(key => OVERLAY_SECTION_LABELS[key].defaultVisible)
              .map((key) => {
                const section = OVERLAY_SECTION_LABELS[key]
                const isVisible = settings.overlaySectionVisibility?.[key] ?? section.defaultVisible
                return (
                  <div key={key}
                    className={`flex items-center justify-between gap-3 rounded-xl p-3 border transition-all ${
                      isVisible ? 'bg-emerald-50/50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{section.icon}</span>
                      <span className={`text-sm font-medium ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>{section.ar}</span>
                    </div>
                    <button
                      onClick={() => {
                        handleUpdateAndSave({
                          overlaySectionVisibility: {
                            ...settings.overlaySectionVisibility,
                            [key]: !isVisible,
                          } as Record<OverlaySectionKey, boolean>,
                        })
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isVisible ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
                        animate={{ right: isVisible ? '0.125rem' : '1.375rem' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                )
              })}
          </div>

          <div className="border-t border-slate-100 my-3" />

          {/* Group: Default hidden sections (new) */}
          <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-2 mt-1">✨ أقسام إضافية (مخفية افتراضياً)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(OVERLAY_SECTION_LABELS) as OverlaySectionKey[])
              .filter(key => !OVERLAY_SECTION_LABELS[key].defaultVisible)
              .map((key) => {
                const section = OVERLAY_SECTION_LABELS[key]
                const isVisible = settings.overlaySectionVisibility?.[key] ?? section.defaultVisible
                return (
                  <div key={key}
                    className={`flex items-center justify-between gap-3 rounded-xl p-3 border transition-all ${
                      isVisible ? 'bg-amber-50/50 border-amber-100' : 'bg-slate-50 border-slate-100 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-base">{section.icon}</span>
                      <span className={`text-sm font-medium ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>{section.ar}</span>
                    </div>
                    <button
                      onClick={() => {
                        handleUpdateAndSave({
                          overlaySectionVisibility: {
                            ...settings.overlaySectionVisibility,
                            [key]: !isVisible,
                          } as Record<OverlaySectionKey, boolean>,
                        })
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${isVisible ? 'bg-amber-500' : 'bg-slate-300'}`}
                    >
                      <motion.div
                        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
                        animate={{ right: isVisible ? '0.125rem' : '1.375rem' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                )
              })}
          </div>

          {/* Info box */}
          <div className="bg-teal-50/80 rounded-xl p-3 flex items-start gap-2.5 mt-3 border border-teal-100">
            <span className="text-sm mt-0.5">💡</span>
            <p className="text-xs text-teal-700 leading-relaxed">
              الأقسام المخفية لا تظهر في لوحة تفاصيل التدخل عند النقر على تدخل في الخريطة. يمكنك تفعيل الأقسام الإضافية مثل <strong>الإحداثيات الجغرافية</strong> و <strong>معلومات النظام</strong> حسب حاجتك.
            </p>
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
                animate={{ right: settings.animationsEnabled ? '0.25rem' : '2rem' }}
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
                animate={{ right: settings.compactMode ? '0.25rem' : '2rem' }}
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
                animate={{ right: settings.stockAlertEnabled ? '0.25rem' : '2rem' }}
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
                animate={{ right: settings.deadlineReminderEnabled ? '0.25rem' : '2rem' }}
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
            <motion.button onClick={async () => {
              const params = new URLSearchParams({ format: 'csv' })
              if (settings.defaultYear) params.set('year', settings.defaultYear)
              if (settings.defaultCommune !== 'ALL') params.set('commune', settings.defaultCommune)
              try {
                const res = await fetch(`/api/export?${params.toString()}`)
                if (!res.ok) {
                  if (res.status === 401) { toast.error('يرجى تسجيل الدخول أولاً'); return }
                  throw new Error()
                }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `interventions-${settings.defaultYear || 'all'}.csv`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success('تم تحميل ملف CSV بنجاح')
              } catch { toast.error('فشل في تصدير ملف CSV') }
            }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50 transition-all group">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">📊</div>
              <div className="text-right">
                <div className="text-sm font-bold text-slate-700">تصدير CSV</div>
                <div className="text-[11px] text-slate-400">ملف جدول بيانات متوافق مع Excel</div>
              </div>
            </motion.button>

            {/* Export JSON */}
            <motion.button onClick={async () => {
              const params = new URLSearchParams({ format: 'json' })
              if (settings.defaultYear) params.set('year', settings.defaultYear)
              if (settings.defaultCommune !== 'ALL') params.set('commune', settings.defaultCommune)
              try {
                const res = await fetch(`/api/export?${params.toString()}`)
                if (!res.ok) {
                  if (res.status === 401) { toast.error('يرجى تسجيل الدخول أولاً'); return }
                  throw new Error()
                }
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `interventions-${settings.defaultYear || 'all'}.json`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success('تم تحميل ملف JSON بنجاح')
              } catch { toast.error('فشل في تصدير ملف JSON') }
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

      {/* Document & Print Settings */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-violet-600 to-purple-600 text-white px-6 py-4">
          <h3 className="font-bold text-base">🖨️ إعدادات المستندات والطباعة</h3>
          <p className="text-violet-200 text-xs mt-0.5">تخصيص المستندات والتقارير المطبوعة</p>
        </div>
        <div className="p-6 space-y-6">
          {/* Officials */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-violet-100 text-violet-600 flex items-center justify-center text-xs">👤</span>
              المسؤولون
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">اسم الرئيس</label>
                <input type="text" value={settings.presidentName} onChange={(e) => handleUpdateAndSave({ presidentName: e.target.value })}
                  placeholder="رئيس الجماعة" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">اسم رئيس المصالح</label>
                <input type="text" value={settings.chefServiceName} onChange={(e) => handleUpdateAndSave({ chefServiceName: e.target.value })}
                  placeholder="رئيس المصالح" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">اسم المسؤول</label>
                <input type="text" value={settings.responsableName} onChange={(e) => handleUpdateAndSave({ responsableName: e.target.value })}
                  placeholder="المسؤول" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-300 transition-all" />
              </div>
            </div>
          </div>

          {/* Commune Info */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs">🏛️</span>
              معلومات الجماعة
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">اسم الجماعة (عربي)</label>
                <input type="text" value={settings.communeNameAr} onChange={(e) => handleUpdateAndSave({ communeNameAr: e.target.value })}
                  placeholder="جماعة ..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">اسم الجماعة (فرنسي)</label>
                <input type="text" value={settings.communeNameFr} onChange={(e) => handleUpdateAndSave({ communeNameFr: e.target.value })}
                  placeholder="Commune de ..." dir="ltr" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">عنوان الجماعة</label>
                <input type="text" value={settings.communeAddress} onChange={(e) => handleUpdateAndSave({ communeAddress: e.target.value })}
                  placeholder="عنوان مقر الجماعة" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">الهاتف</label>
                <input type="tel" value={settings.communePhone} onChange={(e) => handleUpdateAndSave({ communePhone: e.target.value })}
                  placeholder="05XXXXXXXX" dir="ltr" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">الفاكس</label>
                <input type="tel" value={settings.communeFax} onChange={(e) => handleUpdateAndSave({ communeFax: e.target.value })}
                  placeholder="05XXXXXXXX" dir="ltr" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={settings.communeEmail} onChange={(e) => handleUpdateAndSave({ communeEmail: e.target.value })}
                  placeholder="contact@commune.ma" dir="ltr" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
              </div>
            </div>
          </div>

          {/* Print Options */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-amber-100 text-amber-600 flex items-center justify-center text-xs">🖨️</span>
              خيارات الطباعة
            </h4>
            <div className="space-y-4">
              {/* Watermark toggle */}
              <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm">💧</span>
                  <div>
                    <p className="text-sm font-medium text-slate-700">علامة مائية</p>
                    <p className="text-[11px] text-slate-400">إظهار علامة مائية على المستندات المطبوعة</p>
                  </div>
                </div>
                <button type="button" onClick={() => handleUpdateAndSave({ showWatermark: !settings.showWatermark })}
                  className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${settings.showWatermark ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${settings.showWatermark ? 'right-1' : 'right-6'}`} />
                </button>
              </div>
              {/* Watermark text */}
              {settings.showWatermark && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">نص العلامة المائية</label>
                  <input type="text" value={settings.watermarkText} onChange={(e) => handleUpdateAndSave({ watermarkText: e.target.value })}
                    placeholder="BCH" className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 transition-all" />
                </div>
              )}
              {/* Document footer */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">تذييل المستند</label>
                <textarea value={settings.documentFooter} onChange={(e) => handleUpdateAndSave({ documentFooter: e.target.value })}
                  placeholder="نص يظهر في أسفل المستندات المطبوعة" rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 transition-all resize-none" />
              </div>
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
                toast.info('جاري إنشاء النسخة الاحتياطية...', { id: 'backup' })
                const res = await fetch('/api/backup')
                if (!res.ok) {
                  if (res.status === 401) { toast.error('يرجى تسجيل الدخول أولاً', { id: 'backup' }); return }
                  throw new Error('backup_failed')
                }
                const data = await res.json()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url; a.download = `backup-3d-${new Date().toISOString().split('T')[0]}.json`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
                const summary = data.summary
                toast.success(`تم تحميل النسخة الاحتياطية — ${summary?.interventions || 0} تدخل، ${summary?.agents || 0} عون`, { id: 'backup' })
              } catch { toast.error('فشل في إنشاء النسخة الاحتياطية — يرجى المحاولة مرة أخرى', { id: 'backup' }) }
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
                  const interventionCount = backup.interventions?.total || 0
                  const quartierCount = backup.quartiers?.length || 0
                  const agentCount = backup.agents?.length || 0
                  const productCount = backup.products?.length || 0
                  // Show confirmation dialog
                  const confirmed = window.confirm(
                    `سيتم استعادة البيانات التالية:\n` +
                    `• ${interventionCount} تدخل\n` +
                    `• ${productCount} منتج\n` +
                    `• ${quartierCount} حي\n` +
                    `• ${agentCount} عون\n\n` +
                    `سيتم إعادة تهيئة قاعدة البيانات أولاً. هل أنت متأكد؟`
                  )
                  if (!confirmed) return
                  // Step 1: Reset the database via seed endpoint
                  toast.loading('جاري إعادة تهيئة قاعدة البيانات...', { id: 'restore' })
                  const seedRes = await fetch('/api/seed', { method: 'POST' })
                  if (!seedRes.ok) {
                    toast.error('فشل في إعادة تهيئة قاعدة البيانات', { id: 'restore' })
                    return
                  }
                  toast.loading('جاري استعادة البيانات...', { id: 'restore' })
                  // Step 2: Restore quartiers
                  if (backup.quartiers?.length) {
                    for (const q of backup.quartiers) {
                      await fetch('/api/quartiers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nom: q.nom, commune: q.commune, latitude: q.latitude, longitude: q.longitude }),
                      })
                    }
                  }
                  // Step 3: Restore agents
                  if (backup.agents?.length) {
                    for (const a of backup.agents) {
                      await fetch('/api/agents', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nom: a.nom, prenom: a.prenom, telephone: a.telephone, commune: a.commune, fonction: a.fonction, actif: a.actif }),
                      })
                    }
                  }
                  // Step 4: Restore products
                  if (backup.products?.length) {
                    for (const p of backup.products) {
                      await fetch('/api/products', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ nom: p.nom, categorie: p.categorie, commune: p.commune, unite: p.unite, quantiteStock: p.quantiteStock, seuilAlerte: p.seuilAlerte, prixUnitaire: p.prixUnitaire, fournisseur: p.fournisseur, description: p.description }),
                      })
                    }
                  }
                  toast.success(`تمت استعادة البيانات بنجاح: ${interventionCount} تدخل، ${productCount} منتج، ${quartierCount} حي، ${agentCount} عون`, { id: 'restore' })
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

      {/* Data Backup & Restore */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">💾</span>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">النسخ الاحتياطي والاستعادة</h3>
            <p className="text-[11px] text-slate-400">تصدير واستيراد بيانات التطبيق</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              try {
                toast.info('جاري إنشاء النسخة الاحتياطية...', { id: 'backup2' })
                const res = await fetch('/api/backup')
                if (!res.ok) {
                  if (res.status === 401) { toast.error('يرجى تسجيل الدخول أولاً', { id: 'backup2' }); return }
                  throw new Error('backup_failed')
                }
                const data = await res.json()
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `backup-3d-sale-${new Date().toISOString().split('T')[0]}.json`
                document.body.appendChild(a); a.click(); document.body.removeChild(a)
                URL.revokeObjectURL(url)
                toast.success('تم إنشاء النسخة الاحتياطية بنجاح', { id: 'backup2' })
              } catch {
                toast.error('حدث خطأ أثناء إنشاء النسخة الاحتياطية', { id: 'backup2' })
              }
            }}
            className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2"
          >
            💾 إنشاء نسخة احتياطية
          </button>
          <label className="flex-1 px-4 py-2.5 bg-slate-600 text-white rounded-lg text-xs font-bold hover:bg-slate-500 transition-colors flex items-center justify-center gap-2 cursor-pointer">
            📥 استعادة من نسخة
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const text = await file.text()
                  const data = JSON.parse(text)
                  toast.info('جاري استعادة البيانات...')
                  // In a real app, this would restore the data
                  toast.success('تمت قراءة ملف النسخة الاحتياطية بنجاح')
                } catch {
                  toast.error('حدث خطأ أثناء قراءة ملف النسخة الاحتياطية')
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* CSV Data Import */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">📂</span>
          <div>
            <h3 className="font-bold text-slate-800 text-sm">استيراد البيانات من CSV</h3>
            <p className="text-[11px] text-slate-400">استيراد التدخلات من ملف CSV</p>
          </div>
        </div>
        <label className="block border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-emerald-400 transition-colors cursor-pointer">
          <span className="text-3xl block mb-2">📄</span>
          <span className="text-xs text-slate-500 block">اسحب ملف CSV هنا أو انقر للتحديد</span>
          <input
            type="file"
            accept=".csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              try {
                const text = await file.text()
                toast.info('جاري استيراد البيانات...')
                const { importCSVData } = await import('@/lib/csv-import')
                const result = await importCSVData(text)
                if (result.success > 0) {
                  toast.success(`تم استيراد ${result.success} تدخل بنجاح`)
                }
                if (result.errors > 0) {
                  toast.error(`فشل استيراد ${result.errors} تدخل`)
                }
              } catch {
                toast.error('حدث خطأ أثناء الاستيراد')
              }
            }}
          />
        </label>
        <p className="text-[10px] text-slate-400">
          الأعمدة المطلوبة: type, date, quartier, adresse, commune, agent, produit, quantite, superficie
        </p>
      </div>

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

          {/* Import Data Section */}
          <div className="border-t border-slate-100 pt-5">
            <h4 className="text-sm font-bold text-slate-700 mb-3">📥 استيراد البيانات</h4>
            <p className="text-xs text-slate-400 mb-4">استيراد البيانات من ملفات CSV لملء قاعدة البيانات بسرعة</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { type: 'interventions' as const, label: 'استيراد التدخلات', icon: '📋', color: 'emerald' },
                { type: 'agents' as const, label: 'استيراد الأعوان', icon: '👤', color: 'amber' },
                { type: 'products' as const, label: 'استيراد المنتجات', icon: '📦', color: 'blue' },
              ].map((item) => (
                <CSVImportButton key={item.type} type={item.type} label={item.label} icon={item.icon} color={item.color} />
              ))}
            </div>
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
              { label: 'اسم التطبيق', value: 'المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة' },
              { label: 'الإصدار', value: '2.0.0' },
              { label: 'المصالح', value: 'قسم الوقاية وحفظ الصحة' },
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

export default SettingsView
