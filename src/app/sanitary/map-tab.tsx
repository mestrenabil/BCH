'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { appendTerritoryParams } from '@/lib/geography'
import { filterSanitaryMapPoints } from './metrics'
import { sanitaryLayerVisibility, mergeSanitarySettings, type SanitarySettings } from './settings'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
  allowedCommunes: string[]
  selectedYear: string
}

type LayerKey = 'establishments' | 'inspections' | 'healthCards' | 'samples'
interface SanitaryPoint { id: string; layer: LayerKey; reference: string; title: string; subtitle: string; lat: number; lng: number; status: string; color: string; icon: string; commune: string; createdAt: string }

const LAYERS: { key: LayerKey; label: string; icon: string; color: string }[] = [
  { key: 'establishments', label: 'المنشآت الصحية', icon: '🏪', color: '#0f766e' },
  { key: 'inspections', label: 'التفتيشات', icon: '🔍', color: '#2563eb' },
  { key: 'healthCards', label: 'البطاقات الصحية', icon: '🩺', color: '#7c3aed' },
  { key: 'samples', label: 'العينات الغذائية', icon: '🧪', color: '#0891b2' },
]

const DEFAULT_VISIBLE: Record<LayerKey, boolean> = { establishments: true, inspections: true, healthCards: true, samples: true }

function escapeHtml(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character)) }
function formatDate(value: string) { return value ? new Date(value).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' }

async function getBoundary(commune: string) {
  try { const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`); if (!response.ok) return null; const data = await response.json(); return data.found ? data : null } catch { return null }
}

export default function SanitaryMapTab({ selectedCommune, territoryFilter, useTerritoryFilter, allowedCommunes, selectedYear }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any>(null)
  const boundariesRef = useRef<any>(null)
  const [points, setPoints] = useState<SanitaryPoint[]>([])
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [mapSettings, setMapSettings] = useState<SanitarySettings['map']>(mergeSanitarySettings(undefined).map)
  const [selectedPoint, setSelectedPoint] = useState<SanitaryPoint | null>(null)
  const [loading, setLoading] = useState(false)
  const communesKey = allowedCommunes.join('|')
  const params = useMemo(() => {
    const query = new URLSearchParams({ layers: LAYERS.map((layer) => layer.key).join(',') })
    if (selectedCommune !== 'ALL') query.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(query, territoryFilter)
    if (selectedYear) query.set('year', selectedYear)
    return query
  }, [selectedCommune, selectedYear, territoryFilter, useTerritoryFilter])

  const load = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/gis/points?${params.toString()}`)
      if (!response.ok) throw new Error('تعذر تحميل الخريطة الصحية')
      const data = await response.json()
      setPoints(filterSanitaryMapPoints(data.points || [], LAYERS.map((layer) => layer.key), allowedCommunes) as SanitaryPoint[])
    } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر تحميل الخريطة') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [params, communesKey])

  useEffect(() => {
    const commune = selectedCommune !== 'ALL' ? selectedCommune : allowedCommunes[0] || 'ALL'
    fetch(`/api/settings?commune=${encodeURIComponent(commune)}`).then((response) => response.ok ? response.json() : null).then((data) => {
      const settings = mergeSanitarySettings(data?.settings?.sanitary)
      setMapSettings(settings.map)
      setVisible(sanitaryLayerVisibility(settings))
    }).catch(() => undefined)
  }, [communesKey, selectedCommune])

  useEffect(() => {
    let cancelled = false
    let mapContainer: HTMLDivElement | null = null
    const stopPageWheel = (event: WheelEvent) => event.stopPropagation()
    const init = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      if (cancelled || !containerRef.current || mapRef.current) return
      mapContainer = containerRef.current
      mapContainer.addEventListener('wheel', stopPageWheel, { passive: false })
      const map = L.map(containerRef.current, { center: [34.05, -6.8], zoom: 13, zoomControl: true, doubleClickZoom: true, scrollWheelZoom: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      markersRef.current = L.layerGroup().addTo(map)
      boundariesRef.current = L.featureGroup().addTo(map)
      map.on('click', () => setSelectedPoint(null))
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
      setTimeout(() => map.invalidateSize(), 500)
    }
    void init().catch(() => toast.error('تعذر تشغيل الخريطة الصحية'))
    return () => { cancelled = true; mapContainer?.removeEventListener('wheel', stopPageWheel); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => { if (mapRef.current) mapRef.current.setZoom(mapSettings.defaultZoom) }, [mapSettings.defaultZoom])

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      const map = mapRef.current
      if (!map || !markersRef.current || !boundariesRef.current) return
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      markersRef.current.clearLayers()
      boundariesRef.current.clearLayers()
      for (const point of points.filter((item) => visible[item.layer])) {
        const layer = LAYERS.find((item) => item.key === point.layer)
        const marker = L.marker([point.lat, point.lng], { icon: L.divIcon({ className: 'sanitary-map-marker', html: `<span style="background:${point.color || layer?.color || '#0f766e'}">${point.icon || layer?.icon || '📍'}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) })
        marker.bindPopup(`<div dir="rtl" style="min-width:190px"><b>${escapeHtml(point.icon || layer?.icon || '📍')} ${escapeHtml(point.title || layer?.label)}</b><br><small>${escapeHtml(point.reference)} · ${escapeHtml(point.commune)}</small><br><span>${escapeHtml(point.subtitle || 'بدون وصف')}</span><br><small>${formatDate(point.createdAt)}</small></div>`)
        marker.on('click', () => setSelectedPoint(point))
        markersRef.current.addLayer(marker)
      }
      const bounds = L.latLngBounds([])
      if (mapSettings.showBoundary) for (const commune of allowedCommunes) { const boundary = await getBoundary(commune); if (!boundary || cancelled) continue; if (boundary.geometry) L.geoJSON(boundary.geometry, { style: { color: '#0f766e', weight: 3, opacity: 0.95, fillColor: '#2dd4bf', fillOpacity: 0.08 } }).addTo(boundariesRef.current); if (boundary.bounds) bounds.extend(boundary.bounds) }
      if (!cancelled && bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
    }
    void render().catch(() => undefined)
    return () => { cancelled = true }
  }, [communesKey, mapSettings.showBoundary, points, visible])

  const counts = useMemo(() => Object.fromEntries(LAYERS.map((layer) => [layer.key, points.filter((point) => point.layer === layer.key).length])) as Record<LayerKey, number>, [points])
  const setAllLayersVisibility = (isVisible: boolean) => setVisible(Object.fromEntries(LAYERS.map((layer) => [layer.key, isVisible])) as Record<LayerKey, boolean>)

  return <div className="space-y-4" dir="rtl"><div className="rounded-2xl bg-gradient-to-l from-teal-700 to-cyan-700 p-5 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">🗺️ الخريطة الصحية التفاعلية</h3><p className="mt-1 text-xs text-teal-50">عرض المنشآت والتفتيشات والبطاقات والعينات داخل حدود جماعة الحساب.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setAllLayersVisibility(true)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold hover:bg-emerald-600">✅ إظهار الكل</button><button type="button" onClick={() => setAllLayersVisibility(false)} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">◌ إخفاء الكل</button><button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold hover:bg-white/25">{loading ? 'جارٍ التحديث...' : '🔄 تحديث يدوي'}</button></div></div></div><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b border-teal-100 bg-gradient-to-l from-teal-50 to-white px-3 py-2">{LAYERS.map((layer) => <label key={layer.key} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${visible[layer.key] ? 'border-teal-300 bg-teal-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-400'}`}><input type="checkbox" checked={visible[layer.key]} onChange={(event) => setVisible((current) => ({ ...current, [layer.key]: event.target.checked }))} className="sr-only" /><span>{layer.icon}</span><span>{layer.label}</span><b className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{counts[layer.key]}</b></label>)}</div><div ref={containerRef} onWheel={(event) => event.stopPropagation()} onWheelCapture={(event) => event.stopPropagation()} className="h-[min(760px,78vh)] min-h-[520px] w-full bg-slate-200 overscroll-contain" style={{ touchAction: 'none' }} />{selectedPoint && <div className="flex flex-wrap items-center gap-3 border-t border-teal-100 bg-teal-50 px-4 py-3 text-xs"><b>{selectedPoint.icon} {selectedPoint.title}</b><span className="text-slate-500">{selectedPoint.reference} · {selectedPoint.commune}</span><span className="text-slate-500">{selectedPoint.subtitle}</span><button type="button" onClick={() => setSelectedPoint(null)} className="mr-auto font-bold text-teal-700">إغلاق</button></div>}</div><style jsx>{`.sanitary-map-marker{background:transparent;border:0}.sanitary-map-marker span{display:flex;height:34px;width:34px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:999px;box-shadow:0 3px 10px rgba(15,23,42,.28);font-size:17px}`}</style></div>
}
