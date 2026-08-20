-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "gisLayer" TEXT NOT NULL DEFAULT 'interventions',
    "date" TIMESTAMP(3) NOT NULL,
    "quartier" TEXT NOT NULL,
    "adresse" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "statut" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "agentNom" TEXT NOT NULL,
    "produitUtilise" TEXT NOT NULL DEFAULT '',
    "quantite" TEXT NOT NULL DEFAULT '',
    "superficie" TEXT NOT NULL DEFAULT '',
    "nombrePrestations" INTEGER NOT NULL DEFAULT 1,
    "observations" TEXT NOT NULL DEFAULT '',
    "heureDebut" TEXT,
    "heureFin" TEXT,
    "coutMainOeuvre" DOUBLE PRECISION,
    "coutMateriaux" DOUBLE PRECISION,
    "coutTotal" DOUBLE PRECISION,
    "reference" TEXT NOT NULL,
    "campagneId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campagne" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "objectif" TEXT NOT NULL DEFAULT '',
    "budgetPrevu" DOUBLE PRECISION,
    "coutReel" DOUBLE PRECISION,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIEE',
    "responsable" TEXT NOT NULL DEFAULT '',
    "couleur" TEXT NOT NULL DEFAULT '#10b981',
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campagne_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quartier" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Quartier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "categorie" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "unite" TEXT NOT NULL DEFAULT 'لتر',
    "quantiteStock" INTEGER NOT NULL DEFAULT 0,
    "seuilAlerte" INTEGER NOT NULL DEFAULT 10,
    "prixUnitaire" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fournisseur" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL,
    "imagePath" TEXT,
    "dateExpiration" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT '📦',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionMaterial" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "fonction" TEXT NOT NULL DEFAULT 'عون صحية',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "teamId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "office" TEXT NOT NULL DEFAULT 'OFFICE_04',
    "mission" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#10b981',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "managedCommunes" TEXT NOT NULL DEFAULT '[]',
    "communeGroupName" TEXT,
    "navVisibilityJson" TEXT NOT NULL DEFAULT '{}',
    "role" TEXT NOT NULL DEFAULT 'responsable',
    "agentId" TEXT,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "note" TEXT,
    "commune" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommuneSettings" (
    "id" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommuneSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "titre" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "categorie" TEXT NOT NULL DEFAULT 'عام',
    "commune" TEXT NOT NULL DEFAULT '',
    "nomFichier" TEXT NOT NULL,
    "cheminFichier" TEXT NOT NULL,
    "typeFichier" TEXT NOT NULL DEFAULT '',
    "tailleFichier" INTEGER NOT NULL DEFAULT 0,
    "reference" TEXT NOT NULL DEFAULT '',
    "dateDocument" TIMESTAMP(3),
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCategory" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "icon" TEXT NOT NULL DEFAULT '📎',
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionDocument" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionPhoto" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "type" TEXT NOT NULL DEFAULT 'AFTER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterventionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Complaint" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "nomCitoyen" TEXT NOT NULL,
    "telephone" TEXT,
    "email" TEXT,
    "adresse" TEXT NOT NULL,
    "quartier" TEXT,
    "commune" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priorite" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "interventionId" TEXT,
    "environmentalDossierId" TEXT,
    "dateReception" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateTraitement" TIMESTAMP(3),
    "observations" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Complaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplaintContact" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contactedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplaintContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "status" TEXT NOT NULL DEFAULT 'NOUVEAU',
    "complaintId" TEXT,
    "interventionId" TEXT,
    "assignedAgentId" TEXT,
    "scheduledFor" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completionNotes" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderPhoto" (
    "id" TEXT NOT NULL,
    "workOrderId" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AFTER',
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrderPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL DEFAULT '',
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionComment" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorRole" TEXT NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'COMMENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterventionComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayReport" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "declarantName" TEXT NOT NULL DEFAULT '',
    "declarantPhone" TEXT NOT NULL DEFAULT '',
    "declarantRole" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "secteur" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "species" TEXT NOT NULL DEFAULT 'DOG',
    "estimatedCount" INTEGER NOT NULL DEFAULT 1,
    "hasYoung" BOOLEAN NOT NULL DEFAULT false,
    "isAggressive" BOOLEAN NOT NULL DEFAULT false,
    "isInjured" BOOLEAN NOT NULL DEFAULT false,
    "isSick" BOOLEAN NOT NULL DEFAULT false,
    "rabiesSuspect" BOOLEAN NOT NULL DEFAULT false,
    "biteReported" BOOLEAN NOT NULL DEFAULT false,
    "nearSchool" BOOLEAN NOT NULL DEFAULT false,
    "nearMarket" BOOLEAN NOT NULL DEFAULT false,
    "nearHealth" BOOLEAN NOT NULL DEFAULT false,
    "nearDump" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'NOUVEAU',
    "observations" TEXT NOT NULL DEFAULT '',
    "missionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayReportPhoto" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "size" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrayReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureMission" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "zone" TEXT NOT NULL DEFAULT '',
    "scheduledAt" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIEE',
    "teamLead" TEXT NOT NULL DEFAULT '',
    "driver" TEXT NOT NULL DEFAULT '',
    "agents" TEXT NOT NULL DEFAULT '[]',
    "veterinarian" TEXT NOT NULL DEFAULT '',
    "vehicle" TEXT NOT NULL DEFAULT '',
    "equipment" TEXT NOT NULL DEFAULT '',
    "cagesAvailable" INTEGER NOT NULL DEFAULT 0,
    "estimatedAnimals" INTEGER NOT NULL DEFAULT 0,
    "safetyNotes" TEXT NOT NULL DEFAULT '',
    "preNotes" TEXT NOT NULL DEFAULT '',
    "arrivalTime" TEXT,
    "endTime" TEXT,
    "observedCount" INTEGER,
    "capturedCount" INTEGER,
    "notCapturedCount" INTEGER,
    "difficulties" TEXT NOT NULL DEFAULT '',
    "incidents" TEXT NOT NULL DEFAULT '',
    "agentInjured" BOOLEAN NOT NULL DEFAULT false,
    "biteOccurred" BOOLEAN NOT NULL DEFAULT false,
    "materialDamage" BOOLEAN NOT NULL DEFAULT false,
    "postNotes" TEXT NOT NULL DEFAULT '',
    "completedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaptureMission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaptureMissionPhoto" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "size" INTEGER NOT NULL DEFAULT 0,
    "type" TEXT NOT NULL DEFAULT 'BEFORE',
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaptureMissionPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimal" (
    "id" TEXT NOT NULL,
    "csvrNumber" TEXT NOT NULL,
    "species" TEXT NOT NULL DEFAULT 'DOG',
    "breed" TEXT NOT NULL DEFAULT '',
    "sex" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "estimatedAge" TEXT NOT NULL DEFAULT '',
    "weight" DOUBLE PRECISION,
    "size" TEXT NOT NULL DEFAULT '',
    "primaryColor" TEXT NOT NULL DEFAULT '',
    "secondaryColors" TEXT NOT NULL DEFAULT '',
    "distinctiveMarks" TEXT NOT NULL DEFAULT '',
    "microchipNumber" TEXT NOT NULL DEFAULT '',
    "tagNumber" TEXT NOT NULL DEFAULT '',
    "collarNumber" TEXT NOT NULL DEFAULT '',
    "qrCode" TEXT NOT NULL DEFAULT '',
    "reportId" TEXT,
    "missionId" TEXT,
    "captureDate" TIMESTAMP(3),
    "captureTime" TEXT,
    "captureLocation" TEXT NOT NULL DEFAULT '',
    "captureQuartier" TEXT NOT NULL DEFAULT '',
    "captureLatitude" DOUBLE PRECISION,
    "captureLongitude" DOUBLE PRECISION,
    "capturedBy" TEXT NOT NULL DEFAULT '',
    "captureState" TEXT NOT NULL DEFAULT '',
    "hasParasites" BOOLEAN NOT NULL DEFAULT false,
    "diseaseSuspect" BOOLEAN NOT NULL DEFAULT false,
    "captureNotes" TEXT NOT NULL DEFAULT '',
    "statut" TEXT NOT NULL DEFAULT 'CAPTURE',
    "commune" TEXT NOT NULL DEFAULT '',
    "shelterName" TEXT NOT NULL DEFAULT '',
    "boxOrCage" TEXT NOT NULL DEFAULT '',
    "mainPhoto" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalPhoto" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "size" INTEGER NOT NULL DEFAULT 0,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrayAnimalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalStatus" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "changedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrayAnimalStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CsvrSettings" (
    "id" TEXT NOT NULL,
    "commune" TEXT NOT NULL,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CsvrSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'REFUGE',
    "commune" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "responsible" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalAdmission" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "centerId" TEXT NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),
    "boxOrZone" TEXT NOT NULL DEFAULT '',
    "generalCondition" TEXT NOT NULL DEFAULT '',
    "weight" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "observation" TEXT NOT NULL DEFAULT '',
    "agent" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalAdmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalTransport" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "departureTime" TEXT NOT NULL DEFAULT '',
    "arrivalDate" TIMESTAMP(3),
    "arrivalTime" TEXT NOT NULL DEFAULT '',
    "vehicle" TEXT NOT NULL DEFAULT '',
    "driver" TEXT NOT NULL DEFAULT '',
    "agent" TEXT NOT NULL DEFAULT '',
    "destination" TEXT NOT NULL DEFAULT '',
    "animalCount" INTEGER NOT NULL DEFAULT 1,
    "incident" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalTransport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalHealthAlert" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'RAGE_SUSPECT',
    "urgency" TEXT NOT NULL DEFAULT 'URGENT',
    "clinicalSuspicion" BOOLEAN NOT NULL DEFAULT false,
    "vaccinationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "measureTaken" TEXT NOT NULL DEFAULT '',
    "healthServiceInformed" BOOLEAN NOT NULL DEFAULT false,
    "authorityInformed" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalHealthAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalDeathReport" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "species" TEXT NOT NULL DEFAULT 'DOG',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "apparentCause" TEXT NOT NULL DEFAULT '',
    "accident" BOOLEAN NOT NULL DEFAULT false,
    "healthSuspicion" BOOLEAN NOT NULL DEFAULT false,
    "removalDate" TIMESTAMP(3),
    "team" TEXT NOT NULL DEFAULT '',
    "destination" TEXT NOT NULL DEFAULT '',
    "handlingMode" TEXT NOT NULL DEFAULT '',
    "observations" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalDeathReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalHotspot" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "priority" TEXT NOT NULL DEFAULT 'MODERATE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "groupCount" INTEGER NOT NULL DEFAULT 0,
    "biteCount" INTEGER NOT NULL DEFAULT 0,
    "interventionCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewDate" TIMESTAMP(3),
    "nextReviewDate" TIMESTAMP(3),
    "resolutionNotes" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalHotspot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayPartner" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "commune" TEXT NOT NULL DEFAULT '',
    "contact" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalIdentification" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MICROCHIP',
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operator" TEXT NOT NULL DEFAULT '',
    "photo" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrayAnimalIdentification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayCampaign" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'CAPTURE',
    "name" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "zone" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT NOT NULL DEFAULT '',
    "partners" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "indicator" TEXT NOT NULL DEFAULT '',
    "quantitativeTarget" INTEGER NOT NULL DEFAULT 0,
    "achieved" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayCampaignActivity" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'RESULT',
    "zone" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "staff" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrayCampaignActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalCareEvent" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'EXAMINATION',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "practitioner" TEXT NOT NULL DEFAULT '',
    "facility" TEXT NOT NULL DEFAULT '',
    "weight" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "generalCondition" TEXT NOT NULL DEFAULT '',
    "diagnosis" TEXT NOT NULL DEFAULT '',
    "treatment" TEXT NOT NULL DEFAULT '',
    "vaccineName" TEXT NOT NULL DEFAULT '',
    "vaccineLot" TEXT NOT NULL DEFAULT '',
    "vaccineExpiryDate" TIMESTAMP(3),
    "dose" TEXT NOT NULL DEFAULT '',
    "surgeryType" TEXT NOT NULL DEFAULT '',
    "postoperativeNotes" TEXT NOT NULL DEFAULT '',
    "nextDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalCareEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalDestination" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'RETURN',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time" TEXT NOT NULL DEFAULT '',
    "site" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "structure" TEXT NOT NULL DEFAULT '',
    "adopterName" TEXT NOT NULL DEFAULT '',
    "adopterPhone" TEXT NOT NULL DEFAULT '',
    "adoptionDocument" TEXT NOT NULL DEFAULT '',
    "adoptionCommitment" BOOLEAN NOT NULL DEFAULT false,
    "vaccinationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "sterilizationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "identificationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StrayAnimalDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StrayAnimalFollowUp" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "destinationId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'POST_ADOPTION',
    "scheduledDate" TIMESTAMP(3),
    "visitDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "contactName" TEXT NOT NULL DEFAULT '',
    "contactPhone" TEXT NOT NULL DEFAULT '',
    "welfareStatus" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StrayAnimalFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodReport" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "declarantName" TEXT NOT NULL DEFAULT '',
    "declarantPhone" TEXT NOT NULL DEFAULT '',
    "declarantEmail" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "reportType" TEXT NOT NULL DEFAULT 'RESTAURANT',
    "establishmentName" TEXT NOT NULL DEFAULT '',
    "establishmentType" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "statut" TEXT NOT NULL DEFAULT 'NOUVEAU',
    "observations" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodReportPhoto" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL DEFAULT '',
    "mimeType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "size" INTEGER NOT NULL DEFAULT 0,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodReportPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "office" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "assignedToName" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "interventionId" TEXT,
    "complaintId" TEXT,
    "workOrderId" TEXT,
    "strayReportId" TEXT,
    "foodReportId" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdByName" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DossierEvent" (
    "id" TEXT NOT NULL,
    "dossierId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL DEFAULT 'STATUS_CHANGE',
    "reason" TEXT NOT NULL DEFAULT '',
    "changedBy" TEXT NOT NULL DEFAULT '',
    "changedByName" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DossierEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Establishment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "activity" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "ownerName" TEXT NOT NULL DEFAULT '',
    "ownerCin" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "authorizationNumber" TEXT NOT NULL DEFAULT '',
    "authorizationDate" TIMESTAMP(3),
    "openingDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "riskCategory" TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Establishment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inspection" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PERIODIC',
    "commune" TEXT NOT NULL DEFAULT '',
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorName" TEXT NOT NULL DEFAULT '',
    "inspectorId" TEXT NOT NULL DEFAULT '',
    "overallResult" TEXT NOT NULL DEFAULT 'PENDING',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "checklistJson" TEXT NOT NULL DEFAULT '{}',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "foodReportId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'MINOR',
    "weight" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrectiveAction" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT NOT NULL DEFAULT '',
    "deadline" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorrectiveAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CounterVisit" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "visitorName" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "findingsResolved" TEXT NOT NULL DEFAULT '0',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CounterVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCard" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "workerName" TEXT NOT NULL DEFAULT '',
    "workerCin" TEXT NOT NULL DEFAULT '',
    "establishmentId" TEXT,
    "occupation" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "cardNumber" TEXT NOT NULL DEFAULT '',
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "examinationDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'VALID',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sample" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "establishmentId" TEXT,
    "inspectionId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL DEFAULT '',
    "sampleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION,
    "collectorName" TEXT NOT NULL DEFAULT '',
    "laboratory" TEXT NOT NULL DEFAULT '',
    "requestedTests" TEXT NOT NULL DEFAULT '',
    "resultsJson" TEXT NOT NULL DEFAULT '{}',
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemperatureLog" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "equipmentType" TEXT NOT NULL DEFAULT 'REFRIGERATOR',
    "equipmentName" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL DEFAULT '',
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "temperature" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT '°C',
    "referenceMin" DOUBLE PRECISION,
    "referenceMax" DOUBLE PRECISION,
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "deviceCode" TEXT NOT NULL DEFAULT '',
    "agentName" TEXT NOT NULL DEFAULT '',
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemperatureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodProduct" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "brand" TEXT NOT NULL DEFAULT '',
    "lot" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "openingDate" TIMESTAMP(3),
    "preparationDate" TIMESTAMP(3),
    "quantity" DOUBLE PRECISION,
    "unit" TEXT NOT NULL DEFAULT '',
    "storage" TEXT NOT NULL DEFAULT '',
    "packagingCondition" TEXT NOT NULL DEFAULT '',
    "labelingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "traceabilityStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "observedTemperature" DOUBLE PRECISION,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabResult" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "establishmentId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "laboratory" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3),
    "analyzedAt" TIMESTAMP(3),
    "parameter" TEXT NOT NULL DEFAULT '',
    "resultValue" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "method" TEXT NOT NULL DEFAULT '',
    "referenceValue" TEXT NOT NULL DEFAULT '',
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodNonConformity" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'MINOR',
    "evidenceJson" TEXT NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "deadline" TIMESTAMP(3),
    "responsible" TEXT NOT NULL DEFAULT '',
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodNonConformity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FryingOilCheck" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "establishmentId" TEXT NOT NULL,
    "inspectionId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "fryerName" TEXT NOT NULL DEFAULT '',
    "oilType" TEXT NOT NULL DEFAULT '',
    "firstUseDate" TIMESTAMP(3),
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appearance" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '',
    "odor" TEXT NOT NULL DEFAULT '',
    "foam" TEXT NOT NULL DEFAULT '',
    "residues" TEXT NOT NULL DEFAULT '',
    "useTemperature" DOUBLE PRECISION,
    "tpmValue" DOUBLE PRECISION,
    "deviceCode" TEXT NOT NULL DEFAULT '',
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "changeDate" TIMESTAMP(3),
    "removedQuantity" DOUBLE PRECISION,
    "newQuantity" DOUBLE PRECISION,
    "disposalMethod" TEXT NOT NULL DEFAULT '',
    "collector" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FryingOilCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterPoint" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'NETWORK',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "operator" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterMeasurement" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "waterPointId" TEXT NOT NULL,
    "sampleId" TEXT,
    "deviceId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "sampleNumber" TEXT NOT NULL DEFAULT '',
    "measurementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "chlorineResidual" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "turbidity" DOUBLE PRECISION,
    "conductivity" DOUBLE PRECISION,
    "labTestsJson" TEXT NOT NULL DEFAULT '{}',
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "collectorName" TEXT NOT NULL DEFAULT '',
    "laboratory" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'SWIMMING',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "operator" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "waterType" TEXT NOT NULL DEFAULT 'TREATED',
    "lastPh" DOUBLE PRECISION,
    "lastChlorine" DOUBLE PRECISION,
    "lastInspection" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanitationIncident" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'BLOCKAGE',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT NOT NULL DEFAULT '',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "declarantName" TEXT NOT NULL DEFAULT '',
    "declarantPhone" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "resolution" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SanitationIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanitationAsset" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'DRAIN',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "operator" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "capacity" DOUBLE PRECISION,
    "capacityUnit" TEXT NOT NULL DEFAULT 'm³/j',
    "lastMaintenanceAt" TIMESTAMP(3),
    "nextMaintenanceAt" TIMESTAMP(3),
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SanitationAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterEmergencyPlan" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "planType" TEXT NOT NULL DEFAULT 'CONTAMINATION',
    "trigger" TEXT NOT NULL DEFAULT '',
    "riskLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "responsible" TEXT NOT NULL DEFAULT '',
    "alternativeSource" TEXT NOT NULL DEFAULT '',
    "activatedAt" TIMESTAMP(3),
    "targetCloseAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "measures" TEXT NOT NULL DEFAULT '',
    "communicationNote" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterEmergencyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterIncident" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "incidentType" TEXT NOT NULL DEFAULT 'OUTAGE',
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "description" TEXT NOT NULL DEFAULT '',
    "affectedPopulation" INTEGER NOT NULL DEFAULT 0,
    "affectedPoints" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "response" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterLaboratory" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "laboratoryType" TEXT NOT NULL DEFAULT 'PUBLIC',
    "accreditationStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "accreditationReference" TEXT NOT NULL DEFAULT '',
    "contactName" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "turnaroundDays" INTEGER NOT NULL DEFAULT 7,
    "parameters" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterLaboratory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterMonitoringProgram" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "programType" TEXT NOT NULL DEFAULT 'QUALITY',
    "objective" TEXT NOT NULL DEFAULT '',
    "targetArea" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT NOT NULL DEFAULT '',
    "team" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "frequencyDays" INTEGER,
    "targetCount" INTEGER,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterMonitoringProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterSample" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "waterPointId" TEXT,
    "poolId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "sampleType" TEXT NOT NULL DEFAULT 'DRINKING_WATER',
    "sampleDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sampleTime" TEXT NOT NULL DEFAULT '',
    "collectorName" TEXT NOT NULL DEFAULT '',
    "volumeMl" INTEGER,
    "containerType" TEXT NOT NULL DEFAULT '',
    "sterile" BOOLEAN NOT NULL DEFAULT false,
    "preservative" TEXT NOT NULL DEFAULT '',
    "transportTemperature" DOUBLE PRECISION,
    "departureAt" TIMESTAMP(3),
    "laboratoryArrivalAt" TIMESTAMP(3),
    "laboratory" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "requestedTests" TEXT NOT NULL DEFAULT '',
    "observation" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'COLLECTED',
    "laboratoryResult" TEXT NOT NULL DEFAULT '',
    "resultReceivedAt" TIMESTAMP(3),
    "validatedBy" TEXT NOT NULL DEFAULT '',
    "validatedAt" TIMESTAMP(3),
    "validationNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterSampleEvent" (
    "id" TEXT NOT NULL,
    "sampleId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL DEFAULT '',
    "actorName" TEXT NOT NULL DEFAULT '',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "WaterSampleEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterInspection" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "waterPointId" TEXT,
    "poolId" TEXT,
    "sampleId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorName" TEXT NOT NULL DEFAULT '',
    "checklistJson" TEXT NOT NULL DEFAULT '{}',
    "observation" TEXT NOT NULL DEFAULT '',
    "probability" INTEGER NOT NULL DEFAULT 1,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "conformity" TEXT NOT NULL DEFAULT 'PENDING',
    "correctiveAction" TEXT NOT NULL DEFAULT '',
    "followUpDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterAction" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "waterPointId" TEXT,
    "poolId" TEXT,
    "inspectionId" TEXT,
    "sampleId" TEXT,
    "sanitationIncidentId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "actionType" TEXT NOT NULL DEFAULT 'CONTROL',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "responsible" TEXT NOT NULL DEFAULT '',
    "plannedDate" TIMESTAMP(3),
    "executedDate" TIMESTAMP(3),
    "followUpDate" TIMESTAMP(3),
    "measures" TEXT NOT NULL DEFAULT '',
    "outcome" TEXT NOT NULL DEFAULT '',
    "observation" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterDisinfectionOperation" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "waterPointId" TEXT,
    "poolId" TEXT,
    "commune" TEXT NOT NULL DEFAULT '',
    "operationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "operationType" TEXT NOT NULL DEFAULT 'CHLORINATION',
    "productName" TEXT NOT NULL DEFAULT '',
    "activeSubstance" TEXT NOT NULL DEFAULT '',
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "doseValue" DOUBLE PRECISION,
    "doseUnit" TEXT NOT NULL DEFAULT 'mg/L',
    "treatedVolume" DOUBLE PRECISION,
    "volumeUnit" TEXT NOT NULL DEFAULT 'm³',
    "residualBefore" DOUBLE PRECISION,
    "residualAfter" DOUBLE PRECISION,
    "contactTimeMin" INTEGER,
    "operator" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "result" TEXT NOT NULL DEFAULT '',
    "observation" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterDisinfectionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterThreshold" (
    "id" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT 'ALL',
    "parameter" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT '',
    "minValue" DOUBLE PRECISION,
    "maxValue" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterDevice" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "waterPointId" TEXT,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'MULTIMETER',
    "serialNumber" TEXT NOT NULL DEFAULT '',
    "manufacturer" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "calibrationDueDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterDeviceCalibration" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "calibrationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextDueDate" TIMESTAMP(3),
    "performedBy" TEXT NOT NULL DEFAULT '',
    "certificateReference" TEXT NOT NULL DEFAULT '',
    "result" TEXT NOT NULL DEFAULT 'CONFORM',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaterDeviceCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PestProduct" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commercialName" TEXT NOT NULL DEFAULT '',
    "activeSubstance" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'INSECTICIDE',
    "formulation" TEXT NOT NULL DEFAULT '',
    "concentration" TEXT NOT NULL DEFAULT '',
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'LITRE',
    "quantityStock" INTEGER NOT NULL DEFAULT 0,
    "thresholdAlert" INTEGER NOT NULL DEFAULT 10,
    "expiryDate" TIMESTAMP(3),
    "target" TEXT NOT NULL DEFAULT '',
    "supplier" TEXT NOT NULL DEFAULT '',
    "unitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "commune" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "imagePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PestProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PestStockMovement" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "interventionRef" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PestStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiteCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "victimName" TEXT NOT NULL DEFAULT '',
    "victimAge" INTEGER,
    "victimGender" TEXT NOT NULL DEFAULT '',
    "victimPhone" TEXT NOT NULL DEFAULT '',
    "victimCin" TEXT NOT NULL DEFAULT '',
    "victimRegistrationNumber" TEXT NOT NULL DEFAULT '',
    "victimAddress" TEXT NOT NULL DEFAULT '',
    "guardianName" TEXT NOT NULL DEFAULT '',
    "guardianPhone" TEXT NOT NULL DEFAULT '',
    "declarantName" TEXT NOT NULL DEFAULT '',
    "declarantPhone" TEXT NOT NULL DEFAULT '',
    "animalType" TEXT NOT NULL DEFAULT 'DOG',
    "animalStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "animalDescription" TEXT NOT NULL DEFAULT '',
    "biteDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "biteLocation" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "biteSite" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "medicalFacility" TEXT NOT NULL DEFAULT '',
    "medicalReferralDate" TIMESTAMP(3),
    "exposureCategory" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "woundWashConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "woundWashDate" TIMESTAMP(3),
    "woundCareNotes" TEXT NOT NULL DEFAULT '',
    "vaccineType" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "vaccineRoute" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "pepProtocol" TEXT NOT NULL DEFAULT 'PENDING_ASSESSMENT',
    "rigIndicated" BOOLEAN NOT NULL DEFAULT false,
    "rigAdministered" BOOLEAN NOT NULL DEFAULT false,
    "rigType" TEXT NOT NULL DEFAULT '',
    "rigDate" TIMESTAMP(3),
    "vaccinationNotes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "reportingDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUpNotes" TEXT NOT NULL DEFAULT '',
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "strayReportId" TEXT,
    "animalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiteCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BiteVaccinationStep" (
    "id" TEXT NOT NULL,
    "biteCaseId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "scheduledDate" TIMESTAMP(3),
    "administeredDate" TIMESTAMP(3),
    "vaccineType" TEXT NOT NULL DEFAULT '',
    "route" TEXT NOT NULL DEFAULT '',
    "lotNumber" TEXT NOT NULL DEFAULT '',
    "facility" TEXT NOT NULL DEFAULT '',
    "administeredBy" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BiteVaccinationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeathCase" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "deceasedName" TEXT NOT NULL DEFAULT '',
    "deceasedCin" TEXT NOT NULL DEFAULT '',
    "deceasedAge" INTEGER,
    "deceasedGender" TEXT NOT NULL DEFAULT '',
    "deathDate" TIMESTAMP(3),
    "deathCause" TEXT NOT NULL DEFAULT '',
    "deathPlace" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "morgueStatus" TEXT NOT NULL DEFAULT 'NONE',
    "morgueAdmissionDate" TIMESTAMP(3),
    "morgueReleaseDate" TIMESTAMP(3),
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "declarantName" TEXT NOT NULL DEFAULT '',
    "declarantPhone" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "burialId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeathCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BurialDossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "deceasedName" TEXT NOT NULL DEFAULT '',
    "deceasedCin" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "cemeteryId" TEXT,
    "plotSection" TEXT NOT NULL DEFAULT '',
    "burialDate" TIMESTAMP(3),
    "authorizationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "authorizedBy" TEXT NOT NULL DEFAULT '',
    "authorizedAt" TIMESTAMP(3),
    "legalReference" TEXT NOT NULL DEFAULT '',
    "competentAuthority" TEXT NOT NULL DEFAULT '',
    "deathCaseId" TEXT,
    "officiantName" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BurialDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cemetery" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'MUSLIM',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "capacity" INTEGER NOT NULL DEFAULT 0,
    "occupied" INTEGER NOT NULL DEFAULT 0,
    "sectionsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cemetery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorpseTransport" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "deceasedName" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "originPlace" TEXT NOT NULL DEFAULT '',
    "destinationPlace" TEXT NOT NULL DEFAULT '',
    "transportDate" TIMESTAMP(3),
    "vehiclePlate" TEXT NOT NULL DEFAULT '',
    "driverName" TEXT NOT NULL DEFAULT '',
    "driverPhone" TEXT NOT NULL DEFAULT '',
    "authorizationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "authorizedBy" TEXT NOT NULL DEFAULT '',
    "authorizedAt" TIMESTAMP(3),
    "legalReference" TEXT NOT NULL DEFAULT '',
    "deathCaseId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorpseTransport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExhumationDossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "deceasedName" TEXT NOT NULL DEFAULT '',
    "deceasedCin" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "cemeteryId" TEXT,
    "plotSection" TEXT NOT NULL DEFAULT '',
    "originalBurialDate" TIMESTAMP(3),
    "exhumationDate" TIMESTAMP(3),
    "reason" TEXT NOT NULL DEFAULT '',
    "newDestination" TEXT NOT NULL DEFAULT '',
    "authorizationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "authorizedBy" TEXT NOT NULL DEFAULT '',
    "authorizedAt" TIMESTAMP(3),
    "legalReference" TEXT NOT NULL DEFAULT '',
    "competentAuthority" TEXT NOT NULL DEFAULT '',
    "requesterName" TEXT NOT NULL DEFAULT '',
    "requesterCin" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExhumationDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalDossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT NOT NULL DEFAULT '',
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "probability" INTEGER NOT NULL DEFAULT 1,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "priority" TEXT NOT NULL DEFAULT 'NORMALE',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedTo" TEXT NOT NULL DEFAULT '',
    "company" TEXT NOT NULL DEFAULT '',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "probableSource" TEXT NOT NULL DEFAULT '',
    "extent" TEXT NOT NULL DEFAULT '',
    "exposedPopulation" INTEGER NOT NULL DEFAULT 0,
    "milieu" TEXT NOT NULL DEFAULT '',
    "servicesConcerned" TEXT NOT NULL DEFAULT '[]',
    "legalReference" TEXT NOT NULL DEFAULT '',
    "measuresTaken" TEXT NOT NULL DEFAULT '',
    "dueDate" TIMESTAMP(3),
    "inspectionDate" TIMESTAMP(3),
    "nextFollowUpDate" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "unifiedDossierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalInspection" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "environmentalDossierId" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorName" TEXT NOT NULL DEFAULT '',
    "observation" TEXT NOT NULL DEFAULT '',
    "probableSource" TEXT NOT NULL DEFAULT '',
    "extent" TEXT NOT NULL DEFAULT '',
    "exposedPopulation" INTEGER NOT NULL DEFAULT 0,
    "milieu" TEXT NOT NULL DEFAULT '',
    "probability" INTEGER NOT NULL DEFAULT 1,
    "severity" INTEGER NOT NULL DEFAULT 1,
    "riskScore" INTEGER NOT NULL DEFAULT 1,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "resolution" TEXT NOT NULL DEFAULT 'PENDING',
    "nextAction" TEXT NOT NULL DEFAULT '',
    "nextFollowUpDate" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalFollowUp" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "environmentalDossierId" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "followUpDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeName" TEXT NOT NULL DEFAULT '',
    "currentStatus" TEXT NOT NULL DEFAULT '',
    "damageRemoved" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT NOT NULL DEFAULT '',
    "nextAction" TEXT NOT NULL DEFAULT '',
    "nextFollowUpDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalProgram" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "operation" TEXT NOT NULL,
    "axis" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "environmentalDossierId" TEXT,
    "quartier" TEXT NOT NULL DEFAULT '',
    "objective" TEXT NOT NULL DEFAULT '',
    "responsible" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "indicator" TEXT NOT NULL DEFAULT '',
    "quantitativeTarget" INTEGER NOT NULL DEFAULT 0,
    "achieved" INTEGER NOT NULL DEFAULT 0,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentalProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalDossierDocument" (
    "id" TEXT NOT NULL,
    "environmentalDossierId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalDossierDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentalEvidence" (
    "id" TEXT NOT NULL,
    "environmentalDossierId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'INSPECTION',
    "mimeType" TEXT NOT NULL DEFAULT '',
    "originalName" TEXT NOT NULL DEFAULT '',
    "uploadedBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnvironmentalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollutionIncident" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'AIR',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "declarantName" TEXT NOT NULL DEFAULT '',
    "declarantPhone" TEXT NOT NULL DEFAULT '',
    "pollutantName" TEXT NOT NULL DEFAULT '',
    "severity" TEXT NOT NULL DEFAULT 'LOW',
    "company" TEXT NOT NULL DEFAULT '',
    "environmentalDossierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "mitigation" TEXT NOT NULL DEFAULT '',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollutionIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WasteBlackSpot" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "description" TEXT NOT NULL DEFAULT '',
    "wasteType" TEXT NOT NULL DEFAULT 'MIXED',
    "recurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'INTERNAL',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastCleanedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "environmentalDossierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WasteBlackSpot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NaturalSite" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'FOREST',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "area" DOUBLE PRECISION,
    "description" TEXT NOT NULL DEFAULT '',
    "protectionLevel" TEXT NOT NULL DEFAULT 'NONE',
    "status" TEXT NOT NULL DEFAULT 'INTACT',
    "threats" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "environmentalDossierId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NaturalSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AwarenessCampaign" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'GENERAL',
    "commune" TEXT NOT NULL DEFAULT '',
    "environmentalDossierId" TEXT,
    "environmentalProgramId" TEXT,
    "description" TEXT NOT NULL DEFAULT '',
    "targetAudience" TEXT NOT NULL DEFAULT '',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "budget" DOUBLE PRECISION,
    "participantsCount" INTEGER NOT NULL DEFAULT 0,
    "organizerName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "outcomes" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AwarenessCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthorizationDossier" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL DEFAULT '',
    "applicantCin" TEXT NOT NULL DEFAULT '',
    "applicantPhone" TEXT NOT NULL DEFAULT '',
    "establishmentName" TEXT NOT NULL DEFAULT '',
    "activity" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "quartier" TEXT NOT NULL DEFAULT '',
    "adresse" TEXT NOT NULL DEFAULT '',
    "requestType" TEXT NOT NULL DEFAULT 'COMMERCIAL',
    "rokhasReference" TEXT NOT NULL DEFAULT '',
    "opinionStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "opinionDate" TIMESTAMP(3),
    "opinionNotes" TEXT NOT NULL DEFAULT '',
    "reservations" TEXT NOT NULL DEFAULT '',
    "competentAuthority" TEXT NOT NULL DEFAULT '',
    "legalReference" TEXT NOT NULL DEFAULT '',
    "authorizedBy" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "checklistJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorizationDossier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SanitaryOpinion" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dossierId" TEXT,
    "establishmentName" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "opinionType" TEXT NOT NULL DEFAULT 'COMMERCIAL',
    "result" TEXT NOT NULL DEFAULT 'PENDING',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspectorName" TEXT NOT NULL DEFAULT '',
    "observations" TEXT NOT NULL DEFAULT '',
    "reservations" TEXT NOT NULL DEFAULT '',
    "correctiveActions" TEXT NOT NULL DEFAULT '',
    "recommendation" TEXT NOT NULL DEFAULT '',
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "validatedBy" TEXT NOT NULL DEFAULT '',
    "validatedAt" TIMESTAMP(3),
    "legalReference" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SanitaryOpinion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeVisit" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "dossierId" TEXT,
    "establishmentName" TEXT NOT NULL DEFAULT '',
    "commune" TEXT NOT NULL DEFAULT '',
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantsJson" TEXT NOT NULL DEFAULT '[]',
    "inspectionNotes" TEXT NOT NULL DEFAULT '',
    "findingsJson" TEXT NOT NULL DEFAULT '[]',
    "recommendation" TEXT NOT NULL DEFAULT 'PENDING',
    "reservations" TEXT NOT NULL DEFAULT '',
    "correctiveActions" TEXT NOT NULL DEFAULT '',
    "validationStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "validatedBy" TEXT NOT NULL DEFAULT '',
    "validatedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Intervention_reference_key" ON "Intervention"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Campagne_reference_key" ON "Campagne"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Quartier_nom_commune_key" ON "Quartier"("nom", "commune");

-- CreateIndex
CREATE UNIQUE INDEX "Product_reference_key" ON "Product"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_key_key" ON "ProductCategory"("key");

-- CreateIndex
CREATE INDEX "ProductCategory_commune_idx" ON "ProductCategory"("commune");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_label_commune_key" ON "ProductCategory"("label", "commune");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionMaterial_interventionId_productId_key" ON "InterventionMaterial"("interventionId", "productId");

-- CreateIndex
CREATE INDEX "Agent_commune_teamId_idx" ON "Agent"("commune", "teamId");

-- CreateIndex
CREATE INDEX "Team_commune_office_idx" ON "Team"("commune", "office");

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_commune_key" ON "Team"("name", "commune");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_agentId_key" ON "User"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CommuneSettings_commune_key" ON "CommuneSettings"("commune");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_key_key" ON "DocumentCategory"("key");

-- CreateIndex
CREATE INDEX "DocumentCategory_commune_idx" ON "DocumentCategory"("commune");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentCategory_label_commune_key" ON "DocumentCategory"("label", "commune");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionDocument_interventionId_documentId_key" ON "InterventionDocument"("interventionId", "documentId");

-- CreateIndex
CREATE UNIQUE INDEX "Complaint_reference_key" ON "Complaint"("reference");

-- CreateIndex
CREATE INDEX "ComplaintContact_complaintId_contactedAt_idx" ON "ComplaintContact"("complaintId", "contactedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_reference_key" ON "WorkOrder"("reference");

-- CreateIndex
CREATE INDEX "WorkOrder_commune_status_idx" ON "WorkOrder"("commune", "status");

-- CreateIndex
CREATE INDEX "WorkOrder_assignedAgentId_status_idx" ON "WorkOrder"("assignedAgentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrderPhoto_storedFileName_key" ON "WorkOrderPhoto"("storedFileName");

-- CreateIndex
CREATE INDEX "WorkOrderPhoto_workOrderId_type_idx" ON "WorkOrderPhoto"("workOrderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StrayReport_reference_key" ON "StrayReport"("reference");

-- CreateIndex
CREATE INDEX "StrayReport_commune_statut_idx" ON "StrayReport"("commune", "statut");

-- CreateIndex
CREATE INDEX "StrayReport_commune_priority_idx" ON "StrayReport"("commune", "priority");

-- CreateIndex
CREATE INDEX "StrayReport_species_idx" ON "StrayReport"("species");

-- CreateIndex
CREATE UNIQUE INDEX "StrayReportPhoto_storedFileName_key" ON "StrayReportPhoto"("storedFileName");

-- CreateIndex
CREATE INDEX "StrayReportPhoto_reportId_idx" ON "StrayReportPhoto"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureMission_reference_key" ON "CaptureMission"("reference");

-- CreateIndex
CREATE INDEX "CaptureMission_commune_statut_idx" ON "CaptureMission"("commune", "statut");

-- CreateIndex
CREATE INDEX "CaptureMission_scheduledAt_idx" ON "CaptureMission"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CaptureMissionPhoto_storedFileName_key" ON "CaptureMissionPhoto"("storedFileName");

-- CreateIndex
CREATE INDEX "CaptureMissionPhoto_missionId_type_idx" ON "CaptureMissionPhoto"("missionId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "StrayAnimal_csvrNumber_key" ON "StrayAnimal"("csvrNumber");

-- CreateIndex
CREATE INDEX "StrayAnimal_commune_statut_idx" ON "StrayAnimal"("commune", "statut");

-- CreateIndex
CREATE INDEX "StrayAnimal_species_idx" ON "StrayAnimal"("species");

-- CreateIndex
CREATE INDEX "StrayAnimal_csvrNumber_idx" ON "StrayAnimal"("csvrNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StrayAnimalPhoto_storedFileName_key" ON "StrayAnimalPhoto"("storedFileName");

-- CreateIndex
CREATE INDEX "StrayAnimalPhoto_animalId_idx" ON "StrayAnimalPhoto"("animalId");

-- CreateIndex
CREATE INDEX "StrayAnimalStatus_animalId_createdAt_idx" ON "StrayAnimalStatus"("animalId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CsvrSettings_commune_key" ON "CsvrSettings"("commune");

-- CreateIndex
CREATE INDEX "StrayAnimalCenter_commune_status_idx" ON "StrayAnimalCenter"("commune", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StrayAnimalCenter_name_commune_key" ON "StrayAnimalCenter"("name", "commune");

-- CreateIndex
CREATE INDEX "StrayAnimalAdmission_animalId_admittedAt_idx" ON "StrayAnimalAdmission"("animalId", "admittedAt");

-- CreateIndex
CREATE INDEX "StrayAnimalAdmission_centerId_releasedAt_idx" ON "StrayAnimalAdmission"("centerId", "releasedAt");

-- CreateIndex
CREATE INDEX "StrayAnimalTransport_animalId_departureDate_idx" ON "StrayAnimalTransport"("animalId", "departureDate");

-- CreateIndex
CREATE INDEX "StrayAnimalTransport_destination_departureDate_idx" ON "StrayAnimalTransport"("destination", "departureDate");

-- CreateIndex
CREATE INDEX "StrayAnimalHealthAlert_animalId_reportedAt_idx" ON "StrayAnimalHealthAlert"("animalId", "reportedAt");

-- CreateIndex
CREATE INDEX "StrayAnimalHealthAlert_type_urgency_resolvedAt_idx" ON "StrayAnimalHealthAlert"("type", "urgency", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StrayAnimalDeathReport_reference_key" ON "StrayAnimalDeathReport"("reference");

-- CreateIndex
CREATE INDEX "StrayAnimalDeathReport_commune_reportedAt_idx" ON "StrayAnimalDeathReport"("commune", "reportedAt");

-- CreateIndex
CREATE INDEX "StrayAnimalDeathReport_healthSuspicion_removalDate_idx" ON "StrayAnimalDeathReport"("healthSuspicion", "removalDate");

-- CreateIndex
CREATE UNIQUE INDEX "StrayAnimalHotspot_reference_key" ON "StrayAnimalHotspot"("reference");

-- CreateIndex
CREATE INDEX "StrayAnimalHotspot_commune_status_priority_idx" ON "StrayAnimalHotspot"("commune", "status", "priority");

-- CreateIndex
CREATE INDEX "StrayAnimalHotspot_nextReviewDate_idx" ON "StrayAnimalHotspot"("nextReviewDate");

-- CreateIndex
CREATE INDEX "StrayPartner_commune_type_status_idx" ON "StrayPartner"("commune", "type", "status");

-- CreateIndex
CREATE UNIQUE INDEX "StrayPartner_name_commune_key" ON "StrayPartner"("name", "commune");

-- CreateIndex
CREATE INDEX "StrayAnimalIdentification_animalId_date_idx" ON "StrayAnimalIdentification"("animalId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StrayAnimalIdentification_type_number_key" ON "StrayAnimalIdentification"("type", "number");

-- CreateIndex
CREATE UNIQUE INDEX "StrayCampaign_reference_key" ON "StrayCampaign"("reference");

-- CreateIndex
CREATE INDEX "StrayCampaign_commune_year_status_idx" ON "StrayCampaign"("commune", "year", "status");

-- CreateIndex
CREATE INDEX "StrayCampaign_startDate_idx" ON "StrayCampaign"("startDate");

-- CreateIndex
CREATE INDEX "StrayCampaignActivity_campaignId_date_idx" ON "StrayCampaignActivity"("campaignId", "date");

-- CreateIndex
CREATE INDEX "StrayCampaignActivity_type_date_idx" ON "StrayCampaignActivity"("type", "date");

-- CreateIndex
CREATE INDEX "StrayAnimalCareEvent_animalId_type_date_idx" ON "StrayAnimalCareEvent"("animalId", "type", "date");

-- CreateIndex
CREATE INDEX "StrayAnimalCareEvent_date_idx" ON "StrayAnimalCareEvent"("date");

-- CreateIndex
CREATE INDEX "StrayAnimalDestination_animalId_type_date_idx" ON "StrayAnimalDestination"("animalId", "type", "date");

-- CreateIndex
CREATE INDEX "StrayAnimalDestination_commune_type_idx" ON "StrayAnimalDestination"("commune", "type");

-- CreateIndex
CREATE INDEX "StrayAnimalFollowUp_animalId_type_status_idx" ON "StrayAnimalFollowUp"("animalId", "type", "status");

-- CreateIndex
CREATE INDEX "StrayAnimalFollowUp_scheduledDate_status_idx" ON "StrayAnimalFollowUp"("scheduledDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FoodReport_reference_key" ON "FoodReport"("reference");

-- CreateIndex
CREATE INDEX "FoodReport_commune_statut_idx" ON "FoodReport"("commune", "statut");

-- CreateIndex
CREATE INDEX "FoodReport_commune_reportType_idx" ON "FoodReport"("commune", "reportType");

-- CreateIndex
CREATE INDEX "FoodReport_reportType_idx" ON "FoodReport"("reportType");

-- CreateIndex
CREATE UNIQUE INDEX "FoodReportPhoto_storedFileName_key" ON "FoodReportPhoto"("storedFileName");

-- CreateIndex
CREATE INDEX "FoodReportPhoto_reportId_idx" ON "FoodReportPhoto"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "Dossier_reference_key" ON "Dossier"("reference");

-- CreateIndex
CREATE INDEX "Dossier_commune_status_idx" ON "Dossier"("commune", "status");

-- CreateIndex
CREATE INDEX "Dossier_commune_office_idx" ON "Dossier"("commune", "office");

-- CreateIndex
CREATE INDEX "Dossier_commune_type_idx" ON "Dossier"("commune", "type");

-- CreateIndex
CREATE INDEX "Dossier_status_idx" ON "Dossier"("status");

-- CreateIndex
CREATE INDEX "Dossier_office_idx" ON "Dossier"("office");

-- CreateIndex
CREATE INDEX "Dossier_assignedTo_idx" ON "Dossier"("assignedTo");

-- CreateIndex
CREATE INDEX "DossierEvent_dossierId_idx" ON "DossierEvent"("dossierId");

-- CreateIndex
CREATE INDEX "DossierEvent_dossierId_createdAt_idx" ON "DossierEvent"("dossierId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Establishment_reference_key" ON "Establishment"("reference");

-- CreateIndex
CREATE INDEX "Establishment_commune_status_idx" ON "Establishment"("commune", "status");

-- CreateIndex
CREATE INDEX "Establishment_commune_riskCategory_idx" ON "Establishment"("commune", "riskCategory");

-- CreateIndex
CREATE INDEX "Establishment_commune_activity_idx" ON "Establishment"("commune", "activity");

-- CreateIndex
CREATE UNIQUE INDEX "Inspection_reference_key" ON "Inspection"("reference");

-- CreateIndex
CREATE INDEX "Inspection_establishmentId_idx" ON "Inspection"("establishmentId");

-- CreateIndex
CREATE INDEX "Inspection_commune_inspectionDate_idx" ON "Inspection"("commune", "inspectionDate");

-- CreateIndex
CREATE INDEX "Inspection_commune_overallResult_idx" ON "Inspection"("commune", "overallResult");

-- CreateIndex
CREATE INDEX "Finding_inspectionId_idx" ON "Finding"("inspectionId");

-- CreateIndex
CREATE INDEX "Finding_severity_idx" ON "Finding"("severity");

-- CreateIndex
CREATE INDEX "CorrectiveAction_inspectionId_idx" ON "CorrectiveAction"("inspectionId");

-- CreateIndex
CREATE INDEX "CorrectiveAction_status_idx" ON "CorrectiveAction"("status");

-- CreateIndex
CREATE INDEX "CounterVisit_inspectionId_idx" ON "CounterVisit"("inspectionId");

-- CreateIndex
CREATE UNIQUE INDEX "HealthCard_reference_key" ON "HealthCard"("reference");

-- CreateIndex
CREATE INDEX "HealthCard_establishmentId_idx" ON "HealthCard"("establishmentId");

-- CreateIndex
CREATE INDEX "HealthCard_commune_status_idx" ON "HealthCard"("commune", "status");

-- CreateIndex
CREATE INDEX "HealthCard_expiryDate_idx" ON "HealthCard"("expiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "Sample_reference_key" ON "Sample"("reference");

-- CreateIndex
CREATE INDEX "Sample_establishmentId_idx" ON "Sample"("establishmentId");

-- CreateIndex
CREATE INDEX "Sample_inspectionId_idx" ON "Sample"("inspectionId");

-- CreateIndex
CREATE INDEX "Sample_commune_conformity_idx" ON "Sample"("commune", "conformity");

-- CreateIndex
CREATE INDEX "Sample_sampleDate_idx" ON "Sample"("sampleDate");

-- CreateIndex
CREATE UNIQUE INDEX "TemperatureLog_reference_key" ON "TemperatureLog"("reference");

-- CreateIndex
CREATE INDEX "TemperatureLog_establishmentId_measuredAt_idx" ON "TemperatureLog"("establishmentId", "measuredAt");

-- CreateIndex
CREATE INDEX "TemperatureLog_inspectionId_idx" ON "TemperatureLog"("inspectionId");

-- CreateIndex
CREATE INDEX "TemperatureLog_commune_conformity_idx" ON "TemperatureLog"("commune", "conformity");

-- CreateIndex
CREATE UNIQUE INDEX "FoodProduct_reference_key" ON "FoodProduct"("reference");

-- CreateIndex
CREATE INDEX "FoodProduct_establishmentId_expiryDate_idx" ON "FoodProduct"("establishmentId", "expiryDate");

-- CreateIndex
CREATE INDEX "FoodProduct_inspectionId_idx" ON "FoodProduct"("inspectionId");

-- CreateIndex
CREATE INDEX "FoodProduct_commune_conformity_idx" ON "FoodProduct"("commune", "conformity");

-- CreateIndex
CREATE UNIQUE INDEX "LabResult_reference_key" ON "LabResult"("reference");

-- CreateIndex
CREATE INDEX "LabResult_sampleId_idx" ON "LabResult"("sampleId");

-- CreateIndex
CREATE INDEX "LabResult_establishmentId_conformity_idx" ON "LabResult"("establishmentId", "conformity");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNonConformity_reference_key" ON "FoodNonConformity"("reference");

-- CreateIndex
CREATE INDEX "FoodNonConformity_establishmentId_status_idx" ON "FoodNonConformity"("establishmentId", "status");

-- CreateIndex
CREATE INDEX "FoodNonConformity_inspectionId_idx" ON "FoodNonConformity"("inspectionId");

-- CreateIndex
CREATE INDEX "FoodNonConformity_commune_level_idx" ON "FoodNonConformity"("commune", "level");

-- CreateIndex
CREATE UNIQUE INDEX "FryingOilCheck_reference_key" ON "FryingOilCheck"("reference");

-- CreateIndex
CREATE INDEX "FryingOilCheck_establishmentId_checkedAt_idx" ON "FryingOilCheck"("establishmentId", "checkedAt");

-- CreateIndex
CREATE INDEX "FryingOilCheck_inspectionId_idx" ON "FryingOilCheck"("inspectionId");

-- CreateIndex
CREATE INDEX "FryingOilCheck_commune_conformity_idx" ON "FryingOilCheck"("commune", "conformity");

-- CreateIndex
CREATE UNIQUE INDEX "WaterPoint_reference_key" ON "WaterPoint"("reference");

-- CreateIndex
CREATE INDEX "WaterPoint_commune_type_idx" ON "WaterPoint"("commune", "type");

-- CreateIndex
CREATE INDEX "WaterPoint_commune_status_idx" ON "WaterPoint"("commune", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WaterMeasurement_reference_key" ON "WaterMeasurement"("reference");

-- CreateIndex
CREATE INDEX "WaterMeasurement_waterPointId_idx" ON "WaterMeasurement"("waterPointId");

-- CreateIndex
CREATE INDEX "WaterMeasurement_commune_conformity_idx" ON "WaterMeasurement"("commune", "conformity");

-- CreateIndex
CREATE INDEX "WaterMeasurement_measurementDate_idx" ON "WaterMeasurement"("measurementDate");

-- CreateIndex
CREATE INDEX "WaterMeasurement_sampleId_idx" ON "WaterMeasurement"("sampleId");

-- CreateIndex
CREATE INDEX "WaterMeasurement_deviceId_idx" ON "WaterMeasurement"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_reference_key" ON "Pool"("reference");

-- CreateIndex
CREATE INDEX "Pool_commune_type_idx" ON "Pool"("commune", "type");

-- CreateIndex
CREATE INDEX "Pool_commune_status_idx" ON "Pool"("commune", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SanitationIncident_reference_key" ON "SanitationIncident"("reference");

-- CreateIndex
CREATE INDEX "SanitationIncident_commune_status_idx" ON "SanitationIncident"("commune", "status");

-- CreateIndex
CREATE INDEX "SanitationIncident_commune_riskLevel_idx" ON "SanitationIncident"("commune", "riskLevel");

-- CreateIndex
CREATE INDEX "SanitationIncident_type_idx" ON "SanitationIncident"("type");

-- CreateIndex
CREATE UNIQUE INDEX "SanitationAsset_reference_key" ON "SanitationAsset"("reference");

-- CreateIndex
CREATE INDEX "SanitationAsset_commune_type_idx" ON "SanitationAsset"("commune", "type");

-- CreateIndex
CREATE INDEX "SanitationAsset_commune_status_idx" ON "SanitationAsset"("commune", "status");

-- CreateIndex
CREATE INDEX "SanitationAsset_nextMaintenanceAt_idx" ON "SanitationAsset"("nextMaintenanceAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaterEmergencyPlan_reference_key" ON "WaterEmergencyPlan"("reference");

-- CreateIndex
CREATE INDEX "WaterEmergencyPlan_commune_status_idx" ON "WaterEmergencyPlan"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterEmergencyPlan_commune_riskLevel_idx" ON "WaterEmergencyPlan"("commune", "riskLevel");

-- CreateIndex
CREATE INDEX "WaterEmergencyPlan_targetCloseAt_idx" ON "WaterEmergencyPlan"("targetCloseAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaterIncident_reference_key" ON "WaterIncident"("reference");

-- CreateIndex
CREATE INDEX "WaterIncident_commune_status_idx" ON "WaterIncident"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterIncident_commune_severity_idx" ON "WaterIncident"("commune", "severity");

-- CreateIndex
CREATE INDEX "WaterIncident_incidentType_idx" ON "WaterIncident"("incidentType");

-- CreateIndex
CREATE INDEX "WaterIncident_startedAt_idx" ON "WaterIncident"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaterLaboratory_reference_key" ON "WaterLaboratory"("reference");

-- CreateIndex
CREATE INDEX "WaterLaboratory_commune_active_idx" ON "WaterLaboratory"("commune", "active");

-- CreateIndex
CREATE INDEX "WaterLaboratory_commune_laboratoryType_idx" ON "WaterLaboratory"("commune", "laboratoryType");

-- CreateIndex
CREATE INDEX "WaterLaboratory_accreditationStatus_idx" ON "WaterLaboratory"("accreditationStatus");

-- CreateIndex
CREATE UNIQUE INDEX "WaterMonitoringProgram_reference_key" ON "WaterMonitoringProgram"("reference");

-- CreateIndex
CREATE INDEX "WaterMonitoringProgram_commune_status_idx" ON "WaterMonitoringProgram"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterMonitoringProgram_commune_startDate_idx" ON "WaterMonitoringProgram"("commune", "startDate");

-- CreateIndex
CREATE INDEX "WaterMonitoringProgram_endDate_idx" ON "WaterMonitoringProgram"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "WaterSample_reference_key" ON "WaterSample"("reference");

-- CreateIndex
CREATE INDEX "WaterSample_commune_status_idx" ON "WaterSample"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterSample_waterPointId_sampleDate_idx" ON "WaterSample"("waterPointId", "sampleDate");

-- CreateIndex
CREATE INDEX "WaterSample_poolId_sampleDate_idx" ON "WaterSample"("poolId", "sampleDate");

-- CreateIndex
CREATE INDEX "WaterSample_sampleDate_idx" ON "WaterSample"("sampleDate");

-- CreateIndex
CREATE INDEX "WaterSampleEvent_sampleId_occurredAt_idx" ON "WaterSampleEvent"("sampleId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaterInspection_reference_key" ON "WaterInspection"("reference");

-- CreateIndex
CREATE INDEX "WaterInspection_commune_inspectionDate_idx" ON "WaterInspection"("commune", "inspectionDate");

-- CreateIndex
CREATE INDEX "WaterInspection_commune_status_idx" ON "WaterInspection"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterInspection_waterPointId_inspectionDate_idx" ON "WaterInspection"("waterPointId", "inspectionDate");

-- CreateIndex
CREATE INDEX "WaterInspection_poolId_inspectionDate_idx" ON "WaterInspection"("poolId", "inspectionDate");

-- CreateIndex
CREATE INDEX "WaterInspection_sampleId_idx" ON "WaterInspection"("sampleId");

-- CreateIndex
CREATE UNIQUE INDEX "WaterAction_reference_key" ON "WaterAction"("reference");

-- CreateIndex
CREATE INDEX "WaterAction_commune_status_idx" ON "WaterAction"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterAction_commune_plannedDate_idx" ON "WaterAction"("commune", "plannedDate");

-- CreateIndex
CREATE INDEX "WaterAction_waterPointId_idx" ON "WaterAction"("waterPointId");

-- CreateIndex
CREATE INDEX "WaterAction_inspectionId_idx" ON "WaterAction"("inspectionId");

-- CreateIndex
CREATE INDEX "WaterAction_sanitationIncidentId_idx" ON "WaterAction"("sanitationIncidentId");

-- CreateIndex
CREATE UNIQUE INDEX "WaterDisinfectionOperation_reference_key" ON "WaterDisinfectionOperation"("reference");

-- CreateIndex
CREATE INDEX "WaterDisinfectionOperation_commune_operationDate_idx" ON "WaterDisinfectionOperation"("commune", "operationDate");

-- CreateIndex
CREATE INDEX "WaterDisinfectionOperation_commune_status_idx" ON "WaterDisinfectionOperation"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterDisinfectionOperation_waterPointId_idx" ON "WaterDisinfectionOperation"("waterPointId");

-- CreateIndex
CREATE INDEX "WaterDisinfectionOperation_poolId_idx" ON "WaterDisinfectionOperation"("poolId");

-- CreateIndex
CREATE INDEX "WaterThreshold_commune_active_idx" ON "WaterThreshold"("commune", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WaterThreshold_commune_parameter_key" ON "WaterThreshold"("commune", "parameter");

-- CreateIndex
CREATE UNIQUE INDEX "WaterDevice_reference_key" ON "WaterDevice"("reference");

-- CreateIndex
CREATE INDEX "WaterDevice_commune_status_idx" ON "WaterDevice"("commune", "status");

-- CreateIndex
CREATE INDEX "WaterDevice_calibrationDueDate_idx" ON "WaterDevice"("calibrationDueDate");

-- CreateIndex
CREATE INDEX "WaterDeviceCalibration_deviceId_calibrationDate_idx" ON "WaterDeviceCalibration"("deviceId", "calibrationDate");

-- CreateIndex
CREATE INDEX "WaterDeviceCalibration_nextDueDate_idx" ON "WaterDeviceCalibration"("nextDueDate");

-- CreateIndex
CREATE UNIQUE INDEX "PestProduct_reference_key" ON "PestProduct"("reference");

-- CreateIndex
CREATE INDEX "PestProduct_commune_category_idx" ON "PestProduct"("commune", "category");

-- CreateIndex
CREATE INDEX "PestProduct_expiryDate_idx" ON "PestProduct"("expiryDate");

-- CreateIndex
CREATE INDEX "PestStockMovement_productId_idx" ON "PestStockMovement"("productId");

-- CreateIndex
CREATE INDEX "PestStockMovement_commune_idx" ON "PestStockMovement"("commune");

-- CreateIndex
CREATE UNIQUE INDEX "BiteCase_reference_key" ON "BiteCase"("reference");

-- CreateIndex
CREATE INDEX "BiteCase_commune_status_idx" ON "BiteCase"("commune", "status");

-- CreateIndex
CREATE INDEX "BiteCase_commune_animalType_idx" ON "BiteCase"("commune", "animalType");

-- CreateIndex
CREATE INDEX "BiteCase_biteDate_idx" ON "BiteCase"("biteDate");

-- CreateIndex
CREATE INDEX "BiteCase_animalId_idx" ON "BiteCase"("animalId");

-- CreateIndex
CREATE INDEX "BiteVaccinationStep_biteCaseId_scheduledDate_idx" ON "BiteVaccinationStep"("biteCaseId", "scheduledDate");

-- CreateIndex
CREATE INDEX "BiteVaccinationStep_status_idx" ON "BiteVaccinationStep"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BiteVaccinationStep_biteCaseId_stepKey_key" ON "BiteVaccinationStep"("biteCaseId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "DeathCase_reference_key" ON "DeathCase"("reference");

-- CreateIndex
CREATE INDEX "DeathCase_commune_status_idx" ON "DeathCase"("commune", "status");

-- CreateIndex
CREATE INDEX "DeathCase_deathDate_idx" ON "DeathCase"("deathDate");

-- CreateIndex
CREATE UNIQUE INDEX "BurialDossier_reference_key" ON "BurialDossier"("reference");

-- CreateIndex
CREATE INDEX "BurialDossier_commune_status_idx" ON "BurialDossier"("commune", "status");

-- CreateIndex
CREATE INDEX "BurialDossier_cemeteryId_idx" ON "BurialDossier"("cemeteryId");

-- CreateIndex
CREATE UNIQUE INDEX "Cemetery_reference_key" ON "Cemetery"("reference");

-- CreateIndex
CREATE INDEX "Cemetery_commune_status_idx" ON "Cemetery"("commune", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CorpseTransport_reference_key" ON "CorpseTransport"("reference");

-- CreateIndex
CREATE INDEX "CorpseTransport_commune_status_idx" ON "CorpseTransport"("commune", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ExhumationDossier_reference_key" ON "ExhumationDossier"("reference");

-- CreateIndex
CREATE INDEX "ExhumationDossier_commune_status_idx" ON "ExhumationDossier"("commune", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalDossier_reference_key" ON "EnvironmentalDossier"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalDossier_unifiedDossierId_key" ON "EnvironmentalDossier"("unifiedDossierId");

-- CreateIndex
CREATE INDEX "EnvironmentalDossier_commune_status_idx" ON "EnvironmentalDossier"("commune", "status");

-- CreateIndex
CREATE INDEX "EnvironmentalDossier_commune_category_idx" ON "EnvironmentalDossier"("commune", "category");

-- CreateIndex
CREATE INDEX "EnvironmentalDossier_riskLevel_idx" ON "EnvironmentalDossier"("riskLevel");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalInspection_reference_key" ON "EnvironmentalInspection"("reference");

-- CreateIndex
CREATE INDEX "EnvironmentalInspection_commune_inspectionDate_idx" ON "EnvironmentalInspection"("commune", "inspectionDate");

-- CreateIndex
CREATE INDEX "EnvironmentalInspection_environmentalDossierId_inspectionDa_idx" ON "EnvironmentalInspection"("environmentalDossierId", "inspectionDate");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalFollowUp_reference_key" ON "EnvironmentalFollowUp"("reference");

-- CreateIndex
CREATE INDEX "EnvironmentalFollowUp_commune_followUpDate_idx" ON "EnvironmentalFollowUp"("commune", "followUpDate");

-- CreateIndex
CREATE INDEX "EnvironmentalFollowUp_environmentalDossierId_followUpDate_idx" ON "EnvironmentalFollowUp"("environmentalDossierId", "followUpDate");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalProgram_reference_key" ON "EnvironmentalProgram"("reference");

-- CreateIndex
CREATE INDEX "EnvironmentalProgram_commune_year_idx" ON "EnvironmentalProgram"("commune", "year");

-- CreateIndex
CREATE INDEX "EnvironmentalProgram_commune_status_idx" ON "EnvironmentalProgram"("commune", "status");

-- CreateIndex
CREATE INDEX "EnvironmentalProgram_environmentalDossierId_idx" ON "EnvironmentalProgram"("environmentalDossierId");

-- CreateIndex
CREATE INDEX "EnvironmentalDossierDocument_documentId_idx" ON "EnvironmentalDossierDocument"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentalDossierDocument_environmentalDossierId_documen_key" ON "EnvironmentalDossierDocument"("environmentalDossierId", "documentId");

-- CreateIndex
CREATE INDEX "EnvironmentalEvidence_environmentalDossierId_type_idx" ON "EnvironmentalEvidence"("environmentalDossierId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "PollutionIncident_reference_key" ON "PollutionIncident"("reference");

-- CreateIndex
CREATE INDEX "PollutionIncident_commune_status_idx" ON "PollutionIncident"("commune", "status");

-- CreateIndex
CREATE INDEX "PollutionIncident_commune_type_idx" ON "PollutionIncident"("commune", "type");

-- CreateIndex
CREATE INDEX "PollutionIncident_severity_idx" ON "PollutionIncident"("severity");

-- CreateIndex
CREATE INDEX "PollutionIncident_environmentalDossierId_idx" ON "PollutionIncident"("environmentalDossierId");

-- CreateIndex
CREATE UNIQUE INDEX "WasteBlackSpot_reference_key" ON "WasteBlackSpot"("reference");

-- CreateIndex
CREATE INDEX "WasteBlackSpot_commune_status_idx" ON "WasteBlackSpot"("commune", "status");

-- CreateIndex
CREATE INDEX "WasteBlackSpot_commune_recurring_idx" ON "WasteBlackSpot"("commune", "recurring");

-- CreateIndex
CREATE INDEX "WasteBlackSpot_environmentalDossierId_idx" ON "WasteBlackSpot"("environmentalDossierId");

-- CreateIndex
CREATE UNIQUE INDEX "NaturalSite_reference_key" ON "NaturalSite"("reference");

-- CreateIndex
CREATE INDEX "NaturalSite_commune_status_idx" ON "NaturalSite"("commune", "status");

-- CreateIndex
CREATE INDEX "NaturalSite_commune_type_idx" ON "NaturalSite"("commune", "type");

-- CreateIndex
CREATE INDEX "NaturalSite_environmentalDossierId_idx" ON "NaturalSite"("environmentalDossierId");

-- CreateIndex
CREATE UNIQUE INDEX "AwarenessCampaign_reference_key" ON "AwarenessCampaign"("reference");

-- CreateIndex
CREATE INDEX "AwarenessCampaign_commune_status_idx" ON "AwarenessCampaign"("commune", "status");

-- CreateIndex
CREATE INDEX "AwarenessCampaign_commune_theme_idx" ON "AwarenessCampaign"("commune", "theme");

-- CreateIndex
CREATE INDEX "AwarenessCampaign_environmentalDossierId_idx" ON "AwarenessCampaign"("environmentalDossierId");

-- CreateIndex
CREATE INDEX "AwarenessCampaign_environmentalProgramId_idx" ON "AwarenessCampaign"("environmentalProgramId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorizationDossier_reference_key" ON "AuthorizationDossier"("reference");

-- CreateIndex
CREATE INDEX "AuthorizationDossier_commune_status_idx" ON "AuthorizationDossier"("commune", "status");

-- CreateIndex
CREATE INDEX "AuthorizationDossier_commune_requestType_idx" ON "AuthorizationDossier"("commune", "requestType");

-- CreateIndex
CREATE INDEX "AuthorizationDossier_opinionStatus_idx" ON "AuthorizationDossier"("opinionStatus");

-- CreateIndex
CREATE UNIQUE INDEX "SanitaryOpinion_reference_key" ON "SanitaryOpinion"("reference");

-- CreateIndex
CREATE INDEX "SanitaryOpinion_commune_result_idx" ON "SanitaryOpinion"("commune", "result");

-- CreateIndex
CREATE INDEX "SanitaryOpinion_validationStatus_idx" ON "SanitaryOpinion"("validationStatus");

-- CreateIndex
CREATE INDEX "SanitaryOpinion_dossierId_idx" ON "SanitaryOpinion"("dossierId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeVisit_reference_key" ON "CommitteeVisit"("reference");

-- CreateIndex
CREATE INDEX "CommitteeVisit_commune_status_idx" ON "CommitteeVisit"("commune", "status");

-- CreateIndex
CREATE INDEX "CommitteeVisit_dossierId_idx" ON "CommitteeVisit"("dossierId");

-- CreateIndex
CREATE INDEX "CommitteeVisit_visitDate_idx" ON "CommitteeVisit"("visitDate");

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_campagneId_fkey" FOREIGN KEY ("campagneId") REFERENCES "Campagne"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionMaterial" ADD CONSTRAINT "InterventionMaterial_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionMaterial" ADD CONSTRAINT "InterventionMaterial_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionDocument" ADD CONSTRAINT "InterventionDocument_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionDocument" ADD CONSTRAINT "InterventionDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionPhoto" ADD CONSTRAINT "InterventionPhoto_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplaintContact" ADD CONSTRAINT "ComplaintContact_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_assignedAgentId_fkey" FOREIGN KEY ("assignedAgentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderPhoto" ADD CONSTRAINT "WorkOrderPhoto_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionComment" ADD CONSTRAINT "InterventionComment_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayReport" ADD CONSTRAINT "StrayReport_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "CaptureMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayReportPhoto" ADD CONSTRAINT "StrayReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "StrayReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptureMissionPhoto" ADD CONSTRAINT "CaptureMissionPhoto_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "CaptureMission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimal" ADD CONSTRAINT "StrayAnimal_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "CaptureMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalPhoto" ADD CONSTRAINT "StrayAnimalPhoto_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalStatus" ADD CONSTRAINT "StrayAnimalStatus_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalAdmission" ADD CONSTRAINT "StrayAnimalAdmission_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalAdmission" ADD CONSTRAINT "StrayAnimalAdmission_centerId_fkey" FOREIGN KEY ("centerId") REFERENCES "StrayAnimalCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalTransport" ADD CONSTRAINT "StrayAnimalTransport_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalHealthAlert" ADD CONSTRAINT "StrayAnimalHealthAlert_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalIdentification" ADD CONSTRAINT "StrayAnimalIdentification_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayCampaignActivity" ADD CONSTRAINT "StrayCampaignActivity_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "StrayCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalCareEvent" ADD CONSTRAINT "StrayAnimalCareEvent_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalDestination" ADD CONSTRAINT "StrayAnimalDestination_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StrayAnimalFollowUp" ADD CONSTRAINT "StrayAnimalFollowUp_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodReportPhoto" ADD CONSTRAINT "FoodReportPhoto_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "FoodReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DossierEvent" ADD CONSTRAINT "DossierEvent_dossierId_fkey" FOREIGN KEY ("dossierId") REFERENCES "Dossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inspection" ADD CONSTRAINT "Inspection_foodReportId_fkey" FOREIGN KEY ("foodReportId") REFERENCES "FoodReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorrectiveAction" ADD CONSTRAINT "CorrectiveAction_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CounterVisit" ADD CONSTRAINT "CounterVisit_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCard" ADD CONSTRAINT "HealthCard_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sample" ADD CONSTRAINT "Sample_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemperatureLog" ADD CONSTRAINT "TemperatureLog_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProduct" ADD CONSTRAINT "FoodProduct_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodProduct" ADD CONSTRAINT "FoodProduct_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "Sample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabResult" ADD CONSTRAINT "LabResult_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNonConformity" ADD CONSTRAINT "FoodNonConformity_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodNonConformity" ADD CONSTRAINT "FoodNonConformity_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FryingOilCheck" ADD CONSTRAINT "FryingOilCheck_establishmentId_fkey" FOREIGN KEY ("establishmentId") REFERENCES "Establishment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FryingOilCheck" ADD CONSTRAINT "FryingOilCheck_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterMeasurement" ADD CONSTRAINT "WaterMeasurement_waterPointId_fkey" FOREIGN KEY ("waterPointId") REFERENCES "WaterPoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterMeasurement" ADD CONSTRAINT "WaterMeasurement_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "WaterSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterMeasurement" ADD CONSTRAINT "WaterMeasurement_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "WaterDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterSample" ADD CONSTRAINT "WaterSample_waterPointId_fkey" FOREIGN KEY ("waterPointId") REFERENCES "WaterPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterSample" ADD CONSTRAINT "WaterSample_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterSampleEvent" ADD CONSTRAINT "WaterSampleEvent_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "WaterSample"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterInspection" ADD CONSTRAINT "WaterInspection_waterPointId_fkey" FOREIGN KEY ("waterPointId") REFERENCES "WaterPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterInspection" ADD CONSTRAINT "WaterInspection_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterInspection" ADD CONSTRAINT "WaterInspection_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "WaterSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterAction" ADD CONSTRAINT "WaterAction_waterPointId_fkey" FOREIGN KEY ("waterPointId") REFERENCES "WaterPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterAction" ADD CONSTRAINT "WaterAction_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterAction" ADD CONSTRAINT "WaterAction_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "WaterInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterAction" ADD CONSTRAINT "WaterAction_sampleId_fkey" FOREIGN KEY ("sampleId") REFERENCES "WaterSample"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterAction" ADD CONSTRAINT "WaterAction_sanitationIncidentId_fkey" FOREIGN KEY ("sanitationIncidentId") REFERENCES "SanitationIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterDisinfectionOperation" ADD CONSTRAINT "WaterDisinfectionOperation_waterPointId_fkey" FOREIGN KEY ("waterPointId") REFERENCES "WaterPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterDisinfectionOperation" ADD CONSTRAINT "WaterDisinfectionOperation_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterDevice" ADD CONSTRAINT "WaterDevice_waterPointId_fkey" FOREIGN KEY ("waterPointId") REFERENCES "WaterPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterDeviceCalibration" ADD CONSTRAINT "WaterDeviceCalibration_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "WaterDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PestStockMovement" ADD CONSTRAINT "PestStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PestProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiteCase" ADD CONSTRAINT "BiteCase_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "StrayAnimal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BiteVaccinationStep" ADD CONSTRAINT "BiteVaccinationStep_biteCaseId_fkey" FOREIGN KEY ("biteCaseId") REFERENCES "BiteCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BurialDossier" ADD CONSTRAINT "BurialDossier_cemeteryId_fkey" FOREIGN KEY ("cemeteryId") REFERENCES "Cemetery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExhumationDossier" ADD CONSTRAINT "ExhumationDossier_cemeteryId_fkey" FOREIGN KEY ("cemeteryId") REFERENCES "Cemetery"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalInspection" ADD CONSTRAINT "EnvironmentalInspection_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalFollowUp" ADD CONSTRAINT "EnvironmentalFollowUp_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalProgram" ADD CONSTRAINT "EnvironmentalProgram_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalDossierDocument" ADD CONSTRAINT "EnvironmentalDossierDocument_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalDossierDocument" ADD CONSTRAINT "EnvironmentalDossierDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentalEvidence" ADD CONSTRAINT "EnvironmentalEvidence_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollutionIncident" ADD CONSTRAINT "PollutionIncident_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WasteBlackSpot" ADD CONSTRAINT "WasteBlackSpot_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NaturalSite" ADD CONSTRAINT "NaturalSite_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwarenessCampaign" ADD CONSTRAINT "AwarenessCampaign_environmentalDossierId_fkey" FOREIGN KEY ("environmentalDossierId") REFERENCES "EnvironmentalDossier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AwarenessCampaign" ADD CONSTRAINT "AwarenessCampaign_environmentalProgramId_fkey" FOREIGN KEY ("environmentalProgramId") REFERENCES "EnvironmentalProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;
