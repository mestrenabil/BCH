import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'
import { VIGILANCE_SLA_DAYS } from '@/lib/constants'

// GET: لوحة موحّدة تجمع كل البلاغات من كل المصادر
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const limit = Math.min(parseInt(searchParams.get('limit') || '200', 10), 500)

    const where = communeFilter ? { commune: communeFilter } : {}

    // اجلب آخر البلاغات من كل مصدر
    const [complaints, foodReports, strayReports, pollutionIncidents, sanitationIncidents] = await Promise.all([
      db.complaint.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, reference: true, type: true, description: true, priorite: true, statut: true, source: true, commune: true, quartier: true, createdAt: true } }),
      db.foodReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, reference: true, reportType: true, description: true, priority: true, statut: true, source: true, commune: true, quartier: true, establishmentName: true, createdAt: true } }),
      db.strayReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, reference: true, species: true, description: true, priority: true, statut: true, source: true, commune: true, quartier: true, createdAt: true } }),
      db.pollutionIncident.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, reference: true, type: true, description: true, severity: true, status: true, source: true, commune: true, quartier: true, createdAt: true } }),
      db.sanitationIncident.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, reference: true, type: true, description: true, riskLevel: true, status: true, source: true, commune: true, quartier: true, createdAt: true } }),
    ])

    //وحّد كل البلاغات في قائمة واحدة
    type UnifiedReport = {
      id: string; reference: string; sourceKind: string; category: string
      description: string; priority: string; status: string; source: string
      commune: string; quartier: string; createdAt: string | Date; daysOpen: number
      slaStatus: 'WITHIN' | 'OVERDUE' | 'CRITICAL'
    }

    const now = Date.now()
    const all: UnifiedReport[] = []

    for (const c of complaints) {
      const daysOpen = Math.floor((now - new Date(c.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const slaDays = VIGILANCE_SLA_DAYS[c.priorite === 'URGENTE' ? 'URGENT' : c.priorite === 'HAUTE' ? 'IMPORTANT' : 'NORMAL'] ?? 7
      all.push({ id: c.id, reference: c.reference, sourceKind: 'COMPLAINT', category: c.type, description: c.description, priority: c.priorite, status: c.statut, source: c.source, commune: c.commune, quartier: c.quartier || '', createdAt: c.createdAt, daysOpen, slaStatus: daysOpen > slaDays ? 'OVERDUE' : daysOpen >= slaDays ? 'CRITICAL' : 'WITHIN' })
    }
    for (const f of foodReports) {
      const daysOpen = Math.floor((now - new Date(f.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const slaDays = VIGILANCE_SLA_DAYS[f.priority === 'URGENTE' ? 'URGENT' : f.priority === 'SANITAIRE' ? 'CRITICAL' : f.priority === 'HAUTE' ? 'IMPORTANT' : 'NORMAL'] ?? 7
      all.push({ id: f.id, reference: f.reference, sourceKind: 'FOOD_REPORT', category: f.reportType, description: f.description || f.establishmentName, priority: f.priority, status: f.statut, source: f.source, commune: f.commune, quartier: f.quartier, createdAt: f.createdAt, daysOpen, slaStatus: daysOpen > slaDays ? 'OVERDUE' : daysOpen >= slaDays ? 'CRITICAL' : 'WITHIN' })
    }
    for (const s of strayReports) {
      const daysOpen = Math.floor((now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const slaDays = VIGILANCE_SLA_DAYS[s.priority === 'URGENTE' ? 'URGENT' : s.priority === 'SANITAIRE' ? 'CRITICAL' : s.priority === 'HAUTE' ? 'IMPORTANT' : 'NORMAL'] ?? 7
      all.push({ id: s.id, reference: s.reference, sourceKind: 'STRAY_REPORT', category: s.species || 'OTHER', description: s.description, priority: s.priority, status: s.statut, source: s.source, commune: s.commune, quartier: s.quartier, createdAt: s.createdAt, daysOpen, slaStatus: daysOpen > slaDays ? 'OVERDUE' : daysOpen >= slaDays ? 'CRITICAL' : 'WITHIN' })
    }
    for (const p of pollutionIncidents) {
      const daysOpen = Math.floor((now - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const slaDays = VIGILANCE_SLA_DAYS[p.severity === 'CRITICAL' ? 'CRITICAL' : p.severity === 'HIGH' ? 'URGENT' : 'NORMAL'] ?? 7
      all.push({ id: p.id, reference: p.reference, sourceKind: 'POLLUTION', category: p.type, description: p.description, priority: p.severity, status: p.status, source: p.source, commune: p.commune, quartier: p.quartier, createdAt: p.createdAt, daysOpen, slaStatus: daysOpen > slaDays ? 'OVERDUE' : daysOpen >= slaDays ? 'CRITICAL' : 'WITHIN' })
    }
    for (const s of sanitationIncidents) {
      const daysOpen = Math.floor((now - new Date(s.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      const slaDays = VIGILANCE_SLA_DAYS[s.riskLevel === 'CRITICAL' ? 'CRITICAL' : s.riskLevel === 'HIGH' ? 'URGENT' : 'NORMAL'] ?? 7
      all.push({ id: s.id, reference: s.reference, sourceKind: 'SANITATION', category: s.type, description: s.description, priority: s.riskLevel, status: s.status, source: s.source, commune: s.commune, quartier: s.quartier, createdAt: s.createdAt, daysOpen, slaStatus: daysOpen > slaDays ? 'OVERDUE' : daysOpen >= slaDays ? 'CRITICAL' : 'WITHIN' })
    }

    // رتّب من الأحدث
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    // إحصائيات تجميعية
    const bySource: Record<string, number> = {}
    const byCategory: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    let overdue = 0
    let critical = 0
    let open = 0
    for (const r of all) {
      bySource[r.sourceKind] = (bySource[r.sourceKind] || 0) + 1
      byCategory[r.category] = (byCategory[r.category] || 0) + 1
      byStatus[r.status] = (byStatus[r.status] || 0) + 1
      if (r.slaStatus === 'OVERDUE') overdue++
      if (r.slaStatus === 'CRITICAL') critical++
      // اعتبار البلاغ "مفتوح" إذا لم يكن في حالة إغلاق
      if (!['TRAITEE', 'TRAITE', 'REJETEE', 'REJETE', 'CLOSED', 'CLASSE', 'ARCHIVED'].includes(r.status)) open++
    }

    return NextResponse.json({
      reports: all,
      total: all.length,
      stats: { bySource, byCategory, byStatus, overdue, critical, open },
    })
  } catch (error) {
    console.error('GET vigilance overview error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
