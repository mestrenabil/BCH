'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore, type AuthUser } from '@/lib/store'
import {
  COMMUNE_LABELS, COMMUNE_COLORS, COMMUNE_USER_INFO,
} from '@/lib/constants'

// ===== USER MANAGEMENT SECTION =====
interface ManagedUser {
  id: string; username: string; nom: string; commune: string; role: string; actif: boolean; lastLogin: string | null; createdAt: string
}

// ===== USER ROW COMPONENT =====
function UserRow({ user, authUser, canSeeAllCommunes, onEdit, onToggleActive, onDelete, onChangePassword, formatDate }: {
  user: ManagedUser; authUser: AuthUser | null; canSeeAllCommunes: boolean
  onEdit: () => void; onToggleActive: () => void; onDelete: () => void; onChangePassword: () => void
  formatDate: (d: string | null) => string
}) {
  const [showActions, setShowActions] = useState(false)
  const isSelf = user.id === authUser?.id
  const canEdit = canSeeAllCommunes || user.commune === authUser?.commune

  return (
    <div className="flex items-center gap-3 p-3 bg-white hover:bg-slate-50/80 transition-colors group relative">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
        style={{ backgroundColor: (user.commune !== 'ALL' ? COMMUNE_COLORS[user.commune] || '#64748b' : '#475569') + '15' }}>
        {user.role === 'admin' ? '🔐' : '👤'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-slate-700 truncate">{user.nom}</span>
          {isSelf && (
            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[9px] font-bold">أنت</span>
          )}
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span dir="ltr">@{user.username}</span>
          <span className="text-slate-200">•</span>
          <span>{user.commune === 'ALL' ? 'مسؤول عام' : COMMUNE_LABELS[user.commune] || user.commune}</span>
          {user.lastLogin && (
            <>
              <span className="text-slate-200">•</span>
              <span>آخر دخول: {formatDate(user.lastLogin)}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.actif ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {user.actif ? 'نشط' : 'معطل'}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
          {user.role === 'admin' ? 'مسؤول' : 'مسؤول جماعة'}
        </span>
      </div>
      {/* Actions dropdown */}
      {canEdit && (
        <div className="relative">
          <button onClick={() => setShowActions(!showActions)}
            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>
          <AnimatePresence>
            {showActions && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowActions(false)} />
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute left-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1.5 z-20 min-w-[180px]">
                  <button onClick={() => { onEdit(); setShowActions(false) }}
                    className="w-full text-right px-4 py-2 text-sm text-slate-600 hover:bg-blue-50 hover:text-blue-700 flex items-center gap-2 transition-colors">
                    ✏️ تعديل
                  </button>
                  <button onClick={() => { onChangePassword(); setShowActions(false) }}
                    className="w-full text-right px-4 py-2 text-sm text-slate-600 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 transition-colors">
                    🔑 تغيير كلمة المرور
                  </button>
                  <button onClick={() => { onToggleActive(); setShowActions(false) }}
                    className="w-full text-right px-4 py-2 text-sm text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2 transition-colors">
                    {user.actif ? '🚫 تعطيل' : '✅ تفعيل'}
                  </button>
                  {!isSelf && (
                    <>
                      <div className="border-t border-slate-100 my-1" />
                      <button onClick={() => { onDelete(); setShowActions(false) }}
                        className="w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors">
                        🗑️ حذف
                      </button>
                    </>
                  )}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

export function UserManagementSection() {
  const { user: authUser } = useAppStore()
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<ManagedUser | null>(null)
  const [changingPasswordUser, setChangingPasswordUser] = useState<ManagedUser | null>(null)
  const [filterCommune, setFilterCommune] = useState<string>('ALL')
  const [searchTerm, setSearchTerm] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    username: '', password: '', nom: '', commune: 'سلا', role: 'responsable',
  })
  const [editFormData, setEditFormData] = useState({
    nom: '', commune: 'سلا', role: 'responsable', actif: true,
  })
  const [newPassword, setNewPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const canSeeAllCommunes = authUser?.role === 'admin' || authUser?.commune === 'ALL'

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data.users || [])
      }
    } catch { /* */ }
    setIsLoading(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  // Filtered users based on search and commune
  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchTerm || u.nom.includes(searchTerm) || u.username.includes(searchTerm)
    let matchesCommune = filterCommune === 'ALL'
    if (filterCommune === 'ALL_ADMIN') {
      matchesCommune = u.commune === 'ALL'
    } else if (filterCommune !== 'ALL') {
      matchesCommune = u.commune === filterCommune
    }
    return matchesSearch && matchesCommune
  })

  // Group users by commune
  const usersByCommune: Record<string, ManagedUser[]> = {}
  for (const u of filteredUsers) {
    const key = u.commune || 'غير محدد'
    if (!usersByCommune[key]) usersByCommune[key] = []
    usersByCommune[key].push(u)
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          nom: formData.nom,
          commune: canSeeAllCommunes ? formData.commune : authUser?.commune,
          role: canSeeAllCommunes ? formData.role : 'responsable',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم إنشاء المستخدم ${formData.nom} بنجاح`)
      setShowAddForm(false)
      setFormData({ username: '', password: '', nom: '', commune: 'سلا', role: 'responsable' })
      await loadUsers()
    } catch {
      setFormError('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    setFormError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nom: editFormData.nom,
          commune: canSeeAllCommunes ? editFormData.commune : undefined,
          role: canSeeAllCommunes ? editFormData.role : undefined,
          actif: editFormData.actif,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم تحديث المستخدم ${editFormData.nom} بنجاح`)
      setEditingUser(null)
      await loadUsers()
    } catch {
      setFormError('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!deletingUser) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/users/${deletingUser.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم حذف المستخدم ${deletingUser.nom} بنجاح`)
      setDeletingUser(null)
      await loadUsers()
    } catch {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!changingPasswordUser) return
    setFormError('')
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/auth/users/${changingPasswordUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'حدث خطأ')
        return
      }
      toast.success(`تم تغيير كلمة مرور ${changingPasswordUser.nom} بنجاح`)
      setChangingPasswordUser(null)
      setNewPassword('')
    } catch {
      setFormError('حدث خطأ في الاتصال')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleActive = async (u: ManagedUser) => {
    try {
      const res = await fetch(`/api/auth/users/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actif: !u.actif }),
      })
      if (res.ok) {
        toast.success(u.actif ? `تم تعطيل ${u.nom}` : `تم تفعيل ${u.nom}`)
        await loadUsers()
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const openEditForm = (u: ManagedUser) => {
    setEditingUser(u)
    setEditFormData({
      nom: u.nom,
      commune: u.commune,
      role: u.role,
      actif: u.actif,
    })
    setFormError('')
  }

  const handleResetUsers = async () => {
    try {
      await fetch('/api/auth/seed-users', { method: 'POST' })
      await loadUsers()
      toast.success('تم إعادة إنشاء المستخدمين الافتراضيين')
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {/* Header actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-slate-600">{users.length} مستخدم مسجل</span>
          <span className="text-slate-300">|</span>
          <span className="text-xs text-slate-400">{users.filter(u => u.actif).length} نشط</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleResetUsers}
            className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 transition-all border border-slate-200">
            🔄 الافتراضيون
          </button>
          <motion.button onClick={() => { setShowAddForm(true); setFormError(''); setFormData({ username: '', password: '', nom: '', commune: authUser?.commune !== 'ALL' ? authUser?.commune || 'سلا' : 'سلا', role: 'responsable' }) }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            className="px-4 py-1.5 bg-gradient-to-l from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-emerald-200 flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
            إضافة مستخدم
          </motion.button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث بالاسم أو اسم المستخدم..."
            className="w-full pr-9 pl-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300" />
        </div>
        {canSeeAllCommunes && (
          <select value={filterCommune} onChange={(e) => setFilterCommune(e.target.value)}
            className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
            <option value="ALL">كل الجماعات</option>
            <option value="سلا">جماعة سلا</option>
            <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
            <option value="عامر">جماعة عامر</option>
            <option value="ALL_ADMIN">المسؤولون العامون</option>
          </select>
        )}
      </div>

      {/* Users grouped by commune */}
      {canSeeAllCommunes && filterCommune === 'ALL' ? (
        // Admin: show all grouped by commune
        <div className="space-y-4">
          {Object.entries(usersByCommune).sort(([a], [b]) => {
            if (a === 'ALL') return -1
            if (b === 'ALL') return 1
            return a.localeCompare(b)
          }).map(([commune, communeUsers]) => (
            <div key={commune} className="bg-slate-50/70 rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100"
                style={{ backgroundColor: (commune !== 'ALL' && COMMUNE_COLORS[commune] ? COMMUNE_COLORS[commune] : '#475569') + '10' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                  style={{ backgroundColor: (commune !== 'ALL' && COMMUNE_COLORS[commune] ? COMMUNE_COLORS[commune] : '#475569') + '20' }}>
                  {commune === 'ALL' ? '🔐' : (COMMUNE_USER_INFO[commune]?.icon || '🏠')}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-700">
                    {commune === 'ALL' ? 'المسؤولون العامون' : COMMUNE_LABELS[commune] || commune}
                  </div>
                  <div className="text-[10px] text-slate-400">{communeUsers.length} مستخدم</div>
                </div>
              </div>
              <div className="divide-y divide-slate-50">
                {communeUsers.map(u => (
                  <UserRow key={u.id} user={u} authUser={authUser} canSeeAllCommunes={canSeeAllCommunes}
                    onEdit={() => openEditForm(u)} onToggleActive={() => handleToggleActive(u)}
                    onDelete={() => setDeletingUser(u)} onChangePassword={() => { setChangingPasswordUser(u); setNewPassword(''); setFormError('') }}
                    formatDate={formatDate} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Non-admin or filtered: flat list
        <div className="space-y-2">
          {filteredUsers.map(u => (
            <UserRow key={u.id} user={u} authUser={authUser} canSeeAllCommunes={canSeeAllCommunes}
              onEdit={() => openEditForm(u)} onToggleActive={() => handleToggleActive(u)}
              onDelete={() => setDeletingUser(u)} onChangePassword={() => { setChangingPasswordUser(u); setNewPassword(''); setFormError('') }}
              formatDate={formatDate} />
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">لا يوجد مستخدمون مطابقون</div>
          )}
        </div>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowAddForm(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
                <h3 className="font-bold text-base">👤 إضافة مستخدم جديد</h3>
                <p className="text-emerald-200 text-xs mt-0.5">إنشاء حساب جديد للوصول إلى النظام</p>
              </div>
              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">الاسم الكامل *</label>
                  <input type="text" value={formData.nom} onChange={(e) => setFormData({ ...formData, nom: e.target.value })} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    placeholder="مثال: أحمد بنعلي" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">اسم المستخدم *</label>
                  <input type="text" value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    placeholder="مثال: ahmed" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور *</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300"
                    placeholder="4 أحرف على الأقل" />
                </div>
                {canSeeAllCommunes && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الجماعة الترابية</label>
                      <select value={formData.commune} onChange={(e) => setFormData({ ...formData, commune: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                        <option value="ALL">مسؤول عام (كل الجماعات)</option>
                        <option value="سلا">جماعة سلا</option>
                        <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                        <option value="عامر">جماعة عامر</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الدور</label>
                      <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300">
                        <option value="responsable">مسؤول جماعة</option>
                        <option value="admin">مسؤول عام</option>
                      </select>
                    </div>
                  </>
                )}
                {!canSeeAllCommunes && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <div>
                      <div className="text-xs font-bold text-emerald-700">سيتم تعيين هذا المستخدم لجماعة {COMMUNE_LABELS[authUser?.commune || '']}</div>
                      <div className="text-[10px] text-emerald-500">بصفتك مسؤول جماعة، يمكنك فقط إضافة مستخدمين لجماعتك</div>
                    </div>
                  </div>
                )}
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-emerald-600 to-teal-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المستخدم'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingUser(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-blue-700 to-indigo-700 text-white px-6 py-4">
                <h3 className="font-bold text-base">✏️ تعديل المستخدم</h3>
                <p className="text-blue-200 text-xs mt-0.5">@{editingUser.username}</p>
              </div>
              <form onSubmit={handleEditUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">الاسم الكامل</label>
                  <input type="text" value={editFormData.nom} onChange={(e) => setEditFormData({ ...editFormData, nom: e.target.value })} required
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300" />
                </div>
                {canSeeAllCommunes && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الجماعة الترابية</label>
                      <select value={editFormData.commune} onChange={(e) => setEditFormData({ ...editFormData, commune: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
                        <option value="ALL">مسؤول عام (كل الجماعات)</option>
                        <option value="سلا">جماعة سلا</option>
                        <option value="سيدي أبي القنادل">جماعة سيدي أبي القنادل</option>
                        <option value="عامر">جماعة عامر</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">الدور</label>
                      <select value={editFormData.role} onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                        className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300">
                        <option value="responsable">مسؤول جماعة</option>
                        <option value="admin">مسؤول عام</option>
                      </select>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
                  <div>
                    <label className="text-sm font-semibold text-slate-700">الحالة</label>
                    <p className="text-[10px] text-slate-400">{editFormData.actif ? 'المستخدم يمكنه الدخول' : 'المستخدم لا يمكنه الدخول'}</p>
                  </div>
                  <button type="button" onClick={() => setEditFormData({ ...editFormData, actif: !editFormData.actif })}
                    className={`relative w-14 h-8 rounded-full transition-colors duration-300 ${editFormData.actif ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                    <motion.div className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-md"
                      animate={{ right: editFormData.actif ? '0.25rem' : '2rem' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }} />
                  </button>
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setEditingUser(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={isSubmitting}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Password Modal */}
      <AnimatePresence>
        {changingPasswordUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setChangingPasswordUser(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-amber-600 to-orange-600 text-white px-6 py-4">
                <h3 className="font-bold text-base">🔑 تغيير كلمة المرور</h3>
                <p className="text-amber-200 text-xs mt-0.5">{changingPasswordUser.nom} — @{changingPasswordUser.username}</p>
              </div>
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور الجديدة</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
                    placeholder="4 أحرف على الأقل" />
                </div>
                {formError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{formError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setChangingPasswordUser(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={isSubmitting || newPassword.length < 4}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-amber-600 to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingUser(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-red-600 to-rose-600 text-white px-6 py-4">
                <h3 className="font-bold text-base">⚠️ تأكيد الحذف</h3>
              </div>
              <div className="p-6 space-y-4">
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <div className="text-lg mb-2">🗑️</div>
                  <p className="text-sm font-bold text-red-800">
                    هل أنت متأكد من حذف المستخدم
                  </p>
                  <p className="text-base font-extrabold text-red-600 mt-1">{deletingUser.nom}</p>
                  <p className="text-xs text-red-400 mt-0.5">@{deletingUser.username}</p>
                </div>
                <p className="text-xs text-slate-400 text-center">هذا الإجراء لا يمكن التراجع عنه</p>
                <div className="flex gap-2">
                  <button onClick={() => setDeletingUser(null)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button onClick={handleDeleteUser} disabled={isSubmitting}
                    whileTap={{ scale: 0.95 }}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {isSubmitting ? 'جاري الحذف...' : 'حذف نهائي'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Default login info — admin only */}
      {canSeeAllCommunes && (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <h4 className="text-sm font-bold text-amber-800 mb-2">🔑 معلومات الدخول الافتراضية</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {Object.entries(COMMUNE_USER_INFO).map(([key, info]) => (
            <div key={key} className="bg-white rounded-lg p-2.5 border border-amber-100">
              <div className="font-bold text-slate-700 mb-1" style={{ color: info.color }}>
                {COMMUNE_LABELS[key]}
              </div>
              <div className="text-slate-500">المستخدم: <span className="font-mono text-slate-700" dir="ltr">{info.username}</span></div>
              <div className="text-slate-500">كلمة المرور: <span className="font-mono text-slate-700" dir="ltr">{info.password}</span></div>
            </div>
          ))}
          <div className="bg-white rounded-lg p-2.5 border border-amber-100">
            <div className="font-bold text-slate-700 mb-1">🔐 المسؤول العام</div>
            <div className="text-slate-500">المستخدم: <span className="font-mono text-slate-700" dir="ltr">admin</span></div>
            <div className="text-slate-500">كلمة المرور: <span className="font-mono text-slate-700" dir="ltr">admin123</span></div>
          </div>
        </div>
      </div>
      )}
    </div>
  )
}

// ===== USERS VIEW =====
function UsersView() {
  const { user: authUser } = useAppStore()
  const [selfChangePasswordOpen, setSelfChangePasswordOpen] = useState(false)
  const [selfChangePasswordForm, setSelfChangePasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' })
  const [selfChangePasswordError, setSelfChangePasswordError] = useState('')
  const [selfChangePasswordSubmitting, setSelfChangePasswordSubmitting] = useState(false)

  const handleSelfChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSelfChangePasswordError('')
    if (selfChangePasswordForm.newPassword !== selfChangePasswordForm.confirmPassword) {
      setSelfChangePasswordError('كلمة المرور الجديدة غير متطابقة')
      return
    }
    if (selfChangePasswordForm.newPassword.length < 4) {
      setSelfChangePasswordError('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل')
      return
    }
    setSelfChangePasswordSubmitting(true)
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: selfChangePasswordForm.currentPassword,
          newPassword: selfChangePasswordForm.newPassword,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSelfChangePasswordError(data.error || 'حدث خطأ')
        return
      }
      toast.success('تم تغيير كلمة المرور بنجاح')
      setSelfChangePasswordOpen(false)
      setSelfChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch {
      setSelfChangePasswordError('حدث خطأ في الاتصال')
    } finally {
      setSelfChangePasswordSubmitting(false)
    }
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6">
      {/* Title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg shadow-emerald-200">
            👥
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">إدارة المستخدمين</h2>
            <p className="text-slate-500 text-sm mt-0.5">الحسابات المرخصة للدخول لكل جماعة ترابية</p>
          </div>
        </div>
      </motion.div>

      {/* Current user card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="bg-gradient-to-l from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl shadow-inner"
            style={{ backgroundColor: (authUser?.commune !== 'ALL' ? COMMUNE_COLORS[authUser?.commune || ''] || '#475569' : '#475569') + '20' }}>
            {authUser?.role === 'admin' ? '🔐' : '👤'}
          </div>
          <div className="flex-1">
            <div className="font-bold text-slate-700">{authUser?.nom}</div>
            <div className="text-xs text-slate-400">
              @{authUser?.username} • {authUser?.commune === 'ALL' ? 'مسؤول عام — صلاحية كاملة' : COMMUNE_LABELS[authUser?.commune || ''] || authUser?.commune}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => { setSelfChangePasswordOpen(true); setSelfChangePasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' }); setSelfChangePasswordError('') }}
              className="bg-gradient-to-l from-amber-500 to-orange-500 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-lg shadow-amber-200 flex items-center gap-1.5 hover:from-amber-600 hover:to-orange-600 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              تغيير كلمة المرور
            </motion.button>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-emerald-600">متصل</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* User management section */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-l from-emerald-700 to-teal-700 text-white px-6 py-4">
          <h3 className="font-bold text-base">👥 الحسابات المرخصة</h3>
          <p className="text-emerald-200 text-xs mt-0.5">
            {authUser?.role === 'admin'
              ? 'يمكنك إدارة جميع حسابات المستخدمين عبر الجماعات'
              : `يمكنك إدارة حسابات مستخدمي جماعة ${COMMUNE_LABELS[authUser?.commune || '']} فقط`}
          </p>
        </div>
        <div className="p-6">
          <UserManagementSection />
        </div>
      </motion.div>

      {/* Self Change Password Dialog */}
      <AnimatePresence>
        {selfChangePasswordOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelfChangePasswordOpen(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="bg-gradient-to-l from-amber-600 to-orange-600 text-white px-6 py-4">
                <h3 className="font-bold text-base">🔑 تغيير كلمة المرور</h3>
                <p className="text-amber-200 text-xs mt-0.5">{authUser?.nom} — @{authUser?.username}</p>
              </div>
              <form onSubmit={handleSelfChangePassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور الحالية</label>
                  <input type="password" value={selfChangePasswordForm.currentPassword}
                    onChange={(e) => setSelfChangePasswordForm({ ...selfChangePasswordForm, currentPassword: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
                    placeholder="أدخل كلمة المرور الحالية" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">كلمة المرور الجديدة</label>
                  <input type="password" value={selfChangePasswordForm.newPassword}
                    onChange={(e) => setSelfChangePasswordForm({ ...selfChangePasswordForm, newPassword: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
                    placeholder="4 أحرف على الأقل" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">تأكيد كلمة المرور الجديدة</label>
                  <input type="password" value={selfChangePasswordForm.confirmPassword}
                    onChange={(e) => setSelfChangePasswordForm({ ...selfChangePasswordForm, confirmPassword: e.target.value })} required dir="ltr"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-300"
                    placeholder="أعد إدخال كلمة المرور الجديدة" />
                </div>
                {selfChangePasswordError && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-xs font-medium">{selfChangePasswordError}</div>
                )}
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setSelfChangePasswordOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
                    إلغاء
                  </button>
                  <motion.button type="submit" disabled={selfChangePasswordSubmitting}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-l from-amber-600 to-orange-600 text-white rounded-xl text-sm font-bold shadow-lg disabled:opacity-50">
                    {selfChangePasswordSubmitting ? 'جاري التغيير...' : 'تغيير كلمة المرور'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default UsersView
