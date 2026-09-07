// أنواع المكتب 07: الشكايات واليقظة الموحّدة

export interface UnifiedReport {
  id: string
  reference: string
  sourceKind: string        // COMPLAINT/FOOD_REPORT/STRAY_REPORT/POLLUTION/SANITATION
  category: string
  description: string
  priority: string
  status: string
  source: string            // INTERNAL/PUBLIC/PHONE
  commune: string
  quartier: string
  createdAt: string
  daysOpen: number
  slaStatus: 'WITHIN' | 'OVERDUE' | 'CRITICAL'
}

export interface VigilanceStats {
  bySource: Record<string, number>
  byCategory: Record<string, number>
  byStatus: Record<string, number>
  overdue: number
  critical: number
  open: number
}
