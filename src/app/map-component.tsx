'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'
import COMMUNES_GEOJSON from './communes-data'

interface Intervention {
  id: string; type: string; date: string; quartier: string; adresse: string
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
}

interface Quartier { id: string; nom: string; latitude: number; longitude: number }

const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم',
}
const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة', EN_COURS: 'جارية', TERMINEE: 'منجزة', ANNULEE: 'ملغاة',
}
const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981',
}
const TYPE_ICONS: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴' }

// Mapping from short commune name to GeoJSON feature name
const COMMUNE_NAME_MAP: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
}

// Point-in-polygon (ray casting algorithm)
function isPointInPolygon(lat: number, lng: number, polygon: number[][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1], yi = polygon[i][0]
    const xj = polygon[j][1], yj = polygon[j][0]
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// Determine which commune a point belongs to
function getCommuneForPoint(lat: number, lng: number): string | null {
  for (const feature of COMMUNES_GEOJSON.features) {
    const coords = feature.geometry.coordinates[0]
    if (isPointInPolygon(lat, lng, coords)) {
      // Return the short name key
      for (const [key, fullName] of Object.entries(COMMUNE_NAME_MAP)) {
        if (feature.properties.name === fullName) return key
      }
      return feature.properties.name || null
    }
  }
  return null
}

function createInterventionIcon(type: string): L.DivIcon {
  const color = TYPE_COLORS[type] || '#666'
  const icon = TYPE_ICONS[type] || '📍'
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: 32px; height: 32px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 15px; border: 3px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.25);
    ">${icon}</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
  })
}

function createQuartierIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      background: #0d9488; width: 14px; height: 14px; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    "></div>`,
    className: '', iconSize: [14, 14], iconAnchor: [7, 7],
  })
}

// Safe marker cluster group creation with fallback to regular layer group
function createMarkerClusterGroup(): L.LayerGroup {
  try {
    if (typeof L.markerClusterGroup === 'function') {
      return L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: L.MarkerCluster) => {
          const count = cluster.getChildCount()
          const size = count < 10 ? 36 : count < 50 ? 44 : 52
          const color = count < 10 ? '#10b981' : count < 50 ? '#f59e0b' : '#ef4444'
          return L.divIcon({
            html: `<div style="
              background: ${color};
              width: ${size}px; height: ${size}px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              color: white; font-weight: 700; font-size: 13px;
              border: 3px solid white;
              box-shadow: 0 3px 14px rgba(0,0,0,0.25);
            ">${count}</div>`,
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          })
        },
      })
    }
  } catch (e) {
    console.warn('MarkerCluster not available, falling back to LayerGroup:', e)
  }
  return L.layerGroup()
}

export default function MapComponent({ interventions, quartiers, selectedCommune }: { interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: string }) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const communeLayersRef = useRef<Record<string, L.GeoJSON>>({})
  const communeLabelsRef = useRef<L.Marker[]>([])
  const communeLayerGroupRef = useRef<L.LayerGroup | null>(null)

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [34.052, -6.735], zoom: 13, zoomControl: false,
    })

    L.control.zoom({ position: 'topleft' }).addTo(map)

    // Professional tile layer
    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19,
    })

    lightLayer.addTo(map)

    // Layer control
    const communeLayerGroup = L.layerGroup().addTo(map)
    communeLayerGroupRef.current = communeLayerGroup

    // ===== ADD COMMUNE BOUNDARIES =====
    COMMUNES_GEOJSON.features.forEach((feature) => {
      const props = feature.properties
      const color = props.color || '#059669'
      const isBouknadel = props.nameFr?.includes('Kanadel') || props.nameAr?.includes('بوقنادل') || props.name?.includes('القنادل')

      const polygon = L.geoJSON(feature as GeoJSON.Feature, {
        style: {
          color: color,
          weight: isBouknadel ? 4 : 2.5,
          opacity: isBouknadel ? 1 : 0.7,
          fillColor: color,
          fillOpacity: isBouknadel ? 0.12 : 0.06,
          dashArray: isBouknadel ? '0' : '6, 4',
        },
        onEachFeature: (feat, layer) => {
          // Add commune name label at center
          const bounds = layer.getBounds()
          const center = bounds.getCenter()

          const label = L.marker(center, {
            icon: L.divIcon({
              html: `<div style="
                background: ${color}ee;
                color: white;
                padding: ${isBouknadel ? '8px 18px' : '6px 14px'};
                border-radius: 20px;
                font-size: ${isBouknadel ? '13px' : '11px'};
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 2px 12px ${color}66;
                border: 2px solid white;
                font-family: system-ui, -apple-system, sans-serif;
                letter-spacing: 0.3px;
              ">${feat.properties?.name || ''}</div>`,
              className: '',
              iconAnchor: [60, 15],
            }),
            interactive: false,
          })
          label.addTo(communeLayerGroup)
          communeLabelsRef.current.push(label)

          // Popup with detailed info
          const nameFr = feat.properties?.nameFr || ''
          const nameEn = feat.properties?.nameEn || ''
          const nameAr = feat.properties?.nameAr || ''
          const population = feat.properties?.population || ''
          const populationMunicipale = feat.properties?.populationMunicipale || ''
          const populationCompteeAPart = feat.properties?.populationCompteeAPart || ''
          const menages = feat.properties?.menages || ''
          const codeHCP = feat.properties?.codeHCP || ''
          const sourcePopulation = feat.properties?.sourcePopulation || ''
          const source = feat.properties?.source || ''
          const sourceDecree = feat.properties?.sourceDecree || ''
          const sourceGazette = feat.properties?.sourceGazette || ''
          const sourceProjection = feat.properties?.sourceProjection || ''

          const formatNum = (n: string) => Number(n).toLocaleString('ar-MA')

          layer.bindPopup(`
            <div style="direction: rtl; text-align: right; min-width: 280px; font-family: inherit;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <div style="width: 14px; height: 14px; border-radius: 50%; background: ${color};"></div>
                <strong style="font-size: 15px; color: #1e293b;">${feat.properties?.name || ''}</strong>
                ${isBouknadel ? '<span style="background:#7c3aed18;color:#7c3aed;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;">مقر المكتب</span>' : ''}
              </div>
              <div style="background: #f0fdf4; border-radius: 10px; padding: 10px; font-size: 12px; color: #166534; margin-bottom: 8px; border: 1px solid #bbf7d0;">
                <div style="font-weight: 700; font-size: 11px; color: #15803d; margin-bottom: 6px; display: flex; align-items: center; gap: 4px;">📊 الإحصاء العام للسكان والسكنى 2024 — HCP</div>
                ${population ? `<div style="margin-bottom: 3px; font-size: 14px; font-weight: 700; color: #1e293b;">👥 السكان القانونيون: ${formatNum(population)}</div>` : ''}
                ${populationMunicipale ? `<div style="margin-bottom: 2px; font-size: 11px; color: #64748b;">السكان البلديون: ${formatNum(populationMunicipale)}</div>` : ''}
                ${populationCompteeAPart ? `<div style="margin-bottom: 2px; font-size: 11px; color: #64748b;">السكان المحسوبون على حدة: ${formatNum(populationCompteeAPart)}</div>` : ''}
                ${menages ? `<div style="margin-bottom: 2px; font-size: 11px; color: #64748b;">🏠 الأسر: ${formatNum(menages)}</div>` : ''}
                ${codeHCP ? `<div style="margin-top: 4px; font-size: 10px; color: #94a3b8;">كود HCP: ${codeHCP}</div>` : ''}
              </div>
              <div style="background: #f8fafc; border-radius: 10px; padding: 10px; font-size: 12px; color: #64748b; margin-bottom: 8px;">
                ${nameAr ? `<div style="margin-bottom: 4px;">🇲🇦 الاسم المألوف: ${nameAr}</div>` : ''}
                <div style="margin-bottom: 4px;">🇫🇷 ${nameFr}</div>
                <div style="margin-bottom: 4px;">🇬🇧 ${nameEn}</div>
              </div>
              <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px;">
                🗺️ حدود ترابية — ${source.includes('قرار') ? `🇲🇦 ${source}` : source === 'الجريدة الرسمية' ? '🇲🇦 الجريدة الرسمية' : source}
                ${sourceDecree ? `<br>📜 ${sourceDecree}` : ''}
                ${sourceGazette ? `<br>📰 ${sourceGazette}` : ''}
                ${sourceProjection ? `<br>📐 المسقط: ${sourceProjection}` : ''}
                ${sourcePopulation ? `<br>📊 سكان — ${sourcePopulation}` : ''}
              </div>
            </div>
          `)

          // Hover effects
          layer.on('mouseover', () => {
            layer.setStyle({ fillOpacity: isBouknadel ? 0.22 : 0.15, weight: isBouknadel ? 5 : 3.5 })
          })
          layer.on('mouseout', () => {
            // Only reset if not highlighted by filter
            const isHighlighted = selectedCommune !== 'ALL' && feat.properties?.name === COMMUNE_NAME_MAP[selectedCommune]
            if (!isHighlighted) {
              layer.setStyle({ fillOpacity: isBouknadel ? 0.12 : 0.06, weight: isBouknadel ? 4 : 2.5 })
            }
          })
        },
      })

      // Store reference to the commune layer by its short key name
      const shortKey = Object.entries(COMMUNE_NAME_MAP).find(([_, v]) => v === props.name)?.[0] || props.name || ''
      communeLayersRef.current[shortKey] = polygon
      polygon.addTo(communeLayerGroup)
    })

    // Layer control with base maps + overlay
    L.control.layers(
      { 'خريطة عادية': lightLayer, 'صورة ساتلية': satelliteLayer },
      { 'الحدود الترابية': communeLayerGroup },
      { position: 'bottomleft' }
    ).addTo(map)

    // ===== ADD MARKERS LAYER (with clustering) =====
    const markersLayer = createMarkerClusterGroup()
    markersLayerRef.current = markersLayer
    markersLayer.addTo(map)

    mapRef.current = map

    // Fit bounds to show all boundaries
    const allBounds = L.geoJSON(COMMUNES_GEOJSON as GeoJSON.GeoJsonObject).getBounds()
    map.fitBounds(allBounds, { padding: [30, 30] })

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // ===== HANDLE COMMUNE FILTER CHANGE =====
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const communeLayers = communeLayersRef.current
    const labels = communeLabelsRef.current

    if (selectedCommune === 'ALL') {
      // Show all communes normally
      Object.entries(communeLayers).forEach(([key, layer]) => {
        const feature = COMMUNES_GEOJSON.features.find(f => f.properties.name === COMMUNE_NAME_MAP[key])
        const color = feature?.properties.color || '#059669'
        const isBouknadel = key === 'سيدي أبي القنادل'
        layer.setStyle({
          color: color,
          weight: isBouknadel ? 4 : 2.5,
          opacity: isBouknadel ? 1 : 0.7,
          fillColor: color,
          fillOpacity: isBouknadel ? 0.12 : 0.06,
          dashArray: isBouknadel ? '0' : '6, 4',
        })
      })
      // Show all labels
      labels.forEach(label => { label.setOpacity(1) })

      // Zoom to fit all boundaries
      const allBounds = L.geoJSON(COMMUNES_GEOJSON as GeoJSON.GeoJsonObject).getBounds()
      map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 14 })
    } else {
      // Highlight selected commune, dim others
      Object.entries(communeLayers).forEach(([key, layer]) => {
        const isSelected = key === selectedCommune
        const feature = COMMUNES_GEOJSON.features.find(f => f.properties.name === COMMUNE_NAME_MAP[key])
        const color = feature?.properties.color || '#059669'

        if (isSelected) {
          layer.setStyle({
            color: color,
            weight: 5,
            opacity: 1,
            fillColor: color,
            fillOpacity: 0.18,
            dashArray: '0',
          })
          // Zoom to this commune
          const bounds = layer.getBounds()
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
        } else {
          layer.setStyle({
            color: '#94a3b8',
            weight: 1.5,
            opacity: 0.3,
            fillColor: '#94a3b8',
            fillOpacity: 0.03,
            dashArray: '4, 4',
          })
        }
      })
      // Dim labels of unselected communes
      labels.forEach(label => { label.setOpacity(0.3) })
      // The selected commune label should be visible
      const selectedLayer = communeLayers[selectedCommune]
      if (selectedLayer) {
        const bounds = selectedLayer.getBounds()
        const center = bounds.getCenter()
        // Find and highlight the label near the center
        labels.forEach(label => {
          const pos = label.getLatLng()
          const dist = pos.distanceTo(center)
          if (dist < bounds.getNorthEast().distanceTo(bounds.getSouthWest()) / 2) {
            label.setOpacity(1)
          }
        })
      }
    }
  }, [selectedCommune])

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return
    const markersLayer = markersLayerRef.current
    markersLayer.clearLayers()

    // Add quartier markers (filtered by commune)
    quartiers.forEach((q) => {
      const pointCommune = getCommuneForPoint(q.latitude, q.longitude)
      if (selectedCommune !== 'ALL' && pointCommune !== selectedCommune) return

      const marker = L.marker([q.latitude, q.longitude], { icon: createQuartierIcon() })
      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 120px;">
          <strong style="font-size: 14px; color: #0d9488;">${q.nom}</strong>
          <hr style="margin: 4px 0; border-color: #eee;">
          <small style="color: #666;">حي سكني — بوقنادل سلا</small>
        </div>
      `)
      markersLayer.addLayer(marker)
    })

    // Add intervention markers (filtered by commune)
    interventions.forEach((intervention) => {
      const pointCommune = getCommuneForPoint(intervention.latitude, intervention.longitude)
      if (selectedCommune !== 'ALL' && pointCommune !== selectedCommune) return

      const marker = L.marker([intervention.latitude, intervention.longitude], {
        icon: createInterventionIcon(intervention.type),
      })
      const dateStr = new Date(intervention.date).toLocaleDateString('ar-MA')
      const color = TYPE_COLORS[intervention.type]

      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 220px; font-size: 13px; font-family: inherit;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
            <span style="background: ${color}18; color: ${color}; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: bold;">
              ${TYPE_LABELS[intervention.type]}
            </span>
            <span style="font-weight: bold; font-size: 12px; color: #334155;">${intervention.reference}</span>
          </div>
          <div style="background: #f8fafc; border-radius: 10px; padding: 10px; margin-bottom: 10px;">
            <div style="margin-bottom: 4px; font-weight: 600; color: #1e293b;">📍 ${intervention.quartier}</div>
            <div style="margin-bottom: 4px; color: #64748b; font-size: 12px;">🏠 ${intervention.adresse}</div>
            <div style="color: #64748b; font-size: 12px;">📅 ${dateStr}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px; color: #64748b;">
            <div>👤 ${intervention.agentNom}</div>
            <div>💊 ${intervention.produitUtilise || '—'}</div>
            <div>📐 ${intervention.superficie || '—'}</div>
            <div>🔢 ${intervention.quantite || '—'}</div>
          </div>
          ${intervention.observations ? `<div style="margin-top: 8px; padding: 6px 8px; background: #fffbeb; border-radius: 8px; font-size: 11px; color: #92400e; border: 1px solid #fef3c7;">💬 ${intervention.observations}</div>` : ''}
        </div>
      `)
      markersLayer.addLayer(marker)
    })
  }, [interventions, quartiers, selectedCommune])

  return <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
}
