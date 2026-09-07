// أنواع المكتب 03: الماء والتطهير الصحي

export interface WaterPoint {
  id: string; reference: string; name: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  operator: string; status: string; description: string
  _count?: { measurements: number }
  createdAt: string; updatedAt: string
}

export interface WaterMeasurement {
  id: string; reference: string; waterPointId: string; sampleId: string | null; deviceId: string | null
  waterPoint?: { id: string; reference: string; name: string; type: string }
  sample?: { id: string; reference: string } | null
  device?: { id: string; reference: string; name: string } | null
  commune: string; sampleNumber: string; measurementDate: string
  chlorineResidual: number | null; ph: number | null; temperature: number | null
  turbidity: number | null; conductivity: number | null
  labTestsJson: string; conformity: string
  collectorName: string; laboratory: string; notes: string
  createdAt: string
}

export interface WaterSampleEvent {
  id: string; action: string; actorId: string; actorName: string; occurredAt: string; note: string
}

export interface WaterSample {
  id: string; reference: string; waterPointId: string | null; poolId: string | null
  waterPoint?: { id: string; reference: string; name: string } | null
  pool?: { id: string; reference: string; name: string } | null
  commune: string; sampleType: string; sampleDate: string; sampleTime: string
  collectorName: string; volumeMl: number | null; containerType: string; sterile: boolean
  preservative: string; transportTemperature: number | null; departureAt: string | null
  laboratoryArrivalAt: string | null; laboratory: string; reason: string; requestedTests: string
  observation: string; status: string; laboratoryResult: string; resultReceivedAt: string | null
  validatedBy: string; validatedAt: string | null; validationNote: string; chainEvents?: WaterSampleEvent[]
  createdAt: string; updatedAt: string
}

export interface WaterInspection {
  id: string; reference: string; waterPointId: string | null; poolId: string | null; sampleId: string | null
  waterPoint?: { id: string; reference: string; name: string } | null
  pool?: { id: string; reference: string; name: string } | null
  sample?: { id: string; reference: string } | null
  commune: string; inspectionDate: string; inspectorName: string; checklistJson: string
  observation: string; probability: number; severity: number; riskScore: number; riskLevel: string
  conformity: string; correctiveAction: string; followUpDate: string | null; status: string; closedAt: string | null
  createdAt: string; updatedAt: string
}

export interface WaterThreshold {
  id: string; commune: string; parameter: string; label: string; unit: string
  minValue: number | null; maxValue: number | null; active: boolean; notes: string
  createdAt: string; updatedAt: string
}

export interface WaterDeviceCalibration {
  id: string; deviceId: string; calibrationDate: string; nextDueDate: string | null
  performedBy: string; certificateReference: string; result: string; notes: string; createdAt: string
}

export interface WaterDevice {
  id: string; reference: string; commune: string; waterPointId: string | null
  waterPoint?: { id: string; reference: string; name: string } | null
  name: string; type: string; serialNumber: string; manufacturer: string; model: string
  status: string; calibrationDueDate: string | null; notes: string
  calibrations?: WaterDeviceCalibration[]; createdAt: string; updatedAt: string
}

export interface WaterAlert {
  id: string; sourceType: 'measurement' | 'inspection' | 'device' | 'sanitation' | 'action' | 'emergency' | 'incident'; sourceId: string
  reference: string; commune: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; title: string; detail: string
  occurredAt: string; targetTab: 'measurements' | 'inspections' | 'devices' | 'sanitation' | 'actions' | 'emergency' | 'incidents'
  actionId?: string | null; actionReference?: string | null; actionStatus?: string | null; openActionCount?: number
}

export interface WaterAction {
  id: string; reference: string; waterPointId: string | null; poolId: string | null; inspectionId: string | null; sampleId: string | null; sanitationIncidentId: string | null
  waterPoint?: { id: string; reference: string; name: string } | null
  pool?: { id: string; reference: string; name: string } | null
  inspection?: { id: string; reference: string } | null
  sample?: { id: string; reference: string } | null
  sanitationIncident?: { id: string; reference: string } | null
  commune: string; actionType: string; priority: string; status: string; responsible: string
  plannedDate: string | null; executedDate: string | null; followUpDate: string | null
  measures: string; outcome: string; observation: string; closedAt: string | null
  createdAt: string; updatedAt: string
}

export interface WaterDisinfectionOperation {
  id: string; reference: string; waterPointId: string | null; poolId: string | null
  waterPoint?: { id: string; reference: string; name: string } | null
  pool?: { id: string; reference: string; name: string } | null
  commune: string; operationDate: string; operationType: string
  productName: string; activeSubstance: string; lotNumber: string
  doseValue: number | null; doseUnit: string; treatedVolume: number | null; volumeUnit: string
  residualBefore: number | null; residualAfter: number | null; contactTimeMin: number | null
  operator: string; status: string; result: string; observation: string
  createdAt: string; updatedAt: string
}

export interface SanitationAsset {
  id: string; reference: string; name: string; type: string; commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null; operator: string; status: string
  capacity: number | null; capacityUnit: string; lastMaintenanceAt: string | null; nextMaintenanceAt: string | null
  description: string; createdAt: string; updatedAt: string
}

export interface WaterEmergencyPlan {
  id: string; reference: string; commune: string; title: string; planType: string; trigger: string
  riskLevel: string; status: string; responsible: string; alternativeSource: string
  activatedAt: string | null; targetCloseAt: string | null; closedAt: string | null
  measures: string; communicationNote: string; notes: string; createdAt: string; updatedAt: string
}

export interface WaterIncident {
  id: string; reference: string; commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null; incidentType: string; severity: string; source: string
  description: string; affectedPopulation: number; affectedPoints: number; startedAt: string; resolvedAt: string | null
  assignedTo: string; status: string; response: string; notes: string; createdAt: string; updatedAt: string
}

export interface WaterLaboratory {
  id: string; reference: string; commune: string; name: string; laboratoryType: string
  accreditationStatus: string; accreditationReference: string; contactName: string; phone: string; email: string
  address: string; turnaroundDays: number; parameters: string; active: boolean; notes: string
  createdAt: string; updatedAt: string
}

export interface WaterMonitoringProgram {
  id: string; reference: string; commune: string; name: string; programType: string; objective: string
  targetArea: string; responsible: string; team: string; status: string; startDate: string | null; endDate: string | null
  frequencyDays: number | null; targetCount: number | null; completedCount: number; notes: string; createdAt: string; updatedAt: string
}

export interface Pool {
  id: string; reference: string; name: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  operator: string; status: string; waterType: string
  lastPh: number | null; lastChlorine: number | null
  lastInspection: string | null; notes: string
  createdAt: string; updatedAt: string
}

export interface SanitationIncident {
  id: string; reference: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  description: string; riskLevel: string; source: string
  declarantName: string; declarantPhone: string
  assignedTo: string; status: string; resolution: string
  closedAt: string | null
  createdAt: string; updatedAt: string
}

export interface WaterDashboardMetrics {
  waterPointsRegistered: number
  activeWaterPoints: number
  overdueWaterPoints: number
  measurementsTotal: number
  nonConformingMeasurements: number
  samplesTotal: number
  inspectionsTotal: number
  highRiskInspections: number
  activePools: number
  openSanitationIncidents: number
  criticalSanitationIncidents: number
  openActions: number
  overdueDevices: number
  disinfectionOperations: number
}
