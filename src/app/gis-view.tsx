'use client'

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { useAppStore, type MapClickCoords } from '@/lib/store'
import { ALL_TERRITORIES, appendTerritoryParams, type TerritoryCatalog } from '@/lib/geography'
import { GIS_LAYERS, COMMUNE_LABELS } from '@/lib/constants'
import catalogJson from '../../public/geography/catalog.json'

interface Props {
  selectedCommune: string
  territoryFilter: Parameters<typeof appendTerritoryParams>[1]
  useTerritoryFilter: boolean
  onAddIntervention: () => void
  onMapClick: (location: MapClickCoords) => void
  analysisMode?: boolean
}

interface GisPoint {
  layer: string; id: string; reference: string; title: string
  subtitle: string; lat: number; lng: number; status: string
  color: string; icon: string; commune: string; createdAt: string
  linkedLayer?: string; linkedReference?: string; layers?: string[]
}

function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  })[character] || character)
}

export default function GisView({ selectedCommune, territoryFilter, useTerritoryFilter, onAddIntervention, onMapClick, analysisMode = false }: Props) {
  const { user, setCurrentView, selectedYear, gisFocusLayer, setSelectedType, setSanitarySubTab, setWaterSubTab, setCsvrSubTab, setFoodSubTab, setDossierSubTab, setVectorSubTab, setFuneralSubTab, setEnvironmentSubTab } = useAppStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const accountBoundaryLayerRef = useRef<any>(null)
  const analysisLayerRef = useRef<any>(null)
  const mapClickTimerRef = useRef<number | null>(null)
  const pointsRequestRef = useRef<AbortController | null>(null)
  const mapClickHandlerRef = useRef<((event: { latlng: { lat: number; lng: number } }) => void) | null>(null)
  const mapDoubleClickHandlerRef = useRef<(() => void) | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const selectedCommuneRef = useRef(selectedCommune)
  const scopeCommunesRef = useRef<string[]>([])
  const [points, setPoints] = useState<GisPoint[]>([])
  const [loading, setLoading] = useState(false)
  const initialVisibleLayers = useMemo(() => {
    const hasFocus = Boolean(gisFocusLayer && GIS_LAYERS.some((layer) => layer.key === gisFocusLayer))
    return Object.fromEntries(GIS_LAYERS.map((layer) => [layer.key, hasFocus ? layer.key === gisFocusLayer : true]))
  }, [gisFocusLayer])
  const [visibleLayers, setVisibleLayers] = useState<Record<string, boolean>>(initialVisibleLayers)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [selectedPoint, setSelectedPoint] = useState<GisPoint | null>(null)
  const [layerCounts, setLayerCounts] = useState<Record<string, number>>({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [lastChangedLayerKey, setLastChangedLayerKey] = useState<string | null>(null)
  const [lastLayerAction, setLastLayerAction] = useState<'shown' | 'hidden' | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [densityVisible, setDensityVisible] = useState(false)
  const [bufferMeters, setBufferMeters] = useState(0)

  const visibleLayerKeys = useMemo(
    () => Object.entries(visibleLayers).filter(([, visible]) => visible).map(([key]) => key),
    [visibleLayers],
  )

  useEffect(() => {
    const hasFocus = Boolean(gisFocusLayer && GIS_LAYERS.some((layer) => layer.key === gisFocusLayer))
    if (!hasFocus) return
    setVisibleLayers(Object.fromEntries(GIS_LAYERS.map((layer) => [layer.key, layer.key === gisFocusLayer])))
    setLastChangedLayerKey(gisFocusLayer)
    setLastLayerAction('shown')
  }, [gisFocusLayer])

  const accountCommunes = useMemo(() => {
    if (!user) return []
    const managedCommunes = Array.isArray(user.managedCommunes)
      ? user.managedCommunes.filter((commune) => commune && commune !== 'ALL')
      : []
    if (user.role === 'admin') {
      return selectedCommune !== 'ALL' ? [selectedCommune] : []
    }
    if (managedCommunes.length > 0) return Array.from(new Set(managedCommunes))
    return user.commune !== 'ALL' ? [user.commune] : []
  }, [selectedCommune, user])

  const isGlobalAdminScope = user?.role === 'admin' && selectedCommune === 'ALL'
  const territorySelectedCommune = territoryFilter.communeCode !== ALL_TERRITORIES
    ? ((catalogJson as TerritoryCatalog).communes.find((commune) => commune.code === territoryFilter.communeCode)?.nameAr || null)
    : null

  const scopeCommunes = useMemo(() => {
    if (!user) return []
    const managedCommunes = Array.isArray(user.managedCommunes)
      ? user.managedCommunes.filter((commune) => commune && commune !== 'ALL')
      : []
    if (user.role === 'admin') return selectedCommune !== 'ALL' ? [selectedCommune] : territorySelectedCommune ? [territorySelectedCommune] : []
    if (selectedCommune !== 'ALL' && managedCommunes.includes(selectedCommune)) return [selectedCommune]
    if (managedCommunes.length > 0) return Array.from(new Set(managedCommunes))
    return user.commune !== 'ALL' ? [user.commune] : []
  }, [selectedCommune, territorySelectedCommune, user])

  const scopeZoomKey = scopeCommunes.join('|') || (isGlobalAdminScope ? 'admin-all' : 'points')

  useEffect(() => {
    onMapClickRef.current = onMapClick
    selectedCommuneRef.current = selectedCommune
  }, [onMapClick, selectedCommune])

  useEffect(() => { scopeCommunesRef.current = scopeCommunes }, [scopeCommunes])

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const params = new URLSearchParams()
    const effectiveCommune = user?.role !== 'admin' && user?.commune && user.commune !== 'ALL'
      ? user.commune
      : selectedCommune
    if (effectiveCommune !== 'ALL') params.set('commune', effectiveCommune)
    if (useTerritoryFilter) appendTerritoryParams(params, territoryFilter)
    if (selectedYear) params.set('year', selectedYear)
    params.set('layers', visibleLayerKeys.join(',') || '__none__')
    if (extra) for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return params
  }, [selectedCommune, territoryFilter, useTerritoryFilter, selectedYear, user, visibleLayerKeys])

  const loadPoints = useCallback(async () => {
    pointsRequestRef.current?.abort()
    const controller = new AbortController()
    pointsRequestRef.current = controller
    setLoading(true)
    try {
      const res = await fetch(`/api/gis/points?${buildParams().toString()}`, { signal: controller.signal })
      if (res.ok) {
        const data = await res.json()
        const serverPoints: GisPoint[] = data.points || []
        const pts = serverPoints.filter((point) => (
          isGlobalAdminScope || accountCommunes.includes(point.commune)
        ))
        setPoints(pts)
        // احسب عدّاد كل طبقة
        const counts: Record<string, number> = {}
        for (const p of pts) {
          for (const layer of p.layers || [p.layer]) counts[layer] = (counts[layer] || 0) + 1
        }
        setLayerCounts(counts)
      } else {
        let message = 'تعذر تحميل بيانات الخريطة'
        try {
          const data = await res.json()
          if (typeof data.error === 'string' && data.error) message = data.error
        } catch { /* keep the generic message */ }
        throw new Error(message)
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      toast.error(error instanceof Error ? error.message : 'تعذر تحميل بيانات الخريطة')
    } finally {
      if (pointsRequestRef.current === controller) setLoading(false)
    }
  }, [accountCommunes, buildParams, isGlobalAdminScope])

  useEffect(() => { loadPoints() }, [loadPoints])
  useEffect(() => () => { pointsRequestRef.current?.abort() }, [])

  // النقاط المُفلترة (طبقات مرئية + بحث)
  const filteredPoints = React.useMemo(() => {
    return points.filter(p => {
      if (!(p.layers || [p.layer]).some((layer) => visibleLayers[layer])) return false
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.reference.toLowerCase().includes(q) && !p.title.toLowerCase().includes(q) && !p.subtitle.toLowerCase().includes(q) && !p.commune.toLowerCase().includes(q)) return false
      }
      return true
    })
  }, [points, visibleLayers, search, statusFilter])

  const statusOptions = useMemo(
    () => Array.from(new Set(points.map((point) => point.status).filter(Boolean))).sort((first, second) => first.localeCompare(second, 'ar')),
    [points],
  )

  // تهيئة الخريطة
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      const leafletModule = await import('leaflet')
      const L = leafletModule.default
      if (typeof window !== 'undefined') (window as unknown as { L?: typeof L }).L = L
      await import('leaflet.markercluster')
      await import('leaflet/dist/leaflet.css')
      if (cancelled || !containerRef.current || mapRef.current) return
      mapRef.current = L.map(containerRef.current, { center: [34.05, -6.8], zoom: 12, zoomControl: true })
      L.DomEvent.disableScrollPropagation(containerRef.current)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 19 }).addTo(mapRef.current)
      const leafletWithClusters = L as typeof L & { markerClusterGroup?: (options?: Record<string, unknown>) => any }
      markersLayerRef.current = typeof leafletWithClusters.markerClusterGroup === 'function'
        ? leafletWithClusters.markerClusterGroup({
          maxClusterRadius: 46,
          spiderfyOnMaxZoom: true,
          showCoverageOnHover: false,
          zoomToBoundsOnClick: true,
          iconCreateFunction: (cluster: { getChildCount: () => number }) => {
            const count = cluster.getChildCount()
            const size = count < 10 ? 40 : count < 50 ? 48 : 56
            const color = count < 10 ? '#059669' : count < 50 ? '#d97706' : '#dc2626'
            return L.divIcon({
              html: `<div style="width:${size}px;height:${size}px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${color};color:white;font:800 14px system-ui;border:3px solid white;box-shadow:0 3px 14px rgba(15,23,42,.3);">${count}</div>`,
              className: '',
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
            })
          },
        })
        : L.layerGroup()
      markersLayerRef.current.addTo(mapRef.current)
      const handleMapClick = (event: { latlng: { lat: number; lng: number } }) => {
        if (mapClickTimerRef.current !== null) window.clearTimeout(mapClickTimerRef.current)
          mapClickTimerRef.current = window.setTimeout(() => {
            mapClickTimerRef.current = null
            void (async () => {
              const latitude = event.latlng.lat
              const longitude = event.latlng.lng
              const scopedCommunes = scopeCommunesRef.current
              let detectedCommune: string | null = null
              if (scopedCommunes.length > 0) {
                try {
                  const response = await fetch(`/api/geocode/reverse?lat=${latitude}&lng=${longitude}`)
                  const data = response.ok ? await response.json() as { found?: boolean; commune?: string } : null
                  detectedCommune = data?.found && data.commune ? data.commune : null
                } catch {
                  detectedCommune = null
                }
                if (!detectedCommune || !scopedCommunes.includes(detectedCommune)) {
                  toast.error('لا يمكن إنشاء تدخل خارج حدود جماعة الحساب')
                  return
                }
              }
              onMapClickRef.current({
                latitude,
                longitude,
                commune: detectedCommune || (selectedCommuneRef.current !== 'ALL' ? selectedCommuneRef.current : null),
                quartier: null,
              })
            })()
          }, 260)
      }
      const handleMapDoubleClick = () => {
        if (mapClickTimerRef.current !== null) {
          window.clearTimeout(mapClickTimerRef.current)
          mapClickTimerRef.current = null
        }
      }
      mapClickHandlerRef.current = handleMapClick
      mapDoubleClickHandlerRef.current = handleMapDoubleClick
      mapRef.current.on('click', handleMapClick)
      mapRef.current.on('dblclick', handleMapDoubleClick)
      setMapReady(true)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 100)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 400)
      setTimeout(() => { if (!cancelled && mapRef.current) mapRef.current.invalidateSize() }, 1000)
    }
    init()
    return () => {
      cancelled = true
      if (mapClickTimerRef.current !== null) {
        window.clearTimeout(mapClickTimerRef.current)
        mapClickTimerRef.current = null
      }
      if (mapRef.current) {
        if (mapClickHandlerRef.current) mapRef.current.off('click', mapClickHandlerRef.current)
        if (mapDoubleClickHandlerRef.current) mapRef.current.off('dblclick', mapDoubleClickHandlerRef.current)
      }
      setMapReady(false)
    }
  }, [])

  // رسم العلامات عند تغيير النقاط المُفلترة
  useEffect(() => {
    let cancelled = false
    const draw = async () => {
      const L = await import('leaflet')
      if (cancelled || !mapRef.current || !markersLayerRef.current) return
      markersLayerRef.current.clearLayers()
      for (const p of filteredPoints) {
        const icon = L.divIcon({
          html: `<div style="position:relative;width:34px;height:34px;"><div style="position:absolute;inset:0;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${escapeHtml(p.color)};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);"></div><div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:15px;line-height:1;pointer-events:none;">${escapeHtml(p.icon)}</div></div>`,
          className: '', iconSize: [34, 34], iconAnchor: [17, 34], popupAnchor: [0, -32],
        })
        const marker = L.marker([p.lat, p.lng], { icon })
        marker.bindPopup(`
          <div style="min-width:200px;font-family:inherit;direction:rtl;">
            <div style="font-weight:800;font-size:13px;margin-bottom:4px;">${escapeHtml(p.title)}</div>
            <div style="font-size:11px;color:#64748b;margin-bottom:2px;">${escapeHtml(p.reference)}</div>
            ${p.subtitle ? `<div style="font-size:11px;color:#475569;margin-top:4px;">${escapeHtml(p.subtitle)}</div>` : ''}
            <div style="font-size:10px;color:#94a3b8;margin-top:6px;">📍 ${escapeHtml(COMMUNE_LABELS[p.commune] || p.commune)} · ${escapeHtml(p.status)}</div>
            ${p.linkedLayer && p.linkedLayer !== p.layer && p.linkedLayer !== 'interventions' ? `<div style="font-size:10px;color:#64748b;margin-top:4px;">🔗 الطبقة المرتبطة: ${escapeHtml(GIS_LAYERS.find(layer => layer.key === p.linkedLayer)?.label || p.linkedLayer)}</div>` : ''}
            ${GIS_LAYERS.find(layer => layer.key === p.layer)?.section ? `<div style="font-size:10px;color:#64748b;margin-top:4px;">📁 القسم: ${escapeHtml(GIS_LAYERS.find(layer => layer.key === p.layer)?.section)}</div>` : ''}
            ${p.linkedReference ? `<div style="font-size:10px;color:#64748b;margin-top:4px;">🔗 المرجع المرتبط: ${escapeHtml(p.linkedReference)}</div>` : ''}
          </div>
        `)
        markersLayerRef.current.addLayer(marker)
        marker.on('click', (event: any) => {
          L.DomEvent.stopPropagation(event)
          setSelectedPoint(p)
        })
      }
    }
    draw()
    return () => { cancelled = true }
  }, [filteredPoints])

  // إبراز مضلع الجماعة المعنية فقط حتى لا تختلط حدود الحساب بالجماعات المجاورة.
  useEffect(() => {
    let cancelled = false
    const drawAccountBoundaries = async () => {
      if (!mapReady || !mapRef.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return

      if (accountBoundaryLayerRef.current) {
        mapRef.current.removeLayer(accountBoundaryLayerRef.current)
        accountBoundaryLayerRef.current = null
      }
      if (scopeCommunes.length === 0) return

      const boundaryGroup = L.featureGroup()
      await Promise.all(scopeCommunes.map(async (commune) => {
        try {
          const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`)
          if (!response.ok) return
          const data = await response.json() as { geometry?: GeoJSON.Geometry; commune?: string; lat?: number; lng?: number }
          if (!data.geometry || cancelled) return

          const boundary = L.geoJSON({
            type: 'Feature',
            properties: { commune: data.commune || commune },
            geometry: data.geometry,
          } as GeoJSON.Feature, {
            style: {
              color: '#047857',
              weight: 5,
              opacity: 1,
              fillColor: '#10b981',
              fillOpacity: 0.14,
              dashArray: '10 6',
            },
            interactive: false,
          })
          boundaryGroup.addLayer(boundary)

          if (typeof data.lat === 'number' && typeof data.lng === 'number') {
            const label = L.marker([data.lat, data.lng], {
              interactive: false,
              icon: L.divIcon({
                className: '',
                iconSize: [190, 30],
                iconAnchor: [95, 15],
                html: `<div style="background:#047857;color:white;border:2px solid white;border-radius:999px;padding:5px 12px;box-shadow:0 2px 10px rgba(4,120,87,.35);font:700 12px system-ui;text-align:center;white-space:nowrap;">🏛️ ${escapeHtml(data.commune || commune)}</div>`,
              }),
            })
            boundaryGroup.addLayer(label)
          }
        } catch {
          // تبقى الخريطة قابلة للاستعمال حتى عند تعذر تحميل حدود جماعة ما.
        }
      }))

      if (cancelled || !mapRef.current || boundaryGroup.getLayers().length === 0) return
      boundaryGroup.addTo(mapRef.current)
      boundaryGroup.bringToFront()
      accountBoundaryLayerRef.current = boundaryGroup
      const bounds = boundaryGroup.getBounds()
      if (bounds.isValid()) mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }

    void drawAccountBoundaries()
    return () => {
      cancelled = true
      if (accountBoundaryLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(accountBoundaryLayerRef.current)
        accountBoundaryLayerRef.current = null
      }
    }
  }, [mapReady, scopeCommunes, scopeZoomKey])

  useEffect(() => {
    let cancelled = false
    const focusMapOnScope = async () => {
      if (!mapReady || !mapRef.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return

      if (scopeCommunes.length > 0) {
        const scopeBounds = L.latLngBounds([])
        await Promise.all(scopeCommunes.map(async (commune) => {
          try {
            const response = await fetch(`/api/geocode/commune-centroid?commune=${encodeURIComponent(commune)}`)
            if (!response.ok) return
            const data = await response.json()
            if (Array.isArray(data.bounds) && data.bounds.length === 2) scopeBounds.extend(data.bounds)
          } catch {
            return
          }
        }))
        if (!cancelled && mapRef.current && scopeBounds.isValid()) {
          mapRef.current.fitBounds(scopeBounds, { padding: [40, 40], maxZoom: 13 })
          return
        }
      }

      if (!cancelled && mapRef.current && filteredPoints.length > 0) {
        mapRef.current.fitBounds(filteredPoints.map((point) => [point.lat, point.lng] as [number, number]), { padding: [50, 50], maxZoom: 13 })
      }
    }
    void focusMapOnScope()
    return () => { cancelled = true }
  }, [filteredPoints, mapReady, scopeCommunes, scopeZoomKey])

  // أدوات التحليل المكانية الاختيارية في GeoHealth: كثافة تقريبية وBuffer بصري.
  useEffect(() => {
    let cancelled = false
    const drawAnalysisOverlay = async () => {
      if (!mapReady || !mapRef.current) return
      const L = await import('leaflet')
      if (cancelled || !mapRef.current) return

      if (analysisLayerRef.current) {
        mapRef.current.removeLayer(analysisLayerRef.current)
        analysisLayerRef.current = null
      }
      if (!analysisMode || (!densityVisible && !selectedPoint && bufferMeters === 0)) return

      const group = L.layerGroup()
      if (densityVisible) {
        const grid = new Map<string, { lat: number; lng: number; count: number }>()
        const gridSize = 0.0015
        for (const point of filteredPoints) {
          const latKey = Math.floor(point.lat / gridSize)
          const lngKey = Math.floor(point.lng / gridSize)
          const key = `${latKey}:${lngKey}`
          const cell = grid.get(key)
          if (cell) cell.count += 1
          else grid.set(key, { lat: (latKey + 0.5) * gridSize, lng: (lngKey + 0.5) * gridSize, count: 1 })
        }
        for (const cell of grid.values()) {
          const color = cell.count >= 10 ? '#dc2626' : cell.count >= 4 ? '#f59e0b' : '#10b981'
          const radius = Math.min(450, 90 + cell.count * 35)
          L.circle([cell.lat, cell.lng], { radius, color, weight: 1, fillColor: color, fillOpacity: Math.min(0.42, 0.16 + cell.count * 0.025), interactive: false }).addTo(group)
        }
      }
      if (selectedPoint && bufferMeters > 0) {
        L.circle([selectedPoint.lat, selectedPoint.lng], { radius: bufferMeters, color: '#2563eb', weight: 3, dashArray: '8 6', fillColor: '#60a5fa', fillOpacity: 0.12, interactive: false }).addTo(group)
      }
      if (cancelled || !mapRef.current || group.getLayers().length === 0) return
      group.addTo(mapRef.current)
      analysisLayerRef.current = group
    }

    void drawAnalysisOverlay()
    return () => {
      cancelled = true
      if (analysisLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(analysisLayerRef.current)
        analysisLayerRef.current = null
      }
    }
  }, [analysisMode, bufferMeters, densityVisible, filteredPoints, mapReady, selectedPoint])

  const toggleLayer = (key: string) => {
    setVisibleLayers(prev => {
      const nextValue = !prev[key]
      setLastChangedLayerKey(key)
      setLastLayerAction(nextValue ? 'shown' : 'hidden')
      return { ...prev, [key]: nextValue }
    })
  }

  const setAllLayersVisibility = (visible: boolean) => {
    setVisibleLayers(Object.fromEntries(GIS_LAYERS.map(layer => [layer.key, visible])))
    setLastChangedLayerKey(null)
    setLastLayerAction(visible ? 'shown' : 'hidden')
  }

  const orderedLayers = React.useMemo(() => {
    if (!lastChangedLayerKey) return GIS_LAYERS
    const changedLayer = GIS_LAYERS.find(layer => layer.key === lastChangedLayerKey)
    if (!changedLayer) return GIS_LAYERS
    return [changedLayer, ...GIS_LAYERS.filter(layer => layer.key !== lastChangedLayerKey)]
  }, [lastChangedLayerKey])

  const populatedVisibleLayers = useMemo(
    () => visibleLayerKeys.filter((key) => (layerCounts[key] || 0) > 0),
    [layerCounts, visibleLayerKeys],
  )

  const scopeLabel = scopeCommunes.length > 0
    ? scopeCommunes.map((commune) => COMMUNE_LABELS[commune] || commune).join('، ')
    : isGlobalAdminScope ? 'كل النطاق الوطني' : 'حسب البيانات المتاحة'

  const fitMapToPoints = () => {
    if (!mapRef.current) return
    const boundaryBounds = accountBoundaryLayerRef.current?.getBounds?.()
    if (boundaryBounds?.isValid?.()) {
      mapRef.current.fitBounds(boundaryBounds, { padding: [50, 50], maxZoom: 14 })
      return
    }
    if (filteredPoints.length === 0) return
    const bounds = filteredPoints.map((point) => [point.lat, point.lng] as [number, number])
    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
  }

  const focusSelectedPoint = () => {
    if (!mapRef.current || !selectedPoint) return
    mapRef.current.setView([selectedPoint.lat, selectedPoint.lng], Math.max(mapRef.current.getZoom(), 16), { animate: true })
  }

  const toggleFullscreen = async () => {
    const mapContainer = containerRef.current?.parentElement
    if (!mapContainer) return
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await mapContainer.requestFullscreen()
      setIsFullscreen(Boolean(document.fullscreenElement))
      setTimeout(() => mapRef.current?.invalidateSize(), 100)
    } catch {
      toast.error('تعذر تفعيل ملء الشاشة')
    }
  }

  const exportGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      features: filteredPoints.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { layer: p.layer, layers: p.layers || [p.layer], linkedLayer: p.linkedLayer || p.layer, reference: p.reference, title: p.title, status: p.status, commune: p.commune, subtitle: p.subtitle },
      })),
    }
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `gis-export-${new Date().toISOString().slice(0, 10)}.geojson`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`تم تصدير ${filteredPoints.length} نقطة`)
  }

  const navigateToPoint = (p: GisPoint) => {
    const layer = GIS_LAYERS.find(item => item.key === p.layer)
    if (!layer) return
    if (['interventions', 'deratisation', 'desinsectisation', 'desinfection'].includes(p.layer)) {
      setSelectedType(p.layer === 'deratisation' ? 'DERATISATION' : p.layer === 'desinsectisation' ? 'DESINSECTISATION' : p.layer === 'desinfection' ? 'DESINFECTION' : 'ALL')
    }
    if (['establishments', 'inspections', 'healthCards', 'samples'].includes(p.layer)) setSanitarySubTab(p.layer as 'establishments' | 'inspections' | 'healthCards' | 'samples')
    if (['waterPoints', 'waterMeasurements', 'waterSamples', 'waterInspections', 'waterActions', 'waterDisinfection', 'waterAlerts', 'waterIncidents', 'pools', 'sanitation', 'sanitationAssets'].includes(p.layer)) {
      const waterTab = p.layer === 'waterPoints' ? 'points' : p.layer === 'waterMeasurements' ? 'measurements' : p.layer === 'waterSamples' ? 'samples' : p.layer === 'waterInspections' ? 'inspections' : p.layer === 'waterActions' ? 'actions' : p.layer === 'waterDisinfection' ? 'disinfection' : p.layer === 'waterAlerts' ? 'alerts' : p.layer === 'waterIncidents' ? 'incidents' : p.layer === 'sanitationAssets' ? 'assets' : p.layer as 'pools' | 'sanitation'
      setWaterSubTab(waterTab)
    }
    if (['animals', 'captureMissions', 'capturedAnimals', 'animalDestinations', 'animalHotspots', 'animalDeaths', 'animalHealthAlerts', 'animalCenters'].includes(p.layer)) setCsvrSubTab(p.layer === 'animals' ? 'reports' : p.layer === 'captureMissions' ? 'missions' : p.layer === 'animalDestinations' ? 'care' : p.layer === 'animalHotspots' ? 'hotspots' : p.layer === 'animalDeaths' ? 'deaths' : p.layer === 'animalHealthAlerts' ? 'health' : p.layer === 'animalCenters' ? 'centers' : 'animals')
    if (p.layer === 'foodReports') setFoodSubTab('list')
    if (p.layer === 'dossiers') setDossierSubTab('list')
    if (p.layer === 'biteCases') setVectorSubTab('bites')
    if (['cemeteries', 'burials', 'exhumations'].includes(p.layer)) setFuneralSubTab(p.layer as 'cemeteries' | 'burials' | 'exhumations')
    if (['environmentalDossiers', 'pollution', 'waste', 'sites'].includes(p.layer)) setEnvironmentSubTab(p.layer === 'environmentalDossiers' ? 'dossiers' : p.layer as 'pollution' | 'waste' | 'sites')
    setCurrentView(layer.view as any)
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* الترويسة */}
      <div className="bg-gradient-to-l from-slate-700 to-gray-800 rounded-2xl p-4 sm:p-5 text-white shadow-lg">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2"><span className="text-2xl sm:text-3xl">🗺️</span> نظام المعلومات الجغرافية</h1>
            <p className="text-slate-200 text-xs sm:text-sm mt-0.5">خريطة موحّدة للبيانات الميدانية · {points.length} نقطة من {Object.keys(layerCounts).filter((key) => layerCounts[key] > 0).length} طبقة</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden rounded-xl bg-white/10 px-3 py-2 text-[11px] font-bold text-white/90 sm:inline-flex">📍 {scopeLabel}</span>
            <button type="button" onClick={() => setAllLayersVisibility(true)} className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-600">✅ إظهار الكل</button>
            <button type="button" onClick={() => setAllLayersVisibility(false)} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/25">◌ إخفاء الكل</button>
            <button onClick={() => loadPoints()} disabled={loading}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
              {loading ? '⏳ جارٍ التحديث...' : '↻ تحديث يدوي'}
            </button>
            <button onClick={exportGeoJSON} disabled={filteredPoints.length === 0}
              className="px-3 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40">
              📥 تصدير GeoJSON ({filteredPoints.length})
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: 'إجمالي النقاط', value: points.length, icon: '📍', tone: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'النقاط المعروضة', value: filteredPoints.length, icon: '👁️', tone: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'طبقات بها بيانات', value: populatedVisibleLayers.length, icon: '🗂️', tone: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'النطاق الحالي', value: scopeCommunes.length || (isGlobalAdminScope ? 'وطني' : 'تلقائي'), icon: '🧭', tone: 'text-violet-700', bg: 'bg-violet-50' },
        ].map((card) => (
          <div key={card.label} className={`rounded-2xl border border-slate-100 ${card.bg} px-3 py-3 shadow-sm`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-500">{card.label}</span>
              <span className="text-lg">{card.icon}</span>
            </div>
            <div className={`mt-1 text-xl font-black ${card.tone}`}>{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 items-start gap-4">
        {/* لوحة التحكم (1/4) */}
        <div className="lg:col-span-1 space-y-3 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1">
          {/* بحث */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3">
            <div className="relative">
              <input type="search" placeholder="🔍 بحث بالمرجع أو الوصف أو الجماعة..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 pl-8 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-400" />
              {search && <button type="button" onClick={() => setSearch('')} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700" aria-label="مسح البحث">✕</button>}
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-400" aria-label="فلترة حالة النقاط">
              <option value="ALL">كل الحالات</option>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
              <span>{search || statusFilter !== 'ALL' ? `النتائج: ${filteredPoints.length}` : 'البحث يشمل جميع الطبقات الظاهرة'}</span>
              {(search || statusFilter !== 'ALL') && <button type="button" onClick={() => { setSearch(''); setStatusFilter('ALL') }} className="font-bold text-emerald-700 hover:text-emerald-800">مسح الفلاتر</button>}
            </div>
          </div>

          {/* طبقات */}
          <div className="bg-white rounded-2xl border border-slate-100 p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="text-xs font-bold text-slate-600 flex items-center gap-1">🗂️ الطبقات</h3>
              <span className="text-[10px] text-slate-400">{Object.values(visibleLayers).filter(Boolean).length}/{GIS_LAYERS.length} ظاهرة</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => setAllLayersVisibility(true)}
                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-2 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100"
              >
                ✅ إظهار الكل
              </button>
              <button
                onClick={() => setAllLayersVisibility(false)}
                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-[11px] font-bold text-slate-600 transition hover:bg-slate-100"
              >
                ◌ إخفاء الكل
              </button>
            </div>
            {lastLayerAction && (
              <div className={`mb-3 rounded-xl border px-2.5 py-2 text-[10px] font-bold ${lastChangedLayerKey ? 'bg-slate-50 text-slate-600' : 'bg-emerald-50 text-emerald-700'}`}>
                {lastChangedLayerKey
                  ? `آخر تغيير: ${GIS_LAYERS.find(layer => layer.key === lastChangedLayerKey)?.label || lastChangedLayerKey} — ${lastLayerAction === 'shown' ? 'ظاهرة' : 'مخفية'}`
                  : lastLayerAction === 'shown' ? 'تم إظهار جميع الطبقات' : 'تم إخفاء جميع الطبقات'}
              </div>
            )}
            <div className="space-y-1">
              {orderedLayers.map((layer, index) => {
                const active = visibleLayers[layer.key]
                const count = layerCounts[layer.key] || 0
                const isLastChanged = layer.key === lastChangedLayerKey
                return (
                  <button key={layer.key} onClick={() => toggleLayer(layer.key)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-bold transition border-2 ${
                      active ? 'border-transparent text-white' : 'border-slate-200 bg-white text-slate-400 opacity-60'
                    } ${isLastChanged ? 'ring-2 ring-amber-400 ring-offset-1' : ''}`}
                    style={active ? { background: layer.color } : {}}>
                    <span className="text-sm">{layer.icon}</span>
                    <span className="flex-1 text-right"><span className="block">{layer.label}</span><span className={`block text-[9px] font-normal ${active ? 'text-white/75' : 'text-slate-400'}`}>{layer.section}</span></span>
                    {isLastChanged && index === 0 && <span className="rounded bg-amber-300 px-1 py-0.5 text-[8px] text-amber-950">آخر تغيير</span>}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${active ? 'bg-white/25' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* النقطة المحددة */}
          {selectedPoint && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-slate-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-600">النقطة المحددة</h3>
                <button onClick={() => setSelectedPoint(null)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>
              <div className="text-sm font-bold text-slate-800">{selectedPoint.title}</div>
              <div className="text-xs text-slate-500">{selectedPoint.reference}</div>
              {selectedPoint.subtitle && <div className="text-xs text-slate-600">{selectedPoint.subtitle}</div>}
              <div className="flex items-center gap-2 text-[10px] text-slate-400 flex-wrap">
                <span className="px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: selectedPoint.color + '15', color: selectedPoint.color }}>{selectedPoint.status}</span>
                <span>📍 {COMMUNE_LABELS[selectedPoint.commune] || selectedPoint.commune}</span>
                <span>📁 {GIS_LAYERS.find(layer => layer.key === selectedPoint.layer)?.section || 'نظام المعلومات الجغرافية'}</span>
                {selectedPoint.linkedLayer && selectedPoint.linkedLayer !== selectedPoint.layer && selectedPoint.linkedLayer !== 'interventions' && <span>🔗 {GIS_LAYERS.find(layer => layer.key === selectedPoint.linkedLayer)?.label || selectedPoint.linkedLayer}</span>}
                {selectedPoint.linkedReference && <span>🔗 {selectedPoint.linkedReference}</span>}
              </div>
              <button onClick={focusSelectedPoint} className="w-full px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100">
                ⌖ التركيز على موقع النقطة
              </button>
              <button onClick={() => navigateToPoint(selectedPoint)} className="w-full px-3 py-1.5 text-xs font-bold text-white bg-slate-700 rounded-lg hover:bg-slate-800">
                عرض في الوحدة المعنية ←
              </button>
            </motion.div>
          )}
        </div>

        {/* الخريطة (3/4) */}
        <div className="lg:col-span-3 space-y-2 lg:sticky lg:top-4 lg:self-start lg:z-10 lg:h-[calc(100vh-2rem)]">
          <div className="relative">
            <div
              ref={containerRef}
              className="w-full h-[70vh] min-h-[500px] rounded-2xl border border-slate-200 overflow-hidden shadow-sm touch-none overscroll-contain"
              style={{ background: '#e5e7eb', touchAction: 'none', overscrollBehavior: 'contain' }}
            />
            <div className="absolute top-3 left-3 z-[1000] flex flex-col gap-2" dir="ltr">
              <div className="rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-lg backdrop-blur-sm">
                <button onClick={() => mapRef.current?.zoomIn()} className="flex h-9 w-9 items-center justify-center rounded-lg text-xl font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" title="تكبير الخريطة" aria-label="تكبير الخريطة">+</button>
                <button onClick={() => mapRef.current?.zoomOut()} className="flex h-9 w-9 items-center justify-center rounded-lg border-t border-slate-100 text-xl font-black text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" title="تصغير الخريطة" aria-label="تصغير الخريطة">−</button>
              </div>
              <div className="rounded-xl border border-slate-200/80 bg-white/95 p-1 shadow-lg backdrop-blur-sm">
              <button onClick={fitMapToPoints} disabled={filteredPoints.length === 0} className="flex h-9 w-9 items-center justify-center rounded-lg text-base text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40" title="إظهار جميع النقاط" aria-label="إظهار جميع النقاط">⌖</button>
                <button onClick={toggleFullscreen} className="flex h-9 w-9 items-center justify-center rounded-lg border-t border-slate-100 text-base text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" title={isFullscreen ? 'إغلاق ملء الشاشة' : 'ملء الشاشة'} aria-label={isFullscreen ? 'إغلاق ملء الشاشة' : 'ملء الشاشة'}>⛶</button>
              </div>
              <button onClick={onAddIntervention} className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700" title="إضافة تدخل جديد" aria-label="إضافة تدخل جديد">＋</button>
            </div>
            {analysisMode && (
              <div className="absolute right-3 top-3 z-[1000] max-w-[230px] rounded-xl border border-slate-200/80 bg-white/95 p-2 text-right shadow-lg backdrop-blur-sm" dir="rtl">
                <div className="mb-2 text-[11px] font-black text-slate-700">🧪 أدوات التحليل المكاني</div>
                <button type="button" onClick={() => setDensityVisible((visible) => !visible)} className={`mb-2 w-full rounded-lg px-2 py-1.5 text-[10px] font-bold ${densityVisible ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                  {densityVisible ? '🔥 إخفاء كثافة النقاط' : '🔥 إظهار كثافة النقاط'}
                </button>
                <label className="block text-[10px] font-bold text-slate-500" htmlFor="geohealth-buffer">Buffer حول النقطة المحددة</label>
                <select id="geohealth-buffer" value={bufferMeters} onChange={(event) => setBufferMeters(Number(event.target.value))} disabled={!selectedPoint} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">
                  <option value={0}>بدون Buffer</option>
                  <option value={500}>500 متر</option>
                  <option value={1000}>1 كلم</option>
                  <option value={2500}>2.5 كلم</option>
                  <option value={5000}>5 كلم</option>
                </select>
                {!selectedPoint && <p className="mt-1 text-[9px] text-slate-400">اختر نقطة من الخريطة أولاً.</p>}
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-[900] -translate-x-1/2 rounded-lg border border-emerald-100/80 bg-white/90 px-3 py-1.5 text-[10px] font-bold text-emerald-700 shadow-md backdrop-blur-sm">
              انقر على مكان في الخريطة لإضافة تدخل مرتبط بالموقع
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>عرض {filteredPoints.length} نقطة من {points.length}</span>
            <span className="flex items-center gap-1">
              {loading && <span className="animate-pulse">جارٍ التحميل...</span>}
              <span>· افتح نافذة منبثقة بالنقر على علامة</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
