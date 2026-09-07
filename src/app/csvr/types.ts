// Shared CSVR types used across all CSVR tabs

export interface StrayReport {
  id: string
  reference: string
  source: string
  declarantName: string
  declarantPhone: string
  declarantRole: string
  commune: string
  quartier: string
  secteur: string
  adresse: string
  latitude: number | null
  longitude: number | null
  species: string
  estimatedCount: number
  hasYoung: boolean
  isAggressive: boolean
  isInjured: boolean
  isSick: boolean
  rabiesSuspect: boolean
  biteReported: boolean
  nearSchool: boolean
  nearMarket: boolean
  nearHealth: boolean
  nearDump: boolean
  description: string
  priority: string
  statut: string
  observations: string
  missionId: string | null
  createdAt: string
  updatedAt: string
  photos?: { id: string }[]
}

export interface CaptureMission {
  id: string
  reference: string
  commune: string
  quartier: string
  latitude: number | null
  longitude: number | null
  zone: string
  scheduledAt: string | null
  priority: string
  statut: string
  teamLead: string
  driver: string
  agents: string
  veterinarian: string
  vehicle: string
  equipment: string
  cagesAvailable: number
  estimatedAnimals: number
  safetyNotes: string
  preNotes: string
  arrivalTime: string | null
  endTime: string | null
  observedCount: number | null
  capturedCount: number | null
  notCapturedCount: number | null
  difficulties: string
  incidents: string
  agentInjured: boolean
  biteOccurred: boolean
  materialDamage: boolean
  postNotes: string
  completedAt: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  _count?: { reports: number; animals: number }
}

export interface StrayAnimal {
  id: string
  csvrNumber: string
  species: string
  breed: string
  sex: string
  estimatedAge: string
  weight: number | null
  size: string
  primaryColor: string
  secondaryColors: string
  distinctiveMarks: string
  microchipNumber: string
  tagNumber: string
  collarNumber: string
  qrCode: string
  reportId: string | null
  missionId: string | null
  captureDate: string | null
  captureTime: string | null
  captureLocation: string
  captureQuartier: string
  captureLatitude: number | null
  captureLongitude: number | null
  capturedBy: string
  captureState: string
  hasParasites: boolean
  diseaseSuspect: boolean
  captureNotes: string
  statut: string
  commune: string
  shelterName: string
  boxOrCage: string
  mainPhoto: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface StrayAnimalStatusEntry {
  id: string
  animalId: string
  fromStatus: string | null
  toStatus: string
  reason: string
  changedBy: string
  notes: string
  createdAt: string
}

export interface CsvrStatistics {
  reports: {
    total: number
    today: number
    urgent: number
    rabiesSuspect: number
    bites: number
    byStatus: Record<string, number>
    byPriority: Record<string, number>
    bySpecies: Record<string, number>
    byQuartier: Array<{ quartier: string; count: number }>
    monthly: Record<string, Record<string, number>>
  }
  missions: {
    total: number
    planned: number
    completed: number
    overdue: number
    animalsCaptured: number
  }
  animals: {
    total: number
    atCenter: number
    inQuarantine: number
    sterilized: number
    vaccinated: number
    adopted: number
    deceased: number
    byStatus: Record<string, number>
    bySpecies: Record<string, number>
    bySex: Record<string, number>
    sterilizationRate: number
    vaccinationRate: number
    adoptionRate: number
  }
}
