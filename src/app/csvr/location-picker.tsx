'use client'

import React, { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

interface LocationPickerProps {
  latitude?: string | number | null
  longitude?: string | number | null
  onSelect: (coordinates: { latitude: number; longitude: number }) => void
  allowedCommunes?: string[]
  label?: string
  title?: string
  description?: string
  className?: string
}

function parseCoordinate(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export default function LocationPicker({ latitude, longitude, onSelect, allowedCommunes = [], label = 'تحديد الموقع من الخريطة', title = 'تحديد موقع الحيوان', description = 'النقر يتم بمؤشر دقيق؛ ستظهر النقطة الزرقاء مع الإحداثيات، ويمكنك أيضاً استعمال موقعك الحالي.', className = '' }: LocationPickerProps) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const locateCurrentPositionRef = useRef<(() => void) | null>(null)
  const callbackRef = useRef(onSelect)
  const coordinatesRef = useRef({ latitude, longitude })
  const allowedCommunesKey = allowedCommunes.join('|')

  useEffect(() => { callbackRef.current = onSelect }, [onSelect])
  useEffect(() => { coordinatesRef.current = { latitude, longitude } }, [latitude, longitude])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    const init = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current || mapRef.current) return

      const currentLatitude = parseCoordinate(coordinatesRef.current.latitude)
      const currentLongitude = parseCoordinate(coordinatesRef.current.longitude)
      const hasCurrentLocation = currentLatitude !== null && currentLongitude !== null
      const scopeCommunes = Array.from(new Set(allowedCommunes.filter(Boolean)))
      const communeDataList = await Promise.all(scopeCommunes.map(async (scopeCommune) => {
        try {
          const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(scopeCommune)}`)
          return response.ok ? await response.json() as { commune?: string; lat?: number; lng?: number; bounds?: [[number, number], [number, number]]; geometry?: GeoJSON.Geometry } : null
        } catch { return null }
      }))
      if (cancelled || !containerRef.current || mapRef.current) return
      const scopeBounds = L.latLngBounds([])
      for (const communeData of communeDataList) if (communeData?.bounds) scopeBounds.extend(communeData.bounds)
      const hasScopeBounds = scopeBounds.isValid()
      const firstCommune = communeDataList.find((item) => item?.lat != null && item?.lng != null)
      const center: [number, number] = firstCommune?.lat != null && firstCommune.lng != null
        ? [firstCommune.lat, firstCommune.lng]
        : hasCurrentLocation
        ? [currentLatitude, currentLongitude]
        : [31.8, -6.3]
      const map = L.map(containerRef.current, { center, zoom: firstCommune ? (scopeCommunes.length === 1 ? 13 : 10) : hasCurrentLocation ? 16 : 6, zoomControl: true, doubleClickZoom: false })
      mapRef.current = map
      containerRef.current.style.cursor = 'crosshair'
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(map)
      if (hasScopeBounds) map.fitBounds(scopeBounds, { padding: [24, 24], maxZoom: scopeCommunes.length === 1 ? 14 : 12 })

      const boundaryLayer = L.featureGroup()
      for (const communeData of communeDataList) {
        if (!communeData?.geometry) continue
        L.geoJSON({ type: 'Feature', properties: { commune: communeData.commune }, geometry: communeData.geometry } as GeoJSON.Feature, {
          style: { color: '#0891b2', weight: 5, opacity: 1, fillColor: '#06b6d4', fillOpacity: 0.1, dashArray: '10 6' },
        }).addTo(boundaryLayer)
      }
      if (boundaryLayer.getLayers().length) boundaryLayer.addTo(map)

      const placeMarker = (nextLatitude: number, nextLongitude: number, focus = true) => {
        if (markerRef.current) markerRef.current.remove()
        markerRef.current = L.circleMarker([nextLatitude, nextLongitude], {
          radius: 10,
          color: '#ffffff',
          weight: 3,
          fillColor: '#0891b2',
          fillOpacity: 1,
          bubblingMouseEvents: false,
        }).addTo(map)
        markerRef.current.bindTooltip(`النقطة المحددة<br><b>${nextLatitude.toFixed(6)}, ${nextLongitude.toFixed(6)}</b>`, {
          permanent: true,
          direction: 'top',
          offset: [0, -8],
          className: 'csvr-location-tooltip',
        }).openTooltip()
        if (focus) map.setView([nextLatitude, nextLongitude], Math.max(map.getZoom(), 16))
        const coordinates = { latitude: Number(nextLatitude.toFixed(6)), longitude: Number(nextLongitude.toFixed(6)) }
        setSelected(coordinates)
        callbackRef.current(coordinates)
      }

      const isLocationAllowed = async (nextLatitude: number, nextLongitude: number) => {
        if (!scopeCommunes.length) return true
        try {
          const response = await fetch(`/api/geocode/reverse?lat=${nextLatitude}&lng=${nextLongitude}`)
          const data = response.ok ? await response.json() as { found?: boolean; commune?: string } : null
          if (!data?.found || !data.commune || !scopeCommunes.includes(data.commune)) {
            toast.error('موقعك الحالي خارج حدود جماعة الحساب')
            return false
          }
          return true
        } catch {
          toast.error('تعذر التحقق من نطاق موقعك الحالي')
          return false
        }
      }

      const locateCurrentPosition = () => {
        if (!navigator.geolocation) {
          toast.error('الجهاز لا يدعم تحديد الموقع الجغرافي')
          return
        }
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            if (cancelled || !mapRef.current) return
            const nextLatitude = position.coords.latitude
            const nextLongitude = position.coords.longitude
            if (await isLocationAllowed(nextLatitude, nextLongitude)) placeMarker(nextLatitude, nextLongitude)
          },
          () => toast.error('تعذر الوصول إلى موقعك الحالي. تحقق من صلاحية GPS.'),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
        )
      }
      locateCurrentPositionRef.current = locateCurrentPosition

      if (hasCurrentLocation) placeMarker(currentLatitude, currentLongitude, !hasScopeBounds)
      else locateCurrentPosition()
      map.on('click', async (event: { latlng: { lat: number; lng: number } }) => {
        if (!(await isLocationAllowed(event.latlng.lat, event.latlng.lng))) return
        placeMarker(event.latlng.lat, event.latlng.lng)
      })
      map.on('dblclick', () => map.zoomIn(1, { animate: true }))
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 100)
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 400)
      setTimeout(() => { if (!cancelled) map.invalidateSize() }, 1000)
    }

    void init()
    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        markerRef.current = null
      }
      locateCurrentPositionRef.current = null
    }
  }, [allowedCommunesKey, open])

  const currentLatitude = parseCoordinate(latitude)
  const currentLongitude = parseCoordinate(longitude)
  const visibleCoordinates = selected || (currentLatitude !== null && currentLongitude !== null ? { latitude: currentLatitude, longitude: currentLongitude } : null)

  return (
    <>
      <button type="button" onClick={() => { setSelected(null); setOpen(true) }} className={`rounded-xl border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-bold text-cyan-700 transition hover:bg-cyan-100 ${className}`}>
        🗺️ {label}
      </button>
      {open && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">{title}</h3>
                <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => locateCurrentPositionRef.current?.()} className="rounded-lg bg-cyan-50 px-2.5 py-1.5 text-[11px] font-bold text-cyan-700 hover:bg-cyan-100">📍 موقعي الحالي</button>
                <button type="button" onClick={() => setOpen(false)} className="text-xl text-slate-400 hover:text-slate-700">×</button>
              </div>
            </div>
            <div ref={containerRef} className="h-[min(62vh,460px)] min-h-[320px] w-full" />
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
              <div className="text-xs text-slate-600">
                {visibleCoordinates ? `✓ النقطة المحددة — خط العرض: ${visibleCoordinates.latitude} · خط الطول: ${visibleCoordinates.longitude}` : 'انقر على الموقع المطلوب داخل حدود الحساب'}
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-700">اعتماد الموقع وإغلاق</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
