'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { appendTerritoryParams, hasTerritorySelection, type TerritoryCatalogEntry } from '@/lib/geography'
import { territoryCommuneName, useTerritoryCommunes } from '@/hooks/use-territory-communes'
import {
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'

// ===== INVENTORY VIEW =====
interface Product {
  id: string; nom: string; categorie: string; unite: string; quantiteStock: number
  seuilAlerte: number; prixUnitaire: number; fournisseur: string; description: string
  reference: string; commune: string; dateExpiration: string | null; createdAt: string; updatedAt: string
  imagePath?: string | null
  stockSource?: 'general' | 'vector'; pestProductId?: string
}

interface PestProductStock {
  id: string; reference: string; commercialName: string; activeSubstance: string
  category: string; unit: string; quantityStock: number; thresholdAlert: number
  expiryDate: string | null; supplier: string; unitPrice: number; commune: string
  description: string; createdAt: string; updatedAt: string
}

interface StockMovement {
  id: string; productId: string; type: string; quantity: number; reason: string | null; note: string | null; commune: string; createdAt: string
}

// ===== IMAGE LIGHTBOX (full-screen preview) =====
function ImageLightbox({ src, alt, caption, onClose }: {
  src: string; alt?: string; caption?: string; onClose: () => void
}) {
  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label="معاينة الصورة">
      {/* Close button */}
      <button type="button" onClick={onClose} aria-label="إغلاق"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center text-xl transition-colors">✕</button>
      {/* The image — stop propagation so clicking the image itself doesn't close */}
      <motion.div
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        onClick={(e) => e.stopPropagation()}
        className="max-w-[90vw] max-h-[85vh] flex flex-col items-center gap-3">
        <img src={src} alt={alt || 'صورة المنتج'}
          className="max-w-full max-h-[78vh] rounded-xl object-contain shadow-2xl ring-1 ring-white/10" />
        {caption && (
          <div className="text-white/90 text-sm font-medium bg-black/40 px-4 py-2 rounded-lg">{caption}</div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ===== PRODUCT IMAGE SECTION (upload/preview/delete) =====
// When `productId` is provided → uploads/deletes immediately against the server.
// When `productId` is omitted (new product) → holds the chosen file locally via onSelectPendingFile
//   so the parent can upload it right after the product is created.
function ProductImageSection({ productId, hasImage, onImageChanged, onSelectPendingFile }: {
  productId?: string; hasImage: boolean; onImageChanged?: (hasImage: boolean) => void
  onSelectPendingFile?: (file: File | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewVersion, setPreviewVersion] = useState(0)
  // Local preview for the "new product" flow (object URL created from the picked File)
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null)
  // Full-screen image preview
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Local UI state tracks whether an image is currently attached, so the preview
  // updates immediately after upload/delete without waiting for the parent to refetch.
  const [imagePresent, setImagePresent] = useState(hasImage)

  const hasLocalSelection = pendingPreviewUrl !== null

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // New-product flow: just hold the file locally and preview it.
    if (!productId) {
      const url = URL.createObjectURL(file)
      setPendingPreviewUrl(url)
      setImagePresent(true)
      onSelectPendingFile?.(file)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    // Edit flow: upload immediately.
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/products/${productId}/image`, { method: 'POST', body: fd })
      if (res.ok) {
        toast.success('تم رفع صورة المنتج بنجاح')
        setImagePresent(true)
        setPreviewVersion((v) => v + 1)
        onImageChanged?.(true)
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'فشل في رفع الصورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع الصورة')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = async () => {
    // New-product flow: just clear the local pending selection.
    if (!productId) {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl)
      setPendingPreviewUrl(null)
      setImagePresent(false)
      onSelectPendingFile?.(null)
      return
    }
    // Edit flow: delete on the server.
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${productId}/image`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف صورة المنتج')
        setImagePresent(false)
        onImageChanged?.(false)
      } else {
        toast.error('فشل في حذف الصورة')
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف')
    } finally {
      setDeleting(false)
    }
  }

  // Decide which preview source to show: pending local file, or the server file.
  const previewSrc = productId
    ? (imagePresent ? `/api/products/${productId}/image/view?v=${previewVersion}` : null)
    : pendingPreviewUrl

  return (
    <div className="col-span-2">
      <label className="block text-xs font-bold text-slate-500 mb-1.5">صورة المنتج</label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => previewSrc && setLightboxOpen(true)}
          disabled={!previewSrc}
          title={previewSrc ? 'انقر لمعاينة الصورة بحجم كامل' : undefined}
          className="relative w-20 h-20 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0 transition-all disabled:cursor-default enabled:hover:border-emerald-300 enabled:hover:ring-2 enabled:hover:ring-emerald-500/20 enabled:cursor-zoom-in"
        >
          {previewSrc ? (
            <>
              <img src={previewSrc} alt="صورة المنتج" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[8px] py-0.5 text-center pointer-events-none">🔍 تكبير</span>
            </>
          ) : (
            <span className="text-2xl opacity-40">🖼️</span>
          )}
        </button>
        <div className="flex flex-col gap-2 flex-1">
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange} disabled={uploading || deleting} className="hidden" />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            disabled={uploading || deleting}
            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-50 transition-colors disabled:opacity-50">
            {uploading ? '⏳ جاري الرفع...' : imagePresent ? '🔄 تغيير الصورة' : '📤 إضافة صورة'}
          </button>
          {imagePresent && (
            <button type="button" onClick={handleDelete} disabled={uploading || deleting}
              className="px-3 py-2 rounded-xl border border-red-200 text-red-600 font-medium text-xs hover:bg-red-50 transition-colors disabled:opacity-50">
              {deleting ? '⏳ جاري الحذف...' : '🗑️ حذف الصورة'}
            </button>
          )}
        </div>
      </div>
      <p className="text-[10px] text-slate-400 mt-1">
        {productId
          ? 'يُسمح بصور JPG/PNG/WebP بحجم أقصى 5 ميغابايت — انقر على الصورة لمعاينتها بالكامل'
          : 'يُرفع الملف تلقائياً بعد حفظ المنتج — يُسمح بصور JPG/PNG/WebP بحجم أقصى 5 ميغابايت'}
      </p>
      {lightboxOpen && previewSrc && (
        <ImageLightbox src={previewSrc} alt="صورة المنتج" onClose={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}

// ===== PRODUCT FORM DIALOG =====
function ProductFormDialog({ product, categories, units, onSave, onClose, scopedCommunes, useTerritoryFilter, mustChooseScopedCommune, accountCommune, onImageChanged, onAddCategory }: {
  product: Product | null; categories: Record<string, string>; units: string[]
  onSave: (formData: FormData, isEdit: boolean, productId?: string, pendingImage?: File | null) => void; onClose: () => void
  scopedCommunes: TerritoryCatalogEntry[]
  useTerritoryFilter: boolean; mustChooseScopedCommune: boolean; accountCommune: string
  onImageChanged?: () => void
  onAddCategory: (label: string, commune: string) => Promise<{ key: string; label: string } | null>
}) {
  const isEdit = !!product
  const formRef = useRef<HTMLFormElement>(null)
  const scopedCommuneNames = scopedCommunes.map(territoryCommuneName)
  const defaultCommune = product?.commune || accountCommune || (mustChooseScopedCommune && scopedCommuneNames.length === 1 ? scopedCommuneNames[0] : '')
  // Holds the image chosen during the "new product" flow; uploaded after the product is created.
  const [pendingImage, setPendingImage] = useState<File | null>(null)
  const [categoryValue, setCategoryValue] = useState(product?.categorie || '')
  const [showNewCategory, setShowNewCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [isAddingCategory, setIsAddingCategory] = useState(false)

  // Format dateExpiration for date input (YYYY-MM-DD)
  const expiryDateValue = product?.dateExpiration
    ? new Date(product.dateExpiration).toISOString().split('T')[0]
    : ''

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-l from-emerald-600 to-teal-600 p-5 rounded-t-2xl text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">
                {isEdit ? '✏️' : '📦'}
              </div>
              <div>
                <h3 className="font-bold text-lg">{isEdit ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h3>
                <p className="text-emerald-100 text-xs">{isEdit ? 'تحديث بيانات المنتج' : 'إدخال منتج جديد في المخزون'}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
          </div>
        </div>
        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget), isEdit, product?.id, pendingImage) }}
          className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">* اسم المنتج</label>
              <input name="nom" defaultValue={product?.nom || ''} required placeholder="اسم المنتج أو المادة"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">* الفئة</label>
              <select name="categorie" value={categoryValue} onChange={(event) => setCategoryValue(event.target.value)} required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                <option value="">اختر الفئة</option>
                {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              {!showNewCategory ? (
                <button type="button" onClick={() => setShowNewCategory(true)} className="mt-1.5 text-[11px] font-bold text-emerald-600 hover:text-emerald-700">
                  ＋ إضافة فئة جديدة حسب الحاجة
                </button>
              ) : (
                <div className="mt-2 flex gap-2">
                  <input value={newCategoryLabel} onChange={(event) => setNewCategoryLabel(event.target.value)} placeholder="اسم الفئة الجديدة" className="min-w-0 flex-1 px-2.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50/30 text-xs outline-none" autoFocus />
                  <button type="button" disabled={isAddingCategory} onClick={async () => {
                    const commune = (formRef.current?.elements.namedItem('commune') as HTMLSelectElement | null)?.value || defaultCommune
                    if (!newCategoryLabel.trim() || !commune) {
                      toast.error('حدد الجماعة وأدخل اسم الفئة أولاً')
                      return
                    }
                    setIsAddingCategory(true)
                    const created = await onAddCategory(newCategoryLabel, commune)
                    if (created) {
                      setCategoryValue(created.key)
                      setNewCategoryLabel('')
                      setShowNewCategory(false)
                    }
                    setIsAddingCategory(false)
                  }} className="shrink-0 px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold disabled:opacity-50">{isAddingCategory ? '...' : 'حفظ'}</button>
                  <button type="button" onClick={() => { setShowNewCategory(false); setNewCategoryLabel('') }} className="shrink-0 px-2 py-2 rounded-lg border border-slate-200 text-xs">✕</button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الجماعة *</label>
              <select name="commune" required defaultValue={defaultCommune}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                {!accountCommune && <option value="">اختر الجماعة</option>}
                {accountCommune
                  ? <option value={accountCommune}>{COMMUNE_LABELS[accountCommune] || accountCommune}</option>
                  : useTerritoryFilter
                  ? scopedCommunes.map((commune) => <option key={commune.code} value={territoryCommuneName(commune)}>{territoryCommuneName(commune)}</option>)
                  : null}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">وحدة القياس</label>
              <select name="unite" defaultValue={product?.unite || 'لتر'}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                {units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الكمية في المخزون</label>
              <input name="quantiteStock" type="number" min="0" defaultValue={product?.quantiteStock ?? 0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">عتبة التنبيه</label>
              <input name="seuilAlerte" type="number" min="0" defaultValue={product?.seuilAlerte ?? 10}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">السعر الوحدة (د.م)</label>
              <input name="prixUnitaire" type="number" min="0" step="0.01" defaultValue={product?.prixUnitaire ?? 0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">المورد</label>
              <input name="fournisseur" defaultValue={product?.fournisseur || ''} placeholder="اسم المورد"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">تاريخ الانتهاء</label>
              <input name="dateExpiration" type="date" defaultValue={expiryDateValue}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">وصف المنتج</label>
              <textarea name="description" defaultValue={product?.description || ''} rows={2} placeholder="وصف مختصر للمنتج..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none" />
            </div>
            {isEdit && product ? (
              <ProductImageSection productId={product.id} hasImage={!!product.imagePath} onImageChanged={onImageChanged} />
            ) : (
              <ProductImageSection hasImage={false} onSelectPendingFile={setPendingImage} />
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
            <button type="submit"
              className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 text-white font-medium text-sm shadow-lg shadow-emerald-200 hover:shadow-emerald-300 transition-all">
              {isEdit ? '💾 تحديث المنتج' : '📦 إضافة المنتج'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ===== STOCK MOVEMENT DIALOG =====
function StockMovementDialog({ product, movements, onClose }: {
  product: Product; movements: StockMovement[]; onClose: () => void
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl max-w-md w-full shadow-2xl max-h-[85vh] overflow-hidden">
        <div className="bg-gradient-to-l from-teal-600 to-cyan-600 p-5 rounded-t-2xl text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm">📋</div>
              <div>
                <h3 className="font-bold text-base">سجل حركة المخزون</h3>
                <p className="text-teal-100 text-xs">{product.nom}</p>
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors">✕</button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto p-4">
          {movements.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-3">📭</div>
              <p className="text-sm text-slate-500 font-medium">لا توجد حركات مسجلة</p>
            </div>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => {
                const isIn = m.type === 'IN' || m.type === 'ENTREE'
                const reasonLabels: Record<string, string> = {
                  purchase: 'شراء', usage: 'استعمال', adjustment: 'تعديل', initial: 'رصيد أولي'
                }
                const d = new Date(m.createdAt)
                const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                return (
                  <div key={m.id} className={`rounded-xl border p-3 flex items-center gap-3 ${isIn ? 'bg-emerald-50/50 border-emerald-100' : 'bg-red-50/50 border-red-100'}`}>
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${isIn ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {isIn ? '📥' : '📤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isIn ? 'وارد' : 'صادر'}
                        </span>
                        <span className="text-sm font-extrabold text-slate-800">{isIn ? '+' : '-'}{Math.abs(m.quantity)}</span>
                        <span className="text-[10px] text-slate-400">{dateStr}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {m.reason && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {reasonLabels[m.reason] || m.reason}
                          </span>
                        )}
                        {m.note && <span className="text-[10px] text-slate-400 truncate">{m.note}</span>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

function InventoryView() {
  const { user, territoryFilter } = useAppStore()
  const useTerritoryFilter = user?.role === 'admin' && user.commune === 'ALL'
  const { communes: scopedCommunes } = useTerritoryCommunes(territoryFilter, useTerritoryFilter)
  const mustChooseScopedCommune = useTerritoryFilter && hasTerritorySelection(territoryFilter)
  const [products, setProducts] = useState<Product[]>([])
  const [pestProducts, setPestProducts] = useState<PestProductStock[]>([])
  const [stats, setStats] = useState({ totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0, expiredCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('ALL')
  const [filterCommune, setFilterCommune] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // Full-screen image preview target (the product whose image is being viewed)
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null)

  // Stock movement dialog state
  const [movementProduct, setMovementProduct] = useState<Product | null>(null)
  const [stockMovements, setStockMovements] = useState<StockMovement[]>([])
  const [customCategories, setCustomCategories] = useState<Record<string, string>>({})

  const PRODUCT_CATEGORIES: Record<string, string> = {
    DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم', GENERAL: 'مواد عامة',
  }
  const PRODUCT_ICONS: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴', GENERAL: '📦', VECTOR: '🧪' }
  const PRODUCT_COLORS: Record<string, string> = { DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981', GENERAL: '#6366f1', VECTOR: '#84cc16' }
  const ALL_PRODUCT_CATEGORIES = { ...PRODUCT_CATEGORIES, ...customCategories }
  const UNITS = ['لتر', 'كيلوغرام', 'علبة', 'وحدة', 'كيس', 'طن', 'ملل']

  const pestCategoryToInventoryCategory: Record<string, string> = {
    RODENTICIDE: 'DERATISATION', INSECTICIDE: 'DESINSECTISATION', DISINFECTANT: 'DESINFECTION',
    REPELLENT: 'VECTOR', BAIT: 'VECTOR', OTHER: 'VECTOR',
  }
  const pestUnitLabels: Record<string, string> = { LITRE: 'لتر', KG: 'كيلوغرام', UNIT: 'وحدة', BOX: 'علبة' }

  const inventoryProducts = useMemo<Product[]>(() => {
    const generalProducts = products.map((product) => ({ ...product, stockSource: 'general' as const }))
    const vectorProducts = pestProducts.map((product) => ({
      id: `pest:${product.id}`,
      pestProductId: product.id,
      stockSource: 'vector' as const,
      nom: product.commercialName,
      categorie: pestCategoryToInventoryCategory[product.category] || 'VECTOR',
      unite: pestUnitLabels[product.unit] || product.unit,
      quantiteStock: product.quantityStock,
      seuilAlerte: product.thresholdAlert,
      prixUnitaire: product.unitPrice,
      fournisseur: product.supplier,
      description: product.description || product.activeSubstance,
      reference: product.reference,
      commune: product.commune,
      dateExpiration: product.expiryDate,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }))
    return [...generalProducts, ...vectorProducts].filter((product) => {
      const categoryMatches = filterCategorie === 'ALL'
        || (filterCategorie === 'VECTOR' ? product.stockSource === 'vector' : product.stockSource === 'general' && product.categorie === filterCategorie)
      const communeMatches = filterCommune === 'ALL' || product.commune === filterCommune
      const query = debouncedSearch.trim().toLowerCase()
      const searchMatches = !query || [product.nom, product.reference, product.fournisseur, product.description].some((value) => value.toLowerCase().includes(query))
      return categoryMatches && communeMatches && searchMatches
    })
  }, [products, pestProducts, filterCategorie, filterCommune, debouncedSearch])

  const refreshProducts = useCallback(() => setRefreshKey(k => k + 1), [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    fetch(`/api/product-categories?${params.toString()}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        const next: Record<string, string> = {}
        for (const category of data?.categories || []) next[category.key] = category.label
        setCustomCategories(next)
      })
      .catch(() => undefined)
  }, [territoryFilter, useTerritoryFilter])

  const handleAddCategory = async (label: string, commune: string) => {
    try {
      const response = await fetch('/api/product-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, commune, territoryFilter: useTerritoryFilter ? territoryFilter : undefined }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'تعذر إضافة الفئة')
      const created = data.category as { key: string; label: string }
      setCustomCategories((current) => ({ ...current, [created.key]: created.label }))
      toast.success('تمت إضافة فئة المنتج')
      return created
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'تعذر إضافة الفئة')
      return null
    }
  }

  // Debounce search query (300ms)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => { 
    let cancelled = false
    const load = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCategorie !== 'ALL') params.set('categorie', filterCategorie)
        if (filterCategorie === 'VECTOR') params.delete('categorie')
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
        const pestParams = new URLSearchParams()
        if (debouncedSearch) pestParams.set('search', debouncedSearch)
        if (filterCommune !== 'ALL') pestParams.set('commune', filterCommune)
        if (useTerritoryFilter) appendTerritoryParams(pestParams, territoryFilter)
        const [res, pestRes] = await Promise.all([
          fetch(`/api/products?${params}`),
          fetch(`/api/pest-products?${pestParams}`),
        ])
        const data = await res.json()
        const pestData = pestRes.ok ? await pestRes.json() : { products: [] }
        if (!cancelled) {
          const prods: Product[] = data.products || []
          const vectorProds: PestProductStock[] = pestData.products || []
          setProducts(prods)
          setPestProducts(vectorProds)

          // Compute expired count
          const now = new Date()
          const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          const expiredCount = prods.filter(p => {
            if (!p.dateExpiration) return false
            return new Date(p.dateExpiration) < now
          }).length + vectorProds.filter(p => p.expiryDate && new Date(p.expiryDate) < now).length

          const baseStats = data.stats || { totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 }
          setStats({
            totalProducts: baseStats.totalProducts + vectorProds.length,
            totalStockValue: baseStats.totalStockValue + vectorProds.reduce((sum, product) => sum + product.quantityStock * product.unitPrice, 0),
            lowStockCount: baseStats.lowStockCount + vectorProds.filter(product => product.quantityStock <= product.thresholdAlert && product.quantityStock > 0).length,
            outOfStockCount: baseStats.outOfStockCount + vectorProds.filter(product => product.quantityStock === 0).length,
            expiredCount,
          })
          setIsLoading(false)
        }
      } catch (err) { console.error('Failed to fetch products:', err); if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filterCategorie, debouncedSearch, filterCommune, refreshKey, territoryFilter, useTerritoryFilter])

  const handleSave = async (formData: FormData, isEdit: boolean, productId?: string, pendingImage?: File | null) => {
    const data = {
      nom: formData.get('nom') as string,
      categorie: formData.get('categorie') as string,
      commune: formData.get('commune') as string,
      unite: formData.get('unite') as string,
      quantiteStock: formData.get('quantiteStock') as string,
      seuilAlerte: formData.get('seuilAlerte') as string,
      prixUnitaire: formData.get('prixUnitaire') as string,
      fournisseur: formData.get('fournisseur') as string,
      description: formData.get('description') as string,
      dateExpiration: formData.get('dateExpiration') as string || null,
      territoryFilter: useTerritoryFilter ? territoryFilter : undefined,
    }
    if (!data.nom || !data.categorie || !data.commune) { toast.error('يرجى ملء جميع الحقول المطلوبة'); return }
    try {
      const res = await fetch(isEdit ? `/api/products/${productId}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        // For a newly created product with a pending image, upload it now that we have an id.
        if (!isEdit && pendingImage) {
          const created = await res.json().catch(() => null)
          const newId = created?.id as string | undefined
          if (newId) {
            try {
              const fd = new FormData()
              fd.append('file', pendingImage)
              const imgRes = await fetch(`/api/products/${newId}/image`, { method: 'POST', body: fd })
              if (!imgRes.ok) toast.error('تم حفظ المنتج لكن فشل رفع الصورة — يمكنك إضافتها لاحقاً بالتعديل')
            } catch {
              toast.error('تم حفظ المنتج لكن فشل رفع الصورة — يمكنك إضافتها لاحقاً بالتعديل')
            }
          }
        }
        toast.success(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح')
        setShowForm(false); setEditingProduct(null); refreshProducts()
      } else {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error || 'حدث خطأ')
      }
    } catch { toast.error('حدث خطأ أثناء الحفظ') }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      if (res.ok) { toast.success('تم حذف المنتج بنجاح'); refreshProducts() }
      else { toast.error('حدث خطأ أثناء الحذف') }
    } catch { toast.error('حدث خطأ') }
    setShowDeleteConfirm(null)
  }

  const handleStockUpdate = async (id: string, newQty: number, oldQty: number) => {
    try {
      const product = inventoryProducts.find((item) => item.id === id)
      if (product?.stockSource === 'vector' && product.pestProductId) {
        const diff = newQty - oldQty
        if (diff !== 0) {
          const res = await fetch(`/api/pest-products/${product.pestProductId}/movements`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: diff > 0 ? 'ENTREE' : 'SORTIE',
              quantity: Math.abs(diff),
              reason: 'تعديل من المخزون العام',
              territoryFilter: useTerritoryFilter ? territoryFilter : undefined,
            }),
          })
          if (!res.ok) {
            const error = await res.json().catch(() => ({}))
            toast.error(error.error || 'تعذر تحديث مخزون محاربة النواقل')
            return
          }
        }
        refreshProducts()
        return
      }
      await fetch(`/api/products/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantiteStock: newQty }),
      })
      // Create stock movement record
      const diff = newQty - oldQty
      if (diff !== 0) {
        await fetch('/api/stock-movements', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: id,
            type: diff > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(diff),
            reason: 'adjustment',
            note: `تعديل يدوي: ${oldQty} → ${newQty}`,
            commune: product?.commune || (filterCommune !== 'ALL' ? filterCommune : ''),
            territoryFilter: useTerritoryFilter ? territoryFilter : undefined,
          }),
        })
      }
      refreshProducts()
    } catch { toast.error('حدث خطأ') }
  }

  const handleShowMovements = async (product: Product) => {
    setMovementProduct(product)
    try {
      const isVectorProduct = product.stockSource === 'vector' && product.pestProductId
      const res = await fetch(isVectorProduct ? `/api/pest-products/${product.pestProductId}/movements` : `/api/stock-movements?productId=${product.id}`)
      if (res.ok) {
        const data = await res.json()
        const movements = data.movements || []
        setStockMovements(isVectorProduct
          ? movements.map((movement: { id: string; productId: string; type: string; quantity: number; reason?: string; interventionRef?: string; commune: string; createdAt: string }) => ({
            id: movement.id,
            productId: product.id,
            type: movement.type === 'ENTREE' || movement.quantity > 0 ? 'IN' : 'OUT',
            quantity: Math.abs(movement.quantity),
            reason: movement.reason || '',
            note: movement.interventionRef ? `مرجع التدخل: ${movement.interventionRef}` : null,
            commune: movement.commune,
            createdAt: movement.createdAt,
          }))
          : movements)
      } else {
        setStockMovements([])
      }
    } catch {
      setStockMovements([])
    }
  }

  // Expiry date helper
  const getExpiryBadge = (dateExpiration: string | null) => {
    if (!dateExpiration) return null
    const now = new Date()
    const expiry = new Date(dateExpiration)
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    if (expiry < now) {
      return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 whitespace-nowrap">⚠️ منتهي الصلاحية</span>
    }
    if (expiry <= thirtyDaysFromNow) {
      return <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 whitespace-nowrap">⏰ قريب الانتهاء</span>
    }
    return null
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة المخزون</h2>
          <p className="text-slate-500 text-sm mt-1">تدبير المخزون العام ومخزون محاربة النواقل والتطهير في لوحة موحّدة</p>
        </div>
        <motion.button onClick={() => { setEditingProduct(null); setShowForm(true) }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2 self-start">
          <span className="text-lg">+</span> إضافة منتج جديد
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { title: 'إجمالي المنتجات', value: stats.totalProducts, icon: '📦', gradient: 'from-indigo-500 to-indigo-700', shadow: 'shadow-indigo-200' },
          { title: 'قيمة المخزون', value: `${stats.totalStockValue.toLocaleString('ar-MA')} د.م`, icon: '💰', gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200' },
          { title: 'مخزون منخفض', value: stats.lowStockCount, icon: '⚠️', gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-200' },
          { title: 'نفذ المخزون', value: stats.outOfStockCount, icon: '🚫', gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-200' },
          { title: 'منتهي الصلاحية', value: stats.expiredCount, icon: '💊', gradient: 'from-rose-500 to-rose-700', shadow: 'shadow-rose-200' },
        ].map((card, i) => (
          <motion.div key={card.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className={`bg-gradient-to-br ${card.gradient} text-white rounded-2xl p-4 ${card.shadow} shadow-lg relative overflow-hidden`}>
            <div className="absolute top-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-6 -translate-y-6" />
            <span className="text-2xl opacity-90">{card.icon}</span>
            <div className="text-2xl font-bold mt-2">{card.value}</div>
            <div className="text-xs opacity-80 mt-1 font-medium">{card.title}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="🔍 بحث عن منتج..." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilterCategorie('ALL')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filterCategorie === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            الكل
          </button>
          {Object.entries(ALL_PRODUCT_CATEGORIES).map(([key, label]) => (
            <button key={key} onClick={() => setFilterCategorie(key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterCategorie === key ? 'text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              style={filterCategorie === key ? { backgroundColor: PRODUCT_COLORS[key] } : {}}>
              <span>{PRODUCT_ICONS[key]}</span> {label}
            </button>
          ))}
          <button onClick={() => setFilterCategorie('VECTOR')}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterCategorie === 'VECTOR' ? 'text-white shadow-md' : 'bg-white text-slate-600 border border-lime-200 hover:bg-lime-50'}`}
            style={filterCategorie === 'VECTOR' ? { backgroundColor: PRODUCT_COLORS.VECTOR } : {}}>
            <span>{PRODUCT_ICONS.VECTOR}</span> محاربة النواقل والتطهير
          </button>
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
            <option value="ALL">كل الجماعات</option>
            {Array.from(new Set(inventoryProducts.map((product) => product.commune).filter(Boolean)))
              .sort((first, second) => first.localeCompare(second, 'ar'))
              .map((commune) => <option key={commune} value={commune}>جماعة {commune}</option>)}
          </select>
        </div>
      </div>

      {/* Products — Mobile Cards / Desktop Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : inventoryProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-400">
            <span className="text-4xl mb-2">📦</span>
            <p className="text-sm font-medium">لا توجد منتجات في المخزون</p>
            <button onClick={() => { setEditingProduct(null); setShowForm(true) }}
              className="mt-3 text-xs text-emerald-600 font-bold hover:underline">إضافة منتج جديد</button>
          </div>
        ) : (
          <>
            {/* Mobile Card Layout */}
            <div className="md:hidden space-y-3 p-4">
              {inventoryProducts.map((product, i) => {
                const isLow = product.quantiteStock <= product.seuilAlerte && product.quantiteStock > 0
                const isOut = product.quantiteStock === 0
                const expiryBadge = getExpiryBadge(product.dateExpiration)
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-xl border p-4 space-y-3 ${isOut ? 'bg-red-50/30 border-red-200' : isLow ? 'bg-amber-50/30 border-amber-200' : 'bg-white border-slate-100'}`}>
                    {/* Top: Icon + Name + Category badge */}
                    <div className="flex items-start gap-3">
                      {product.stockSource !== 'vector' && product.imagePath ? (
                        <button type="button" onClick={() => setPreviewProduct(product)}
                          title="انقر لمعاينة الصورة بالكامل"
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 overflow-hidden cursor-zoom-in ring-1 ring-transparent hover:ring-emerald-400 transition-all"
                          style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15' }}>
                          <img src={`/api/products/${product.id}/image/view`} alt={product.nom} className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0 overflow-hidden"
                          style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15' }}>
                          {PRODUCT_ICONS[product.categorie]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm">{product.nom}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{product.reference}</div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15', color: PRODUCT_COLORS[product.categorie] }}>
                        {ALL_PRODUCT_CATEGORIES[product.categorie] || product.categorie}
                      </span>
                    </div>
                    {/* Stock with +/- */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">الكمية ({product.unite})</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleStockUpdate(product.id, Math.max(0, product.quantiteStock - 1), product.quantiteStock)}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-colors flex items-center justify-center">−</button>
                        <span className={`min-w-[2rem] text-center font-bold text-sm ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                          {product.quantiteStock}
                        </span>
                        <button onClick={() => handleStockUpdate(product.id, product.quantiteStock + 1, product.quantiteStock)}
                          className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 text-sm font-bold transition-colors flex items-center justify-center">+</button>
                      </div>
                    </div>
                    {/* Commune badge + Status + Expiry */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {product.commune ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                            style={{ backgroundColor: COMMUNE_COLORS[product.commune as keyof typeof COMMUNE_COLORS] || '#64748b' }}>
                            {COMMUNE_LABELS[product.commune as keyof typeof COMMUNE_LABELS] || product.commune}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">مشترك</span>
                        )}
                        {isOut ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">🚫 نفذ</span> :
                         isLow ? <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠️ منخفض</span> :
                         <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✅ متوفر</span>}
                        {expiryBadge}
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleShowMovements(product)}
                          className="w-8 h-8 rounded-lg hover:bg-teal-50 text-teal-500 text-sm flex items-center justify-center transition-colors" title="سجل الحركة">📋</button>
                        {product.stockSource === 'vector' ? (
                          <span className="rounded-lg bg-lime-50 px-2 py-1 text-[10px] font-bold text-lime-700">🔗 مخزون النواقل</span>
                        ) : (
                          <>
                            <button onClick={() => { setEditingProduct(product); setShowForm(true) }}
                              className="w-8 h-8 rounded-lg hover:bg-blue-50 text-blue-500 text-sm flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                            <button onClick={() => setShowDeleteConfirm(product.id)}
                              className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 text-sm flex items-center justify-center transition-colors" title="حذف">🗑️</button>
                          </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
            {/* Desktop Table Layout */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">المنتج</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">الفئة</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">الجماعة</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الكمية</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الوحدة</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">السعر</th>
                    <th className="text-right px-4 py-3 font-bold text-slate-500 text-xs">المورد</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الحالة</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">الصلاحية</th>
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryProducts.map((product, i) => {
                    const isLow = product.quantiteStock <= product.seuilAlerte && product.quantiteStock > 0
                    const isOut = product.quantiteStock === 0
                    const expiryBadge = getExpiryBadge(product.dateExpiration)
                    return (
                      <motion.tr key={product.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isOut ? 'bg-red-50/30' : isLow ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm overflow-hidden"
                              style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15' }}>
                              {product.stockSource !== 'vector' && product.imagePath ? (
                                <button type="button" onClick={() => setPreviewProduct(product)}
                                  className="relative w-full h-full group cursor-zoom-in">
                                  <img src={`/api/products/${product.id}/image/view`} alt={product.nom} className="w-full h-full object-cover" />
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition-colors">
                                    <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-[9px] bg-black/50 px-1.5 py-0.5 rounded">🔍</span>
                                  </span>
                                </button>
                              ) : (
                                PRODUCT_ICONS[product.categorie]
                              )}
                            </div>
                            <div>
                              <div className="font-bold text-slate-700 text-xs">{product.nom}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{product.reference}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                            style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15', color: PRODUCT_COLORS[product.categorie] }}>
                            {ALL_PRODUCT_CATEGORIES[product.categorie] || product.categorie}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {product.commune ? (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                              style={{ backgroundColor: COMMUNE_COLORS[product.commune as keyof typeof COMMUNE_COLORS] + '15', color: COMMUNE_COLORS[product.commune as keyof typeof COMMUNE_COLORS] || '#64748b' }}>
                              {COMMUNE_LABELS[product.commune as keyof typeof COMMUNE_LABELS] || product.commune}
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">مشترك</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleStockUpdate(product.id, Math.max(0, product.quantiteStock - 1), product.quantiteStock)}
                              className="w-[44px] h-[44px] rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold transition-colors flex items-center justify-center">−</button>
                            <span className={`min-w-[2.5rem] text-center font-bold text-sm ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                              {product.quantiteStock}
                            </span>
                            <button onClick={() => handleStockUpdate(product.id, product.quantiteStock + 1, product.quantiteStock)}
                              className="w-[44px] h-[44px] rounded-md bg-emerald-100 hover:bg-emerald-200 text-emerald-600 text-xs font-bold transition-colors flex items-center justify-center">+</button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 text-xs">{product.unite}</td>
                        <td className="px-4 py-3 text-center text-slate-700 text-xs font-bold">{product.prixUnitaire > 0 ? `${product.prixUnitaire.toLocaleString('ar-MA')} د.م` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-500">{product.fournisseur || '—'}</td>
                        <td className="px-4 py-3 text-center">
                          {isOut ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-100 text-red-700">🚫 نفذ</span> :
                           isLow ? <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">⚠️ منخفض</span> :
                           <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">✅ متوفر</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {expiryBadge || <span className="text-[10px] text-slate-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => handleShowMovements(product)}
                              className="w-7 h-7 rounded-lg hover:bg-teal-50 text-teal-500 text-sm flex items-center justify-center transition-colors" title="سجل الحركة">📋</button>
                            {product.stockSource === 'vector' ? (
                              <span className="rounded-lg bg-lime-50 px-2 py-1 text-[10px] font-bold text-lime-700">🔗 النواقل</span>
                            ) : (
                              <>
                                <button onClick={() => { setEditingProduct(product); setShowForm(true) }}
                                  className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 text-sm flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                                <button onClick={() => setShowDeleteConfirm(product.id)}
                                  className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 text-sm flex items-center justify-center transition-colors" title="حذف">🗑️</button>
                              </>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </motion.div>

      {/* Product Form Dialog */}
      <AnimatePresence>
        {showForm && (
          <ProductFormDialog product={editingProduct} categories={ALL_PRODUCT_CATEGORIES} units={UNITS}
            scopedCommunes={scopedCommunes} useTerritoryFilter={useTerritoryFilter} mustChooseScopedCommune={mustChooseScopedCommune}
            accountCommune={user?.commune && user.commune !== 'ALL' ? user.commune : ''}
            onSave={handleSave} onAddCategory={handleAddCategory} onImageChanged={refreshProducts} onClose={() => { setShowForm(false); setEditingProduct(null) }} />
        )}
      </AnimatePresence>

      {/* Stock Movement Dialog */}
      <AnimatePresence>
        {movementProduct && (
          <StockMovementDialog product={movementProduct} movements={stockMovements}
            onClose={() => { setMovementProduct(null); setStockMovements([]) }} />
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteConfirm(null)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="text-center">
                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3"><span className="text-2xl">🗑️</span></div>
                <h3 className="font-bold text-slate-800 mb-1">حذف المنتج</h3>
                <p className="text-sm text-slate-500 mb-4">هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</p>
                <div className="flex gap-3">
                  <button onClick={() => setShowDeleteConfirm(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors">إلغاء</button>
                  <button onClick={() => handleDelete(showDeleteConfirm)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium text-sm hover:bg-red-700 transition-colors shadow-lg shadow-red-200">حذف</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product image lightbox preview from list */}
      <AnimatePresence>
        {previewProduct && (
          <ImageLightbox
            src={`/api/products/${previewProduct.id}/image/view`}
            alt={previewProduct.nom}
            caption={previewProduct.nom}
            onClose={() => setPreviewProduct(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export default InventoryView
