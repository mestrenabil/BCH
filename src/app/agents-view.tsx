'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '@/lib/store'
import { COMMUNE_LABELS, COMMUNE_COLORS } from '@/lib/constants'
import { toast } from 'sonner'

// ===== TYPE DEFINITIONS =====
interface Agent {
  id: string
  nom: string
  prenom: string
  telephone: string
  commune: string
  fonction: string
  actif: boolean
  createdAt: string
  updatedAt: string
}

// ===== CONSTANTS =====

const FONCTION_OPTIONS = [
  { value: 'عون صحية', label: 'عون صحية', icon: '🛡️', color: '#059669' },
  { value: 'مراقب', label: 'مراقب', icon: '👁️', color: '#d97706' },
  { value: 'مسؤول', label: 'مسؤول', icon: '👔', color: '#7c3aed' },
]

const COMMUNE_KEYS = Object.keys(COMMUNE_LABELS) as string[]

// ===== HELPER FUNCTIONS =====
function getFonctionColor(fonction: string): string {
  return FONCTION_OPTIONS.find(f => f.value === fonction)?.color || '#64748b'
}

function getFonctionIcon(fonction: string): string {
  return FONCTION_OPTIONS.find(f => f.value === fonction)?.icon || '👤'
}

// ===== MAIN COMPONENT =====
export default function AgentsView() {
  const { user, selectedCommune } = useAppStore()
  const canSeeAllCommunes = user?.role === 'admin' || user?.commune === 'ALL'
  const effectiveCommune = canSeeAllCommunes ? selectedCommune : (user?.commune || '')

  // Data state
  const [agents, setAgents] = useState<Agent[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCommune, setFilterCommune] = useState<string>('ALL')
  const [filterFonction, setFilterFonction] = useState<string>('ALL')

  // Dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [deletingAgent, setDeletingAgent] = useState<Agent | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const emptyForm = {
    nom: '',
    prenom: '',
    telephone: '',
    commune: canSeeAllCommunes ? 'سلا' : (user?.commune || 'سلا'),
    fonction: 'عون صحية',
    actif: true,
  }
  const [form, setForm] = useState(emptyForm)

  // ===== DATA FETCHING =====
  const fetchAgents = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (effectiveCommune && effectiveCommune !== 'ALL') params.set('commune', effectiveCommune)
      const res = await fetch(`/api/agents?${params.toString()}`)
      if (!res.ok) throw new Error()
      const data = await res.json()
      setAgents(data.agents || [])
    } catch {
      toast.error('فشل في تحميل بيانات الأعوان')
    }
    setIsLoading(false)
  }, [effectiveCommune])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // ===== COMPUTED VALUES =====
  const filteredAgents = useMemo(() => {
    let result = agents

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(a =>
        a.nom.toLowerCase().includes(q) ||
        a.prenom.toLowerCase().includes(q) ||
        a.telephone.toLowerCase().includes(q) ||
        (a.nom + ' ' + a.prenom).toLowerCase().includes(q)
      )
    }

    // Commune filter
    if (filterCommune !== 'ALL') {
      result = result.filter(a => a.commune === filterCommune)
    }

    // Function filter
    if (filterFonction !== 'ALL') {
      result = result.filter(a => a.fonction === filterFonction)
    }

    return result
  }, [agents, searchQuery, filterCommune, filterFonction])

  // Statistics
  const stats = useMemo(() => {
    const total = agents.length
    const active = agents.filter(a => a.actif).length
    const inactive = total - active
    const byCommune: Record<string, number> = {}
    for (const key of COMMUNE_KEYS) {
      byCommune[key] = agents.filter(a => a.commune === key).length
    }
    const byFonction: Record<string, number> = {}
    for (const f of FONCTION_OPTIONS) {
      byFonction[f.value] = agents.filter(a => a.fonction === f.value).length
    }
    return { total, active, inactive, byCommune, byFonction }
  }, [agents])

  // ===== CRUD HANDLERS =====
  const handleAdd = () => {
    setForm({
      ...emptyForm,
      commune: canSeeAllCommunes ? 'سلا' : (user?.commune || 'سلا'),
    })
    setShowAddDialog(true)
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setForm({
      nom: agent.nom,
      prenom: agent.prenom,
      telephone: agent.telephone,
      commune: agent.commune,
      fonction: agent.fonction,
      actif: agent.actif,
    })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom.trim()) {
      toast.error('يرجى إدخال اسم العون')
      return
    }

    setIsSaving(true)
    try {
      const url = editingAgent ? `/api/agents/${editingAgent.id}` : '/api/agents'
      const method = editingAgent ? 'PUT' : 'POST'

      const body: Record<string, unknown> = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim(),
        fonction: form.fonction,
        actif: form.actif,
      }

      // Only send commune if admin; backend enforces for non-admin
      if (canSeeAllCommunes) {
        body.commune = form.commune
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'حدث خطأ أثناء الحفظ')
      }

      toast.success(editingAgent ? 'تم تحديث بيانات العون بنجاح' : 'تم إضافة العون بنجاح')
      setShowAddDialog(false)
      setEditingAgent(null)
      fetchAgents()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل في حفظ البيانات')
    }
    setIsSaving(false)
  }

  const handleDelete = async () => {
    if (!deletingAgent) return
    try {
      const res = await fetch(`/api/agents/${deletingAgent.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('تم حذف العون بنجاح')
      setDeletingAgent(null)
      fetchAgents()
    } catch {
      toast.error('فشل في حذف العون')
    }
  }

  const handleToggleActive = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !agent.actif }),
      })
      if (!res.ok) throw new Error()
      toast.success(agent.actif ? 'تم تعطيل العون' : 'تم تفعيل العون')
      fetchAgents()
    } catch {
      toast.error('فشل في تحديث حالة العون')
    }
  }

  // ===== RENDER =====
  return (
    <div className="p-4 lg:p-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>👮</span> إدارة الأعوان
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            تدبير وإدارة أعوان مكتب حفظ الصحة — {stats.total} عون
          </p>
        </div>
        <motion.button
          onClick={handleAdd}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          إضافة عون جديد
        </motion.button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">إجمالي الأعوان</p>
              <p className="text-2xl font-extrabold text-slate-800 mt-1">{stats.total}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">👮</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">أعوان نشطون</p>
              <p className="text-2xl font-extrabold text-emerald-600 mt-1">{stats.active}</p>
            </div>
            <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-xl">✅</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">أعوان غير نشطون</p>
              <p className="text-2xl font-extrabold text-red-500 mt-1">{stats.inactive}</p>
            </div>
            <div className="w-11 h-11 bg-red-50 rounded-xl flex items-center justify-center text-xl">⏸️</div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-400 font-medium">حسب الجماعة</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {COMMUNE_KEYS.map(key => (
                  <span key={key} className="text-[11px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: COMMUNE_COLORS[key] }}>
                    {stats.byCommune[key] || 0}
                  </span>
                ))}
              </div>
            </div>
            <div className="w-11 h-11 bg-teal-50 rounded-xl flex items-center justify-center text-xl">🏛️</div>
          </div>
        </motion.div>
      </div>

      {/* Commune breakdown bar */}
      {canSeeAllCommunes && stats.total > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">التوزيع حسب الجماعة الترابية</h3>
          <div className="flex items-center gap-1 h-8 rounded-xl overflow-hidden">
            {COMMUNE_KEYS.map((key) => {
              const pct = stats.total > 0 ? ((stats.byCommune[key] || 0) / stats.total) * 100 : 0
              return (
                <div
                  key={key}
                  className="h-full transition-all duration-500 relative group cursor-pointer"
                  style={{ width: `${pct}%`, backgroundColor: COMMUNE_COLORS[key], minWidth: pct > 0 ? '8px' : '0' }}
                  title={`${COMMUNE_LABELS[key]}: ${stats.byCommune[key] || 0} (${Math.round(pct)}%)`}
                >
                  {pct > 12 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white truncate px-1">
                      {key}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            {COMMUNE_KEYS.map((key) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[key] }} />
                <span className="text-[11px] text-slate-500">{COMMUNE_LABELS[key]}</span>
                <span className="text-[11px] font-bold text-slate-700">({stats.byCommune[key] || 0})</span>
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
              placeholder="البحث بالاسم أو اللقب..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
            />
          </div>

          {/* Commune filter */}
          {canSeeAllCommunes && (
            <select
              value={filterCommune}
              onChange={(e) => setFilterCommune(e.target.value)}
              className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
            >
              <option value="ALL">كل الجماعات</option>
              {COMMUNE_KEYS.map(key => (
                <option key={key} value={key}>{COMMUNE_LABELS[key]}</option>
              ))}
            </select>
          )}

          {/* Function filter */}
          <select
            value={filterFonction}
            onChange={(e) => setFilterFonction(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
          >
            <option value="ALL">كل الوظائف</option>
            {FONCTION_OPTIONS.map(f => (
              <option key={f.value} value={f.value}>{f.icon} {f.label}</option>
            ))}
          </select>
        </div>

        {/* Active filter chips */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {(searchQuery || filterCommune !== 'ALL' || filterFonction !== 'ALL') && (
            <>
              <span className="text-[11px] text-slate-400 font-medium">الفلاتر النشطة:</span>
              {searchQuery && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-emerald-50 text-emerald-700">
                  🔍 {searchQuery}
                  <button onClick={() => setSearchQuery('')} className="hover:text-emerald-900">×</button>
                </span>
              )}
              {filterCommune !== 'ALL' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-white" style={{ backgroundColor: COMMUNE_COLORS[filterCommune] || '#64748b' }}>
                  🏛️ {filterCommune}
                  <button onClick={() => setFilterCommune('ALL')} className="hover:text-white/80">×</button>
                </span>
              )}
              {filterFonction !== 'ALL' && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-white" style={{ backgroundColor: getFonctionColor(filterFonction) }}>
                  {getFonctionIcon(filterFonction)} {filterFonction}
                  <button onClick={() => setFilterFonction('ALL')} className="hover:text-white/80">×</button>
                </span>
              )}
              <button
                onClick={() => { setSearchQuery(''); setFilterCommune('ALL'); setFilterFonction('ALL') }}
                className="text-[11px] text-red-500 hover:text-red-700 font-medium"
              >
                مسح الكل
              </button>
            </>
          )}
        </div>
      </div>

      {/* Agents List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-400">جاري تحميل بيانات الأعوان...</p>
          </div>
        </div>
      ) : filteredAgents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center"
        >
          <div className="text-6xl mb-4">👮</div>
          <h3 className="text-xl font-bold text-slate-700 mb-2">لا يوجد أعوان</h3>
          <p className="text-sm text-slate-500 mb-4">
            {searchQuery || filterCommune !== 'ALL' || filterFonction !== 'ALL'
              ? 'لا توجد نتائج تطابق معايير البحث. جرب تغيير الفلاتر.'
              : 'لم يتم إضافة أي أعوان بعد. ابدأ بإضافة أول عون.'
            }
          </p>
          <button
            onClick={handleAdd}
            className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200"
          >
            إضافة عون جديد
          </button>
        </motion.div>
      ) : (
        <>
          {/* Desktop Grid */}
          <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredAgents.map((agent, i) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                index={i}
                onEdit={handleEdit}
                onDelete={setDeletingAgent}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>

          {/* Mobile List */}
          <div className="sm:hidden space-y-3">
            {filteredAgents.map((agent, i) => (
              <AgentCardMobile
                key={agent.id}
                agent={agent}
                index={i}
                onEdit={handleEdit}
                onDelete={setDeletingAgent}
                onToggleActive={handleToggleActive}
              />
            ))}
          </div>

          {/* Results count */}
          <div className="text-center">
            <span className="text-xs text-slate-400">
              عرض {filteredAgents.length} من أصل {agents.length} عون
            </span>
          </div>
        </>
      )}

      {/* ===== ADD/EDIT DIALOG ===== */}
      <AnimatePresence>
        {(showAddDialog || editingAgent) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => { setShowAddDialog(false); setEditingAgent(null) }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Dialog header */}
              <div className="bg-gradient-to-l from-emerald-600 to-teal-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-xl">
                      {editingAgent ? '✏️' : '➕'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">
                        {editingAgent ? 'تعديل بيانات العون' : 'إضافة عون جديد'}
                      </h3>
                      <p className="text-emerald-100/70 text-xs">
                        {editingAgent ? 'تحديث معلومات العون المسجل' : 'إدخال بيانات العون الجديد'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowAddDialog(false); setEditingAgent(null) }}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Dialog form */}
              <form onSubmit={handleSave} className="p-6 space-y-4">
                {/* Name & Surname */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">الاسم <span className="text-red-400">*</span></label>
                    <input
                      type="text"
                      value={form.nom}
                      onChange={(e) => setForm(prev => ({ ...prev, nom: e.target.value }))}
                      placeholder="اسم العون"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5">اللقب</label>
                    <input
                      type="text"
                      value={form.prenom}
                      onChange={(e) => setForm(prev => ({ ...prev, prenom: e.target.value }))}
                      placeholder="لقب العون"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                    />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">رقم الهاتف</label>
                  <input
                    type="tel"
                    value={form.telephone}
                    onChange={(e) => setForm(prev => ({ ...prev, telephone: e.target.value }))}
                    placeholder="06XXXXXXXX"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all"
                    dir="ltr"
                  />
                </div>

                {/* Commune */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">الجماعة الترابية</label>
                  {canSeeAllCommunes ? (
                    <select
                      value={form.commune}
                      onChange={(e) => setForm(prev => ({ ...prev, commune: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    >
                      {COMMUNE_KEYS.map(key => (
                        <option key={key} value={key}>{COMMUNE_LABELS[key]}</option>
                      ))}
                    </select>
                  ) : (
                    <div
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold flex items-center gap-2"
                      style={{ color: COMMUNE_COLORS[user?.commune || ''] || '#475569' }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COMMUNE_COLORS[user?.commune || ''] || '#64748b' }} />
                      {COMMUNE_LABELS[user?.commune || ''] || user?.commune}
                      <span className="text-[10px] text-slate-400 mr-auto">يتم تعيينها تلقائياً</span>
                    </div>
                  )}
                </div>

                {/* Function */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">الوظيفة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {FONCTION_OPTIONS.map(f => (
                      <button
                        key={f.value}
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, fonction: f.value }))}
                        className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border-2 text-xs font-medium transition-all ${
                          form.fonction === f.value
                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm'
                            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        <span className="text-lg">{f.icon}</span>
                        <span>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active toggle */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{form.actif ? '✅' : '⏸️'}</span>
                    <div>
                      <span className="text-sm font-bold text-slate-700">حالة النشاط</span>
                      <p className="text-[11px] text-slate-400">{form.actif ? 'العون نشط ويمكنه القيام بالتدخلات' : 'العون غير نشط حالياً'}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, actif: !prev.actif }))}
                    className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                      form.actif ? 'bg-emerald-500' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-200 ${
                        form.actif ? 'right-1' : 'right-6'
                      }`}
                    />
                  </button>
                </div>

                {/* Submit buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <motion.button
                    type="submit"
                    disabled={isSaving}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <span>{editingAgent ? 'حفظ التعديلات' : 'إضافة العون'}</span>
                      </>
                    )}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => { setShowAddDialog(false); setEditingAgent(null) }}
                    className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== DELETE CONFIRMATION DIALOG ===== */}
      <AnimatePresence>
        {deletingAgent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => setDeletingAgent(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
                  ⚠️
                </div>
                <h3 className="text-lg font-extrabold text-slate-800 mb-2">تأكيد الحذف</h3>
                <p className="text-sm text-slate-500">
                  هل أنت متأكد من حذف العون{' '}
                  <span className="font-bold text-slate-700">{deletingAgent.nom} {deletingAgent.prenom}</span>
                  ؟ لا يمكن التراجع عن هذا الإجراء.
                </p>
              </div>
              <div className="flex items-center gap-3 px-6 pb-6">
                <motion.button
                  onClick={handleDelete}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold text-sm transition-colors"
                >
                  حذف العون
                </motion.button>
                <button
                  onClick={() => setDeletingAgent(null)}
                  className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
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

// ===== AGENT CARD (Desktop) =====
function AgentCard({
  agent,
  index,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  agent: Agent
  index: number
  onEdit: (agent: Agent) => void
  onDelete: (agent: Agent) => void
  onToggleActive: (agent: Agent) => void
}) {
  const communeColor = COMMUNE_COLORS[agent.commune] || '#64748b'
  const fonctionColor = getFonctionColor(agent.fonction)
  const fonctionIcon = getFonctionIcon(agent.fonction)
  const fullName = `${agent.nom} ${agent.prenom}`.trim()
  const avatarLetter = agent.nom.charAt(0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden hover:shadow-md hover:border-emerald-200 transition-all group"
    >
      <div className="p-5">
        {/* Top row: avatar + name + badges */}
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-extrabold text-white shrink-0 shadow-sm"
            style={{ backgroundColor: communeColor }}
          >
            {avatarLetter}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-slate-800 truncate">{fullName}</h4>
              {/* Active badge */}
              {agent.actif ? (
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> نشط
                </span>
              ) : (
                <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-400" /> غير نشط
                </span>
              )}
            </div>

            {/* Phone */}
            {agent.telephone && (
              <div className="flex items-center gap-1.5 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
                <span className="text-xs text-slate-500" dir="ltr">{agent.telephone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Badges row */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {/* Commune badge */}
          {agent.commune && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white"
              style={{ backgroundColor: communeColor }}
            >
              {agent.commune}
            </span>
          )}

          {/* Function badge */}
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white flex items-center gap-1"
            style={{ backgroundColor: fonctionColor }}
          >
            <span>{fonctionIcon}</span>
            {agent.fonction}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100">
          <button
            onClick={() => onToggleActive(agent)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              agent.actif
                ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
            title={agent.actif ? 'تعطيل العون' : 'تفعيل العون'}
          >
            {agent.actif ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 008.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                </svg>
                تعطيل
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                تفعيل
              </>
            )}
          </button>

          <button
            onClick={() => onEdit(agent)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 transition-all"
            title="تعديل"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            تعديل
          </button>

          <button
            onClick={() => onDelete(agent)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all mr-auto"
            title="حذف"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            حذف
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ===== AGENT CARD (Mobile) =====
function AgentCardMobile({
  agent,
  index,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  agent: Agent
  index: number
  onEdit: (agent: Agent) => void
  onDelete: (agent: Agent) => void
  onToggleActive: (agent: Agent) => void
}) {
  const communeColor = COMMUNE_COLORS[agent.commune] || '#64748b'
  const fonctionColor = getFonctionColor(agent.fonction)
  const fonctionIcon = getFonctionIcon(agent.fonction)
  const fullName = `${agent.nom} ${agent.prenom}`.trim()
  const avatarLetter = agent.nom.charAt(0)

  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4"
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-extrabold text-white shrink-0 shadow-sm"
          style={{ backgroundColor: communeColor }}
        >
          {avatarLetter}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-slate-800 truncate">{fullName}</h4>
            <div className={`w-2 h-2 rounded-full shrink-0 ${agent.actif ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {agent.commune && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ backgroundColor: communeColor }}>
                {agent.commune}
              </span>
            )}
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white flex items-center gap-0.5" style={{ backgroundColor: fonctionColor }}>
              {fonctionIcon} {agent.fonction}
            </span>
            {agent.telephone && (
              <span className="text-[10px] text-slate-400" dir="ltr">{agent.telephone}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onToggleActive(agent)}
            className={`p-2 rounded-lg transition-colors ${agent.actif ? 'hover:bg-amber-50 text-amber-600' : 'hover:bg-emerald-50 text-emerald-600'}`}
            title={agent.actif ? 'تعطيل' : 'تفعيل'}
          >
            {agent.actif ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 008.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
          </button>
          <button
            onClick={() => onEdit(agent)}
            className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-slate-500 hover:text-emerald-600"
            title="تعديل"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(agent)}
            className="p-2 hover:bg-red-50 rounded-lg transition-colors text-slate-500 hover:text-red-500"
            title="حذف"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </motion.div>
  )
}
