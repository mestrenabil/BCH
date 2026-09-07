'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { appendTerritoryParams } from '@/lib/geography'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
  allowedCommunes: string[]
  onOpenDossier?: (id: string) => void
  focusDossierId?: string | null
}

type LayerKey = 'environmentalDossiers' | 'pollution' | 'waterPoints' | 'waterMeasurements' | 'waste' | 'sites'
interface EnvironmentPoint { id: string; layer: LayerKey; reference: string; title: string; subtitle: string; lat: number; lng: number; status: string; color: string; icon: string; commune: string; createdAt: string }

const LAYERS: { key: LayerKey; label: string; icon: string; color: string }[] = [
  { key: 'environmentalDossiers', label: 'الملفات البيئية', icon: '🌍', color: '#b45309' },
  { key: 'pollution', label: 'حوادث التلوث', icon: '🏭', color: '#dc2626' },
  { key: 'waterPoints', label: 'نقاط المياه', icon: '💧', color: '#0891b2' },
  { key: 'waterMeasurements', label: 'قياسات المياه', icon: '🌡️', color: '#0e7490' },
  { key: 'waste', label: 'النفايات والنقط السوداء', icon: '🗑️', color: '#f59e0b' },
  { key: 'sites', label: 'المواقع الطبيعية', icon: '🌳', color: '#15803d' },
]

const DEFAULT_VISIBLE: Record<LayerKey, boolean> = { environmentalDossiers: true, pollution: true, waterPoints: true, waterMeasurements: true, waste: true, sites: true }

function fmtDate(value: string) { return value ? new Date(value).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—' }

async function getBoundary(commune: string) {
  try { const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`); if (!response.ok) return null; const data = await response.json(); return data.found ? data : null } catch { return null }
}

export default function EnvironmentMapTab({ selectedCommune, territoryFilter, useTerritoryFilter, allowedCommunes, onOpenDossier, focusDossierId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any>(null)
  const boundariesRef = useRef<any>(null)
  const [points, setPoints] = useState<EnvironmentPoint[]>([])
  const [visible, setVisible] = useState(DEFAULT_VISIBLE)
  const [loading, setLoading] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<EnvironmentPoint | null>(null)
  const communesKey = allowedCommunes.join('|')

  const params = useMemo(() => {
    const query = new URLSearchParams({ layers: LAYERS.map((layer) => layer.key).join(',') })
    if (selectedCommune !== 'ALL') query.set('commune', selectedCommune)
    if (useTerritoryFilter) appendTerritoryParams(query, territoryFilter)
    return query
  }, [selectedCommune, territoryFilter, useTerritoryFilter])

  const load = async () => {
    setLoading(true)
    try { const response = await fetch(`/api/gis/points?${params.toString()}`); if (!response.ok) throw new Error('تعذر تحميل نقاط الخريطة'); const data = await response.json(); setPoints((data.points || []).filter((point: EnvironmentPoint) => LAYERS.some((layer) => layer.key === point.layer) && (allowedCommunes.length === 0 || allowedCommunes.includes(point.commune)))) } catch (error) { toast.error(error instanceof Error ? error.message : 'تعذر تحميل الخريطة') } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [params, communesKey])

  useEffect(() => {
    let cancelled = false
    let mapContainer: HTMLDivElement | null = null
    const stopPageWheel = (event: WheelEvent) => { event.stopPropagation() }
    const init = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      if (typeof window !== 'undefined') (window as unknown as { L?: typeof L }).L = L
      await import('leaflet.markercluster')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current || mapRef.current) return
      mapContainer = containerRef.current
      mapContainer.addEventListener('wheel', stopPageWheel, { passive: false })
      const map = L.map(containerRef.current, { center: [34.05, -6.8], zoom: 12, zoomControl: true, doubleClickZoom: true, scrollWheelZoom: true })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(map)
      const clusterFactory = L as typeof L & { markerClusterGroup?: (options?: Record<string, unknown>) => any }
      markersRef.current = typeof clusterFactory.markerClusterGroup === 'function' ? clusterFactory.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 }) : L.layerGroup()
      markersRef.current.addTo(map)
      boundariesRef.current = L.featureGroup().addTo(map)
      map.on('click', () => setSelectedPoint(null))
      mapRef.current = map
      setTimeout(() => map.invalidateSize(), 100)
      setTimeout(() => map.invalidateSize(), 500)
    }
    void init().catch(() => toast.error('تعذر تشغيل الخريطة البيئية'))
    return () => { cancelled = true; mapContainer?.removeEventListener('wheel', stopPageWheel); if (mapRef.current) { mapRef.current.remove(); mapRef.current = null } }
  }, [])

  useEffect(() => {
    let cancelled = false
    const render = async () => {
      const map = mapRef.current
      if (!map || !markersRef.current || !boundariesRef.current) return
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      markersRef.current.clearLayers()
      boundariesRef.current.clearLayers()
      const filtered = points.filter((point) => visible[point.layer])
      for (const point of filtered) {
        const layer = LAYERS.find((item) => item.key === point.layer)
        const marker = L.marker([point.lat, point.lng], { icon: L.divIcon({ className: 'environment-map-marker', html: `<span style="background:${point.color || layer?.color || '#b45309'}">${point.icon || layer?.icon || '📍'}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] }) })
        marker.bindPopup(`<div dir="rtl" style="min-width:190px"><b>${point.icon || layer?.icon || '📍'} ${point.title || layer?.label || 'سجل بيئي'}</b><br><small>${point.reference} · ${point.commune}</small><br><span>${point.subtitle || 'بدون وصف'}</span><br><small>${fmtDate(point.createdAt)}</small></div>`)
        marker.on('click', () => setSelectedPoint(point))
        markersRef.current.addLayer(marker)
      }
      if (cancelled) return
      const bounds = L.latLngBounds([])
      for (const commune of allowedCommunes) { const boundary = await getBoundary(commune); if (!boundary || cancelled) continue; if (boundary.geometry) L.geoJSON(boundary.geometry, { style: { color: '#b45309', weight: 3, opacity: 0.95, fillColor: '#f59e0b', fillOpacity: 0.08 } }).addTo(boundariesRef.current); if (boundary.bounds) bounds.extend(boundary.bounds) }
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 })
      const focusedPoint = focusDossierId ? points.find((point) => point.layer === 'environmentalDossiers' && point.id === focusDossierId && visible[point.layer]) : null
      if (focusedPoint) {
        map.setView([focusedPoint.lat, focusedPoint.lng], Math.max(map.getZoom(), 17), { animate: true })
        setSelectedPoint(focusedPoint)
      }
    }
    void render().catch(() => undefined)
    return () => { cancelled = true }
  }, [points, visible, communesKey, focusDossierId])

  const counts = useMemo(() => Object.fromEntries(LAYERS.map((layer) => [layer.key, points.filter((point) => point.layer === layer.key).length])) as Record<LayerKey, number>, [points])
  const setAllLayersVisibility = (isVisible: boolean) => setVisible(Object.fromEntries(LAYERS.map((layer) => [layer.key, isVisible])) as Record<LayerKey, boolean>)

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-amber-800 to-orange-500 p-5 text-white shadow-lg"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-extrabold">🗺️ الخريطة البيئية التفاعلية</h3><p className="mt-1 text-xs text-amber-50">عرض الملفات البيئية ونقاط التلوث والنفايات والمواقع الطبيعية داخل حدود جماعة الحساب.</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setAllLayersVisibility(true)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold hover:bg-emerald-600">✅ إظهار الكل</button><button type="button" onClick={() => setAllLayersVisibility(false)} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">◌ إخفاء الكل</button><button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl bg-white/15 px-4 py-2 text-xs font-bold hover:bg-white/25">{loading ? 'جارٍ التحديث...' : '🔄 تحديث يدوي'}</button></div></div></div>
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center gap-2 border-b border-amber-100 bg-gradient-to-l from-amber-50 to-white px-3 py-2">{LAYERS.map((layer) => <label key={layer.key} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${visible[layer.key] ? 'border-amber-300 bg-amber-500 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-400'}`}><input type="checkbox" checked={visible[layer.key]} onChange={(event) => setVisible((current) => ({ ...current, [layer.key]: event.target.checked }))} className="sr-only" /><span>{layer.icon}</span><span>{layer.label}</span><b className="rounded-full bg-black/10 px-1.5 py-0.5 text-[10px]">{counts[layer.key]}</b></label>)}</div><div ref={containerRef} onWheel={(event) => event.stopPropagation()} onWheelCapture={(event) => event.stopPropagation()} className="h-[min(760px,78vh)] min-h-[520px] w-full bg-slate-200 overscroll-contain" style={{ touchAction: 'none' }} />{selectedPoint && <div className="flex flex-wrap items-center gap-3 border-t border-amber-100 bg-amber-50 px-4 py-3 text-xs"><b>{selectedPoint.icon} {selectedPoint.title}</b><span className="text-slate-500">{selectedPoint.reference} · {selectedPoint.commune}</span>{selectedPoint.layer === 'environmentalDossiers' && onOpenDossier && <button type="button" onClick={() => onOpenDossier(selectedPoint.id)} className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-white">فتح الملف ومعالجته</button>}<button type="button" onClick={() => setSelectedPoint(null)} className="mr-auto font-bold text-amber-700">إغلاق</button></div>}</div>
    </div>
    <style jsx>{`.environment-map-marker{background:transparent;border:0}.environment-map-marker span{display:flex;height:34px;width:34px;align-items:center;justify-content:center;border:3px solid #fff;border-radius:999px;box-shadow:0 3px 10px rgba(15,23,42,.28);font-size:17px}`}</style>
  </div>
}
