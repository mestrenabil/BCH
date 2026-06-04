'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type CommuneType } from '@/lib/store'
import { toast } from 'sonner'

// ===== CONSTANTS =====
const COMMUNE_LABELS: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
}
const COMMUNE_NAMES_FR: Record<string, string> = {
  'سلا': 'Commune de Salé',
  'سيدي أبي القنادل': 'Commune de Sidi Bouknadel',
  'عامر': 'Commune Rurale d\'Ameur',
}
const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم',
}
const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة', EN_COURS: 'جارية', TERMINEE: 'منجزة', ANNULEE: 'ملغاة',
}
const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981',
}
const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6', EN_COURS: '#f59e0b', TERMINEE: '#10b981', ANNULEE: '#6b7280',
}
const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

// Default commune info
const COMMUNE_DEFAULTS: Record<string, { address: string; phone: string; fax: string; email: string }> = {
  'سلا': { address: 'زنقة مولاي إدريس الأول، سلا', phone: '+212 5 37 80 10 10', fax: '+212 5 37 80 10 11', email: 'contact@commune-sala.ma' },
  'سيدي أبي القنادل': { address: 'شارع محمد الخامس، سيدي أبي القنادل', phone: '+212 5 37 82 20 20', fax: '+212 5 37 82 20 21', email: 'contact@commune-bouknadel.ma' },
  'عامر': { address: 'دوار عامر، إقليم سلا', phone: '+212 5 37 83 30 30', fax: '+212 5 37 83 30 31', email: 'contact@commune-ameur.ma' },
}

type ExportType = 'interventions' | 'statistics' | 'inventory' | 'monthly' | 'commune' | 'custom'

interface PrintDocumentProps {
  isOpen: boolean
  onClose: () => void
  exportType: ExportType | null
  filterCommune: string
  filterYear: string
  filterType: string
  filterStatut: string
  filterFrom: string
  filterTo: string
}

interface InterventionRow {
  reference: string
  type: string
  date: string
  quartier: string
  adresse: string
  commune: string
  statut: string
  agentNom: string
  produitUtilise: string
  superficie: string
  observations: string
  nombrePrestations: number
  materials: string
}

interface StatsData {
  total: number
  byType: Record<string, number>
  byStatut: Record<string, number>
  byCommune: Record<string, { total: number; DERATISATION: number; DESINSECTISATION: number; DESINFECTION: number }>
}

export default function PrintDocument({
  isOpen, onClose, exportType, filterCommune, filterYear, filterType, filterStatut, filterFrom, filterTo,
}: PrintDocumentProps) {
  const { user, settings, updateSettings, saveSettings } = useAppStore()
  const [interventions, setInterventions] = useState<InterventionRow[]>([])
  const [statsData, setStatsData] = useState<StatsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Editable signature/settings fields
  const [presidentName, setPresidentName] = useState(settings.presidentName || '')
  const [responsableName, setResponsableName] = useState(settings.responsableName || '')
  const [chefServiceName, setChefServiceName] = useState(settings.chefServiceName || '')
  const [communeAddress, setCommuneAddress] = useState(settings.communeAddress || '')
  const [communePhone, setCommunePhone] = useState(settings.communePhone || '')
  const [communeFax, setCommuneFax] = useState(settings.communeFax || '')
  const [communeEmail, setCommuneEmail] = useState(settings.communeEmail || '')
  const [showWatermark, setShowWatermark] = useState(settings.showWatermark || false)

  // Auto-save settings
  const saveAllSettings = useCallback(async () => {
    try {
      updateSettings({
        presidentName, responsableName, chefServiceName,
        communeAddress, communePhone, communeFax, communeEmail, showWatermark,
      })
      await saveSettings()
    } catch { /* ignore */ }
  }, [presidentName, responsableName, chefServiceName, communeAddress, communePhone, communeFax, communeEmail, showWatermark, updateSettings, saveSettings])

  // Get commune display name
  const communeDisplay = filterCommune !== 'ALL'
    ? COMMUNE_LABELS[filterCommune] || filterCommune
    : 'جميع الجماعات الترابية'
  const communeNameFr = filterCommune !== 'ALL'
    ? COMMUNE_NAMES_FR[filterCommune] || ''
    : 'Toutes les Communes'
  const communeNameAr = settings.communeNameAr || filterCommune

  // Get default address info for commune
  const communeDefaults = filterCommune !== 'ALL' ? COMMUNE_DEFAULTS[filterCommune] : null

  // Load data when dialog opens
  useEffect(() => {
    if (!isOpen) return
    setIsLoading(true)
    setPresidentName(settings.presidentName || '')
    setResponsableName(settings.responsableName || '')
    setChefServiceName(settings.chefServiceName || '')
    setCommuneAddress(settings.communeAddress || communeDefaults?.address || '')
    setCommunePhone(settings.communePhone || communeDefaults?.phone || '')
    setCommuneFax(settings.communeFax || communeDefaults?.fax || '')
    setCommuneEmail(settings.communeEmail || communeDefaults?.email || '')
    setShowWatermark(settings.showWatermark || false)

    const loadData = async () => {
      try {
        const params = new URLSearchParams()
        if (filterCommune !== 'ALL') params.set('commune', filterCommune)
        if (filterYear) {
          params.set('year', filterYear)
          if (filterFrom) params.set('from', filterFrom)
          if (filterTo) params.set('to', filterTo)
        }
        if (filterType !== 'ALL') params.set('type', filterType)
        if (filterStatut !== 'ALL') params.set('statut', filterStatut)

        const intRes = await fetch(`/api/interventions?${params.toString()}&limit=500`)
        if (intRes.ok) {
          const intData = await intRes.json()
          const rows: InterventionRow[] = (intData.interventions || []).map((int: Record<string, unknown>) => {
            const materials = Array.isArray(int.materials)
              ? (int.materials as Array<Record<string, unknown>>).map((m: Record<string, unknown>) => {
                  const prod = m.product as Record<string, unknown> | undefined
                  return `${prod?.nom || ''}(${m.quantity || 0} ${prod?.unite || ''})`
                }).join(' | ')
              : ''
            return {
              reference: int.reference as string || '—',
              type: int.type as string || '—',
              date: int.date as string || '—',
              quartier: int.quartier as string || '—',
              adresse: int.adresse as string || '—',
              commune: int.commune as string || '—',
              statut: int.statut as string || '—',
              agentNom: int.agentNom as string || '—',
              produitUtilise: int.produitUtilise as string || '',
              superficie: int.superficie as string || '—',
              observations: int.observations as string || '—',
              nombrePrestations: int.nombrePrestations as number || 1,
              materials: materials || (int.produitUtilise as string || ''),
            }
          })
          setInterventions(rows)
        }

        const statParams = new URLSearchParams()
        if (filterCommune !== 'ALL') statParams.set('commune', filterCommune)
        if (filterYear) statParams.set('year', filterYear)
        statParams.set('byCommune', 'true')
        const statRes = await fetch(`/api/statistics?${statParams.toString()}`)
        if (statRes.ok) {
          const statData = await statRes.json()
          setStatsData(statData)
        }
      } catch (err) {
        console.error('Failed to load print data:', err)
        toast.error('فشل في تحميل بيانات الطباعة')
      }
      setIsLoading(false)
    }
    loadData()
  }, [isOpen, filterCommune, filterYear, filterType, filterStatut, filterFrom, filterTo])

  // Document metadata
  const COMMUNE_REF_CODES: Record<string, string> = {
    'سلا': 'SAL',
    'سيدي أبي القنادل': 'SBN',
    'عامر': 'AMR',
  }
  const docReference = `BCH/${filterCommune !== 'ALL' ? (COMMUNE_REF_CODES[filterCommune] || filterCommune.substring(0, 3)) : 'ALL'}/${new Date().getFullYear()}/${String(Date.now()).slice(-5)}`
  const docDate = new Date().toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })
  const docDateFr = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })

  const getReportTitle = () => {
    switch (exportType) {
      case 'interventions': return 'تقرير التدخلات'
      case 'statistics': return 'التقرير الإحصائي'
      case 'inventory': return 'تقرير المخزون'
      case 'monthly': return 'التقرير الشهري'
      case 'commune': return 'التقرير حسب الجماعة'
      case 'custom': return 'تقرير مخصص'
      default: return 'تقرير'
    }
  }

  const getReportTitleFr = () => {
    switch (exportType) {
      case 'interventions': return 'Rapport des Interventions'
      case 'statistics': return 'Rapport Statistique'
      case 'inventory': return 'Rapport d\'Inventaire'
      case 'monthly': return 'Rapport Mensuel'
      case 'commune': return 'Rapport par Commune'
      case 'custom': return 'Rapport Personnalisé'
      default: return 'Rapport'
    }
  }

  // ========================
  // PRINT HANDLER — Generates a highly professional administrative document
  // ========================
  const handleClassicPrint = useCallback(() => {
    document.body.classList.add('classic-print-active')
    setTimeout(() => {
      window.print()
      setTimeout(() => {
        document.body.classList.remove('classic-print-active')
      }, 500)
    }, 100)
  }, [])

  const handlePrint = useCallback(() => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة')
      return
    }

    const periodLabel = filterYear
      ? `${filterYear} ${filterFrom ? '— من ' + filterFrom : ''} ${filterTo ? 'إلى ' + filterTo : ''}`
      : 'كل الفترات'
    const typeLabel = filterType !== 'ALL' ? TYPE_LABELS[filterType] || filterType : 'جميع الأنواع'
    const statutLabel = filterStatut !== 'ALL' ? STATUT_LABELS[filterStatut] || filterStatut : 'جميع الحالات'

    // Summary stats
    const totalInterventions = interventions.length
    const deratisation = interventions.filter(i => i.type === 'DERATISATION').length
    const desinsectisation = interventions.filter(i => i.type === 'DESINSECTISATION').length
    const desinfection = interventions.filter(i => i.type === 'DESINFECTION').length
    const terminee = interventions.filter(i => i.statut === 'TERMINEE').length
    const enCours = interventions.filter(i => i.statut === 'EN_COURS').length
    const planifiee = interventions.filter(i => i.statut === 'PLANIFIEE').length
    const annulee = interventions.filter(i => i.statut === 'ANNULEE').length

    // Split interventions into pages (max 20 rows per page)
    const pageSize = 20
    const pages: InterventionRow[][] = []
    for (let i = 0; i < interventions.length; i += pageSize) {
      pages.push(interventions.slice(i, i + pageSize))
    }

    // Generate data table pages HTML
    const dataTablePages = pages.map((pageRows, pageIdx) => {
      const tableRows = pageRows.map((int, i) => {
        const globalIdx = pageIdx * pageSize + i
        const dateFormatted = new Date(int.date).toLocaleDateString('fr-FR')
        const typeBgColor = TYPE_COLORS[int.type] || '#64748b'
        const statutBgColor = STATUT_COLORS[int.statut] || '#64748b'
        return `<tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:6px 8px;text-align:center;font-size:10px;color:#64748b;">${globalIdx + 1}</td>
          <td style="padding:6px 8px;text-align:center;font-size:10px;font-family:monospace;color:#334155;"><span class="bidi-ref" style="font-size:10px;">${int.reference}</span></td>
          <td style="padding:6px 8px;text-align:center;"><span style="background:${typeBgColor};color:white;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">${TYPE_LABELS[int.type] || int.type}</span></td>
          <td style="padding:6px 8px;text-align:center;font-size:10px;color:#334155;">${dateFormatted}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:#334155;">${int.quartier}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:#334155;">${int.adresse}</td>
          <td style="padding:6px 8px;text-align:center;"><span style="background:${statutBgColor};color:white;padding:1px 6px;border-radius:3px;font-size:9px;font-weight:700;">${STATUT_LABELS[int.statut] || int.statut}</span></td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:#334155;">${int.agentNom}</td>
          <td style="padding:6px 8px;text-align:center;font-size:10px;color:#334155;">${int.superficie}</td>
          <td style="padding:6px 8px;text-align:right;font-size:10px;color:#334155;">${int.materials || int.produitUtilise || '—'}</td>
        </tr>`
      }).join('')

      return `<div class="page">
        <!-- Repeated mini header -->
        <div class="mini-header">
          <table cellpadding="0" cellspacing="0" style="width:100%;"><tr>
            <td style="text-align:right;width:33%;">
              <span style="font-size:10px;font-weight:700;color:#047857;">المملكة المغربية</span><br>
              <span style="font-size:9px;color:#6b7280;">عمالة سلا — قسم حفظ الصحة</span>
            </td>
            <td style="text-align:center;width:34%;">
              <span style="font-size:11px;font-weight:800;color:#047857;">مكتب حفظ الصحة الجماعي</span><br>
              <span style="font-size:8px;color:#9ca3af;font-style:italic;">Bureau Communal de l'Hygiène</span>
            </td>
            <td style="text-align:left;width:33%;">
              <span class="bidi-fr" style="font-size:9px;color:#6b7280;">${communeNameFr}</span><br>
              <span class="bidi-ref" style="font-size:8px;color:#9ca3af;">${docReference}</span>
            </td>
          </tr></table>
        </div>

        <div style="font-size:11px;font-weight:700;color:#047857;margin:10px 0;">📋 تفصيل التدخلات — ${pageIdx === 0 ? `${totalInterventions} تدخل` : `تتمة (${pageIdx + 1}/${pages.length})`}</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="text-align:center;width:25px;">#</th>
              <th style="text-align:center;">المرجع</th>
              <th style="text-align:center;">النوع</th>
              <th style="text-align:center;">التاريخ</th>
              <th style="text-align:right;">الحي</th>
              <th style="text-align:right;">العنوان</th>
              <th style="text-align:center;">الحالة</th>
              <th style="text-align:right;">العون</th>
              <th style="text-align:center;">المساحة</th>
              <th style="text-align:right;">المواد</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        ${pageIdx === pages.length - 1 ? buildSignatureBlock(presidentName, responsableName, chefServiceName) : ''}

        <!-- Page footer -->
        <div class="page-footer">
          <table style="width:100%;"><tr>
            <td style="text-align:right;font-size:7px;color:#9ca3af;"><span class="bidi-fr">${communeNameFr}</span> — <span class="bidi-ar">مكتب حفظ الصحة الجماعي</span></td>
            <td style="text-align:center;font-size:7px;color:#9ca3af;"><span class="bidi-ref" style="font-size:7px;">${docReference}</span></td>
            <td class="bidi-fr" style="text-align:left;font-size:7px;color:#9ca3af;">Page ${pageIdx + 2}/${pages.length + 1}</td>
          </tr></table>
        </div>
      </div>`
    }).join('')

    // Commune stats table
    const communeStatsRows = statsData?.byCommune
      ? Object.entries(statsData.byCommune).map(([name, data]) => {
          return `<tr style="border-bottom:1px solid #e2e8f0;">
            <td style="padding:8px 12px;text-align:right;font-weight:600;color:#334155;">${COMMUNE_LABELS[name] || name}</td>
            <td style="padding:8px 12px;text-align:center;font-weight:700;color:#334155;">${data.total}</td>
            <td style="padding:8px 12px;text-align:center;color:#ef4444;font-weight:600;">${data.DERATISATION}</td>
            <td style="padding:8px 12px;text-align:center;color:#f59e0b;font-weight:600;">${data.DESINSECTISATION}</td>
            <td style="padding:8px 12px;text-align:center;color:#10b981;font-weight:600;">${data.DESINFECTION}</td>
          </tr>`
        }).join('')
      : ''

    // Address block
    const addressLine = communeAddress || (communeDefaults?.address || '')
    const phoneLine = communePhone || (communeDefaults?.phone || '')
    const faxLine = communeFax || (communeDefaults?.fax || '')
    const emailLine = communeEmail || (communeDefaults?.email || '')

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${getReportTitle()} — ${communeDisplay}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@300;400;500;600;700;800;900&family=Amiri:wght@400;700&display=swap');
    @page {
      size: A4;
      margin: 14mm 10mm 20mm 10mm;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
      direction: rtl;
      color: #1e293b;
      line-height: 1.5;
      font-size: 11px;
    }

    /* ===== WATERMARK ===== */
    ${showWatermark ? `
    body::before {
      content: '${settings.watermarkText || 'BCH'}';
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(-35deg);
      font-size: 100px;
      font-weight: 900;
      color: rgba(5, 150, 105, 0.04);
      pointer-events: none;
      z-index: 0;
      white-space: nowrap;
      font-family: 'Amiri', serif;
    }
    ` : ''}

    .page {
      page-break-after: always;
      padding: 0;
      position: relative;
    }
    .page:last-child { page-break-after: avoid; }

    /* ===== DOUBLE ORNAMENTAL BORDER TOP ===== */
    .page::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 5px;
      background: linear-gradient(90deg, #059669, #0d9488, #059669, #0d9488, #059669);
      border-radius: 0 0 2px 2px;
    }
    .page::after {
      content: '';
      position: absolute;
      top: 7px;
      right: 0;
      left: 0;
      height: 2px;
      background: linear-gradient(90deg, rgba(5,150,105,0.3), rgba(5,150,105,0.5), rgba(5,150,105,0.3));
    }

    /* ===== EN-TÊTE / HEADER ===== */
    .doc-header {
      padding-bottom: 14px;
      margin-bottom: 16px;
      position: relative;
    }
    .doc-header-border {
      border-bottom: 3px solid #059669;
      position: relative;
    }
    .doc-header-border::after {
      content: '';
      position: absolute;
      bottom: -5px;
      left: 0;
      right: 0;
      height: 1.5px;
      background: #059669;
    }
    .header-ornament {
      height: 6px;
      background: linear-gradient(90deg, #059669 0%, #10b981 20%, #059669 40%, #d97706 50%, #059669 60%, #10b981 80%, #059669 100%);
      border-radius: 3px;
      margin-bottom: 10px;
    }

    .header-table {
      width: 100%;
      border-collapse: collapse;
    }
    .header-table td {
      vertical-align: top;
      padding: 0;
    }
    .header-right { width: 30%; text-align: right; }
    .header-center { width: 40%; text-align: center; }
    .header-left { width: 30%; text-align: left; }

    /* Kingdom badge - Arabic */
    .kingdom-badge-ar {
      display: inline-block;
      background: linear-gradient(135deg, #059669, #047857);
      color: white;
      padding: 4px 14px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 1px 3px rgba(5,150,105,0.3);
    }
    .wilaya-name {
      font-size: 13px;
      font-weight: 700;
      color: #047857;
      margin-top: 5px;
      line-height: 1.3;
    }
    .dept-name {
      font-size: 10px;
      color: #475569;
      margin-top: 1px;
    }

    /* Logo center */
    .logo-section {
      text-align: center;
      padding: 0 10px;
    }
    .logo-emblem {
      font-size: 36px;
      display: block;
      margin-bottom: 2px;
    }
    .logo-title-ar {
      font-size: 15px;
      font-weight: 900;
      color: #047857;
      letter-spacing: -0.2px;
      line-height: 1.3;
    }
    .logo-title-fr {
      font-size: 9.5px;
      color: #6b7280;
      font-style: italic;
      font-weight: 400;
    }
    .logo-commune {
      font-size: 11px;
      font-weight: 700;
      color: #0d9488;
      margin-top: 3px;
      padding: 2px 10px;
      background: #f0fdf4;
      border-radius: 12px;
      display: inline-block;
      border: 1px solid #bbf7d0;
    }

    /* Kingdom badge - French */
    .kingdom-badge-fr {
      display: inline-block;
      background: linear-gradient(135deg, #475569, #334155);
      color: white;
      padding: 4px 14px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.3px;
      box-shadow: 0 1px 3px rgba(71,85,105,0.3);
    }

    /* ===== CONTACT BAR ===== */
    .contact-bar {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 15px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 5px 12px;
      margin-top: 10px;
      font-size: 8px;
      color: #64748b;
    }
    .contact-bar span {
      white-space: nowrap;
    }
    .contact-sep {
      color: #cbd5e1;
    }

    /* ===== DOCUMENT INFO BAR ===== */
    .doc-info-bar {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      direction: rtl;
      background: linear-gradient(135deg, #f0fdf4, #ecfdf5);
      border: 1px solid #bbf7d0;
      border-radius: 8px;
      padding: 10px 16px;
      margin-bottom: 14px;
    }
    .doc-ref {
      font-size: 10px;
      color: #166534;
      font-weight: 600;
      direction: rtl;
      text-align: right;
    }
    .doc-ref span {
      font-family: monospace;
      background: white;
      padding: 1px 8px;
      border-radius: 3px;
      border: 1px solid #bbf7d0;
      font-size: 10px;
    }
    /* ===== BIDI HELPERS ===== */
    .bidi-ar { direction: rtl; unicode-bidi: isolate; }
    .bidi-fr { direction: ltr; unicode-bidi: isolate; display: inline-block; }
    .bidi-ref { direction: ltr; unicode-bidi: embed; display: inline-block; font-family: monospace; }
    .bidi-ltr-block { direction: ltr; text-align: left; }
    .doc-date {
      font-size: 10px;
      color: #166534;
      font-weight: 500;
    }
    .doc-date-fields {
      display: flex;
      gap: 16px;
      align-items: center;
      direction: rtl;
    }
    .doc-date-field {
      font-size: 9px;
      color: #374151;
      direction: rtl;
      text-align: right;
    }
    .doc-date-field-label {
      font-weight: 700;
      color: #047857;
    }

    /* ===== REPORT TITLE SECTION ===== */
    .report-title-section {
      text-align: center;
      margin-bottom: 16px;
      padding: 14px 16px;
      background: linear-gradient(135deg, #ecfdf5, #f0fdf4);
      border-radius: 10px;
      border: 1.5px solid #a7f3d0;
      position: relative;
    }
    .report-title-section::before {
      content: '';
      position: absolute;
      top: 0; right: 0; bottom: 0; left: 0;
      border-radius: 10px;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 10px,
        rgba(5,150,105,0.02) 10px,
        rgba(5,150,105,0.02) 11px
      );
    }
    .report-title-ar {
      font-size: 18px;
      font-weight: 900;
      color: #047857;
      margin-bottom: 2px;
      position: relative;
    }
    .report-title-fr {
      font-size: 11px;
      color: #6b7280;
      font-style: italic;
      position: relative;
    }
    .report-commune {
      font-size: 13px;
      font-weight: 700;
      color: #0f766e;
      margin-top: 6px;
      padding: 3px 16px;
      background: white;
      border-radius: 20px;
      display: inline-block;
      border: 1.5px solid #99f6e4;
      position: relative;
    }
    .report-filters {
      margin-top: 6px;
      font-size: 9px;
      color: #6b7280;
      position: relative;
    }
    .report-filters span {
      background: white;
      padding: 1px 6px;
      border-radius: 3px;
      margin: 0 2px;
      border: 1px solid #e2e8f0;
    }

    /* ===== OBJECT LINE ===== */
    .object-line {
      margin-bottom: 8px;
      padding: 6px 14px;
      background: #fff;
      border-right: 4px solid #059669;
      border-radius: 0 6px 6px 0;
    }
    .object-label {
      font-size: 9px;
      color: #94a3b8;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .object-value {
      font-size: 11px;
      color: #1e293b;
      font-weight: 700;
    }

    /* ===== REF LINE ===== */
    .ref-line {
      margin-bottom: 14px;
      padding: 6px 14px;
      background: #fafafa;
      border-right: 4px solid #d97706;
      border-radius: 0 6px 6px 0;
    }
    .ref-label {
      font-size: 9px;
      color: #92400e;
      font-weight: 600;
      letter-spacing: 0.5px;
    }
    .ref-value {
      font-size: 11px;
      color: #1e293b;
      font-weight: 700;
      font-family: monospace;
    }

    /* ===== SUMMARY CARDS ===== */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .summary-card-value {
      font-size: 20px;
      font-weight: 900;
      line-height: 1;
    }
    .summary-card-label {
      font-size: 8px;
      color: #64748b;
      margin-top: 2px;
      font-weight: 500;
    }

    /* ===== DATA TABLE ===== */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
      font-size: 10px;
    }
    .data-table thead tr {
      background: linear-gradient(135deg, #059669, #0d9488);
    }
    .data-table thead th {
      padding: 7px 6px;
      color: white;
      font-size: 9px;
      font-weight: 700;
      text-align: right;
      white-space: nowrap;
      border-left: 1px solid rgba(255,255,255,0.15);
    }
    .data-table thead th:first-child { border-left: none; }
    .data-table tbody tr:nth-child(even) { background: #f8fafc; }
    .data-table tbody tr:hover { background: #ecfdf5; }

    /* ===== COMMUNE STATS TABLE ===== */
    .stats-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .stats-table thead tr { background: linear-gradient(135deg, #0d9488, #059669); }
    .stats-table thead th { padding: 7px 10px; color: white; font-size: 9px; font-weight: 700; }

    /* ===== MINI HEADER (repeated on subsequent pages) ===== */
    .mini-header {
      width: 100%;
      border-bottom: 2px solid #059669;
      padding-bottom: 6px;
      margin-bottom: 10px;
      position: relative;
    }
    .mini-header::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      right: 0;
      height: 1px;
      background: #059669;
    }

    /* ===== ENHANCED SIGNATURE BLOCK ===== */
    .signature-section {
      margin-top: 40px;
      padding-top: 16px;
      position: relative;
    }
    .signature-decorative-border {
      border: 2px solid #d1d5db;
      border-radius: 12px;
      padding: 18px 16px 14px;
      background: linear-gradient(180deg, #fafafa 0%, #f9fafb 100%);
      position: relative;
    }
    .signature-decorative-border::before {
      content: '';
      position: absolute;
      top: -1px;
      left: 10%;
      right: 10%;
      height: 2px;
      background: linear-gradient(90deg, transparent, #059669, #d97706, #059669, transparent);
      border-radius: 1px;
    }
    .signature-main-title {
      text-align: center;
      font-size: 12px;
      color: #374151;
      font-weight: 800;
      margin-bottom: 20px;
      padding: 5px 20px;
      background: #f0fdf4;
      border-radius: 20px;
      display: inline-block;
      border: 1.5px solid #a7f3d0;
      letter-spacing: 0.5px;
    }
    .signature-title-center {
      text-align: center;
      margin-bottom: 22px;
    }
    .signature-grid {
      display: flex;
      justify-content: space-between;
      gap: 16px;
    }
    .signature-box {
      flex: 1;
      text-align: center;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 10px 10px;
      background: #ffffff;
      position: relative;
    }
    .signature-box::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: linear-gradient(90deg, #059669, #d97706);
      border-radius: 10px 10px 0 0;
    }
    .signature-role {
      font-size: 11px;
      font-weight: 800;
      color: #047857;
      margin-bottom: 1px;
      letter-spacing: 0.3px;
    }
    .signature-role-fr {
      font-size: 8.5px;
      color: #9ca3af;
      font-style: italic;
      margin-bottom: 8px;
    }
    .signature-line {
      border-top: 1px solid #374151;
      margin-top: 12px;
      width: 80%;
      margin-left: auto;
      margin-right: auto;
    }
    .signature-name {
      font-size: 10px;
      font-weight: 700;
      color: #1e293b;
      margin-top: 4px;
    }
    .signature-date {
      font-size: 8px;
      color: #94a3b8;
      margin-top: 3px;
    }
    .signature-date-line {
      display: inline-block;
      min-width: 80px;
      border-bottom: 1px dotted #cbd5e1;
      margin-right: 4px;
    }

    /* ===== PAGE FOOTER ===== */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 5px 10mm;
      border-top: 1px solid #e2e8f0;
      background: white;
    }

    /* ===== PRINT STYLES ===== */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page { page-break-after: always; }
      .page:last-child { page-break-after: avoid; }
      .data-table tbody tr:nth-child(even) { background: #f8fafc !important; }
      .signature-box, .summary-card, .report-title-section, .doc-info-bar, .contact-bar,
      .signature-decorative-border {
        -webkit-print-color-adjust: exact; print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>
  <!-- ==================== PAGE 1: COVER & SUMMARY ==================== -->
  <div class="page">
    <!-- EN-TÊTE HEADER -->
    <div class="doc-header">
      <!-- Green gradient ornamental bar -->
      <div class="header-ornament"></div>

      <div class="doc-header-border">
        <table class="header-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="header-right">
              <div class="kingdom-badge-ar">المملكة المغربية</div>
              <div class="wilaya-name">عمالة سلا</div>
              <div class="dept-name">قسم حفظ الصحة والبيئة</div>
              <div class="dept-name" style="font-size:8px;color:#9ca3af;font-style:italic;">Préfecture de Salé — Service d'Hygiène</div>
            </td>
            <td class="header-center">
              <div class="logo-section">
                <div class="logo-emblem">🏛️</div>
                <div class="logo-title-ar">مكتب حفظ الصحة الجماعي</div>
                <div class="logo-title-fr">Bureau Communal de l'Hygiène</div>
                <div class="logo-commune">${communeDisplay} — ${communeNameFr}</div>
              </div>
            </td>
            <td class="header-left">
              <div class="kingdom-badge-fr">Royaume du Maroc</div>
              <div class="wilaya-name" style="color:#475569;">Préfecture de Salé</div>
              <div class="dept-name">Service d'Hygiène et Environnement</div>
              <div class="dept-name" style="font-size:8px;color:#9ca3af;">قسم حفظ الصحة والبيئة</div>
            </td>
          </tr>
        </table>
      </div>
      ${addressLine || phoneLine ? `
      <div class="contact-bar">
        ${addressLine ? `<span class="bidi-ar">📍 ${addressLine}</span>` : ''}
        ${phoneLine ? `<span class="contact-sep">|</span><span class="bidi-fr">📞 ${phoneLine}</span>` : ''}
        ${faxLine ? `<span class="contact-sep">|</span><span class="bidi-fr">📠 ${faxLine}</span>` : ''}
        ${emailLine ? `<span class="contact-sep">|</span><span class="bidi-fr">✉ ${emailLine}</span>` : ''}
      </div>
      ` : ''}
    </div>

    <!-- DOCUMENT INFO BAR -->
    <div class="doc-info-bar" dir="rtl">
      <div style="display:flex;flex-direction:column;gap:4px;direction:rtl;">
        <div class="doc-ref" dir="rtl"><span class="bidi-ar">المرجع</span> : / <span class="bidi-fr">Réf :</span> <span class="bidi-ref" style="background:white;padding:1px 8px;border-radius:3px;border:1px solid #bbf7d0;">${docReference}</span></div>
      </div>
      <div class="doc-date-fields" dir="rtl">
        <div class="doc-date-field" dir="rtl">
          <span class="bidi-ar doc-date-field-label">حرر في</span> : / <span class="bidi-fr" style="font-weight:700;color:#047857;">Rédigé à :</span> <span class="bidi-ar">${communeNameAr || communeDisplay}</span>
        </div>
        <div class="doc-date-field" dir="rtl">
          <span class="bidi-ar doc-date-field-label">التاريخ</span> : / <span class="bidi-fr" style="font-weight:700;color:#047857;">Date :</span> <span class="bidi-ar">${docDate}</span>
        </div>
        <div class="doc-date-field" style="font-size:8px;color:#94a3b8;font-style:italic;direction:ltr;text-align:left;">
          <span class="bidi-fr">${docDateFr}</span>
        </div>
      </div>
    </div>

    <!-- REPORT TITLE -->
    <div class="report-title-section">
      <div class="report-title-ar">${getReportTitle()}</div>
      <div class="report-title-fr">${getReportTitleFr()}</div>
      <div class="report-commune">🏛️ ${communeDisplay} — ${communeNameFr}</div>
      <div class="report-filters">
        <span>📅 ${periodLabel}</span>
        <span>🏷️ ${typeLabel}</span>
        <span>📊 ${statutLabel}</span>
      </div>
    </div>

    <!-- OBJECT LINE -->
    <div class="object-line">
      <div class="object-label"><span class="bidi-ar">الموضوع</span> / <span class="bidi-fr" style="color:#94a3b8;font-weight:600;letter-spacing:0.5px;">Objet</span></div>
      <div class="object-value bidi-ar">${getReportTitle()} — ${communeNameAr || communeDisplay} — ${periodLabel}</div>
    </div>

    <!-- REF LINE -->
    <div class="ref-line">
      <div class="ref-label"><span class="bidi-ar">المرجع</span> / <span class="bidi-fr" style="color:#92400e;font-weight:600;letter-spacing:0.5px;">Référence</span></div>
      <div class="ref-value bidi-ref">${docReference}</div>
    </div>

    <!-- SUMMARY CARDS — Types -->
    <div class="summary-grid">
      <div class="summary-card" style="background:#f0fdf4;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#059669;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#059669;">${totalInterventions}</div>
        <div class="summary-card-label"><span class="bidi-ar">إجمالي التدخلات</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Total</span></div>
      </div>
      <div class="summary-card" style="background:#fef2f2;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#ef4444;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#ef4444;">${deratisation}</div>
        <div class="summary-card-label"><span class="bidi-ar">مكافحة القوارض</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Dératisation</span></div>
      </div>
      <div class="summary-card" style="background:#fffbeb;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#f59e0b;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#f59e0b;">${desinsectisation}</div>
        <div class="summary-card-label"><span class="bidi-ar">مكافحة الحشرات</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Désinsectisation</span></div>
      </div>
      <div class="summary-card" style="background:#ecfdf5;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#10b981;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#10b981;">${desinfection}</div>
        <div class="summary-card-label"><span class="bidi-ar">التطهير</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Désinfection</span></div>
      </div>
    </div>

    <!-- SUMMARY CARDS — Status -->
    <div class="summary-grid">
      <div class="summary-card">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#3b82f6;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#3b82f6;">${planifiee}</div>
        <div class="summary-card-label"><span class="bidi-ar">مبرمجة</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Planifiée</span></div>
      </div>
      <div class="summary-card">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#f59e0b;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#f59e0b;">${enCours}</div>
        <div class="summary-card-label"><span class="bidi-ar">جارية</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">En cours</span></div>
      </div>
      <div class="summary-card">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#10b981;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#10b981;">${terminee}</div>
        <div class="summary-card-label"><span class="bidi-ar">منجزة</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Terminée</span></div>
      </div>
      <div class="summary-card">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:#6b7280;border-radius:6px 6px 0 0;"></div>
        <div class="summary-card-value" style="color:#6b7280;">${annulee}</div>
        <div class="summary-card-label"><span class="bidi-ar">ملغاة</span> / <span class="bidi-fr" style="font-size:8px;color:#64748b;">Annulée</span></div>
      </div>
    </div>

    <!-- Commune breakdown table -->
    ${communeStatsRows ? `
    <div style="margin-top:8px;">
      <div style="font-size:11px;font-weight:700;color:#047857;margin-bottom:6px;"><span class="bidi-ar">📊 التوزيع حسب الجماعة</span> / <span class="bidi-fr" style="font-size:10px;color:#047857;">Répartition par Commune</span></div>
      <table class="stats-table">
        <thead>
          <tr>
            <th style="text-align:right;"><span class="bidi-ar">الجماعة</span> / <span class="bidi-fr" style="color:rgba(255,255,255,0.8);">Commune</span></th>
            <th style="text-align:center;"><span class="bidi-ar">الإجمالي</span> / <span class="bidi-fr" style="color:rgba(255,255,255,0.8);">Total</span></th>
            <th style="text-align:center;"><span class="bidi-ar">مكافحة القوارض</span></th>
            <th style="text-align:center;"><span class="bidi-ar">مكافحة الحشرات</span></th>
            <th style="text-align:center;"><span class="bidi-ar">التطهير</span></th>
          </tr>
        </thead>
        <tbody>${communeStatsRows}</tbody>
      </table>
    </div>
    ` : ''}

    <!-- SIGNATURE BLOCK -->
    ${buildSignatureBlock(presidentName, responsableName, chefServiceName)}

    <!-- Page footer -->
    <div class="page-footer">
      <table style="width:100%;"><tr>
        <td style="text-align:right;font-size:7px;color:#9ca3af;"><span class="bidi-fr">${communeNameFr}</span> — <span class="bidi-ar">مكتب حفظ الصحة الجماعي</span></td>
        <td style="text-align:center;font-size:7px;color:#9ca3af;"><span class="bidi-ref" style="font-size:7px;">${docReference}</span></td>
        <td class="bidi-fr" style="text-align:left;font-size:7px;color:#9ca3af;">Page 1/${pages.length + 1}</td>
      </tr></table>
    </div>
  </div>

  <!-- ==================== PAGE 2+: DATA TABLES ==================== -->
  ${interventions.length > 0 ? dataTablePages : `
  <div class="page">
    <div style="text-align:center;padding:80px 0;color:#9ca3af;">
      <div style="font-size:48px;margin-bottom:10px;">📭</div>
      <div style="font-size:13px;color:#64748b;">لا توجد بيانات لهذه المعايير</div>
      <div style="font-size:10px;color:#9ca3af;margin-top:4px;">Aucune donnée pour ces critères</div>
    </div>
  </div>
  `}
</body>
</html>`

    printWindow.document.write(html)
    printWindow.document.close()
    setTimeout(() => { printWindow.print() }, 1200)
  }, [interventions, statsData, exportType, filterCommune, filterYear, filterType, filterStatut, filterFrom, filterTo, presidentName, responsableName, chefServiceName, communeDisplay, communeNameFr, communeNameAr, docReference, docDate, docDateFr, showWatermark, settings.watermarkText, communeAddress, communePhone, communeFax, communeEmail, communeDefaults])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 no-classic-print" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col print-classic-container"
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-emerald-800 via-emerald-700 to-teal-700 text-white p-4 no-classic-print">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl">🖨️</div>
              <div>
                <h2 className="text-base font-extrabold">معاينة الطباعة — وثيقة إدارية احترافية</h2>
                <p className="text-emerald-100/80 text-[11px]">تنسيق رسمي مع ختم وتوقيع — {communeDisplay}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-all text-lg">✕</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {/* ===== DOCUMENT PREVIEW ===== */}
          <div className="border-2 border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
            {/* En-tête Preview */}
            <div className="relative">
              {/* Double decorative bar */}
              <div className="h-1.5 bg-gradient-to-l from-emerald-600 via-teal-500 to-emerald-600" />
              <div className="h-px bg-gradient-to-l from-emerald-300 via-amber-400 to-emerald-300" />

              {/* Ornamental bar */}
              <div className="h-1 bg-gradient-to-l from-emerald-600 via-amber-500 to-emerald-600 mx-2 mt-2 rounded-full" />

              <div className="p-4 border-b-2 border-emerald-600" style={{ borderBottomWidth: '3px', borderBottomColor: '#059669' }}>
                <div className="flex justify-between items-start">
                  <div className="text-right">
                    <div className="inline-block bg-emerald-600 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-sm">المملكة المغربية</div>
                    <div className="text-[11px] font-bold text-emerald-700 mt-1">عمالة سلا</div>
                    <div className="text-[9px] text-slate-500">قسم حفظ الصحة والبيئة</div>
                    <div className="text-[7px] text-slate-400 italic">Préfecture de Salé — Service d&apos;Hygiène</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl">🏛️</div>
                    <div className="text-[12px] font-extrabold text-emerald-700">مكتب حفظ الصحة الجماعي</div>
                    <div className="text-[8px] text-slate-400 italic">Bureau Communal de l&apos;Hygiène</div>
                    <div className="inline-block mt-1 bg-emerald-50 rounded-full px-2 py-0.5 border border-teal-300 text-[9px] font-bold text-teal-700">
                      {communeDisplay}
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="inline-block bg-slate-600 text-white text-[8px] font-bold px-2 py-0.5 rounded shadow-sm">Royaume du Maroc</div>
                    <div className="text-[11px] font-bold text-slate-600 mt-1">Préfecture de Salé</div>
                    <div className="text-[9px] text-slate-400">Service d&apos;Hygiène</div>
                    <div className="text-[7px] text-slate-400">قسم حفظ الصحة والبيئة</div>
                  </div>
                </div>
                {/* Contact bar */}
                <div className="flex justify-center items-center gap-2 mt-2 bg-slate-50 rounded-md px-2 py-1 border border-slate-100">
                  {communeAddress && <><span dir="rtl" className="text-[7px] text-slate-400">📍 {communeAddress}</span><span className="text-[7px] text-slate-300">|</span></>}
                  {communePhone && <><span className="text-[7px] text-slate-300">|</span><span dir="ltr" className="text-[7px] text-slate-400">📞 {communePhone}</span></>}
                  {communeFax && <><span className="text-[7px] text-slate-300">|</span><span dir="ltr" className="text-[7px] text-slate-400">📠 {communeFax}</span></>}
                  {communeEmail && <><span className="text-[7px] text-slate-300">|</span><span dir="ltr" className="text-[7px] text-slate-400">✉ {communeEmail}</span></>}
                </div>
              </div>
              {/* Second border line */}
              <div className="h-px bg-emerald-600" />
            </div>

            {/* Info bar with date fields */}
            <div className="bg-emerald-50/50 border border-emerald-200/50 rounded-lg mx-4 mt-3 p-2 flex justify-between items-center" dir="rtl">
              <div className="text-[9px] text-emerald-800 font-semibold flex items-center gap-1" dir="rtl">
                <span dir="rtl">المرجع</span> : / <span dir="ltr" className="font-bold text-emerald-700">Réf :</span> <span dir="ltr" className="font-mono bg-white px-1 py-0.5 rounded border border-emerald-200 text-[8px]">{docReference}</span>
              </div>
              <div className="flex items-center gap-3" dir="rtl">
                <span dir="rtl" className="text-[8px] text-emerald-700"><span className="font-bold">حرر في</span> : / <span dir="ltr" className="text-emerald-600">Rédigé à :</span> {communeNameAr || communeDisplay}</span>
                <span dir="rtl" className="text-[8px] text-emerald-700"><span className="font-bold">التاريخ</span> : / <span dir="ltr" className="text-emerald-600">Date :</span> 📅 {docDate}</span>
                <span dir="ltr" className="text-[7px] text-slate-400 italic">{docDateFr}</span>
              </div>
            </div>

            {/* Report title */}
            <div className="mx-4 mt-3 bg-gradient-to-l from-emerald-50 to-teal-50 rounded-lg p-3 text-center border border-emerald-200 relative">
              <div className="text-[13px] font-extrabold text-emerald-700">{getReportTitle()}</div>
              <div className="text-[9px] text-slate-400 italic">{getReportTitleFr()}</div>
              <div className="inline-block mt-1 bg-white rounded-full px-3 py-0.5 border border-teal-300 text-[9px] font-bold text-teal-800">
                🏛️ {communeDisplay} — {communeNameFr}
              </div>
            </div>

            {/* Object line */}
            <div className="mx-4 mt-3 pr-3 border-r-4 border-emerald-500">
              <div className="text-[7px] text-slate-400 font-bold uppercase tracking-wider" dir="rtl">الموضوع / <span dir="ltr" className="text-slate-400">Objet</span></div>
              <div className="text-[10px] font-bold text-slate-800">{getReportTitle()} — {communeNameAr || communeDisplay}</div>
            </div>

            {/* Ref line */}
            <div className="mx-4 mt-2 pr-3 border-r-4 border-amber-500">
              <div className="text-[7px] text-amber-700 font-bold tracking-wider" dir="rtl">المرجع / <span dir="ltr" className="text-amber-700">Réf</span></div>
              <div dir="ltr" className="text-[10px] font-bold text-slate-800 font-mono">{docReference}</div>
            </div>

            {/* Summary cards */}
            {isLoading ? (
              <div className="p-6 text-center">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-[10px] text-slate-400 mt-2">جاري تحميل البيانات...</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-1.5 mx-4 mt-3">
                  <div className="bg-emerald-50 border border-slate-100 rounded-md p-1.5 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
                    <div className="text-lg font-extrabold text-emerald-600">{interventions.length}</div>
                    <div className="text-[7px] text-slate-500">إجمالي / Total</div>
                  </div>
                  <div className="bg-red-50 border border-slate-100 rounded-md p-1.5 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-red-500" />
                    <div className="text-lg font-extrabold text-red-500">{interventions.filter(i => i.type === 'DERATISATION').length}</div>
                    <div className="text-[7px] text-slate-500">قوارض</div>
                  </div>
                  <div className="bg-amber-50 border border-slate-100 rounded-md p-1.5 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-500" />
                    <div className="text-lg font-extrabold text-amber-500">{interventions.filter(i => i.type === 'DESINSECTISATION').length}</div>
                    <div className="text-[7px] text-slate-500">حشرات</div>
                  </div>
                  <div className="bg-green-50 border border-slate-100 rounded-md p-1.5 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-green-500" />
                    <div className="text-lg font-extrabold text-green-500">{interventions.filter(i => i.type === 'DESINFECTION').length}</div>
                    <div className="text-[7px] text-slate-500">تطهير</div>
                  </div>
                </div>

                {/* Mini data preview */}
                {interventions.length > 0 && (
                  <div className="mx-4 mt-3 overflow-x-auto">
                    <table className="w-full text-[8px]">
                      <thead>
                        <tr className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white">
                          <th className="px-1.5 py-1 text-right">#</th>
                          <th className="px-1.5 py-1 text-center">المرجع</th>
                          <th className="px-1.5 py-1 text-center">النوع</th>
                          <th className="px-1.5 py-1 text-center">التاريخ</th>
                          <th className="px-1.5 py-1 text-right">الحي</th>
                          <th className="px-1.5 py-1 text-center">الحالة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interventions.slice(0, 5).map((int, i) => (
                          <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="px-1.5 py-0.5 text-slate-400">{i + 1}</td>
                            <td className="px-1.5 py-0.5 text-center font-mono text-slate-600">{int.reference}</td>
                            <td className="px-1.5 py-0.5 text-center">
                              <span className="text-white text-[7px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: TYPE_COLORS[int.type] }}>
                                {TYPE_LABELS[int.type]}
                              </span>
                            </td>
                            <td className="px-1.5 py-0.5 text-center text-slate-600">{new Date(int.date).toLocaleDateString('fr-FR')}</td>
                            <td className="px-1.5 py-0.5 text-right text-slate-600">{int.quartier}</td>
                            <td className="px-1.5 py-0.5 text-center">
                              <span className="text-white text-[7px] font-bold px-1 py-0.5 rounded" style={{ backgroundColor: STATUT_COLORS[int.statut] }}>
                                {STATUT_LABELS[int.statut]}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {interventions.length > 5 && (
                      <div className="text-center py-1 text-[8px] text-slate-400">... و {interventions.length - 5} تدخل آخر</div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* ===== ENHANCED SIGNATURE BLOCK PREVIEW ===== */}
            <div className="mx-4 mt-4 pt-3">
              {/* Decorative border wrapper */}
              <div className="border-2 border-slate-200 rounded-xl p-4 bg-gradient-to-b from-slate-50/50 to-white relative">
                {/* Top ornamental line */}
                <div className="absolute top-0 left-[10%] right-[10%] h-0.5 bg-gradient-to-l from-transparent via-emerald-500 to-transparent" />

                <div className="text-center mb-4">
                  <span className="text-[10px] font-extrabold text-slate-600 bg-emerald-50 px-4 py-1.5 rounded-full border border-emerald-200 tracking-wide">
                    الإمضاء و الختم / Cachet et Signature
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  {/* Président - الأول */}
                  <div className="text-center flex-1 border-1.5 border-slate-200 rounded-lg p-3 bg-white relative overflow-hidden" style={{ borderTop: '3px solid #d97706' }}>
                    <div className="text-[10px] font-extrabold text-emerald-700">الرئيس</div>
                    <div className="text-[7px] text-slate-400 italic">Le Président</div>
                    <div className="border-t border-slate-600 mt-2 w-4/5 mx-auto" />
                    <div className="text-[8px] font-bold text-slate-800 mt-1">{presidentName || '...........................'}</div>
                    <div className="text-[7px] text-slate-400 mt-0.5">
                      <span className="border-b border-dotted border-slate-300 inline-block min-w-[50px]">التاريخ</span>
                    </div>
                  </div>

                  {/* Directeur des Services - الثاني */}
                  <div className="text-center flex-1 border-1.5 border-slate-200 rounded-lg p-3 bg-white relative overflow-hidden" style={{ borderTop: '3px solid #059669' }}>
                    <div className="text-[10px] font-extrabold text-emerald-700">المدير</div>
                    <div className="text-[7px] text-slate-400 italic">Directeur des Services</div>
                    <div className="border-t border-slate-600 mt-2 w-4/5 mx-auto" />
                    <div className="text-[8px] font-bold text-slate-800 mt-1">{chefServiceName || '...........................'}</div>
                    <div className="text-[7px] text-slate-400 mt-0.5">
                      <span className="border-b border-dotted border-slate-300 inline-block min-w-[50px]">التاريخ</span>
                    </div>
                  </div>

                  {/* Responsable Hygiène - الثالث */}
                  <div className="text-center flex-1 border-1.5 border-slate-200 rounded-lg p-3 bg-white relative overflow-hidden" style={{ borderTop: '3px solid #059669' }}>
                    <div className="text-[10px] font-extrabold text-emerald-700">مسؤول حفظ الصحة</div>
                    <div className="text-[7px] text-slate-400 italic">Responsable d'Hygiène</div>
                    <div className="border-t border-slate-600 mt-2 w-4/5 mx-auto" />
                    <div className="text-[8px] font-bold text-slate-800 mt-1">{responsableName || '...........................'}</div>
                    <div className="text-[7px] text-slate-400 mt-0.5">
                      <span className="border-b border-dotted border-slate-300 inline-block min-w-[50px]">التاريخ</span>
                    </div>
                  </div>
                </div>


              </div>
            </div>

            {/* Footer */}
            <div className="mt-3 py-1.5 text-center border-t border-slate-100 text-[7px] text-slate-400">
              <span dir="ltr">{communeNameFr}</span> — <span dir="rtl">مكتب حفظ الصحة الجماعي — عمالة سلا</span> | <span dir="ltr" className="font-mono">{docReference}</span> | <span dir="rtl">{docDate}</span>
            </div>
          </div>

          {/* ===== SIGNATURE & COMMUNE SETTINGS ===== */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 no-classic-print">
            <h3 className="text-xs font-bold text-slate-500 mb-3 flex items-center gap-2">
              ✏️ إعدادات التوقيع والمعلومات الإدارية
              <span className="text-[9px] font-normal text-slate-400">— يتم حفظها تلقائياً في إعدادات الجماعة</span>
            </h3>

            <div className="space-y-3">
              {/* Signature names */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 mb-1.5">👤 أسماء الموقعين</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">الرئيس / Le Président</label>
                    <input type="text" value={presidentName} onChange={(e) => setPresidentName(e.target.value)} onBlur={saveAllSettings}
                      placeholder="أدخل اسم الرئيس"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">المدير / Directeur des Services</label>
                    <input type="text" value={chefServiceName} onChange={(e) => setChefServiceName(e.target.value)} onBlur={saveAllSettings}
                      placeholder="أدخل اسم المدير"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">مسؤول حفظ الصحة / Responsable d'Hygiène</label>
                    <input type="text" value={responsableName} onChange={(e) => setResponsableName(e.target.value)} onBlur={saveAllSettings}
                      placeholder="أدخل اسم مسؤول حفظ الصحة"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                </div>
              </div>

              {/* Commune info */}
              <div>
                <div className="text-[10px] font-semibold text-slate-500 mb-1.5">🏛️ معلومات الجماعة (تظهر في En-tête)</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">العنوان</label>
                    <input type="text" value={communeAddress} onChange={(e) => setCommuneAddress(e.target.value)} onBlur={saveAllSettings}
                      placeholder="عنوان الجماعة"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">الهاتف</label>
                    <input type="text" value={communePhone} onChange={(e) => setCommunePhone(e.target.value)} onBlur={saveAllSettings}
                      placeholder="رقم الهاتف" dir="ltr"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">الفاكسم</label>
                    <input type="text" value={communeFax} onChange={(e) => setCommuneFax(e.target.value)} onBlur={saveAllSettings}
                      placeholder="رقم الفاكس" dir="ltr"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-medium text-slate-500 mb-0.5">البريد الإلكتروني</label>
                    <input type="text" value={communeEmail} onChange={(e) => setCommuneEmail(e.target.value)} onBlur={saveAllSettings}
                      placeholder="البريد الإلكتروني" dir="ltr"
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[11px] outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-300 transition-all" />
                  </div>
                </div>
              </div>

              {/* Toggle options */}
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={showWatermark} onChange={(e) => { setShowWatermark(e.target.checked); saveAllSettings() }}
                    className="w-3.5 h-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <span className="text-[10px] font-medium text-slate-600">علامة مائية / Watermark</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-100 p-3 flex items-center gap-2 justify-end bg-slate-50/50 no-classic-print">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-all"
          >
            إغلاق
          </button>
          <motion.button
            onClick={handleClassicPrint}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 rounded-xl font-bold border-2 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 flex items-center gap-2 text-sm transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
            </svg>
            طباعة كلاسيكية
          </motion.button>
          <motion.button
            onClick={handlePrint}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={isLoading}
            className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg shadow-emerald-200 flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
            </svg>
            طباعة احترافية
          </motion.button>
        </div>
      </motion.div>
    </div>
  )
}

// ===== HELPER: Build ENHANCED signature block HTML for print =====
function buildSignatureBlock(presidentName: string, responsableName: string, chefServiceName: string): string {
  return `
  <div class="signature-section">
    <div class="signature-decorative-border">
      <div class="signature-title-center">
        <span class="signature-main-title"><span class="bidi-ar">الإمضاء و الختم</span> / <span class="bidi-fr" style="font-size:11px;color:#374151;font-style:italic;">Cachet et Signature</span></span>
      </div>
      <div class="signature-grid">
        <div class="signature-box">
          <div class="signature-role">الرئيس</div>
          <div class="signature-role-fr">Le Président</div>
          <div class="signature-line"></div>
          <div class="signature-name">${presidentName || '...........................'}</div>
          <div class="signature-date">
            <span class="bidi-ar">التاريخ</span> : <span class="bidi-fr" style="font-size:7px;color:#9ca3af;">Date :</span> <span class="signature-date-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-role">المدير</div>
          <div class="signature-role-fr">Directeur des Services</div>
          <div class="signature-line"></div>
          <div class="signature-name">${chefServiceName || '...........................'}</div>
          <div class="signature-date">
            <span class="bidi-ar">التاريخ</span> : <span class="bidi-fr" style="font-size:7px;color:#9ca3af;">Date :</span> <span class="signature-date-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-role">مسؤول حفظ الصحة</div>
          <div class="signature-role-fr">Responsable d'Hygiène</div>
          <div class="signature-line"></div>
          <div class="signature-name">${responsableName || '...........................'}</div>
          <div class="signature-date">
            <span class="bidi-ar">التاريخ</span> : <span class="bidi-fr" style="font-size:7px;color:#9ca3af;">Date :</span> <span class="signature-date-line">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
          </div>
        </div>
      </div>
    </div>
  </div>`
}
