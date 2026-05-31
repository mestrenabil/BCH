'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css'
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css'

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

export default function MapComponent({ interventions, quartiers }: { interventions: Intervention[]; quartiers: Quartier[] }) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const clusterGroupRef = useRef<L.MarkerClusterGroup | null>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [34.052, -6.735], zoom: 14, zoomControl: false,
    })

    L.control.zoom({ position: 'topleft' }).addTo(map)

    // Professional tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap © CARTO',
      maxZoom: 19,
    }).addTo(map)

    // Create cluster group with custom styling
    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount()
        const size = count < 10 ? 40 : count < 50 ? 50 : 60
        return L.divIcon({
          html: `<div style="
            background: linear-gradient(135deg, #0d9488, #059669);
            width: ${size}px; height: ${size}px; border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: white; font-weight: bold; font-size: ${size < 50 ? 12 : 14}px;
            border: 3px solid white;
            box-shadow: 0 3px 15px rgba(13,148,136,0.4);
          ">${count}</div>`,
          className: '',
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        })
      },
    })

    clusterGroupRef.current = clusterGroup
    map.addLayer(clusterGroup)
    mapRef.current = map

    return () => { map.remove(); mapRef.current = null }
  }, [])

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current) return
    const clusterGroup = clusterGroupRef.current

    clusterGroup.clearLayers()

    // Add quartier markers directly to map (not clustered)
    quartiers.forEach((q) => {
      const marker = L.marker([q.latitude, q.longitude], { icon: createQuartierIcon() })
      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 120px;">
          <strong style="font-size: 14px; color: #0d9488;">${q.nom}</strong>
          <hr style="margin: 4px 0; border-color: #eee;">
          <small style="color: #666;">حي سكني — بوقنادل سلا</small>
        </div>
      `)
      clusterGroup.addLayer(marker)
    })

    // Add intervention markers
    interventions.forEach((intervention) => {
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
      clusterGroup.addLayer(marker)
    })

    // Fit bounds
    if (interventions.length > 0) {
      const bounds = L.latLngBounds(interventions.map(i => [i.latitude, i.longitude]))
      mapRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 })
    }
  }, [interventions, quartiers])

  return <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
}
