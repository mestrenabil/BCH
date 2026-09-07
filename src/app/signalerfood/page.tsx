'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import catalogJson from '../../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'

const COMMUNES = Array.from(new Set((catalogJson as TerritoryCatalog).communes.map((c) => (
  c.nameAr || c.name || c.nameFr
)))).sort((a, b) => a.localeCompare(b, 'ar'))

const TYPE_OPTIONS = [
  { value: 'RESTAURANT', label: 'مطاعم ومأكولات', icon: '🍽️' },
  { value: 'EXPIRED_PRODUCT', label: 'منتجات فاسدة', icon: '🛒' },
  { value: 'STREET_VENDOR', label: 'باعة متجولون', icon: '🛍️' },
  { value: 'PREMISES_HYGIENE', label: 'نظافة المحلات', icon: '🗑️' },
]

const ESTABLISHMENT_TYPES = ['مطعم', 'مقهى', 'وجبات سريعة', 'كوالة', 'محل تجاري', 'سوق', 'بائع متجول', 'مخبزة', 'أخرى']

type FormState = {
  declarantName: string
  declarantPhone: string
  commune: string
  quartier: string
  adresse: string
  reportType: string
  establishmentName: string
  establishmentType: string
  description: string
  latitude: string
  longitude: string
  website: string // honeypot
}

const INITIAL_FORM: FormState = {
  declarantName: '',
  declarantPhone: '',
  commune: '',
  quartier: '',
  adresse: '',
  reportType: 'RESTAURANT',
  establishmentName: '',
  establishmentType: '',
  description: '',
  latitude: '',
  longitude: '',
  website: '',
}

export default function PublicFoodReportPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ reference: string; priority: string; photoCount: number } | null>(null)
  const [trackingReference, setTrackingReference] = useState('')
  const [trackingMessage, setTrackingMessage] = useState('')
  const [trackingLoading, setTrackingLoading] = useState(false)

  // صور مرفوعة (معاينة)
  const [photos, setPhotos] = useState<File[]>([])

  // Map state
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)
  const [locationState, setLocationState] = useState('')

  const updateField = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  // ===== اكتشاف الجماعة تلقائياً =====
  const [detectedCommuneInfo, setDetectedCommuneInfo] = useState<{ commune: string; province?: string; region?: string } | null>(null)
  const [detectingCommune, setDetectingCommune] = useState(false)
  const [locationWarning, setLocationWarning] = useState('')

  const detectCommune = async (lat: number, lng: number) => {
    setDetectingCommune(true)
    setLocationWarning('')
    try {
      const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
      const data = await res.json().catch(() => ({}))
      if (data.found && data.commune) {
        updateField('commune', data.commune)
        setDetectedCommuneInfo({ commune: data.commune, province: data.province, region: data.region })
        return data.commune as string
      } else {
        setDetectedCommuneInfo(null)
        setLocationWarning('⚠️ الموقع المحدد خارج نطاق الجماعات المعروفة. يرجى اختيار الجماعة يدوياً.')
        return null
      }
    } catch {
      setDetectedCommuneInfo(null)
      setLocationWarning('تعذر تحديد الجماعة تلقائياً. يرجى اختيارها يدوياً من القائمة.')
      return null
    } finally {
      setDetectingCommune(false)
    }
  }

  // Initialize map
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const L = await import('leaflet')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !mapRef.current || mapInstance) return

      const map = L.map(mapRef.current, { center: [34.05, -6.8], zoom: 12 })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)

      map.on('click', (e: any) => {
        const { lat, lng } = e.latlng
        updateField('latitude', lat.toFixed(6))
        updateField('longitude', lng.toFixed(6))
        setLocationState('✓ تم تحديد الموقع — جارٍ تحديد الجماعة…')
        detectCommune(lat, lng).then((found) => {
          setLocationState(found ? `✓ جماعة ${found}` : 'تم تحديد الموقع — خارج نطاق جماعة معروفة')
        })
      })

      // إصلاح الخريطة الرمادية
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 100)
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 400)
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 1000)

      setMapInstance(map)
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Update marker
  useEffect(() => {
    if (!mapInstance) return
    const update = async () => {
      const L = await import('leaflet')
      if (marker) marker.remove()
      const lat = parseFloat(form.latitude)
      const lng = parseFloat(form.longitude)
      if (!isNaN(lat) && !isNaN(lng)) {
        const icon = L.divIcon({
          html: `<div style="background:#dc2626;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
          className: '', iconSize: [24, 24], iconAnchor: [12, 24],
        })
        const m = L.marker([lat, lng], { icon }).addTo(mapInstance)
        setMarker(m)
        mapInstance.setView([lat, lng], Math.max(mapInstance.getZoom(), 15))
      }
    }
    update()
  }, [form.latitude, form.longitude])

  const captureLocation = () => {
    setLocationState('جارٍ تحديد موقعك…')
    if (!navigator.geolocation) {
      setLocationState('لا يدعم جهازك تحديد الموقع. يمكنك تحديد الموقع على الخريطة.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        updateField('latitude', lat.toFixed(6))
        updateField('longitude', lng.toFixed(6))
        setLocationState('✓ تم تحديد موقعك — جارٍ تحديد الجماعة…')
        detectCommune(lat, lng).then((found) => {
          setLocationState(found ? `✓ موقعك في جماعة ${found}` : '✓ تم تحديد موقعك (خارج نطاق جماعة معروفة)')
        })
      },
      () => setLocationState('تعذر تحديد الموقع تلقائياً. يمكنك تحديده على الخريطة.'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  // معالجة اختيار الصور
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const valid = files.filter((f) => f.type.startsWith('image/') && f.size <= 8 * 1024 * 1024)
    setPhotos((prev) => [...prev, ...valid].slice(0, 5))
  }

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const formData = new FormData()
      formData.append('declarantName', form.declarantName)
      formData.append('declarantPhone', form.declarantPhone)
      formData.append('commune', form.commune)
      formData.append('quartier', form.quartier)
      formData.append('adresse', form.adresse)
      formData.append('reportType', form.reportType)
      formData.append('establishmentName', form.establishmentName)
      formData.append('establishmentType', form.establishmentType)
      formData.append('description', form.description)
      formData.append('latitude', form.latitude)
      formData.append('longitude', form.longitude)
      formData.append('website', form.website) // honeypot

      for (const photo of photos) {
        formData.append('photos', photo)
      }

      const response = await fetch('/api/public/food-reports', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'تعذر إرسال البلاغ.')
        return
      }

      setSuccess({
        reference: data.report.reference,
        priority: data.report.priority,
        photoCount: data.photoCount || 0,
      })
      setTrackingReference(data.report.reference)
      setForm(INITIAL_FORM)
      setLocationState('')
      setDetectedCommuneInfo(null)
      setLocationWarning('')
      setPhotos([])
      if (marker) { marker.remove(); setMarker(null) }
    } catch {
      setError('تعذر الاتصال بالخدمة. يرجى المحاولة لاحقاً.')
    } finally {
      setSubmitting(false)
    }
  }

  const trackReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTrackingMessage('')
    setTrackingLoading(true)

    try {
      const response = await fetch(`/api/public/food-reports?reference=${encodeURIComponent(trackingReference.trim())}`)
      const data = await response.json()
      if (!response.ok) {
        setTrackingMessage(data.error || 'تعذر تتبع البلاغ.')
        return
      }
      const r = data.report
      setTrackingMessage(`${r.statutLabel} — تم الاستلام في ${new Date(r.createdAt).toLocaleDateString('ar-MA')}`)
    } catch {
      setTrackingMessage('تعذر الاتصال بالخدمة.')
    } finally {
      setTrackingLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800" dir="rtl">
      {/* Hero */}
      <section className="bg-gradient-to-l from-rose-900 via-red-800 to-rose-700 px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <a href="/" className="text-sm text-rose-100 hover:text-white">← العودة إلى المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة</a>
            <div className="flex gap-3">
              <a href="/signaler" className="text-sm text-emerald-100 hover:text-white">📢 بلاغ آفات →</a>
              <a href="/signaler-animal" className="text-sm text-amber-100 hover:text-white">🐾 حيوان شارد →</a>
            </div>
          </div>
          <p className="mt-8 text-sm font-semibold text-rose-200">التبليغ عن مخالفات السلامة الغذائية · قسم حفظ الصحة</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">🥗 بلّغ عن مخالفة غذائية</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-rose-50/90">
            ساعد في حماية صحة المواطنين. أبلغ عن المطاعم غير النظيفة، المنتجات الفاسدة، الباعة المتجولين، أو مخالفات النظافة.
            حدد موقع المنشأة على الخريطة وأرفق صوراً إن أمكن.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {success ? (
          <section className="rounded-3xl border border-rose-200 bg-rose-50 p-7 text-center shadow-sm">
            <div className="text-4xl">✓</div>
            <h2 className="mt-2 text-lg font-extrabold text-rose-900">تم تسجيل بلاغك بنجاح</h2>
            <p className="mt-2 text-sm text-rose-800">احتفظ بهذا المرجع لتتبع حالة البلاغ:</p>
            <p className="mt-3 break-all rounded-xl bg-white px-3 py-3 font-mono text-base font-bold tracking-wide text-rose-800">{success.reference}</p>
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-block rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">
                الأولوية: {success.priority === 'SANITAIRE' ? '🚨 إسعاف صحي' : success.priority === 'URGENTE' ? '🔴 عاجلة' : '🔵 عادية'}
              </span>
              {success.photoCount > 0 && (
                <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                  📸 {success.photoCount} صورة مرفقة
                </span>
              )}
            </div>
            <p className="mt-4 text-xs text-rose-700">سيطلع مكتب حفظ الصحة على بلاغك ويتخذ الإجراءات اللازمة.</p>
            <button onClick={() => setSuccess(null)} className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-800">إرسال بلاغ آخر</button>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <form onSubmit={submitReport} className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold">بيانات المخالفة</h2>
                <p className="mt-1 text-sm text-slate-500">الحقول التي تحمل علامة * مطلوبة.</p>
              </div>

              {/* نوع البلاغ */}
              <div>
                <label className="text-sm font-semibold block mb-2">نوع المخالفة *</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TYPE_OPTIONS.map((t) => (
                    <button key={t.value} type="button" onClick={() => updateField('reportType', t.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all ${form.reportType === t.value ? 'border-rose-500 bg-rose-50' : 'border-slate-200 hover:border-rose-300'}`}>
                      <span className="text-2xl">{t.icon}</span>
                      <span className="text-xs font-semibold text-center leading-tight">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* اسم المنشأة + نوعها */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">اسم المنشأة (اختياري)
                  <input value={form.establishmentName} onChange={(e) => updateField('establishmentName', e.target.value)} maxLength={200} placeholder="اسم المطعم/المحل..."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
                </label>
                <label className="text-sm font-semibold">نوع المنشأة
                  <select value={form.establishmentType} onChange={(e) => updateField('establishmentType', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-rose-600">
                    <option value="">— اختر —</option>
                    {ESTABLISHMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              {/* الجماعة + الحي */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  الجماعة *
                  {detectingCommune && <span className="text-[10px] text-rose-600 mr-1 animate-pulse">⏳ جارٍ التحديد…</span>}
                  {detectedCommuneInfo && !detectingCommune && (
                    <span className="text-[10px] text-emerald-600 mr-1">✓ محددة تلقائياً{detectedCommuneInfo.province ? ` · ${detectedCommuneInfo.province}` : ''}</span>
                  )}
                  <select required value={form.commune} onChange={(e) => { updateField('commune', e.target.value); setDetectedCommuneInfo(null) }}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 bg-white outline-none focus:border-rose-600 ${detectedCommuneInfo ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300'}`}>
                    <option value="">— اختر الجماعة —</option>
                    {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="text-sm font-semibold">الحي / العنوان
                  <input value={form.quartier} onChange={(e) => updateField('quartier', e.target.value)} maxLength={120} placeholder="الحي، الشارع..."
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
                </label>
              </div>

              {/* الوصف */}
              <label className="block text-sm font-semibold">وصف المخالفة *
                <textarea required value={form.description} onChange={(e) => updateField('description', e.target.value)} maxLength={2000} rows={4}
                  placeholder="صف المخالفة بالتفصيل: طبيعة المشكل، تاريخ ملاحظته، أي معلومات مفيدة..."
                  className="mt-1.5 w-full resize-y rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
              </label>

              {/* الموقع على الخريطة */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold">📍 موقع المنشأة على الخريطة</label>
                  <button type="button" onClick={captureLocation}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">
                    📡 تحديد موقعي تلقائياً
                  </button>
                </div>

                {detectedCommuneInfo && (
                  <div className="mb-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">🔗</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-900">هذا الموقع يتبع جماعة: {detectedCommuneInfo.commune}</p>
                      <p className="text-[10px] text-emerald-600 mt-0.5">✓ تم ربط البلاغ بهذه الجماعة تلقائياً</p>
                    </div>
                  </div>
                )}
                {detectingCommune && (
                  <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs font-medium text-amber-700">⏳ جارٍ ربط الموقع بالجماعة…</p>
                  </div>
                )}
                {locationWarning && !detectedCommuneInfo && (
                  <div className="mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
                    <span className="text-lg leading-none">⚠️</span>
                    <p className="text-xs font-medium text-red-700 flex-1">{locationWarning}</p>
                  </div>
                )}
                {locationState && !detectedCommuneInfo && !detectingCommune && !locationWarning && (
                  <p className="mb-2 text-xs font-medium text-slate-600">{locationState}</p>
                )}

                <div ref={mapRef} className={`h-64 w-full rounded-xl border-2 overflow-hidden ${detectedCommuneInfo ? 'border-emerald-400' : locationWarning ? 'border-red-300' : 'border-slate-200'}`} style={{ background: '#e5e7eb' }} />
                <p className="mt-1.5 text-xs text-slate-400">انقر على الخريطة لتحديد موقع المنشأة — سيتم ربطه تلقائياً بالجماعة</p>
              </div>

              {/* رفع الصور */}
              <div>
                <label className="text-sm font-semibold block mb-2">📸 صور للمخالفة (اختياري، حد أقصى 5 صور)</label>
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handlePhotoSelect}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-50 file:px-4 file:py-2 file:text-sm file:font-bold file:text-rose-700 hover:file:bg-rose-100" />
                {photos.length > 0 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {photos.map((photo, index) => (
                      <div key={index} className="relative group">
                        <img src={URL.createObjectURL(photo)} alt={`صورة ${index + 1}`} className="w-full h-16 object-cover rounded-lg border border-slate-200" />
                        <button type="button" onClick={() => removePhoto(index)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* بيانات المبلّغ */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">الاسم (اختياري)
                  <input value={form.declarantName} onChange={(e) => updateField('declarantName', e.target.value)} maxLength={100}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
                </label>
                <label className="text-sm font-semibold">رقم الهاتف (اختياري)
                  <input value={form.declarantPhone} onChange={(e) => updateField('declarantPhone', e.target.value)} maxLength={30} type="tel" dir="ltr"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-right outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-100" />
                </label>
              </div>

              {/* Honeypot */}
              <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => updateField('website', e.target.value)} className="absolute h-px w-px opacity-0" aria-hidden="true" />

              {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}

              <button disabled={submitting}
                className="w-full rounded-xl bg-rose-700 px-4 py-3 font-extrabold text-white transition hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'جارٍ إرسال البلاغ…' : '📨 إرسال البلاغ'}
              </button>

              <p className="text-center text-xs text-slate-400">
                تُعالج البلاغات من طرف مكتب حفظ الصحة · بياناتك محمية وسرّية
              </p>
            </form>
          </section>
        )}

        {/* التتبع */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-extrabold">🔍 تتبع البلاغ</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">أدخل المرجع الذي ظهر لك بعد الإرسال.</p>
          <form onSubmit={trackReport} className="mt-4 flex flex-col sm:flex-row gap-3">
            <input value={trackingReference} onChange={(e) => setTrackingReference(e.target.value.toUpperCase())} placeholder="SIG-FOOD-2026-…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 font-mono text-sm outline-none focus:border-rose-600" />
            <button disabled={trackingLoading || !trackingReference.trim()}
              className="rounded-xl border border-rose-700 px-5 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50 whitespace-nowrap">
              {trackingLoading ? 'جارٍ التحقق…' : 'تتبع الحالة'}
            </button>
          </form>
          {trackingMessage && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{trackingMessage}</p>}
        </section>
      </div>
    </main>
  )
}
