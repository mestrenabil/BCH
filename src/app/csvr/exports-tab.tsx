'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { CaptureMission, StrayAnimal, StrayReport } from './types'

interface Props {
  reports: StrayReport[]
  animals: StrayAnimal[]
  missions: CaptureMission[]
  buildParams: () => URLSearchParams
}

type DatasetKey = 'all' | 'reports' | 'animals' | 'missions' | 'bites' | 'deaths' | 'hotspots' | 'health' | 'centers' | 'destinations' | 'followUps' | 'care' | 'campaigns' | 'partners'

interface ExportRow {
  النوع: string
  المرجع: string
  الجماعة: string
  الحي: string
  الحالة: string
  التاريخ: string
  التفاصيل: string
  خط_العرض: string
  خط_الطول: string
}

interface SupplementalData {
  bites: Record<string, unknown>[]
  deaths: Record<string, unknown>[]
  hotspots: Record<string, unknown>[]
  health: Record<string, unknown>[]
  centers: Record<string, unknown>[]
  destinations: Record<string, unknown>[]
  followUps: Record<string, unknown>[]
  care: Record<string, unknown>[]
  campaigns: Record<string, unknown>[]
  partners: Record<string, unknown>[]
}

const DATASET_LABELS: Record<DatasetKey, string> = { all: 'كل السجلات', reports: 'البلاغات', animals: 'الحيوانات', missions: 'المهام', bites: 'العضّات', deaths: 'الوفيات', hotspots: 'النقاط الساخنة', health: 'التنبيهات الصحية', centers: 'المراكز', destinations: 'الوجهات', followUps: 'المتابعات', care: 'الرعاية والتلقيح', campaigns: 'الحملات', partners: 'الشركاء' }
const DATASET_CARDS: Array<[DatasetKey, string, string]> = [['reports', '📢', 'البلاغات'], ['animals', '🐾', 'الحيوانات'], ['missions', '🎯', 'المهام'], ['bites', '🦷', 'العضّات'], ['care', '🩺', 'الرعاية'], ['followUps', '📅', 'المتابعات']]

function stringValue(value: unknown) { return value == null ? '' : String(value) }
function dateValue(value: unknown) { return value ? new Date(String(value)).toISOString() : '' }
function coordinateValue(value: unknown) { return value == null ? '' : String(value) }
function csvCell(value: unknown) { return `"${String(value ?? '').replace(/"/g, '""')}"` }
function escapeHtml(value: unknown) { return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character] || character)) }

function downloadFile(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export default function ExportsTab({ reports, animals, missions, buildParams }: Props) {
  const [selectedType, setSelectedType] = useState<DatasetKey>('all')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [loading, setLoading] = useState(false)
  const [supplemental, setSupplemental] = useState<SupplementalData>({ bites: [], deaths: [], hotspots: [], health: [], centers: [], destinations: [], followUps: [], care: [], campaigns: [], partners: [] })
  const scopeLabel = buildParams().get('commune') || 'نطاق الحساب'
  const scopeKey = buildParams().toString()

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      const params = buildParams().toString()
      const get = async (url: string) => { try { const response = await fetch(url); return response.ok ? await response.json() : {} } catch { return {} } }
      const [bites, deaths, hotspots, health, centers, destinations, followUps, care, campaigns, partners] = await Promise.all([
        get(`/api/bite-cases?${params}`), get(`/api/csvr/death-reports?${params}`), get(`/api/csvr/hotspots?${params}`),
        get(`/api/csvr/health-alerts?${params}`), get(`/api/csvr/centers?${params}`), get(`/api/csvr/destinations?${params}`),
        get(`/api/csvr/follow-ups?${params}`), get(`/api/csvr/care?${params}`), get(`/api/csvr/campaigns?${params}`), get(`/api/csvr/partners?${params}`),
      ])
      if (!active) return
      setSupplemental({ bites: bites.biteCases || [], deaths: deaths.reports || [], hotspots: hotspots.hotspots || [], health: health.alerts || [], centers: centers.centers || [], destinations: destinations.destinations || [], followUps: followUps.followUps || [], care: care.events || [], campaigns: campaigns.campaigns || [], partners: partners.partners || [] })
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [scopeKey, refreshKey])

  const allRows = useMemo(() => {
    const reportRows: ExportRow[] = reports.map((item) => ({ النوع: 'بلاغ حيوان شارد', المرجع: item.reference, الجماعة: item.commune, الحي: item.quartier, الحالة: item.statut, التاريخ: dateValue(item.createdAt), التفاصيل: item.description || item.priority, خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) }))
    const animalRows: ExportRow[] = animals.map((item) => ({ النوع: 'حيوان مسجل', المرجع: item.csvrNumber, الجماعة: item.commune, الحي: item.captureQuartier, الحالة: item.statut, التاريخ: dateValue(item.captureDate || item.createdAt), التفاصيل: `${item.species} · ${item.captureLocation || ''}`, خط_العرض: coordinateValue(item.captureLatitude), خط_الطول: coordinateValue(item.captureLongitude) }))
    const missionRows: ExportRow[] = missions.map((item) => ({ النوع: 'مهمة ميدانية', المرجع: item.reference, الجماعة: item.commune, الحي: item.quartier || item.zone, الحالة: item.statut, التاريخ: dateValue(item.scheduledAt || item.createdAt), التفاصيل: item.teamLead || item.priority, خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) }))
    const rows: Record<DatasetKey, ExportRow[]> = {
      all: [], reports: reportRows, animals: animalRows, missions: missionRows,
      bites: supplemental.bites.map((item) => ({ النوع: 'حالة عضّة', المرجع: stringValue(item.reference), الجماعة: stringValue(item.commune), الحي: stringValue(item.quartier), الحالة: stringValue(item.status), التاريخ: dateValue(item.biteDate), التفاصيل: `${stringValue(item.victimName)} · بطاقة: ${stringValue(item.victimCin)} · تسجيل: ${stringValue(item.victimRegistrationNumber)} · ${stringValue(item.description || item.biteLocation)}`, خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) })),
      deaths: supplemental.deaths.map((item) => ({ النوع: 'حيوان نافق', المرجع: stringValue(item.reference), الجماعة: stringValue(item.commune), الحي: stringValue(item.quartier), الحالة: item.healthSuspicion ? 'اشتباه صحي' : item.accident ? 'حادث' : 'مسجلة', التاريخ: dateValue(item.reportedAt), التفاصيل: stringValue(item.apparentCause || item.location), خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) })),
      hotspots: supplemental.hotspots.map((item) => ({ النوع: 'نقطة ساخنة', المرجع: stringValue(item.reference), الجماعة: stringValue(item.commune), الحي: stringValue(item.quartier), الحالة: stringValue(item.status), التاريخ: dateValue(item.updatedAt || item.createdAt), التفاصيل: `${stringValue(item.name)} · بلاغات ${stringValue(item.reportCount)} · عضّات ${stringValue(item.biteCount)}`, خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) })),
      health: supplemental.health.map((item) => { const animal = (item.animal || {}) as Record<string, unknown>; return { النوع: 'تنبيه صحي', المرجع: stringValue(animal.csvrNumber || item.id), الجماعة: stringValue(animal.commune), الحي: '', الحالة: `${stringValue(item.type)} · ${stringValue(item.urgency)}`, التاريخ: dateValue(item.reportedAt || item.createdAt), التفاصيل: stringValue(item.measureTaken || item.notes), خط_العرض: coordinateValue(animal.captureLatitude), خط_الطول: coordinateValue(animal.captureLongitude) } }),
      centers: supplemental.centers.map((item) => ({ النوع: 'مركز استقبال', المرجع: stringValue(item.id), الجماعة: stringValue(item.commune), الحي: '', الحالة: stringValue(item.status), التاريخ: dateValue(item.createdAt), التفاصيل: `${stringValue(item.name)} · الإشغال ${stringValue(item.occupied)}/${stringValue(item.capacity)}`, خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) })),
      destinations: supplemental.destinations.map((item) => { const animal = (item.animal || {}) as Record<string, unknown>; return { النوع: 'وجهة حيوان', المرجع: stringValue(animal.csvrNumber || item.id), الجماعة: stringValue(item.commune || animal.commune), الحي: stringValue(item.quartier), الحالة: stringValue(item.type), التاريخ: dateValue(item.date), التفاصيل: stringValue(item.site || item.structure || item.adopterName), خط_العرض: coordinateValue(item.latitude), خط_الطول: coordinateValue(item.longitude) } }),
      followUps: supplemental.followUps.map((item) => { const animal = (item.animal || {}) as Record<string, unknown>; return { النوع: 'متابعة', المرجع: stringValue(item.id), الجماعة: stringValue(animal.commune), الحي: '', الحالة: stringValue(item.status), التاريخ: dateValue(item.scheduledDate || item.createdAt), التفاصيل: `${stringValue(item.type)} · ${stringValue(item.outcome || item.notes)}`, خط_العرض: '', خط_الطول: '' } }),
      care: supplemental.care.map((item) => { const animal = (item.animal || {}) as Record<string, unknown>; return { النوع: 'رعاية بيطرية', المرجع: stringValue(item.id), الجماعة: stringValue(animal.commune), الحي: '', الحالة: stringValue(item.type), التاريخ: dateValue(item.date), التفاصيل: stringValue(item.vaccineName || item.diagnosis || item.treatment || item.surgeryType), خط_العرض: '', خط_الطول: '' } }),
      campaigns: supplemental.campaigns.map((item) => ({ النوع: 'حملة', المرجع: stringValue(item.reference), الجماعة: stringValue(item.commune), الحي: stringValue(item.zone), الحالة: stringValue(item.status), التاريخ: dateValue(item.startDate), التفاصيل: stringValue(item.name || item.objective), خط_العرض: '', خط_الطول: '' })),
      partners: supplemental.partners.map((item) => ({ النوع: 'شريك', المرجع: stringValue(item.id), الجماعة: stringValue(item.commune), الحي: '', الحالة: stringValue(item.status), التاريخ: dateValue(item.createdAt), التفاصيل: `${stringValue(item.name)} · ${stringValue(item.type)}`, خط_العرض: '', خط_الطول: '' })),
    }
    rows.all = Object.entries(rows).filter(([key]) => key !== 'all').flatMap(([, value]) => value)
    return rows
  }, [animals, missions, reports, supplemental])

  const rows = useMemo(() => {
    const source = allRows[selectedType]
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null
    const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null
    return source.filter((row) => {
      const query = search.trim().toLowerCase()
      const matchesSearch = !query || Object.values(row).join(' ').toLowerCase().includes(query)
      const matchesStatus = statusFilter === 'ALL' || row.الحالة === statusFilter
      const timestamp = row.التاريخ ? new Date(row.التاريخ).getTime() : NaN
      const matchesFrom = from == null || (!Number.isNaN(timestamp) && timestamp >= from)
      const matchesTo = to == null || (!Number.isNaN(timestamp) && timestamp <= to)
      return matchesSearch && matchesStatus && matchesFrom && matchesTo
    })
  }, [allRows, dateFrom, dateTo, search, selectedType, statusFilter])

  const statuses = useMemo(() => Array.from(new Set(allRows[selectedType].map((row) => row.الحالة).filter(Boolean))).sort(), [allRows, selectedType])
  const exportCurrent = () => {
    if (rows.length === 0) { toast.error('لا توجد بيانات قابلة للتصدير'); return }
    const headers = Object.keys(rows[0]) as Array<keyof ExportRow>
    const content = '\uFEFF' + [headers.map(csvCell).join(';'), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(';'))].join('\n')
    downloadFile(content, `CSVR-${selectedType}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8')
    toast.success(`تم تصدير ${rows.length} سجل`)
  }
  const exportJson = () => { if (rows.length === 0) { toast.error('لا توجد بيانات قابلة للتصدير'); return }; downloadFile(JSON.stringify({ scope: scopeLabel, generatedAt: new Date().toISOString(), rows }, null, 2), `CSVR-${selectedType}-${new Date().toISOString().slice(0, 10)}.json`, 'application/json;charset=utf-8'); toast.success(`تم تصدير ${rows.length} سجل بصيغة JSON`) }
  const printCurrent = () => {
    if (rows.length === 0) { toast.error('لا توجد بيانات للمعاينة'); return }
    const printWindow = window.open('', '_blank', 'width=1200,height=800')
    if (!printWindow) { toast.error('تعذر فتح نافذة المعاينة'); return }
    const headers = Object.keys(rows[0]) as Array<keyof ExportRow>
    const reportTitle = `تقرير ${DATASET_LABELS[selectedType]}`
    const generatedAt = new Date()
    const periodLabel = dateFrom || dateTo ? `${dateFrom || 'البداية'} — ${dateTo || 'النهاية'}` : 'كل الفترات'
    const statusCounts = Array.from(new Set(rows.map((row) => row.الحالة).filter(Boolean))).slice(0, 4)
    const formatRowDate = (value: string) => {
      if (!value) return '—'
      const date = new Date(value)
      return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('ar-MA')
    }
    const body = rows.map((row, index) => `<tr>
      <td class="index-cell">${index + 1}</td>
      ${headers.map((header) => `<td class="${header === 'المرجع' ? 'reference-cell' : ''}">${escapeHtml(header === 'التاريخ' ? formatRowDate(String(row[header] || '')) : row[header] || '—')}</td>`).join('')}
    </tr>`).join('')
    const summaryCards = [
      `<div class="summary-card"><strong>${rows.length}</strong><span>إجمالي السجلات / Total</span></div>`,
      ...statusCounts.map((status) => `<div class="summary-card"><strong>${rows.filter((row) => row.الحالة === status).length}</strong><span>${escapeHtml(status)}</span></div>`),
    ].join('')
    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(reportTitle)} — ${escapeHtml(scopeLabel)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;500;600;700;800;900&display=swap');
    @page { size: A4 landscape; margin: 12mm 12mm 18mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #1e293b; background: #f1f5f9; font-family: 'Noto Sans Arabic', Tahoma, Arial, sans-serif; font-size: 10px; line-height: 1.55; }
    .page { max-width: 1120px; margin: 24px auto; padding: 22px; background: #fff; position: relative; box-shadow: 0 8px 28px rgba(15, 23, 42, .12); }
    .ornament { height: 6px; margin: -22px -22px 14px; background: linear-gradient(90deg, #1f2937, #374151, #0f766e, #374151, #1f2937); }
    .header-border { border-bottom: 3px solid #1f2937; padding-bottom: 12px; }
    .header-table, .info-table, .footer-table { width: 100%; border-collapse: collapse; }
    .header-table td { width: 33.33%; padding: 0 8px; vertical-align: top; }
    .header-right { text-align: right; }
    .header-center { text-align: center; }
    .header-left { text-align: left; direction: ltr; }
    .badge { display: inline-block; padding: 3px 11px; border-radius: 4px; color: #fff; background: linear-gradient(135deg, #1f2937, #111827); font-size: 9px; font-weight: 800; }
    .wilaya { margin-top: 5px; color: #1f2937; font-size: 11px; font-weight: 800; }
    .department { color: #475569; font-size: 9px; font-weight: 700; }
    .logo { font-size: 24px; line-height: 1; }
    .logo-title { margin-top: 5px; color: #1f2937; font-size: 13px; font-weight: 900; }
    .logo-subtitle { color: #64748b; font-size: 8px; font-weight: 700; }
    .commune { margin-top: 5px; color: #0f766e; font-size: 10px; font-weight: 800; }
    .contact-bar { margin-top: 9px; padding: 6px 10px; border: 1px solid #dbeafe; border-radius: 5px; background: #f8fafc; color: #64748b; text-align: center; font-size: 8px; }
    .info-table { margin-top: 14px; padding: 8px; border: 1px solid #d1d5db; background: #f8fafc; }
    .info-table td { padding: 4px 8px; color: #475569; }
    .info-table strong { color: #1f2937; }
    .title-box { margin-top: 14px; padding: 11px 14px; border-right: 5px solid #0f766e; background: linear-gradient(90deg, #f0fdfa, #f8fafc); }
    .title-box h1 { margin: 0; color: #1f2937; font-size: 18px; font-weight: 900; }
    .title-box p { margin: 2px 0 0; color: #64748b; font-size: 9px; }
    .summary-grid { display: grid; grid-template-columns: repeat(${Math.min(Math.max(statusCounts.length + 1, 2), 5)}, 1fr); gap: 8px; margin: 14px 0; }
    .summary-card { padding: 9px; border: 1px solid #d1d5db; border-top: 3px solid #374151; border-radius: 5px; background: #f8fafc; text-align: center; }
    .summary-card strong { display: block; color: #1f2937; font-size: 19px; font-weight: 900; }
    .summary-card span { color: #64748b; font-size: 8px; font-weight: 700; }
    .section-title { margin: 14px 0 6px; color: #1f2937; font-size: 11px; font-weight: 900; }
    table.data { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
    table.data thead { display: table-header-group; }
    table.data th { padding: 6px 5px; background: #374151; color: #fff; font-weight: 800; }
    table.data td { padding: 6px 5px; border-bottom: 1px solid #e2e8f0; color: #334155; text-align: right; vertical-align: top; overflow-wrap: anywhere; }
    table.data tr:nth-child(even) td { background: #f8fafc; }
    .index-cell { width: 28px; color: #64748b !important; text-align: center !important; }
    .reference-cell { direction: ltr; text-align: center !important; font-family: monospace; font-size: 7px; }
    .footer { margin-top: 18px; padding-top: 7px; border-top: 2px solid #d1d5db; color: #94a3b8; font-size: 7px; }
    .footer-table td { padding: 0 4px; }
    @media print { body { background: #fff; } .page { max-width: none; margin: 0; padding: 0; box-shadow: none; } .ornament { margin-left: 0; margin-right: 0; } .data tr { page-break-inside: avoid; } }
  </style>
</head>
<body>
  <main class="page">
    <div class="ornament"></div>
    <div class="header-border">
      <table class="header-table"><tr>
        <td class="header-right"><div class="badge">المملكة المغربية</div><div class="wilaya">عمالة سلا</div><div class="department">قسم الوقاية وحفظ الصحة</div></td>
        <td class="header-center"><div class="logo">🏛️</div><div class="logo-title">مصلحة الوقاية وحفظ الصحة</div><div class="logo-subtitle">Service de prévention et d'hygiène</div><div class="commune">${escapeHtml(scopeLabel)}</div></td>
        <td class="header-left"><div class="badge">Royaume du Maroc</div><div class="wilaya">Préfecture de Salé</div><div class="department">Service de prévention et d'hygiène</div></td>
      </tr></table>
    </div>
    <div class="contact-bar">المنصة المندمجة لتدبير قسم الوقاية وحفظ الصحة · BCH Prévention et Hygiène</div>
    <table class="info-table"><tr><td><strong>المرجع:</strong> CSVR/${generatedAt.getFullYear()}/${String(Date.now()).slice(-5)}</td><td><strong>الجماعة:</strong> ${escapeHtml(scopeLabel)}</td><td><strong>تاريخ الإصدار:</strong> ${escapeHtml(generatedAt.toLocaleDateString('ar-MA'))}</td><td><strong>الفترة:</strong> ${escapeHtml(periodLabel)}</td></tr></table>
    <section class="title-box"><h1>${escapeHtml(reportTitle)}</h1><p>Rapport administratif · ${escapeHtml(DATASET_LABELS[selectedType])} · النطاق الترابي المرتبط بالحساب</p></section>
    <div class="summary-grid">${summaryCards}</div>
    <div class="section-title">📋 تفصيل السجلات — ${rows.length} سجل</div>
    <table class="data"><thead><tr><th class="index-cell">#</th>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>
    <div class="footer"><table class="footer-table"><tr><td>${escapeHtml(scopeLabel)} — مصلحة الوقاية وحفظ الصحة</td><td style="text-align:center">CSVR · ${escapeHtml(generatedAt.toLocaleDateString('fr-FR'))}</td><td style="text-align:left">وثيقة إدارية</td></tr></table></div>
  </main>
</body>
</html>`
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    window.setTimeout(() => printWindow.print(), 700)
  }

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-600 p-5 text-white shadow-lg"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">📤 التقارير والتصدير</h2><p className="mt-1 text-xs text-emerald-50">مركز شامل لتقارير الحيوانات الشاردة والبلاغات والرعاية والعمليات الميدانية.</p></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">🧭 {scopeLabel}</span></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{DATASET_CARDS.map(([type, icon, label]) => <button type="button" key={type} onClick={() => { setSelectedType(type); setStatusFilter('ALL') }} className={`rounded-2xl border bg-white p-4 text-right shadow-sm transition ${selectedType === type ? 'border-emerald-400 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-emerald-300'}`}><span className="text-2xl">{icon}</span><span className="mt-2 block text-xs font-bold text-slate-500">{label}</span><strong className="mt-1 block text-2xl text-slate-800">{allRows[type].length}</strong></button>)}</div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold text-slate-700">🔎 فلاتر التقرير</h3><button type="button" onClick={() => setRefreshKey((key) => key + 1)} className="rounded-lg bg-slate-700 px-3 py-1.5 text-[11px] font-bold text-white">{loading ? 'جارٍ التحديث...' : '↻ تحديث البيانات'}</button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><select value={selectedType} onChange={(event) => { setSelectedType(event.target.value as DatasetKey); setStatusFilter('ALL') }} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="all">كل أنواع السجلات</option>{Object.entries(DATASET_LABELS).filter(([key]) => key !== 'all').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="بحث بالمرجع أو الجماعة..." className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="ALL">كل الحالات</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select><input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><div><p className="text-sm font-extrabold text-emerald-900">تقرير: {DATASET_LABELS[selectedType]}</p><p className="mt-1 text-xs text-emerald-700">{rows.length} سجل مطابق للفلاتر الحالية · يشمل التصدير كل النتائج</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={printCurrent} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-700">🖨️ معاينة وطباعة</button><button type="button" onClick={exportJson} className="rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-bold text-sky-700">⬇️ JSON</button><button type="button" onClick={exportCurrent} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800">⬇️ CSV / Excel</button></div></div>
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[980px] text-right text-xs"><thead className="bg-slate-50 text-slate-500"><tr>{Object.keys(allRows.all[0] || { النوع: '', المرجع: '', الجماعة: '', الحي: '', الحالة: '', التاريخ: '', التفاصيل: '', خط_العرض: '', خط_الطول: '' }).map((header) => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.slice(0, 30).map((row, index) => <tr key={`${row.النوع}-${row.المرجع}-${index}`}><td className="px-4 py-3 font-bold">{row.النوع}</td><td className="px-4 py-3 font-mono text-slate-500">{row.المرجع || '—'}</td><td className="px-4 py-3">{row.الجماعة || '—'}</td><td className="px-4 py-3">{row.الحي || '—'}</td><td className="px-4 py-3">{row.الحالة || '—'}</td><td className="px-4 py-3">{row.التاريخ ? new Date(row.التاريخ).toLocaleDateString('ar-MA') : '—'}</td><td className="max-w-[260px] truncate px-4 py-3">{row.التفاصيل || '—'}</td><td className="px-4 py-3 font-mono text-[10px]">{row.خط_العرض && row.خط_الطول ? `${row.خط_العرض}, ${row.خط_الطول}` : '—'}</td></tr>)}</tbody></table>{rows.length > 30 && <p className="border-t border-slate-100 px-4 py-3 text-center text-xs text-slate-400">تظهر أول 30 سجلاً في المعاينة، بينما يشمل التصدير جميع السجلات.</p>}{rows.length === 0 && <p className="p-10 text-center text-sm text-slate-400">لا توجد نتائج مطابقة للفلاتر.</p>}</div>
  </div>
}
