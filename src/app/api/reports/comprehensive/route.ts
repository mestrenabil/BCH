import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter } from '@/lib/auth'

// GET: إحصائيات شاملة عبر كل المكاتب
// ?period=today|week|month|quarter|year|all&year=YYYY
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'all'
    const format = searchParams.get('format') || 'json'
    const selectedYear = searchParams.get('year')
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const communeFilter = getScopedCommuneFilter(user, searchParams)

    // احسب حدود الفترة
    const now = new Date()
    let startDate: Date | null = null
    let endDate: Date | null = null
    const yearNumber = selectedYear && /^\d{4}$/.test(selectedYear) ? Number(selectedYear) : null
    const yearStart = yearNumber ? new Date(yearNumber, 0, 1) : null
    const yearEnd = yearNumber ? new Date(yearNumber + 1, 0, 1) : null
    if (from || to) {
      startDate = from ? new Date(`${from}T00:00:00`) : null
      endDate = to ? new Date(`${to}T23:59:59.999`) : null
    } else switch (period) {
      case 'today': startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); break
      case 'week': { const d = new Date(now); d.setDate(d.getDate() - 7); startDate = d; break }
      case 'month': startDate = new Date(now.getFullYear(), now.getMonth(), 1); break
      case 'quarter': { const q = Math.floor(now.getMonth() / 3); startDate = new Date(now.getFullYear(), q * 3, 1); break }
      case 'year':
        startDate = yearStart || new Date(now.getFullYear(), 0, 1)
        endDate = yearEnd
        break
      default: startDate = null
    }
    if (!startDate && yearStart) startDate = yearStart
    if (yearStart && startDate && startDate < yearStart) startDate = yearStart
    if (yearEnd && (!endDate || endDate > yearEnd)) endDate = yearEnd
    const dateFilter = startDate ? { gte: startDate, ...(endDate ? { lt: endDate } : {}) } : {}
    const where = communeFilter ? { commune: communeFilter, createdAt: dateFilter } : { createdAt: dateFilter }

    // اجلب العدّادات من كل الجداول بالتوازي
    const [
      interventions, complaints, foodReports, strayReports, establishments,
      inspections, waterPoints, waterMeasurements, pollutionIncidents, wasteSpots,
      naturalSites, deathCases, burialDossiers, biteCases, authDossiers, opinions,
      committeeVisits, awarenessCampaigns, dossiers, workOrders, captureMissions,
      strayAnimals, healthCards, samples, pools, sanitationIncidents, environmentalDossiers,
      cemeteries, exhumations, corpseTransports, campagnes, products, pestProducts,
      stockMovements, documents, agents, quartiers,
    ] = await Promise.all([
      db.intervention.count({ where: communeFilter ? { commune: communeFilter, date: dateFilter } : { date: dateFilter } as any }),
      db.complaint.count({ where: where as any }),
      db.foodReport.count({ where: where as any }),
      db.strayReport.count({ where: where as any }),
      db.establishment.count({ where: where as any }),
      db.inspection.count({ where: where as any }),
      db.waterPoint.count({ where: where as any }),
      db.waterMeasurement.count({ where: where as any }),
      db.pollutionIncident.count({ where: where as any }),
      db.wasteBlackSpot.count({ where: where as any }),
      db.naturalSite.count({ where: where as any }),
      db.deathCase.count({ where: where as any }),
      db.burialDossier.count({ where: where as any }),
      db.biteCase.count({ where: where as any }),
      db.authorizationDossier.count({ where: where as any }),
      db.sanitaryOpinion.count({ where: where as any }),
      db.committeeVisit.count({ where: where as any }),
      db.awarenessCampaign.count({ where: where as any }),
      db.dossier.count({ where: where as any }),
      db.workOrder.count({ where: where as any }),
      db.captureMission.count({ where: where as any }),
      db.strayAnimal.count({ where: where as any }),
      db.healthCard.count({ where: where as any }),
      db.sample.count({ where: where as any }),
      db.pool.count({ where: where as any }),
      db.sanitationIncident.count({ where: where as any }),
      db.environmentalDossier.count({ where: where as any }),
      db.cemetery.count({ where: where as any }),
      db.exhumationDossier.count({ where: where as any }),
      db.corpseTransport.count({ where: where as any }),
      db.campagne.count({ where: where as any }),
      db.product.count({ where: where as any }),
      db.pestProduct.count({ where: where as any }),
      db.stockMovement.count({ where: where as any }),
      db.document.count({ where: where as any }),
      db.agent.count({ where: where as any }),
      db.quartier.count({ where: where as any }),
    ])

    // عدّادات الحالات الحرجة
    const criticalDateFilter = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}
    const criticalStats = await Promise.all([
      db.foodReport.count({ where: { ...(communeFilter ? { commune: communeFilter } : {}), ...criticalDateFilter, priority: { in: ['URGENTE', 'SANITAIRE'] } } as any }),
      db.pollutionIncident.count({ where: { ...(communeFilter ? { commune: communeFilter } : {}), ...criticalDateFilter, severity: { in: ['HIGH', 'CRITICAL'] } } as any }),
      db.establishment.count({ where: { ...(communeFilter ? { commune: communeFilter } : {}), ...criticalDateFilter, riskCategory: 'CRITICAL' } as any }),
      db.healthCard.count({ where: { ...(communeFilter ? { commune: communeFilter } : {}), ...criticalDateFilter, status: 'EXPIRED' } as any }),
      db.burialDossier.count({ where: { ...(communeFilter ? { commune: communeFilter } : {}), ...criticalDateFilter, authorizationStatus: 'PENDING' } as any }),
    ])

    // اتجاه آخر 30 يوم (تدخلات + شكايات + بلاغات غذائية)
    const trendDays = 30
    const trendEnd = yearEnd && yearEnd < now ? yearEnd : now
    const trend: { date: string; interventions: number; complaints: number; foodReports: number }[] = []
    for (let i = trendDays - 1; i >= 0; i--) {
      const d = new Date(trendEnd); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
      const next = new Date(d); next.setDate(next.getDate() + 1)
      const dateKey = d.toISOString().slice(0, 10)
      const [intC, compC, foodC] = await Promise.all([
        db.intervention.count({ where: { date: { gte: d, lt: next }, ...(communeFilter ? { commune: communeFilter } : {}) } as any }),
        db.complaint.count({ where: { createdAt: { gte: d, lt: next }, ...(communeFilter ? { commune: communeFilter } : {}) } as any }),
        db.foodReport.count({ where: { createdAt: { gte: d, lt: next }, ...(communeFilter ? { commune: communeFilter } : {}) } as any }),
      ])
      trend.push({ date: dateKey, interventions: intC, complaints: compC, foodReports: foodC })
    }

    const sectionRows = [
      { key: 'interventions', section: 'إدارة التدخلات', office: 'المكتب 04', total: interventions },
      { key: 'complaints', section: 'الشكايات واليقظة', office: 'المكتب 07', total: complaints },
      { key: 'foodReports', section: 'الصحة والسلامة الغذائية', office: 'المكتب 02', total: foodReports },
      { key: 'establishments', section: 'سجل المنشآت الصحية', office: 'المكتب 02', total: establishments },
      { key: 'inspections', section: 'تفتيش المنشآت', office: 'المكتب 02', total: inspections },
      { key: 'waterPoints', section: 'نقاط المياه', office: 'المكتب 03', total: waterPoints },
      { key: 'waterMeasurements', section: 'قياسات المياه', office: 'المكتب 03', total: waterMeasurements },
      { key: 'pollutionIncidents', section: 'حوادث التلوث', office: 'المكتب 06', total: pollutionIncidents },
      { key: 'wasteSpots', section: 'النفايات والنقط السوداء', office: 'المكتب 06', total: wasteSpots },
      { key: 'naturalSites', section: 'المواقع الطبيعية', office: 'المكتب 06', total: naturalSites },
      { key: 'strayReports', section: 'الحيوانات الشاردة', office: 'المكتب 04', total: strayReports },
      { key: 'biteCases', section: 'اليقظة الصحية', office: 'المكتب 07', total: biteCases },
      { key: 'deathCases', section: 'الوفيات والدفن', office: 'المكتب 05', total: deathCases },
      { key: 'burialDossiers', section: 'ملفات الدفن', office: 'المكتب 05', total: burialDossiers },
      { key: 'authDossiers', section: 'التراخيص والآراء الصحية', office: 'المكتب 08', total: authDossiers },
      { key: 'opinions', section: 'الآراء الصحية', office: 'المكتب 08', total: opinions },
      { key: 'committeeVisits', section: 'اللجان والزيارات', office: 'المكتب 08', total: committeeVisits },
      { key: 'awarenessCampaigns', section: 'حملات التوعية', office: 'المكتب 06', total: awarenessCampaigns },
      { key: 'dossiers', section: 'الملفات الموحدة', office: 'المكتب 01', total: dossiers },
      { key: 'workOrders', section: 'أوامر العمل الميدانية', office: 'المكتب 01', total: workOrders },
      { key: 'captureMissions', section: 'مهام التقاط الحيوانات', office: 'المكتب 04', total: captureMissions },
      { key: 'strayAnimals', section: 'سجل الحيوانات الملتقطة', office: 'المكتب 04', total: strayAnimals },
      { key: 'healthCards', section: 'البطاقات الصحية', office: 'المكتب 02', total: healthCards },
      { key: 'samples', section: 'العينات الغذائية', office: 'المكتب 02', total: samples },
      { key: 'pools', section: 'المسابح ومواقع السباحة', office: 'المكتب 03', total: pools },
      { key: 'sanitationIncidents', section: 'حوادث الصرف الصحي', office: 'المكتب 03', total: sanitationIncidents },
      { key: 'environmentalDossiers', section: 'الملفات البيئية', office: 'المكتب 06', total: environmentalDossiers },
      { key: 'cemeteries', section: 'المقابر', office: 'المكتب 05', total: cemeteries },
      { key: 'exhumations', section: 'ملفات النبش', office: 'المكتب 05', total: exhumations },
      { key: 'corpseTransports', section: 'نقل الأموات', office: 'المكتب 05', total: corpseTransports },
      { key: 'campagnes', section: 'الحملات الميدانية', office: 'المكتب 04', total: campagnes },
      { key: 'products', section: 'المخزون العام', office: 'المكتب 04', total: products },
      { key: 'pestProducts', section: 'مخزون محاربة النواقل والتطهير', office: 'المكتب 04', total: pestProducts },
      { key: 'stockMovements', section: 'حركات المخزون', office: 'المكتب 04', total: stockMovements },
      { key: 'documents', section: 'الوثائق والمستندات', office: 'المكتب 01', total: documents },
      { key: 'agents', section: 'الفرق والأعوان', office: 'المكتب 04', total: agents },
      { key: 'quartiers', section: 'الأحياء والنطاق الترابي', office: 'المكتب 01', total: quartiers },
    ]
    const totalRecords = sectionRows.reduce((sum, row) => sum + row.total, 0)
    const scopeLabel = typeof communeFilter === 'string' ? communeFilter : 'كل الجماعات'

    if (format === 'csv') {
      const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
      const rows = [
        ['القسم', 'المكتب', 'عدد السجلات', 'الجماعة', 'الفترة'],
        ...sectionRows.map((row) => [row.section, row.office, row.total, scopeLabel, period]),
        [],
        ['المؤشر', 'القيمة'],
        ['إجمالي السجلات', totalRecords],
        ['بلاغات غذائية عاجلة', criticalStats[0]],
        ['حوادث تلوث عالية الخطورة', criticalStats[1]],
        ['منشآت حرجة', criticalStats[2]],
        ['بطاقات صحية منتهية', criticalStats[3]],
        ['طلبات دفن قيد الانتظار', criticalStats[4]],
      ]
      const csv = '\uFEFF' + rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="comprehensive-report.csv"',
        },
      })
    }

    return NextResponse.json({
      period,
      scope: communeFilter || 'ALL',
      totalRecords,
      sections: sectionRows,
      stats: {
        // 3D
        interventions, complaints, foodReports, strayReports,
        // صحة
        establishments, inspections,
        // ماء
        waterPoints, waterMeasurements,
        // بيئة
        pollutionIncidents, wasteSpots, naturalSites, environmentalDossiers, awarenessCampaigns,
        sanitationIncidents,
        // جنائز
        deathCases, burialDossiers, cemeteries, exhumations, corpseTransports,
        // نواقل
        biteCases, captureMissions, strayAnimals,
        // تراخيص
        authDossiers, opinions, committeeVisits, healthCards, samples,
        pools,
        workOrders, campagnes, products, pestProducts, stockMovements, documents, agents, quartiers,
        // موحّد
        dossiers,
      },
      critical: {
        urgentFood: criticalStats[0],
        criticalPollution: criticalStats[1],
        criticalEstablishments: criticalStats[2],
        expiredHealthCards: criticalStats[3],
        pendingBurialAuth: criticalStats[4],
      },
      trend,
    })
  } catch (error) {
    console.error('GET reports/comprehensive error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
