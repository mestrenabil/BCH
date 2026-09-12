'use client'

import React, { useCallback, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet.markercluster'

// Extend Leaflet types for marker cluster
declare module 'leaflet' {
  // Add MarkerCluster interface
  interface MarkerCluster extends L.Marker {
    getChildCount(): number
    getAllLeafMarkers(): L.Marker[]
  }
  // Add MarkerClusterGroup interface
  type MarkerClusterGroup = L.LayerGroup
  // Add markerClusterGroup to L namespace
  // eslint-disable-next-line no-var
  var markerClusterGroup: (options?: any) => L.MarkerClusterGroup
}
import COMMUNES_GEOJSON from './communes-data'
import { ALL_TERRITORIES, DEFAULT_TERRITORY_FILTER, appendTerritoryParams, type TerritoryFilter } from '@/lib/geography'
import type { MapClickCoords } from '@/lib/store'
import { communeNamesMatch, findMatchingCommune } from '@/lib/commune-names'

interface InterventionProduct {
  id: string; nom: string; unite: string; quantiteStock: number
}

interface InterventionMaterialItem {
  id: string; interventionId: string; productId: string; quantity: number; createdAt: string
  product: InterventionProduct
}

interface Intervention {
  id: string; type: string; date: string; quartier: string; adresse: string
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
  commune: string
  materials?: InterventionMaterialItem[]
  heureDebut?: string; heureFin?: string
  coutMainOeuvre?: number; coutMateriaux?: number; coutTotal?: number
  photos?: any[]; documents?: any[]
  createdAt?: string; updatedAt?: string
}

interface Quartier { id: string; nom: string; commune: string; latitude: number; longitude: number }

interface ComplaintMapPoint {
  id: string
  reference: string
  nomCitoyen: string
  commune: string
  quartier: string | null
  type: string
  description: string
  priorite: string
  statut: string
  latitude: number | null
  longitude: number | null
  dateReception: string
  source?: string
}

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
const COMPLAINT_TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم', FOOD: 'سلامة غذائية', ANIMAL: 'حيوان شارد',
}
const COMPLAINT_STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE: 'في الانتظار', EN_COURS: 'قيد المعالجة', TRAITEE: 'تمت معالجتها', REJETEE: 'مرفوضة',
}

const COMMUNE_NAME_MAP: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
  'السهول': 'جماعة السهول',
}

// Point-in-polygon (ray casting algorithm)
// GeoJSON coordinates: [longitude, latitude] = [x, y]
// test point: lat = y, lng = x
function isPointInRing(lat: number, lng: number, ring: ReadonlyArray<ReadonlyArray<number>>): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

function isPointInPolygon(lat: number, lng: number, polygon: ReadonlyArray<ReadonlyArray<ReadonlyArray<number>>>): boolean {
  return polygon.length > 0 && isPointInRing(lat, lng, polygon[0]) && !polygon.slice(1).some((ring) => isPointInRing(lat, lng, ring))
}

function isPointInGeometry(lat: number, lng: number, geometry: GeoJSON.Geometry | null): boolean {
  if (!geometry) return false
  if (geometry.type === 'Polygon') return isPointInPolygon(lat, lng, geometry.coordinates)
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.some((polygon) => isPointInPolygon(lat, lng, polygon))
  return false
}

function getCommuneForPoint(lat: number, lng: number, territorialBoundaries?: TerritorialBoundaryData | null): string | null {
  const canonicalSaleFeature = COMMUNES_GEOJSON.features.find((feature) => feature.properties.name === COMMUNE_NAME_MAP['سلا'])
  if (canonicalSaleFeature && isPointInGeometry(lat, lng, canonicalSaleFeature.geometry)) return 'سلا'

  const nationalCommunes = territorialBoundaries?.commune.features ?? []
  for (const feature of nationalCommunes) {
    if (isPointInGeometry(lat, lng, feature.geometry)) {
      const properties = feature.properties as { name?: string; nameAr?: string; nameFr?: string } | null
      return properties?.nameAr || properties?.name || properties?.nameFr || null
    }
  }

  for (const feature of COMMUNES_GEOJSON.features) {
    if (isPointInGeometry(lat, lng, feature.geometry)) {
      for (const [key, fullName] of Object.entries(COMMUNE_NAME_MAP)) {
        if (feature.properties.name === fullName) return key
      }
      return feature.properties.name || null
    }
  }
  return null
}

function getLegacyCommuneForPoint(lat: number, lng: number): string | null {
  for (const feature of COMMUNES_GEOJSON.features) {
    if (!isPointInGeometry(lat, lng, feature.geometry)) continue
    return Object.entries(COMMUNE_NAME_MAP).find(([, name]) => name === feature.properties.name)?.[0] || null
  }
  return null
}

function distanceInMeters(firstLat: number, firstLng: number, secondLat: number, secondLng: number): number {
  const earthRadius = 6_371_000
  const latitudeDelta = (secondLat - firstLat) * Math.PI / 180
  const longitudeDelta = (secondLng - firstLng) * Math.PI / 180
  const latitudeFactor = Math.sin(latitudeDelta / 2)
  const longitudeFactor = Math.sin(longitudeDelta / 2)
  const value = latitudeFactor * latitudeFactor + Math.cos(firstLat * Math.PI / 180) * Math.cos(secondLat * Math.PI / 180) * longitudeFactor * longitudeFactor
  return 2 * earthRadius * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function findNearbyQuartier(lat: number, lng: number, commune: string | null, quartiers: Quartier[]): string | null {
  const candidates = commune ? quartiers.filter((quartier) => quartier.commune === commune) : quartiers
  if (!candidates.length) return null
  let nearest: Quartier | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const quartier of candidates) {
    const distance = distanceInMeters(lat, lng, quartier.latitude, quartier.longitude)
    if (distance < nearestDistance) {
      nearest = quartier
      nearestDistance = distance
    }
  }

  // Always return the nearest quartier, regardless of distance
  return nearest ? nearest.nom : null
}

type TerritorialLevel = 'region' | 'province' | 'commune'

type TerritorialFeature = GeoJSON.Feature<GeoJSON.Geometry, {
  code: string
  name: string
  nameAr?: string
  nameFr?: string
  regionCode: string
  provinceCode?: string | null
  population?: number | null
  households?: number | null
  foreigners?: number | null
  level: TerritorialLevel
}>

type TerritorialBoundaryData = Record<TerritorialLevel, GeoJSON.FeatureCollection>

function canonicalCommuneGeometry(feature: GeoJSON.Feature, level: TerritorialLevel): GeoJSON.Feature {
  if (level !== 'commune') return feature
  const properties = feature.properties as { name?: string; nameAr?: string; nameFr?: string } | null
  const isSale = [properties?.nameAr, properties?.name, properties?.nameFr].some((name) => name && communeNamesMatch(name, 'سلا'))
  if (!isSale) return feature

  const canonicalSaleFeature = COMMUNES_GEOJSON.features.find((candidate) => candidate.properties.name === COMMUNE_NAME_MAP['سلا'])
  return canonicalSaleFeature ? { ...feature, geometry: canonicalSaleFeature.geometry } as GeoJSON.Feature : feature
}

const TERRITORIAL_LAYER_STYLES: Record<TerritorialLevel, L.PathOptions> = {
  region: { color: '#1d4ed8', weight: 3.2, opacity: 0.95, fillColor: '#3b82f6', fillOpacity: 0.025 },
  province: { color: '#7c3aed', weight: 1.6, opacity: 0.8, fillColor: '#8b5cf6', fillOpacity: 0.015, dashArray: '5, 4' },
  commune: { color: '#0f766e', weight: 0.65, opacity: 0.7, fillColor: '#14b8a6', fillOpacity: 0.005 },
}

function territorialFeatureMatches(feature: GeoJSON.Feature, level: TerritorialLevel, filter: TerritoryFilter): boolean {
  const properties = feature.properties as TerritorialFeature['properties']
  if (level === 'region') return filter.regionCode === ALL_TERRITORIES || properties.code === filter.regionCode
  if (level === 'province') {
    if (filter.provinceCode !== ALL_TERRITORIES) return properties.code === filter.provinceCode
    return filter.regionCode === ALL_TERRITORIES || properties.regionCode === filter.regionCode
  }
  if (filter.communeCode !== ALL_TERRITORIES) return properties.code === filter.communeCode
  if (filter.provinceCode !== ALL_TERRITORIES) return properties.provinceCode === filter.provinceCode
  return filter.regionCode === ALL_TERRITORIES || properties.regionCode === filter.regionCode
}

function formatTerritoryNumber(value: number | null | undefined): string {
  return typeof value === 'number' ? value.toLocaleString('ar-MA') : 'غير متاح'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)
}

function territorialPopup(feature: GeoJSON.Feature, level: TerritorialLevel): string {
  const properties = feature.properties as TerritorialFeature['properties']
  const levelLabel = level === 'region' ? 'الجهة' : level === 'province' ? 'الإقليم أو العمالة' : 'الجماعة'
  const households = level === 'commune' ? `<div>الأسر: <strong>${formatTerritoryNumber(properties.households)}</strong></div>` : ''
  const foreigners = level === 'commune' && properties.foreigners != null ? `<div>الأجانب: <strong>${formatTerritoryNumber(properties.foreigners)}</strong></div>` : ''
  return `<div dir="rtl" style="font-family:system-ui,sans-serif;min-width:190px"><strong>${properties.name}</strong><div style="color:#64748b;margin:5px 0">${levelLabel}</div><div>السكان: <strong>${formatTerritoryNumber(properties.population)}</strong></div>${households}${foreigners}<div style="color:#94a3b8;font-size:11px;margin-top:6px">${properties.code}</div></div>`
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

function createComplaintIcon(statut: string): L.DivIcon {
  const color = statut === 'TRAITEE' ? '#16a34a' : statut === 'EN_COURS' ? '#f59e0b' : '#dc2626'
  return L.divIcon({
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 3px 12px rgba(127,29,29,.35);display:flex;align-items:center;justify-content:center;font-size:16px;">📢</div>`,
    className: '', iconSize: [32, 32], iconAnchor: [16, 16], popupAnchor: [0, -18],
  })
}

function buildComplaintPopup(complaint: ComplaintMapPoint): string {
  const typeLabel = COMPLAINT_TYPE_LABELS[complaint.type] || complaint.type
  const statusLabel = COMPLAINT_STATUS_LABELS[complaint.statut] || complaint.statut
  const communeLabel = COMMUNE_NAME_MAP[complaint.commune] || complaint.commune
  const date = complaint.dateReception ? new Date(complaint.dateReception).toLocaleDateString('ar-MA') : '—'
  return `<div dir="rtl" style="font-family:system-ui,sans-serif;min-width:235px;line-height:1.7;">
    <div style="background:linear-gradient(135deg,#991b1b,#dc2626);color:white;padding:10px 12px;border-radius:10px 10px 0 0;">
      <div style="font-size:14px;font-weight:800;">📢 بلاغ ميداني</div>
      <div style="font-size:10px;opacity:.85;margin-top:2px;">${escapeHtml(complaint.reference)}</div>
    </div>
    <div style="padding:10px 12px;color:#334155;">
      <div style="font-weight:800;color:#0f172a;margin-bottom:5px;">${escapeHtml(typeLabel)}</div>
      <div>🏛️ ${escapeHtml(communeLabel)}</div>
      ${complaint.quartier ? `<div>🏘️ ${escapeHtml(complaint.quartier)}</div>` : ''}
      <div>📅 ${escapeHtml(date)}</div>
      <div style="margin-top:6px;padding:6px 8px;border-radius:8px;background:#fef2f2;color:#991b1b;font-weight:700;">الحالة: ${escapeHtml(statusLabel)}</div>
      <div style="margin-top:7px;color:#64748b;font-size:11px;">${escapeHtml(complaint.description || 'بدون وصف')}</div>
    </div>
  </div>`
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

// ===== PROFESSIONAL POPUP STYLING HELPERS =====
const popupBase = `
  direction: rtl;
  text-align: right;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  line-height: 1.6;
  color: #1e293b;
  -webkit-font-smoothing: antialiased;
`

const popupCardShadow = `
  box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid rgba(0,0,0,0.06);
`

function gradientHeader(color1: string, color2: string, content: string): string {
  return `
    <div style="
      background: linear-gradient(135deg, ${color1}, ${color2});
      padding: 14px 16px;
      color: white;
      position: relative;
      overflow: hidden;
    ">
      <div style="position:absolute;top:-20px;left:-20px;width:80px;height:80px;border-radius:50%;background:rgba(255,255,255,0.08);"></div>
      <div style="position:absolute;bottom:-30px;right:-10px;width:60px;height:60px;border-radius:50%;background:rgba(255,255,255,0.05);"></div>
      ${content}
    </div>
  `
}

function sectionCard(bgColor: string, borderColor: string, content: string, extraStyle: string = ''): string {
  return `
    <div style="
      background: ${bgColor};
      border: 1px solid ${borderColor};
      border-radius: 10px;
      padding: 10px 12px;
      ${extraStyle}
    ">${content}</div>
  `
}

// ===== COMMUNE POPUP =====
function buildCommunePopup(feat: GeoJSON.Feature, color: string, isBouknadel: boolean): string {
  const props = feat.properties || {}
  const nameFr = props.nameFr || ''
  const nameEn = props.nameEn || ''
  const nameAr = props.nameAr || ''
  const population = props.population || ''
  const populationMunicipale = props.populationMunicipale || ''
  const populationCompteeAPart = props.populationCompteeAPart || ''
  const menages = props.menages || ''
  const codeHCP = props.codeHCP || ''
  const sourcePopulation = props.sourcePopulation || ''
  const source = props.source || ''
  const sourceDecree = props.sourceDecree || ''
  const sourceGazette = props.sourceGazette || ''

  const formatNum = (n: string) => Number(n).toLocaleString('ar-MA')

  const headerContent = `
    <div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1;">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;backdrop-filter:blur(4px);">🏛️</div>
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:800;letter-spacing:0.2px;">${feat.properties?.name || ''}</div>
        <div style="font-size:10px;opacity:0.8;margin-top:1px;">الحدود الإدارية الترابية</div>
      </div>
      ${isBouknadel ? '<div style="background:rgba(255,255,255,0.25);padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;backdrop-filter:blur(4px);">مقر المكتب</div>' : ''}
    </div>
  `

  const censusSection = sectionCard(
    'linear-gradient(135deg, #f0fdf4, #ecfdf5)', '#bbf7d0',
    `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:8px;">
        <div style="width:22px;height:22px;border-radius:6px;background:#15803d;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;">📊</div>
        <span style="font-weight:700;font-size:11px;color:#15803d;">الإحصاء العام للسكان والسكنى 2024 — HCP</span>
      </div>
      ${population ? `
        <div style="font-size:22px;font-weight:900;color:#0f172a;margin-bottom:6px;letter-spacing:-0.5px;">
          👥 ${formatNum(population)}
          <span style="font-size:11px;font-weight:600;color:#64748b;margin-right:4px;">نسمة</span>
        </div>
      ` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px;">
        ${populationMunicipale ? `
          <div style="background:rgba(255,255,255,0.7);border-radius:8px;padding:6px 8px;border:1px solid #d1fae5;">
            <div style="font-size:9px;color:#6b7280;font-weight:600;">🇲🇦 المغاربة</div>
            <div style="font-size:13px;font-weight:800;color:#166534;">${formatNum(populationMunicipale)}</div>
          </div>
        ` : ''}
        ${populationCompteeAPart ? `
          <div style="background:rgba(255,255,255,0.7);border-radius:8px;padding:6px 8px;border:1px solid #d1fae5;">
            <div style="font-size:9px;color:#6b7280;font-weight:600;">🌍 الأجانب</div>
            <div style="font-size:13px;font-weight:800;color:#166534;">${formatNum(populationCompteeAPart)}</div>
          </div>
        ` : ''}
        ${menages ? `
          <div style="background:rgba(255,255,255,0.7);border-radius:8px;padding:6px 8px;border:1px solid #d1fae5;">
            <div style="font-size:9px;color:#6b7280;font-weight:600;">🏠 الأسر</div>
            <div style="font-size:13px;font-weight:800;color:#166534;">${formatNum(menages)}</div>
          </div>
        ` : ''}
        ${codeHCP ? `
          <div style="background:rgba(255,255,255,0.7);border-radius:8px;padding:6px 8px;border:1px solid #d1fae5;">
            <div style="font-size:9px;color:#6b7280;font-weight:600;">🔑 كود HCP</div>
            <div style="font-size:13px;font-weight:800;color:#166534;">${codeHCP}</div>
          </div>
        ` : ''}
      </div>
    `,
    'margin-bottom:10px;'
  )

  const namesSection = sectionCard(
    '#f8fafc', '#e2e8f0',
    `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:6px;">
        <div style="width:18px;height:18px;border-radius:5px;background:#475569;display:flex;align-items:center;justify-content:center;font-size:9px;color:white;">🌐</div>
        <span style="font-weight:700;font-size:10px;color:#475569;">التسميات</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;font-size:12px;color:#64748b;">
        ${nameAr ? `<div style="display:flex;align-items:center;gap:6px;"><span style="font-size:13px;">🇲🇦</span> <span style="color:#334155;font-weight:600;">${nameAr}</span></div>` : ''}
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:13px;">🇫🇷</span> ${nameFr}</div>
        <div style="display:flex;align-items:center;gap:6px;"><span style="font-size:13px;">🇬🇧</span> ${nameEn}</div>
      </div>
    `,
    'margin-bottom:10px;'
  )

  const sourceLines: string[] = []
  const srcText = source.includes('قرار') ? `🇲🇦 ${source}` : source === 'الجريدة الرسمية' ? '🇲🇦 الجريدة الرسمية' : source
  sourceLines.push(`🗺️ حدود ترابية — ${srcText}`)
  if (sourceDecree) sourceLines.push(`📜 ${sourceDecree}`)
  if (sourceGazette) sourceLines.push(`📰 ${sourceGazette}`)
  if (sourcePopulation) sourceLines.push(`📊 سكان — ${sourcePopulation}`)

  const footerSection = `
    <div style="font-size:10px;color:#94a3b8;border-top:1px solid #f1f5f9;padding-top:8px;line-height:1.8;">
      ${sourceLines.join('<br>')}
    </div>
  `

  return `
    <div style="${popupBase} min-width:300px;">
      <div style="${popupCardShadow}">
        ${gradientHeader(color, color + 'cc', headerContent)}
        <div style="padding:12px;">
          ${censusSection}
          ${namesSection}
          ${footerSection}
        </div>
      </div>
    </div>
  `
}

// ===== QUARTIER POPUP =====
function buildQuartierPopup(q: Quartier): string {
  const communeLabel = COMMUNE_NAME_MAP[q.commune] || (q.commune ? `جماعة ${q.commune}` : 'الجماعة غير محددة')
  const headerContent = `
    <div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1;">
      <div style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:17px;backdrop-filter:blur(4px);">🏘️</div>
      <div style="flex:1;">
        <div style="font-size:15px;font-weight:800;letter-spacing:0.2px;">${q.nom}</div>
        <div style="font-size:10px;opacity:0.8;margin-top:1px;">حي سكني</div>
      </div>
    </div>
  `

  const coordsSection = sectionCard(
    '#f0fdfa', '#99f6e4',
    `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;">
        <div style="width:18px;height:18px;border-radius:5px;background:#0d9488;display:flex;align-items:center;justify-content:center;font-size:9px;color:white;">📍</div>
        <span style="font-weight:600;font-size:10px;color:#0d9488;">الإحداثيات الجغرافية</span>
      </div>
      <div style="font-size:12px;color:#115e59;font-weight:600;direction:ltr;text-align:right;">
        ${q.latitude.toFixed(6)}, ${q.longitude.toFixed(6)}
      </div>
    `
  )

  const locationInfo = sectionCard(
    '#f8fafc', '#e2e8f0',
    `
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;">
        <span style="font-size:14px;">🏛️</span>
        <span>${communeLabel}</span>
      </div>
    `,
    'margin-top:8px;'
  )

  return `
    <div style="${popupBase} min-width:220px;">
      <div style="${popupCardShadow}">
        ${gradientHeader('#0d9488', '#14b8a6', headerContent)}
        <div style="padding:12px;">
          ${coordsSection}
          ${locationInfo}
        </div>
      </div>
    </div>
  `
}

// ===== INTERVENTION POPUP =====
function buildInterventionPopup(intervention: Intervention): string {
  const dateStr = new Date(intervention.date).toLocaleDateString('ar-MA')
  const color = TYPE_COLORS[intervention.type]
  const statutColor = STATUT_COLORS[intervention.statut]
  const statutLabel = STATUT_LABELS[intervention.statut]
  const typeLabel = TYPE_LABELS[intervention.type]
  const typeIcon = TYPE_ICONS[intervention.type]

  const headerContent = `
    <div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1;">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;backdrop-filter:blur(4px);">${typeIcon}</div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:800;letter-spacing:0.2px;">${typeLabel}</div>
        <div style="font-size:10px;opacity:0.8;margin-top:1px;">${intervention.reference}</div>
      </div>
      <div style="background:rgba(255,255,255,0.25);padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;backdrop-filter:blur(4px);border:1px solid rgba(255,255,255,0.3);">${statutLabel}</div>
    </div>
  `

  const locationSection = sectionCard(
    '#f8fafc', '#e2e8f0',
    `
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <div style="width:24px;height:24px;border-radius:7px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0;margin-top:1px;">📍</div>
        <div>
          <div style="font-weight:800;color:#0f172a;font-size:14px;margin-bottom:2px;">${intervention.quartier}</div>
          ${intervention.adresse ? `<div style="color:#64748b;font-size:12px;">🏠 ${intervention.adresse}</div>` : ''}
          <div style="color:#64748b;font-size:12px;margin-top:2px;">📅 ${dateStr}</div>
        </div>
      </div>
    `,
    'margin-bottom:10px;'
  )

  const detailsGrid = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #f1f5f9;">
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">👤 الوكيل</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.agentNom || '—'}</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #f1f5f9;">
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">📐 المساحة</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.superficie || '—'}</div>
      </div>
    </div>
  `

  // Materials from inventory section
  const materialsSection = (intervention.materials && intervention.materials.length > 0) ? `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 10px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:6px;">
        <span style="font-size:11px;">📦</span>
        <span style="font-size:9px;font-weight:700;color:#166534;">المواد المستعملة من المخزون</span>
      </div>
      ${intervention.materials.map(m => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:3px 0;border-bottom:1px solid #dcfce7;">
          <span style="font-size:11px;color:#334155;font-weight:600;">${m.product.nom}</span>
          <span style="font-size:11px;color:#166534;font-weight:700;">${m.quantity} ${m.product.unite}</span>
        </div>
      `).join('')}
    </div>
  ` : (intervention.produitUtilise ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;">
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #f1f5f9;">
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">💊 المنتج</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.produitUtilise}</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #f1f5f9;">
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">🔢 الكمية</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.quantite || '—'}</div>
      </div>
    </div>
  ` : '')

  const observationsSection = intervention.observations ? `
    <div style="background:#fffbeb;border-radius:8px;padding:8px 10px;border:1px solid #fef3c7;margin-bottom:8px;">
      <div style="font-size:9px;color:#b45309;font-weight:600;margin-bottom:3px;">💬 الملاحظات</div>
      <div style="font-size:11px;color:#92400e;line-height:1.5;">${intervention.observations}</div>
    </div>
  ` : ''

  const statusAndTypeBadges = `
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">
      <div style="background:${color}12;color:${color};padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid ${color}25;display:flex;align-items:center;gap:4px;">
        ${typeIcon} ${typeLabel}
      </div>
      <div style="background:${statutColor}12;color:${statutColor};padding:5px 12px;border-radius:20px;font-size:11px;font-weight:700;border:1px solid ${statutColor}25;">
        ${statutLabel}
      </div>
    </div>
  `

  const footerRef = `
    <div style="font-size:9px;color:#cbd5e1;text-align:left;border-top:1px solid #f1f5f9;padding-top:6px;margin-top:2px;">
      ${intervention.reference}
    </div>
  `

  return `
    <div style="${popupBase} min-width:280px;">
      <div style="${popupCardShadow}">
        ${gradientHeader(color, color + 'cc', headerContent)}
        <div style="padding:12px;">
          ${statusAndTypeBadges}
          ${locationSection}
          ${detailsGrid}
          ${materialsSection}
          ${observationsSection}
          ${footerRef}
        </div>
      </div>
    </div>
  `
}

// ===== NEW INTERVENTION POPUP WITH FORM =====
const inputStyle = `
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: #fff;
  color: #1e293b;
  transition: border-color 0.2s;
  direction: rtl;
  text-align: right;
  box-sizing: border-box;
`
const selectStyle = `
  width: 100%;
  padding: 7px 10px;
  border: 1.5px solid #e2e8f0;
  border-radius: 8px;
  font-size: 12px;
  font-family: inherit;
  outline: none;
  background: #fff;
  color: #1e293b;
  direction: rtl;
  text-align: right;
  cursor: pointer;
  box-sizing: border-box;
  appearance: auto;
`
const labelStyle = `
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #475569;
  margin-bottom: 3px;
  direction: rtl;
  text-align: right;
`
const requiredStar = `<span style="color:#ef4444;font-size:11px;margin-right:2px;">*</span>`

function buildNewInterventionPopup(lat: number, lng: number, commune: string | null, quartiers: Quartier[]): string {
  const communeLabel = commune ? COMMUNE_NAME_MAP[commune] || (commune.startsWith('جماعة ') ? commune : `جماعة ${commune}`) : 'خارج حدود الجماعات'
  const communeColor = commune === 'سيدي أبي القنادل' ? '#7c3aed' : commune === 'سلا' ? '#059669' : commune === 'عامر' ? '#d97706' : commune === 'السهول' ? '#0ea5e9' : '#64748b'
  const isOutsideCommune = !commune
  const today = new Date().toISOString().split('T')[0]

  const detectedQuartier = findNearbyQuartier(lat, lng, commune, quartiers)
  const quartierOptions = quartiers
    .filter((quartier) => !commune || quartier.commune === commune)
    .map(q => `<option value="${escapeHtml(q.nom)}" ${q.nom === detectedQuartier ? 'selected' : ''}>${escapeHtml(q.nom)}</option>`)
    .join('')

  // Commune select options - auto-select detected commune
  const knownCommunes = ['سلا', 'سيدي أبي القنادل', 'عامر', 'السهول']
  const detectedCommuneOption = commune && !knownCommunes.includes(commune)
    ? `<option value="${escapeHtml(commune)}" selected>${escapeHtml(communeLabel)}</option>`
    : ''
  const communeSelectOptions = [
    `<option value="" ${!commune ? 'selected' : ''}>— اختر الجماعة —</option>`,
    detectedCommuneOption,
    `<option value="سلا" ${commune === 'سلا' ? 'selected' : ''}>جماعة سلا</option>`,
    `<option value="سيدي أبي القنادل" ${commune === 'سيدي أبي القنادل' ? 'selected' : ''}>جماعة سيدي أبي القنادل</option>`,
    `<option value="عامر" ${commune === 'عامر' ? 'selected' : ''}>جماعة عامر</option>`,
    `<option value="السهول" ${commune === 'السهول' ? 'selected' : ''}>جماعة السهول</option>`,
  ].join('')

  const headerContent = `
    <div style="display:flex;align-items:center;gap:10px;position:relative;z-index:1;">
      <div style="width:34px;height:34px;border-radius:10px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:17px;backdrop-filter:blur(4px);">➕</div>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:800;letter-spacing:0.2px;">إضافة تدخل جديد</div>
        <div style="font-size:10px;opacity:0.8;margin-top:1px;">أدخل معلومات التدخل مباشرة</div>
      </div>
    </div>
  `

  // Warning banner when outside commune boundaries
  const outsideWarning = isOutsideCommune ? `
    <div style="display:flex;align-items:center;gap:6px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:8px 10px;margin-bottom:10px;">
      <div style="width:24px;height:24px;border-radius:7px;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;flex-shrink:0;">⚠️</div>
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:700;color:#92400e;">هذا الموقع خارج حدود الجماعات المعروفة</div>
        <div style="font-size:9px;color:#b45309;margin-top:1px;">يرجى تحديد الجماعة يدوياً</div>
      </div>
    </div>
  ` : ''

  // Commune confirmation bar when inside a commune
  const communeConfirmBar = !isOutsideCommune ? `
    <div style="display:flex;align-items:center;gap:6px;background:${communeColor}08;border:1px solid ${communeColor}20;border-radius:10px;padding:8px 10px;margin-bottom:10px;">
      <div style="width:24px;height:24px;border-radius:7px;background:${communeColor};display:flex;align-items:center;justify-content:center;font-size:12px;color:white;flex-shrink:0;">🏛️</div>
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:700;color:${communeColor};">تم تحديد الجماعة تلقائياً</div>
        <div style="font-size:9px;color:#64748b;margin-top:1px;">يمكنك تعديلها إذا لزم الأمر</div>
      </div>
    </div>
  ` : ''

  const coordsBar = `
    <div style="display:flex;align-items:center;gap:6px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:8px 10px;margin-bottom:10px;">
      <div style="width:24px;height:24px;border-radius:7px;background:#059669;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;flex-shrink:0;">📍</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;color:#115e59;font-weight:700;direction:ltr;text-align:right;">${lat.toFixed(6)}, ${lng.toFixed(6)}</div>
      </div>
    </div>
  `

  const formContent = `
    <form id="new-intervention-form" onsubmit="return false;" style="margin:0;">
      ${coordsBar}
      ${outsideWarning}
      ${communeConfirmBar}

      <div style="margin-bottom:8px;">
        <label style="${labelStyle}">${isOutsideCommune ? requiredStar : ''}🏛️ الجماعة</label>
        <select name="commune" id="popup-commune-select" style="${selectStyle} ${isOutsideCommune ? 'border-color:#f59e0b;background:#fffbeb;' : `border-color:${communeColor}40;`}">
          ${communeSelectOptions}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="${labelStyle}">${requiredStar}نوع التدخل</label>
          <select name="type" id="popup-type-select" style="${selectStyle}" required>
            <option value="DERATISATION">🐀 مكافحة القوارض</option>
            <option value="DESINSECTISATION">🦟 مكافحة الحشرات</option>
            <option value="DESINFECTION">🧴 التطهير والتعقيم</option>
          </select>
        </div>
        <div>
          <label style="${labelStyle}">${requiredStar}الحالة</label>
          <select name="statut" style="${selectStyle}" required>
            <option value="PLANIFIEE">📅 مبرمجة</option>
            <option value="EN_COURS">🔄 جارية</option>
            <option value="TERMINEE">✅ منجزة</option>
            <option value="ANNULEE">❌ ملغاة</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="${labelStyle}">${requiredStar}التاريخ</label>
          <input type="date" name="date" value="${today}" style="${inputStyle}" required />
        </div>
        <div>
          <label style="${labelStyle}">${requiredStar}اسم العون</label>
          <select name="agentNom" id="popup-agent-select" style="${selectStyle}" required>
            <option value="">— اختر العون —</option>
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="${labelStyle}">${requiredStar}الحي</label>
          <select name="quartier" style="${selectStyle}" required>
            <option value="" ${detectedQuartier ? '' : 'selected'}>اختر الحي</option>
            ${quartierOptions}
          </select>
        </div>
        <div>
          <label style="${labelStyle}">العنوان</label>
          <input type="text" name="adresse" placeholder="رقم واسم الشارع" style="${inputStyle}" />
        </div>
      </div>

      <!-- Materials from Inventory Section -->
      <div style="border:1.5px solid #e2e8f0;border-radius:10px;padding:8px 10px;margin-bottom:8px;background:#f8fafc;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:13px;">📦</span>
            <span style="font-size:10px;font-weight:700;color:#475569;">المواد المستعملة من المخزون</span>
          </div>
          <button type="button" id="popup-add-material-btn" style="font-size:10px;padding:3px 8px;border-radius:6px;background:#d1fae5;color:#065f46;font-weight:700;border:none;cursor:pointer;font-family:inherit;">+ إضافة مادة</button>
        </div>
        <div id="popup-materials-list">
          <div style="text-align:center;padding:4px 0;">
            <div style="font-size:10px;color:#94a3b8;">اضغط "إضافة مادة" لاختيار المواد من المخزون</div>
            <div style="font-size:9px;color:#cbd5e1;margin-top:2px;">سيتم خصم الكميات من المخزون تلقائياً</div>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="${labelStyle}">المساحة</label>
          <input type="text" name="superficie" placeholder="م²" style="${inputStyle}" />
        </div>
        <div>
          <label style="${labelStyle}">مادة أخرى (نص حر)</label>
          <input type="text" name="produitUtilise" placeholder="اسم المادة إن لم تكن في المخزون" style="${inputStyle}" />
        </div>
      </div>

      <div style="margin-bottom:8px;">
        <label style="${labelStyle}">الوصف</label>
        <textarea name="description" placeholder="وصف التدخل..." rows="2" style="${inputStyle} resize:none;"></textarea>
      </div>

      <div style="margin-bottom:10px;">
        <label style="${labelStyle}">الملاحظات</label>
        <textarea name="observations" placeholder="ملاحظات إضافية..." rows="2" style="${inputStyle} resize:none;"></textarea>
      </div>

      <div id="popup-form-status" style="display:none;margin-bottom:8px;padding:8px 10px;border-radius:8px;font-size:11px;font-weight:700;text-align:center;"></div>

      <button type="submit" id="save-intervention-btn" style="
        width: 100%;
        background: linear-gradient(135deg, #059669, #10b981);
        color: white;
        border: none;
        padding: 10px 16px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        box-shadow: 0 4px 14px rgba(5,150,105,0.3);
        transition: all 0.2s;
        font-family: inherit;
        letter-spacing: 0.3px;
      " onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 6px 20px rgba(5,150,105,0.4)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 4px 14px rgba(5,150,105,0.3)'">
        💾 حفظ التدخل
      </button>
    </form>
  `

  return `
    <div style="${popupBase} min-width:340px;max-width:400px;">
      <div style="${popupCardShadow}">
        ${gradientHeader(isOutsideCommune ? '#d97706' : '#059669', isOutsideCommune ? '#f59e0b' : '#10b981', headerContent)}
        <div style="padding:12px;max-height:450px;overflow-y:auto;">
          ${formContent}
        </div>
      </div>
    </div>
  `
}

export default function MapComponent({ interventions, quartiers, selectedCommune, onMapClick, mapClickEnabled, showCommunePopups, onInterventionCreated, centerOn, onInterventionClick, tileLayer: externalTileLayer, onMouseMove, measureMode, onMeasureResult, showQuartiers: externalShowQuartiers, territoryFilter, nationalBoundariesVisible = false, enforcedCommune, enforcedCommunes }: {
  interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: string;
  onMapClick?: (location: MapClickCoords) => void;
  mapClickEnabled?: boolean;
  showCommunePopups?: boolean;
  onInterventionCreated?: () => void;
  centerOn?: { lat: number; lng: number } | null;
  onInterventionClick?: (intervention: Intervention, lat: number, lng: number) => void;
  tileLayer?: 'street' | 'satellite' | 'dark';
  onMouseMove?: (coords: { lat: number; lng: number; zoom: number }) => void;
  measureMode?: boolean;
  onMeasureResult?: (distance: number, points: { lat: number; lng: number }[]) => void;
  showQuartiers?: boolean;
  territoryFilter?: TerritoryFilter;
  nationalBoundariesVisible?: boolean;
  enforcedCommune?: string;
  enforcedCommunes?: string[];
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const communeLayersRef = useRef<Record<string, L.GeoJSON>>({})
  const communeLabelsRef = useRef<L.Marker[]>([])
  const communeLayerGroupRef = useRef<L.LayerGroup | null>(null)
  const clickMarkerRef = useRef<L.Marker | null>(null)
  const singleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const mapClickEnabledRef = useRef(mapClickEnabled ?? true)
  const showCommunePopupsRef = useRef(showCommunePopups ?? true)
  const onInterventionCreatedRef = useRef(onInterventionCreated)
  const onInterventionClickRef = useRef(onInterventionClick)
  const searchMarkerRef = useRef<L.Marker | null>(null)
  const tileLayersRef = useRef<Record<string, L.TileLayer>>({})
  // SIG feature refs
  const onMouseMoveRef = useRef(onMouseMove)
  const measureModeRef = useRef(measureMode ?? false)
  const onMeasureResultRef = useRef(onMeasureResult)
  const measurePointsRef = useRef<{ lat: number; lng: number }[]>([])
  const measurePolylineRef = useRef<L.Polyline | null>(null)
  const measureMarkersRef = useRef<L.Marker[]>([])
  const measureLabelsRef = useRef<L.Marker[]>([])
  const compassControlRef = useRef<L.Control | null>(null)
  const territorialLayerGroupRef = useRef<L.FeatureGroup | null>(null)
  const territorialBoundaryDataRef = useRef<TerritorialBoundaryData | null>(null)
  const territoryFilterRef = useRef<TerritoryFilter>(territoryFilter ?? DEFAULT_TERRITORY_FILTER)
  const nationalBoundariesVisibleRef = useRef(nationalBoundariesVisible)
  const enforcedCommuneRef = useRef(enforcedCommune)
  const initialEnforcedCommunes = enforcedCommunes?.length ? enforcedCommunes : (enforcedCommune ? [enforcedCommune] : [])
  const enforcedCommunesRef = useRef<string[]>(initialEnforcedCommunes)
  const enforcedCommunesKey = initialEnforcedCommunes.join('|')
  const [complaints, setComplaints] = React.useState<ComplaintMapPoint[]>([])

  useEffect(() => {
    let active = true
    const loadComplaints = async () => {
      try {
        const params = new URLSearchParams()
        if (selectedCommune && selectedCommune !== 'ALL') params.set('commune', selectedCommune)
        appendTerritoryParams(params, territoryFilter ?? DEFAULT_TERRITORY_FILTER)
        const response = await fetch(`/api/complaints?${params.toString()}`)
        if (!response.ok) return
        const data = await response.json() as { complaints?: ComplaintMapPoint[] }
        const allowedCommunes = enforcedCommunesKey ? enforcedCommunesKey.split('|') : []
        const locatedComplaints = (data.complaints || []).filter((complaint) => (
          typeof complaint.latitude === 'number' && Number.isFinite(complaint.latitude) &&
          typeof complaint.longitude === 'number' && Number.isFinite(complaint.longitude) &&
          (allowedCommunes.length === 0 || allowedCommunes.includes(complaint.commune))
        ))
        if (active) setComplaints(locatedComplaints)
      } catch {
        if (active) setComplaints([])
      }
    }

    void loadComplaints()
    const refreshTimer = window.setInterval(loadComplaints, 60_000)
    return () => {
      active = false
      window.clearInterval(refreshTimer)
    }
  }, [enforcedCommunesKey, selectedCommune, territoryFilter])

  // Disambiguates single vs double click on the map / commune layers.
  // A single click is delayed by ~280ms; if a second click arrives in that window,
  // the pending single-click action is cancelled so Leaflet's native double-click
  // zoom (toward the clicked point) can run undisturbed.
  const SINGLE_CLICK_DELAY = 280
  const scheduleSingleClick = useCallback((action: () => void) => {
    if (singleClickTimerRef.current) {
      // A second click arrived within the delay window → this is a double click.
      // Cancel the pending single-click action and let Leaflet zoom normally.
      clearTimeout(singleClickTimerRef.current)
      singleClickTimerRef.current = null
      return
    }
    singleClickTimerRef.current = setTimeout(() => {
      singleClickTimerRef.current = null
      action()
    }, SINGLE_CLICK_DELAY)
  }, [])

  // Keep the callback ref up-to-date
  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  // Keep the mapClickEnabled ref up-to-date
  useEffect(() => {
    mapClickEnabledRef.current = mapClickEnabled ?? true
  }, [mapClickEnabled])

  // Keep the showCommunePopups ref up-to-date
  useEffect(() => {
    showCommunePopupsRef.current = showCommunePopups ?? true
  }, [showCommunePopups])

  // Keep the onInterventionCreated ref up-to-date
  useEffect(() => {
    onInterventionCreatedRef.current = onInterventionCreated
  }, [onInterventionCreated])

  // Keep the onInterventionClick ref up-to-date
  useEffect(() => {
    onInterventionClickRef.current = onInterventionClick
  }, [onInterventionClick])

  // Keep the onMouseMove ref up-to-date
  useEffect(() => {
    onMouseMoveRef.current = onMouseMove
  }, [onMouseMove])

  // Keep the measureMode ref up-to-date
  useEffect(() => {
    measureModeRef.current = measureMode ?? false
  }, [measureMode])

  // Keep the onMeasureResult ref up-to-date
  useEffect(() => {
    onMeasureResultRef.current = onMeasureResult
  }, [onMeasureResult])

  useEffect(() => {
    territoryFilterRef.current = territoryFilter ?? DEFAULT_TERRITORY_FILTER
  }, [territoryFilter])

  useEffect(() => {
    nationalBoundariesVisibleRef.current = nationalBoundariesVisible
  }, [nationalBoundariesVisible])

  useEffect(() => {
    enforcedCommuneRef.current = enforcedCommune
  }, [enforcedCommune])

  useEffect(() => {
    enforcedCommunesRef.current = enforcedCommunes?.length ? enforcedCommunes : (enforcedCommune ? [enforcedCommune] : [])
  }, [enforcedCommune, enforcedCommunes])

  const renderTerritorialLayers = useCallback((filter: TerritoryFilter, visible: boolean, fitBounds = true) => {
    const map = mapRef.current
    const layerGroup = territorialLayerGroupRef.current
    const boundaryData = territorialBoundaryDataRef.current
    if (!map || !layerGroup || !boundaryData) return

    layerGroup.clearLayers()
    if (!visible) {
      const managedCommunes = enforcedCommunesRef.current
      if (managedCommunes.length > 1) {
        const managedFeatures = boundaryData.commune.features.filter((feature) => {
          const properties = feature.properties as { name?: string; nameAr?: string; nameFr?: string } | null
          return [properties?.nameAr, properties?.name, properties?.nameFr].some((name) => name && managedCommunes.includes(name))
        }).map((feature) => canonicalCommuneGeometry(feature, 'commune'))
        if (managedFeatures.length > 0) {
          const managedLayer = L.geoJSON({ type: 'FeatureCollection', features: managedFeatures } as GeoJSON.FeatureCollection, {
            style: { ...TERRITORIAL_LAYER_STYLES.commune, weight: 4, fillOpacity: 0.15 },
            onEachFeature: (feature, layer) => {
              // Forward clicks to intervention form when click-to-add is enabled (no population popup)
              // Single click opens the form; double click zooms in (native Leaflet).
              layer.on('click', (e: L.LeafletMouseEvent) => {
                if (!mapClickEnabledRef.current || measureModeRef.current) return
                // Stop propagation immediately so the map-level handler doesn't cancel this timer.
                L.DomEvent.stopPropagation(e)
                const { lat, lng } = e.latlng
                const detected = getCommuneForPoint(lat, lng, territorialBoundaryDataRef.current)
                const legacy = getLegacyCommuneForPoint(lat, lng)
                const detecteds = [detected, legacy].filter((c): c is string => Boolean(c))
                if (!detecteds.length) return // outside any commune — ignore
                const allowed = enforcedCommunesRef.current
                // When a scope is enforced, the clicked commune must be among the allowed ones
                let commune: string | null
                if (allowed.length === 0) {
                  commune = detecteds[0] || null
                } else {
                  const detectedAllowed = findMatchingCommune(allowed, detecteds)
                  if (!detectedAllowed) return // outside scope → ignore
                  commune = detectedAllowed
                }
                if (!commune) return
                scheduleSingleClick(() => {
                  if (mapClickEnabledRef.current && !measureModeRef.current) {
                    onMapClickRef.current?.({ latitude: lat, longitude: lng, commune, quartier: findNearbyQuartier(lat, lng, commune, quartiers) })
                  }
                })
              })
            },
          })
          managedLayer.addTo(layerGroup)
          const bounds = managedLayer.getBounds()
          if (fitBounds && bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 })
          return
        }
      }
      if (fitBounds) {
        const scopedLayers = enforcedCommunesRef.current.map((commune) => communeLayersRef.current[commune]).filter((layer): layer is L.GeoJSON => Boolean(layer))
        const scopedBounds = scopedLayers.length ? L.featureGroup(scopedLayers).getBounds() : undefined
        if (scopedBounds?.isValid()) {
          map.fitBounds(scopedBounds, { padding: [30, 30], maxZoom: 14 })
        } else if (enforcedCommunesRef.current.length === 0) {
          const fallbackBounds = L.geoJSON(boundaryData.region as GeoJSON.GeoJsonObject).getBounds()
          if (fallbackBounds.isValid()) map.fitBounds(fallbackBounds, { padding: [30, 30], maxZoom: 6 })
        }
      }
      return
    }

    const focusLevel: TerritorialLevel | null = filter.communeCode !== ALL_TERRITORIES
      ? 'commune'
      : filter.provinceCode !== ALL_TERRITORIES
        ? 'province'
        : filter.regionCode !== ALL_TERRITORIES
          ? 'region'
          : null
    let focusBounds: L.LatLngBounds | null = null

    const levelsToRender: TerritorialLevel[] = focusLevel === 'commune'
      ? ['commune']
      : ['region', 'province', 'commune']

    for (const level of levelsToRender) {
      const features = boundaryData[level].features
        .filter((feature) => territorialFeatureMatches(feature, level, filter))
        .map((feature) => canonicalCommuneGeometry(feature, level))
      if (features.length === 0) return

      const boundaryLayer = L.geoJSON({ type: 'FeatureCollection', features } as GeoJSON.FeatureCollection, {
        style: TERRITORIAL_LAYER_STYLES[level],
        onEachFeature: (feature, layer) => {
          // Forward clicks to intervention form when click-to-add is enabled (no population popup)
          // Single click opens the form; double click zooms in (native Leaflet).
          layer.on('click', (e: L.LeafletMouseEvent) => {
            if (!mapClickEnabledRef.current || measureModeRef.current) return
            // Only respond at the commune level — region/province clicks do nothing
            if (level !== 'commune') return
            // Stop propagation immediately so the map-level handler doesn't cancel this timer.
            L.DomEvent.stopPropagation(e)
            const { lat, lng } = e.latlng
            const detected = getCommuneForPoint(lat, lng, territorialBoundaryDataRef.current)
            const legacy = getLegacyCommuneForPoint(lat, lng)
            const detecteds = [detected, legacy].filter((c): c is string => Boolean(c))
            if (!detecteds.length) return // outside any commune — ignore
            const allowed = enforcedCommunesRef.current
            // When a scope is enforced, the clicked commune must be among the allowed ones
            let commune: string | null
            if (allowed.length === 0) {
              commune = detecteds[0] || null
            } else {
              const detectedAllowed = findMatchingCommune(allowed, detecteds)
              if (!detectedAllowed) return // outside scope → ignore
              commune = detectedAllowed
            }
            if (!commune) return
            scheduleSingleClick(() => {
              if (mapClickEnabledRef.current && !measureModeRef.current) {
                onMapClickRef.current?.({ latitude: lat, longitude: lng, commune, quartier: findNearbyQuartier(lat, lng, commune, quartiers) })
              }
            })
          })
        },
      })
      if (level === focusLevel) focusBounds = boundaryLayer.getBounds()
      boundaryLayer.addTo(layerGroup)
    }

    const bounds = focusBounds?.isValid() ? focusBounds : layerGroup.getBounds()
    if (fitBounds && bounds.isValid()) {
      const maximumZoom = filter.communeCode !== ALL_TERRITORIES ? 13 : filter.provinceCode !== ALL_TERRITORIES ? 10 : filter.regionCode !== ALL_TERRITORIES ? 8 : 6
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: maximumZoom })
    }
  }, [])

  // ===== SIG: onMouseMove coordinate tracking =====
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const handleMouseMove = (e: L.LeafletMouseEvent) => {
      if (onMouseMoveRef.current) {
        onMouseMoveRef.current({
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          zoom: map.getZoom(),
        })
      }
    }

    map.on('mousemove', handleMouseMove)
    return () => {
      map.off('mousemove', handleMouseMove)
    }
  }, [mapRef.current])

  // ===== SIG: Measure mode =====
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    const isMeasure = measureMode ?? false

    // Helper: clean up all measure layers
    const cleanupMeasure = () => {
      measureMarkersRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m) })
      measureMarkersRef.current = []
      measureLabelsRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m) })
      measureLabelsRef.current = []
      if (measurePolylineRef.current && map.hasLayer(measurePolylineRef.current)) {
        map.removeLayer(measurePolylineRef.current)
      }
      measurePolylineRef.current = null
      measurePointsRef.current = []
    }

    if (!isMeasure) {
      cleanupMeasure()
      // Reset cursor
      const container = map.getContainer()
      container.style.cursor = ''
      return
    }

    // Set cursor to crosshair in measure mode
    const container = map.getContainer()
    container.style.cursor = 'crosshair'

    // Calculate total distance of all measure points
    const calcTotalDistance = (points: { lat: number; lng: number }[]): number => {
      let total = 0
      for (let i = 1; i < points.length; i++) {
        const from = L.latLng(points[i - 1].lat, points[i - 1].lng)
        const to = L.latLng(points[i].lat, points[i].lng)
        total += from.distanceTo(to)
      }
      return total
    }

    // Update the polyline and distance labels
    const updateMeasureDisplay = () => {
      const points = measurePointsRef.current

      // Update polyline
      if (measurePolylineRef.current && map.hasLayer(measurePolylineRef.current)) {
        map.removeLayer(measurePolylineRef.current)
      }
      if (points.length >= 2) {
        const latlngs = points.map(p => L.latLng(p.lat, p.lng))
        measurePolylineRef.current = L.polyline(latlngs, {
          color: '#ef4444',
          weight: 3,
          dashArray: '8, 6',
          opacity: 0.9,
        }).addTo(map)
      }

      // Remove old labels
      measureLabelsRef.current.forEach(m => { if (map.hasLayer(m)) map.removeLayer(m) })
      measureLabelsRef.current = []

      // Add distance labels between consecutive points
      for (let i = 1; i < points.length; i++) {
        const from = L.latLng(points[i - 1].lat, points[i - 1].lng)
        const to = L.latLng(points[i].lat, points[i].lng)
        const dist = from.distanceTo(to)
        const midLat = (points[i - 1].lat + points[i].lat) / 2
        const midLng = (points[i - 1].lng + points[i].lng) / 2

        const distText = dist >= 1000
          ? `${(dist / 1000).toFixed(2)} كم`
          : `${dist.toFixed(1)} م`

        const label = L.marker([midLat, midLng], {
          icon: L.divIcon({
            html: `<div style="
              background: #ef4444;
              color: white;
              padding: 2px 8px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              font-family: system-ui, sans-serif;
              box-shadow: 0 2px 8px rgba(239,68,68,0.4);
              border: 1.5px solid white;
              direction: rtl;
            ">📏 ${distText}</div>`,
            className: '',
            iconAnchor: [30, 10],
          }),
          interactive: false,
        }).addTo(map)
        measureLabelsRef.current.push(label)
      }

      // Total distance label at last point
      if (points.length >= 2) {
        const totalDist = calcTotalDistance(points)
        const totalText = totalDist >= 1000
          ? `${(totalDist / 1000).toFixed(3)} كم`
          : `${totalDist.toFixed(1)} م`

        const lastP = points[points.length - 1]
        const totalLabel = L.marker([lastP.lat, lastP.lng], {
          icon: L.divIcon({
            html: `<div style="
              background: #1e293b;
              color: white;
              padding: 4px 12px;
              border-radius: 14px;
              font-size: 12px;
              font-weight: 800;
              white-space: nowrap;
              font-family: system-ui, sans-serif;
              box-shadow: 0 4px 12px rgba(30,41,59,0.5);
              border: 2px solid white;
              direction: rtl;
            ">المجموع: ${totalText}</div>`,
            className: '',
            iconAnchor: [45, -10],
          }),
          interactive: false,
        }).addTo(map)
        measureLabelsRef.current.push(totalLabel)
      }
    }

    // Click handler for measure mode
    const handleMeasureClick = (e: L.LeafletMouseEvent) => {
      if (!measureModeRef.current) return

      const { lat, lng } = e.latlng
      measurePointsRef.current.push({ lat, lng })

      // Add point marker
      const idx = measurePointsRef.current.length
      const marker = L.marker([lat, lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #ef4444;
            width: 14px; height: 14px;
            border-radius: 50%;
            border: 2.5px solid white;
            box-shadow: 0 2px 8px rgba(239,68,68,0.5);
            display: flex; align-items: center; justify-content: center;
            font-size: 8px; color: white; font-weight: 800;
          ">${idx}</div>`,
          className: '',
          iconSize: [14, 14],
          iconAnchor: [7, 7],
        }),
        interactive: false,
      }).addTo(map)
      measureMarkersRef.current.push(marker)

      updateMeasureDisplay()
    }

    // Double-click handler to finish measurement
    const handleMeasureDblClick = (e: L.LeafletMouseEvent) => {
      if (!measureModeRef.current) return
      L.DomEvent.stopPropagation(e.originalEvent)
      L.DomEvent.preventDefault(e.originalEvent)

      const points = [...measurePointsRef.current]
      const totalDist = calcTotalDistance(points)

      if (onMeasureResultRef.current && points.length >= 2) {
        onMeasureResultRef.current(totalDist, points)
      }

      // Reset cursor
      container.style.cursor = ''
    }

    map.on('click', handleMeasureClick)
    map.on('dblclick', handleMeasureDblClick)

    // Disable double-click zoom in measure mode
    if (isMeasure) {
      map.doubleClickZoom.disable()
    }

    return () => {
      map.off('click', handleMeasureClick)
      map.off('dblclick', handleMeasureDblClick)
      cleanupMeasure()
      container.style.cursor = ''
      map.doubleClickZoom.enable()
    }
  }, [measureMode])

  // Switch tile layer when externalTileLayer prop changes
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current
    const layers = tileLayersRef.current
    if (!layers || Object.keys(layers).length === 0) return

    // Remove all tile layers
    Object.values(layers).forEach(l => { if (map.hasLayer(l)) map.removeLayer(l) })
    // Add the selected one
    const selected = layers[externalTileLayer || 'street']
    if (selected) selected.addTo(map)
  }, [externalTileLayer])

  // Center map on coordinates when centerOn prop changes
  useEffect(() => {
    if (!mapRef.current || !centerOn) return
    const map = mapRef.current
    map.flyTo([centerOn.lat, centerOn.lng], 16, { duration: 1.5 })
    // Remove previous search marker
    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current)
    }
    const searchMarker = L.marker([centerOn.lat, centerOn.lng], {
      icon: L.divIcon({
        html: `<div style="position:relative;"><div style="background:linear-gradient(135deg,#0d9488,#14b8a6);width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:white;border:3px solid white;box-shadow:0 2px 12px rgba(13,148,136,0.5);">📍</div></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -16],
      }),
    })
    searchMarker.addTo(map)
    searchMarkerRef.current = searchMarker
  }, [centerOn])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [31.7917, -7.0926],
      zoom: 5,
      zoomControl: false,
      scrollWheelZoom: 'center', // zoom to center of viewport, don't scroll page
    })

    // Prevent wheel events over the map from scrolling the page.
    // We listen on the capture phase with passive:false so we can stop the event
    // before it reaches the document, while still letting Leaflet zoom normally.
    const stopPageScroll = (e: WheelEvent) => {
      // Only block page scroll when the cursor is over the map
      e.stopPropagation()
      // Prevent the document from scrolling
      e.preventDefault()
    }
    mapContainerRef.current.addEventListener('wheel', stopPageScroll, { passive: false })

    L.control.zoom({ position: 'topleft' }).addTo(map)

    // Add scale control
    L.control.scale({ position: 'bottomleft', imperial: false, metric: true }).addTo(map)

    // طبقات الخريطة الأساسية
    const streetLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
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

    tileLayersRef.current = { street: streetLayer, satellite: satelliteLayer, dark: darkLayer }
    streetLayer.addTo(map)

    const communeLayerGroup = L.layerGroup().addTo(map)
    communeLayerGroupRef.current = communeLayerGroup
    const territorialLayerGroup = L.featureGroup().addTo(map)
    territorialLayerGroupRef.current = territorialLayerGroup

    // ===== ADD COMMUNE BOUNDARIES =====
    const legacyFeatures = enforcedCommunesRef.current.length
      ? COMMUNES_GEOJSON.features.filter((feature) => (
        Object.entries(COMMUNE_NAME_MAP).some(([key, name]) => enforcedCommunesRef.current.includes(key) && name === feature.properties.name)
      ))
      : []

    legacyFeatures.forEach((feature) => {
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
          const geoJsonLayer = layer as L.GeoJSON
          const bounds = geoJsonLayer.getBounds()
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

          // Click handler: forward clicks inside the commune polygon to the intervention form.
          // Only fires when the clicked point is inside one of the allowed (scoped) communes.
          // A single click opens the intervention form; a double click zooms in (native Leaflet).
          layer.on('click', (e: L.LeafletMouseEvent) => {
            if (!mapClickEnabledRef.current || measureModeRef.current) return
            // Stop propagation immediately so the map-level click handler doesn't also fire
            // (which would cancel this layer's pending single-click timer).
            L.DomEvent.stopPropagation(e)
            const { lat, lng } = e.latlng
            const detectedCommune = getCommuneForPoint(lat, lng, territorialBoundaryDataRef.current)
            const legacyCommune = getLegacyCommuneForPoint(lat, lng)
            const detectedCommunes = [detectedCommune, legacyCommune].filter((c): c is string => Boolean(c))
            if (!detectedCommunes.length) return
            const allowedCommunes = enforcedCommunesRef.current
            // When a scope is enforced, the clicked commune must be among the allowed ones
            let commune: string | null
            if (allowedCommunes.length === 0) {
              commune = detectedCommunes[0] || null
            } else {
              const detectedAllowedCommune = findMatchingCommune(allowedCommunes, detectedCommunes)
              if (!detectedAllowedCommune) return // outside scope → ignore
              commune = detectedAllowedCommune
            }
            if (!commune) return
            // Defer so a double click cancels the form opening and lets the map zoom in.
            scheduleSingleClick(() => {
              if (mapClickEnabledRef.current && !measureModeRef.current) {
                onMapClickRef.current?.({
                  latitude: lat,
                  longitude: lng,
                  commune,
                  quartier: findNearbyQuartier(lat, lng, commune, quartiers),
                })
              }
            })
          })

          // Hover effects
          layer.on('mouseover', () => {
            ;(layer as L.Path).setStyle({ fillOpacity: isBouknadel ? 0.22 : 0.15, weight: isBouknadel ? 5 : 3.5 })
          })
          layer.on('mouseout', () => {
            ;(layer as L.Path).setStyle({ fillOpacity: isBouknadel ? 0.12 : 0.06, weight: isBouknadel ? 4 : 2.5 })
          })
        },
      })

      const shortKey = Object.entries(COMMUNE_NAME_MAP).find(([_, v]) => v === props.name)?.[0] || props.name || ''
      communeLayersRef.current[shortKey] = polygon
      polygon.addTo(communeLayerGroup)
    })

    // Layer control
    L.control.layers(
      { '🗺️ OpenStreetMap': streetLayer, '🛰️ صورة ساتلية': satelliteLayer, '🌙 خريطة داكنة': darkLayer },
      { '🏛️ الحدود الجماعية': communeLayerGroup, '🇲🇦 الجهات • الأقاليم • الجماعات': territorialLayerGroup },
      { position: 'bottomleft' }
    ).addTo(map)

    // Markers layer
    const markersLayer = createMarkerClusterGroup()
    markersLayerRef.current = markersLayer
    markersLayer.addTo(map)

    // ===== MAP CLICK HANDLER - ADD NEW INTERVENTION =====
    map.on('click', (e: L.LeafletMouseEvent) => {
      // Check if map click is enabled via ref
      if (!mapClickEnabledRef.current) return
      // Skip intervention popup when in measure mode (measure mode has its own click handler)
      if (measureModeRef.current) return

      const { lat, lng } = e.latlng
      const detectedCommune = getCommuneForPoint(lat, lng, territorialBoundaryDataRef.current)
      const legacyCommune = getLegacyCommuneForPoint(lat, lng)
      const detectedCommunes = [detectedCommune, legacyCommune].filter((commune): commune is string => Boolean(commune))
      // Ignore clicks that fall outside any recognised commune boundary
      if (!detectedCommunes.length) return
      const allowedCommunes = enforcedCommunesRef.current
      // When a scope is enforced, the clicked point MUST fall inside one of the allowed communes.
      // Clicks inside any other commune (or outside the scope) are rejected — no form opens.
      let commune: string | null
      if (allowedCommunes.length === 0) {
        // No scope enforced → accept whatever commune was detected
        commune = detectedCommunes[0] || null
      } else {
        const detectedAllowedCommune = findMatchingCommune(allowedCommunes, detectedCommunes)
        // If the clicked commune is NOT among the allowed ones, ignore the click entirely
        if (!detectedAllowedCommune) return
        commune = detectedAllowedCommune
      }
      if (!commune) return

      // Defer the intervention form opening so a quick second click (double click)
      // can be detected and Leaflet's native double-click zoom takes over instead.
      scheduleSingleClick(() => {
        const location: MapClickCoords = {
          latitude: lat,
          longitude: lng,
          commune,
          quartier: findNearbyQuartier(lat, lng, commune, quartiers),
        }

        if (onMapClickRef.current) {
          onMapClickRef.current(location)
          return
        }
      
      // Remove previous click marker if exists
      if (clickMarkerRef.current) {
        map.removeLayer(clickMarkerRef.current)
      }

      // Create new temporary marker at click location
      const newMarker = L.marker([lat, lng], { 
        icon: createNewInterventionMarkerIcon(),
        zIndexOffset: 1000 
      })

      // Build form popup
      const popupContent = buildNewInterventionPopup(lat, lng, commune, quartiers)

      newMarker.bindPopup(popupContent, { maxWidth: 440, minWidth: 360, closeButton: true })
      newMarker.addTo(map)
      clickMarkerRef.current = newMarker

      // Register popupopen handler BEFORE opening the popup
      newMarker.on('popupopen', () => {
        setTimeout(() => {
          // --- Materials management ---
          let popupProducts: { id: string; nom: string; categorie: string; unite: string; quantiteStock: number }[] = []
          let materialRowCounter = 0

          // Fetch products for dropdown
          fetch('/api/products/for-dropdown').then(r => r.json()).then(data => {
            popupProducts = data.products || []
          }).catch(() => {})

          // --- Agent dropdown: load agents for the selected commune ---
          // Pulls agents registered in the commune chosen in the popup's commune <select>.
          function loadAgentsForCommune(commune: string) {
            const agentSelect = document.getElementById('popup-agent-select') as HTMLSelectElement | null
            if (!agentSelect) return
            // Keep the placeholder, clear the rest
            agentSelect.innerHTML = '<option value="">— اختر العون —</option>'
            if (!commune) return
            agentSelect.disabled = true
            fetch(`/api/agents?commune=${encodeURIComponent(commune)}`)
              .then(r => r.ok ? r.json() : { agents: [] })
              .then(data => {
                const agents: { id: string; nom: string; prenom: string; fonction: string; actif: boolean }[] = data.agents || []
                // Prefer active agents, but show inactive ones greyed out at the end
                const active = agents.filter(a => a.actif)
                const inactive = agents.filter(a => !a.actif)
                if (active.length === 0 && inactive.length === 0) {
                  agentSelect.innerHTML = '<option value="">— لا يوجد أعوان —</option>'
                  agentSelect.disabled = false
                  return
                }
                let opts = '<option value="">— اختر العون —</option>'
                for (const a of active) {
                  const label = a.prenom ? `${a.nom} ${a.prenom}` : a.nom
                  const fonction = a.fonction ? ` — ${a.fonction}` : ''
                  opts += `<option value="${escapeHtml(label)}">${escapeHtml(label)}${escapeHtml(fonction)}</option>`
                }
                if (inactive.length > 0) {
                  opts += '<option value="" disabled>—— غير نشطين ——</option>'
                  for (const a of inactive) {
                    const label = a.prenom ? `${a.nom} ${a.prenom}` : a.nom
                    const fonction = a.fonction ? ` — ${a.fonction}` : ''
                    opts += `<option value="${escapeHtml(label)}" style="color:#94a3b8;">${escapeHtml(label)}${escapeHtml(fonction)} (غير نشط)</option>`
                  }
                }
                agentSelect.innerHTML = opts
                agentSelect.disabled = false
              })
              .catch(() => {
                agentSelect.innerHTML = '<option value="">— خطأ في التحميل —</option>'
                agentSelect.disabled = false
              })
          }

          // Initial load: use the auto-detected commune (the selected <option> in the commune select)
          const communeSelectEl = document.getElementById('popup-commune-select') as HTMLSelectElement | null
          loadAgentsForCommune(communeSelectEl?.value || commune || '')

          // Reload agents whenever the user changes the commune in the popup
          if (communeSelectEl) {
            communeSelectEl.addEventListener('change', () => {
              loadAgentsForCommune(communeSelectEl.value)
            })
          }

          // Helper: build product options for current type
          function getProductOptions(selectedId: string): string {
            const typeSelect = document.getElementById('popup-type-select') as HTMLSelectElement | null
            const currentType = typeSelect?.value || 'DERATISATION'
            const filtered = popupProducts.filter(p => {
              if (currentType === 'DERATISATION') return p.categorie === 'DERATISATION' || p.categorie === 'GENERAL'
              if (currentType === 'DESINSECTISATION') return p.categorie === 'DESINSECTISATION' || p.categorie === 'GENERAL'
              if (currentType === 'DESINFECTION') return p.categorie === 'DESINFECTION' || p.categorie === 'GENERAL'
              return true
            })
            let opts = '<option value="">— اختر المادة —</option>'
            for (const p of filtered) {
              opts += `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${p.nom} (المخزون: ${p.quantiteStock} ${p.unite})</option>`
            }
            return opts
          }

          // Add material row
          function addMaterialRow() {
            const list = document.getElementById('popup-materials-list')
            if (!list) return
            // Remove empty placeholder if present
            const placeholder = list.querySelector('div[style*="text-align:center"]')
            if (placeholder) placeholder.remove()

            const rowId = materialRowCounter++
            const row = document.createElement('div')
            row.id = `popup-material-row-${rowId}`
            row.style.cssText = 'display:flex;align-items:center;gap:4px;margin-bottom:4px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:4px 6px;'
            row.innerHTML = `
              <select class="popup-product-select" data-row="${rowId}" style="flex:1;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;font-family:inherit;outline:none;background:#fff;color:#1e293b;direction:rtl;text-align:right;cursor:pointer;">
                ${getProductOptions('')}
              </select>
              <input type="number" min="1" class="popup-product-qty" data-row="${rowId}" placeholder="الكمية" style="width:55px;padding:4px 6px;border:1px solid #e2e8f0;border-radius:6px;font-size:10px;font-family:inherit;outline:none;background:#fff;color:#1e293b;text-align:center;" />
              <button type="button" class="popup-remove-material-btn" data-row="${rowId}" style="width:20px;height:20px;border-radius:4px;background:#fef2f2;color:#dc2626;font-size:10px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">✕</button>
            `
            list.appendChild(row)

            // Attach remove handler
            row.querySelector('.popup-remove-material-btn')?.addEventListener('click', () => {
              row.remove()
              // Show placeholder if no rows left
              if (list.children.length === 0) {
                list.innerHTML = `<div style="text-align:center;padding:4px 0;"><div style="font-size:10px;color:#94a3b8;">اضغط "إضافة مادة" لاختيار المواد من المخزون</div><div style="font-size:9px;color:#cbd5e1;margin-top:2px;">سيتم خصم الكميات من المخزون تلقائياً</div></div>`
              }
            })
          }

          // Add material button handler
          const addBtn = document.getElementById('popup-add-material-btn')
          if (addBtn) {
            addBtn.onclick = () => addMaterialRow()
          }

          // Update product dropdowns when type changes
          const typeSelect = document.getElementById('popup-type-select')
          if (typeSelect) {
            typeSelect.addEventListener('change', () => {
              document.querySelectorAll('.popup-product-select').forEach((sel) => {
                const selectEl = sel as HTMLSelectElement
                const currentVal = selectEl.value
                selectEl.innerHTML = getProductOptions(currentVal)
              })
            })
          }

          // --- Form submit handler ---
          const form = document.getElementById('new-intervention-form') as HTMLFormElement | null
          if (form) {
            form.onsubmit = (e) => {
              e.preventDefault()
              const formData = new FormData(form)
              const formCommune = formData.get('commune') as string || ''

              // Collect materials
              const materials: { productId: string; quantity: number }[] = []
              document.querySelectorAll('.popup-product-select').forEach((sel) => {
                const selectEl = sel as HTMLSelectElement
                const rowId = selectEl.getAttribute('data-row')
                const qtyInput = document.querySelector(`.popup-product-qty[data-row="${rowId}"]`) as HTMLInputElement | null
                const productId = selectEl.value
                const quantity = parseInt(qtyInput?.value || '0') || 0
                if (productId && quantity > 0) {
                  materials.push({ productId, quantity })
                }
              })

              const data: Record<string, unknown> = {
                type: formData.get('type') as string || 'DERATISATION',
                date: formData.get('date') as string || new Date().toISOString().split('T')[0],
                quartier: formData.get('quartier') as string || '',
                adresse: formData.get('adresse') as string || '',
                commune: formCommune || commune || '',
                latitude: lat.toString(),
                longitude: lng.toString(),
                statut: formData.get('statut') as string || 'PLANIFIEE',
                description: formData.get('description') as string || '',
                agentNom: formData.get('agentNom') as string || '',
                produitUtilise: formData.get('produitUtilise') as string || '',
                quantite: formData.get('quantite') as string || '',
                superficie: formData.get('superficie') as string || '',
                nombrePrestations: '1',
                observations: formData.get('observations') as string || '',
                materials,
              }

              // Validate required fields
              if (!data.quartier || !data.agentNom || !data.date) {
                const statusEl = document.getElementById('popup-form-status')
                if (statusEl) {
                  statusEl.style.display = 'block'
                  statusEl.style.background = '#fef2f2'
                  statusEl.style.color = '#dc2626'
                  statusEl.style.border = '1px solid #fecaca'
                  statusEl.textContent = '⚠️ يرجى ملء جميع الحقول المطلوبة'
                }
                return
              }

              // Validate commune when outside boundaries
              if (!commune && !formCommune) {
                const statusEl = document.getElementById('popup-form-status')
                if (statusEl) {
                  statusEl.style.display = 'block'
                  statusEl.style.background = '#fffbeb'
                  statusEl.style.color = '#d97706'
                  statusEl.style.border = '1px solid #fde68a'
                  statusEl.textContent = '⚠️ يرجى تحديد الجماعة — الموقع خارج الحدود المعروفة'
                }
                const communeSelect = document.getElementById('popup-commune-select')
                if (communeSelect) {
                  (communeSelect as HTMLSelectElement).style.borderColor = '#f59e0b'
                  ;(communeSelect as HTMLSelectElement).style.background = '#fffbeb'
                }
                return
              }

              // Show loading state
              const btn = document.getElementById('save-intervention-btn') as HTMLButtonElement | null
              if (btn) {
                btn.disabled = true
                btn.style.opacity = '0.7'
                btn.innerHTML = '⏳ جاري الحفظ...'
              }

              // Submit to API
              fetch('/api/interventions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
              })
              .then(async (res) => {
                if (res.ok) {
                  // Show success
                  const statusEl = document.getElementById('popup-form-status')
                  if (statusEl) {
                    statusEl.style.display = 'block'
                    statusEl.style.background = '#f0fdf4'
                    statusEl.style.color = '#16a34a'
                    statusEl.style.border = '1px solid #bbf7d0'
                    statusEl.textContent = '✅ تم إضافة التدخل بنجاح'
                  }
                  // Close popup after delay
                  setTimeout(() => {
                    if (clickMarkerRef.current) {
                      map.removeLayer(clickMarkerRef.current)
                      clickMarkerRef.current = null
                    }
                    // Notify parent to refresh data
                    if (onInterventionCreatedRef.current) {
                      onInterventionCreatedRef.current()
                    }
                  }, 1200)
                } else {
                  const errData = await res.json().catch(() => ({})) as { error?: string }
                  const errMsg = errData?.error || `خطأ في الخادم (${res.status})`
                  throw new Error(errMsg)
                }
              })
              .catch((err) => {
                console.error('Save intervention error:', err)
                const statusEl = document.getElementById('popup-form-status')
                if (statusEl) {
                  statusEl.style.display = 'block'
                  statusEl.style.background = '#fef2f2'
                  statusEl.style.color = '#dc2626'
                  statusEl.style.border = '1px solid #fecaca'
                  statusEl.textContent = '❌ ' + (err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ')
                }
                const saveBtn = document.getElementById('save-intervention-btn') as HTMLButtonElement | null
                if (saveBtn) {
                  saveBtn.disabled = false
                  saveBtn.style.opacity = '1'
                  saveBtn.innerHTML = '💾 حفظ التدخل'
                }
              })
            }
          }
        }, 100)
      })

      // Open popup AFTER registering the event handler
      newMarker.openPopup()
      }) // end scheduleSingleClick
    })

    mapRef.current = map

    // ===== SIG: Compass / North Arrow indicator =====
    const CompassControl = L.Control.extend({
      onAdd: () => {
        const div = L.DomUtil.create('div', 'leaflet-compass-control')
        div.innerHTML = `
          <div style="
            width: 50px; height: 50px;
            background: rgba(255,255,255,0.95);
            border-radius: 50%;
            border: 2px solid #e2e8f0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.15);
            display: flex; align-items: center; justify-content: center;
            position: relative;
            cursor: default;
            backdrop-filter: blur(4px);
          ">
            <div style="
              position: absolute; top: 4px; left: 50%; transform: translateX(-50%);
              width: 0; height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-bottom: 12px solid #ef4444;
            "></div>
            <span style="
              font-size: 10px; font-weight: 900; color: #ef4444;
              margin-top: 8px; font-family: system-ui, sans-serif;
            ">N</span>
            <div style="
              position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
              width: 0; height: 0;
              border-left: 4px solid transparent;
              border-right: 4px solid transparent;
              border-top: 9px solid #94a3b8;
            "></div>
            <div style="
              position: absolute; left: 4px; top: 50%; transform: translateY(-50%);
              width: 0; height: 0;
              border-top: 4px solid transparent;
              border-bottom: 4px solid transparent;
              border-right: 7px solid #94a3b8;
            "></div>
            <div style="
              position: absolute; right: 4px; top: 50%; transform: translateY(-50%);
              width: 0; height: 0;
              border-top: 4px solid transparent;
              border-bottom: 4px solid transparent;
              border-left: 7px solid #94a3b8;
            "></div>
          </div>
        `
        return div
      },
    })
    const compassCtrl = new CompassControl({ position: 'topright' })
    compassCtrl.addTo(map)
    compassControlRef.current = compassCtrl

    // Fit bounds
    const initialLayers = enforcedCommunesRef.current.length
      ? enforcedCommunesRef.current.map((commune) => communeLayersRef.current[commune]).filter((layer): layer is L.GeoJSON => Boolean(layer))
      : (selectedCommune !== 'ALL' && communeLayersRef.current[selectedCommune] ? [communeLayersRef.current[selectedCommune]] : [])
    const initialBounds = initialLayers.length ? L.featureGroup(initialLayers).getBounds() : undefined
    const fallbackBounds = legacyFeatures.length > 0
      ? L.geoJSON({ type: 'FeatureCollection', features: legacyFeatures } as GeoJSON.FeatureCollection).getBounds()
      : null
    if (initialBounds?.isValid() || fallbackBounds?.isValid()) {
      map.fitBounds(initialBounds?.isValid() ? initialBounds : fallbackBounds!, { padding: [30, 30], maxZoom: initialBounds?.isValid() ? 15 : 14 })
    }

    return () => {
      mapContainerRef.current?.removeEventListener('wheel', stopPageScroll)
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadTerritorialBoundaries = async () => {
      try {
        const responses = await Promise.all([
          fetch('/geography/regions.geojson'),
          fetch('/geography/provinces.geojson'),
          fetch('/geography/communes.geojson'),
        ])
        if (responses.some((response) => !response.ok)) throw new Error('Unable to load territorial boundaries')

        const [regions, provinces, communes] = await Promise.all(responses.map((response) => response.json()))
        if (cancelled) return

        territorialBoundaryDataRef.current = { region: regions, province: provinces, commune: communes }
        renderTerritorialLayers(territoryFilterRef.current, nationalBoundariesVisibleRef.current)
      } catch (error) {
        console.error('Unable to load territorial boundaries:', error)
      }
    }

    void loadTerritorialBoundaries()
    return () => { cancelled = true }
  }, [renderTerritorialLayers])

  useEffect(() => {
    renderTerritorialLayers(territoryFilter ?? DEFAULT_TERRITORY_FILTER, nationalBoundariesVisible)
  }, [nationalBoundariesVisible, renderTerritorialLayers, territoryFilter])

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
      const territorialBounds = territorialLayerGroupRef.current?.getBounds()
      const nationalBounds = territorialBoundaryDataRef.current
        ? L.geoJSON(territorialBoundaryDataRef.current.region as GeoJSON.GeoJsonObject).getBounds()
        : null
      const allBounds = territorialBounds?.isValid() ? territorialBounds : nationalBounds
      if (allBounds?.isValid()) map.fitBounds(allBounds, { padding: [30, 30], maxZoom: 6 })
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

  // Toggle commune popups when setting changes
  useEffect(() => {
    const communeLayers = communeLayersRef.current
    const show = showCommunePopups ?? true

    Object.entries(communeLayers).forEach(([key, geoJsonLayer]) => {
      geoJsonLayer.eachLayer((layer) => {
        const l = layer as L.GeoJSON
        if (show) {
          const feature = COMMUNES_GEOJSON.features.find(f => f.properties.name === COMMUNE_NAME_MAP[key])
          const color = feature?.properties.color || '#059669'
          const isBouknadel = key === 'سيدي أبي القنادل'
          if (!l.getPopup()) {
            l.bindPopup(buildCommunePopup(feature as GeoJSON.Feature, color, isBouknadel), { maxWidth: 360, minWidth: 300 })
          }
        } else {
          if (l.getPopup()) {
            l.unbindPopup()
          }
        }
      })
    })
  }, [showCommunePopups])

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return
    const markersLayer = markersLayerRef.current
    markersLayer.clearLayers()
    const visibleCommunes = enforcedCommunes?.length ? enforcedCommunes : (enforcedCommune ? [enforcedCommune] : (selectedCommune !== 'ALL' ? [selectedCommune] : []))

    // Quartier markers (controlled by showQuartiers toggle)
    if (externalShowQuartiers !== false) {
      quartiers.forEach((q) => {
      const pointCommune = enforcedCommune
        ? (getLegacyCommuneForPoint(q.latitude, q.longitude) || getCommuneForPoint(q.latitude, q.longitude))
        : getCommuneForPoint(q.latitude, q.longitude)
      if (visibleCommunes.length && (!pointCommune || !visibleCommunes.includes(pointCommune))) return

      const marker = L.marker([q.latitude, q.longitude], { icon: createQuartierIcon() })
      marker.bindPopup(buildQuartierPopup(q), { maxWidth: 280, minWidth: 220 })
      // Prevent map click from firing when clicking quartier markers
      marker.on('click', (e: L.LeafletMouseEvent) => {
        L.DomEvent.stopPropagation(e)
      })
      markersLayer.addLayer(marker)
    })
    } // end showQuartiers

    // Intervention markers with enhanced popups
    interventions.forEach((intervention) => {
      const pointCommune = enforcedCommune
        ? (getLegacyCommuneForPoint(intervention.latitude, intervention.longitude) || getCommuneForPoint(intervention.latitude, intervention.longitude))
        : getCommuneForPoint(intervention.latitude, intervention.longitude)
      if (visibleCommunes.length && (!pointCommune || !visibleCommunes.includes(pointCommune))) return

      const marker = L.marker([intervention.latitude, intervention.longitude], {
        icon: createInterventionIcon(intervention.type, intervention.statut),
      })

      // Don't bind Leaflet popup — use the floating overlay from map-view-lite instead
      marker.on('click', (e: L.LeafletMouseEvent) => {
        // Prevent the map click handler from firing (which would open the new-intervention form)
        L.DomEvent.stopPropagation(e)
        // Close any open new-intervention popup
        if (clickMarkerRef.current) {
          mapRef.current?.removeLayer(clickMarkerRef.current)
          clickMarkerRef.current = null
        }
        if (onInterventionClickRef.current) {
          onInterventionClickRef.current(intervention, intervention.latitude, intervention.longitude)
        }
      })
      markersLayer.addLayer(marker)
    })

    // Public complaint markers with known GPS coordinates.
    complaints.forEach((complaint) => {
      if (complaint.latitude == null || complaint.longitude == null) return
      const pointCommune = enforcedCommune
        ? (getLegacyCommuneForPoint(complaint.latitude, complaint.longitude) || getCommuneForPoint(complaint.latitude, complaint.longitude) || complaint.commune)
        : (getCommuneForPoint(complaint.latitude, complaint.longitude) || complaint.commune)
      if (visibleCommunes.length && (!pointCommune || !visibleCommunes.some((commune) => communeNamesMatch(commune, pointCommune) || communeNamesMatch(commune, complaint.commune)))) return

      const marker = L.marker([complaint.latitude, complaint.longitude], { icon: createComplaintIcon(complaint.statut) })
      marker.bindPopup(buildComplaintPopup(complaint), { maxWidth: 300, minWidth: 235 })
      marker.on('click', (event: L.LeafletMouseEvent) => L.DomEvent.stopPropagation(event))
      markersLayer.addLayer(marker)
    })
  }, [complaints, enforcedCommune, enforcedCommunes, interventions, quartiers, selectedCommune, externalShowQuartiers])

  return (
    <div
      ref={mapContainerRef}
      className="w-full h-full"
      style={{ minHeight: '400px', position: 'relative', zIndex: 1, touchAction: 'none', overscrollBehavior: 'contain' }}
    />
  )
}
