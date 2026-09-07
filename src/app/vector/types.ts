// أنواع المكتب 04: محاربة النواقل

export interface PestStockMovement {
  id: string; productId: string; type: string; quantity: number
  reason: string; interventionRef: string; commune: string; userName: string
  createdAt: string
}

export interface PestProduct {
  id: string; reference: string; commercialName: string; activeSubstance: string
  category: string; formulation: string; concentration: string; lotNumber: string
  unit: string; quantityStock: number; thresholdAlert: number
  expiryDate: string | null; target: string; supplier: string; unitPrice: number
  commune: string; description: string; imagePath: string | null
  movements?: PestStockMovement[]
  createdAt: string; updatedAt: string
}

export interface BiteCase {
  id: string; reference: string
  victimName: string; victimAge: number | null; victimGender: string; victimPhone: string
  victimCin: string; victimRegistrationNumber: string; victimAddress: string
  guardianName: string; guardianPhone: string; declarantName: string; declarantPhone: string
  animalType: string; animalStatus: string; animalDescription: string
  biteDate: string; biteLocation: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null; biteSite: string
  description: string; medicalFacility: string; medicalReferralDate: string | null; source: string; status: string
  exposureCategory: string; woundWashConfirmed: boolean; woundWashDate: string | null; woundCareNotes: string
  vaccineType: string; vaccineRoute: string; pepProtocol: string; rigIndicated: boolean; rigAdministered: boolean; rigType: string; rigDate: string | null; vaccinationNotes: string
  reportingDate: string; followUpNotes: string; assignedTo: string
  strayReportId: string | null
  animalId?: string | null
  animal?: { csvrNumber: string; species: string } | null
  createdAt: string; updatedAt: string
}

export interface VectorDashboardMetrics {
  productsTotal: number
  lowStockProducts: number
  expiringProducts: number
  expiredProducts: number
  totalStockQuantity: number
  stockValue: number
  stockMovements: number
  stockOutMovements: number
  bitesTotal: number
  openBites: number
  suspectBites: number
  rigPendingCases: number
  overdueVaccinations: number
}
