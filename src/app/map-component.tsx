'use client'

import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface Intervention {
  id: string
  type: string
  date: string
  quartier: string
  adresse: string
  latitude: number
  longitude: number
  statut: string
  description: string
  agentNom: string
  produitUtilise: string
  quantite: string
  superficie: string
  nombrePrestations: number
  observations: string
  reference: string
}

interface Quartier {
  id: string
  nom: string
  latitude: number
  longitude: number
}

const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
}

const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة',
  EN_COURS: 'جارية',
  TERMINEE: 'منجزة',
  ANNULEE: 'ملغاة',
}

const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444',
  DESINSECTISATION: '#f59e0b',
  DESINFECTION: '#10b981',
}

const TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀',
  DESINSECTISATION: '🦟',
  DESINFECTION: '🧴',
}

function createCircleIcon(type: string): L.DivIcon {
  const color = TYPE_COLORS[type] || '#666'
  const icon = TYPE_ICONS[type] || '📍'
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      border: 2px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    ">${icon}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

function createQuartierIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      background: oklch(0.45 0.15 160);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    "></div>`,
    className: '',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  })
}

export default function MapComponent({ interventions, quartiers }: { interventions: Intervention[]; quartiers: Quartier[] }) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Initialize map centered on Bouknaquel Salé
    const map = L.map(mapContainerRef.current, {
      center: [34.052, -6.735],
      zoom: 14,
      zoomControl: false,
    })

    // Add zoom control to the left side (since RTL)
    L.control.zoom({ position: 'topleft' }).addTo(map)

    // Add tile layer - OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Update markers when data changes
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current

    // Clear existing layers except tile layer
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.CircleMarker) {
        map.removeLayer(layer)
      }
    })

    // Add quartier markers
    quartiers.forEach((q) => {
      const marker = L.marker([q.latitude, q.longitude], {
        icon: createQuartierIcon(),
      }).addTo(map)

      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 120px;">
          <strong style="font-size: 14px; color: oklch(0.45 0.15 160);">${q.nom}</strong>
          <hr style="margin: 4px 0; border-color: #eee;">
          <small style="color: #666;">حي سكني</small>
        </div>
      `)
    })

    // Add intervention markers
    interventions.forEach((intervention) => {
      const marker = L.marker([intervention.latitude, intervention.longitude], {
        icon: createCircleIcon(intervention.type),
      }).addTo(map)

      const dateStr = new Date(intervention.date).toLocaleDateString('ar-MA')
      const color = TYPE_COLORS[intervention.type]

      marker.bindPopup(`
        <div style="direction: rtl; text-align: right; min-width: 200px; font-size: 13px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
            <span style="background: ${color}20; color: ${color}; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: bold;">
              ${TYPE_LABELS[intervention.type]}
            </span>
            <span style="font-weight: bold; font-size: 12px;">${intervention.reference}</span>
          </div>
          <div style="background: #f8f9fa; border-radius: 8px; padding: 8px; margin-bottom: 8px;">
            <div style="margin-bottom: 4px;">📍 <strong>${intervention.quartier}</strong></div>
            <div style="margin-bottom: 4px; color: #666;">🏠 ${intervention.adresse}</div>
            <div style="color: #666;">📅 ${dateStr}</div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 12px; color: #666;">
            <div>👤 ${intervention.agentNom}</div>
            <div>💊 ${intervention.produitUtilise || '-'}</div>
            <div>📐 ${intervention.superficie || '-'}</div>
            <div>🔢 الكمية: ${intervention.quantite || '-'}</div>
          </div>
          ${intervention.observations ? `<div style="margin-top: 8px; padding: 6px; background: #fff8e1; border-radius: 6px; font-size: 11px; color: #856404;">💬 ${intervention.observations}</div>` : ''}
        </div>
      `)
    })

    // Fit bounds if there are markers
    if (interventions.length > 0) {
      const bounds = L.latLngBounds(interventions.map(i => [i.latitude, i.longitude]))
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [interventions, quartiers])

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ minHeight: '400px' }}
    />
  )
}
