'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import {
  FOOD_TYPE_ICONS, FOOD_TYPE_COLORS,
  FOOD_TYPE_LABELS,
  FOOD_REPORT_STATUS_LABELS, FOOD_REPORT_STATUS_COLORS,
} from '@/lib/constants'
import type { FoodReport } from './types'

interface Props {
  reports: FoodReport[]
  selectedCommune: string
  allowedCommunes: string[]
  onRefresh: () => void
}

// الأنواع الأربعة + الترتيب
const REPORT_TYPES = ['RESTAURANT', 'EXPIRED_PRODUCT', 'STREET_VENDOR', 'PREMISES_HYGIENE'] as const

export default function MapTab({ reports, selectedCommune, allowedCommunes, onRefresh }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const boundaryLayerRef = useRef<any>(null)
  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>({
    RESTAURANT: true,
    EXPIRED_PRODUCT: true,
    STREET_VENDOR: true,
    PREMISES_HYGIENE: true,
  })

  // تهيئة الخريطة مرة واحدة
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      if (typeof window !== 'undefined') (window as unknown as { L?: typeof L }).L = L
      await import('leaflet.markercluster')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current || mapRef.current) return

      mapRef.current = L.map(containerRef.current, {
        center: [34.05, -6.8], zoom: 12, zoomControl: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(mapRef.current)

      const leafletWithClusters = L as typeof L & { markerClusterGroup?: (options?: Record<string, unknown>) => any }
      markersLayerRef.current = typeof leafletWithClusters.markerClusterGroup === 'function'
        ? leafletWithClusters.markerClusterGroup({
          maxClusterRadius: 46,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          iconCreateFunction: (cluster: { getChildCount: () => number }) => {
            const count = cluster.getChildCount()
            const size = count < 10 ? 40 : count < 50 ? 48 : 56
            const color = count < 10 ? '#e11d48' : count < 50 ? '#d97706' : '#dc2626'
            return L.divIcon({
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};color:white;font:800 14px system-ui;border:3px solid white;box-shadow:0 3px 14px rgba(15,23,42,.3);">${count}</div>`,
              className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
            })
          },
        })
        : L.layerGroup()
      markersLayerRef.current.addTo(mapRef.current)

      // إصلاح الخريطة الرمادية
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 100)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 400)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 1000)
    }
    init()
    return () => {
      cancelled = true
      if (mapRef.current) mapRef.current.remove()
      mapRef.current = null
      markersLayerRef.current = null
      boundaryLayerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!mapRef.current || allowedCommunes.length === 0) {
      if (boundaryLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(boundaryLayerRef.current)
        boundaryLayerRef.current = null
      }
      return
    }
    let cancelled = false
    const drawBoundary = async () => {
      try {
        const leafletModule = await import('leaflet')
        const L = leafletModule.default
        if (boundaryLayerRef.current) mapRef.current.removeLayer(boundaryLayerRef.current)
        const group = L.featureGroup()
        const bounds = L.latLngBounds([])
        await Promise.all(allowedCommunes.map(async (commune) => {
          const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`)
          if (!response.ok) return
          const data = await response.json() as { geometry?: GeoJSON.Geometry; bounds?: [[number, number], [number, number]] }
          if (cancelled || !data.geometry || !mapRef.current) return
          const boundary = L.geoJSON({ type: 'Feature', properties: { commune }, geometry: data.geometry } as GeoJSON.Feature, {
            style: { color: '#047857', weight: 5, opacity: 1, fillColor: '#10b981', fillOpacity: 0.12, dashArray: '10 6' },
            interactive: false,
          })
          group.addLayer(boundary)
          if (data.bounds) bounds.extend(data.bounds)
        }))
        if (cancelled || !mapRef.current || group.getLayers().length === 0) return
        group.addTo(mapRef.current)
        group.bringToFront()
        boundaryLayerRef.current = group
        if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [45, 45], maxZoom: allowedCommunes.length === 1 ? 14 : 12 })
      } catch {
        return
      }
    }
    void drawBoundary()
    return () => {
      cancelled = true
      if (boundaryLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(boundaryLayerRef.current)
        boundaryLayerRef.current = null
      }
    }
  }, [allowedCommunes])

  // البلاغات ذات الإحداثيات، مع تطبيق فلتر الأنواع
  const geoReports = useMemo(
    () => reports.filter(
      (r) => r.latitude != null && r.longitude != null && visibleTypes[r.reportType] !== false && (allowedCommunes.length === 0 || allowedCommunes.includes(r.commune))
    ),
    [reports, visibleTypes, allowedCommunes]
  )

  // رسم العلامات عند تغيير البلاغات أو الفلاتر
  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current || !markersLayerRef.current) return

      markersLayerRef.current.clearLayers()

      const points: [number, number][] = []
      for (const r of geoReports) {
        if (r.latitude == null || r.longitude == null) continue

        const typeColor = FOOD_TYPE_COLORS[r.reportType] || '#dc2626'
        const statusColor = FOOD_REPORT_STATUS_COLORS[r.statut] || typeColor
        const icon = FOOD_TYPE_ICONS[r.reportType] || '📢'
        const typeLabel = FOOD_TYPE_LABELS[r.reportType] || r.reportType
        const statusLabel = FOOD_REPORT_STATUS_LABELS[r.statut] || r.statut

        // علامة دائرية كبيرة تعرض أيقونة النوع داخلها + حلقة بلون الحالة
        const markerHtml = `
          <div style="position:relative;width:38px;height:38px;">
            <div style="position:absolute;inset:0;border-radius:50% 50% 50% 0;transform:rotate(-45deg);
                        background:${typeColor};border:3px solid ${statusColor};
                        box-shadow:0 2px 6px rgba(0,0,0,0.4);"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
                        font-size:17px;line-height:1;pointer-events:none;">${icon}</div>
          </div>`

        const divIcon = L.divIcon({
          html: markerHtml, className: '', iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -36],
        })

        const marker = L.marker([r.latitude, r.longitude], { icon: divIcon })
          .addTo(markersLayerRef.current)

        const photosBadge = (r.photos?.length ?? 0) > 0
          ? `<div style="font-size:11px;color:#64748b;margin-top:4px;">📸 ${r.photos?.length ?? 0} صورة</div>`
          : ''

        const sourceBadge = r.source === 'PUBLIC'
          ? `<span style="font-size:10px;background:#fef3c7;color:#92400e;padding:1px 6px;border-radius:6px;">عمومي</span>`
          : `<span style="font-size:10px;background:#dbeafe;color:#1e40af;padding:1px 6px;border-radius:6px;">داخلي</span>`

        marker.bindPopup(`
          <div style="min-width:240px;font-family:inherit;direction:rtl;">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
              <span style="font-size:20px;">${icon}</span>
              <span style="font-weight:800;font-size:13px;">${r.reference}</span>
            </div>
            <div style="font-size:11px;color:#475569;margin-bottom:4px;">
              <strong>${typeLabel}</strong>
              <span style="margin-right:6px;">• ${sourceBadge}</span>
            </div>
            ${r.establishmentName ? `<div style="font-size:12px;color:#334155;margin-top:4px;">🏪 ${r.establishmentName}</div>` : ''}
            <div style="font-size:11px;color:#64748b;margin-top:4px;">📍 ${r.quartier || r.adresse || r.commune || '—'}</div>
            ${r.description ? `<div style="font-size:11px;color:#475569;margin-top:6px;padding:6px;background:#f8fafc;border-radius:6px;">${(r.description).slice(0, 120)}${r.description.length > 120 ? '…' : ''}</div>` : ''}
            <div style="display:flex;align-items:center;gap:6px;margin-top:8px;">
              <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;background:${statusColor};color:white;">${statusLabel}</span>
              ${photosBadge}
            </div>
          </div>
        `)
        points.push([r.latitude, r.longitude])
      }

      if (points.length > 0 && mapRef.current && allowedCommunes.length === 0) {
        mapRef.current.fitBounds(points, { padding: [50, 50], maxZoom: 15 })
      }
    }
    draw()
    return () => { cancelled = true }
  }, [geoReports, allowedCommunes])

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => ({ ...prev, [type]: !prev[type] }))
  }

  // إحصائيات لكل نوع
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const r of reports) {
      if (r.latitude != null) counts[r.reportType] = (counts[r.reportType] || 0) + 1
    }
    return counts
  }, [reports])

  return (
    <div className="space-y-3" dir="rtl">
      {/* فلاتر الأنواع — أزرار تفاعلية */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onRefresh}
          className="rounded-xl border border-slate-200 bg-slate-700 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800"
          title="تحديث بيانات الخريطة يدوياً"
        >
          ↻ تحديث
        </button>
        <button
          onClick={() => setVisibleTypes(Object.fromEntries(REPORT_TYPES.map((type) => [type, true])))}
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
        >
          إظهار الكل
        </button>
        <button
          onClick={() => setVisibleTypes(Object.fromEntries(REPORT_TYPES.map((type) => [type, false])))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
        >
          إخفاء الكل
        </button>
        {REPORT_TYPES.map((type) => {
          const active = visibleTypes[type] !== false
          const count = typeCounts[type] || 0
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-xs font-bold transition-all ${
                active
                  ? 'border-transparent text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-400 opacity-60 hover:opacity-100'
              }`}
              style={active ? { background: FOOD_TYPE_COLORS[type] } : {}}
              title={active ? 'إخفاء' : 'إظهار'}
            >
              <span className="text-base">{FOOD_TYPE_ICONS[type]}</span>
              <span>{FOOD_TYPE_LABELS[type]}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] ${
                  active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* الخريطة */}
      <div
        ref={containerRef}
        className="w-full h-[60vh] min-h-[400px] rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
        style={{ background: '#e5e7eb' }}
      />

      <p className="text-xs text-slate-400 text-center">
        عرض {geoReports.length} بلاغ غذائي على الخريطة
        {reports.filter((r) => r.latitude != null).length !== geoReports.length && (
          <span className="text-slate-500"> (من أصل {reports.filter((r) => r.latitude != null).length})</span>
        )}
      </p>
    </div>
  )
}
