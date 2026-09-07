'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import {
  OFFICES,
  DOSSIER_STATUS_LABELS, DOSSIER_STATUS_COLORS, DOSSIER_STATUS_FLOW,
  DOSSIER_TYPE_LABELS, DOSSIER_TYPE_ICONS,
  DOSSIER_EVENT_LABELS,
  FOOD_PRIORITY_LABELS, FOOD_PRIORITY_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { Dossier, DossierEvent } from './types'

interface Props {
  dossier: Dossier
  onBack: () => void
  onRefresh: () => void
}

function fmtDateTime(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function DetailTab({ dossier, onBack, onRefresh }: Props) {
  const { setCurrentView } = useAppStore()
  const [statusChange, setStatusChange] = useState('')
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [addingComment, setAddingComment] = useState(false)

  const office = OFFICES[dossier.office]
  const isUrgent = dossier.priority === 'URGENTE' || dossier.priority === 'SANITAIRE'

  // الكيانات المرتبطة
  const linked = useMemo(() => {
    const items: { kind: string; id: string; view: string; label: string }[] = []
    if (dossier.interventionId) items.push({ kind: 'intervention', id: dossier.interventionId, view: 'interventions', label: 'تدخل 3D' })
    if (dossier.complaintId) items.push({ kind: 'complaint', id: dossier.complaintId, view: 'complaints', label: 'شكاية' })
    if (dossier.workOrderId) items.push({ kind: 'workOrder', id: dossier.workOrderId, view: 'workOrders', label: 'أمر عمل' })
    if (dossier.strayReportId) items.push({ kind: 'strayReport', id: dossier.strayReportId, view: 'csvr', label: 'بلاغ حيوان شارد' })
    if (dossier.foodReportId) items.push({ kind: 'foodReport', id: dossier.foodReportId, view: 'food', label: 'بلاغ غذائي' })
    return items
  }, [dossier])

  const handleStatusChange = async () => {
    if (!statusChange || statusChange === dossier.status) return
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: statusChange, reason }),
      })
      if (!res.ok) { toast.error('فشل التحديث'); return }
      toast.success('تم تحديث الحالة')
      setStatusChange('')
      setReason('')
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  const handleAddComment = async () => {
    if (!comment.trim()) return
    setAddingComment(true)
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: comment.trim(), action: 'COMMENT' }),
      })
      if (!res.ok) { toast.error('فشل إضافة التعليق'); return }
      toast.success('تمت إضافة التعليق')
      setComment('')
      onRefresh()
    } catch { toast.error('حدث خطأ') }
    finally { setAddingComment(false) }
  }

  const handleDelete = async () => {
    if (!confirm('هل أنت متأكد من حذف هذا الملف؟')) return
    try {
      const res = await fetch(`/api/dossiers/${dossier.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('فشل الحذف'); return }
      toast.success('تم الحذف')
      onBack()
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  const events = dossier.events || []

  return (
    <div className="space-y-4" dir="rtl">
      {/* زر العودة */}
      <button onClick={onBack} className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
        → العودة للقائمة
      </button>

      {/* بطاقة الترويسة */}
      <div className={`rounded-2xl p-5 text-white shadow-lg ${isUrgent ? 'bg-gradient-to-l from-red-600 to-rose-600' : 'bg-gradient-to-l from-indigo-600 to-violet-600'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{DOSSIER_TYPE_ICONS[dossier.type] || '📁'}</span>
              <h2 className="text-xl font-bold truncate">{dossier.reference}</h2>
            </div>
            <p className="text-sm mt-1 opacity-90">{dossier.title || 'بدون عنوان'}</p>
            {office && <p className="text-xs mt-1 opacity-75">{office.icon} {office.nameAr}</p>}
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <span className="px-3 py-1 rounded-lg text-xs font-bold text-center"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {DOSSIER_STATUS_LABELS[dossier.status] || dossier.status}
            </span>
            <span className="px-3 py-1 rounded-lg text-xs font-bold text-center bg-white/15">
              {FOOD_PRIORITY_LABELS[dossier.priority] || dossier.priority}
            </span>
          </div>
        </div>
      </div>

      {/* شبكة التفاصيل + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* التفاصيل (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {/* بطاقة المعلومات */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 text-sm">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><span>📋</span> معلومات الملف</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><span className="text-slate-500 block text-xs">النوع</span><span className="font-bold">{DOSSIER_TYPE_LABELS[dossier.type] || dossier.type}</span></div>
              <div><span className="text-slate-500 block text-xs">المكتب</span><span className="font-bold">{office ? `${office.icon} ${office.nameAr}` : '—'}</span></div>
              <div><span className="text-slate-500 block text-xs">الجماعة</span><span className="font-bold" style={{ color: COMMUNE_COLORS[dossier.commune] || '#64748b' }}>{COMMUNE_LABELS[dossier.commune] || dossier.commune}</span></div>
              {dossier.quartier && <div><span className="text-slate-500 block text-xs">الحي</span><span className="font-bold">{dossier.quartier}</span></div>}
              {dossier.adresse && <div><span className="text-slate-500 block text-xs">العنوان</span><span>{dossier.adresse}</span></div>}
              {dossier.latitude != null && (
                <div><span className="text-slate-500 block text-xs">الإحداثيات</span>
                  <a href={`https://www.openstreetmap.org/?mlat=${dossier.latitude}&mlon=${dossier.longitude}#map=18/${dossier.latitude}/${dossier.longitude}`}
                    target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline font-mono text-xs" dir="ltr">
                    {dossier.latitude.toFixed(5)}, {dossier.longitude?.toFixed(5)} ↗
                  </a>
                </div>
              )}
              {dossier.assignedToName && <div><span className="text-slate-500 block text-xs">المكلف</span><span className="font-bold">👤 {dossier.assignedToName}</span></div>}
              {dossier.dueDate && <div><span className="text-slate-500 block text-xs">المهلة</span><span className="font-bold">{fmtDate(dossier.dueDate)}</span></div>}
              {dossier.closedAt && <div><span className="text-slate-500 block text-xs">تاريخ الإغلاق</span><span className="font-bold">{fmtDate(dossier.closedAt)}</span></div>}
              <div><span className="text-slate-500 block text-xs">المنشئ</span><span className="font-bold">{dossier.createdByName || '—'}</span></div>
              <div><span className="text-slate-500 block text-xs">تاريخ الإنشاء</span><span>{fmtDateTime(dossier.createdAt)}</span></div>
            </div>
            {dossier.description && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-slate-500 block text-xs mb-1">الوصف</span>
                <p className="text-slate-700">{dossier.description}</p>
              </div>
            )}
            {dossier.notes && (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-slate-500 block text-xs mb-1">ملاحظات</span>
                <p className="text-slate-700 italic">{dossier.notes}</p>
              </div>
            )}
          </div>

          {/* الكيانات المرتبطة */}
          {linked.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-2 text-sm">
              <h3 className="font-bold text-slate-700 flex items-center gap-2"><span>🔗</span> الكيانات المرتبطة ({linked.length})</h3>
              <div className="flex flex-wrap gap-2">
                {linked.map((l) => (
                  <button key={l.kind + l.id}
                    onClick={() => setCurrentView(l.view as any)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition text-xs font-bold text-slate-600">
                    <span>📎</span> {l.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* تغيير الحالة */}
          <div className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 text-sm">
            <h3 className="font-bold text-slate-700 flex items-center gap-2"><span>🔄</span> تغيير الحالة</h3>
            <div className="space-y-2">
              <div className="flex gap-2">
                <select value={statusChange} onChange={(e) => setStatusChange(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                  <option value="">— اختر الحالة الجديدة —</option>
                  {DOSSIER_STATUS_FLOW.map((s) => <option key={s} value={s} disabled={s === dossier.status}>{DOSSIER_STATUS_LABELS[s]}{s === dossier.status ? ' (الحالية)' : ''}</option>)}
                </select>
                <button disabled={!statusChange || statusChange === dossier.status}
                  onClick={handleStatusChange}
                  className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg disabled:opacity-50 hover:bg-indigo-700">
                  تطبيق
                </button>
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)}
                placeholder="سبب التغيير (اختياري)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
            </div>
            {/* أزرار سريعة */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['IN_PROGRESS', 'PENDING_VALIDATION', 'CLOSED'].map((s) => (
                <button key={s} onClick={() => { setStatusChange(s) }}
                  disabled={s === dossier.status}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: (DOSSIER_STATUS_COLORS[s] || '#64748b') + '20', color: DOSSIER_STATUS_COLORS[s] }}>
                  {s === 'IN_PROGRESS' ? '🔄 قيد المعالجة' : s === 'PENDING_VALIDATION' ? '🔍 بانتظار المصادقة' : '✓ إغلاق'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleDelete} className="w-full px-4 py-2 text-sm font-bold text-red-600 border border-red-200 rounded-xl hover:bg-red-50">
            🗑️ حذف الملف
          </button>
        </div>

        {/* Timeline (1/3) */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5">
            <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3"><span>📅</span> السجل الزمني</h3>

            {/* إضافة تعليق */}
            <div className="mb-4 pb-4 border-b border-slate-100">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)}
                placeholder="إضافة تعليق/ملاحظة..."
                rows={2}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none mb-2" />
              <button onClick={handleAddComment} disabled={!comment.trim() || addingComment}
                className="w-full px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {addingComment ? '...' : '➕ إضافة تعليق'}
              </button>
            </div>

            {/* قائمة الأحداث */}
            {events.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">لا توجد أحداث بعد</p>
            ) : (
              <div className="space-y-3">
                {events.map((ev, i) => (
                  <div key={ev.id} className="relative pr-5">
                    {/* الخط العمودي */}
                    {i < events.length - 1 && (
                      <div className="absolute right-[7px] top-4 bottom-[-12px] w-0.5 bg-slate-200" />
                    )}
                    {/* النقطة */}
                    <div className="absolute right-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow"
                      style={{ background: DOSSIER_STATUS_COLORS[ev.toStatus] || '#94a3b8' }} />
                    <div className="bg-slate-50 rounded-lg p-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[11px] font-bold text-slate-600">{DOSSIER_EVENT_LABELS[ev.action] || ev.action}</span>
                        <span className="text-[9px] text-slate-400">{fmtDateTime(ev.createdAt)}</span>
                      </div>
                      {ev.fromStatus && ev.toStatus !== ev.fromStatus && (
                        <div className="flex items-center gap-1 text-[10px] mb-1">
                          <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: (DOSSIER_STATUS_COLORS[ev.fromStatus] || '#64748b') + '20', color: DOSSIER_STATUS_COLORS[ev.fromStatus] }}>{DOSSIER_STATUS_LABELS[ev.fromStatus] || ev.fromStatus}</span>
                          <span className="text-slate-400">←</span>
                          <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: (DOSSIER_STATUS_COLORS[ev.toStatus] || '#64748b') + '20', color: DOSSIER_STATUS_COLORS[ev.toStatus] }}>{DOSSIER_STATUS_LABELS[ev.toStatus] || ev.toStatus}</span>
                        </div>
                      )}
                      {ev.reason && <p className="text-[11px] text-slate-600 mt-1">{ev.reason}</p>}
                      {ev.changedByName && <p className="text-[9px] text-slate-400 mt-1">— {ev.changedByName}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
