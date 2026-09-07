'use client'

import { FormEvent, useEffect, useRef, useState } from 'react'
import catalogJson from '../../../public/geography/catalog.json'
import type { TerritoryCatalog } from '@/lib/geography'

const COMMUNES = Array.from(new Set((catalogJson as TerritoryCatalog).communes.map((commune) => (
  commune.nameAr || commune.name || commune.nameFr
)))).sort((first, second) => first.localeCompare(second, 'ar'))

type FormState = {
  declarantName: string
  declarantPhone: string
  commune: string
  quartier: string
  address: string
  species: string
  estimatedCount: string
  description: string
  latitude: string
  longitude: string
  hasYoung: boolean
  isAggressive: boolean
  isInjured: boolean
  isSick: boolean
  rabiesSuspect: boolean
  biteReported: boolean
  nearSchool: boolean
  nearMarket: boolean
  nearDump: boolean
  website: string // honeypot
}

const INITIAL_FORM: FormState = {
  declarantName: '',
  declarantPhone: '',
  commune: '',
  quartier: '',
  address: '',
  species: 'DOG',
  estimatedCount: '1',
  description: '',
  latitude: '',
  longitude: '',
  hasYoung: false,
  isAggressive: false,
  isInjured: false,
  isSick: false,
  rabiesSuspect: false,
  biteReported: false,
  nearSchool: false,
  nearMarket: false,
  nearDump: false,
  website: '',
}

const SPECIES_OPTIONS = [
  { value: 'DOG', label: 'كلب', icon: '🐕' },
  { value: 'CAT', label: 'قط', icon: '🐈' },
  { value: 'OTHER', label: 'حيوان آخر', icon: '🐾' },
]

const STATUS_LABELS: Record<string, string> = {
  NOUVEAU: 'تم استلام البلاغ',
  VERIFICATION: 'قيد التحقق',
  VALIDE: 'تمت المصادقة على البلاغ',
  MISSION_PLANIFIEE: 'تمت برمجة مهمة اصطياد',
  EN_COURS: 'التدخل جارٍ',
  TRAITE: 'تمت معالجة البلاغ',
  PARTIEL: 'معالجة جزئية',
  NON_LOCALISE: 'تعذر تحديد الموقع',
  DOUBLON: 'بلاغ مكرر',
  CLASSE: 'تم أرشفة البلاغ',
}

export default function PublicStrayAnimalPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [locationState, setLocationState] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{ reference: string; priority: string } | null>(null)
  const [trackingReference, setTrackingReference] = useState('')
  const [trackingMessage, setTrackingMessage] = useState('')
  const [trackingLoading, setTrackingLoading] = useState(false)

  // Map state
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [marker, setMarker] = useState<any>(null)

  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  // ===== اكتشاف الجماعة تلقائياً من الإحداثيات =====
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
        // ربط الموقع بالجماعة تلقائياً
        updateField('commune', data.commune)
        setDetectedCommuneInfo({ commune: data.commune, province: data.province, region: data.region })
        return data.commune as string
      } else {
        // النقطة خارج نطاق الجماعات المغربية المعروفة
        setDetectedCommuneInfo(null)
        setLocationWarning('⚠️ الموقع المحدد خارج نطاق الجماعات المعروفة. يرجى اختيار الجماعة يدوياً أو تحديد موقع داخل المغرب.')
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
      const L = (await import('leaflet'))
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

      // مهم: Leaflet يحتاج invalidateSize بعد التحميل ليعيد حساب أبعاد الحاوية.
      // بدون هذا، تظهر الخريطة رمادية فارغة في كثير من الحالات
      // (حاوية تُهيّأ قبل اكتمال layout، أو بعد reflow).
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 100)
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 400)
      setTimeout(() => { if (!cancelled && map) map.invalidateSize() }, 1000)

      setMapInstance(map)
    }
    init()
    return () => { cancelled = true }
  }, [])

  // Update marker when coordinates change
  useEffect(() => {
    if (!mapInstance) return
    const update = async () => {
      const L = await import('leaflet')
      if (marker) marker.remove()
      const lat = parseFloat(form.latitude)
      const lng = parseFloat(form.longitude)
      if (!isNaN(lat) && !isNaN(lng)) {
        const icon = L.divIcon({
          html: `<div style="background:#f59e0b;width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>`,
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
        // اكتشف الجماعة تلقائياً من الموقع الحالي
        detectCommune(lat, lng).then((found) => {
          setLocationState(found ? `✓ موقعك في جماعة ${found}` : '✓ تم تحديد موقعك (خارج نطاق جماعة معروفة)')
        })
      },
      () => setLocationState('تعذر تحديد الموقع تلقائياً. يمكنك تحديده على الخريطة.'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const submitReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const response = await fetch('/api/public/csvr-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'تعذر إرسال البلاغ.')
        return
      }
      setSuccess({ reference: data.report.reference, priority: data.report.priority })
      setForm(INITIAL_FORM)
      setLocationState('')
      setDetectedCommuneInfo(null)
      setLocationWarning('')
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
      const response = await fetch(`/api/public/csvr-reports?reference=${encodeURIComponent(trackingReference.trim())}`)
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
      <section className="bg-gradient-to-l from-amber-600 via-orange-600 to-amber-500 px-4 py-10 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center justify-between">
            <a href="/" className="text-sm text-amber-100 hover:text-white">← العودة إلى منصة BCH</a>
            <div className="flex gap-3">
              <a href="/signaler" className="text-sm text-emerald-100 hover:text-white">📢 بلاغ آفات →</a>
              <a href="/signalerfood" className="text-sm text-rose-100 hover:text-white">🥗 بلاغ غذائي →</a>
            </div>
          </div>
          <p className="mt-8 text-sm font-semibold text-amber-100">التبليغ عن حيوان شارد · برنامج CSVR</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">🐾 بلّغ عن حيوان شارد</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-50/90">
            ساعد بلديتك في إدارة الحيوانات الشاردة. أرسل بلاغك مع تحديد الموقع ليتمكن فريق الاصطياد من التدخل بفعالية.
            سيتم تحديد موقعك على الخريطة ليراها المسؤولون مباشرة.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        {success ? (
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-7 text-center shadow-sm">
            <div className="text-4xl">✓</div>
            <h2 className="mt-2 text-lg font-extrabold text-amber-900">تم تسجيل بلاغك بنجاح</h2>
            <p className="mt-2 text-sm text-amber-800">احتفظ بهذا المرجع لتتبع حالة البلاغ:</p>
            <p className="mt-3 break-all rounded-xl bg-white px-3 py-3 font-mono text-base font-bold tracking-wide text-amber-800">{success.reference}</p>
            <div className="mt-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              الأولوية المُحدَّدة تلقائياً: {
                success.priority === 'SANITAIRE' ? '🚨 إسعاف صحي' :
                success.priority === 'URGENTE' ? '🔴 عاجلة' :
                success.priority === 'HAUTE' ? '🟠 مرتفعة' : '🔵 عادية'
              }
            </div>
            <p className="mt-4 text-xs text-amber-700">سيتمكن مسؤول الجماعة من رؤية موقع بلاغك على الخريطة والتدخل وفقاً للأولوية.</p>
            <button onClick={() => setSuccess(null)} className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">إرسال بلاغ آخر</button>
          </section>
        ) : (
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <form onSubmit={submitReport} className="space-y-5">
              <div>
                <h2 className="text-xl font-extrabold">بيانات الحيوان والموقع</h2>
                <p className="mt-1 text-sm text-slate-500">الحقول التي تحمل علامة * مطلوبة.</p>
              </div>

              {/* Species */}
              <div>
                <label className="text-sm font-semibold block mb-2">نوع الحيوان *</label>
                <div className="grid grid-cols-3 gap-2">
                  {SPECIES_OPTIONS.map((s) => (
                    <button key={s.value} type="button" onClick={() => updateField('species', s.value)}
                      className={`flex flex-col items-center gap-1 rounded-xl border-2 py-3 transition-all ${form.species === s.value ? 'border-amber-500 bg-amber-50' : 'border-slate-200 hover:border-amber-300'}`}>
                      <span className="text-2xl">{s.icon}</span>
                      <span className="text-xs font-semibold">{s.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Count + Commune */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">العدد المقدر *
                  <input required type="number" min="1" max="999" value={form.estimatedCount} onChange={(e) => updateField('estimatedCount', e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
                </label>
                <label className="text-sm font-semibold">
                  الجماعة *
                  {detectingCommune && <span className="text-[10px] text-amber-600 mr-1 animate-pulse">⏳ جارٍ التحديد…</span>}
                  {detectedCommuneInfo && !detectingCommune && (
                    <span className="text-[10px] text-emerald-600 mr-1">✓ محددة تلقائياً{detectedCommuneInfo.province ? ` · ${detectedCommuneInfo.province}` : ''}</span>
                  )}
                  <select required value={form.commune} onChange={(e) => { updateField('commune', e.target.value); setDetectedCommuneInfo(null) }}
                    className={`mt-1.5 w-full rounded-xl border px-3 py-2.5 bg-white outline-none focus:border-amber-600 ${detectedCommuneInfo ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-300'}`}>
                    <option value="">— اختر الجماعة —</option>
                    {COMMUNES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold">📍 الموقع على الخريطة</label>
                  <button type="button" onClick={captureLocation}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100">
                    📡 تحديد موقعي تلقائياً
                  </button>
                </div>

                {/* بطاقة الربط: تُظهر الجماعة المرتبطة بالموقع المحدد */}
                {detectedCommuneInfo && (
                  <div className="mb-2 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2.5 flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">🔗</span>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-emerald-900">
                        هذا الموقع يتبع جماعة: {detectedCommuneInfo.commune}
                      </p>
                      {(detectedCommuneInfo.province || detectedCommuneInfo.region) && (
                        <p className="text-[11px] text-emerald-700 mt-0.5">
                          {detectedCommuneInfo.region ? `الجهة: ${detectedCommuneInfo.region}` : ''}
                          {detectedCommuneInfo.province ? ` · الإقليم: ${detectedCommuneInfo.province}` : ''}
                        </p>
                      )}
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

                <div ref={mapRef} className={`h-64 w-full rounded-xl border-2 overflow-hidden ${detectedCommuneInfo ? 'border-emerald-400' : locationWarning ? 'border-red-300' : 'border-slate-200'}`} style={{ background: '#e5e7eb' }} />
                <p className="mt-1.5 text-xs text-slate-400">انقر على الخريطة لتحديد موقع الحيوان — سيتم ربطه تلقائياً بالجماعة المناسبة</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <input type="number" step="any" value={form.latitude} onChange={(e) => { updateField('latitude', e.target.value); setDetectedCommuneInfo(null) }} placeholder="خط العرض" dir="ltr"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-right outline-none focus:border-amber-600" />
                  <input type="number" step="any" value={form.longitude} onChange={(e) => { updateField('longitude', e.target.value); setDetectedCommuneInfo(null) }} placeholder="خط الطول" dir="ltr"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-right outline-none focus:border-amber-600" />
                </div>
              </div>

              {/* Address + quartier */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">العنوان / معلم قريب *
                  <input required value={form.address} onChange={(e) => updateField('address', e.target.value)} maxLength={300} placeholder="الزنقة، الرقم أو معلم قريب"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
                </label>
                <label className="text-sm font-semibold">الحي
                  <input value={form.quartier} onChange={(e) => updateField('quartier', e.target.value)} maxLength={120}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
                </label>
              </div>

              {/* Description */}
              <label className="block text-sm font-semibold">وصف الحيوان / الحالة *
                <textarea required value={form.description} onChange={(e) => updateField('description', e.target.value)} maxLength={1000} rows={3}
                  placeholder="مثال: كلب بني اللون، يبدو مريضاً، يتجول قرب المدرسة..."
                  className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100 resize-none" />
              </label>

              {/* Behavioral flags */}
              <div>
                <label className="text-sm font-semibold block mb-2">الحالة والمحيط</label>
                <div className="flex flex-wrap gap-2">
                  {([
                    ['isAggressive', '😤 عدواني'],
                    ['isInjured', '🩹 جريح'],
                    ['isSick', '🤒 مريض'],
                    ['hasYoung', '🍼 مع صغار'],
                    ['rabiesSuspect', '🦠 اشتباه الكلب'],
                    ['biteReported', '🦷 حالة عض'],
                    ['nearSchool', '🏫 قرب مدرسة'],
                    ['nearMarket', '🛒 قرب سوق'],
                    ['nearDump', '🗑️ قرب مفرغة'],
                  ] as const).map(([key, label]) => (
                    <button key={key} type="button" onClick={() => updateField(key, !form[key] as never)}
                      className={`rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-all ${form[key] ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-slate-200 text-slate-600 hover:border-amber-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {(form.rabiesSuspect || form.biteReported) && (
                  <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                    ⚠️ سيتم تصنيف بلاغك كأولوية إسعاف صحي نظراً لخطورة الحالة.
                  </p>
                )}
              </div>

              {/* Contact (optional) */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">الاسم (اختياري)
                  <input value={form.declarantName} onChange={(e) => updateField('declarantName', e.target.value)} maxLength={100}
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
                </label>
                <label className="text-sm font-semibold">الهاتف (اختياري)
                  <input value={form.declarantPhone} onChange={(e) => updateField('declarantPhone', e.target.value)} maxLength={30} type="tel" dir="ltr"
                    className="mt-1.5 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-right outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
                </label>
              </div>

              {/* Honeypot */}
              <input type="text" value={form.website} onChange={(e) => updateField('website', e.target.value)} tabIndex={-1} autoComplete="off"
                className="hidden" aria-hidden="true" />

              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

              <button type="submit" disabled={submitting}
                className="w-full rounded-xl bg-amber-600 px-4 py-3 text-base font-bold text-white hover:bg-amber-700 disabled:opacity-50">
                {submitting ? 'جارٍ الإرسال...' : '📨 إرسال البلاغ'}
              </button>
            </form>
          </section>
        )}

        {/* Tracking */}
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-extrabold">🔍 تتبع بلاغ</h2>
          <p className="mt-1 text-sm text-slate-500">أدخل مرجع بلاغك لمعرفة حالته.</p>
          <form onSubmit={trackReport} className="mt-4 flex flex-wrap gap-3">
            <input value={trackingReference} onChange={(e) => setTrackingReference(e.target.value)} placeholder="SIG-CSVR-2026-XXXXXX" dir="ltr"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm text-right outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" />
            <button type="submit" disabled={trackingLoading}
              className="rounded-xl bg-slate-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50">
              {trackingLoading ? '...' : 'تتبع'}
            </button>
          </form>
          {trackingMessage && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{trackingMessage}</p>}
        </section>

        <p className="text-center text-xs text-slate-400">
          يتم معالجة البلاغات من طرف المكتب الجماعي للنظافة · جميع البيانات محمية
        </p>
      </div>
    </main>
  )
}
