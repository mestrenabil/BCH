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
const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6', EN_COURS: '#f59e0b', TERMINEE: '#10b981', ANNULEE: '#6b7280',
}
const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981',
}
const TYPE_ICONS: Record<string, string> = { DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴' }

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

function getCommuneForPoint(lat: number, lng: number): string | null {
  for (const feature of COMMUNES_GEOJSON.features) {
    const coords = feature.geometry.coordinates[0]
    if (isPointInPolygon(lat, lng, coords)) {
      for (const [key, fullName] of Object.entries(COMMUNE_NAME_MAP)) {
        if (feature.properties.name === fullName) return key
      }
      return feature.properties.name || null
    }
  }
  return null
}

function createInterventionIcon(type: string, statut?: string): L.DivIcon {
  const color = TYPE_COLORS[type] || '#666'
  const icon = TYPE_ICONS[type] || '📍'
  const isTerminee = statut === 'TERMINEE'
  const isAnnulee = statut === 'ANNULEE'
  const opacity = isAnnulee ? 0.5 : 1
  const ring = isTerminee ? `<div style="position:absolute;top:-3px;right:-3px;width:12px;height:12px;background:#10b981;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;font-size:7px;color:white;">✓</div>` : ''

  return L.divIcon({
    html: `<div style="position:relative;opacity:${opacity};">
      <div style="
        background: ${color};
        width: 34px; height: 34px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; border: 3px solid white;
        box-shadow: 0 4px 14px rgba(0,0,0,0.3);
        ${isAnnulee ? 'filter: grayscale(0.6);' : ''}
      ">${icon}</div>
      ${ring}
    </div>`,
    className: '', iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -20],
  })
}

function createQuartierIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      background: linear-gradient(135deg, #0d9488, #14b8a6);
      width: 16px; height: 16px; border-radius: 50%;
      border: 3px solid white; box-shadow: 0 2px 10px rgba(13,148,136,0.4);
    "></div>`,
    className: '', iconSize: [16, 16], iconAnchor: [8, 8],
  })
}

function createNewInterventionMarkerIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="position:relative;">
      <div style="
        background: linear-gradient(135deg, #059669, #10b981);
        width: 40px; height: 40px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; border: 3px solid white;
        box-shadow: 0 4px 20px rgba(5,150,105,0.5);
        animation: pulse-green 2s infinite;
      ">➕</div>
      <style>
        @keyframes pulse-green {
          0% { box-shadow: 0 0 0 0 rgba(5,150,105,0.5); }
          70% { box-shadow: 0 0 0 15px rgba(5,150,105,0); }
          100% { box-shadow: 0 0 0 0 rgba(5,150,105,0); }
        }
      </style>
    </div>`,
    className: '', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -24],
  })
}

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
          const size = count < 10 ? 40 : count < 50 ? 48 : 56
          const color = count < 10 ? '#10b981' : count < 50 ? '#f59e0b' : '#ef4444'
          return L.divIcon({
            html: `<div style="
              background: ${color};
              width: ${size}px; height: ${size}px; border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              color: white; font-weight: 800; font-size: 14px;
              border: 3px solid white;
              box-shadow: 0 4px 16px rgba(0,0,0,0.3);
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

export default function MapComponent({ interventions, quartiers, selectedCommune, onMapClick }: { 
  interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: string;
  onMapClick?: (lat: number, lng: number, commune: string | null) => void 
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const communeLayersRef = useRef<Record<string, L.GeoJSON>>({})
  const communeLabelsRef = useRef<L.Marker[]>([])
  const communeLayerGroupRef = useRef<L.LayerGroup | null>(null)
  const clickMarkerRef = useRef<L.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)

  // Keep the callback ref up-to-date
  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [34.052, -6.735], zoom: 13, zoomControl: false,
    })

    L.control.zoom({ position: 'topleft' }).addTo(map)

    // Add scale control
    L.control.scale({ position: 'bottomleft', imperial: false, metric: true }).addTo(map)

    // Professional tile layers
    const lightLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    })

    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: '© Esri',
      maxZoom: 19,
    })

    const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    })

    lightLayer.addTo(map)

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
          const bounds = layer.getBounds()
          const center = bounds.getCenter()

          // Commune name label with professional badge
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

          // Professional popup
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

          const formatNum = (n: string) => Number(n).toLocaleString('ar-MA')

          layer.bindPopup(`
            <div style="direction: rtl; text-align: right; min-width: 300px; font-family: inherit;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                <div style="width: 16px; height: 16px; border-radius: 50%; background: ${color}; box-shadow: 0 2px 8px ${color}44;"></div>
                <strong style="font-size: 16px; color: #1e293b;">${feat.properties?.name || ''}</strong>
                ${isBouknadel ? '<span style="background:#7c3aed18;color:#7c3aed;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:700;">مقر المكتب</span>' : ''}
              </div>
              <div style="background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border-radius: 12px; padding: 12px; font-size: 12px; color: #166534; margin-bottom: 10px; border: 1px solid #bbf7d0;">
                <div style="font-weight: 700; font-size: 11px; color: #15803d; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">📊 الإحصاء العام للسكان والسكنى 2024 — HCP</div>
                ${population ? `<div style="margin-bottom: 4px; font-size: 16px; font-weight: 800; color: #1e293b;">👥 السكان القانونيون: ${formatNum(population)}</div>` : ''}
                ${populationMunicipale ? `<div style="margin-bottom: 3px; font-size: 11px; color: #64748b;">المغاربة: ${formatNum(populationMunicipale)}</div>` : ''}
                ${populationCompteeAPart ? `<div style="margin-bottom: 3px; font-size: 11px; color: #64748b;">🌍 الأجانب: ${formatNum(populationCompteeAPart)}</div>` : ''}
                ${menages ? `<div style="margin-bottom: 3px; font-size: 11px; color: #64748b;">🏠 الأسر: ${formatNum(menages)}</div>` : ''}
                ${codeHCP ? `<div style="margin-top: 6px; font-size: 10px; color: #94a3b8;">كود HCP: ${codeHCP}</div>` : ''}
              </div>
              <div style="background: #f8fafc; border-radius: 12px; padding: 10px; font-size: 12px; color: #64748b; margin-bottom: 10px; border: 1px solid #e2e8f0;">
                ${nameAr ? `<div style="margin-bottom: 4px;">🇲🇦 الاسم المألوف: ${nameAr}</div>` : ''}
                <div style="margin-bottom: 4px;">🇫🇷 ${nameFr}</div>
                <div style="margin-bottom: 4px;">🇬🇧 ${nameEn}</div>
              </div>
              <div style="font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
                🗺️ حدود ترابية — ${source.includes('قرار') ? `🇲🇦 ${source}` : source === 'الجريدة الرسمية' ? '🇲🇦 الجريدة الرسمية' : source}
                ${sourceDecree ? `<br>📜 ${sourceDecree}` : ''}
                ${sourceGazette ? `<br>📰 ${sourceGazette}` : ''}
                ${sourcePopulation ? `<br>📊 سكان — ${sourcePopulation}` : ''}
              </div>
            </div>
          `)

          // Hover effects
          layer.on('mouseover', () => {
            layer.setStyle({ fillOpacity: isBouknadel ? 0.22 : 0.15, weight: isBouknadel ? 5 : 3.5 })
          })
          layer.on('mouseout', () => {
            layer.setStyle({ fillOpacity: isBouknadel ? 0.12 : 0.06, weight: isBouknadel ? 4 : 2.5 })
          })
        },
      })

      const shortKey = Object.entries(COMMUNE_NAME_MAP).find(([_, v]) => v === props.name)?.[0] || props.name || ''
      communeLayersRef.current[shortKey] = polygon
      polygon.addTo(communeLayerGroup)
    })

    // Layer control
    L.control.layers(
      { '🗺️ خريطة عادية': lightLayer, '🛰️ صورة ساتلية': satelliteLayer, '🌙 خريطة داكنة': darkLayer },
      { '🏛️ الحدود الترابية': communeLayerGroup },
      { position: 'bottomleft' }
    ).addTo(map)

    // Markers layer
    const markersLayer = createMarkerClusterGroup()
    markersLayerRef.current = markersLayer
    markersLayer.addTo(map)

    // ===== MAP CLICK HANDLER - ADD NEW INTERVENTION =====
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng
      
      // Detect commune for clicked point
      const commune = getCommuneForPoint(lat, lng)
      
      // Remove previous click marker if exists
      if (clickMarkerRef.current) {
        map.removeLayer(clickMarkerRef.current)
      }

      // Create new temporary marker at click location
      const newMarker = L.marker([lat, lng], { 
        icon: createNewInterventionMarkerIcon(),
        zIndexOffset: 1000 
      })

      const communeLabel = commune ? COMMUNE_NAME_MAP[commune] || commune : 'خارج حدود الجماعات'
      const communeColor = commune === 'سيدي أبي القنادل' ? '#7c3aed' : commune === 'سلا' ? '#059669' : commune === 'عامر' ? '#d97706' : '#64748b'

      // Create popup with "Add intervention" button
      const popupContent = `
        <div style="direction: rtl; text-align: right; min-width: 240px; font-family: inherit;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #059669, #10b981); display: flex; align-items: center; justify-content: center; color: white; font-size: 16px;">➕</div>
            <div>
              <strong style="font-size: 14px; color: #0f172a;">إضافة تدخل جديد</strong>
              <div style="font-size: 11px; color: #64748b;">انقر على الزر لإنشاء تدخل في هذا الموقع</div>
            </div>
          </div>
          <div style="background: #f0fdf4; border-radius: 10px; padding: 10px; margin-bottom: 12px; border: 1px solid #bbf7d0;">
            <div style="font-size: 12px; color: #166534; margin-bottom: 4px;">
              📍 <strong>الإحداثيات:</strong> ${lat.toFixed(6)}, ${lng.toFixed(6)}
            </div>
            <div style="font-size: 11px; color: #166534; display: flex; align-items: center; gap: 4px;">
              🏛️ <strong>الجماعة:</strong> 
              <span style="background: ${communeColor}18; color: ${communeColor}; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700;">${communeLabel}</span>
            </div>
          </div>
          <button id="add-intervention-btn" style="
            width: 100%;
            background: linear-gradient(135deg, #059669, #10b981);
            color: white;
            border: none;
            padding: 10px 16px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 700;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            box-shadow: 0 4px 14px rgba(5,150,105,0.3);
            transition: all 0.2s;
            font-family: inherit;
          " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 20px rgba(5,150,105,0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 14px rgba(5,150,105,0.3)'">
            ➕ إضافة تدخل في هذا الموقع
          </button>
        </div>
      `

      newMarker.bindPopup(popupContent, { maxWidth: 300, closeButton: true })
      newMarker.addTo(map)
      clickMarkerRef.current = newMarker

      // Open popup immediately
      newMarker.openPopup()

      // Listen for popup open to attach click handler to the button
      newMarker.on('popupopen', () => {
        setTimeout(() => {
          const btn = document.getElementById('add-intervention-btn')
          if (btn) {
            btn.onclick = () => {
              if (onMapClickRef.current) {
                onMapClickRef.current(lat, lng, commune)
              }
            }
          }
        }, 50)
      })
    })

    mapRef.current = map

    // Fit bounds
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
      Object.entries(communeLayers).forEach(([key, layer]) => {
        const feature = COMMUNES_GEOJSON.features.find(f => f.properties.name === COMMUNE_NAME_MAP[key])
        const color = feature?.properties.color || '#059669'
        const isBouknadel = key === 'سيدي أبي القنادل'
        layer.setStyle({
          color: color, weight: isBouknadel ? 4 : 2.5, opacity: isBouknadel ? 1 : 0.7,
          fillColor: color, fillOpacity: isBouknadel ? 0.12 : 0.06, dashArray: isBouknadel ? '0' : '6, 4',
        })
      })
      labels.forEach(label => { label.setOpacity(1) })
      const allBounds = L.geoJSON(COMMUNES_GEOJSON as GeoJSON.GeoJsonObject).getBounds()
      map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 14 })
    } else {
      Object.entries(communeLayers).forEach(([key, layer]) => {
        const isSelected = key === selectedCommune
        const feature = COMMUNES_GEOJSON.features.find(f => f.properties.name === COMMUNE_NAME_MAP[key])
        const color = feature?.properties.color || '#059669'

        if (isSelected) {
          layer.setStyle({ color: color, weight: 5, opacity: 1, fillColor: color, fillOpacity: 0.18, dashArray: '0' })
          const bounds = layer.getBounds()
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 })
        } else {
          layer.setStyle({ color: '#94a3b8', weight: 1.5, opacity: 0.3, fillColor: '#94a3b8', fillOpacity: 0.03, dashArray: '4, 4' })
        }
      })
      labels.forEach(label => { label.setOpacity(0.3) })
      const selectedLayer = communeLayers[selectedCommune]
      if (selectedLayer) {
        const bounds = selectedLayer.getBounds()
        const center = bounds.getCenter()
        labels.forEach(label => {
          const pos = label.getLatLng()
          if (pos.distanceTo(center) < bounds.getNorthEast().distanceTo(bounds.getSouthWest()) / 2) {
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

    // Quartier markers
    quartiers.forEach((q) => {
      const pointCommune = getCommuneForPoint(q.latitude, q.longitude)
      if (selectedCommune !== 'ALL' && pointCommune !== selectedCommune) return

      const marker = L.marker([q.latitude, q.longitude], { icon: createQuartierIcon() })
      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 160px; font-family: inherit;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <div style="width:32px;height:32px;border-radius:10px;background:linear-gradient(135deg,#0d9488,#14b8a6);display:flex;align-items:center;justify-content:center;color:white;font-size:16px;">🏘️</div>
            <div>
              <strong style="font-size: 14px; color: #0f172a;">${q.nom}</strong>
              <div style="font-size:11px;color:#64748b;">حي سكني — بوقنادل سلا</div>
            </div>
          </div>
        </div>
      `)
      markersLayer.addLayer(marker)
    })

    // Intervention markers with enhanced popups
    interventions.forEach((intervention) => {
      const pointCommune = getCommuneForPoint(intervention.latitude, intervention.longitude)
      if (selectedCommune !== 'ALL' && pointCommune !== selectedCommune) return

      const marker = L.marker([intervention.latitude, intervention.longitude], {
        icon: createInterventionIcon(intervention.type, intervention.statut),
      })
      const dateStr = new Date(intervention.date).toLocaleDateString('ar-MA')
      const color = TYPE_COLORS[intervention.type]
      const statutColor = STATUT_COLORS[intervention.statut]
      const statutLabel = STATUT_LABELS[intervention.statut]

      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 260px; font-family: inherit;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <div style="background: ${color}18; color: ${color}; padding: 4px 12px; border-radius: 14px; font-size: 12px; font-weight: 700;">
              ${TYPE_ICONS[intervention.type]} ${TYPE_LABELS[intervention.type]}
            </div>
            <div style="background: ${statutColor}18; color: ${statutColor}; padding: 4px 10px; border-radius: 14px; font-size: 10px; font-weight: 700;">
              ${statutLabel}
            </div>
          </div>
          <div style="background: linear-gradient(135deg, #f8fafc, #f1f5f9); border-radius: 12px; padding: 12px; margin-bottom: 10px; border: 1px solid #e2e8f0;">
            <div style="margin-bottom: 4px; font-weight: 700; color: #0f172a; font-size: 14px;">📍 ${intervention.quartier}</div>
            <div style="margin-bottom: 4px; color: #64748b; font-size: 12px;">🏠 ${intervention.adresse}</div>
            <div style="color: #64748b; font-size: 12px;">📅 ${dateStr}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 12px;">
            <div style="background:#f8fafc;border-radius:8px;padding:6px 8px;border:1px solid #f1f5f9;">👤 ${intervention.agentNom}</div>
            <div style="background:#f8fafc;border-radius:8px;padding:6px 8px;border:1px solid #f1f5f9;">💊 ${intervention.produitUtilise || '—'}</div>
            <div style="background:#f8fafc;border-radius:8px;padding:6px 8px;border:1px solid #f1f5f9;">📐 ${intervention.superficie || '—'}</div>
            <div style="background:#f8fafc;border-radius:8px;padding:6px 8px;border:1px solid #f1f5f9;">🔢 ${intervention.quantite || '—'}</div>
          </div>
          ${intervention.observations ? `<div style="margin-top: 10px; padding: 8px 10px; background: #fffbeb; border-radius: 10px; font-size: 11px; color: #92400e; border: 1px solid #fef3c7;">💬 ${intervention.observations}</div>` : ''}
          <div style="margin-top:8px;font-size:10px;color:#94a3b8;text-align:left;">${intervention.reference}</div>
        </div>
      `)
      markersLayer.addLayer(marker)
    })
  }, [interventions, quartiers, selectedCommune])

  return <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
}
