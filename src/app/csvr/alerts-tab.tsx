'use client'

import React, { useMemo } from 'react'
import type { CsvrSubTab } from '@/lib/store'
import type { CaptureMission, StrayAnimal, StrayReport } from './types'

interface Props { reports: StrayReport[]; animals: StrayAnimal[]; missions: CaptureMission[]; onNavigate: (tab: CsvrSubTab) => void }
interface AlertItem { id: string; title: string; detail: string; tone: 'red' | 'amber' | 'blue'; target: CsvrSubTab }

const priorityLabels: Record<string, string> = { URGENTE: 'عاجل', SANITAIRE: 'صحي', HAUTE: 'مرتفع' }

export default function AlertsTab({ reports, animals, missions, onNavigate }: Props) {
  const alerts = useMemo<AlertItem[]>(() => {
    const reportAlerts = reports.filter((report) => ['URGENTE', 'SANITAIRE', 'HAUTE'].includes(report.priority) || report.rabiesSuspect || report.biteReported).map((report) => ({
      id: `report-${report.id}`,
      title: report.rabiesSuspect ? 'اشتباه بالسعار' : report.biteReported ? 'حالة عضّ مسجلة' : `بلاغ ${priorityLabels[report.priority] || 'مرتفع'}`,
      detail: `${report.reference} · ${report.commune} · ${report.quartier || 'موقع غير محدد'}`,
      tone: report.rabiesSuspect || report.biteReported ? 'red' as const : 'amber' as const,
      target: 'reports' as CsvrSubTab,
    }))
    const missionAlerts = missions.filter((mission) => mission.scheduledAt && new Date(mission.scheduledAt).getTime() < Date.now() && !['TERMINEE', 'ANNULEE'].includes(mission.statut)).map((mission) => ({
      id: `mission-${mission.id}`,
      title: 'مهمة ميدانية متأخرة',
      detail: `${mission.reference} · ${mission.commune} · ${new Date(mission.scheduledAt!).toLocaleDateString('ar-MA')}`,
      tone: 'amber' as const,
      target: 'missions' as CsvrSubTab,
    }))
    const animalAlerts = animals.filter((animal) => animal.diseaseSuspect || animal.statut === 'QUARANTINE' || animal.statut === 'DECEDE').map((animal) => ({
      id: `animal-${animal.id}`,
      title: animal.statut === 'QUARANTINE' ? 'حيوان في الحجر الصحي' : animal.statut === 'DECEDE' ? 'حيوان مسجل كنافق' : 'اشتباه صحي لحيوان',
      detail: `${animal.csvrNumber} · ${animal.commune} · ${animal.captureQuartier || '—'}`,
      tone: 'blue' as const,
      target: 'animals' as CsvrSubTab,
    }))
    return [...reportAlerts, ...missionAlerts, ...animalAlerts]
  }, [animals, missions, reports])

  const toneClass: Record<AlertItem['tone'], string> = { red: 'border-red-200 bg-red-50 text-red-800', amber: 'border-amber-200 bg-amber-50 text-amber-800', blue: 'border-blue-200 bg-blue-50 text-blue-800' }

  return <div className="space-y-4" dir="rtl">
    <div className="rounded-2xl bg-gradient-to-l from-red-700 to-orange-600 p-5 text-white shadow-lg"><h2 className="text-xl font-extrabold">🚨 مركز التنبيهات الميدانية</h2><p className="mt-1 text-xs text-red-50">تجميع الحالات التي تحتاج إلى تدخل أو متابعة عاجلة داخل نطاق الحساب.</p><div className="mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{alerts.length} تنبيه نشط</div></div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-red-200 bg-red-50 p-4"><span className="text-2xl">🩸</span><strong className="mt-2 block text-2xl text-red-700">{alerts.filter((alert) => alert.tone === 'red').length}</strong><span className="text-xs text-red-700">حالات صحية وعضّات</span></div><div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><span className="text-2xl">🎯</span><strong className="mt-2 block text-2xl text-amber-700">{alerts.filter((alert) => alert.tone === 'amber').length}</strong><span className="text-xs text-amber-700">بلاغات ومهام تحتاج متابعة</span></div><div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><span className="text-2xl">🐾</span><strong className="mt-2 block text-2xl text-blue-700">{alerts.filter((alert) => alert.tone === 'blue').length}</strong><span className="text-xs text-blue-700">حالات حيوانات خاصة</span></div></div>
    {alerts.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><div className="text-4xl">✅</div><p className="mt-3 text-sm font-bold text-slate-600">لا توجد تنبيهات نشطة حالياً</p><p className="mt-1 text-xs text-slate-400">يتم احتساب التنبيهات تلقائياً من البلاغات والمهام والسجل الصحي.</p></div> : <div className="space-y-2">{alerts.map((alert) => <button type="button" key={alert.id} onClick={() => onNavigate(alert.target)} className={`flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-sm ${toneClass[alert.tone]}`}><div><p className="text-sm font-extrabold">{alert.title}</p><p className="mt-1 text-xs opacity-80">{alert.detail}</p></div><span className="rounded-lg bg-white/70 px-3 py-2 text-[11px] font-bold">فتح السجل ←</span></button>)}</div>}
  </div>
}
