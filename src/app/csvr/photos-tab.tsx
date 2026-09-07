'use client'

import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { StrayAnimal } from './types'

interface Photo { id: string; originalName: string; mimeType: string; size: number; isMain: boolean; caption: string | null; uploadedBy: string; createdAt: string }
interface Props { animals: StrayAnimal[] }
const input = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100'

export default function PhotosTab({ animals }: Props) {
  const [animalId, setAnimalId] = useState(animals[0]?.id || '')
  const [photos, setPhotos] = useState<Photo[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [isMain, setIsMain] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => { if (!animalId && animals[0]) setAnimalId(animals[0].id) }, [animalId, animals])
  useEffect(() => {
    if (!animalId) { setPhotos([]); return }
    fetch(`/api/csvr/animals/${encodeURIComponent(animalId)}/photos`).then((response) => response.ok ? response.json() : { photos: [] }).then((data) => setPhotos(data.photos || [])).catch(() => setPhotos([]))
  }, [animalId])

  const loadPhotos = async () => {
    if (!animalId) return
    const response = await fetch(`/api/csvr/animals/${encodeURIComponent(animalId)}/photos`)
    if (response.ok) setPhotos((await response.json()).photos || [])
  }

  const upload = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!animalId || !file) { toast.error('اختر الحيوان والصورة أولاً'); return }
    setSaving(true)
    try {
      const body = new FormData()
      body.set('file', file)
      body.set('caption', caption)
      body.set('isMain', String(isMain))
      const response = await fetch(`/api/csvr/animals/${encodeURIComponent(animalId)}/photos`, { method: 'POST', body })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { toast.error(data.error || 'تعذر رفع الصورة'); return }
      toast.success('تم حفظ الصورة')
      setFile(null); setCaption(''); setIsMain(false)
      const fileInput = document.getElementById('csvr-photo-file') as HTMLInputElement | null
      if (fileInput) fileInput.value = ''
      await loadPhotos()
    } catch { toast.error('حدث خطأ أثناء رفع الصورة') } finally { setSaving(false) }
  }

  const remove = async (photoId: string) => {
    if (!window.confirm('هل تريد حذف هذه الصورة؟')) return
    const response = await fetch(`/api/csvr/photos/${encodeURIComponent(photoId)}`, { method: 'DELETE' })
    if (response.ok) { toast.success('تم حذف الصورة'); await loadPhotos() } else toast.error('تعذر حذف الصورة')
  }

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-violet-700 to-indigo-600 p-5 text-white shadow-lg"><h2 className="text-xl font-extrabold">📸 التوثيق المصوّر</h2><p className="mt-1 text-xs text-violet-50">حفظ صور الحيوانات ميدانياً، تعيين الصورة الرئيسية، وتوثيق الحالة بصرياً.</p></div>
    {animals.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">لا توجد حيوانات مسجلة للتوثيق.</div> : <>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="mb-1 block text-xs font-bold text-slate-600">اختر الحيوان</label><select value={animalId} onChange={(event) => setAnimalId(event.target.value)} className={input}>{animals.map((animal) => <option key={animal.id} value={animal.id}>{animal.csvrNumber} — {animal.species} — {animal.commune}</option>)}</select></div>
      <form onSubmit={upload} className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm sm:grid-cols-2"><input id="csvr-photo-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} className={input} /><input placeholder="وصف الصورة" value={caption} onChange={(event) => setCaption(event.target.value)} className={input} /><label className="flex items-center gap-2 rounded-xl border border-violet-100 bg-white px-3 py-2 text-xs font-bold text-slate-600"><input type="checkbox" checked={isMain} onChange={(event) => setIsMain(event.target.checked)} /> اعتماد كصورة رئيسية</label><button disabled={saving} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الرفع...' : '📤 رفع الصورة'}</button></form>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{photos.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400 sm:col-span-2 lg:col-span-3">لا توجد صور لهذا الحيوان.</div> : photos.map((photo) => <div key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><img src={`/api/csvr/photos/${photo.id}`} alt={photo.caption || photo.originalName} className="h-48 w-full object-cover" /><div className="p-3"><div className="flex items-center justify-between gap-2"><p className="truncate text-xs font-bold text-slate-700">{photo.caption || photo.originalName}</p>{photo.isMain && <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-bold text-violet-700">رئيسية</span>}</div><p className="mt-1 text-[10px] text-slate-400">{photo.uploadedBy} · {new Date(photo.createdAt).toLocaleDateString('ar-MA')}</p><button type="button" onClick={() => remove(photo.id)} className="mt-2 text-[11px] font-bold text-red-600 hover:text-red-700">حذف الصورة</button></div></div>)}</div>
    </>}
  </div>
}
