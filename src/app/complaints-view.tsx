'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type CommuneType } from '@/lib/store'
import { appendTerritoryParams } from '@/lib/geography'
import { territoryCommuneName, useTerritoryCommunes } from '@/hooks/use-territory-communes'
import {
  TYPE_LABELS, TYPE_COLORS, TYPE_ICONS,
  COMMUNE_LABELS, COMMUNE_COLORS,
  FOOD_TYPE_LABELS, FOOD_TYPE_ICONS, FOOD_TYPE_COLORS,
  FOOD_REPORT_STATUS_LABELS, FOOD_REPORT_STATUS_COLORS,
} from '@/lib/constants'

// ===== COMPLAINT TYPES =====
interface Complaint {
  id: string
  reference: string
  nomCitoyen: string
  telephone: string | null
  adresse: string
  quartier: string | null
  commune: string
  type: string
  description: string
  priorite: string
  statut: string
  interventionId: string | null
  environmentalDossierId: string | null
  dossier?: { id: string; reference: string; status: string; dueDate: string | null; closedAt?: string | null } | null
  intervention?: { id: string; reference: string; type: string; statut: string } | null
  environmentalDossier?: { id: string; reference: string; title: string; status: string } | null
  contacts?: ComplaintContact[]
  dateReception: string
  dateTraitement: string | null
  observations: string | null
  createdAt: string
  updatedAt: string
}

interface ComplaintContact {
  id: string
  channel: string
  outcome: string
  notes: string
  contactedAt: string
  contactedBy: string
}

interface FoodReportItem {
  id: string
  reference: string
  source: string
  commune: string
  quartier: string
  adresse: string
  reportType: string
  establishmentName: string
  description: string
  priority: string
  statut: string
  createdAt: string
  photos?: { id: string }[]
}

const STATUT_LABELS: Record<string, string> = {
  EN_ATTENTE: 'في الانتظار',
  EN_COURS: 'قيد المعالجة',
  TRAITEE: 'تمت معالجتها',
  REJETEE: 'مرفوضة',
}

const STATUT_COLORS: Record<string, string> = {
  EN_ATTENTE: '#f59e0b',
  EN_COURS: '#3b82f6',
  TRAITEE: '#10b981',
  REJETEE: '#ef4444',
}

const PRIORITE_LABELS: Record<string, string> = {
  URGENTE: 'عاجلة',
  HAUTE: 'عالية',
  NORMALE: 'عادية',
  BASSE: 'منخفضة',
}

const PRIORITE_COLORS: Record<string, string> = {
  URGENTE: '#ef4444',
  HAUTE: '#f59e0b',
  NORMALE: '#3b82f6',
  BASSE: '#6b7280',
}

const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  ...TYPE_LABELS,
  FOOD: 'سلامة غذائية',
  ANIMAL: 'حيوان شارد',
  ENVIRONMENT: 'بلاغ بيئي',
}

const CONTACT_CHANNEL_LABELS: Record<string, string> = {
  PHONE: 'اتصال هاتفي',
  WHATSAPP: 'واتساب',
  VISIT: 'زيارة ميدانية',
  EMAIL: 'بريد إلكتروني',
  OTHER: 'وسيلة أخرى',
}

// ===== COMPLAINTS VIEW =====
function ComplaintsView() {
  const { user, territoryFilter, selectedYear, setCurrentView, setEnvironmentSubTab } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const { communes: scopedCommunes } = useTerritoryCommunes(territoryFilter, useTerritoryFilter)
  const scopedCommuneNames = useMemo(
    () => Array.from(new Set(scopedCommunes.map(territoryCommuneName).filter(Boolean)))
      .sort((first, second) => first.localeCompare(second, 'ar')),
    [scopedCommunes]
  )
  const accessibleCommuneNames = useMemo(() => {
    if (useTerritoryFilter) return scopedCommuneNames
    if (user?.managedCommunes?.length) return Array.from(new Set(user.managedCommunes))
    return user?.commune && user.commune !== 'ALL' ? [user.commune] : []
  }, [scopedCommuneNames, useTerritoryFilter, user])
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [foodReports, setFoodReports] = useState<FoodReportItem[]>([])
  const [showFoodReports, setShowFoodReports] = useState(false)
  const [filterStatut, setFilterStatut] = useState('ALL')
  const [filterCommune, setFilterCommune] = useState<string>('ALL')
  const [filterType, setFilterType] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [detailComplaint, setDetailComplaint] = useState<Complaint | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)

  // Add form
  const [addForm, setAddForm] = useState({
    nomCitoyen: '',
    telephone: '',
    quartier: '',
    commune: '',
    type: 'DERATISATION',
    description: '',
    priorite: 'NORMALE',
    observations: '',
  })
  const [addSubmitting, setAddSubmitting] = useState(false)

  // Edit state
  const [editStatut, setEditStatut] = useState('')
  const [editObservations, setEditObservations] = useState('')
  const [editInterventionId, setEditInterventionId] = useState('')
  const [editSubmitting, setEditSubmitting] = useState(false)
  const [contactChannel, setContactChannel] = useState('PHONE')
  const [contactOutcome, setContactOutcome] = useState('')
  const [contactNotes, setContactNotes] = useState('')
  const [contactSubmitting, setContactSubmitting] = useState(false)

  // Interventions for linking
  const [availableInterventions, setAvailableInterventions] = useState<{ id: string; reference: string; type: string; statut: string }[]>([])

  // Search debounce
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const fetchComplaints = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterCommune !== 'ALL') params.set('commune', filterCommune)
      if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
      if (selectedYear) params.set('year', selectedYear)
      if (filterStatut !== 'ALL') params.set('statut', filterStatut)
      if (filterType !== 'ALL') params.set('type', filterType)
      if (debouncedSearch) params.set('search', debouncedSearch)
      const res = await fetch(`/api/complaints?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        return { complaints: data.complaints || [], total: data.total || 0 }
      }
    } catch { /* ignore */ }
    return null
  }, [debouncedSearch, filterCommune, filterStatut, filterType, selectedYear, territoryFilter, useTerritoryFilter])

  const refreshComplaints = useCallback(async () => {
    const result = await fetchComplaints()
    if (result) {
      setComplaints(result.complaints)
      setTotal(result.total)
    }
  }, [fetchComplaints])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const result = await fetchComplaints()
      if (!cancelled && result) {
        setComplaints(result.complaints)
        setTotal(result.total)
        setIsLoading(false)
      }
      // اجلب أيضاً البلاغات الغذائية (لإظهارها كقسم منفصل)
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
        if (selectedYear) params.set('year', selectedYear)
        const foodRes = await fetch(`/api/food-reports?${params.toString()}`)
        if (foodRes.ok) {
          const foodData = await foodRes.json()
          if (!cancelled) setFoodReports(foodData.reports || [])
        }
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [fetchComplaints, filterCommune, territoryFilter, useTerritoryFilter])

  const fetchAvailableInterventions = useCallback(async (commune: string) => {
    try {
      const params = new URLSearchParams()
      if (commune) params.set('commune', commune)
      params.set('limit', '100')
      const res = await fetch(`/api/interventions?${params.toString()}`)
      if (res.ok) {
        const data = await res.json()
        setAvailableInterventions((data.interventions || []).map((i: { id: string; reference: string; type: string; statut: string }) => ({
          id: i.id, reference: i.reference, type: i.type, statut: i.statut,
        })))
      }
    } catch { /* ignore */ }
  }, [])

  const handleShowDetail = useCallback(async (complaint: Complaint) => {
    setDetailComplaint(complaint)
    setEditStatut(complaint.statut)
    setEditObservations(complaint.observations || '')
    setEditInterventionId(complaint.interventionId || '')
    setContactChannel('PHONE')
    setContactOutcome('')
    setContactNotes('')
    fetchAvailableInterventions(complaint.commune)
    try {
      const res = await fetch(`/api/complaints/${complaint.id}`)
      if (res.ok) {
        const freshComplaint = await res.json() as Complaint
        setDetailComplaint(freshComplaint)
        setEditStatut(freshComplaint.statut)
        setEditObservations(freshComplaint.observations || '')
        setEditInterventionId(freshComplaint.interventionId || '')
      }
    } catch {
      return
    }
  }, [fetchAvailableInterventions])

  const handleAddComplaint = useCallback(async () => {
    if (!addForm.nomCitoyen || !addForm.commune || !addForm.type || !addForm.description) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    setAddSubmitting(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, territoryFilter: useTerritoryFilter ? territoryFilter : undefined }),
      })
      if (res.ok) {
        toast.success('تم إنشاء الشكاية بنجاح')
        setShowAddDialog(false)
        setAddForm({ nomCitoyen: '', telephone: '', quartier: '', commune: accessibleCommuneNames.length === 1 ? accessibleCommuneNames[0] : '', type: 'DERATISATION', description: '', priorite: 'NORMALE', observations: '' })
        await refreshComplaints()
      } else {
        const data = await res.json()
        toast.error(data.error || 'فشل في إنشاء الشكاية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setAddSubmitting(false)
  }, [accessibleCommuneNames, addForm, refreshComplaints, territoryFilter, useTerritoryFilter])

  const handleUpdateComplaint = useCallback(async () => {
    if (!detailComplaint) return
    setEditSubmitting(true)
    try {
      const res = await fetch(`/api/complaints/${detailComplaint.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statut: editStatut,
          observations: editObservations,
          interventionId: editInterventionId || null,
        }),
      })
      if (res.ok) {
        toast.success('تم تحديث الشكاية بنجاح')
        await res.json()
        await refreshComplaints()
        setDetailComplaint(null)
        setShowDeleteConfirm(null)
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || 'فشل في تحديث الشكاية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setEditSubmitting(false)
  }, [detailComplaint, editStatut, editObservations, editInterventionId, refreshComplaints])

  const handleCreateEnvironmentalDossier = useCallback(async () => {
    if (!detailComplaint) return
    try {
      const res = await fetch(`/api/complaints/${detailComplaint.id}/environment`, { method: 'POST' })
      const data = await res.json().catch(() => null) as { dossier?: Complaint['environmentalDossier']; error?: string; alreadyLinked?: boolean } | null
      if (!res.ok || !data?.dossier) {
        toast.error(data?.error || 'فشل تحويل الشكاية إلى ملف بيئي')
        return
      }
      const environmentalDossier = data.dossier
      setDetailComplaint((current) => current ? {
        ...current,
        environmentalDossierId: environmentalDossier.id,
        environmentalDossier,
      } : current)
      toast.success(data.alreadyLinked ? 'الشكاية مرتبطة بملف بيئي مسبقاً' : 'تم إنشاء الملف البيئي وربطه بالشكاية')
    } catch {
      toast.error('تعذر إنشاء الملف البيئي حالياً')
    }
  }, [detailComplaint])

  const handleOpenEnvironmentalDossier = useCallback(() => {
    setEnvironmentSubTab('dossiers')
    setCurrentView('environment')
    setDetailComplaint(null)
  }, [setCurrentView, setEnvironmentSubTab])

  const handleAddContact = useCallback(async () => {
    if (!detailComplaint) return
    if (contactOutcome.trim().length < 3) {
      toast.error('يرجى تدوين نتيجة التواصل')
      return
    }
    setContactSubmitting(true)
    try {
      const res = await fetch(`/api/complaints/${detailComplaint.id}/contacts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: contactChannel, outcome: contactOutcome, notes: contactNotes }),
      })
      if (res.ok) {
        const contact = await res.json() as ComplaintContact
        setDetailComplaint((current) => current ? { ...current, contacts: [contact, ...(current.contacts || [])] } : current)
        setContactOutcome('')
        setContactNotes('')
        toast.success('تم حفظ تواصل المشتكي')
      } else {
        const data = await res.json().catch(() => null)
        toast.error(data?.error || 'فشل في حفظ التواصل')
      }
    } catch {
      toast.error('حدث خطأ أثناء حفظ التواصل')
    }
    setContactSubmitting(false)
  }, [contactChannel, contactNotes, contactOutcome, detailComplaint])

  const handleDeleteComplaint = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/complaints/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الشكاية بنجاح')
        setDetailComplaint(null)
        setShowDeleteConfirm(null)
        await refreshComplaints()
      } else {
        toast.error('فشل في حذف الشكاية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }, [refreshComplaints])

  // Print complaint report
  const handlePrintComplaint = useCallback((complaint: Complaint) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة')
      return
    }
    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير شكاية ${complaint.reference}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap');
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #1e293b; line-height: 1.6; font-size: 12px; }
    .header { text-align: center; padding-bottom: 14px; border-bottom: 3px solid #1f2937; margin-bottom: 16px; position: relative; }
    .header::after { content: ''; position: absolute; bottom: -5px; left: 0; right: 0; height: 1.5px; background: #1f2937; }
    .header h1 { font-size: 16px; font-weight: 900; color: #1f2937; }
    .header p { font-size: 10px; color: #6b7280; font-style: italic; }
    .ref-bar { display: flex; justify-content: space-between; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 8px; padding: 10px 16px; margin-bottom: 16px; }
    .ref-bar .label { font-size: 9px; color: #6b7280; font-weight: 600; }
    .ref-bar .value { font-size: 12px; color: #1f2937; font-weight: 700; }
    .title-section { text-align: center; margin-bottom: 16px; padding: 10px; background: #f3f4f6; border-radius: 8px; border: 1px solid #d1d5db; }
    .title-section h2 { font-size: 14px; font-weight: 800; }
    .badges { display: flex; justify-content: center; gap: 8px; margin-top: 6px; }
    .badge { padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 700; color: white; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .info-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; background: #f8fafc; }
    .info-card .label { font-size: 9px; color: #64748b; font-weight: 600; margin-bottom: 2px; }
    .info-card .value { font-size: 11px; color: #1e293b; font-weight: 600; }
    .full-width { grid-column: 1 / -1; }
    .signature-section { margin-top: 40px; padding-top: 16px; }
    .signature-grid { display: flex; justify-content: space-between; gap: 20px; }
    .signature-box { flex: 1; text-align: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 8px; }
    .signature-box .role { font-size: 10px; font-weight: 700; color: #1f2937; margin-bottom: 20px; }
    .signature-box .line { border-top: 1px solid #374151; width: 70%; margin: 0 auto; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div style="font-size:10px;font-weight:700;background:#1f2937;color:white;padding:3px 12px;border-radius:4px;display:inline-block;">المملكة المغربية</div>
    <h1 style="margin-top:6px;">مكتب حفظ الصحة الجماعي</h1>
    <p>Bureau Communal de l'Hygiène — Bouknadel Salé</p>
  </div>
  <div class="ref-bar">
    <div><div class="label">مرجع الشكاية / Référence</div><div class="value" style="font-family:monospace;">${complaint.reference}</div></div>
    <div style="text-align:left;"><div class="label">تاريخ الاستقبال / Date</div><div class="value">${new Date(complaint.dateReception).toLocaleDateString('ar-MA')}</div></div>
  </div>
  <div class="title-section">
    <h2>تقرير الشكاية</h2>
    <div class="badges">
      <span class="badge" style="background:${STATUT_COLORS[complaint.statut] || '#6b7280'}">${STATUT_LABELS[complaint.statut] || complaint.statut}</span>
      <span class="badge" style="background:${PRIORITE_COLORS[complaint.priorite] || '#6b7280'}">${PRIORITE_LABELS[complaint.priorite] || complaint.priorite}</span>
      <span class="badge" style="background:${TYPE_COLORS[complaint.type] || '#64748b'}">${COMPLAINT_TYPE_LABELS[complaint.type] || complaint.type}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-card"><div class="label">👤 اسم المواطن</div><div class="value">${complaint.nomCitoyen}</div></div>
    <div class="info-card"><div class="label">📞 الهاتف</div><div class="value">${complaint.telephone || '—'}</div></div>
    <div class="info-card"><div class="label">🏘️ الحي</div><div class="value">${complaint.quartier || '—'}</div></div>
    <div class="info-card"><div class="label">🏛️ الجماعة</div><div class="value">${COMMUNE_LABELS[complaint.commune as keyof typeof COMMUNE_LABELS] || complaint.commune}</div></div>
    <div class="info-card"><div class="label">📋 النوع</div><div class="value">${COMPLAINT_TYPE_LABELS[complaint.type] || complaint.type}</div></div>
    <div class="info-card"><div class="label">⚡ الأولوية</div><div class="value">${PRIORITE_LABELS[complaint.priorite] || complaint.priorite}</div></div>
    <div class="info-card"><div class="label">📊 الحالة</div><div class="value">${STATUT_LABELS[complaint.statut] || complaint.statut}</div></div>
    <div class="info-card"><div class="label">📅 تاريخ الاستقبال</div><div class="value">${new Date(complaint.dateReception).toLocaleDateString('ar-MA')}</div></div>
    <div class="info-card full-width"><div class="label">📝 الوصف</div><div class="value" style="white-space:pre-wrap;">${complaint.description}</div></div>
    ${complaint.observations ? `<div class="info-card full-width"><div class="label">💬 الملاحظات</div><div class="value">${complaint.observations}</div></div>` : ''}
    ${complaint.intervention ? `<div class="info-card full-width" style="background:#ecfdf5;border-color:#a7f3d0;"><div class="label" style="color:#059669;">🔗 التدخل المرتبط</div><div class="value" style="color:#047857;">${complaint.intervention.reference} — ${TYPE_LABELS[complaint.intervention.type] || complaint.intervention.type}</div></div>` : ''}
  </div>
  <div class="signature-section">
    <div class="signature-grid">
      <div class="signature-box"><div class="role">المواطن(ة)</div><div class="line"></div></div>
      <div class="signature-box"><div class="role">رئيس المصالح</div><div class="line"></div></div>
      <div class="signature-box"><div class="role">الرئيس</div><div class="line"></div></div>
    </div>
  </div>
  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`
    printWindow.document.write(html)
    printWindow.document.close()
  }, [])

  // Statistics
  const stats = {
    total: complaints.length,
    EN_ATTENTE: complaints.filter(c => c.statut === 'EN_ATTENTE').length,
    EN_COURS: complaints.filter(c => c.statut === 'EN_COURS').length,
    TRAITEE: complaints.filter(c => c.statut === 'TRAITEE').length,
    REJETEE: complaints.filter(c => c.statut === 'REJETEE').length,
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 pb-24 lg:pb-6" dir="rtl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">📢 تدبير الشكايات</h2>
          <p className="text-slate-400 text-sm mt-1">{total} شكاية مسجلة</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto items-center flex-wrap">
          <motion.button
            whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2 text-sm whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            إضافة شكاية
          </motion.button>
          <div className="relative flex-1 sm:w-64">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="بحث بالاسم أو المرجع..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { key: 'total', label: 'الإجمالي', count: stats.total, color: '#64748b', icon: '📊' },
          { key: 'EN_ATTENTE', label: 'في الانتظار', count: stats.EN_ATTENTE, color: STATUT_COLORS.EN_ATTENTE, icon: '⏳' },
          { key: 'EN_COURS', label: 'قيد المعالجة', count: stats.EN_COURS, color: STATUT_COLORS.EN_COURS, icon: '🔄' },
          { key: 'TRAITEE', label: 'تمت معالجتها', count: stats.TRAITEE, color: STATUT_COLORS.TRAITEE, icon: '✅' },
          { key: 'REJETEE', label: 'مرفوضة', count: stats.REJETEE, color: STATUT_COLORS.REJETEE, icon: '❌' },
        ].map((s) => (
          <motion.div key={s.key} whileHover={{ scale: 1.02 }}
            className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: s.color + '15' }}>
                {s.icon}
              </div>
              <div>
                <p className="text-[10px] text-slate-400 font-medium">{s.label}</p>
                <p className="text-xl font-extrabold" style={{ color: s.color }}>{s.count}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-2">
        <button onClick={() => setFilterStatut('ALL')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${filterStatut === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white border border-slate-100 text-slate-600'}`}>
          الكل
        </button>
        {Object.entries(STATUT_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setFilterStatut(filterStatut === k ? 'ALL' : k)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              filterStatut === k ? 'shadow-md ring-2 ring-offset-1' : 'bg-white border border-slate-100'
            }`}
            style={filterStatut === k ? { backgroundColor: STATUT_COLORS[k] + '15', color: STATUT_COLORS[k] } : {}}>
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUT_COLORS[k] }} />
            {v}: {complaints.filter(c => c.statut === k).length}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
          <option value="ALL">كل الجماعات</option>
          {accessibleCommuneNames.map((commune) => <option key={commune} value={commune}>جماعة {commune}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
          <option value="ALL">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* ===== Food Safety Reports Section ===== */}
      {foodReports.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border-2 border-rose-200 bg-rose-50/50 overflow-hidden"
        >
          {/* Banner */}
          <button
            onClick={() => setShowFoodReports(!showFoodReports)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-l from-rose-600 to-red-600 text-white"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">🥗</span>
              <div className="text-right">
                <div className="font-bold text-sm">بلاغات السلامة الغذائية</div>
                <div className="text-rose-100 text-[11px]">{foodReports.length} بلاغ · {foodReports.filter(r => r.statut === 'NOUVEAU').length} جديد</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {foodReports.filter(r => r.statut === 'NOUVEAU').length > 0 && (
                <span className="bg-white/25 rounded-full px-2 py-0.5 text-[10px] font-bold animate-pulse">
                  {foodReports.filter(r => r.statut === 'NOUVEAU').length} جديد
                </span>
              )}
              <svg xmlns="http://www.w3.org/2000/svg" className={`h-4 w-4 transition-transform ${showFoodReports ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </button>

          {/* Food reports list (collapsible) */}
          {showFoodReports && (
            <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
              {foodReports.map((r) => (
                <div key={r.id} className="bg-white rounded-xl border border-slate-100 p-3 flex items-start justify-between gap-2 hover:shadow-sm transition-all">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-lg shrink-0">{FOOD_TYPE_ICONS[r.reportType] || '🥗'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-800">{r.reference}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold text-white" style={{ backgroundColor: FOOD_REPORT_STATUS_COLORS[r.statut] || '#94a3b8' }}>
                          {FOOD_REPORT_STATUS_LABELS[r.statut] || r.statut}
                        </span>
                        {r.source === 'PUBLIC' && <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-600">عمومي</span>}
                        {r.photos && r.photos.length > 0 && <span className="text-[10px]">📸 {r.photos.length}</span>}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 line-clamp-1">
                        {r.establishmentName ? `🏪 ${r.establishmentName} — ` : ''}{r.description || 'بدون وصف'}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {FOOD_TYPE_LABELS[r.reportType] || r.reportType} · {r.commune} · {new Date(r.createdAt).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <a
                    href="#"
                    onClick={(e) => { e.preventDefault(); setCurrentView('food') }}
                    className="shrink-0 text-[10px] font-bold text-rose-600 hover:text-rose-800 px-2 py-1 rounded-lg hover:bg-rose-100"
                  >
                    عرض ←
                  </a>
                </div>
              ))}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setCurrentView('food') }}
                className="block text-center text-xs font-bold text-rose-600 hover:text-rose-800 py-2"
              >
                عرض كل البلاغات الغذائية ←
              </a>
            </div>
          )}
        </motion.div>
      )}

      {/* Complaints List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : complaints.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-center py-16 text-slate-400">
          <p className="text-5xl mb-3">📢</p>
          <p className="font-medium">لا توجد شكايات</p>
          <p className="text-sm mt-1">أضف شكاية جديدة باستخدام زر &quot;إضافة شكاية&quot;</p>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {complaints.map((complaint, i) => (
              <motion.div key={complaint.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-lg hover:border-emerald-100 transition-all group cursor-pointer"
                onClick={() => handleShowDetail(complaint)}>
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                      style={{ backgroundColor: (PRIORITE_COLORS[complaint.priorite] || '#64748b') + '12' }}>
                      📢
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-800 font-mono">{complaint.reference}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: STATUT_COLORS[complaint.statut] + '15', color: STATUT_COLORS[complaint.statut] }}>
                          {STATUT_LABELS[complaint.statut]}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: PRIORITE_COLORS[complaint.priorite] + '15', color: PRIORITE_COLORS[complaint.priorite] }}>
                          {PRIORITE_LABELS[complaint.priorite]}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: (TYPE_COLORS[complaint.type] || '#64748b') + '15', color: TYPE_COLORS[complaint.type] || '#64748b' }}>
                          {COMPLAINT_TYPE_LABELS[complaint.type] || complaint.type}
                        </span>
                        {complaint.commune && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                            style={{ backgroundColor: (COMMUNE_COLORS[complaint.commune as keyof typeof COMMUNE_COLORS] || '#64748b') + '15', color: COMMUNE_COLORS[complaint.commune as keyof typeof COMMUNE_COLORS] || '#64748b' }}>
                            {COMMUNE_LABELS[complaint.commune as keyof typeof COMMUNE_LABELS] || complaint.commune}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 font-medium mt-1">👤 {complaint.nomCitoyen}</p>
                      <p className="text-xs text-slate-500 mt-0.5">📍 {complaint.quartier || COMMUNE_LABELS[complaint.commune as keyof typeof COMMUNE_LABELS] || complaint.commune}</p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{complaint.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">📅 {new Date(complaint.dateReception).toLocaleDateString('ar-MA')}</span>
                        {complaint.telephone && <span className="flex items-center gap-1">📞 {complaint.telephone}</span>}
                        {complaint.intervention && <span className="flex items-center gap-1">🔗 {complaint.intervention.reference}</span>}
                        {complaint.dossier && <span className="flex items-center gap-1">📂 {complaint.dossier.reference}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ===== DETAIL PANEL ===== */}
      <AnimatePresence>
        {detailComplaint && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => setDetailComplaint(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="bg-gradient-to-l from-amber-600 to-orange-600 p-5 text-white relative">
                <button onClick={() => setDetailComplaint(null)}
                  className="absolute top-3 left-3 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                {/* Print button */}
                <button onClick={() => handlePrintComplaint(detailComplaint)}
                  className="absolute top-3 left-14 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
                  title="طباعة الشكاية">
                  🖨️
                </button>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">📢</div>
                  <div>
                    <h3 className="text-lg font-extrabold font-mono">{detailComplaint.reference}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                        {STATUT_LABELS[detailComplaint.statut]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                        {PRIORITE_LABELS[detailComplaint.priorite]}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-amber-100 text-sm">👤 {detailComplaint.nomCitoyen}</p>
              </div>

              {/* Details */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">تاريخ الاستقبال</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">📅 {new Date(detailComplaint.dateReception).toLocaleDateString('ar-MA')}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الهاتف</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">📞 {detailComplaint.telephone || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الجماعة</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                      {detailComplaint.commune ? (
                        <span className="px-2 py-0.5 rounded-md text-white text-[11px]" style={{ backgroundColor: COMMUNE_COLORS[detailComplaint.commune as keyof typeof COMMUNE_COLORS] || '#64748b' }}>
                          {COMMUNE_LABELS[detailComplaint.commune as keyof typeof COMMUNE_LABELS] || detailComplaint.commune}
                        </span>
                      ) : '—'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الحي</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">📍 {detailComplaint.quartier || '—'}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">النوع</p>
                    <p className="text-xs font-bold mt-0.5">
                      <span className="px-2 py-0.5 rounded-md text-white text-[11px]" style={{ backgroundColor: TYPE_COLORS[detailComplaint.type] || '#64748b' }}>
                        {COMPLAINT_TYPE_LABELS[detailComplaint.type] || detailComplaint.type}
                      </span>
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الأولوية</p>
                    <p className="text-xs font-bold mt-0.5">
                      <span className="px-2 py-0.5 rounded-md text-white text-[11px]" style={{ backgroundColor: PRIORITE_COLORS[detailComplaint.priorite] }}>
                        {PRIORITE_LABELS[detailComplaint.priorite]}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-[10px] text-slate-400 font-medium">الوصف</p>
                  <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">{detailComplaint.description}</p>
                </div>

                {detailComplaint.intervention && (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <p className="text-[10px] text-emerald-600 font-bold mb-1">التدخل المرتبط</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-700 font-mono">{detailComplaint.intervention.reference}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: TYPE_COLORS[detailComplaint.intervention.type] + '15', color: TYPE_COLORS[detailComplaint.intervention.type] }}>
                        {TYPE_LABELS[detailComplaint.intervention.type]}
                      </span>
                    </div>
                  </div>
                )}

                {detailComplaint.dossier && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="mb-1 text-[10px] font-bold text-indigo-600">📂 الملف الموحد · المكتب 07</p>
                        <p className="font-mono text-xs font-bold text-indigo-800">{detailComplaint.dossier.reference}</p>
                        <p className="mt-1 text-[11px] text-indigo-700">الحالة: {detailComplaint.dossier.status}</p>
                      </div>
                      <div className="text-left">
                        <p className="text-[10px] font-medium text-indigo-500">مهلة المعالجة</p>
                        <p className={`mt-1 text-xs font-bold ${detailComplaint.dossier.dueDate && new Date(detailComplaint.dossier.dueDate).getTime() < Date.now() && !detailComplaint.dossier.closedAt ? 'text-red-600' : 'text-indigo-700'}`}>
                          {detailComplaint.dossier.dueDate ? new Date(detailComplaint.dossier.dueDate).toLocaleDateString('ar-MA') : 'غير محددة'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {detailComplaint.environmentalDossier ? (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] text-emerald-600 font-bold mb-1">الملف البيئي المرتبط</p>
                        <p className="text-xs font-bold text-emerald-700 font-mono">{detailComplaint.environmentalDossier.reference}</p>
                        <p className="text-[11px] text-emerald-700 mt-1">{detailComplaint.environmentalDossier.title}</p>
                      </div>
                      <button onClick={handleOpenEnvironmentalDossier}
                        className="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors">
                        فتح الملفات البيئية
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-teal-50 rounded-xl p-3 border border-teal-100">
                    <p className="text-[10px] text-teal-700 font-bold mb-1">ربط بيئي</p>
                    <p className="text-xs text-teal-800 mb-2">يمكن تحويل هذه الشكاية إلى ملف بيئي مع الاحتفاظ بالجماعة والموقع والوصف والمصدر.</p>
                    <button onClick={handleCreateEnvironmentalDossier}
                      className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 transition-colors">
                      🌿 إنشاء ملف بيئي
                    </button>
                  </div>
                )}

                {detailComplaint.dateTraitement && (
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <p className="text-[10px] text-green-600 font-bold">تاريخ المعالجة</p>
                    <p className="text-xs font-bold text-green-700 mt-0.5">📅 {new Date(detailComplaint.dateTraitement).toLocaleDateString('ar-MA')}</p>
                  </div>
                )}

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-sm font-bold text-slate-700">📞 التواصل مع المشتكي</h4>
                    {detailComplaint.telephone && (
                      <a href={`tel:${detailComplaint.telephone}`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition-colors">
                        اتصال مباشر
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">وسيلة التواصل</label>
                      <select value={contactChannel} onChange={(event) => setContactChannel(event.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                        {Object.entries(CONTACT_CHANNEL_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">نتيجة التواصل *</label>
                      <input value={contactOutcome} onChange={(event) => setContactOutcome(event.target.value)}
                        placeholder="تم التواصل / لا يجيب..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20" />
                    </div>
                  </div>
                  <textarea value={contactNotes} onChange={(event) => setContactNotes(event.target.value)}
                    rows={2} placeholder="تفاصيل المتابعة أو التزام المشتكي..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
                  <button onClick={handleAddContact} disabled={contactSubmitting}
                    className="w-full px-4 py-2 rounded-xl bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors">
                    {contactSubmitting ? 'جاري حفظ التواصل...' : 'تسجيل التواصل'}
                  </button>
                  {(detailComplaint.contacts || []).length > 0 && (
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] text-slate-400 font-medium">سجل التواصل</p>
                      {detailComplaint.contacts!.map((contact) => (
                        <div key={contact.id} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-slate-700">{CONTACT_CHANNEL_LABELS[contact.channel] || contact.channel}</span>
                            <span className="text-slate-400">{new Date(contact.contactedAt).toLocaleString('ar-MA')}</span>
                          </div>
                          <p className="text-xs text-slate-700 mt-1">{contact.outcome}</p>
                          {contact.notes && <p className="text-xs text-slate-500 mt-1 whitespace-pre-wrap">{contact.notes}</p>}
                          <p className="text-[10px] text-slate-400 mt-2">سجله: {contact.contactedBy || '—'}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="text-sm font-bold text-slate-700">⚙️ إجراءات</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">الحالة</label>
                      <select value={editStatut} onChange={(e) => setEditStatut(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                        {Object.entries(STATUT_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 font-medium mb-1">ربط بتدخل</label>
                      <select value={editInterventionId} onChange={(e) => setEditInterventionId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
                        <option value="">— بدون —</option>
                        {availableInterventions.map(iv => (
                          <option key={iv.id} value={iv.id}>{iv.reference} ({TYPE_LABELS[iv.type] || iv.type})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 font-medium mb-1">ملاحظات</label>
                    <textarea value={editObservations} onChange={(e) => setEditObservations(e.target.value)}
                      rows={3} placeholder="إضافة ملاحظات..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none" />
                  </div>
                  <div className="flex gap-2">
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={handleUpdateComplaint}
                      disabled={editSubmitting}
                      className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                    >
                      {editSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>💾 حفظ التغييرات</>
                      )}
                    </motion.button>
                    <button onClick={() => setDetailComplaint(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors text-sm">
                      إغلاق
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100">
                    {showDeleteConfirm === detailComplaint.id ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDeleteComplaint(detailComplaint.id)}
                          className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium">تأكيد الحذف</button>
                        <button onClick={() => setShowDeleteConfirm(null)}
                          className="px-4 py-2 rounded-xl bg-slate-50 text-slate-600 text-sm font-medium">إلغاء</button>
                      </div>
                    ) : (
                      <button onClick={() => setShowDeleteConfirm(detailComplaint.id)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors">🗑️ حذف الشكاية</button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== ADD COMPLAINT DIALOG ===== */}
      <AnimatePresence>
        {showAddDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowAddDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="bg-gradient-to-l from-amber-600 to-orange-600 p-4 text-white">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>📢</span> إضافة شكاية جديدة
                </h3>
              </div>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">اسم المواطن *</label>
                    <input type="text" value={addForm.nomCitoyen} onChange={(e) => setAddForm({ ...addForm, nomCitoyen: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">الهاتف</label>
                    <input type="text" value={addForm.telephone} onChange={(e) => setAddForm({ ...addForm, telephone: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300" dir="ltr" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">الحي</label>
                    <input type="text" value={addForm.quartier} onChange={(e) => setAddForm({ ...addForm, quartier: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">الجماعة *</label>
                    <select required value={addForm.commune} onChange={(e) => setAddForm({ ...addForm, commune: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20">
                      {accessibleCommuneNames.length !== 1 && <option value="">اختر الجماعة</option>}
                      {accessibleCommuneNames.map((commune) => <option key={commune} value={commune}>جماعة {commune}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">النوع *</label>
                    <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20">
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">الأولوية</label>
                    <select value={addForm.priorite} onChange={(e) => setAddForm({ ...addForm, priorite: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20">
                      {Object.entries(PRIORITE_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">الوصف *</label>
                  <textarea value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                    rows={3} placeholder="وصف الشكاية..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">ملاحظات</label>
                  <textarea value={addForm.observations} onChange={(e) => setAddForm({ ...addForm, observations: e.target.value })}
                    rows={2} placeholder="ملاحظات إضافية..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300 resize-none" />
                </div>
                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleAddComplaint}
                    disabled={addSubmitting}
                    className="flex-1 bg-gradient-to-l from-amber-600 to-orange-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-amber-200 disabled:opacity-50 text-sm flex items-center justify-center gap-2"
                  >
                    {addSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>📢 إنشاء الشكاية</>
                    )}
                  </motion.button>
                  <button onClick={() => setShowAddDialog(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors text-sm">
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ComplaintsView
