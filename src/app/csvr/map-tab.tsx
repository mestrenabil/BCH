'use client'

import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import {
  CSVR_SPECIES_ICONS, CSVR_SPECIES_LABELS, CSVR_SPECIES_COLORS,
  CSVR_REPORT_STATUS_COLORS, CSVR_REPORT_STATUS_LABELS,
  CSVR_PRIORITY_COLORS, CSVR_PRIORITY_LABELS,
  CSVR_MISSION_STATUS_LABELS,
  CSVR_ANIMAL_STATUS_LABELS,
} from '@/lib/constants'
import type { CsvrSubTab } from '@/lib/store'
import type { StrayReport, StrayAnimal, CaptureMission } from './types'

interface Props {
  reports: StrayReport[]
  animals: StrayAnimal[]
  missions: CaptureMission[]
  onRefresh: () => void
  buildParams: (extra?: Record<string, string>) => URLSearchParams
  selectedCommune: string
  allowedCommunes: string[]
  onNavigate: (tab: CsvrSubTab) => void
}

type CreateType = 'report' | 'animal' | 'mission'

interface CreatingState {
  lat: number
  lng: number
  type: CreateType
  detectedCommune?: string
  detectedQuartier?: string
}

interface GeoResult {
  found: boolean
  commune?: string
  quartier?: string
  region?: string
  province?: string
}

interface MapBiteCase {
  id: string
  reference: string
  animalType: string
  animalStatus: string
  victimName: string
  biteLocation: string
  description: string
  status: string
  commune: string
  quartier: string
  latitude: number | null
  longitude: number | null
}

interface MapDeathReport {
  id: string
  reference: string
  species: string
  quantity: number
  commune: string
  quartier: string
  location: string
  apparentCause: string
  healthSuspicion: boolean
  accident: boolean
  latitude: number | null
  longitude: number | null
}

interface MapHotspot {
  id: string
  reference: string
  name: string
  commune: string
  quartier: string
  location: string
  priority: string
  status: string
  reportCount: number
  biteCount: number
  latitude: number | null
  longitude: number | null
}

interface MapHealthAlert {
  id: string
  type: string
  urgency: string
  clinicalSuspicion: boolean
  measureTaken: string
  animal: {
    csvrNumber: string
    species: string
    commune: string
    captureLatitude: number | null
    captureLongitude: number | null
  }
}

interface MapCenter {
  id: string
  name: string
  type: string
  status: string
  capacity: number
  occupied: number
  commune: string
  adresse: string
  latitude: number | null
  longitude: number | null
}

interface MapDestination {
  id: string
  type: string
  site: string
  commune: string
  quartier: string
  latitude: number | null
  longitude: number | null
  animal: { csvrNumber: string; species: string; commune: string }
}

type MapPayload = Partial<{
  biteCases: MapBiteCase[]
  reports: MapDeathReport[]
  hotspots: MapHotspot[]
  alerts: MapHealthAlert[]
  centers: MapCenter[]
  destinations: MapDestination[]
}>

const DEFAULT_MAP_LAYERS = {
  reports: true,
  animals: true,
  missions: true,
  bites: true,
  deaths: true,
  hotspots: true,
  healthAlerts: true,
  centers: true,
  destinations: true,
}

const SPECIES_OPTS = ['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER'] as const
const PRIORITY_OPTS = ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'] as const
const SEX_OPTS = ['MALE', 'FEMALE', 'UNKNOWN'] as const

/** بحث عكسي جغرافي عبر API — يرجع الجماعة التي تحتوي النقطة */
async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`)
    if (!res.ok) return { found: false }
    const data = await res.json()
    if (data.found) return { found: true, commune: data.commune, quartier: data.quartier || undefined, region: data.region, province: data.province }
    return { found: false }
  } catch {
    return { found: false }
  }
}

/** يجلب المركز + الحدود الجغرافية لجماعة معينة */
async function fetchCommuneCentroid(commune: string): Promise<{ lat: number; lng: number; bounds?: [[number, number], [number, number]]; geometry?: GeoJSON.Geometry; name?: string } | null> {
  try {
    const res = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`)
    if (!res.ok) return null
    const data = await res.json()
    if (data.found) return { lat: data.lat, lng: data.lng, bounds: data.bounds, geometry: data.geometry, name: data.commune }
    return null
  } catch {
    return null
  }
}

export default function MapTab({ reports, animals, missions, onRefresh, buildParams, selectedCommune, allowedCommunes, onNavigate }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const [mapReady, setMapReady] = useState(false)
  const layerRef = useRef<any>(null)
  const boundaryLayerRef = useRef<any>(null)
  const allowedGeometriesRef = useRef<GeoJSON.Geometry[]>([])
  const allowedCommunesRef = useRef(allowedCommunes)
  const clickMarkerRef = useRef<any>(null) // علامة مؤقتة عند نقطة النقر
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const allowedCommunesKey = allowedCommunes.join('|')

  const [layers, setLayers] = useState(DEFAULT_MAP_LAYERS)
  const [mapRecords, setMapRecords] = useState({
    bites: [] as MapBiteCase[],
    deaths: [] as MapDeathReport[],
    hotspots: [] as MapHotspot[],
    healthAlerts: [] as MapHealthAlert[],
    centers: [] as MapCenter[],
    destinations: [] as MapDestination[],
  })
  const [supplementalRefreshKey, setSupplementalRefreshKey] = useState(0)

  // حالة الإنشاء عبر النقر
  const [creating, setCreating] = useState<CreatingState | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { allowedCommunesRef.current = allowedCommunes }, [allowedCommunes])

  useEffect(() => {
    let cancelled = false
    const loadSupplementalRecords = async () => {
      const params = buildParams()
      const requests = [
        fetch(`/api/bite-cases?${params.toString()}`),
        fetch(`/api/csvr/death-reports?${params.toString()}`),
        fetch(`/api/csvr/hotspots?${params.toString()}`),
        fetch(`/api/csvr/health-alerts?${params.toString()}`),
        fetch(`/api/csvr/centers?${params.toString()}`),
        fetch(`/api/csvr/destinations?${params.toString()}`),
      ]
      const responses = await Promise.all(requests)
      const payloads = await Promise.all(responses.map(async (response) => response.ok ? await response.json() as MapPayload : {} as MapPayload))
      if (cancelled) return
      setMapRecords({
        bites: payloads[0].biteCases || [],
        deaths: payloads[1].reports || [],
        hotspots: payloads[2].hotspots || [],
        healthAlerts: payloads[3].alerts || [],
        centers: payloads[4].centers || [],
        destinations: payloads[5].destinations || [],
      })
    }
    void loadSupplementalRecords().catch(() => {
      if (!cancelled) setMapRecords({ bites: [], deaths: [], hotspots: [], healthAlerts: [], centers: [], destinations: [] })
    })
    return () => { cancelled = true }
  }, [buildParams, selectedCommune, allowedCommunes.join('|'), supplementalRefreshKey])

  // ===== MAP INIT =====
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      if (typeof window !== 'undefined') (window as unknown as { L?: typeof L }).L = L
      await import('leaflet.markercluster')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current || mapRef.current) return

      const scopedCentroids = (await Promise.all(allowedCommunes.map((commune) => fetchCommuneCentroid(commune)))).filter(Boolean) as Awaited<ReturnType<typeof fetchCommuneCentroid>>[]
      if (cancelled || !containerRef.current || mapRef.current) return
      const scopeBounds = L.latLngBounds([])
      for (const centroid of scopedCentroids) if (centroid?.bounds) scopeBounds.extend(centroid.bounds)
      const hasScopeBounds = scopeBounds.isValid()
      const defaultCenter: [number, number] = scopedCentroids[0]
        ? [scopedCentroids[0].lat, scopedCentroids[0].lng]
        : [31.8, -6.3]
      const map = L.map(containerRef.current, {
        center: defaultCenter,
        zoom: scopedCentroids.length === 1 ? 13 : scopedCentroids.length > 1 ? 10 : 6,
        zoomControl: true,
        doubleClickZoom: false,
        scrollWheelZoom: true,
      })
      mapRef.current = map
      setMapReady(true)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap', maxZoom: 19,
      }).addTo(map)
      if (hasScopeBounds) map.fitBounds(scopeBounds, { padding: [50, 50], maxZoom: scopedCentroids.length === 1 ? 14 : 12 })

      const leafletWithClusters = L as typeof L & { markerClusterGroup?: (options?: Record<string, unknown>) => any }
      layerRef.current = typeof leafletWithClusters.markerClusterGroup === 'function'
        ? leafletWithClusters.markerClusterGroup({
          maxClusterRadius: 46,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          iconCreateFunction: (cluster: { getChildCount: () => number }) => {
            const count = cluster.getChildCount()
            const size = count < 10 ? 40 : count < 50 ? 48 : 56
            const color = count < 10 ? '#2563eb' : count < 50 ? '#d97706' : '#dc2626'
            return L.divIcon({
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};color:white;font:800 14px system-ui;border:3px solid white;box-shadow:0 3px 14px rgba(15,23,42,.3);">${count}</div>`,
              className: '', iconSize: [size, size], iconAnchor: [size / 2, size / 2],
            })
          },
        })
        : L.layerGroup()
      layerRef.current.addTo(map)

      // مهم: Leaflet يحتاج invalidateSize بعد التحميل ليعيد حساب أبعاد الحاوية
      // بدون هذا، تظهر الخريطة رمادية فارغة (مشكلة شائعة مع React + lazy init)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 100)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 400)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 1000)

      // ===== معالج النقر على الخريطة =====
      const handleMapClick = async (e: any) => {
        const { lat, lng } = e.latlng
        // أضف علامة مؤقتة + popup قائمة سياق (مع حالة تحميل)
        if (clickMarkerRef.current) clickMarkerRef.current.remove()
        const icon = L.divIcon({
          html: `<div style="background:#f59e0b;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
          className: '', iconSize: [22, 22], iconAnchor: [11, 22],
        })
        const marker: any = L.marker([lat, lng], { icon, bubblingMouseEvents: false }).addTo(map)
        clickMarkerRef.current = marker

        const renderPopup = (communeHtml: string, showActions: boolean) => `
          <div style="min-width:210px;text-align:center;font-family:inherit;">
            <div style="font-weight:700;font-size:12px;color:#475569;margin-bottom:4px;">📍 ${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
            ${communeHtml}
            ${showActions ? `<div style="font-size:11px;color:#94a3b8;margin:6px 0;">اختر نوع السجل لإضافته:</div>
              <div style="display:flex;flex-direction:column;gap:4px;">
                <button onclick="window.__csvrCreate__('report')" style="background:#3b82f6;color:white;border:none;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">📢 بلاغ</button>
                <button onclick="window.__csvrCreate__('animal')" style="background:#f59e0b;color:white;border:none;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">🐾 حيوان</button>
                <button onclick="window.__csvrCreate__('mission')" style="background:#8b5cf6;color:white;border:none;padding:7px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;">▲ مهمة مجدولة</button>
              </div>` : ''}
          </div>
        `

        // popup أولي بحالة تحميل
        marker.bindPopup(renderPopup('<div style="font-size:11px;color:#94a3b8;margin:4px 0;">⏳ جارٍ تحديد الجماعة…</div>', false)).openPopup()

        // اكتشاف الجماعة خادمياً
        const geo = await reverseGeocode(lat, lng)
        if (clickMarkerRef.current !== marker) return
        const scopedCommunes = allowedCommunesRef.current
        const isAllowedLocation = scopedCommunes.length === 0 || Boolean(geo.found && geo.commune && scopedCommunes.includes(geo.commune))
        const communeHtml = !isAllowedLocation
          ? `<div style="background:#fee2e2;color:#991b1b;font-size:11px;font-weight:700;padding:5px 8px;border-radius:6px;margin:4px 0;">⛔ هذا الموقع خارج حدود جماعة الحساب</div>`
          : geo.found && geo.commune
          ? `<div style="background:#dcfce7;color:#166534;font-size:11px;font-weight:700;padding:4px 8px;border-radius:6px;margin:4px 0;">🏛️ ${geo.commune}${geo.province ? ` · ${geo.province}` : ''}</div>`
          : '<div style="background:#fef3c7;color:#92400e;font-size:11px;padding:4px 8px;border-radius:6px;margin:4px 0;">⚠️ خارج نطاق جماعة معروفة</div>'
        // خزّن الجماعة المكتشفة على العلامة لاستخدامها لاحقاً
        marker.__detectedCommune = (geo.found && geo.commune) ? geo.commune : undefined
        marker.__detectedQuartier = (geo.found && geo.quartier) ? geo.quartier : undefined
        marker.__canCreate = isAllowedLocation
        marker.setPopupContent(renderPopup(communeHtml, isAllowedLocation))
      }

      map.on('click', (e: any) => {
        if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null
          void handleMapClick(e)
        }, 260)
      })
      map.on('dblclick', () => {
        if (clickTimerRef.current) {
          clearTimeout(clickTimerRef.current)
          clickTimerRef.current = null
        }
        map.zoomIn(1, { animate: true })
      })
    }

    init()
    return () => {
      cancelled = true
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        setMapReady(false)
        layerRef.current = null
        boundaryLayerRef.current = null
      }
    }
  }, [allowedCommunesKey])

  // ربط النافذة بـ callback لاستقبال اختيار النوع من popup
  useEffect(() => {
    ;(window as any).__csvrCreate__ = (type: CreateType) => {
      if (!clickMarkerRef.current) return
      const ll = clickMarkerRef.current.getLatLng()
      const detectedCommune = clickMarkerRef.current.__detectedCommune
      const detectedQuartier = clickMarkerRef.current.__detectedQuartier
      const scopedCommunes = allowedCommunesRef.current
      if (clickMarkerRef.current.__canCreate === false || (scopedCommunes.length > 0 && (!detectedCommune || !scopedCommunes.includes(detectedCommune)))) {
        toast.error('لا يمكن إنشاء سجل خارج حدود جماعة الحساب')
        return
      }
      setCreating({ lat: ll.lat, lng: ll.lng, type, detectedCommune, detectedQuartier })
      // أغلق popup لكن أبقِ العلامة كمرجع بصري حتى ينتهي المستخدم
      if (mapRef.current) mapRef.current.closePopup()
    }
    return () => { delete (window as any).__csvrCreate__ }
  }, [])

  useEffect(() => {
    ;(window as any).__csvrNavigate__ = (tab: CsvrSubTab) => onNavigate(tab)
    return () => { delete (window as any).__csvrNavigate__ }
  }, [onNavigate])

  // ===== زر تحديد الموقع تلقائياً (GPS) — يضع علامة + يكتشف الجماعة + يفتح قائمة السياق =====
  const [gpsState, setGpsState] = useState('')
  const captureGpsAndDetect = () => {
    setGpsState('⏳ جارٍ تحديد الموقع…')
    if (!navigator.geolocation) { setGpsState('الجهاز لا يدعم تحديد الموقع'); return }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        if (!mapRef.current) return
        mapRef.current.setView([lat, lng], Math.max(mapRef.current.getZoom(), 16))
        // وجّه حدث نقر صناعي على الخريطة عند الموقع الحالي ليُعيد استخدام نفس منطق popup + اكتشاف الجماعة
        mapRef.current.fire('click', { latlng: { lat, lng } })
        setGpsState('✓ تم تحديد موقعك')
        setTimeout(() => setGpsState(''), 4000)
      },
      () => setGpsState('تعذر تحديد الموقع'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  // ===== DRAW MARKERS (re-draw when data or layer visibility changes) =====
  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current || !layerRef.current) return

      layerRef.current.clearLayers()
      const isInAllowedScope = (commune: string | null | undefined) => allowedCommunes.length === 0 || Boolean(commune && allowedCommunes.includes(commune))
      const addCirclePoint = (lat: number, lng: number, color: string, popup: string, radius = 8) => {
        const marker = L.circleMarker([lat, lng], { radius, color: '#ffffff', weight: 2, fillColor: color, fillOpacity: 0.95 }).addTo(layerRef.current)
        marker.bindPopup(popup)
      }
      const openTabButton = (tab: CsvrSubTab, label: string) => `<button onclick="window.__csvrNavigate__('${tab}')" style="margin-top:7px;background:#0f766e;color:white;border:none;padding:6px 9px;border-radius:7px;font-size:10px;font-weight:700;cursor:pointer;">${label}</button>`

      // بلاغات
      if (layers.reports) {
        for (const r of reports) {
          if (!isInAllowedScope(r.commune)) continue
          if (r.latitude == null || r.longitude == null) continue
          const color = CSVR_REPORT_STATUS_COLORS[r.statut] || '#3b82f6'
          const icon = L.divIcon({
            html: `<div style="background:${color};width:18px;height:18px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
            className: '', iconSize: [18, 18], iconAnchor: [9, 18],
          })
          const marker = L.marker([r.latitude, r.longitude], { icon, bubblingMouseEvents: false }).addTo(layerRef.current)
          const flags = [
            r.rabiesSuspect ? '🦠 اشتباه الكلب' : '',
            r.biteReported ? '🦷 حالة عض' : '',
            r.isAggressive ? '😤 عدواني' : '',
            r.isInjured ? '🩹 جريح' : '',
          ].filter(Boolean).join(' · ')
          marker.bindPopup(`
            <div style="min-width:200px;font-family:inherit;">
              <div style="font-weight:bold;margin-bottom:4px;">${CSVR_SPECIES_ICONS[r.species]} ${r.reference}</div>
              <div style="font-size:11px;color:#666;">${r.adresse || r.quartier || '—'}</div>
              <div style="font-size:11px;margin-top:4px;">العدد: <b>${r.estimatedCount}</b></div>
              ${flags ? `<div style="font-size:11px;color:#dc2626;margin-top:4px;">${flags}</div>` : ''}
              <div style="font-size:11px;color:#999;margin-top:4px;">${r.description || ''}</div>
              ${openTabButton('reports', 'فتح سجل البلاغات')}
            </div>
          `)
        }
      }

      // حيوانات
      if (layers.animals) {
        for (const a of animals) {
          if (!isInAllowedScope(a.commune)) continue
          if (a.captureLatitude == null || a.captureLongitude == null) continue
          const icon = L.divIcon({
            html: `<div style="background:${CSVR_SPECIES_COLORS[a.species] || '#64748b'};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 1px 2px rgba(0,0,0,0.3);"></div>`,
            className: '', iconSize: [14, 14], iconAnchor: [7, 7],
          })
          const marker = L.marker([a.captureLatitude, a.captureLongitude], { icon, bubblingMouseEvents: false }).addTo(layerRef.current)
          marker.bindPopup(`
            <div style="min-width:180px;">
              <div style="font-weight:bold;">${CSVR_SPECIES_ICONS[a.species]} ${a.csvrNumber}</div>
              <div style="font-size:11px;color:#666;">${a.primaryColor || ''} ${a.sex === 'MALE' ? '♂' : a.sex === 'FEMALE' ? '♀' : ''}</div>
              <div style="font-size:11px;margin-top:2px;">موقع الاصطياد: ${a.captureLocation || a.captureQuartier || '—'}</div>
              <div style="font-size:10px;color:#999;margin-top:2px;">${CSVR_ANIMAL_STATUS_LABELS[a.statut] || a.statut}</div>
              ${openTabButton('animals', 'فتح سجل الحيوانات')}
            </div>
          `)
        }
      }

      // مهام مجدولة
      if (layers.missions) {
        for (const m of missions) {
          if (!isInAllowedScope(m.commune)) continue
          if (m.latitude == null || m.longitude == null || m.statut === 'TERMINEE') continue
          const icon = L.divIcon({
            html: `<div style="width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-bottom:16px solid #8b5cf6;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.3));"></div>`,
            className: '', iconSize: [18, 16], iconAnchor: [9, 16],
          })
          const marker = L.marker([m.latitude, m.longitude], { icon, bubblingMouseEvents: false }).addTo(layerRef.current)
          const sched = m.scheduledAt ? new Date(m.scheduledAt).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
          marker.bindPopup(`
            <div style="min-width:180px;">
              <div style="font-weight:bold;color:#8b5cf6;">🎯 ${m.reference}</div>
              <div style="font-size:11px;color:#666;">${m.quartier || m.zone || '—'}</div>
              <div style="font-size:11px;margin-top:2px;">المسؤول: ${m.teamLead || '—'}</div>
              <div style="font-size:11px;">التاريخ: ${sched}</div>
              <div style="font-size:10px;color:#999;margin-top:2px;">${CSVR_MISSION_STATUS_LABELS[m.statut] || m.statut}</div>
              ${openTabButton('missions', 'فتح سجل المهام')}
            </div>
          `)
        }
      }

      if (layers.bites) {
        for (const bite of mapRecords.bites) {
          if (!isInAllowedScope(bite.commune) || bite.latitude == null || bite.longitude == null) continue
          addCirclePoint(bite.latitude, bite.longitude, '#dc2626', `
            <div style="min-width:190px;">
              <div style="font-weight:bold;color:#b91c1c;">🦷 ${bite.reference}</div>
              <div style="font-size:11px;margin-top:4px;">الضحية: ${bite.victimName || 'غير مصرح'}</div>
              <div style="font-size:11px;">المكان: ${bite.biteLocation || bite.quartier || '—'}</div>
              <div style="font-size:10px;color:#999;margin-top:3px;">الحالة: ${bite.status}</div>
              ${openTabButton('bites', 'فتح سجل العضّات')}
            </div>
          `, 8)
        }
      }

      if (layers.deaths) {
        for (const death of mapRecords.deaths) {
          if (!isInAllowedScope(death.commune) || death.latitude == null || death.longitude == null) continue
          const color = death.healthSuspicion ? '#dc2626' : death.accident ? '#ea580c' : '#475569'
          addCirclePoint(death.latitude, death.longitude, color, `
            <div style="min-width:190px;">
              <div style="font-weight:bold;color:${color};">🕊️ ${death.reference}</div>
              <div style="font-size:11px;margin-top:4px;">${death.species} · العدد: ${death.quantity}</div>
              <div style="font-size:11px;">${death.quartier || death.location || '—'}</div>
              <div style="font-size:10px;color:#999;margin-top:3px;">${death.healthSuspicion ? 'اشتباه صحي' : death.accident ? 'حادث' : death.apparentCause || 'سبب غير محدد'}</div>
              ${openTabButton('deaths', 'فتح سجل الحيوانات النافقة')}
            </div>
          `, 8)
        }
      }

      if (layers.hotspots) {
        for (const hotspot of mapRecords.hotspots) {
          if (!isInAllowedScope(hotspot.commune) || hotspot.latitude == null || hotspot.longitude == null) continue
          const color = hotspot.priority === 'CRITICAL' ? '#dc2626' : hotspot.priority === 'HIGH' ? '#ea580c' : '#f59e0b'
          addCirclePoint(hotspot.latitude, hotspot.longitude, color, `
            <div style="min-width:200px;">
              <div style="font-weight:bold;color:${color};">🔥 ${hotspot.name}</div>
              <div style="font-size:11px;margin-top:4px;">${hotspot.quartier || hotspot.location || '—'}</div>
              <div style="font-size:11px;">بلاغات: ${hotspot.reportCount} · عضات: ${hotspot.biteCount}</div>
              <div style="font-size:10px;color:#999;margin-top:3px;">الحالة: ${hotspot.status}</div>
              ${openTabButton('hotspots', 'فتح سجل النقاط الساخنة')}
            </div>
          `, 10)
        }
      }

      if (layers.healthAlerts) {
        for (const alert of mapRecords.healthAlerts) {
          const commune = alert.animal.commune
          const lat = alert.animal.captureLatitude
          const lng = alert.animal.captureLongitude
          if (!isInAllowedScope(commune) || lat == null || lng == null) continue
          const color = alert.urgency === 'URGENT' ? '#991b1b' : alert.urgency === 'HIGH' ? '#dc2626' : '#f97316'
          addCirclePoint(lat, lng, color, `
            <div style="min-width:200px;">
              <div style="font-weight:bold;color:${color};">🩸 تنبيه صحي</div>
              <div style="font-size:11px;margin-top:4px;">${alert.animal.csvrNumber} · ${alert.animal.species}</div>
              <div style="font-size:11px;">النوع: ${alert.type} · الاستعجال: ${alert.urgency}</div>
              <div style="font-size:10px;color:#999;margin-top:3px;">${alert.measureTaken || 'لم تسجل التدابير بعد'}</div>
              ${openTabButton('health', 'فتح المراقبة الصحية')}
            </div>
          `, 9)
        }
      }

      if (layers.centers) {
        for (const center of mapRecords.centers) {
          if (!isInAllowedScope(center.commune) || center.latitude == null || center.longitude == null) continue
          const icon = L.divIcon({ html: '<div style="background:#7c3aed;color:white;width:27px;height:27px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,.25);font-size:15px;">🏠</div>', className: '', iconSize: [27, 27], iconAnchor: [13, 27] })
          const marker = L.marker([center.latitude, center.longitude], { icon, bubblingMouseEvents: false }).addTo(layerRef.current)
          marker.bindPopup(`<div style="min-width:190px;"><div style="font-weight:bold;color:#6d28d9;">🏠 ${center.name}</div><div style="font-size:11px;margin-top:4px;">${center.adresse || center.commune}</div><div style="font-size:11px;">الإشغال: ${center.occupied}/${center.capacity || '∞'}</div><div style="font-size:10px;color:#999;margin-top:3px;">${center.status === 'ACTIVE' ? 'نشط' : 'متوقف'}</div>${openTabButton('centers', 'فتح المراكز والاستقبال')}</div>`)
        }
      }

      if (layers.destinations) {
        for (const destination of mapRecords.destinations) {
          const commune = destination.commune || destination.animal.commune
          if (!isInAllowedScope(commune) || destination.latitude == null || destination.longitude == null) continue
          addCirclePoint(destination.latitude, destination.longitude, '#0f766e', `
            <div style="min-width:190px;">
              <div style="font-weight:bold;color:#0f766e;">↩️ وجهة الحيوان</div>
              <div style="font-size:11px;margin-top:4px;">${destination.animal.csvrNumber} · ${destination.animal.species}</div>
              <div style="font-size:11px;">${destination.site || destination.quartier || '—'}</div>
              <div style="font-size:10px;color:#999;margin-top:3px;">النوع: ${destination.type}</div>
              ${openTabButton('adoption', 'فتح الرعاية والوجهة')}
            </div>
          `, 8)
        }
      }

      // fit bounds على البيانات — يُعاد التطبيق عند تغيير الجماعة المختارة
      const points: [number, number][] = []
      if (layers.reports) for (const r of reports) if (isInAllowedScope(r.commune) && r.latitude != null && r.longitude != null) points.push([r.latitude, r.longitude])
      if (layers.animals) for (const a of animals) if (isInAllowedScope(a.commune) && a.captureLatitude != null && a.captureLongitude != null) points.push([a.captureLatitude, a.captureLongitude])
      if (layers.missions) for (const m of missions) if (isInAllowedScope(m.commune) && m.latitude != null && m.longitude != null) points.push([m.latitude, m.longitude])
      if (layers.bites) for (const bite of mapRecords.bites) if (isInAllowedScope(bite.commune) && bite.latitude != null && bite.longitude != null) points.push([bite.latitude, bite.longitude])
      if (layers.deaths) for (const death of mapRecords.deaths) if (isInAllowedScope(death.commune) && death.latitude != null && death.longitude != null) points.push([death.latitude, death.longitude])
      if (layers.hotspots) for (const hotspot of mapRecords.hotspots) if (isInAllowedScope(hotspot.commune) && hotspot.latitude != null && hotspot.longitude != null) points.push([hotspot.latitude, hotspot.longitude])
      if (layers.healthAlerts) for (const alert of mapRecords.healthAlerts) if (isInAllowedScope(alert.animal.commune) && alert.animal.captureLatitude != null && alert.animal.captureLongitude != null) points.push([alert.animal.captureLatitude, alert.animal.captureLongitude])
      if (layers.centers) for (const center of mapRecords.centers) if (isInAllowedScope(center.commune) && center.latitude != null && center.longitude != null) points.push([center.latitude, center.longitude])
      if (layers.destinations) for (const destination of mapRecords.destinations) if (isInAllowedScope(destination.commune || destination.animal.commune) && destination.latitude != null && destination.longitude != null) points.push([destination.latitude, destination.longitude])
      if (points.length > 0 && mapRef.current && allowedCommunes.length === 0) {
        const scopeKey = allowedCommunes.length > 0 ? allowedCommunes.join('|') : (selectedCommune || 'ALL')
        // أعد التركيز فقط إذا تغيرت الجماعة أو كان أول رسم
        if (mapRef.current.__lastScope !== scopeKey || !mapRef.current.__boundsApplied) {
          mapRef.current.fitBounds(points, { padding: [40, 40], maxZoom: 15 })
          mapRef.current.__boundsApplied = true
          mapRef.current.__lastScope = scopeKey
        }
      }
    }
    draw()
    return () => { cancelled = true }
  }, [reports, animals, missions, layers, mapRecords, selectedCommune, allowedCommunes])

  // ===== تركيز الخريطة على نطاق الحساب =====
  useEffect(() => {
    if (!mapRef.current || allowedCommunes.length === 0) return
    let cancelled = false
    const focus = async () => {
      const centroids = (await Promise.all(allowedCommunes.map((commune) => fetchCommuneCentroid(commune)))).filter(Boolean) as Awaited<ReturnType<typeof fetchCommuneCentroid>>[]
      if (cancelled || centroids.length === 0 || !mapRef.current) return
      const L = await import('leaflet')
      const bounds = L.latLngBounds([])
      for (const centroid of centroids) if (centroid?.bounds) bounds.extend(centroid.bounds)
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: allowedCommunes.length === 1 ? 14 : 12 })
      } else {
        mapRef.current.setView([centroids[0]!.lat, centroids[0]!.lng], 13)
      }
    }
    focus()
    return () => { cancelled = true }
  }, [allowedCommunesKey, mapReady])

  useEffect(() => {
    const scopeCommunes = [...allowedCommunes]
    if (!mapReady || !mapRef.current || scopeCommunes.length === 0) {
      allowedGeometriesRef.current = []
      if (boundaryLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(boundaryLayerRef.current)
        boundaryLayerRef.current = null
      }
      return
    }
    let cancelled = false
    let drawnBoundaryLayer: any = null
    const drawBoundary = async () => {
      const centroids = (await Promise.all(scopeCommunes.map((commune) => fetchCommuneCentroid(commune)))).filter((centroid): centroid is NonNullable<typeof centroid> => Boolean(centroid?.geometry))
      if (cancelled || centroids.length === 0 || !mapRef.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return
      if (boundaryLayerRef.current) {
        mapRef.current.removeLayer(boundaryLayerRef.current)
        boundaryLayerRef.current = null
      }
      const group = L.featureGroup()
      const geometries = centroids.map((centroid) => centroid.geometry).filter((geometry): geometry is GeoJSON.Geometry => Boolean(geometry))
      allowedGeometriesRef.current = geometries
      for (const geometry of geometries) {
        const boundary = L.geoJSON({ type: 'Feature', properties: {}, geometry } as GeoJSON.Feature, {
          style: { color: '#047857', weight: 5, opacity: 1, fillColor: '#10b981', fillOpacity: 0.12, dashArray: '10 6' },
          interactive: false,
        })
        group.addLayer(boundary)
      }
      if (cancelled || !mapRef.current) return
      group.addTo(mapRef.current)
      group.bringToFront()
      drawnBoundaryLayer = group
      boundaryLayerRef.current = group
    }
    void drawBoundary()
    return () => {
      cancelled = true
      if (drawnBoundaryLayer && mapRef.current) {
        mapRef.current.removeLayer(drawnBoundaryLayer)
        if (boundaryLayerRef.current === drawnBoundaryLayer) boundaryLayerRef.current = null
      }
    }
  }, [allowedCommunesKey, mapReady])

  // إزالة العلامة المؤقتة عند إغلاق وضع الإنشاء
  useEffect(() => {
    if (!creating && clickMarkerRef.current) {
      clickMarkerRef.current.remove()
      clickMarkerRef.current = null
    }
  }, [creating])

  // امنع تمرير الصفحة أثناء تعبئة نافذة الإنشاء، مع إبقاء تمرير جسم النافذة متاحاً.
  useEffect(() => {
    if (!creating) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [creating])

  // ===== FORM STATE =====
  const emptyReportForm = {
    species: 'DOG' as string, estimatedCount: '1', priority: 'NORMALE' as string,
    isAggressive: false, isInjured: false, rabiesSuspect: false, biteReported: false,
    description: '', quartier: '',
  }
  const emptyAnimalForm = {
    species: 'DOG' as string, sex: 'UNKNOWN' as string, primaryColor: '',
    captureLocation: '', captureState: '',
  }
  const emptyMissionForm = {
    priority: 'NORMALE' as string, teamLead: '', scheduledAt: '', quartier: '',
    estimatedAnimals: '2',
  }
  const [reportForm, setReportForm] = useState(emptyReportForm)
  const [animalForm, setAnimalForm] = useState(emptyAnimalForm)
  const [missionForm, setMissionForm] = useState(emptyMissionForm)

  const isCreatingWithinScope = () => {
    if (!creating) return false
    const scopedCommunes = allowedCommunesRef.current
    if (scopedCommunes.length === 0) return true
    if (creating.detectedCommune && scopedCommunes.includes(creating.detectedCommune)) return true
    toast.error('لا يمكن إنشاء سجل خارج حدود جماعة الحساب')
    return false
  }

  // reset عند فتح النموذج
  useEffect(() => {
    if (!creating) return
    if (creating.type === 'report') setReportForm({ ...emptyReportForm, quartier: creating.detectedQuartier || '' })
    if (creating.type === 'animal') setAnimalForm({ ...emptyAnimalForm, captureLocation: creating.detectedQuartier || '' })
    if (creating.type === 'mission') setMissionForm({ ...emptyMissionForm, quartier: creating.detectedQuartier || '' })
  }, [creating])

  // ===== SUBMIT HANDLERS =====
  const submitReport = async () => {
    if (!creating || !isCreatingWithinScope()) return
    setSubmitting(true)
    try {
      const params = buildParams()
      // أولوية الجماعة: المكتشفة جغرافياً > من buildParams > المحددة يدوياً
      const commune = creating.detectedCommune || params.get('commune') || selectedCommune || ''
      const body: Record<string, unknown> = {
        source: 'INTERNAL',
        ...reportForm,
        commune,
        estimatedCount: parseInt(reportForm.estimatedCount) || 1,
        latitude: creating.lat,
        longitude: creating.lng,
      }
      const tf = Object.fromEntries(params)
      if (tf.regionCode) body.territoryFilter = { regionCode: tf.regionCode, provinceCode: tf.provinceCode || 'ALL', communeCode: tf.communeCode || 'ALL' }
      const res = await fetch('/api/csvr/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'فشل الإنشاء'); return }
      toast.success('📢 تم إنشاء البلاغ على الخريطة')
      setCreating(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') } finally { setSubmitting(false) }
  }

  const submitAnimal = async () => {
    if (!creating || !isCreatingWithinScope()) return
    setSubmitting(true)
    try {
      const params = buildParams()
      const commune = creating.detectedCommune || params.get('commune') || selectedCommune || ''
      const body: Record<string, unknown> = {
        ...animalForm,
        commune,
        captureLatitude: creating.lat,
        captureLongitude: creating.lng,
      }
      const res = await fetch('/api/csvr/animals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'فشل الإنشاء'); return }
      toast.success('🐾 تم تسجيل الحيوان على الخريطة')
      setCreating(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') } finally { setSubmitting(false) }
  }

  const submitMission = async () => {
    if (!creating || !isCreatingWithinScope()) return
    setSubmitting(true)
    try {
      const params = buildParams()
      const commune = creating.detectedCommune || params.get('commune') || selectedCommune || ''
      const body: Record<string, unknown> = {
        ...missionForm,
        commune,
        latitude: creating.lat,
        longitude: creating.lng,
        estimatedAnimals: parseInt(missionForm.estimatedAnimals) || 0,
      }
      if (missionForm.scheduledAt) body.scheduledAt = new Date(missionForm.scheduledAt).toISOString()
      const res = await fetch('/api/csvr/missions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) { const e = await res.json().catch(() => ({})); toast.error(e.error || 'فشل الإنشاء'); return }
      toast.success('▲ تم إنشاء المهمة على الخريطة')
      setCreating(null)
      onRefresh()
    } catch { toast.error('حدث خطأ') } finally { setSubmitting(false) }
  }

  // ===== RENDER =====
  const visibleReports = reports.filter((r) => r.latitude != null).length
  const visibleAnimals = animals.filter((a) => a.captureLatitude != null).length
  const visibleMissions = missions.filter((m) => m.latitude != null && m.statut !== 'TERMINEE').length
  const visibleBites = mapRecords.bites.filter((item) => item.latitude != null && item.longitude != null).length
  const visibleDeaths = mapRecords.deaths.filter((item) => item.latitude != null && item.longitude != null).length
  const visibleHotspots = mapRecords.hotspots.filter((item) => item.latitude != null && item.longitude != null).length
  const visibleHealthAlerts = mapRecords.healthAlerts.filter((item) => item.animal.captureLatitude != null && item.animal.captureLongitude != null).length
  const visibleCenters = mapRecords.centers.filter((item) => item.latitude != null && item.longitude != null).length
  const visibleDestinations = mapRecords.destinations.filter((item) => item.latitude != null && item.longitude != null).length

  return (
    <div className="space-y-2 overscroll-contain" style={{ overscrollBehavior: 'contain' }}>
      <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-gradient-to-l from-blue-50 to-white px-4 py-3 shadow-sm">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-xl">🗺️</span>
        <div><h2 className="text-base font-extrabold text-slate-800">الخريطة</h2><p className="mt-0.5 text-[11px] text-slate-500">المتابعة الميدانية وتحديد مواقع السجلات</p></div>
      </div>
      {/* Layer toggles + help */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          <LayerToggle active={layers.reports} onClick={() => setLayers((l) => ({ ...l, reports: !l.reports }))} color="#3b82f6" icon="📢" label="بلاغات" count={visibleReports} />
          <LayerToggle active={layers.animals} onClick={() => setLayers((l) => ({ ...l, animals: !l.animals }))} color="#f59e0b" icon="🐾" label="حيوانات" count={visibleAnimals} />
          <LayerToggle active={layers.missions} onClick={() => setLayers((l) => ({ ...l, missions: !l.missions }))} color="#8b5cf6" icon="▲" label="مهام مجدولة" count={visibleMissions} />
          <LayerToggle active={layers.bites} onClick={() => setLayers((l) => ({ ...l, bites: !l.bites }))} color="#dc2626" icon="🦷" label="عضّات" count={visibleBites} />
          <LayerToggle active={layers.deaths} onClick={() => setLayers((l) => ({ ...l, deaths: !l.deaths }))} color="#475569" icon="🕊️" label="وفيات" count={visibleDeaths} />
          <LayerToggle active={layers.hotspots} onClick={() => setLayers((l) => ({ ...l, hotspots: !l.hotspots }))} color="#f59e0b" icon="🔥" label="نقاط ساخنة" count={visibleHotspots} />
          <LayerToggle active={layers.healthAlerts} onClick={() => setLayers((l) => ({ ...l, healthAlerts: !l.healthAlerts }))} color="#be123c" icon="🩸" label="تنبيهات صحية" count={visibleHealthAlerts} />
          <LayerToggle active={layers.centers} onClick={() => setLayers((l) => ({ ...l, centers: !l.centers }))} color="#7c3aed" icon="🏠" label="مراكز" count={visibleCenters} />
          <LayerToggle active={layers.destinations} onClick={() => setLayers((l) => ({ ...l, destinations: !l.destinations }))} color="#0f766e" icon="↩️" label="وجهات" count={visibleDestinations} />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { onRefresh(); setSupplementalRefreshKey((key) => key + 1) }}
            className="text-[11px] font-bold bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm transition-colors"
            title="تحديث بيانات الخريطة يدوياً"
          >
            ↻ تحديث
          </button>
          <button
            onClick={() => setLayers({ ...DEFAULT_MAP_LAYERS })}
            className="text-[11px] font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg px-2.5 py-1.5"
          >
            إظهار الكل
          </button>
          <button
            onClick={() => setLayers({ reports: false, animals: false, missions: false, bites: false, deaths: false, hotspots: false, healthAlerts: false, centers: false, destinations: false })}
            className="text-[11px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg px-2.5 py-1.5"
          >
            إخفاء الكل
          </button>
          <div className="text-[11px] text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
            <span>💡</span>
            <span>انقر على الخريطة لإضافة سجل</span>
          </div>
          <button
            onClick={captureGpsAndDetect}
            className="text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 shadow-sm transition-colors"
            title="تحديد موقعي الحالي تلقائياً"
          >
            📡 موقعي
          </button>
          {gpsState && <span className="text-[10px] text-slate-500 animate-pulse">{gpsState}</span>}
        </div>
      </div>

      {/* Map */}
      <div
        ref={containerRef}
        className="w-full h-[60vh] min-h-[400px] rounded-2xl border border-slate-200 overflow-hidden shadow-sm cursor-crosshair select-none"
        style={{ background: '#e5e7eb', touchAction: 'none', overscrollBehavior: 'contain', isolation: 'isolate' }}
      />

      <p className="text-xs text-slate-400 text-center">
        عرض {layers.reports ? visibleReports : 0} بلاغ · {layers.animals ? visibleAnimals : 0} حيوان · {layers.missions ? visibleMissions : 0} مهمة · {layers.bites ? visibleBites : 0} عضة · {layers.deaths ? visibleDeaths : 0} وفاة · {layers.hotspots ? visibleHotspots : 0} نقطة ساخنة على الخريطة
      </p>

      {/* ===== CREATE MODAL ===== */}
      <AnimatePresence>
        {creating && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[55] flex items-center justify-center p-4"
            onClick={() => setCreating(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div
                className="px-5 py-3.5 text-white flex items-center justify-between"
                style={{
                  background: creating.type === 'report'
                    ? 'linear-gradient(to left, #3b82f6, #2563eb)'
                    : creating.type === 'animal'
                      ? 'linear-gradient(to left, #f59e0b, #d97706)'
                      : 'linear-gradient(to left, #8b5cf6, #7c3aed)',
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-xl">{creating.type === 'report' ? '📢' : creating.type === 'animal' ? '🐾' : '🎯'}</span>
                  <div>
                    <h3 className="text-base font-bold">
                      {creating.type === 'report' ? 'بلاغ جديد' : creating.type === 'animal' ? 'تسجيل حيوان' : 'مهمة مجدولة'}
                    </h3>
                    <p className="text-xs opacity-80">📍 {creating.lat.toFixed(5)}, {creating.lng.toFixed(5)}</p>
                    {creating.detectedCommune && (
                      <p className="text-[11px] bg-white/25 rounded-md px-1.5 py-0.5 mt-0.5 inline-block">🏛️ {creating.detectedCommune}</p>
                    )}
                  </div>
                </div>
                <button onClick={() => setCreating(null)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Form body */}
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                {creating.type === 'report' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">النوع</label>
                        <select value={reportForm.species} onChange={(e) => setReportForm({ ...reportForm, species: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                          {SPECIES_OPTS.map((s) => <option key={s} value={s}>{CSVR_SPECIES_LABELS[s]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">العدد المقدر</label>
                        <input type="number" min="1" value={reportForm.estimatedCount} onChange={(e) => setReportForm({ ...reportForm, estimatedCount: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">الأولوية</label>
                      <select value={reportForm.priority} onChange={(e) => setReportForm({ ...reportForm, priority: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                        {PRIORITY_OPTS.map((p) => <option key={p} value={p}>{CSVR_PRIORITY_LABELS[p]}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <FlagToggle label="😤 عدواني" active={reportForm.isAggressive} onClick={() => setReportForm({ ...reportForm, isAggressive: !reportForm.isAggressive })} color="#dc2626" />
                      <FlagToggle label="🩹 جريح" active={reportForm.isInjured} onClick={() => setReportForm({ ...reportForm, isInjured: !reportForm.isInjured })} color="#ea580c" />
                      <FlagToggle label="🦠 اشتباه الكلب" active={reportForm.rabiesSuspect} onClick={() => setReportForm({ ...reportForm, rabiesSuspect: !reportForm.rabiesSuspect })} color="#7c3aed" />
                      <FlagToggle label="🦷 حالة عض" active={reportForm.biteReported} onClick={() => setReportForm({ ...reportForm, biteReported: !reportForm.biteReported })} color="#b91c1c" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">الحي / العنوان</label>
                      <input type="text" value={reportForm.quartier} onChange={(e) => setReportForm({ ...reportForm, quartier: e.target.value })} placeholder="حي السلام..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">وصف</label>
                      <textarea value={reportForm.description} onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} rows={2} placeholder="وصف مختصر..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 resize-none" />
                    </div>
                  </>
                )}

                {creating.type === 'animal' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">النوع</label>
                        <select value={animalForm.species} onChange={(e) => setAnimalForm({ ...animalForm, species: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                          {SPECIES_OPTS.map((s) => <option key={s} value={s}>{CSVR_SPECIES_LABELS[s]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">الجنس</label>
                        <select value={animalForm.sex} onChange={(e) => setAnimalForm({ ...animalForm, sex: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                          {SEX_OPTS.map((s) => <option key={s} value={s}>{s === 'MALE' ? 'ذكر' : s === 'FEMALE' ? 'أنثى' : 'غير معروف'}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">اللون الرئيسي</label>
                      <input type="text" value={animalForm.primaryColor} onChange={(e) => setAnimalForm({ ...animalForm, primaryColor: e.target.value })} placeholder="بني، أبيض..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">موقع الاصطياد / الحي</label>
                      <input type="text" value={animalForm.captureLocation} onChange={(e) => setAnimalForm({ ...animalForm, captureLocation: e.target.value })} placeholder="موقع ميداني..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">الحالة عند الاصطياد</label>
                      <select value={animalForm.captureState} onChange={(e) => setAnimalForm({ ...animalForm, captureState: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                        <option value="">— غير محدد —</option>
                        <option value="CALME">هادئ</option>
                        <option value="PEUREUX">خائف</option>
                        <option value="AGRESSIF">عدواني</option>
                        <option value="BLESSE">جريح</option>
                        <option value="MALADE">مريض</option>
                        <option value="AMAIGRI">نحيل</option>
                      </select>
                    </div>
                  </>
                )}

                {creating.type === 'mission' && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">الأولوية</label>
                        <select value={missionForm.priority} onChange={(e) => setMissionForm({ ...missionForm, priority: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white">
                          {PRIORITY_OPTS.map((p) => <option key={p} value={p}>{CSVR_PRIORITY_LABELS[p]}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">عدد الحيوانات المقدر</label>
                        <input type="number" min="0" value={missionForm.estimatedAnimals} onChange={(e) => setMissionForm({ ...missionForm, estimatedAnimals: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">مسؤول الفريق</label>
                      <input type="text" value={missionForm.teamLead} onChange={(e) => setMissionForm({ ...missionForm, teamLead: e.target.value })} placeholder="اسم المسؤول..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">التاريخ المجدول</label>
                      <input type="datetime-local" value={missionForm.scheduledAt} onChange={(e) => setMissionForm({ ...missionForm, scheduledAt: e.target.value })} className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-500 mb-1 block">الحي / المنطقة</label>
                      <input type="text" value={missionForm.quartier} onChange={(e) => setMissionForm({ ...missionForm, quartier: e.target.value })} placeholder="منطقة التدخل..." className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200" />
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 px-5 py-3.5 border-t border-slate-100 bg-slate-50">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  disabled={submitting}
                  onClick={creating.type === 'report' ? submitReport : creating.type === 'animal' ? submitAnimal : submitMission}
                  className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>جارٍ الحفظ...</span></>
                  ) : (
                    <span>✓ حفظ على الخريطة</span>
                  )}
                </motion.button>
                <button onClick={() => setCreating(null)} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-white transition-colors">
                  إلغاء
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ===== Helper components =====

function LayerToggle({ active, onClick, color, icon, label, count }: {
  active: boolean; onClick: () => void; color: string; icon: string; label: string; count: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
        active
          ? 'bg-white border-slate-200 text-slate-700 shadow-sm'
          : 'bg-slate-50 border-slate-100 text-slate-300 line-through'
      }`}
      title={active ? `إخفاء ${label}` : `إظهار ${label}`}
    >
      <span style={{ color: active ? color : undefined }}>{icon}</span>
      <span>{label}</span>
      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold" style={{ backgroundColor: active ? color + '20' : '#f1f5f9', color: active ? color : '#94a3b8' }}>
        {count}
      </span>
    </button>
  )
}

function FlagToggle({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
        active ? 'border-transparent text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
      }`}
      style={active ? { backgroundColor: color } : undefined}
    >
      {label}
    </button>
  )
}
