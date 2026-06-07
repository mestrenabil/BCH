'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { type CommuneType } from '@/lib/store'
import {
  TYPE_LABELS, TYPE_COLORS, TYPE_ICONS,
  COMMUNE_LABELS, COMMUNE_COLORS,
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
  intervention?: { id: string; reference: string; type: string; statut: string } | null
  dateReception: string
  dateTraitement: string | null
  observations: string | null
  createdAt: string
  updatedAt: string
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
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
  AUTRE: 'أخرى',
}

// ===== COMPLAINTS VIEW =====
function ComplaintsView() {
  const [complaints, setComplaints] = useState<Complaint[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
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
    adresse: '',
    quartier: '',
    commune: 'سلا',
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
  }, [filterCommune, filterStatut, filterType, debouncedSearch])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const result = await fetchComplaints()
      if (!cancelled && result) {
        setComplaints(result.complaints)
        setTotal(result.total)
        setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fetchComplaints])

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
    fetchAvailableInterventions(complaint.commune)
  }, [fetchAvailableInterventions])

  const handleAddComplaint = useCallback(async () => {
    if (!addForm.nomCitoyen || !addForm.adresse || !addForm.commune || !addForm.type || !addForm.description) {
      toast.error('يرجى ملء جميع الحقول المطلوبة')
      return
    }
    setAddSubmitting(true)
    try {
      const res = await fetch('/api/complaints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(addForm),
      })
      if (res.ok) {
        toast.success('تم إنشاء الشكاية بنجاح')
        setShowAddDialog(false)
        setAddForm({ nomCitoyen: '', telephone: '', adresse: '', quartier: '', commune: 'سلا', type: 'DERATISATION', description: '', priorite: 'NORMALE', observations: '' })
        fetchComplaints()
      } else {
        const data = await res.json()
        toast.error(data.error || 'فشل في إنشاء الشكاية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setAddSubmitting(false)
  }, [addForm, fetchComplaints])

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
        const updated = await res.json()
        setDetailComplaint(updated)
        fetchComplaints()
      } else {
        toast.error('فشل في تحديث الشكاية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setEditSubmitting(false)
  }, [detailComplaint, editStatut, editObservations, editInterventionId, fetchComplaints])

  const handleDeleteComplaint = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/complaints/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف الشكاية بنجاح')
        setDetailComplaint(null)
        setShowDeleteConfirm(null)
        fetchComplaints()
      } else {
        toast.error('فشل في حذف الشكاية')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }, [fetchComplaints])

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
            style={filterStatut === k ? { backgroundColor: STATUT_COLORS[k] + '15', color: STATUT_COLORS[k], ringColor: STATUT_COLORS[k] + '30' } : {}}>
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
          <option value="سلا">جماعة سلا</option>
          <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
          <option value="عامر">جماعة عامر</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
          <option value="ALL">كل الأنواع</option>
          {Object.entries(COMPLAINT_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

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
                      <p className="text-xs text-slate-500 mt-0.5">📍 {complaint.adresse}{complaint.quartier ? ` — ${complaint.quartier}` : ''}</p>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{complaint.description}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">📅 {new Date(complaint.dateReception).toLocaleDateString('ar-MA')}</span>
                        {complaint.telephone && <span className="flex items-center gap-1">📞 {complaint.telephone}</span>}
                        {complaint.intervention && <span className="flex items-center gap-1">🔗 {complaint.intervention.reference}</span>}
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
                <p className="text-amber-100 text-sm">👤 {detailComplaint.nomCitoyen} — {detailComplaint.adresse}</p>
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

                {detailComplaint.dateTraitement && (
                  <div className="bg-green-50 rounded-xl p-3 border border-green-100">
                    <p className="text-[10px] text-green-600 font-bold">تاريخ المعالجة</p>
                    <p className="text-xs font-bold text-green-700 mt-0.5">📅 {new Date(detailComplaint.dateTraitement).toLocaleDateString('ar-MA')}</p>
                  </div>
                )}

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
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">العنوان *</label>
                  <input type="text" value={addForm.adresse} onChange={(e) => setAddForm({ ...addForm, adresse: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">الحي</label>
                    <input type="text" value={addForm.quartier} onChange={(e) => setAddForm({ ...addForm, quartier: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">الجماعة *</label>
                    <select value={addForm.commune} onChange={(e) => setAddForm({ ...addForm, commune: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20">
                      <option value="سلا">جماعة سلا</option>
                      <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                      <option value="عامر">جماعة عامر</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">النوع *</label>
                    <select value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-amber-500/20">
                      {Object.entries(COMPLAINT_TYPE_LABELS).map(([k, v]) => (
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
