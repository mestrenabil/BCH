import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaSchemaVersion: string | undefined
}

const PRISMA_SCHEMA_VERSION = 'csvr-identification-v1'

// Force new PrismaClient if the cached one doesn't have the latest models
// This handles the case where schema changes generate a new client but the
// dev server still has the old cached instance
if (globalForPrisma.prisma && globalForPrisma.prismaSchemaVersion !== PRISMA_SCHEMA_VERSION) {
  globalForPrisma.prisma = undefined
}

if (globalForPrisma.prisma) {
  try {
    const cached = globalForPrisma.prisma as unknown as Record<string, unknown>
    if (!cached.activityLog || !cached.interventionComment || !cached.workOrder || !cached.workOrderPhoto || !cached.strayReport || !cached.captureMission || !cached.strayAnimal || !cached.strayAnimalTransport || !cached.strayAnimalHealthAlert || !cached.strayAnimalDeathReport || !cached.strayAnimalHotspot || !cached.strayPartner || !cached.strayAnimalIdentification || !cached.csvrSettings || !cached.foodReport || !cached.foodReportPhoto || !cached.dossier || !cached.dossierEvent || !cached.establishment || !cached.inspection || !cached.finding || !cached.correctiveAction || !cached.counterVisit || !cached.healthCard || !cached.sample || !cached.waterPoint || !cached.waterMeasurement || !cached.pool || !cached.sanitationIncident || !cached.pestProduct || !cached.pestStockMovement || !cached.biteCase || !cached.deathCase || !cached.burialDossier || !cached.cemetery || !cached.corpseTransport || !cached.exhumationDossier || !cached.environmentalDossier || !cached.pollutionIncident || !cached.wasteBlackSpot || !cached.naturalSite || !cached.awarenessCampaign || !cached.authorizationDossier || !cached.sanitaryOpinion || !cached.committeeVisit || !cached.team || !cached.productCategory || !cached.documentCategory) {
      globalForPrisma.prisma = undefined
    }
  } catch {
    globalForPrisma.prisma = undefined
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db
  globalForPrisma.prismaSchemaVersion = PRISMA_SCHEMA_VERSION
}
