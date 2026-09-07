// أنواع المكتب 06: المحافظة على البيئة

export interface EnvironmentalDossier {
  id: string; reference: string; title: string; category: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  description: string; riskScore: number; riskLevel: string; probability: number; severity: number; priority: string
  status: string; assignedTo: string; company: string; progress: number
  notes: string; source: string; probableSource: string; extent: string
  exposedPopulation: number; milieu: string; servicesConcerned: string; legalReference: string; measuresTaken: string
  dueDate: string | null; inspectionDate: string | null; nextFollowUpDate: string | null; closedAt: string | null
  unifiedDossierId: string | null; createdAt: string; updatedAt: string
}

export interface EnvironmentalDocumentLink {
  id: string
  document: { id: string; titre: string; categorie: string; nomFichier: string; typeFichier: string; createdAt: string }
}

export interface EnvironmentalEvidence {
  id: string; url: string; caption: string; type: string; mimeType: string; originalName: string; uploadedBy: string; createdAt: string
}

export interface EnvironmentalInspection {
  id: string; reference: string; environmentalDossierId: string; commune: string
  inspectionDate: string; inspectorName: string; observation: string; probableSource: string
  extent: string; exposedPopulation: number; milieu: string; probability: number; severity: number
  riskScore: number; riskLevel: string; resolution: string; nextAction: string; nextFollowUpDate: string | null
  notes: string; createdAt: string; updatedAt: string
  environmentalDossier?: { reference: string; title: string }
}

export interface EnvironmentalFollowUp {
  id: string; reference: string; environmentalDossierId: string; commune: string; followUpDate: string
  employeeName: string; currentStatus: string; damageRemoved: string; notes: string; nextAction: string
  nextFollowUpDate: string | null; createdAt: string; updatedAt: string
}

export interface EnvironmentalComplaint {
  id: string; reference: string; nomCitoyen: string; telephone: string | null; adresse: string; quartier: string | null
  commune: string; type: string; description: string; priorite: string; statut: string; source: string
  latitude: number | null; longitude: number | null; environmentalDossierId: string | null; dateReception: string; createdAt: string
}

export interface EnvironmentalProgram {
  id: string; reference: string; year: number; operation: string; axis: string; commune: string; quartier: string; environmentalDossierId?: string | null
  environmentalDossier?: { id: string; reference: string; title: string } | null
  objective: string; responsible: string; startDate: string | null; endDate: string | null; budget: number | null
  indicator: string; quantitativeTarget: number; achieved: number; progress: number; status: string; notes: string
  createdAt: string; updatedAt: string
}

export interface PollutionIncident {
  id: string; reference: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  description: string; source: string; declarantName: string; declarantPhone: string
  pollutantName: string; severity: string; company: string
  environmentalDossierId?: string | null
  environmentalDossier?: { id: string; reference: string; title: string } | null
  status: string; mitigation: string; closedAt: string | null
  createdAt: string; updatedAt: string
}

export interface WasteBlackSpot {
  id: string; reference: string; commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  description: string; wasteType: string; recurring: boolean; recurrenceCount: number
  environmentalDossierId?: string | null
  environmentalDossier?: { id: string; reference: string; title: string } | null
  source: string; status: string; lastCleanedAt: string | null; notes: string
  createdAt: string; updatedAt: string
}

export interface NaturalSite {
  id: string; reference: string; name: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  area: number | null; description: string; protectionLevel: string
  environmentalDossierId?: string | null
  environmentalDossier?: { id: string; reference: string; title: string } | null
  status: string; threats: string; notes: string
  createdAt: string; updatedAt: string
}

export interface AwarenessCampaign {
  id: string; reference: string; title: string; theme: string
  commune: string; description: string; targetAudience: string; environmentalDossierId?: string | null; environmentalProgramId?: string | null
  environmentalDossier?: { id: string; reference: string; title: string } | null
  environmentalProgram?: { id: string; reference: string; operation: string } | null
  startDate: string | null; endDate: string | null
  budget: number | null; participantsCount: number; organizerName: string
  status: string; outcomes: string; notes: string
  createdAt: string; updatedAt: string
}

export interface EnvironmentalWaterPoint {
  id: string; reference: string; name: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  operator: string; status: string; description: string
  _count?: { measurements: number }
  createdAt: string; updatedAt: string
}

export interface EnvironmentalWaterMeasurement {
  id: string; reference: string; waterPointId: string
  waterPoint?: { id: string; reference: string; name: string; type: string }
  commune: string; sampleNumber: string; measurementDate: string
  chlorineResidual: number | null; ph: number | null; temperature: number | null
  turbidity: number | null; conductivity: number | null
  labTestsJson: string; conformity: string
  collectorName: string; laboratory: string; notes: string
  createdAt: string
}

export interface EnvironmentalDashboardMetrics {
  dossiersTotal: number
  openDossiers: number
  highRiskDossiers: number
  overdueDossiers: number
  pollutionTotal: number
  openPollution: number
  criticalPollution: number
  wasteTotal: number
  recurringWaste: number
  threatenedSites: number
  inspectionsTotal: number
  overdueInspections: number
  followUpsTotal: number
  overdueFollowUps: number
  programsTotal: number
  activePrograms: number
  campaignsTotal: number
  activeCampaigns: number
  environmentalComplaints: number
  openEnvironmentalComplaints: number
  waterPoints: number
  nonConformingWaterMeasurements: number
}
