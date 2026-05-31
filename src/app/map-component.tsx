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
        <span>بوقنادل سلا — <span style="color:#475569;font-weight:600;">عمالة سلا</span></span>
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
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">💊 المنتج</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.produitUtilise || '—'}</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #f1f5f9;">
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">📐 المساحة</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.superficie || '—'}</div>
      </div>
      <div style="background:#f8fafc;border-radius:8px;padding:8px 10px;border:1px solid #f1f5f9;">
        <div style="font-size:9px;color:#94a3b8;font-weight:600;margin-bottom:2px;">🔢 الكمية</div>
        <div style="font-size:12px;color:#334155;font-weight:700;">${intervention.quantite || '—'}</div>
      </div>
    </div>
  `

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
  const communeLabel = commune ? COMMUNE_NAME_MAP[commune] || commune : 'خارج حدود الجماعات'
  const communeColor = commune === 'سيدي أبي القنادل' ? '#7c3aed' : commune === 'سلا' ? '#059669' : commune === 'عامر' ? '#d97706' : '#64748b'
  const isOutsideCommune = !commune
  const today = new Date().toISOString().split('T')[0]

  const quartierOptions = quartiers.map(q => `<option value="${q.nom}">${q.nom}</option>`).join('')

  // Commune select options - auto-select detected commune
  const communeSelectOptions = [
    `<option value="" ${!commune ? 'selected' : ''}>— اختر الجماعة —</option>`,
    `<option value="سلا" ${commune === 'سلا' ? 'selected' : ''}>جماعة سلا</option>`,
    `<option value="سيدي أبي القنادل" ${commune === 'سيدي أبي القنادل' ? 'selected' : ''}>جماعة سيدي أبي القنادل</option>`,
    `<option value="عامر" ${commune === 'عامر' ? 'selected' : ''}>جماعة عامر</option>`,
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
          <select name="type" style="${selectStyle}" required>
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
          <input type="text" name="agentNom" placeholder="اسم العون المكلف" style="${inputStyle}" required />
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="${labelStyle}">${requiredStar}الحي</label>
          <select name="quartier" style="${selectStyle}" required>
            <option value="">اختر الحي</option>
            ${quartierOptions}
          </select>
        </div>
        <div>
          <label style="${labelStyle}">العنوان</label>
          <input type="text" name="adresse" placeholder="رقم واسم الشارع" style="${inputStyle}" />
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
        <div>
          <label style="${labelStyle}">المادة المستعملة</label>
          <input type="text" name="produitUtilise" placeholder="اسم المادة" style="${inputStyle}" />
        </div>
        <div>
          <label style="${labelStyle}">الكمية</label>
          <input type="text" name="quantite" placeholder="الكمية والوحدة" style="${inputStyle}" />
        </div>
        <div>
          <label style="${labelStyle}">المساحة</label>
          <input type="text" name="superficie" placeholder="م²" style="${inputStyle}" />
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

export default function MapComponent({ interventions, quartiers, selectedCommune, onMapClick, mapClickEnabled, showCommunePopups, onInterventionCreated }: { 
  interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: string;
  onMapClick?: (lat: number, lng: number, commune: string | null) => void;
  mapClickEnabled?: boolean;
  showCommunePopups?: boolean;
  onInterventionCreated?: () => void;
}) {
  const mapRef = useRef<L.Map | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersLayerRef = useRef<L.LayerGroup | null>(null)
  const communeLayersRef = useRef<Record<string, L.GeoJSON>>({})
  const communeLabelsRef = useRef<L.Marker[]>([])
  const communeLayerGroupRef = useRef<L.LayerGroup | null>(null)
  const clickMarkerRef = useRef<L.Marker | null>(null)
  const onMapClickRef = useRef(onMapClick)
  const mapClickEnabledRef = useRef(mapClickEnabled ?? true)
  const showCommunePopupsRef = useRef(showCommunePopups ?? true)
  const onInterventionCreatedRef = useRef(onInterventionCreated)

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

          // Professional popup (conditional)
          if (showCommunePopupsRef.current) {
            layer.bindPopup(buildCommunePopup(feat, color, isBouknadel), { maxWidth: 360, minWidth: 300 })
          }

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
      // Check if map click is enabled via ref
      if (!mapClickEnabledRef.current) return

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

      // Build form popup
      const popupContent = buildNewInterventionPopup(lat, lng, commune, quartiers)

      newMarker.bindPopup(popupContent, { maxWidth: 440, minWidth: 360, closeButton: true })
      newMarker.addTo(map)
      clickMarkerRef.current = newMarker

      // Open popup immediately
      newMarker.openPopup()

      // Listen for popup open to attach form submit handler
      newMarker.on('popupopen', () => {
        setTimeout(() => {
          const form = document.getElementById('new-intervention-form') as HTMLFormElement | null
          if (form) {
            form.onsubmit = (e) => {
              e.preventDefault()
              const formData = new FormData(form)
              const selectedCommune = formData.get('commune') as string || ''
              const data: Record<string, string> = {
                type: formData.get('type') as string || 'DERATISATION',
                date: formData.get('date') as string || new Date().toISOString().split('T')[0],
                quartier: formData.get('quartier') as string || '',
                adresse: formData.get('adresse') as string || '',
                commune: selectedCommune,
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
              if (!commune && !selectedCommune) {
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
              .then(res => {
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
                  throw new Error('Failed')
                }
              })
              .catch(() => {
                const statusEl = document.getElementById('popup-form-status')
                if (statusEl) {
                  statusEl.style.display = 'block'
                  statusEl.style.background = '#fef2f2'
                  statusEl.style.color = '#dc2626'
                  statusEl.style.border = '1px solid #fecaca'
                  statusEl.textContent = '❌ حدث خطأ أثناء الحفظ'
                }
                if (btn) {
                  btn.disabled = false
                  btn.style.opacity = '1'
                  btn.innerHTML = '💾 حفظ التدخل'
                }
              })
            }
          }
        }, 100)
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

    // Quartier markers
    quartiers.forEach((q) => {
      const pointCommune = getCommuneForPoint(q.latitude, q.longitude)
      if (selectedCommune !== 'ALL' && pointCommune !== selectedCommune) return

      const marker = L.marker([q.latitude, q.longitude], { icon: createQuartierIcon() })
      marker.bindPopup(buildQuartierPopup(q), { maxWidth: 280, minWidth: 220 })
      markersLayer.addLayer(marker)
    })

    // Intervention markers with enhanced popups
    interventions.forEach((intervention) => {
      const pointCommune = getCommuneForPoint(intervention.latitude, intervention.longitude)
      if (selectedCommune !== 'ALL' && pointCommune !== selectedCommune) return

      const marker = L.marker([intervention.latitude, intervention.longitude], {
        icon: createInterventionIcon(intervention.type, intervention.statut),
      })

      marker.bindPopup(buildInterventionPopup(intervention), { maxWidth: 340, minWidth: 280 })
      markersLayer.addLayer(marker)
    })
  }, [interventions, quartiers, selectedCommune])

  return <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
}
