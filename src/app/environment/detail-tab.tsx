'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/lib/store'
import { COMMUNE_COLORS, COMMUNE_LABELS, ENV_DOSSIER_CATEGORY_ICONS, ENV_DOSSIER_CATEGORY_LABELS } from '@/lib/constants'
import type { EnvironmentalDossier, EnvironmentalDocumentLink, EnvironmentalEvidence, EnvironmentalFollowUp, EnvironmentalInspection } from './types'

type EventItem = { id: string; action: string; reason: string; changedByName: string; createdAt: string; fromStatus: string | null; toStatus: string }
type FullDossier = EnvironmentalDossier & { documents: EnvironmentalDocumentLink[]; evidence: EnvironmentalEvidence[]; complaints: { id: string; reference: string; type: string; statut: string; source: string }[]; inspections: EnvironmentalInspection[] }
type AvailableDocument = { id: string; titre: string; categorie: string; nomFichier: string }

const STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', TO_VERIFY: 'في انتظار التحقق', INSPECTION_SCHEDULED: 'معاينة مبرمجة', IN_PROGRESS: 'قيد المعالجة', PENDING: 'في الانتظار', FORMAL_NOTICE: 'إعذار', TO_CONTROL: 'في انتظار المراقبة', TRANSMITTED: 'تمت الإحالة', INSPECTED: 'تمت المعاينة', ACTION_REQUIRED: 'إجراء مطلوب',
  FOLLOW_UP: 'قيد التتبع', PENDING_VALIDATION: 'بانتظار المصادقة', RESOLVED: 'تم الحل', CLOSED: 'مغلق', ARCHIVED: 'مؤرشف',
}

const MEASURE_OPTIONS = ['SENSITIZATION', 'CLEANING_REQUEST', 'WASTE_REMOVAL', 'DISINFECTION', 'NUISANCE_TREATMENT', 'COMPLIANCE', 'FORMAL_NOTICE', 'TRANSMISSION', 'AUTHORITY_REFERRAL', 'SAMPLING', 'LAB_ANALYSIS', 'NEW_INSPECTION']
const MEASURE_LABELS: Record<string, string> = { SENSITIZATION: 'تحسيس', CLEANING_REQUEST: 'طلب التنظيف', WASTE_REMOVAL: 'إزالة النفايات', DISINFECTION: 'تطهير', NUISANCE_TREATMENT: 'معالجة الإزعاج', COMPLIANCE: 'مطابقة', FORMAL_NOTICE: 'إعذار', TRANSMISSION: 'إحالة إلى مصلحة', AUTHORITY_REFERRAL: 'إحالة إلى السلطة المختصة', SAMPLING: 'أخذ عينة', LAB_ANALYSIS: 'تحليل مخبري', NEW_INSPECTION: 'برمجة معاينة جديدة' }
const SERVICE_OPTIONS = ['BCH', 'ENVIRONMENT_SERVICE', 'COMMUNAL_TECHNICAL', 'WASTE_COLLECTION', 'SANITATION', 'LOCAL_AUTHORITY', 'PROVINCE', 'ONSSA', 'WATER_AGENCY', 'HEALTH_SERVICES', 'CIVIL_PROTECTION']
const SERVICE_LABELS: Record<string, string> = { BCH: 'BCH / BMH', ENVIRONMENT_SERVICE: 'مصلحة البيئة', COMMUNAL_TECHNICAL: 'المصلحة التقنية للجماعة', WASTE_COLLECTION: 'مصلحة جمع النفايات', SANITATION: 'التطهير السائل', LOCAL_AUTHORITY: 'السلطة المحلية', PROVINCE: 'الإقليم / العمالة', ONSSA: 'ONSSA', WATER_AGENCY: 'وكالة الحوض المائي', HEALTH_SERVICES: 'مصالح الصحة', CIVIL_PROTECTION: 'الوقاية المدنية' }

function parseList(value: string | undefined) {
  if (!value) return []
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [] } catch { return value.split(',').map((item) => item.trim()).filter(Boolean) }
}

function printEnvironmentalDocument(record: EnvironmentalDossier, kind: string) {
  const titles: Record<string, string> = { intervention: 'بطاقة تدخل بيئي', inspection: 'تقرير معاينة بيئية', constat: 'محضر معاينة', notice: 'إعذار بيئي', transmission: 'مراسلة إحالة', followUp: 'بطاقة متابعة بيئية' }
  const frenchTitles: Record<string, string> = { intervention: 'Fiche d’intervention environnementale', inspection: 'Rapport d’inspection environnementale', constat: 'Procès-verbal de constat', notice: 'Mise en demeure environnementale', transmission: 'Lettre de transmission', followUp: 'Fiche de suivi environnemental' }
  const communeFrenchNames: Record<string, string> = { 'سلا': 'Salé', 'سيدي أبي القنادل': 'Sidi Bouknadel', 'عامر': 'Amer', 'السهول': 'Sahoul' }
  const escapeHtml = (value: unknown) => String(value ?? '—').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character)
  const popup = window.open('', '_blank', 'width=1100,height=850,scrollbars=yes,resizable=yes')
  if (!popup) { toast.error('يرجى السماح بالنوافذ المنبثقة'); return }
  const statusLabel = STATUS_LABELS[record.status] || record.status
  const communeFrenchName = communeFrenchNames[record.commune] || record.commune
  const printedAt = new Date().toLocaleString('ar-MA')
  popup.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(titles[kind])} — ${escapeHtml(record.reference)}</title><style>*{box-sizing:border-box}body{margin:0;background:#e2e8f0;font-family:Arial,"Tahoma",sans-serif;color:#172033;line-height:1.75}.toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;background:linear-gradient(110deg,#065f46,#0f766e,#115e59);color:white;box-shadow:0 2px 12px rgba(15,23,42,.18)}.toolbar-title{font-weight:800;font-size:14px}.toolbar-actions{display:flex;gap:8px}.toolbar button{border:0;border-radius:9px;padding:8px 14px;cursor:pointer;font:700 12px Arial}.print{background:#fbbf24;color:#422006}.close{background:rgba(255,255,255,.16);color:white}.paper{max-width:900px;min-height:1120px;margin:28px auto;padding:34px;background:white;border:1px solid #dbe4e8;box-shadow:0 8px 30px rgba(15,23,42,.14)}.ornament{height:5px;border-radius:8px;background:linear-gradient(90deg,#059669,#f59e0b,#059669);margin-bottom:3px}.ornament-thin{height:1px;background:linear-gradient(90deg,#a7f3d0,#fbbf24,#a7f3d0);margin-bottom:10px}.header{padding:14px 8px 12px;border-bottom:3px solid #059669}.header-grid{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:18px;align-items:start}.header-side{font-size:11px;line-height:1.7}.header-side.left{text-align:left;direction:ltr}.header-side.right{text-align:right}.flag{display:inline-block;background:#059669;color:white;border-radius:4px;padding:2px 9px;font-size:9px;font-weight:800}.header-center{text-align:center;color:#047857}.header-center .logo{font-size:25px;line-height:1}.header-center strong{display:block;font-size:14px}.header-center small{display:block;color:#64748b;font-size:9px;font-style:italic}.commune-pill{display:inline-block;margin-top:5px;border:1px solid #99f6e4;background:#ecfdf5;color:#0f766e;border-radius:999px;padding:2px 10px;font-size:9px;font-weight:800}.contact{margin-top:10px;padding:5px 8px;border:1px solid #e2e8f0;background:#f8fafc;border-radius:7px;text-align:center;color:#64748b;font-size:8px}.doc-meta{display:flex;justify-content:space-between;gap:12px;margin-top:14px;padding:10px 12px;border:1px solid #a7f3d0;background:#ecfdf5;border-radius:9px;color:#047857;font-size:10px}.title-box{margin-top:14px;padding:13px;text-align:center;border:1px solid #a7f3d0;background:linear-gradient(110deg,#ecfdf5,#f0fdfa);border-radius:9px}.title-box h1{margin:0;color:#047857;font-size:21px}.title-box p{margin:2px 0 0;color:#64748b;font-size:10px;font-style:italic}.subject{margin-top:13px;padding-right:11px;border-right:4px solid #10b981}.subject .label{color:#64748b;font-size:9px;font-weight:800}.subject .value{font-size:12px;font-weight:800}.kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:15px}.kpi{position:relative;padding:9px 6px;text-align:center;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc}.kpi:before{content:"";position:absolute;top:0;left:0;right:0;height:3px;background:#10b981;border-radius:8px 8px 0 0}.kpi.warning:before{background:#f59e0b}.kpi.danger:before{background:#ef4444}.kpi .number{display:block;color:#047857;font-size:16px;font-weight:900}.kpi.warning .number{color:#b45309}.kpi.danger .number{color:#dc2626}.kpi span:last-child{display:block;color:#64748b;font-size:8px}.section{margin-top:15px;border:1px solid #cbd5e1;border-radius:9px;overflow:hidden;break-inside:avoid}.section-title{padding:7px 11px;color:#047857;background:#f0fdf4;border-bottom:1px solid #bbf7d0;font-size:11px;font-weight:900}.section-content{padding:12px;font-size:11px;min-height:70px}.section-content p{white-space:pre-wrap;margin:0}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:11px}.info-item{padding:8px 10px;border:1px solid #e2e8f0;border-radius:7px;background:#f8fafc}.label{display:block;color:#64748b;font-size:9px}.value{display:block;margin-top:2px;font-size:10px;font-weight:800}.signature-title{margin-top:26px;text-align:center;color:#475569;font-size:10px;font-weight:900}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:8px}.signature{min-height:100px;padding:11px;text-align:center;border:1px solid #cbd5e1;border-top:3px solid #059669;border-radius:8px;background:#fff}.signature:first-child{border-top-color:#d97706}.signature strong{display:block;color:#047857;font-size:10px}.signature small{display:block;color:#94a3b8;font-size:8px;font-style:italic}.signature .line{width:75%;margin:34px auto 5px;border-top:1px solid #64748b}.footer{margin-top:22px;padding-top:8px;border-top:1px solid #cbd5e1;text-align:center;color:#64748b;font-size:8px}@page{size:A4;margin:12mm}@media(max-width:700px){.toolbar{align-items:flex-start;flex-direction:column}.paper{margin:0;padding:20px;min-height:auto}.header-grid{grid-template-columns:1fr}.header-side.left,.header-side.right{text-align:center}.kpis,.signatures{grid-template-columns:1fr 1fr}.doc-meta,.info-grid{display:grid;grid-template-columns:1fr}}@media print{body{background:white}.toolbar{display:none}.paper{max-width:none;min-height:auto;margin:0;padding:0;border:0;box-shadow:none}.item,.box,.section,.signature{break-inside:avoid}}</style></head><body><div class="toolbar"><span class="toolbar-title">معاينة الوثيقة — وثيقة إدارية احترافية</span><div class="toolbar-actions"><button class="print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button><button class="close" onclick="window.close()">إغلاق</button></div></div><main class="paper"><div class="ornament"></div><div class="ornament-thin"></div><header class="header"><div class="header-grid"><div class="header-side right"><span class="flag">المملكة المغربية</span><br><b>وزارة الداخلية</b><br><b>عمالة سلا</b><br><span>باشوية سلا</span><br><span>جماعة ${escapeHtml(record.commune)}</span><br><span>مصلحة الوقاية وحفظ الصحة</span></div><div class="header-center"><div class="logo">🏛️</div><strong>قسم الوقاية وحفظ الصحة</strong><b>مصلحة الوقاية وحفظ الصحة</b><small>Service de prévention et d’hygiène</small><span class="commune-pill">جماعة ${escapeHtml(record.commune)}</span></div><div class="header-side left"><span class="flag" style="background:#475569">Royaume du Maroc</span><br><b>Ministère de l’Intérieur</b><br><b>Préfecture de Salé</b><br><span>Pachalik de Salé</span><br><span>Commune ${escapeHtml(record.commune)}</span><br><span>Service de prévention et d’hygiène</span></div></div><div class="contact">الوثيقة الإدارية · Document administratif · مصلحة الوقاية وحفظ الصحة</div></header><div class="doc-meta"><span><b>المرجع / Réf :</b> <b>${escapeHtml(record.reference)}</b></span><span><b>تاريخ الإصدار :</b> ${escapeHtml(printedAt)}</span><span><b>تاريخ المعاينة :</b> ${escapeHtml(fmtDate(record.inspectionDate))}</span></div><div class="title-box"><h1>${escapeHtml(titles[kind])}</h1><p>${escapeHtml(frenchTitles[kind])}</p></div><div class="subject"><span class="label">الموضوع / Objet</span><div class="value">${escapeHtml(record.title || titles[kind])} — جماعة ${escapeHtml(record.commune)}</div></div><div class="kpis"><div class="kpi"><span class="number">${escapeHtml(record.progress)}%</span><span>نسبة التقدم</span></div><div class="kpi ${record.riskLevel === 'HIGH' || record.riskLevel === 'CRITICAL' ? 'danger' : record.riskLevel === 'MEDIUM' ? 'warning' : ''}"><span class="number">${escapeHtml(record.riskScore)}/100</span><span>مؤشر الخطر</span></div><div class="kpi"><span class="number">${escapeHtml(statusLabel)}</span><span>الحالة</span></div><div class="kpi"><span class="number">${escapeHtml(record.source || 'داخلي')}</span><span>المصدر</span></div></div><section class="section"><div class="section-title">📋 البيانات الإدارية والترابية</div><div class="info-grid"><div class="info-item"><span class="label">الجماعة</span><span class="value">جماعة ${escapeHtml(record.commune)}</span></div><div class="info-item"><span class="label">الحي والعنوان</span><span class="value">${escapeHtml([record.quartier, record.adresse].filter(Boolean).join(' — '))}</span></div><div class="info-item"><span class="label">النطاق والوسط المتأثر</span><span class="value">${escapeHtml([record.extent, record.milieu].filter(Boolean).join(' — '))}</span></div><div class="info-item"><span class="label">المصدر المحتمل / الجهة</span><span class="value">${escapeHtml([record.probableSource, record.company].filter(Boolean).join(' — '))}</span></div></div></section><section class="section"><div class="section-title">📝 الوصف والمعاينة</div><div class="section-content"><p>${escapeHtml(record.description || 'لا توجد معطيات مسجلة')}</p></div></section><section class="section"><div class="section-title">⚙️ الإجراءات والملاحظات</div><div class="section-content"><p>${escapeHtml(record.measuresTaken || record.notes || 'لا توجد إجراءات أو ملاحظات مسجلة')}</p></div></section><div class="signature-title">الإمضاء والختم / Cachet et signature</div><div class="signatures"><div class="signature"><strong>الرئيس</strong><small>Le Président</small><div class="line"></div><small>الاسم والتوقيع</small></div><div class="signature"><strong>المدير</strong><small>Directeur des Services</small><div class="line"></div><small>الاسم والتوقيع</small></div><div class="signature"><strong>مسؤول الوقاية وحفظ الصحة</strong><small>Responsable d’hygiène</small><div class="line"></div><small>الاسم والتوقيع</small></div></div><footer class="footer">جماعة ${escapeHtml(record.commune)} — قسم الوقاية وحفظ الصحة · ${escapeHtml(record.reference)}</footer></main><script>window.onload=function(){window.focus()}</script></body></html>`)
  popup.document.close()
  const printTheme = popup.document.createElement('style')
  printTheme.textContent = '.toolbar{background:linear-gradient(110deg,#92400e,#d97706,#c2410c)!important}.ornament{background:linear-gradient(90deg,#b45309,#f59e0b,#b45309)!important}.ornament-thin{background:linear-gradient(90deg,#fde68a,#fbbf24,#fde68a)!important}.header{border-bottom-color:#b45309!important}.flag{background:#b45309!important}.header-center{color:#b45309!important}.commune-pill{border-color:#fcd34d!important;background:#fffbeb!important;color:#b45309!important}.doc-meta{border-color:#fde68a!important;background:#fffbeb!important;color:#b45309!important}.title-box{border-color:#fde68a!important;background:linear-gradient(110deg,#fffbeb,#fff7ed)!important}.title-box h1{color:#b45309!important}.subject{border-right-color:#f59e0b!important}.kpi:before{background:#f59e0b!important}.kpi .number{color:#b45309!important}.section-title{color:#b45309!important;background:#fffbeb!important;border-bottom-color:#fde68a!important}.signature{border-top-color:#b45309!important}.signature strong{color:#b45309!important}'
  popup.document.head.appendChild(printTheme)
  const frenchCommuneElement = Array.from(popup.document.querySelectorAll('span')).find((element) => element.textContent === `Commune ${record.commune}`)
  if (frenchCommuneElement) frenchCommuneElement.textContent = `Commune ${communeFrenchName}`
  const arabicHeader = popup.document.querySelector('.header-side.right')
  if (arabicHeader) arabicHeader.innerHTML = `<span class="flag">المملكة المغربية</span><br><b>وزارة الداخلية</b><br><b>عمالة سلا</b><br><span>جماعة ${escapeHtml(record.commune)}</span><br><span>مصلحة الوقاية وحفظ الصحة</span>`
  const frenchHeader = popup.document.querySelector('.header-side.left')
  if (frenchHeader) frenchHeader.innerHTML = `<span class="flag" style="background:#475569">Royaume du Maroc</span><br><b>Ministère de l’Intérieur</b><br><b>Préfecture de Salé</b><br><span>Commune ${escapeHtml(communeFrenchName)}</span><br><span>Service de prévention et d’hygiène</span>`
}

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString('ar-MA', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
}

export default function EnvironmentDossierDetail({ dossier, onBack, onRefresh }: { dossier: EnvironmentalDossier; onBack: () => void; onRefresh: () => void }) {
  const { setCurrentView, setGisFocusLayer } = useAppStore()
  const [details, setDetails] = useState<FullDossier | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [availableDocuments, setAvailableDocuments] = useState<AvailableDocument[]>([])
  const [status, setStatus] = useState(dossier.status)
  const [reason, setReason] = useState('')
  const [comment, setComment] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [evidenceType, setEvidenceType] = useState('INSPECTION')
  const [evidenceCaption, setEvidenceCaption] = useState('')
  const [measures, setMeasures] = useState<string[]>([])
  const [services, setServices] = useState<string[]>([])
  const [followUps, setFollowUps] = useState<EnvironmentalFollowUp[]>([])
  const [followUpForm, setFollowUpForm] = useState({ followUpDate: '', employeeName: '', currentStatus: '', damageRemoved: 'PENDING', notes: '', nextAction: '', nextFollowUpDate: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/env-dossiers/${dossier.id}`)
      if (!response.ok) throw new Error()
      const data = await response.json()
      setDetails(data.dossier)
      setStatus(data.dossier.status)
      setMeasures(parseList(data.dossier.measuresTaken))
      setServices(parseList(data.dossier.servicesConcerned))
      setEvents(data.unifiedDossier?.events || [])
      const followUpResponse = await fetch(`/api/environmental-followups?dossierId=${encodeURIComponent(dossier.id)}`)
      if (followUpResponse.ok) setFollowUps((await followUpResponse.json()).followUps || [])
      const documentsResponse = await fetch(`/api/documents?commune=${encodeURIComponent(data.dossier.commune)}&limit=100`)
      if (documentsResponse.ok) {
        const documentsData = await documentsResponse.json()
        setAvailableDocuments(documentsData.documents || [])
      }
    } catch {
      toast.error('تعذر تحميل تفاصيل الملف البيئي')
    }
  }, [dossier.id])

  useEffect(() => { load() }, [load])

  const update = async (body: Record<string, unknown>, success: string) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/env-dossiers/${dossier.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || '') }
      toast.success(success)
      await load()
      onRefresh()
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const addComment = async () => {
    if (!comment.trim() || !details?.unifiedDossierId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/dossiers/${details.unifiedDossierId}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: comment.trim(), action: 'COMMENT' }) })
      if (!response.ok) throw new Error()
      setComment('')
      toast.success('تمت إضافة الملاحظة')
      await load()
    } catch { toast.error('تعذر إضافة الملاحظة') } finally { setSaving(false) }
  }

  const attachDocument = async () => {
    if (!documentId) return
    setSaving(true)
    try {
      const response = await fetch(`/api/env-dossiers/${dossier.id}/documents`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId }) })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || '') }
      setDocumentId('')
      toast.success('تم ربط المستند بالملف')
      await load()
    } catch (error) { toast.error(error instanceof Error && error.message ? error.message : 'تعذر ربط المستند') } finally { setSaving(false) }
  }

  const uploadEvidence = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('الحد الأقصى للدليل 5 ميغابايت'); return }
    setSaving(true)
    try {
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file) })
      const response = await fetch(`/api/env-dossiers/${dossier.id}/evidence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, mimeType: file.type, originalName: file.name, type: evidenceType, caption: evidenceCaption }) })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || '') }
      setEvidenceCaption('')
      toast.success('تم حفظ الدليل الميداني')
      await load()
    } catch (error) { toast.error(error instanceof Error && error.message ? error.message : 'تعذر حفظ الدليل') } finally { setSaving(false); event.target.value = '' }
  }

  const addFollowUp = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/environmental-followups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...followUpForm, environmentalDossierId: dossier.id, followUpDate: followUpForm.followUpDate || null, nextFollowUpDate: followUpForm.nextFollowUpDate || null }) })
      if (!response.ok) { const data = await response.json().catch(() => null); throw new Error(data?.error || '') }
      setFollowUpForm({ followUpDate: '', employeeName: '', currentStatus: '', damageRemoved: 'PENDING', notes: '', nextAction: '', nextFollowUpDate: '' })
      toast.success('تم تسجيل إعادة المعاينة')
      await load()
      onRefresh()
    } catch (error) { toast.error(error instanceof Error && error.message ? error.message : 'تعذر حفظ إعادة المعاينة') } finally { setSaving(false) }
  }

  const record = details || dossier
  const linkedDocumentIds = new Set((details?.documents || []).map((link) => link.document.id))

  return (
    <div className="space-y-4" dir="rtl">
      <button onClick={onBack} className="text-sm font-bold text-emerald-700 hover:text-emerald-800">→ العودة إلى الملفات البيئية</button>

      <div className="rounded-2xl bg-gradient-to-l from-emerald-700 to-teal-700 p-5 text-white shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs text-emerald-100">{record.reference}</p><h2 className="mt-1 text-xl font-bold">{ENV_DOSSIER_CATEGORY_ICONS[record.category]} {record.title || 'ملف بيئي'}</h2><p className="mt-1 text-sm text-emerald-50">{ENV_DOSSIER_CATEGORY_LABELS[record.category] || record.category} · {COMMUNE_LABELS[record.commune] || record.commune}</p></div>
          <div className="rounded-xl bg-white/15 px-3 py-2 text-center"><p className="text-xs opacity-80">الحالة</p><p className="font-bold">{STATUS_LABELS[record.status] || record.status}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 font-bold text-slate-800">📋 بطاقة الملف البيئي</h3>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <Info label="الجماعة" value={COMMUNE_LABELS[record.commune] || record.commune} color={COMMUNE_COLORS[record.commune]} />
              <Info label="مستوى الخطورة" value={`${record.riskScore}/100 · ${record.riskLevel}`} />
              <Info label="المصدر" value={record.source || 'داخلي'} />
              <Info label="النطاق" value={record.extent || 'غير محدد'} />
              <Info label="الوسط المتأثر" value={record.milieu || 'غير محدد'} />
              <Info label="السكان المعرّضون" value={record.exposedPopulation ? String(record.exposedPopulation) : 'غير محدد'} />
              <Info label="آخر معاينة" value={fmtDate(record.inspectionDate)} />
              <Info label="المتابعة المقبلة" value={fmtDate(record.nextFollowUpDate)} />
              <Info label="المهلة" value={fmtDate(record.dueDate)} />
              <Info label="الجهة أو المنشأة" value={record.company || '—'} />
              {record.quartier && <Info label="الحي" value={record.quartier} />}
              {record.probableSource && <Info label="المصدر المحتمل" value={record.probableSource} />}
            </div>
            {record.description && <p className="mt-4 border-t border-slate-100 pt-3 text-sm leading-6 text-slate-600">{record.description}</p>}
            {record.legalReference && <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">⚖️ أساس قانوني قيد التحقق: {record.legalReference}</p>}
            {record.latitude != null && record.longitude != null && <button onClick={() => { setGisFocusLayer('environmentalDossiers'); setCurrentView('gis') }} className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100">🗺️ فتح طبقة الملفات البيئية في نظام المعلومات الجغرافية</button>}
            {details?.complaints?.length ? <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-amber-800">📢 البلاغات والشكايات المرتبطة</p><button onClick={() => setCurrentView('complaints')} className="text-[11px] font-bold text-amber-800 hover:text-amber-950">فتح القسم ↗</button></div><div className="mt-2 space-y-1">{details.complaints.map((complaint) => <div key={complaint.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-2 py-1.5 text-xs"><span className="font-mono font-bold text-amber-900">{complaint.reference}</span><span className="text-amber-800">{complaint.source === 'PUBLIC' ? 'بلاغ عمومي' : 'شكاية داخلية'} · {complaint.statut}</span></div>)}</div></div> : null}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2"><div><h3 className="font-bold text-slate-800">🔍 سجل المعاينات الميدانية</h3><p className="mt-1 text-xs text-slate-500">تاريخ المعاينات ونتائجها وقرارات المتابعة المرتبطة بهذا الملف.</p></div><span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">{details?.inspections?.length || 0} معاينة</span></div>
            {details?.inspections?.length ? <div className="space-y-2">{details.inspections.map((inspection) => <div key={inspection.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b className="text-xs text-slate-800">{inspection.reference}</b><span className="mr-2 text-[10px] text-slate-400">{fmtDate(inspection.inspectionDate)} · {inspection.inspectorName || 'المعاين غير محدد'}</span></div><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${inspection.riskLevel === 'CRITICAL' || inspection.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700' : inspection.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{inspection.riskScore}/100 · {inspection.riskLevel === 'CRITICAL' ? 'حرج' : inspection.riskLevel === 'HIGH' ? 'عالٍ' : inspection.riskLevel === 'MEDIUM' ? 'متوسط' : 'منخفض'}</span></div><p className="mt-2 text-xs leading-5 text-slate-600">{inspection.observation || 'بدون ملاحظات'}</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500"><span>🎯 {inspection.resolution === 'YES' ? 'مطابق' : inspection.resolution === 'PARTIAL' ? 'مطابقة جزئية' : inspection.resolution === 'NO' ? 'غير مطابق' : 'في الانتظار'}</span>{inspection.extent && <span>📍 {inspection.extent}</span>}{inspection.nextAction && <span>➡️ {inspection.nextAction}</span>}{inspection.nextFollowUpDate && <span>📅 {fmtDate(inspection.nextFollowUpDate)}</span>}</div></div>)}</div> : <p className="text-xs text-slate-400">لا توجد معاينات مرتبطة بعد. أضف أول معاينة من قسم المعاينات والمتابعة.</p>}
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 font-bold text-slate-800">📄 الوثائق المهنية</h3>
            <p className="mb-3 text-xs text-slate-500">أنشئ معاينة قابلة للطباعة أو احفظها بصيغة PDF من نافذة الطباعة.</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[['intervention', 'بطاقة التدخل'], ['inspection', 'تقرير المعاينة'], ['constat', 'محضر المعاينة'], ['notice', 'الإعذار'], ['transmission', 'مراسلة الإحالة'], ['followUp', 'بطاقة المتابعة']].map(([kind, label]) => <button key={kind} onClick={() => printEnvironmentalDocument(record, kind)} className="rounded-xl border border-emerald-200 bg-emerald-50 px-2 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100">🖨️ {label}</button>)}</div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 font-bold text-slate-800">🔄 المتابعة والإجراءات</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="NEW">جديد</option><option value="TO_VERIFY">في انتظار التحقق</option><option value="INSPECTION_SCHEDULED">معاينة مبرمجة</option><option value="IN_PROGRESS">قيد المعالجة</option><option value="PENDING">في الانتظار</option><option value="FORMAL_NOTICE">إعذار</option><option value="TO_CONTROL">في انتظار المراقبة</option><option value="TRANSMITTED">تمت الإحالة</option><option value="INSPECTED">تمت المعاينة</option><option value="ACTION_REQUIRED">إجراء مطلوب</option><option value="FOLLOW_UP">قيد التتبع</option><option value="RESOLVED">تم الحل</option><option value="CLOSED">إغلاق</option></select>
              <input type="number" min="0" max="100" defaultValue={record.progress} key={`${record.id}-${record.progress}`} id="environment-progress" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="نسبة التقدم" />
              <input type="date" defaultValue={record.inspectionDate?.slice(0, 10) || ''} key={`${record.id}-inspection-${record.inspectionDate}`} id="environment-inspection" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
              <input type="date" defaultValue={record.nextFollowUpDate?.slice(0, 10) || ''} key={`${record.id}-followup-${record.nextFollowUpDate}`} id="environment-followup" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <p className="mt-4 text-xs font-bold text-slate-600">الإجراءات المتخذة</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{MEASURE_OPTIONS.map((measure) => <label key={measure} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700"><input type="checkbox" checked={measures.includes(measure)} onChange={(event) => setMeasures((current) => event.target.checked ? [...current, measure] : current.filter((item) => item !== measure))} />{MEASURE_LABELS[measure]}</label>)}</div>
            <p className="mt-4 text-xs font-bold text-slate-600">المصالح والجهات المعنية</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{SERVICE_OPTIONS.map((service) => <label key={service} className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700"><input type="checkbox" checked={services.includes(service)} onChange={(event) => setServices((current) => event.target.checked ? [...current, service] : current.filter((item) => item !== service))} />{SERVICE_LABELS[service]}</label>)}</div>
            <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="ملاحظة الإجراء أو سبب تغيير الحالة" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button disabled={saving} onClick={() => update({ status, reason, measuresTaken: JSON.stringify(measures), servicesConcerned: JSON.stringify(services), progress: Number((document.getElementById('environment-progress') as HTMLInputElement)?.value || 0), inspectionDate: (document.getElementById('environment-inspection') as HTMLInputElement)?.value || null, nextFollowUpDate: (document.getElementById('environment-followup') as HTMLInputElement)?.value || null }, 'تم حفظ المتابعة والإجراءات')} className="mt-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '💾 حفظ المتابعة والإجراءات'}</button>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <h3 className="mb-3 font-bold text-slate-800">🔍 إعادة المعاينة / Contre-visite</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2"><input type="date" value={followUpForm.followUpDate} onChange={(event) => setFollowUpForm({ ...followUpForm, followUpDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /><input value={followUpForm.employeeName} onChange={(event) => setFollowUpForm({ ...followUpForm, employeeName: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="الموظف" /><input value={followUpForm.currentStatus} onChange={(event) => setFollowUpForm({ ...followUpForm, currentStatus: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="الوضع الحالي" /><select value={followUpForm.damageRemoved} onChange={(event) => setFollowUpForm({ ...followUpForm, damageRemoved: event.target.value })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="PENDING">غير محدد</option><option value="YES">تمت الإزالة</option><option value="NO">لم تتم الإزالة</option><option value="PARTIAL">إزالة جزئية</option></select><textarea value={followUpForm.notes} onChange={(event) => setFollowUpForm({ ...followUpForm, notes: event.target.value })} rows={2} className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" placeholder="ملاحظات إعادة المعاينة" /><input value={followUpForm.nextAction} onChange={(event) => setFollowUpForm({ ...followUpForm, nextAction: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="الإجراء التالي" /><input type="date" value={followUpForm.nextFollowUpDate} onChange={(event) => setFollowUpForm({ ...followUpForm, nextFollowUpDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" /></div>
            <button disabled={saving} onClick={addFollowUp} className="mt-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? 'جارٍ الحفظ...' : '➕ تسجيل إعادة المعاينة'}</button>
            <div className="mt-4 space-y-2">{followUps.length ? followUps.map((item) => <div key={item.id} className="rounded-xl bg-slate-50 p-3 text-xs"><div className="flex flex-wrap justify-between gap-2"><b>{item.reference} · {fmtDate(item.followUpDate)}</b><span className={item.damageRemoved === 'YES' ? 'text-emerald-700' : item.damageRemoved === 'NO' ? 'text-red-700' : 'text-amber-700'}>{item.damageRemoved === 'YES' ? 'تمت الإزالة' : item.damageRemoved === 'NO' ? 'لم تتم الإزالة' : item.damageRemoved === 'PARTIAL' ? 'إزالة جزئية' : 'غير محدد'}</span></div><p className="mt-1 text-slate-600">{item.notes || item.nextAction || 'بدون ملاحظات'}</p><p className="mt-1 text-[10px] text-slate-400">{item.employeeName || '—'}{item.nextFollowUpDate ? ` · المتابعة المقبلة: ${fmtDate(item.nextFollowUpDate)}` : ''}</p></div>) : <p className="mt-3 text-xs text-slate-400">لا توجد إعادة معاينة مسجلة.</p>}</div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-bold text-slate-800">📎 المستندات والصور المرجعية</h3><button onClick={() => setCurrentView('documents')} className="text-xs font-bold text-emerald-700">إدارة المستندات ↗</button></div>
            <div className="mb-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-3"><div className="flex flex-col gap-2 sm:flex-row"><select value={evidenceType} onChange={(event) => setEvidenceType(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs"><option value="INSPECTION">معاينة</option><option value="BEFORE">قبل التدخل</option><option value="AFTER">بعد التدخل</option><option value="ANALYSIS">نتيجة تحليل</option><option value="CORRESPONDENCE">مراسلة</option></select><input value={evidenceCaption} onChange={(event) => setEvidenceCaption(event.target.value)} className="flex-1 rounded-lg border border-slate-200 px-2 py-2 text-xs" placeholder="تعليق اختياري" /><label className="cursor-pointer rounded-lg bg-emerald-700 px-3 py-2 text-center text-xs font-bold text-white">➕ إضافة صورة/ملف<input type="file" accept="image/*,video/*,.pdf,.doc,.docx" onChange={uploadEvidence} className="hidden" /></label></div><p className="mt-2 text-[10px] text-emerald-700">الحد الأقصى 5 ميغابايت لكل دليل.</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><select value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">اختر مستنداً من الجماعة</option>{availableDocuments.filter((document) => !linkedDocumentIds.has(document.id)).map((document) => <option key={document.id} value={document.id}>{document.titre} — {document.categorie}</option>)}</select><button disabled={!documentId || saving} onClick={attachDocument} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-50">ربط المستند</button></div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{details?.evidence?.map((item) => <div key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">{item.mimeType.startsWith('image/') ? <img src={item.url} alt={item.caption || item.originalName} className="h-24 w-full object-cover" /> : item.mimeType.startsWith('video/') ? <video src={item.url} controls className="h-24 w-full object-cover" /> : <div className="flex h-24 items-center justify-center text-3xl">📄</div>}<div className="p-2 text-[10px]"><p className="truncate font-bold">{item.originalName || item.type}</p><p className="truncate text-slate-400">{item.caption || 'بدون تعليق'} · {item.uploadedBy}</p></div></div>)}</div>
            <div className="mt-3 space-y-2">{details?.documents?.length ? details.documents.map((link) => <a key={link.id} href={`/api/documents/download/${link.document.id}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"><span>📄 {link.document.titre}</span><span className="text-xs text-slate-400">{link.document.categorie} ↗</span></a>) : <p className="text-sm text-slate-400">لا توجد مستندات مرتبطة بعد.</p>}</div>
          </section>
        </div>

        <aside className="rounded-2xl border border-slate-100 bg-white p-5">
          <h3 className="mb-3 font-bold text-slate-800">📅 السجل الزمني</h3>
          <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="أضف ملاحظة أو نتيجة معاينة..." className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
          <button disabled={!comment.trim() || saving || !details?.unifiedDossierId} onClick={addComment} className="mt-2 w-full rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">إضافة إلى السجل</button>
          <div className="mt-5 space-y-3">{events.length ? events.map((event) => <div key={event.id} className="border-r-2 border-emerald-400 pr-3 text-xs"><div className="font-bold text-slate-700">{event.action === 'COMMENT' ? 'ملاحظة' : STATUS_LABELS[event.toStatus] || event.action}</div>{event.reason && <p className="mt-1 leading-5 text-slate-600">{event.reason}</p>}<p className="mt-1 text-[10px] text-slate-400">{event.changedByName || 'النظام'} · {fmtDate(event.createdAt)}</p></div>) : <p className="text-sm text-slate-400">لا توجد أحداث بعد.</p>}</div>
        </aside>
      </div>
    </div>
  )
}

function Info({ label, value, color }: { label: string; value: string; color?: string }) {
  return <div><p className="text-xs text-slate-400">{label}</p><p className="mt-0.5 font-semibold text-slate-700" style={color ? { color } : undefined}>{value}</p></div>
}
