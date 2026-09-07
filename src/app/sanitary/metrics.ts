import type { Establishment, HealthCard, Inspection, Sample } from './types'

export interface SanitaryMetrics {
  criticalEstablishments: number
  expiredCards: number
  expiringSoonCards: number
  sampleConformityRate: number
  establishmentsByRisk: Record<string, number>
  establishmentsByStatus: Record<string, number>
  inspectionsByResult: Record<string, number>
  healthCardsByStatus: Record<string, number>
  samplesByConformity: Record<string, number>
}

export interface SanitaryDashboardMetrics {
  establishmentsRegistered: number
  activeEstablishments: number
  healthCardsTotal: number
  expiredHealthCards: number
  inspectionsThisMonth: number
  inspectionsTotal: number
  conformingEstablishments: number
  nonConformingEstablishments: number
  openNonConformities: number
  criticalNonConformities: number
  overdueControls: number
  counterVisits: number
  samplesCollected: number
  labNonConformities: number
  foodComplaints: number
  expiredProducts: number
  temperatureAlerts: number
  oilNonConformities: number
}

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] || 0) + 1
}

export function calculateSanitaryMetrics(establishments: Establishment[], inspections: Inspection[], healthCards: HealthCard[], samples: Sample[], now = new Date()): SanitaryMetrics {
  const establishmentsByRisk: Record<string, number> = {}
  const establishmentsByStatus: Record<string, number> = {}
  const inspectionsByResult: Record<string, number> = {}
  const healthCardsByStatus: Record<string, number> = {}
  const samplesByConformity: Record<string, number> = {}

  for (const establishment of establishments) {
    increment(establishmentsByRisk, establishment.riskCategory)
    increment(establishmentsByStatus, establishment.status)
  }
  for (const inspection of inspections) increment(inspectionsByResult, inspection.overallResult)
  for (const card of healthCards) increment(healthCardsByStatus, card.status)
  for (const sample of samples) increment(samplesByConformity, sample.conformity)

  const expiredCards = healthCards.filter((card) => card.status === 'EXPIRED' || Boolean(card.expiryDate && new Date(card.expiryDate).getTime() < now.getTime())).length
  const expiringSoonCards = healthCards.filter((card) => {
    if (!card.expiryDate || card.status === 'EXPIRED') return false
    const days = (new Date(card.expiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return days >= 0 && days <= 30
  }).length
  const nonConformSamples = samplesByConformity.NON_CONFORM || 0

  return {
    criticalEstablishments: establishmentsByRisk.CRITICAL || 0,
    expiredCards,
    expiringSoonCards,
    sampleConformityRate: samples.length > 0 ? Math.round(((samples.length - nonConformSamples) / samples.length) * 100) : 0,
    establishmentsByRisk,
    establishmentsByStatus,
    inspectionsByResult,
    healthCardsByStatus,
    samplesByConformity,
  }
}

export function filterSanitaryMapPoints<T extends { layer: string; commune: string }>(points: T[], layers: readonly string[], allowedCommunes: readonly string[]): T[] {
  return points.filter((point) => layers.includes(point.layer) && (allowedCommunes.length === 0 || allowedCommunes.includes(point.commune)))
}
