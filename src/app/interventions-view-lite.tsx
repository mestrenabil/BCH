'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { type CommuneType } from '@/lib/store'
import {
  type Intervention, type InterventionDocument,
  TYPE_LABELS, TYPE_COLORS, TYPE_ICONS, STATUT_LABELS, STATUT_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'

// ===== DOCUMENT PICKER DIALOG =====
function DocumentPickerDialog({ interventionId, commune, existingDocIds, onSelect, onClose }: {
  interventionId: string; commune: string; existingDocIds: string[]
  onSelect: (docIds: string[]) => void; onClose: () => void
}) {
  const [documents, setDocuments] = useState<{ id: string; titre: string; nomFichier: string; typeFichier: string; tailleFichier: number; categorie: string; commune: string }[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const params = new URLSearchParams()
        if (commune) params.set('commune', commune)
        const res = await fetch(`/api/documents?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setDocuments(data.documents || [])
        }
      } catch { /* ignore */ }
      setIsLoading(false)
    }
    fetchDocs()
  }, [])

  const filteredDocs = documents.filter(d =>
    !existingDocIds.includes(d.id) &&
    (d.titre.includes(search) || d.nomFichier.includes(search) || d.categorie.includes(search))
  )

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 بايت'
    const k = 1024
    const sizes = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <span>📎</span> إرفاق مستند
            </h3>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input type="text" placeholder="البحث في المستندات..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
          </div>
          {selected.length > 0 && (
            <p className="text-[11px] text-emerald-600 font-medium mt-2">تم اختيار {selected.length} مستند</p>
          )}
        </div>

        <div className="overflow-y-auto max-h-[50vh] p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-2">📂</p>
              <p className="text-sm text-slate-400">لا توجد مستندات متاحة للإرفاق</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredDocs.map((doc) => (
                <button key={doc.id}
                  onClick={() => toggleSelect(doc.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                    selected.includes(doc.id)
                      ? 'bg-emerald-50 border-2 border-emerald-300'
                      : 'bg-slate-50 border-2 border-transparent hover:bg-slate-100'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0"
                    style={{ backgroundColor: doc.typeFichier === 'pdf' ? '#fef2f2' : doc.typeFichier === 'image' ? '#faf5ff' : '#f0fdf4' }}>
                    {doc.typeFichier === 'pdf' ? '📕' : doc.typeFichier === 'image' ? '🖼️' : '📄'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-700 truncate">{doc.titre}</p>
                    <p className="text-[10px] text-slate-400">{doc.typeFichier} — {formatFileSize(doc.tailleFichier)}</p>
                  </div>
                  {selected.includes(doc.id) && (
                    <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(selected)}
            disabled={selected.length === 0}
            className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            إرفاق {selected.length > 0 ? `(${selected.length})` : ''}
          </motion.button>
          <button onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors text-sm">
            إلغاء
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ===== INTERVENTIONS VIEW =====
function InterventionsView({ interventions, total, page, setPage, onEdit, onRefresh, selectedCommune, onAdd }: {
  interventions: Intervention[]; total: number; page: number; setPage: (p: number) => void
  onEdit: (id: string) => void; onRefresh: () => void; selectedCommune: CommuneType | 'ALL'
  onAdd?: () => void
}) {
  const [localSearch, setLocalSearch] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [filterStatut, setFilterStatut] = useState('ALL')
  const [localCommuneFilter, setLocalCommuneFilter] = useState('ALL')
  const [quartierFilter, setQuartierFilter] = useState('ALL')
  const [quartiers, setQuartiers] = useState<{ id: string; nom: string; commune: string }[]>([])
  const [detailIntervention, setDetailIntervention] = useState<Intervention | null>(null)
  const [showDocPicker, setShowDocPicker] = useState(false)
  const [linkedDocs, setLinkedDocs] = useState<InterventionDocument[]>([])
  const [photos, setPhotos] = useState<{ id: string; url: string; caption: string | null; type: string; createdAt: string }[]>([])
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [photoForm, setPhotoForm] = useState({ caption: '', type: 'AFTER' })
  const [photoUploading, setPhotoUploading] = useState(false)
  const [viewerPhoto, setViewerPhoto] = useState<string | null>(null)

  // Bulk action state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkStatut, setBulkStatut] = useState('')
  const [bulkOperating, setBulkOperating] = useState(false)

  const fetchLinkedDocs = useCallback(async (interventionId: string) => {
    try {
      const res = await fetch(`/api/interventions/${interventionId}/documents`)
      if (res.ok) {
        const data = await res.json()
        setLinkedDocs(data.documents || [])
      }
    } catch { /* ignore */ }
  }, [])

  const fetchPhotos = useCallback(async (interventionId: string) => {
    try {
      const res = await fetch(`/api/intervention-photos?interventionId=${interventionId}`)
      if (res.ok) {
        const data = await res.json()
        setPhotos(data.photos || [])
      }
    } catch { /* ignore */ }
  }, [])

  const handleShowDetail = useCallback((intervention: Intervention) => {
    setDetailIntervention(intervention)
    setLinkedDocs(intervention.documents || [])
    fetchLinkedDocs(intervention.id)
    fetchPhotos(intervention.id)
  }, [fetchLinkedDocs, fetchPhotos])

  const handleUnlinkDoc = useCallback(async (documentId: string) => {
    if (!detailIntervention) return
    try {
      const res = await fetch(`/api/interventions/${detailIntervention.id}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      })
      if (res.ok) {
        toast.success('تم فك الارتباط بنجاح')
        fetchLinkedDocs(detailIntervention.id)
      } else {
        toast.error('فشل في فك الارتباط')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }, [detailIntervention, fetchLinkedDocs])

  const handleLinkDocs = useCallback(async (documentIds: string[]) => {
    if (!detailIntervention) return
    try {
      for (const docId of documentIds) {
        await fetch(`/api/interventions/${detailIntervention.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: docId }),
        })
      }
      toast.success(`تم ربط ${documentIds.length} مستند بنجاح`)
      fetchLinkedDocs(detailIntervention.id)
      setShowDocPicker(false)
      onRefresh()
    } catch {
      toast.error('حدث خطأ أثناء ربط المستندات')
    }
  }, [detailIntervention, fetchLinkedDocs, onRefresh])

  const [photoFile, setPhotoFile] = useState<File | null>(null)

  const handleUploadPhoto = useCallback(async () => {
    if (!detailIntervention || !photoFile) return
    setPhotoUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = reader.result as string
        const res = await fetch('/api/intervention-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ interventionId: detailIntervention.id, url: base64, caption: photoForm.caption, type: photoForm.type }),
        })
        if (res.ok) {
          toast.success('تم رفع الصورة بنجاح')
          fetchPhotos(detailIntervention.id)
          setShowPhotoUpload(false)
          setPhotoForm({ caption: '', type: 'AFTER' })
          setPhotoFile(null)
        } else {
          toast.error('فشل في رفع الصورة')
        }
        setPhotoUploading(false)
      }
      reader.readAsDataURL(photoFile)
    } catch {
      toast.error('حدث خطأ أثناء رفع الصورة')
      setPhotoUploading(false)
    }
  }, [detailIntervention, photoForm, photoFile, fetchPhotos])

  const handleDeletePhoto = useCallback(async (photoId: string) => {
    try {
      const res = await fetch('/api/intervention-photos', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: photoId }),
      })
      if (res.ok) {
        toast.success('تم حذف الصورة بنجاح')
        if (detailIntervention) fetchPhotos(detailIntervention.id)
      } else {
        toast.error('فشل في حذف الصورة')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }, [detailIntervention, fetchPhotos])

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/interventions/${id}`, { method: 'DELETE' })
      setDeleteConfirm(null)
      onRefresh()
      toast.success('تم حذف التدخل بنجاح')
    } catch (err) { console.error('Delete failed:', err); toast.error('حدث خطأ أثناء الحذف') }
  }

  // Bulk actions
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInterventions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredInterventions.map(i => i.id)))
    }
  }

  const handleBulkStatusChange = async () => {
    if (!bulkStatut || selectedIds.size === 0) return
    setBulkOperating(true)
    let success = 0
    let fail = 0
    for (const id of selectedIds) {
      try {
        const intervention = filteredInterventions.find(i => i.id === id)
        const res = await fetch(`/api/interventions/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ statut: bulkStatut, commune: intervention?.commune }),
        })
        if (res.ok) success++
        else fail++
      } catch { fail++ }
    }
    setBulkOperating(false)
    setSelectedIds(new Set())
    setBulkStatut('')
    onRefresh()
    toast.success(`تم تحديث حالة ${success} تدخل${fail > 0 ? `، فشل ${fail}` : ''}`)
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    setBulkOperating(true)
    let success = 0
    let fail = 0
    for (const id of selectedIds) {
      try {
        const res = await fetch(`/api/interventions/${id}`, { method: 'DELETE' })
        if (res.ok) success++
        else fail++
      } catch { fail++ }
    }
    setBulkOperating(false)
    setSelectedIds(new Set())
    onRefresh()
    toast.success(`تم حذف ${success} تدخل${fail > 0 ? `، فشل ${fail}` : ''}`)
  }

  // Fetch quartiers when commune filter changes
  useEffect(() => {
    const fetchQuartiers = async () => {
      try {
        const params = new URLSearchParams()
        if (localCommuneFilter !== 'ALL') params.set('commune', localCommuneFilter)
        const res = await fetch(`/api/quartiers?${params.toString()}`)
        if (res.ok) {
          const data = await res.json()
          setQuartiers(data.quartiers || [])
        }
      } catch { /* ignore */ }
    }
    fetchQuartiers()
  }, [localCommuneFilter])

  const filteredInterventions = interventions.filter(i => 
    (filterStatut === 'ALL' || i.statut === filterStatut) && 
    (localCommuneFilter === 'ALL' || i.commune === localCommuneFilter) &&
    (quartierFilter === 'ALL' || i.quartier === quartierFilter)
  )

  // Print handler for single intervention
  const handlePrintIntervention = useCallback((intervention: Intervention) => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة')
      return
    }

    const materialsList = intervention.materials && intervention.materials.length > 0
      ? intervention.materials.map((m: { product: { nom: string; unite: string }; quantity: number }) => `${m.product.nom} (${m.quantity} ${m.product.unite})`).join(' | ')
      : intervention.produitUtilise || '—'

    const heureStr = intervention.heureDebut && intervention.heureFin
      ? `${intervention.heureDebut} - ${intervention.heureFin}`
      : intervention.heureDebut || '—'

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير تدخل ${intervention.reference}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;600;700;800&display=swap');
    @page { size: A4; margin: 15mm; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif; direction: rtl; color: #1e293b; line-height: 1.6; font-size: 12px; }
    .header { text-align: center; padding-bottom: 14px; border-bottom: 3px solid #1f2937; margin-bottom: 16px; position: relative; }
    .header::after { content: ''; position: absolute; bottom: -5px; left: 0; right: 0; height: 1.5px; background: #1f2937; }
    .header h1 { font-size: 16px; font-weight: 900; color: #1f2937; }
    .header p { font-size: 10px; color: #6b7280; font-style: italic; }
    .header .commune { font-size: 12px; font-weight: 700; color: #374151; margin-top: 4px; }
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
    <p>Bureau Communal de l'Hygiène</p>
    <div class="commune">${intervention.commune ? COMMUNE_LABELS[intervention.commune as keyof typeof COMMUNE_LABELS] || intervention.commune : ''}</div>
  </div>
  <div class="ref-bar">
    <div><div class="label">المرجع / Référence</div><div class="value" style="font-family:monospace;">${intervention.reference}</div></div>
    <div style="text-align:left;"><div class="label">التاريخ / Date</div><div class="value">${new Date(intervention.date).toLocaleDateString('ar-MA')}</div></div>
  </div>
  <div class="title-section">
    <h2>تقرير التدخل</h2>
    <div class="badges">
      <span class="badge" style="background:${TYPE_COLORS[intervention.type] || '#374151'}">${TYPE_LABELS[intervention.type] || intervention.type}</span>
      <span class="badge" style="background:${STATUT_COLORS[intervention.statut] || '#6b7280'}">${STATUT_LABELS[intervention.statut] || intervention.statut}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-card"><div class="label">📅 التاريخ</div><div class="value">${new Date(intervention.date).toLocaleDateString('ar-MA')}</div></div>
    <div class="info-card"><div class="label">⏰ الوقت</div><div class="value">${heureStr}</div></div>
    <div class="info-card"><div class="label">🏘️ الجماعة</div><div class="value">${intervention.commune ? COMMUNE_LABELS[intervention.commune as keyof typeof COMMUNE_LABELS] || intervention.commune : '—'}</div></div>
    <div class="info-card"><div class="label">📍 الحي</div><div class="value">${intervention.quartier || '—'}</div></div>
    <div class="info-card full-width"><div class="label">📍 العنوان</div><div class="value">${intervention.adresse || '—'}</div></div>
    <div class="info-card"><div class="label">👤 العون</div><div class="value">${intervention.agentNom || '—'}</div></div>
    <div class="info-card"><div class="label">📐 المساحة</div><div class="value">${intervention.superficie || '—'}</div></div>
    <div class="info-card full-width"><div class="label">💊 المواد المستعملة</div><div class="value">${materialsList}</div></div>
    ${intervention.observations ? `<div class="info-card full-width"><div class="label">💬 الملاحظات</div><div class="value">${intervention.observations}</div></div>` : ''}
  </div>
  <div class="signature-section">
    <div class="signature-grid">
      <div class="signature-box"><div class="role">العون المنفذ</div><div class="line"></div></div>
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 بايت'
    const k = 1024
    const sizes = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

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
        <div className="flex gap-2 w-full sm:w-auto items-center flex-wrap">
          {onAdd && (
            <motion.button
              whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
              onClick={onAdd}
              className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2 text-sm whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
              إضافة تدخل
            </motion.button>
          )}
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
          <select value={localCommuneFilter} onChange={(e) => { setLocalCommuneFilter(e.target.value); setQuartierFilter('ALL') }}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
          </select>
          <select value={quartierFilter} onChange={(e) => setQuartierFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 max-w-[160px]">
            <option value="ALL">كل الأحياء</option>
            {quartiers.map(q => (
              <option key={q.id} value={q.nom}>{q.nom}</option>
            ))}
          </select>
        </div>
      </motion.div>

      {/* Summary cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 items-center">
        {/* Select All checkbox */}
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-slate-100 text-sm font-medium whitespace-nowrap cursor-pointer hover:bg-emerald-50 transition-colors">
          <input
            type="checkbox"
            checked={selectedIds.size > 0 && selectedIds.size === filteredInterventions.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600"
          />
          تحديد الكل
        </label>
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
                className={`bg-white rounded-2xl border p-4 hover:shadow-lg transition-all group cursor-pointer relative ${selectedIds.has(intervention.id) ? 'border-emerald-300 bg-emerald-50/30 shadow-md ring-1 ring-emerald-200' : 'border-slate-100 hover:border-emerald-100'}`}
                onClick={() => handleShowDetail(intervention)}>
                {/* Selection checkbox */}
                <div className="absolute top-3 left-3 z-10" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(intervention.id)}
                    onChange={() => toggleSelect(intervention.id)}
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 accent-emerald-600 cursor-pointer"
                  />
                </div>
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
                        {intervention.documents && intervention.documents.length > 0 && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-50 text-teal-600">
                            📎 {intervention.documents.length}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1">{intervention.quartier} — {intervention.adresse}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">📅 {new Date(intervention.date).toLocaleDateString('ar-MA')}{intervention.heureDebut && intervention.heureFin ? ` ⏰ ${intervention.heureDebut} - ${intervention.heureFin}` : intervention.heureDebut ? ` ⏰ ${intervention.heureDebut}` : ''}</span>
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
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                      onClick={() => handlePrintIntervention(intervention)}
                      className="px-3 py-2 text-xs rounded-xl bg-slate-50 hover:bg-teal-50 hover:text-teal-600 font-medium transition-colors"
                      title="طباعة">
                      🖨️
                    </motion.button>
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

      {/* ===== FLOATING BULK ACTION BAR ===== */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl px-5 py-3.5 flex items-center gap-4"
            dir="rtl"
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-sm font-extrabold text-emerald-700">{selectedIds.size}</span>
              </div>
              <span className="text-sm font-bold text-slate-700">عنصر محدد</span>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex items-center gap-2">
              <select
                value={bulkStatut}
                onChange={(e) => setBulkStatut(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">تغيير الحالة</option>
                {Object.entries(STATUT_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleBulkStatusChange}
                disabled={!bulkStatut || bulkOperating}
                className="px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white text-sm font-bold shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {bulkOperating ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                  </svg>
                )}
                تطبيق
              </motion.button>
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleBulkDelete}
              disabled={bulkOperating}
              className="px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {bulkOperating ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              )}
              حذف المحدد
            </motion.button>
            <button
              onClick={() => { setSelectedIds(new Set()); setBulkStatut('') }}
              className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
              title="إلغاء التحديد"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {total > 50 && (
        <div className="flex items-center justify-center gap-4 pt-4">
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50 hover:bg-emerald-50 transition-colors">السابق</button>
          <span className="text-sm text-slate-500">صفحة {page} من {Math.ceil(total / 50)}</span>
          <button onClick={() => setPage(page + 1)} disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 rounded-xl border border-slate-200 text-sm disabled:opacity-50 hover:bg-emerald-50 transition-colors">التالي</button>
        </div>
      )}

      {/* ===== INTERVENTION DETAIL PANEL ===== */}
      <AnimatePresence>
        {detailIntervention && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => setDetailIntervention(null)}
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
              <div className="bg-gradient-to-l from-emerald-700 to-teal-700 p-5 text-white relative">
                <button onClick={() => setDetailIntervention(null)}
                  className="absolute top-3 left-3 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-2xl">
                    {TYPE_ICONS[detailIntervention.type]}
                  </div>
                  <div>
                    <h3 className="text-lg font-extrabold font-mono">{detailIntervention.reference}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                        {TYPE_LABELS[detailIntervention.type]}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 font-bold">
                        {STATUT_LABELS[detailIntervention.statut]}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-emerald-100 text-sm">{detailIntervention.quartier} — {detailIntervention.adresse}</p>
              </div>

              {/* Details */}
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">التاريخ</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">📅 {new Date(detailIntervention.date).toLocaleDateString('ar-MA')}{detailIntervention.heureDebut && detailIntervention.heureFin ? ` ⏰ ${detailIntervention.heureDebut} - ${detailIntervention.heureFin}` : detailIntervention.heureDebut ? ` ⏰ ${detailIntervention.heureDebut}` : ''}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">العون</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">👤 {detailIntervention.agentNom}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الجماعة</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                      {detailIntervention.commune ? (
                        <span className="px-2 py-0.5 rounded-md text-white text-[11px]" style={{ backgroundColor: COMMUNE_COLORS[detailIntervention.commune as keyof typeof COMMUNE_COLORS] || '#64748b' }}>
                          {detailIntervention.commune}
                        </span>
                      ) : '—'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">المساحة</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">📐 {detailIntervention.superficie || '—'}</p>
                  </div>
                </div>

                {detailIntervention.description && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الوصف</p>
                    <p className="text-xs text-slate-700 mt-0.5">{detailIntervention.description}</p>
                  </div>
                )}

                {/* Cost Section */}
                {(detailIntervention.coutMainOeuvre || detailIntervention.coutMateriaux || detailIntervention.coutTotal) && (
                  <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                    <p className="text-[10px] text-emerald-600 font-bold mb-2">💰 التكلفة</p>
                    <div className="grid grid-cols-3 gap-2">
                      {detailIntervention.coutMainOeuvre != null && (
                        <div className="text-center">
                          <p className="text-[9px] text-slate-500">اليد العاملة</p>
                          <p className="text-xs font-bold text-slate-700">{Number(detailIntervention.coutMainOeuvre).toLocaleString('ar-MA')} د.م</p>
                        </div>
                      )}
                      {detailIntervention.coutMateriaux != null && (
                        <div className="text-center">
                          <p className="text-[9px] text-slate-500">المواد</p>
                          <p className="text-xs font-bold text-slate-700">{Number(detailIntervention.coutMateriaux).toLocaleString('ar-MA')} د.م</p>
                        </div>
                      )}
                      {detailIntervention.coutTotal != null && (
                        <div className="text-center">
                          <p className="text-[9px] text-slate-500">الإجمالية</p>
                          <p className="text-xs font-extrabold text-emerald-700">{Number(detailIntervention.coutTotal).toLocaleString('ar-MA')} د.م</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {detailIntervention.materials && detailIntervention.materials.length > 0 && (
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium mb-2">المواد المستعملة</p>
                    <div className="space-y-1">
                      {detailIntervention.materials.map(m => (
                        <div key={m.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium">📦 {m.product.nom}</span>
                          <span className="text-slate-500">{m.quantity} {m.product.unite}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== PHOTOS SECTION ===== */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <span>📸</span> الصور
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{photos.length}</span>
                    </h4>
                    <div className="flex gap-2">
                      <motion.button
                        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => setShowPhotoUpload(true)}
                        className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors flex items-center gap-1"
                      >
                        <span>+</span> إضافة صورة
                      </motion.button>
                    </div>
                  </div>

                  {photos.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <p className="text-3xl mb-2">📷</p>
                      <p className="text-xs text-slate-400">لا توجد صور لهذا التدخل</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                      {photos.map((photo) => (
                        <div key={photo.id} className="relative group/photo rounded-xl overflow-hidden border border-slate-100 cursor-pointer" onClick={() => setViewerPhoto(photo.url)}>
                          <img src={photo.url} alt={photo.caption || 'صورة'} className="w-full h-28 object-cover" />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover/photo:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 right-0 left-0 p-2 opacity-0 group-hover/photo:opacity-100 transition-opacity">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: photo.type === 'BEFORE' ? '#f59e0b' : '#10b981' }}>
                                {photo.type === 'BEFORE' ? 'قبل' : 'بعد'}
                              </span>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleDeletePhoto(photo.id) }}
                                className="p-1 hover:bg-red-500/80 rounded bg-black/40 text-white transition-colors"
                                title="حذف الصورة"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                              </button>
                            </div>
                            {photo.caption && <p className="text-[9px] text-white truncate mt-0.5">{photo.caption}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ===== LINKED DOCUMENTS SECTION ===== */}
                <div className="border-t border-slate-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <span>📎</span> المستندات المرفقة
                      <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{linkedDocs.length}</span>
                    </h4>
                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => setShowDocPicker(true)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center gap-1"
                    >
                      <span>+</span> إرفاق مستند
                    </motion.button>
                  </div>

                  {linkedDocs.length === 0 ? (
                    <div className="bg-slate-50 rounded-xl p-6 text-center">
                      <p className="text-3xl mb-2">📂</p>
                      <p className="text-xs text-slate-400">لا توجد مستندات مرفقة بهذا التدخل</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {linkedDocs.map((docLink) => (
                        <div key={docLink.id} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 group/doc hover:bg-slate-100 transition-colors">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg shrink-0"
                            style={{ backgroundColor: docLink.document.typeFichier === 'pdf' ? '#fef2f2' : docLink.document.typeFichier === 'image' ? '#faf5ff' : '#f0fdf4' }}>
                            {docLink.document.typeFichier === 'pdf' ? '📕' : docLink.document.typeFichier === 'image' ? '🖼️' : '📄'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{docLink.document.titre}</p>
                            <p className="text-[10px] text-slate-400">{docLink.document.typeFichier} — {formatFileSize(docLink.document.tailleFichier)}</p>
                          </div>
                          <a href={`/api/documents/download/${docLink.document.id}`} download
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors" title="تحميل">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </a>
                          <button
                            onClick={() => handleUnlinkDoc(docLink.documentId)}
                            className="p-1.5 hover:bg-red-100 rounded-lg transition-colors opacity-0 group-hover/doc:opacity-100" title="فك الارتباط"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button onClick={() => { setDetailIntervention(null); onEdit(detailIntervention.id) }}
                    className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm">
                    ✏️ تعديل التدخل
                  </button>
                  <button onClick={() => setDetailIntervention(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors text-sm">
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== DOCUMENT PICKER DIALOG ===== */}
      {showDocPicker && detailIntervention && (
        <DocumentPickerDialog
          interventionId={detailIntervention.id}
          commune={detailIntervention.commune}
          existingDocIds={linkedDocs.map(d => d.documentId)}
          onSelect={handleLinkDocs}
          onClose={() => setShowDocPicker(false)}
        />
      )}

      {/* ===== PHOTO UPLOAD DIALOG ===== */}
      <AnimatePresence>
        {showPhotoUpload && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => { setShowPhotoUpload(false); setPhotoForm({ caption: '', type: 'AFTER' }); setPhotoFile(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="bg-gradient-to-l from-teal-700 to-emerald-700 p-4 text-white">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <span>📸</span> إضافة صورة
                </h3>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">الصورة</label>
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition-colors">
                    {photoFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <img src={URL.createObjectURL(photoFile)} alt="preview" className="w-20 h-20 object-cover rounded-lg" />
                        <span className="text-xs text-slate-500">{photoFile.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs">اختر صورة</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhotoFile(f) }} />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">الوصف</label>
                  <input type="text" value={photoForm.caption} onChange={(e) => setPhotoForm({ ...photoForm, caption: e.target.value })}
                    placeholder="وصف الصورة..." className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-300 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1.5">النوع</label>
                  <select value={photoForm.type} onChange={(e) => setPhotoForm({ ...photoForm, type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-teal-500/20">
                    <option value="BEFORE">قبل المعالجة</option>
                    <option value="AFTER">بعد المعالجة</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={handleUploadPhoto}
                    disabled={!photoFile || photoUploading}
                    className="flex-1 bg-gradient-to-l from-teal-600 to-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-teal-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                  >
                    {photoUploading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري الرفع...</span>
                      </>
                    ) : (
                      <>
                        <span>📸</span> رفع الصورة
                      </>
                    )}
                  </motion.button>
                  <button onClick={() => { setShowPhotoUpload(false); setPhotoForm({ caption: '', type: 'AFTER' }); setPhotoFile(null) }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors text-sm">
                    إلغاء
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== FULLSCREEN PHOTO VIEWER ===== */}
      <AnimatePresence>
        {viewerPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setViewerPhoto(null)}
          >
            <motion.img
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={viewerPhoto}
              alt="صورة مكبرة"
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              onClick={() => setViewerPhoto(null)}
              className="absolute top-4 left-4 p-3 bg-white/20 hover:bg-white/30 rounded-xl text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default InterventionsView
