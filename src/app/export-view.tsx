'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import PrintDocument from './print-document'

// ===== CONSTANTS =====
const COMMUNE_LABELS: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
  'السهول': 'جماعة السهول',
}
const COMMUNE_COLORS: Record<string, string> = {
  'سلا': '#059669',
  'سيدي أبي القنادل': '#7c3aed',
  'عامر': '#d97706',
  'السهول': '#0ea5e9',
}
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

// ===== EXPORT TYPE DEFINITIONS =====
type ExportType = 'comprehensive' | 'interventions' | 'statistics' | 'inventory' | 'monthly' | 'commune' | 'custom'
type ExportFormat = 'csv' | 'json' | 'pdf'

interface ExportTypeOption {
  id: ExportType
  icon: string
  title: string
  description: string
  color: string
}

const EXPORT_TYPES: ExportTypeOption[] = [
  { id: 'comprehensive', icon: '🧭', title: 'التقرير الشامل لكل الأقسام', description: 'ملخص موحد للمكاتب والتدخلات والمؤشرات الحرجة', color: '#0f766e' },
  { id: 'interventions', icon: '📋', title: 'تقرير التدخلات', description: 'قائمة مفصلة لجميع عمليات التدخل مع البيانات الكاملة', color: '#10b981' },
  { id: 'statistics', icon: '📊', title: 'التقرير الإحصائي', description: 'رسوم بيانية وملخص إحصائي شامل للعمليات', color: '#3b82f6' },
  { id: 'inventory', icon: '📦', title: 'تقرير المخزون', description: 'مستويات المخزون والمنتجات المتوفرة والتنبيهات', color: '#f59e0b' },
  { id: 'monthly', icon: '📅', title: 'التقرير الشهري', description: 'تفصيل شهري للعمليات حسب النوع والحالة', color: '#8b5cf6' },
  { id: 'commune', icon: '🏛️', title: 'التقرير حسب الجماعة', description: 'مقارنة بين الجماعات الترابية المختلفة', color: '#ec4899' },
  { id: 'custom', icon: '📝', title: 'تقرير مخصص', description: 'اختر الحقول والمعايير حسب احتياجاتك', color: '#06b6d4' },
]

// Custom report field options
const CUSTOM_FIELDS = [
  { id: 'reference', label: 'المرجع', default: true },
  { id: 'type', label: 'النوع', default: true },
  { id: 'date', label: 'التاريخ', default: true },
  { id: 'quartier', label: 'الحي', default: true },
  { id: 'adresse', label: 'العنوان', default: false },
  { id: 'commune', label: 'الجماعة', default: true },
  { id: 'statut', label: 'الحالة', default: true },
  { id: 'agentNom', label: 'العون', default: false },
  { id: 'superficie', label: 'المساحة', default: false },
  { id: 'produitUtilise', label: 'المواد المستعملة', default: false },
  { id: 'observations', label: 'الملاحظات', default: false },
]

// Quick export options
const QUICK_EXPORTS = [
  { id: 'current-month', label: 'تقرير الشهر الحالي', icon: '📅', description: 'تقرير عمليات الشهر الجاري' },
  { id: 'year-report', label: 'تقرير السنة', icon: '📆', description: 'تقرير سنوي شامل' },
  { id: 'quick-print', label: 'طباعة / PDF', icon: '🖨️', description: 'فتح معاينة الطباعة أو حفظ كـ PDF' },
  { id: 'low-stock', label: 'المخزون المنخفض', icon: '⚠️', description: 'المنتجات التي تحتاج تجديد' },
]

// ===== INTERFACES =====
interface PreviewRow {
  [key: string]: string | number
}

interface ExportHistoryItem {
  id: string
  date: string
  type: string
  typeLabel: string
  format: string
  recordCount: number
  commune: string
}

// ===== MAIN COMPONENT =====
export default function ExportView() {
  const { user, selectedCommune, selectedYear } = useAppStore()
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'
  const accountCommunes = user
    ? (Array.isArray(user.managedCommunes) && user.managedCommunes.length > 0
      ? Array.from(new Set(user.managedCommunes.filter((commune) => commune && commune !== 'ALL')))
      : user.commune !== 'ALL' ? [user.commune] : [])
    : []
  const effectiveCommune = canSeeAllCommunes
    ? selectedCommune
    : accountCommunes.length === 1 ? accountCommunes[0] : 'ALL'
  const availableCommunes = canSeeAllCommunes ? Object.keys(COMMUNE_LABELS) : accountCommunes
  const canSelectCommune = canSeeAllCommunes || accountCommunes.length > 1

  // State
  const [selectedExportType, setSelectedExportType] = useState<ExportType | null>(null)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv')
  const [filterCommune, setFilterCommune] = useState<string>(effectiveCommune === 'ALL' ? 'ALL' : effectiveCommune)
  const [filterYear, setFilterYear] = useState(selectedYear)
  const [filterType, setFilterType] = useState<string>('ALL')
  const [filterStatut, setFilterStatut] = useState<string>('ALL')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [customFields, setCustomFields] = useState<Record<string, boolean>>(
    Object.fromEntries(CUSTOM_FIELDS.map(f => [f.id, f.default]))
  )

  // Preview state
  const [previewData, setPreviewData] = useState<PreviewRow[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewColumns, setPreviewColumns] = useState<string[]>([])
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)

  // Print dialog state
  const [isPrintOpen, setIsPrintOpen] = useState(false)

  // Export history
  const [exportHistory, setExportHistory] = useState<ExportHistoryItem[]>([])

  // Load export history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('bch-export-history')
      if (saved) {
        setExportHistory(JSON.parse(saved))
      }
    } catch { /* ignore */ }
  }, [])

  // Save export history to localStorage
  const saveExportHistory = useCallback((items: ExportHistoryItem[]) => {
    try {
      localStorage.setItem('bch-export-history', JSON.stringify(items.slice(0, 20)))
    } catch { /* ignore */ }
  }, [])

  // Load preview data based on export type
  const loadPreview = useCallback(async () => {
    if (!selectedExportType) return
    setIsLoadingPreview(true)
    try {
      const params = new URLSearchParams()
      if (filterCommune !== 'ALL') params.set('commune', filterCommune)
      if (filterYear) params.set('year', filterYear)
      if (filterFrom) params.set('from', filterFrom)
      if (filterTo) params.set('to', filterTo)
      if (filterType !== 'ALL') params.set('type', filterType)
      if (filterStatut !== 'ALL') params.set('statut', filterStatut)

      if (selectedExportType === 'comprehensive' || selectedExportType === 'statistics') {
        params.set('format', 'json')
        params.set('period', filterYear ? 'year' : 'all')
        const res = await fetch(`/api/reports/comprehensive?${params.toString()}`)
        if (!res.ok) throw new Error('فشل في تحميل البيانات')
        const data = await res.json() as { sections?: Array<{ section: string; office: string; total: number }>; totalRecords?: number }
        const sections = data.sections || []
        setPreviewTotal(data.totalRecords || sections.reduce((sum, row) => sum + row.total, 0))
        setPreviewColumns(['القسم', 'المكتب', 'عدد السجلات'])
        setPreviewData(sections.map((row) => ({ 'القسم': row.section, 'المكتب': row.office, 'عدد السجلات': row.total })))
      } else if ((selectedExportType === 'inventory') || (selectedExportType === 'custom' && filterType !== 'ALL')) {
        // Load products for inventory
        const res = await fetch(`/api/products?${params.toString()}`)
        if (!res.ok) throw new Error('فشل في تحميل البيانات')
        const data = await res.json()
        const products = (data.products || []).slice(0, 10)
        setPreviewTotal(data.products?.length || 0)
        setPreviewColumns(['المرجع', 'المنتج', 'الفئة', 'المخزون', 'عتبة التنبيه', 'الحالة'])
        setPreviewData(products.map((p: Record<string, unknown>) => ({
          'المرجع': p.reference as string || '—',
          'المنتج': p.nom as string || '—',
          'الفئة': TYPE_LABELS[p.categorie as string] || (p.categorie as string || '—'),
          'المخزون': `${p.quantiteStock} ${p.unite || ''}`,
          'عتبة التنبيه': `${p.seuilAlerte}`,
          'الحالة': (p.quantiteStock as number) <= (p.seuilAlerte as number) ? '⚠️ منخفض' : '✅ متوفر',
        })))
      } else {
        // Load interventions for preview
        const res = await fetch(`/api/interventions?${params.toString()}&limit=10`)
        if (!res.ok) throw new Error('فشل في تحميل البيانات')
        const data = await res.json()
        const interventions = data.interventions || []
        setPreviewTotal(data.total || 0)

        // Determine columns based on export type
        let columns: string[] = []
        if (selectedExportType === 'custom') {
          const selectedFieldLabels = CUSTOM_FIELDS
            .filter(f => customFields[f.id])
            .map(f => f.label)
          columns = selectedFieldLabels
        } else if (selectedExportType === 'monthly') {
          columns = ['المرجع', 'التاريخ', 'الشهر', 'النوع', 'الحالة', 'الحي']
        } else if (selectedExportType === 'commune') {
          columns = ['المرجع', 'الجماعة', 'النوع', 'الحالة', 'الحي']
        } else {
          columns = ['المرجع', 'النوع', 'التاريخ', 'الحي', 'الجماعة', 'الحالة']
        }
        setPreviewColumns(columns)

        const MONTH_NAMES_AR = [
          'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
          'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
        ]

        setPreviewData(interventions.map((int: Record<string, unknown>) => {
          const row: PreviewRow = {}
          const dateObj = new Date(int.date as string)
          const monthName = MONTH_NAMES_AR[dateObj.getMonth()] || '—'
          if (columns.includes('المرجع')) row['المرجع'] = int.reference as string || '—'
          if (columns.includes('النوع')) row['النوع'] = TYPE_LABELS[int.type as string] || (int.type as string || '—')
          if (columns.includes('التاريخ')) row['التاريخ'] = dateObj.toLocaleDateString('ar-MA')
          if (columns.includes('الشهر')) row['الشهر'] = monthName
          if (columns.includes('الحي')) row['الحي'] = int.quartier as string || '—'
          if (columns.includes('العنوان')) row['العنوان'] = int.adresse as string || '—'
          if (columns.includes('الجماعة')) row['الجماعة'] = int.commune as string || '—'
          if (columns.includes('الحالة')) row['الحالة'] = STATUT_LABELS[int.statut as string] || (int.statut as string || '—')
          if (columns.includes('العون')) row['العون'] = int.agentNom as string || '—'
          if (columns.includes('المساحة')) row['المساحة'] = int.superficie as string || '—'
          if (columns.includes('المواد المستعملة')) row['المواد المستعملة'] = int.produitUtilise as string || '—'
          if (columns.includes('الملاحظات')) row['الملاحظات'] = int.observations as string || '—'
          return row
        }))
      }
    } catch {
      toast.error('فشل في تحميل معاينة البيانات')
      setPreviewData([])
      setPreviewTotal(0)
    }
    setIsLoadingPreview(false)
  }, [selectedExportType, filterCommune, filterYear, filterType, filterStatut, filterFrom, filterTo, customFields])

  // Auto-load preview when settings change
  useEffect(() => {
    if (selectedExportType) {
      loadPreview()
    }
  }, [selectedExportType, loadPreview])

  // Sync with store values
  useEffect(() => {
    setFilterCommune(effectiveCommune === 'ALL' ? 'ALL' : effectiveCommune)
  }, [effectiveCommune])

  useEffect(() => {
    setFilterYear(selectedYear)
  }, [selectedYear])

  // Build export URL
  const buildExportUrl = useCallback((format: string = 'csv'): string => {
    const params = new URLSearchParams()
    params.set('format', format)
    if (filterCommune !== 'ALL') params.set('commune', filterCommune)
    if (filterYear) params.set('year', filterYear)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    if (filterType !== 'ALL') params.set('type', filterType)
    if (filterStatut !== 'ALL') params.set('statut', filterStatut)
    if (selectedExportType === 'comprehensive' || selectedExportType === 'statistics') {
      params.set('period', filterYear ? 'year' : 'all')
      return `/api/reports/comprehensive?${params.toString()}`
    }
    return `/api/export?${params.toString()}`
  }, [selectedExportType, filterCommune, filterYear, filterType, filterStatut, filterFrom, filterTo])

  // Add to export history
  const addToHistory = useCallback((type: ExportType, format: string, recordCount: number) => {
    const newItem: ExportHistoryItem = {
      id: Date.now().toString(),
      date: new Date().toLocaleString('ar-MA'),
      type,
      typeLabel: EXPORT_TYPES.find(t => t.id === type)?.title || type,
      format: format.toUpperCase(),
      recordCount,
      commune: filterCommune === 'ALL' ? 'كل الجماعات' : COMMUNE_LABELS[filterCommune] || filterCommune,
    }
    const updated = [newItem, ...exportHistory].slice(0, 20)
    setExportHistory(updated)
    saveExportHistory(updated)
  }, [exportHistory, filterCommune, saveExportHistory])

  // Helper: Download CSV via fetch + Blob (reliable, carries auth cookies)
  const downloadCsv = useCallback(async (url: string, filename: string) => {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 401) throw new Error('auth')
        throw new Error('fetch')
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      return true
    } catch (err) {
      if (err instanceof Error && err.message === 'auth') {
        toast.error('يرجى تسجيل الدخول أولاً', { id: 'export-csv' })
      } else {
        toast.error('فشل في تصدير الملف', { id: 'export-csv' })
      }
      return false
    }
  }, [])

  // Handle structured data export
  const handleDataExport = useCallback(async () => {
    if (!selectedExportType) {
      toast.error('يرجى اختيار نوع التقرير أولاً')
      return
    }
    toast.loading('جاري تحضير الملف...', { id: 'export-csv' })
    const format = exportFormat === 'json' ? 'json' : 'csv'
    const url = buildExportUrl(format)
    const communePart = filterCommune !== 'ALL' ? `-${encodeURIComponent(filterCommune)}` : ''
    const filename = `${selectedExportType}-${filterYear || 'all'}${communePart}.${format}`
    const ok = await downloadCsv(url, filename)
    if (ok) {
      addToHistory(selectedExportType, format, previewTotal)
      toast.success('تم تصدير الملف بنجاح', { id: 'export-csv' })
    }
  }, [selectedExportType, exportFormat, buildExportUrl, addToHistory, previewTotal, downloadCsv, filterCommune, filterYear])

  // Handle PDF / Print preview (combined — uses browser print dialog which allows Save as PDF)
  const handlePdfExport = useCallback(() => {
    if (!selectedExportType) {
      toast.error('يرجى اختيار نوع التقرير أولاً')
      return
    }
    addToHistory(selectedExportType, 'pdf', previewTotal)
    setIsPrintOpen(true)
  }, [selectedExportType, addToHistory, previewTotal])

  const openPdfForType = useCallback((type: ExportType) => {
    setSelectedExportType(type)
    setExportFormat('pdf')
    window.setTimeout(() => setIsPrintOpen(true), 120)
  }, [])

  const openSectionPdf = useCallback((section: string, total: number) => {
    const printWindow = window.open('', '_blank', 'width=1100,height=800')
    if (!printWindow) {
      toast.error('يرجى السماح بفتح نافذة المعاينة')
      return
    }
    const scope = filterCommune === 'ALL' ? 'كل جماعات الحساب' : COMMUNE_LABELS[filterCommune] || filterCommune
    const period = filterFrom || filterTo
      ? `${filterFrom || 'البداية'} — ${filterTo || 'النهاية'}`
      : filterYear || 'كل السنوات'
    printWindow.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>تقرير ${section}</title><style>
      body{font-family:Arial,Tahoma,sans-serif;color:#172033;margin:0;padding:42px;background:#f8fafc}main{max-width:900px;margin:auto;background:white;padding:42px;border:1px solid #e2e8f0;border-radius:18px}header{border-bottom:3px solid #0f766e;padding-bottom:18px;margin-bottom:28px}h1{margin:0 0 8px;color:#0f766e;font-size:26px}p{color:#64748b}.metric{display:inline-block;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:22px 30px;margin:12px 0;font-size:28px;font-weight:800;color:#047857}.meta{margin-top:22px;padding:16px;background:#f8fafc;border-radius:12px;line-height:2}@media print{body{background:white;padding:0}main{border:0;max-width:none}}
    </style></head><body><main><header><h1>التقرير الخاص بقسم ${section}</h1><p>المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة</p></header><div class="metric">${total} سجل</div><div class="meta"><b>النطاق الترابي:</b> ${scope}<br><b>الفترة:</b> ${period}<br><b>تاريخ الإصدار:</b> ${new Date().toLocaleString('ar-MA')}</div></main></body></html>`)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => printWindow.print()
  }, [filterCommune, filterFrom, filterTo, filterYear])

  // Quick export handler
  const handleQuickExport = useCallback(async (quickId: string) => {
    try {
      toast.loading('جاري تحضير التقرير...', { id: 'quick-export' })
      const params = new URLSearchParams()
      params.set('format', 'csv')
      const now = new Date()
      // Use local date formatting to avoid UTC timezone shift
      const formatDateLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

      if (quickId === 'current-month') {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        params.set('from', formatDateLocal(startOfMonth))
        params.set('to', formatDateLocal(now))
        params.set('year', now.getFullYear().toString())
      } else if (quickId === 'year-report') {
        params.set('year', now.getFullYear().toString())
      } else if (quickId === 'quick-print') {
        // Open print preview with current filters
        toast.dismiss('quick-export')
        setSelectedExportType('interventions')
        // Use setTimeout to ensure state is set before opening dialog
        setTimeout(() => setIsPrintOpen(true), 100)
        return
      } else if (quickId === 'low-stock') {
        // For low stock, use products API directly
        const res = await fetch('/api/products?alerte=true')
        if (!res.ok) {
          if (res.status === 401) throw new Error('auth')
          throw new Error('fetch')
        }
        const data = await res.json()
        const products = data.products || []
        if (products.length === 0) {
          toast.info('لا توجد منتجات منخفضة المخزون', { id: 'quick-export' })
          return
        }
        // Generate CSV client-side for low stock
        const BOM = '\uFEFF'
        const headers = ['المرجع', 'المنتج', 'الفئة', 'المخزون', 'عتبة التنبيه', 'الوحدة']
        const rows = products.map((p: Record<string, unknown>) =>
          [p.reference, p.nom, TYPE_LABELS[p.categorie as string] || p.categorie, p.quantiteStock, p.seuilAlerte, p.unite]
            .map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')
        )
        const csv = BOM + [headers.join(','), ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv; charset=utf-8' })
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `low-stock-${now.toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)

        addToHistory('inventory', 'csv', products.length)
        toast.success(`تم تصدير تقرير المخزون المنخفض — ${products.length} منتج`, { id: 'quick-export' })
        return
      }

      if (filterCommune !== 'ALL') params.set('commune', filterCommune)
      const url = `/api/export?${params.toString()}`
      const communePart = filterCommune !== 'ALL' ? `-${encodeURIComponent(filterCommune)}` : ''
      const quickLabel = quickId === 'current-month' ? 'monthly' : 'yearly'
      const filename = `${quickLabel}-${now.getFullYear()}${communePart}.csv`

      const res = await fetch(url)
      if (!res.ok) {
        if (res.status === 401) throw new Error('auth')
        throw new Error('fetch')
      }
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)

      const quickType = quickId === 'current-month' ? 'monthly' : 'interventions'
      addToHistory(quickType, 'csv', 0)
      toast.success('تم تصدير التقرير بنجاح', { id: 'quick-export' })
    } catch (err) {
      if (err instanceof Error && err.message === 'auth') {
        toast.error('يرجى تسجيل الدخول أولاً', { id: 'quick-export' })
      } else {
        toast.error('فشل في تصدير التقرير', { id: 'quick-export' })
      }
    }
  }, [filterCommune, addToHistory])

  // Toggle custom field
  const toggleCustomField = useCallback((fieldId: string) => {
    setCustomFields(prev => ({ ...prev, [fieldId]: !prev[fieldId] }))
  }, [])

  // Clear history
  const clearHistory = useCallback(() => {
    setExportHistory([])
    localStorage.removeItem('bch-export-history')
    toast.success('تم مسح سجل التصدير')
  }, [])

  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>📤</span> مركز التصدير المتقدم
          </h2>
          <p className="text-sm text-slate-500 mt-1">تصدير التقارير والبيانات بصيغ مختلفة — Bureau Communal de l&apos;Hygiène</p>
        </div>
      </motion.div>

      {/* Quick Export Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
      >
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">⚡ تصدير سريع</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_EXPORTS.map((q) => (
            <motion.button
              key={q.id}
              onClick={() => handleQuickExport(q.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-3 p-3 rounded-xl border border-emerald-200 bg-gradient-to-l from-emerald-50 to-teal-50 hover:from-emerald-100 hover:to-teal-100 transition-all text-right"
            >
              <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center text-xl shrink-0">
                {q.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-emerald-800 truncate">{q.label}</div>
                <div className="text-[11px] text-emerald-600/70 truncate">{q.description}</div>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Export Type Selection */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
      >
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">📋 اختر نوع التقرير</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {EXPORT_TYPES.map((expType) => {
            const isSelected = selectedExportType === expType.id
            return (
              <motion.div
                key={expType.id}
                onClick={() => setSelectedExportType(expType.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') setSelectedExportType(expType.id) }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`relative flex items-start gap-3 p-4 rounded-2xl border-2 transition-all text-right ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/50 shadow-md shadow-emerald-100'
                    : 'border-slate-100 bg-slate-50/50 hover:border-slate-200 hover:bg-slate-50'
                }`}
              >
                {/* Selection indicator */}
                {isSelected && (
                  <motion.div
                    layoutId="export-type-indicator"
                    className="absolute top-2 left-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                  >
                    <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </motion.div>
                )}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: expType.color + '20' }}
                >
                  {expType.icon}
                </div>
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${isSelected ? 'text-emerald-800' : 'text-slate-700'}`}>
                    {expType.title}
                  </div>
                  <div className={`text-[11px] mt-0.5 ${isSelected ? 'text-emerald-600/70' : 'text-slate-400'}`}>
                    {expType.description}
                  </div>
                  <button
                    type="button"
                    onClick={(event) => { event.stopPropagation(); openPdfForType(expType.id) }}
                    className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-100"
                  >
                    📕 المعاينة وPDF
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </motion.div>

      {/* Export Options Panel — shown after type selection */}
      <AnimatePresence>
        {selectedExportType && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">⚙️ خيارات التصدير</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Commune Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">🏛️ الجماعة</label>
                  <select
                    value={filterCommune}
                    onChange={(e) => setFilterCommune(e.target.value)}
                    disabled={!canSelectCommune}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                  >
                    <option value="ALL">{canSeeAllCommunes ? 'كل الجماعات' : 'كل جماعات الحساب'}</option>
                    {availableCommunes.map((key) => (
                      <option key={key} value={key}>{COMMUNE_LABELS[key] || key}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {canSeeAllCommunes ? 'يمكنك اختيار أي نطاق ترابي' : `النطاق مرتبط بحسابك: ${accountCommunes.map((commune) => COMMUNE_LABELS[commune] || commune).join('، ') || 'غير محدد'}`}
                  </p>
                </div>

                {/* Year Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">📅 السنة من الشريط العلوي</label>
                  <div className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-bold text-slate-700">
                    {filterYear || 'كل السنوات'}
                  </div>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">🏷️ النوع</label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                  >
                    <option value="ALL">الكل</option>
                    {Object.entries(TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">📊 الحالة</label>
                  <select
                    value={filterStatut}
                    onChange={(e) => setFilterStatut(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                  >
                    <option value="ALL">الكل</option>
                    {Object.entries(STATUT_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">📆 الفترة (اختياري)</label>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">من:</span>
                    <input
                      type="date"
                      value={filterFrom}
                      onChange={(e) => setFilterFrom(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">إلى:</span>
                    <input
                      type="date"
                      value={filterTo}
                      onChange={(e) => setFilterTo(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                      dir="ltr"
                    />
                  </div>
                  {(filterFrom || filterTo) && (
                    <button
                      onClick={() => { setFilterFrom(''); setFilterTo('') }}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      ✕ مسح الفترة
                    </button>
                  )}
                </div>
              </div>

              {/* Custom Fields — only for custom report type */}
              {selectedExportType === 'custom' && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <label className="block text-xs font-semibold text-slate-600 mb-2">📝 اختر الحقول</label>
                  <div className="flex flex-wrap gap-2">
                    {CUSTOM_FIELDS.map((field) => (
                      <button
                        key={field.id}
                        onClick={() => toggleCustomField(field.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          customFields[field.id]
                            ? 'bg-emerald-100 text-emerald-700 border-emerald-300 shadow-sm'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {customFields[field.id] && '✓ '}{field.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Export Format Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-2">📁 صيغة التصدير</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setExportFormat('csv')}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all border-2 ${
                      exportFormat === 'csv'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    📄 CSV ملف
                  </button>
                  <button
                    onClick={() => setExportFormat('json')}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all border-2 ${
                      exportFormat === 'json'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    🧩 JSON بيانات
                  </button>
                  <button
                    onClick={() => setExportFormat('pdf')}
                    className={`px-5 py-2 rounded-full text-sm font-medium transition-all border-2 ${
                      exportFormat === 'pdf'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-200'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300 hover:text-emerald-600'
                    }`}
                  >
                    📕 طباعة / PDF
                  </button>
                </div>
              </div>

              {/* Export Action Button */}
              <div className="flex items-center gap-3 pt-2">
                <motion.button
                  onClick={exportFormat === 'pdf' ? handlePdfExport : handleDataExport}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 text-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  تصدير {exportFormat === 'csv' ? 'CSV' : exportFormat === 'json' ? 'JSON' : 'طباعة / PDF'}
                </motion.button>
                <button
                  onClick={loadPreview}
                  className="px-5 py-3 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-emerald-300 transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                  تحديث المعاينة
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Section */}
      <AnimatePresence>
        {selectedExportType && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">👁️ معاينة البيانات</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">إجمالي السجلات:</span>
                <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{previewTotal}</span>
                {previewData.length > 0 && (
                  <span className="text-[10px] text-slate-400">(عرض أول 10)</span>
                )}
              </div>
            </div>

            {isLoadingPreview ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center space-y-3">
                  <div className="w-8 h-8 border-[3px] border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">جاري تحميل المعاينة...</p>
                </div>
              </div>
            ) : previewData.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-center">
                  <div className="text-4xl mb-2">📭</div>
                  <p className="text-sm text-slate-400">لا توجد بيانات للمعاينة</p>
                  <p className="text-xs text-slate-300 mt-1">جرّب تعديل عوامل التصفية</p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-500">#</th>
                      {previewColumns.map((col) => (
                        <th key={col} className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-500 whitespace-nowrap">{col}</th>
                      ))}
                      {selectedExportType === 'comprehensive' && <th className="px-3 py-2.5 text-right text-[11px] font-bold text-slate-500">إجراء</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((row, i) => (
                      <motion.tr
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="border-b border-slate-50 hover:bg-emerald-50/30 transition-colors"
                      >
                        <td className="px-3 py-2 text-[11px] text-slate-400 font-mono">{i + 1}</td>
                        {previewColumns.map((col) => {
                          const val = row[col] ?? '—'
                          // Color-code certain columns
                          let cellClass = 'text-xs text-slate-700'
                          let cellContent = String(val)

                          if (col === 'النوع') {
                            const typeKey = Object.entries(TYPE_LABELS).find(([, v]) => v === String(val))?.[0]
                            if (typeKey) {
                              cellContent = String(val)
                              cellClass = `text-xs font-bold`
                              return (
                                <td key={col} className="px-3 py-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-white text-[10px] font-bold`}
                                    style={{ backgroundColor: TYPE_COLORS[typeKey] || '#64748b' }}
                                  >
                                    {cellContent}
                                  </span>
                                </td>
                              )
                            }
                          }
                          if (col === 'الحالة') {
                            const statutKey = Object.entries(STATUT_LABELS).find(([, v]) => v === val)?.[0]
                            if (statutKey) {
                              return (
                                <td key={col} className="px-3 py-2">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-white text-[10px] font-bold`}
                                    style={{ backgroundColor: STATUT_COLORS[statutKey] || '#64748b' }}
                                  >
                                    {val}
                                  </span>
                                </td>
                              )
                            }
                          }
                          if (col === 'الجماعة' && val !== '—') {
                            const communeColor = COMMUNE_COLORS[String(val)] || '#64748b'
                            return (
                              <td key={col} className="px-3 py-2">
                                <span
                                  className="px-2 py-0.5 rounded-md text-white text-[10px] font-bold"
                                  style={{ backgroundColor: communeColor }}
                                >
                                  {val}
                                </span>
                              </td>
                            )
                          }
                          if (col === 'الحالة' && String(val).includes('منخفض')) {
                            return (
                              <td key={col} className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
                                  {val}
                                </span>
                              </td>
                            )
                          }
                          if (col === 'الحالة' && String(val).includes('متوفر')) {
                            return (
                              <td key={col} className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                  {val}
                                </span>
                              </td>
                            )
                          }
                          return (
                            <td key={col} className={`px-3 py-2 ${cellClass}`}>{cellContent}</td>
                          )
                        })}
                        {selectedExportType === 'comprehensive' && (
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => openSectionPdf(String(row['القسم'] || 'القسم'), Number(row['عدد السجلات'] || 0))}
                              className="whitespace-nowrap rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 transition hover:bg-rose-100"
                            >
                              📕 PDF القسم
                            </button>
                          </td>
                        )}
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Export History */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">🕐 سجل التصدير</h3>
          {exportHistory.length > 0 && (
            <button
              onClick={clearHistory}
              className="text-[11px] text-red-400 hover:text-red-600 font-medium transition-colors"
            >
              🗑️ مسح السجل
            </button>
          )}
        </div>

        {exportHistory.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <div className="text-center">
              <div className="text-3xl mb-1">📂</div>
              <p className="text-xs text-slate-400">لم تقم بأي عملية تصدير بعد</p>
            </div>
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar">
            {exportHistory.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center text-sm">
                    {item.format === 'CSV' ? '📄' : item.format === 'PDF' ? '📕' : '🖨️'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-700">{item.typeLabel}</div>
                    <div className="text-[10px] text-slate-400">{item.commune} — {item.recordCount} سجل</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200/70 text-slate-600">{item.format}</span>
                  <span className="text-[10px] text-slate-400">{item.date}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }
      `}</style>

      {/* Print Document Dialog */}
      <PrintDocument
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        exportType={selectedExportType === 'comprehensive' ? 'statistics' : selectedExportType}
        filterCommune={filterCommune}
        filterYear={filterYear}
        filterType={filterType}
        filterStatut={filterStatut}
        filterFrom={filterFrom}
        filterTo={filterTo}
      />
    </div>
  )
}
