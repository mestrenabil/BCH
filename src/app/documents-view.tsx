'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type CommuneType } from '@/lib/store'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

// Dynamic import of PDF viewer (no SSR due to pdfjs DOMMatrix issue)
const PdfViewer = dynamic(() => import('./pdf-viewer'), { ssr: false })

// ===== TYPE DEFINITIONS =====
interface DocumentRecord {
  id: string
  titre: string
  description: string
  categorie: string
  commune: string
  nomFichier: string
  cheminFichier: string
  typeFichier: string
  tailleFichier: number
  reference: string
  dateDocument: string | null
  uploadedBy: string
  createdAt: string
  updatedAt: string
}

interface CategoryCount {
  categorie: string
  count: number
}

// ===== CONSTANTS =====
const CATEGORIES = [
  { id: 'ALL', label: 'الكل', icon: '📁', color: '#64748b' },
  { id: 'عام', label: 'عام', icon: '📄', color: '#3b82f6' },
  { id: 'تقارير', label: 'تقارير', icon: '📊', color: '#10b981' },
  { id: 'محاضر', label: 'محاضر', icon: '📝', color: '#8b5cf6' },
  { id: 'مراسلات', label: 'مراسلات', icon: '✉️', color: '#f59e0b' },
  { id: 'قرارات', label: 'قرارات', icon: '⚖️', color: '#ef4444' },
  { id: 'عقود', label: 'عقود', icon: '📜', color: '#06b6d4' },
  { id: 'صحي', label: 'صحي', icon: '🏥', color: '#ec4899' },
  { id: 'أخرى', label: 'أخرى', icon: '📎', color: '#84cc16' },
]

const SORT_OPTIONS = [
  { id: 'newest', label: 'الأحدث أولاً', icon: '🕐' },
  { id: 'oldest', label: 'الأقدم أولاً', icon: '📅' },
  { id: 'name', label: 'الاسم', icon: '🔤' },
  { id: 'size', label: 'الحجم', icon: '📦' },
]

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

function getFileIcon(typeFichier: string): string {
  switch (typeFichier) {
    case 'pdf': return '📕'
    case 'document': return '📘'
    case 'spreadsheet': return '📗'
    case 'presentation': return '📙'
    case 'image': return '🖼️'
    default: return '📄'
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 بايت'
  const k = 1024
  const sizes = ['بايت', 'كيلوبايت', 'ميغابايت', 'غيغابايت']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' })
}

function getCategoryIcon(categorie: string): string {
  return CATEGORIES.find(c => c.id === categorie)?.icon || '📄'
}

function getCategoryColor(categorie: string): string {
  return CATEGORIES.find(c => c.id === categorie)?.color || '#64748b'
}

// ===== IMAGE VIEWER COMPONENT =====
function ImageViewer({ document: doc, onClose }: { document: DocumentRecord; onClose: () => void }) {
  const imageUrl = `/api/documents/download/${doc.id}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex flex-col"
      dir="rtl"
    >
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <span className="text-lg">🖼️</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{doc.titre}</h3>
            <p className="text-[11px] text-slate-400">{doc.nomFichier} — {formatFileSize(doc.tailleFichier)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href={imageUrl} download className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-medium transition-colors text-white">
            ⬇️ تحميل
          </a>
          <button onClick={onClose} className="p-2 hover:bg-slate-700 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4" dir="ltr">
        <img src={imageUrl} alt={doc.titre} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" />
      </div>
    </motion.div>
  )
}

// ===== MAIN COMPONENT =====
export default function DocumentsView() {
  const { user, selectedCommune } = useAppStore()
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'
  const effectiveCommune = canSeeAllCommunes ? selectedCommune : user?.commune || ''

  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [categories, setCategories] = useState<CategoryCount[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('newest')

  // Upload dialog
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    titre: '',
    description: '',
    categorie: 'عام',
    commune: '',
    reference: '',
    dateDocument: '',
  })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Viewers
  const [viewingDocument, setViewingDocument] = useState<DocumentRecord | null>(null)
  const [viewerType, setViewerType] = useState<'pdf' | 'image' | null>(null)

  // Edit dialog
  const [editingDocument, setEditingDocument] = useState<DocumentRecord | null>(null)
  const [editForm, setEditForm] = useState({
    titre: '',
    description: '',
    categorie: 'عام',
    reference: '',
    dateDocument: '',
  })

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Detail panel
  const [detailDoc, setDetailDoc] = useState<DocumentRecord | null>(null)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (effectiveCommune && effectiveCommune !== 'ALL') params.set('commune', effectiveCommune)
      if (selectedCategory !== 'ALL') params.set('categorie', selectedCategory)
      if (searchQuery) params.set('search', searchQuery)
      const res = await fetch(`/api/documents?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDocuments(data.documents || [])
      setTotal(data.total || 0)
      setCategories(data.categories || [])
    } catch {
      toast.error('فشل في تحميل المستندات')
    }
    setIsLoading(false)
  }, [effectiveCommune, selectedCategory, searchQuery])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  // Sort documents
  const sortedDocuments = useMemo(() => {
    const sorted = [...documents]
    switch (sortBy) {
      case 'newest': return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      case 'oldest': return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      case 'name': return sorted.sort((a, b) => a.titre.localeCompare(b.titre, 'ar'))
      case 'size': return sorted.sort((a, b) => b.tailleFichier - a.tailleFichier)
      default: return sorted
    }
  }, [documents, sortBy])

  // Statistics
  const stats = useMemo(() => {
    const pdfCount = documents.filter(d => d.typeFichier === 'pdf').length
    const imageCount = documents.filter(d => d.typeFichier === 'image').length
    const totalSize = documents.reduce((acc, d) => acc + d.tailleFichier, 0)
    const recentCount = documents.filter(d => {
      const diff = Date.now() - new Date(d.createdAt).getTime()
      return diff < 7 * 24 * 60 * 60 * 1000 // Last 7 days
    }).length
    return { pdfCount, imageCount, totalSize, recentCount }
  }, [documents])

  // Upload handlers
  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'text/plain', 'text/csv',
    ]
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|jpg|jpeg|png|gif|webp|txt|csv)$/i)) {
      toast.error('نوع الملف غير مدعوم')
      return
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('حجم الملف يتجاوز 50 ميغابايت')
      return
    }
    setUploadFile(file)
    if (!uploadForm.titre) {
      setUploadForm(prev => ({ ...prev, titre: file.name.replace(/\.[^.]+$/, '') }))
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelect(file)
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!uploadFile) { toast.error('يرجى اختيار ملف'); return }
    if (!uploadForm.titre.trim()) { toast.error('يرجى إدخال عنوان المستند'); return }

    setIsUploading(true)
    setUploadProgress(10)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)
      setUploadProgress(30)

      const uploadRes = await fetch('/api/documents/upload', { method: 'POST', body: formData })
      setUploadProgress(60)
      if (!uploadRes.ok) {
        const errData = await uploadRes.json()
        throw new Error(errData.error || 'فشل في رفع الملف')
      }
      const fileData = await uploadRes.json()
      setUploadProgress(80)

      const docRes = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titre: uploadForm.titre,
          description: uploadForm.description,
          categorie: uploadForm.categorie,
          commune: uploadForm.commune || (effectiveCommune !== 'ALL' ? effectiveCommune : ''),
          reference: uploadForm.reference,
          dateDocument: uploadForm.dateDocument || null,
          uploadedBy: user?.nom || '',
          nomFichier: fileData.nomFichier,
          cheminFichier: fileData.cheminFichier,
          typeFichier: fileData.typeFichier,
          tailleFichier: fileData.tailleFichier,
        }),
      })
      if (!docRes.ok) throw new Error('فشل في إنشاء سجل المستند')
      setUploadProgress(100)

      toast.success('تم رفع المستند بنجاح')
      setShowUploadDialog(false)
      setUploadForm({ titre: '', description: '', categorie: 'عام', commune: '', reference: '', dateDocument: '' })
      setUploadFile(null)
      setUploadProgress(0)
      fetchDocuments()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل في رفع المستند')
    }
    setIsUploading(false)
  }

  // Edit handlers
  const handleEdit = (doc: DocumentRecord) => {
    setEditingDocument(doc)
    setEditForm({
      titre: doc.titre,
      description: doc.description,
      categorie: doc.categorie,
      reference: doc.reference,
      dateDocument: doc.dateDocument ? new Date(doc.dateDocument).toISOString().split('T')[0] : '',
    })
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingDocument) return
    try {
      const res = await fetch(`/api/documents/${editingDocument.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      if (!res.ok) throw new Error()
      toast.success('تم تحديث المستند بنجاح')
      setEditingDocument(null)
      fetchDocuments()
    } catch {
      toast.error('فشل في تحديث المستند')
    }
  }

  // Delete handler
  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('تم حذف المستند بنجاح')
      setDeletingId(null)
      fetchDocuments()
    } catch {
      toast.error('فشل في حذف المستند')
    }
  }

  // View document
  const handleViewDocument = (doc: DocumentRecord) => {
    if (doc.typeFichier === 'pdf') {
      setViewingDocument(doc)
      setViewerType('pdf')
    } else if (doc.typeFichier === 'image') {
      setViewingDocument(doc)
      setViewerType('image')
    } else {
      window.open(`/api/documents/download/${doc.id}`, '_blank')
    }
  }

  const handleCloseViewer = () => {
    setViewingDocument(null)
    setViewerType(null)
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>📁</span> إدارة المستندات
          </h2>
          <p className="text-sm text-slate-500 mt-1">تنظيم وعرض المستندات والملفات — {total} مستند</p>
        </div>
        <motion.button
          onClick={() => setShowUploadDialog(true)}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          رفع مستند جديد
        </motion.button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">إجمالي المستندات</p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{total}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">📁</div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">ملفات PDF</p>
              <p className="text-2xl font-extrabold text-red-600 mt-1">{stats.pdfCount}</p>
            </div>
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-xl">📕</div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">صور</p>
              <p className="text-2xl font-extrabold text-purple-600 mt-1">{stats.imageCount}</p>
            </div>
            <div className="w-11 h-11 bg-purple-50 rounded-xl flex items-center justify-center text-xl">🖼️</div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">الحجم الإجمالي</p>
              <p className="text-2xl font-extrabold text-teal-600 mt-1">{formatFileSize(stats.totalSize)}</p>
            </div>
            <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center text-xl">💾</div>
          </div>
        </motion.div>
      </div>

      {/* Category Breakdown Bar */}
      {categories.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">التوزيع حسب الفئة</h3>
          <div className="flex items-center gap-1 h-8 rounded-xl overflow-hidden">
            {categories.map((cat) => {
              const pct = total > 0 ? (cat.count / total) * 100 : 0
              const color = getCategoryColor(cat.categorie)
              return (
                <div key={cat.categorie}
                  className="h-full transition-all duration-500 relative group cursor-pointer"
                  style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? '8px' : '0' }}
                  title={`${cat.categorie}: ${cat.count} (${Math.round(pct)}%)`}
                >
                  {pct > 10 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white truncate px-1">
                      {getCategoryIcon(cat.categorie)} {cat.categorie}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {categories.map((cat) => (
              <div key={cat.categorie} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getCategoryColor(cat.categorie) }} />
                <span className="text-[11px] text-slate-500">{cat.categorie}</span>
                <span className="text-[11px] font-bold text-slate-700">({cat.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث في المستندات..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
            />
          </div>
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.icon} {opt.label}</option>
            ))}
          </select>
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ⊞ شبكة
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}
            >
              ☰ قائمة
            </button>
          </div>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-2 mt-3 overflow-x-auto pb-1">
          {CATEGORIES.map((cat) => {
            const count = cat.id === 'ALL' ? total : categories.find(c => c.categorie === cat.id)?.count || 0
            if (cat.id !== 'ALL' && count === 0 && selectedCategory !== cat.id) return null
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'text-white shadow-md'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
                style={selectedCategory === cat.id ? { backgroundColor: cat.color } : {}}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  selectedCategory === cat.id ? 'bg-white/20' : 'bg-slate-200/70'
                }`}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Documents Grid/List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل المستندات...</p>
          </div>
        </div>
      ) : sortedDocuments.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center"
        >
          <div className="text-6xl mb-4">📂</div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد مستندات</h3>
          <p className="text-sm text-slate-500 mb-4">لم يتم رفع أي مستندات بعد. ابدأ برفع أول مستند.</p>
          <button
            onClick={() => setShowUploadDialog(true)}
            className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200"
          >
            رفع مستند جديد
          </button>
        </motion.div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedDocuments.map((doc, i) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:border-emerald-200 transition-all group cursor-pointer"
              onClick={() => setDetailDoc(doc)}
            >
              {/* File Preview Area */}
              <div className="h-32 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative overflow-hidden">
                {doc.typeFichier === 'pdf' ? (
                  <div className="text-center">
                    <div className="text-5xl mb-1">📕</div>
                    <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md">PDF</span>
                  </div>
                ) : doc.typeFichier === 'image' ? (
                  <div className="text-center">
                    <div className="text-5xl mb-1">🖼️</div>
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md">صورة</span>
                  </div>
                ) : doc.typeFichier === 'spreadsheet' ? (
                  <div className="text-center">
                    <div className="text-5xl mb-1">📗</div>
                    <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md">جدول</span>
                  </div>
                ) : doc.typeFichier === 'document' ? (
                  <div className="text-center">
                    <div className="text-5xl mb-1">📘</div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">مستند</span>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="text-5xl mb-1">📄</div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">ملف</span>
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-emerald-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  {(doc.typeFichier === 'pdf' || doc.typeFichier === 'image') && (
                    <button onClick={(e) => { e.stopPropagation(); handleViewDocument(doc) }}
                      className="bg-white text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-50 transition-colors">
                      👁️ عرض
                    </button>
                  )}
                  <a
                    href={`/api/documents/download/${doc.id}`}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="bg-white text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                  >
                    ⬇️ تحميل
                  </a>
                </div>
              </div>
              {/* File Info */}
              <div className="p-3 space-y-1.5">
                <h4 className="text-sm font-bold text-slate-800 truncate" title={doc.titre}>{doc.titre}</h4>
                <p className="text-[11px] text-slate-400 truncate">{doc.nomFichier}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">{formatFileSize(doc.tailleFichier)}</span>
                  <div className="flex items-center gap-1.5">
                    {doc.commune && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                        style={{ backgroundColor: COMMUNE_COLORS[doc.commune] || '#64748b' }}
                      >
                        {doc.commune}
                      </span>
                    )}
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
                      style={{ backgroundColor: getCategoryColor(doc.categorie) }}
                    >
                      {getCategoryIcon(doc.categorie)} {doc.categorie}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-50">
                  <span className="text-[10px] text-slate-400">{formatDate(doc.createdAt)}</span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(doc.typeFichier === 'pdf' || doc.typeFichier === 'image') && (
                      <button onClick={(e) => { e.stopPropagation(); handleViewDocument(doc) }}
                        className="p-1 hover:bg-emerald-50 rounded-md transition-colors" title="عرض">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleEdit(doc) }}
                      className="p-1 hover:bg-emerald-50 rounded-md transition-colors" title="تعديل">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id) }}
                      className="p-1 hover:bg-red-50 rounded-md transition-colors" title="حذف">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500">المستند</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 hidden md:table-cell">الفئة</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 hidden lg:table-cell">الجماعة</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 hidden sm:table-cell">الحجم</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500 hidden lg:table-cell">التاريخ</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-slate-500">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {sortedDocuments.map((doc, i) => (
                <motion.tr
                  key={doc.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="border-b border-slate-50 hover:bg-emerald-50/30 transition-colors cursor-pointer"
                  onClick={() => setDetailDoc(doc)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getFileIcon(doc.typeFichier)}</span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate max-w-[200px]">{doc.titre}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">{doc.nomFichier}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-medium px-2 py-1 rounded-lg text-white"
                      style={{ backgroundColor: getCategoryColor(doc.categorie) }}>
                      {getCategoryIcon(doc.categorie)} {doc.categorie}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    {doc.commune ? (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: COMMUNE_COLORS[doc.commune] || '#64748b' }}>
                        {doc.commune}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs text-slate-500">{formatFileSize(doc.tailleFichier)}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-slate-500">{formatDate(doc.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {(doc.typeFichier === 'pdf' || doc.typeFichier === 'image') && (
                        <button onClick={(e) => { e.stopPropagation(); handleViewDocument(doc) }}
                          className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors" title="عرض">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                            <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                      <a href={`/api/documents/download/${doc.id}`} download onClick={(e) => e.stopPropagation()}
                        className="p-1.5 hover:bg-blue-100 rounded-lg transition-colors" title="تحميل">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </a>
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(doc) }}
                        className="p-1.5 hover:bg-amber-100 rounded-lg transition-colors" title="تعديل">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-600" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeletingId(doc.id) }}
                        className="p-1.5 hover:bg-red-100 rounded-lg transition-colors" title="حذف">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== DOCUMENT DETAIL PANEL ===== */}
      <AnimatePresence>
        {detailDoc && !viewingDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => setDetailDoc(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Preview Area */}
              <div className="h-40 bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative">
                <div className="text-center">
                  <div className="text-6xl mb-2">{getFileIcon(detailDoc.typeFichier)}</div>
                  <span
                    className="text-xs font-bold px-3 py-1 rounded-lg text-white"
                    style={{ backgroundColor: getCategoryColor(detailDoc.categorie) }}
                  >
                    {detailDoc.categorie}
                  </span>
                </div>
                <button onClick={() => setDetailDoc(null)}
                  className="absolute top-3 left-3 p-2 bg-white/80 hover:bg-white rounded-xl transition-colors shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Details */}
              <div className="p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-extrabold text-slate-800">{detailDoc.titre}</h3>
                  {detailDoc.description && <p className="text-sm text-slate-500 mt-1">{detailDoc.description}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الملف</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5 truncate">{detailDoc.nomFichier}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الحجم</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">{formatFileSize(detailDoc.tailleFichier)}</p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">الجماعة</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5">
                      {detailDoc.commune ? (
                        <span className="px-2 py-0.5 rounded-md text-white" style={{ backgroundColor: COMMUNE_COLORS[detailDoc.commune] || '#64748b' }}>
                          {detailDoc.commune}
                        </span>
                      ) : 'عام'}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-400 font-medium">المرجع</p>
                    <p className="text-xs font-bold text-slate-700 mt-0.5" dir="ltr">{detailDoc.reference || '—'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>بواسطة: {detailDoc.uploadedBy || '—'}</span>
                  <span>•</span>
                  <span>{formatDate(detailDoc.dateDocument || detailDoc.createdAt)}</span>
                </div>

                <div className="flex gap-2 pt-1">
                  {(detailDoc.typeFichier === 'pdf' || detailDoc.typeFichier === 'image') && (
                    <button onClick={() => { setDetailDoc(null); handleViewDocument(detailDoc) }}
                      className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 text-sm">
                      👁️ عرض المستند
                    </button>
                  )}
                  <a href={`/api/documents/download/${detailDoc.id}`} download
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 text-sm transition-colors">
                    ⬇️ تحميل
                  </a>
                  <button onClick={() => { setDetailDoc(null); handleEdit(detailDoc) }}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors text-sm">
                    ✏️
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== UPLOAD DIALOG ===== */}
      <AnimatePresence>
        {showUploadDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setShowUploadDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                    <span>📤</span> رفع مستند جديد
                  </h3>
                  <button onClick={() => setShowUploadDialog(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">✕</button>
                </div>
              </div>

              <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
                {/* Drag & Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-emerald-400 bg-emerald-50'
                      : uploadFile
                      ? 'border-emerald-300 bg-emerald-50/50'
                      : 'border-slate-200 bg-slate-50/50 hover:border-emerald-300 hover:bg-emerald-50/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
                    className="hidden"
                  />
                  {uploadFile ? (
                    <div className="space-y-2">
                      <div className="text-4xl">{getFileIcon(uploadFile.name.split('.').pop()?.toLowerCase() === 'pdf' ? 'pdf' : 'other')}</div>
                      <div className="text-sm font-bold text-slate-700">{uploadFile.name}</div>
                      <div className="text-xs text-slate-400">{formatFileSize(uploadFile.size)}</div>
                      {isUploading && (
                        <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                          <div className="bg-emerald-500 rounded-full h-2 transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }} />
                        </div>
                      )}
                      <button type="button" onClick={(e) => { e.stopPropagation(); setUploadFile(null) }}
                        className="text-xs text-red-500 hover:text-red-700">
                        إزالة الملف
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-4xl">📎</div>
                      <div className="text-sm font-medium text-slate-600">اسحب الملف هنا أو انقر للاختيار</div>
                      <div className="text-xs text-slate-400">PDF, Word, Excel, صور — حتى 50 ميغابايت</div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">عنوان المستند *</label>
                  <input type="text" value={uploadForm.titre}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, titre: e.target.value }))}
                    placeholder="أدخل عنوان المستند"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    required />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">وصف المستند</label>
                  <textarea value={uploadForm.description}
                    onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف مختصر للمستند..." rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 resize-none" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">الفئة</label>
                    <select value={uploadForm.categorie}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, categorie: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                      {CATEGORIES.filter(c => c.id !== 'ALL').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">الجماعة</label>
                    <select
                      value={uploadForm.commune || (effectiveCommune !== 'ALL' ? effectiveCommune : '')}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, commune: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                      <option value="">عام (كل الجماعات)</option>
                      <option value="سلا">جماعة سلا</option>
                      <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                      <option value="عامر">جماعة عامر</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">المرجع</label>
                    <input type="text" value={uploadForm.reference}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, reference: e.target.value }))}
                      placeholder="رقم المرجع"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                      dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">تاريخ المستند</label>
                    <input type="date" value={uploadForm.dateDocument}
                      onChange={(e) => setUploadForm(prev => ({ ...prev, dateDocument: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                      dir="ltr" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <motion.button type="submit" disabled={isUploading || !uploadFile}
                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {isUploading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري الرفع... {uploadProgress}%</span>
                      </>
                    ) : (
                      <><span>📤 رفع المستند</span></>
                    )}
                  </motion.button>
                  <button type="button" onClick={() => setShowUploadDialog(false)}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== PDF VIEWER ===== */}
      <AnimatePresence>
        {viewingDocument && viewerType === 'pdf' && (
          <PdfViewer document={viewingDocument} onClose={handleCloseViewer} />
        )}
      </AnimatePresence>

      {/* ===== IMAGE VIEWER ===== */}
      <AnimatePresence>
        {viewingDocument && viewerType === 'image' && (
          <ImageViewer document={viewingDocument} onClose={handleCloseViewer} />
        )}
      </AnimatePresence>

      {/* ===== EDIT DIALOG ===== */}
      <AnimatePresence>
        {editingDocument && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setEditingDocument(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-extrabold text-slate-800 flex items-center gap-2">
                    <span>✏️</span> تعديل المستند
                  </h3>
                  <button onClick={() => setEditingDocument(null)} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">✕</button>
                </div>
              </div>

              <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">عنوان المستند *</label>
                  <input type="text" value={editForm.titre}
                    onChange={(e) => setEditForm(prev => ({ ...prev, titre: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    required />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">وصف المستند</label>
                  <textarea value={editForm.description}
                    onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">الفئة</label>
                    <select value={editForm.categorie}
                      onChange={(e) => setEditForm(prev => ({ ...prev, categorie: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                      {CATEGORIES.filter(c => c.id !== 'ALL').map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">المرجع</label>
                    <input type="text" value={editForm.reference}
                      onChange={(e) => setEditForm(prev => ({ ...prev, reference: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                      dir="ltr" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">تاريخ المستند</label>
                  <input type="date" value={editForm.dateDocument}
                    onChange={(e) => setEditForm(prev => ({ ...prev, dateDocument: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    dir="ltr" />
                </div>
                <div className="flex gap-3 pt-2">
                  <motion.button type="submit" whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                    className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 rounded-xl font-medium shadow-lg shadow-emerald-200">
                    حفظ التعديلات
                  </motion.button>
                  <button type="button" onClick={() => setEditingDocument(null)}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">إلغاء</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== DELETE CONFIRMATION ===== */}
      <AnimatePresence>
        {deletingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={() => setDeletingId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="text-5xl mb-3">⚠️</div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">حذف المستند</h3>
              <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا المستند؟ لا يمكن التراجع عن هذا الإجراء.</p>
              <div className="flex gap-3">
                <button onClick={() => handleDelete(deletingId)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-medium transition-colors">
                  نعم، حذف
                </button>
                <button onClick={() => setDeletingId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
