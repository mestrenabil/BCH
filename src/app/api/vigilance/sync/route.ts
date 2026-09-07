import { db } from '@/lib/db'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'
import { ensureComplaintDossier, ensureFoodReportDossier, ensureStrayReportDossier } from '@/lib/vigilance-links'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where = communeFilter ? { commune: communeFilter } : {}

    const [complaints, foodReports, strayReports] = await Promise.all([
      db.complaint.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 }),
      db.foodReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 }),
      db.strayReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 2000 }),
    ])

    const [complaintDossiers, foodDossiers, strayDossiers] = await Promise.all([
      Promise.all(complaints.map((complaint) => ensureComplaintDossier(complaint, user))),
      Promise.all(foodReports.map((report) => ensureFoodReportDossier(report, user))),
      Promise.all(strayReports.map((report) => ensureStrayReportDossier(report, user))),
    ])

    return NextResponse.json({
      synchronized: complaintDossiers.length + foodDossiers.length + strayDossiers.length,
      bySource: {
        complaints: complaintDossiers.length,
        foodReports: foodDossiers.length,
        strayReports: strayDossiers.length,
      },
    })
  } catch (error) {
    console.error('POST vigilance sync error:', error)
    return NextResponse.json({ error: 'تعذرت مزامنة البلاغات مع الملفات الموحدة' }, { status: 500 })
  }
}
