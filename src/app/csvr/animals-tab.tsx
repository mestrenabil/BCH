'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import {
  CSVR_SPECIES_ICONS, CSVR_SPECIES_LABELS, CSVR_SPECIES_COLORS,
  CSVR_ANIMAL_STATUS_COLORS, CSVR_ANIMAL_STATUS_LABELS,
  CSVR_SEX_LABELS, CSVR_CAPTURE_STATE_LABELS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'
import type { StrayAnimal, StrayAnimalStatusEntry } from './types'
import LocationPicker from './location-picker'

interface Props {
  animals: StrayAnimal[]
  loading: boolean
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
  mapAllowedCommunes: string[]
}

interface AnimalDossierData {
  statusHistory: StrayAnimalStatusEntry[]
  mission?: { id: string; reference: string; statut: string } | null
  report?: { id: string; reference: string; statut: string; priority: string; commune: string; quartier: string; description: string; createdAt: string } | null
  careEvents: Array<{ id: string; type: string; date: string; practitioner: string; facility: string; diagnosis: string; treatment: string; vaccineName: string; surgeryType: string; notes: string }>
  destinations: Array<{ id: string; type: string; date: string; site: string; structure: string; adopterName: string; notes: string }>
  admissions: Array<{ id: string; admittedAt: string; releasedAt: string | null; boxOrZone: string; generalCondition: string; observation: string; center: { name: string } }>
  transports: Array<{ id: string; departureDate: string; arrivalDate: string | null; vehicle: string; driver: string; destination: string; notes: string }>
  healthAlerts: Array<{ id: string; reportedAt: string; type: string; urgency: string; measureTaken: string; resolvedAt: string | null; notes: string }>
  identifications: Array<{ id: string; type: string; number: string; date: string; operator: string; notes: string }>
  photos: Array<{ id: string; isMain: boolean; caption: string | null; originalName: string }>
  biteCases: Array<{ id: string; reference: string; biteDate: string; status: string; victimName: string; biteLocation: string }>
  followUps: Array<{ id: string; type: string; scheduledDate: string | null; visitDate: string | null; status: string; welfareStatus: string; outcome: string; notes: string }>
}

const STATUS_OPTIONS = [
  'SIGNALISE', 'LOCALISE', 'CAPTURE', 'TRANSPORTE', 'ADMIT_CENTRE', 'QUARANTINE',
  'OBSERVATION', 'SOINS', 'APTE_STERIL', 'STERILISE', 'VACCINE', 'IDENTIFIE',
  'CONVALESCENCE', 'PRET_RELACHER', 'RELACHE', 'ADOPTABLE', 'ADOPTE', 'TRANSFERE',
  'DECEDE', 'CLOTURE',
]
const SPECIES_OPTIONS = ['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER']
const SEX_OPTIONS = ['MALE', 'FEMALE', 'UNKNOWN']
const SIZE_OPTIONS = ['', 'SMALL', 'MEDIUM', 'LARGE']
const CAPTURE_STATE_OPTIONS = ['', 'CALME', 'PEUREUX', 'AGRESSIF', 'BLESSE', 'MALADE', 'AMAIGRI', 'GESTANTE', 'ALLAITANTE']

const SIZE_LABELS: Record<string, string> = { SMALL: 'صغير', MEDIUM: 'متوسط', LARGE: 'كبير', '': '—' }

const emptyForm = {
  species: 'DOG', breed: '', sex: 'UNKNOWN', estimatedAge: '', weight: '', size: '',
  primaryColor: '', secondaryColors: '', distinctiveMarks: '',
  microchipNumber: '', tagNumber: '', collarNumber: '',
  captureDate: '', captureTime: '', captureLocation: '', captureQuartier: '', captureLatitude: '', captureLongitude: '',
  capturedBy: '', captureState: '', captureNotes: '',
  shelterName: '', boxOrCage: '',
}

export default function AnimalsTab({ animals, loading, onRefresh, buildParams, mapAllowedCommunes }: Props) {
  const { user } = useAppStore()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterSpecies, setFilterSpecies] = useState('ALL')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<StrayAnimal | null>(null)
  const [history, setHistory] = useState<StrayAnimalStatusEntry[]>([])
  const [dossier, setDossier] = useState<AnimalDossierData | null>(null)
  const [statusChange, setStatusChange] = useState('')

  const managedCommunes = user?.managedCommunes?.length ? user.managedCommunes : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])

  const filtered = useMemo(() => {
    return animals.filter((a) => {
      if (filterStatus !== 'ALL' && a.statut !== filterStatus) return false
      if (filterSpecies !== 'ALL' && a.species !== filterSpecies) return false
      if (search) {
        const q = search.toLowerCase()
        if (!a.csvrNumber.toLowerCase().includes(q) && !a.microchipNumber.toLowerCase().includes(q) && !a.primaryColor.toLowerCase().includes(q) && !a.captureQuartier.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [animals, filterStatus, filterSpecies, search])

  const openDetail = async (a: StrayAnimal) => {
    setSelected(a)
    setStatusChange('')
    try {
      const res = await fetch(`/api/csvr/animals/${a.id}`)
      if (res.ok) {
        const data = await res.json()
        setDossier(data)
        setHistory(data.statusHistory || [])
      }
    } catch { setDossier(null) }
  }

  const closeDetail = () => { setSelected(null); setDossier(null) }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const params = buildParams()
      const commune = params.get('commune') || managedCommunes[0] || ''
      const body: Record<string, unknown> = {
        ...form,
        commune,
        weight: form.weight ? parseFloat(form.weight) : null,
      }
      if (form.captureDate) body.captureDate = new Date(form.captureDate).toISOString()

      const res = await fetch('/api/csvr/animals', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast.error(err.error || 'فشل الإنشاء'); return }
      toast.success('تم إنشاء سجل الحيوان')
      setShowForm(false)
      onRefresh()
    } catch { toast.error('حدث خطأ') } finally { setSubmitting(false) }
  }

  const handleStatusChange = async () => {
    if (!selected || !statusChange || statusChange === selected.statut) return
    try {
      const res = await fetch(`/api/csvr/animals/${selected.id}/status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toStatus: statusChange, reason: '', notes: '' }),
      })
      if (!res.ok) { toast.error('فشل تغيير الحالة'); return }
      toast.success('تم تحديث الحالة')
      setSelected({ ...selected, statut: statusChange })
      openDetail({ ...selected, statut: statusChange })
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الحيوان؟')) return
    try {
      const res = await fetch(`/api/csvr/animals/${id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('فشل الحذف'); return }
      toast.success('تم الحذف')
      setSelected(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-l from-amber-50 to-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-xl">🐾</span>
        <div>
          <h2 className="text-base font-extrabold text-slate-800">السجل</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">سجل الحيوانات الشاردة ومتابعة حالاتها</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input type="text" placeholder="بحث برقم CSVR، رقاقة، لون..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[120px] px-3 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-300" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الحالات</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_ANIMAL_STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)} className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 bg-white">
          <option value="ALL">كل الأنواع</option>
          {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_SPECIES_LABELS[s]}</option>)}
        </select>
        <button onClick={() => { setForm(emptyForm); setShowForm(true) }} className="px-4 py-2 text-sm font-semibold text-white bg-amber-500 hover:bg-amber-600 rounded-xl shadow-sm whitespace-nowrap">
          + حيوان جديد
        </button>
      </div>

      <div className="text-xs text-slate-500">{filtered.length} حيوان</div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400"><div className="text-4xl mb-2">🐾</div><p className="text-sm">لا توجد حيوانات مسجلة</p></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {filtered.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.02 }}
              onClick={() => openDetail(a)}
              className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex items-start gap-2.5">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0" style={{ backgroundColor: CSVR_SPECIES_COLORS[a.species] + '15' }}>
                  {CSVR_SPECIES_ICONS[a.species]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[9px] text-slate-400">{a.csvrNumber}</div>
                  <div className="text-sm font-semibold text-slate-700 mt-0.5">
                    {a.primaryColor || CSVR_SPECIES_LABELS[a.species]} {a.sex === 'MALE' ? '♂' : a.sex === 'FEMALE' ? '♀' : ''}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{a.estimatedAge || SIZE_LABELS[a.size] || '—'}</div>
                  <span className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style={{ backgroundColor: CSVR_ANIMAL_STATUS_COLORS[a.statut] + '15', color: CSVR_ANIMAL_STATUS_COLORS[a.statut] }}>
                    {CSVR_ANIMAL_STATUS_LABELS[a.statut]}
                  </span>
                </div>
              </div>
              {(a.shelterName || a.boxOrCage) && (
                <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-50 pt-1.5">
                  🏠 {a.shelterName} {a.boxOrCage && `· ${a.boxOrCage}`}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={() => setShowForm(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🐾 حيوان جديد</h2>
              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">النوع</label>
                    <select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                      {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_SPECIES_ICONS[s]} {CSVR_SPECIES_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الجنس</label>
                    <select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                      {SEX_OPTIONS.map((s) => <option key={s} value={s}>{CSVR_SEX_LABELS[s]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الحجم</label>
                    <select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                      {SIZE_OPTIONS.map((s) => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">السلالة/النوع</label>
                    <input value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">العمر المقدر</label>
                    <input value={form.estimatedAge} onChange={(e) => setForm({ ...form, estimatedAge: e.target.value })} placeholder="مثال: 2 سنة" className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="rounded-xl border border-cyan-100 bg-cyan-50/60 p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-700">📍 موقع الاصطياد</div>
                      <div className="mt-0.5 text-[10px] text-slate-500">حدد النقطة من الخريطة لتعبئة الإحداثيات تلقائياً.</div>
                    </div>
                    <LocationPicker
                      latitude={form.captureLatitude}
                      longitude={form.captureLongitude}
                      allowedCommunes={mapAllowedCommunes}
                      onSelect={({ latitude, longitude }) => setForm({ ...form, captureLatitude: String(latitude), captureLongitude: String(longitude) })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] text-slate-600 mb-1 block">خط العرض</label>
                      <input value={form.captureLatitude} onChange={(e) => setForm({ ...form, captureLatitude: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white" placeholder="يُملأ من الخريطة" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-600 mb-1 block">خط الطول</label>
                      <input value={form.captureLongitude} onChange={(e) => setForm({ ...form, captureLongitude: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white" placeholder="يُملأ من الخريطة" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">اللون الرئيسي</label>
                    <input value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الوزن (كغ)</label>
                    <input type="number" step="any" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">العلامات المميزة</label>
                  <input value={form.distinctiveMarks} onChange={(e) => setForm({ ...form, distinctiveMarks: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">رقم البطاقة</label>
                    <input value={form.tagNumber} onChange={(e) => setForm({ ...form, tagNumber: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">رقم الرقاقة</label>
                    <input value={form.microchipNumber} onChange={(e) => setForm({ ...form, microchipNumber: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">تاريخ الاصطياد</label>
                    <input type="date" value={form.captureDate} onChange={(e) => setForm({ ...form, captureDate: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الحي</label>
                    <input value={form.captureQuartier} onChange={(e) => setForm({ ...form, captureQuartier: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">الحالة عند الاصطياد</label>
                    <select value={form.captureState} onChange={(e) => setForm({ ...form, captureState: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200">
                      {CAPTURE_STATE_OPTIONS.map((s) => <option key={s} value={s}>{s ? CSVR_CAPTURE_STATE_LABELS[s] : '—'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">المُصطاد بواسطة</label>
                    <input value={form.capturedBy} onChange={(e) => setForm({ ...form, capturedBy: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">المركز</label>
                    <input value={form.shelterName} onChange={(e) => setForm({ ...form, shelterName: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-600 mb-1 block">القفص</label>
                    <input value={form.boxOrCage} onChange={(e) => setForm({ ...form, boxOrCage: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowForm(false)} className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50">إلغاء</button>
                  <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-medium text-sm hover:bg-amber-600 disabled:opacity-50">
                    {submitting ? 'جارٍ الحفظ...' : 'حفظ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detail + Timeline */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3" onClick={closeDetail}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl p-5 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-mono text-[10px] text-slate-400">{selected.csvrNumber}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-2xl">{CSVR_SPECIES_ICONS[selected.species]}</span>
                    <span className="text-lg font-bold text-slate-800">{selected.primaryColor || CSVR_SPECIES_LABELS[selected.species]}</span>
                    <span className="text-slate-400">{selected.sex === 'MALE' ? '♂' : selected.sex === 'FEMALE' ? '♀' : ''}</span>
                  </div>
                </div>
                <button onClick={closeDetail} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
              </div>

              <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold mb-3" style={{ backgroundColor: CSVR_ANIMAL_STATUS_COLORS[selected.statut] + '15', color: CSVR_ANIMAL_STATUS_COLORS[selected.statut] }}>
                {CSVR_ANIMAL_STATUS_LABELS[selected.statut]}
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">السلالة:</span> <span className="text-slate-700">{selected.breed || '—'}</span></div>
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">العمر:</span> <span className="text-slate-700">{selected.estimatedAge || '—'}</span></div>
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">الوزن:</span> <span className="text-slate-700">{selected.weight ? `${selected.weight} كغ` : '—'}</span></div>
                <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">الحجم:</span> <span className="text-slate-700">{SIZE_LABELS[selected.size] || '—'}</span></div>
                {selected.shelterName && <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">المركز:</span> <span className="text-slate-700">{selected.shelterName}</span></div>}
                {selected.boxOrCage && <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">القفص:</span> <span className="text-slate-700">{selected.boxOrCage}</span></div>}
                {selected.microchipNumber && <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">رقاقة:</span> <span className="text-slate-700">{selected.microchipNumber}</span></div>}
                {selected.tagNumber && <div className="bg-slate-50 rounded-lg p-2"><span className="text-slate-400">بطاقة:</span> <span className="text-slate-700">{selected.tagNumber}</span></div>}
              </div>

              {/* Status change */}
              <div className="bg-amber-50 rounded-xl p-3 mb-3">
                <label className="text-xs text-slate-600 block mb-1.5">تغيير الحالة</label>
                <div className="flex gap-2">
                  <select value={statusChange} onChange={(e) => setStatusChange(e.target.value)} className="flex-1 px-3 py-2 text-sm rounded-lg border border-amber-200 bg-white">
                    <option value="">— اختر الحالة —</option>
                    {STATUS_OPTIONS.filter((s) => s !== selected.statut).map((s) => <option key={s} value={s}>{CSVR_ANIMAL_STATUS_LABELS[s]}</option>)}
                  </select>
                  <button onClick={handleStatusChange} disabled={!statusChange} className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50">تأكيد</button>
                </div>
              </div>

              <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h4 className="text-xs font-extrabold text-emerald-900">📂 الملف الموحّد للحالة</h4>
                  <span className="text-[10px] font-bold text-emerald-700">كل السجلات المرتبطة</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">البلاغ</span><strong className="text-slate-700">{dossier?.report?.reference || 'غير مرتبط'}</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">المهمة</span><strong className="text-slate-700">{dossier?.mission?.reference || 'غير مرتبطة'}</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">الرعاية</span><strong className="text-slate-700">{dossier?.careEvents?.length || 0} سجل</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">الوجهة</span><strong className="text-slate-700">{dossier?.destinations?.length || 0} سجل</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">المركز</span><strong className="text-slate-700">{dossier?.admissions?.length || 0} استقبال</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">النقل</span><strong className="text-slate-700">{dossier?.transports?.length || 0} عملية</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">التنبيهات الصحية</span><strong className="text-slate-700">{dossier?.healthAlerts?.length || 0}</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">العضّات</span><strong className="text-slate-700">{dossier?.biteCases?.length || 0}</strong></div>
                  <div className="rounded-lg bg-white p-2"><span className="block text-slate-400">المتابعات</span><strong className="text-slate-700">{dossier?.followUps?.length || 0}</strong></div>
                </div>
                {dossier?.report && <div className="mt-2 rounded-lg bg-white p-2 text-[10px] text-slate-600">📢 {dossier.report.description || 'بلاغ مرتبط'} · {dossier.report.quartier || dossier.report.commune}</div>}
                {dossier?.careEvents?.slice(0, 3).map((event) => <div key={event.id} className="mt-1.5 rounded-lg bg-white p-2 text-[10px] text-slate-600">🩺 {event.type} · {event.diagnosis || event.treatment || event.vaccineName || event.surgeryType || 'إجراء صحي'} · {new Date(event.date).toLocaleDateString('ar-MA')}</div>)}
                {dossier?.healthAlerts?.slice(0, 2).map((alert) => <div key={alert.id} className="mt-1.5 rounded-lg bg-red-50 p-2 text-[10px] text-red-800">🚨 {alert.type} · {alert.urgency} · {alert.measureTaken || 'تنبيه صحي مسجل'}</div>)}
                {dossier?.destinations?.slice(0, 2).map((destination) => <div key={destination.id} className="mt-1.5 rounded-lg bg-white p-2 text-[10px] text-slate-600">↩️ {destination.type} · {destination.site || destination.structure || destination.adopterName || 'وجهة مسجلة'} · {new Date(destination.date).toLocaleDateString('ar-MA')}</div>)}
                {dossier?.followUps?.slice(0, 2).map((followUp) => <div key={followUp.id} className="mt-1.5 rounded-lg bg-violet-100 p-2 text-[10px] text-violet-900">📅 متابعة · {followUp.status} · {followUp.scheduledDate ? new Date(followUp.scheduledDate).toLocaleDateString('ar-MA') : 'دون موعد'}{followUp.outcome ? ` · ${followUp.outcome}` : ''}</div>)}
              </div>

              {/* Timeline */}
              {history.length > 0 && (
                <div className="mb-3">
                  <h4 className="text-xs font-bold text-slate-600 mb-2">📜 الخط الزمني</h4>
                  <div className="space-y-1.5">
                    {history.map((h, idx) => (
                      <div key={h.id} className="flex gap-2 items-start">
                        <div className="flex flex-col items-center">
                          <div className="w-2.5 h-2.5 rounded-full mt-1" style={{ backgroundColor: CSVR_ANIMAL_STATUS_COLORS[h.toStatus] || '#64748b' }} />
                          {idx < history.length - 1 && <div className="w-px h-6 bg-slate-200" />}
                        </div>
                        <div className="flex-1 pb-1">
                          <div className="text-xs font-semibold text-slate-700">{CSVR_ANIMAL_STATUS_LABELS[h.toStatus] || h.toStatus}</div>
                          <div className="text-[10px] text-slate-400">{new Date(h.createdAt).toLocaleDateString('ar-MA', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })} · {h.changedBy}</div>
                          {h.reason && <div className="text-[10px] text-slate-500">{h.reason}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => handleDelete(selected.id)} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium text-sm hover:bg-red-600">حذف</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
