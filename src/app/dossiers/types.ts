// أنواع نظام الملفات الموحّد

export interface DossierEvent {
  id: string
  dossierId: string
  fromStatus: string | null
  toStatus: string
  action: string         // CREATE/STATUS_CHANGE/ASSIGN/COMMENT/LINK
  reason: string
  changedBy: string
  changedByName: string
  metadata: string       // JSON
  createdAt: string
}

export interface Dossier {
  id: string
  reference: string
  office: string         // OFFICE_01..OFFICE_09
  type: string           // INSPECTION/COMPLAINT/MISSION/...
  title: string
  description: string
  status: string         // NEW/ASSIGNED/.../ARCHIVED
  priority: string       // FAIBLE/NORMALE/HAUTE/URGENTE/SANITAIRE
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  assignedTo: string
  assignedToName: string
  dueDate: string | null
  closedAt: string | null
  interventionId: string | null
  complaintId: string | null
  workOrderId: string | null
  strayReportId: string | null
  foodReportId: string | null
  createdBy: string
  createdByName: string
  notes: string
  events?: DossierEvent[]
  createdAt: string
  updatedAt: string
}

// كيان مرتبط (للعرض في التفاصيل)
export interface LinkedEntityInfo {
  kind: 'intervention' | 'complaint' | 'workOrder' | 'strayReport' | 'foodReport'
  id: string
  label: string
  reference?: string
}
