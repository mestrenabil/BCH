'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'

// ===== INVENTORY VIEW =====
interface Product {
  id: string; nom: string; categorie: string; unite: string; quantiteStock: number
  seuilAlerte: number; prixUnitaire: number; fournisseur: string; description: string
  reference: string; commune: string; createdAt: string; updatedAt: string
}

// ===== PRODUCT FORM DIALOG =====
function ProductFormDialog({ product, categories, units, onSave, onClose }: {
  product: Product | null; categories: Record<string, string>; units: string[]
  onSave: (formData: FormData, isEdit: boolean, productId?: string) => void; onClose: () => void
}) {
  const isEdit = !!product
  const formRef = useRef<HTMLFormElement>(null)

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
        <form ref={formRef} onSubmit={(e) => { e.preventDefault(); onSave(new FormData(e.currentTarget), isEdit, product?.id) }}
          className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">* اسم المنتج</label>
              <input name="nom" defaultValue={product?.nom || ''} required placeholder="اسم المنتج أو المادة"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">* الفئة</label>
              <select name="categorie" defaultValue={product?.categorie || ''} required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                <option value="">اختر الفئة</option>
                {Object.entries(categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">الجماعة</label>
              <select name="commune" defaultValue={product?.commune || ''}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm">
                <option value="">مشترك (كل الجماعات)</option>
                <option value="سلا">جماعة سلا</option>
                <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                <option value="عامر">جماعة عامر</option>
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
            <div className="col-span-2">
              <label className="block text-xs font-bold text-slate-500 mb-1.5">وصف المنتج</label>
              <textarea name="description" defaultValue={product?.description || ''} rows={2} placeholder="وصف مختصر للمنتج..."
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm resize-none" />
            </div>
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

function InventoryView() {
  const [products, setProducts] = useState<Product[]>([])
  const [stats, setStats] = useState({ totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [filterCategorie, setFilterCategorie] = useState('ALL')
  const [filterCommune, setFilterCommune] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const PRODUCT_CATEGORIES: Record<string, string> = {
    DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم', GENERAL: 'مواد عامة',
  }
  const PRODUCT_ICONS: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴', GENERAL: '📦' }
  const PRODUCT_COLORS: Record<string, string> = { DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981', GENERAL: '#6366f1' }
  const UNITS = ['لتر', 'كيلوغرام', 'علبة', 'وحدة', 'كيس', 'طن', 'ملل']

  const refreshProducts = useCallback(() => setRefreshKey(k => k + 1), [])

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
        if (debouncedSearch) params.set('search', debouncedSearch)
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        const res = await fetch(`/api/products?${params}`)
        const data = await res.json()
        if (!cancelled) {
          setProducts(data.products || [])
          setStats(data.stats || { totalProducts: 0, totalStockValue: 0, lowStockCount: 0, outOfStockCount: 0 })
          setIsLoading(false)
        }
      } catch (err) { console.error('Failed to fetch products:', err); if (!cancelled) setIsLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [filterCategorie, debouncedSearch, filterCommune, refreshKey])

  const handleSave = async (formData: FormData, isEdit: boolean, productId?: string) => {
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
    }
    if (!data.nom || !data.categorie) { toast.error('يرجى ملء جميع الحقول المطلوبة'); return }
    try {
      const res = await fetch(isEdit ? `/api/products/${productId}` : '/api/products', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
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

  const handleStockUpdate = async (id: string, newQty: number) => {
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantiteStock: newQty }),
      })
      refreshProducts()
    } catch { toast.error('حدث خطأ') }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">إدارة المخزون</h2>
          <p className="text-slate-500 text-sm mt-1">تدبير المواد والمستلزمات المستعملة في عمليات 3D</p>
        </div>
        <motion.button onClick={() => { setEditingProduct(null); setShowForm(true) }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2 self-start">
          <span className="text-lg">+</span> إضافة منتج جديد
        </motion.button>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'إجمالي المنتجات', value: stats.totalProducts, icon: '📦', gradient: 'from-indigo-500 to-indigo-700', shadow: 'shadow-indigo-200' },
          { title: 'قيمة المخزون', value: `${stats.totalStockValue.toLocaleString('ar-MA')} د.م`, icon: '💰', gradient: 'from-emerald-500 to-emerald-700', shadow: 'shadow-emerald-200' },
          { title: 'مخزون منخفض', value: stats.lowStockCount, icon: '⚠️', gradient: 'from-amber-500 to-amber-700', shadow: 'shadow-amber-200' },
          { title: 'نفذ المخزون', value: stats.outOfStockCount, icon: '🚫', gradient: 'from-red-500 to-red-700', shadow: 'shadow-red-200' },
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
          {Object.entries(PRODUCT_CATEGORIES).map(([key, label]) => (
            <button key={key} onClick={() => setFilterCategorie(key)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${filterCategorie === key ? 'text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
              style={filterCategorie === key ? { backgroundColor: PRODUCT_COLORS[key] } : {}}>
              <span>{PRODUCT_ICONS[key]}</span> {label}
            </button>
          ))}
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
          </select>
        </div>
      </div>

      {/* Products — Mobile Cards / Desktop Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : products.length === 0 ? (
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
              {products.map((product, i) => {
                const isLow = product.quantiteStock <= product.seuilAlerte && product.quantiteStock > 0
                const isOut = product.quantiteStock === 0
                return (
                  <motion.div key={product.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-xl border p-4 space-y-3 ${isOut ? 'bg-red-50/30 border-red-200' : isLow ? 'bg-amber-50/30 border-amber-200' : 'bg-white border-slate-100'}`}>
                    {/* Top: Icon + Name + Category badge */}
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg shrink-0"
                        style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15' }}>
                        {PRODUCT_ICONS[product.categorie]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 text-sm">{product.nom}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{product.reference}</div>
                      </div>
                      <span className="px-2 py-1 rounded-full text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15', color: PRODUCT_COLORS[product.categorie] }}>
                        {PRODUCT_CATEGORIES[product.categorie] || product.categorie}
                      </span>
                    </div>
                    {/* Stock with +/- */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">الكمية ({product.unite})</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleStockUpdate(product.id, Math.max(0, product.quantiteStock - 1))}
                          className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-bold transition-colors flex items-center justify-center">−</button>
                        <span className={`min-w-[2rem] text-center font-bold text-sm ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                          {product.quantiteStock}
                        </span>
                        <button onClick={() => handleStockUpdate(product.id, product.quantiteStock + 1)}
                          className="w-7 h-7 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-600 text-sm font-bold transition-colors flex items-center justify-center">+</button>
                      </div>
                    </div>
                    {/* Commune badge + Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
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
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditingProduct(product); setShowForm(true) }}
                          className="w-8 h-8 rounded-lg hover:bg-blue-50 text-blue-500 text-sm flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                        <button onClick={() => setShowDeleteConfirm(product.id)}
                          className="w-8 h-8 rounded-lg hover:bg-red-50 text-red-500 text-sm flex items-center justify-center transition-colors" title="حذف">🗑️</button>
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
                    <th className="text-center px-4 py-3 font-bold text-slate-500 text-xs">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, i) => {
                    const isLow = product.quantiteStock <= product.seuilAlerte && product.quantiteStock > 0
                    const isOut = product.quantiteStock === 0
                    return (
                      <motion.tr key={product.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${isOut ? 'bg-red-50/30' : isLow ? 'bg-amber-50/30' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                              style={{ backgroundColor: PRODUCT_COLORS[product.categorie] + '15' }}>
                              {PRODUCT_ICONS[product.categorie]}
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
                            {PRODUCT_CATEGORIES[product.categorie] || product.categorie}
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
                            <button onClick={() => handleStockUpdate(product.id, Math.max(0, product.quantiteStock - 1))}
                              className="w-[44px] h-[44px] rounded-md bg-slate-100 hover:bg-slate-200 text-slate-500 text-xs font-bold transition-colors flex items-center justify-center">−</button>
                            <span className={`min-w-[2.5rem] text-center font-bold text-sm ${isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-slate-800'}`}>
                              {product.quantiteStock}
                            </span>
                            <button onClick={() => handleStockUpdate(product.id, product.quantiteStock + 1)}
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
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={() => { setEditingProduct(product); setShowForm(true) }}
                              className="w-7 h-7 rounded-lg hover:bg-blue-50 text-blue-500 text-sm flex items-center justify-center transition-colors" title="تعديل">✏️</button>
                            <button onClick={() => setShowDeleteConfirm(product.id)}
                              className="w-7 h-7 rounded-lg hover:bg-red-50 text-red-500 text-sm flex items-center justify-center transition-colors" title="حذف">🗑️</button>
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
          <ProductFormDialog product={editingProduct} categories={PRODUCT_CATEGORIES} units={UNITS}
            onSave={handleSave} onClose={() => { setShowForm(false); setEditingProduct(null) }} />
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
    </div>
  )
}

export default InventoryView
