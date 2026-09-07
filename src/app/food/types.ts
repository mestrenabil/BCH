// Shared types for food safety reports

export interface FoodReportPhoto {
  id: string
  storedFileName: string
  originalName: string
  mimeType: string
  size: number
}

export interface FoodReport {
  id: string
  reference: string
  source: string
  declarantName: string
  declarantPhone: string
  declarantEmail?: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  reportType: string
  establishmentName: string
  establishmentType: string
  description: string
  priority: string
  statut: string
  observations: string
  createdAt: string
  updatedAt: string
  photos?: FoodReportPhoto[]
}

// إحصائيات تجميعية للوحة القيادة
export interface FoodStatistics {
  total: number
  byStatus: Record<string, number>
  byType: Record<string, number>
  byPriority: Record<string, number>
  byCommune: Record<string, number>
  bySource: { PUBLIC: number; INTERNAL: number }
  withPhotos: number
  withGeo: number
  recentTrend: { date: string; count: number }[]   // آخر 14 يوم
  resolutionRate: number                            // نسبة المعالجة
  urgentCount: number                              // بلاغات عاجلة/صحية
  avgAgeDays: number                               // متوسط عمر البلاغ (أيام)
}
