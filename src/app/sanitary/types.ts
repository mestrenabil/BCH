// أنواع المكتب 02: المراقبة الصحية

export interface Establishment {
  id: string
  reference: string
  name: string
  activity: string
  category: string
  ownerName: string
  ownerCin: string
  telephone: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  authorizationNumber: string
  authorizationDate: string | null
  openingDate: string | null
  status: string
  riskCategory: string
  riskScore: number
  description: string
  _count?: { inspections: number; healthCards: number; samples: number }
  createdAt: string
  updatedAt: string
}

export interface Finding {
  id: string
  inspectionId: string
  category: string
  description: string
  severity: string
  weight: number
  status: string
  createdAt: string
}

export interface Inspection {
  id: string
  reference: string
  establishmentId: string
  establishment?: { id: string; reference: string; name: string; activity: string; commune: string }
  type: string
  commune: string
  inspectionDate: string
  inspectorName: string
  overallResult: string
  riskScore: number
  checklistJson: string
  notes: string
  status: string
  foodReportId: string | null
  findings?: Finding[]
  _count?: { findings: number; correctiveActions: number; counterVisits: number }
  createdAt: string
  updatedAt: string
}

export interface HealthCard {
  id: string
  reference: string
  workerName: string
  workerCin: string
  establishmentId: string | null
  establishment?: { id: string; reference: string; name: string } | null
  occupation: string
  commune: string
  cardNumber: string
  issueDate: string | null
  expiryDate: string | null
  examinationDate: string | null
  status: string
  notes: string
  createdAt: string
  updatedAt: string
}

export interface Sample {
  id: string
  reference: string
  establishmentId: string | null
  establishment?: { id: string; reference: string; name: string } | null
  commune: string
  product: string
  sampleDate: string
  reason: string
  temperature: number | null
  collectorName: string
  laboratory: string
  requestedTests: string
  resultsJson: string
  conformity: string
  notes: string
  createdAt: string
  updatedAt: string
}
