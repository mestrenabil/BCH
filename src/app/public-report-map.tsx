'use client'

import { useEffect, useMemo, useState } from 'react'
import { GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import type { Feature, Geometry } from 'geojson'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { displayCommuneName } from '@/lib/public-territory'

type MapPoint = { lat: number; lng: number }
type FocusPoint = MapPoint & { token: number }
type PublicMapLanguage = 'ar' | 'fr' | 'en' | 'es'

const MARKER_LABELS: Record<PublicMapLanguage, string> = {
  ar: 'موقع البلاغ',
  fr: 'Lieu du signalement',
  en: 'Report location',
  es: 'Ubicación del reporte',
}

const COMMUNE_LABELS: Record<PublicMapLanguage, string> = {
  ar: 'حدود الجماعة المحددة',
  fr: 'Limites de la commune détectée',
  en: 'Detected commune boundary',
  es: 'Límite de la comuna detectada',
}

const MAP_ATTRIBUTIONS: Record<PublicMapLanguage, string> = {
  ar: '© مساهمو OpenStreetMap',
  fr: '© Contributeurs OpenStreetMap',
  en: '© OpenStreetMap contributors',
  es: '© Colaboradores de OpenStreetMap',
}

function MapClickHandler({ onSelect }: { onSelect: (point: MapPoint) => void }) {
  useMapEvents({
    click: (event) => onSelect({ lat: event.latlng.lat, lng: event.latlng.lng }),
  })
  return null
}

function MapFocus({ point }: { point: FocusPoint | null }) {
  const map = useMap()

  useEffect(() => {
    if (point) map.panTo([point.lat, point.lng], { animate: false })
  }, [map, point?.token])

  return null
}

function CommuneBoundary({ commune, language }: { commune: string; language: PublicMapLanguage }) {
  const map = useMap()
  const [boundary, setBoundary] = useState<{ commune: string; geometry: Geometry } | null>(null)

  useEffect(() => {
    if (!commune) return
    let cancelled = false
    fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`)
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (cancelled || !data?.geometry) return
        setBoundary({ commune, geometry: data.geometry as Geometry })
        if (Array.isArray(data.bounds) && data.bounds.length === 2) map.fitBounds(data.bounds, { padding: [28, 28], maxZoom: 14, animate: false })
      })
      .catch(() => undefined)
    return () => { cancelled = true }
  }, [commune, map])

  if (!boundary || boundary.commune !== commune) return null
  const feature: Feature = { type: 'Feature', properties: { name: commune }, geometry: boundary.geometry }
  return <GeoJSON data={feature} style={{ color: '#047857', weight: 4, opacity: 0.95, fillColor: '#34d399', fillOpacity: 0.12 }}>
    <Tooltip sticky>{COMMUNE_LABELS[language]}: {displayCommuneName(commune, language)}</Tooltip>
  </GeoJSON>
}

export default function PublicReportMap({
  onSelect,
  position,
  focusPoint,
  language,
  commune,
}: {
  onSelect: (point: MapPoint) => void
  position: MapPoint | null
  focusPoint: FocusPoint | null
  language: PublicMapLanguage
  commune: string
}) {
  const markerIcon = useMemo(() => L.divIcon({
    html: '<div style="width:24px;height:24px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#059669;border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.35)"></div>',
    className: 'public-report-marker',
    iconSize: [24, 24],
    iconAnchor: [12, 24],
  }), [])

  return (
    <div className="h-[25rem] w-full overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-200">
      <MapContainer center={[33.95, -6.85]} zoom={9} scrollWheelZoom className="h-full w-full" style={{ minHeight: '25rem' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution={MAP_ATTRIBUTIONS[language]}
          maxZoom={19}
        />
        <MapClickHandler onSelect={onSelect} />
        <MapFocus point={focusPoint} />
        <CommuneBoundary commune={commune} language={language} />
        {position && <Marker position={[position.lat, position.lng]} icon={markerIcon}>
          <Tooltip direction="top" offset={[0, -20]}>{MARKER_LABELS[language]}</Tooltip>
        </Marker>}
      </MapContainer>
    </div>
  )
}
