import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

export type BackupPayload = {
  version: string
  exportedAt: string
  data: Record<string, unknown[]>
  summary: Record<string, number>
}

type BackupRecord = Record<string, unknown>

const asRecords = (value: unknown): BackupRecord[] => Array.isArray(value)
  ? value.filter((item): item is BackupRecord => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
  : []

const requiredString = (record: BackupRecord, key: string, entity: string): string => {
  const value = record[key]
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${entity}: الحقل ${key} مفقود`)
  return value
}

const optionalString = (value: unknown): string | null => typeof value === 'string' && value ? value : null
const text = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback
const number = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const integer = (value: unknown, fallback = 0): number => Math.trunc(number(value, fallback))
const boolean = (value: unknown, fallback = true): boolean => typeof value === 'boolean' ? value : fallback
const optionalNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const date = (value: unknown, entity: string): Date => {
  const parsed = new Date(String(value ?? ''))
  if (Number.isNaN(parsed.getTime())) throw new Error(`${entity}: تاريخ غير صالح`)
  return parsed
}
const optionalDate = (value: unknown, entity: string): Date | null => value ? date(value, entity) : null

export async function createBackupPayload(): Promise<BackupPayload> {
  const [
    interventions, products, agents, usersRaw, quartiers, documents,
    complaints, stockMovements, activityLogs, campagnes, workOrders,
  ] = await Promise.all([
    db.intervention.findMany({ include: { materials: true } }),
    db.product.findMany(),
    db.agent.findMany(),
    db.user.findMany(),
    db.quartier.findMany(),
    db.document.findMany(),
    db.complaint.findMany({ include: { contacts: true } }),
    db.stockMovement.findMany(),
    db.activityLog.findMany({ take: 500, orderBy: { createdAt: 'desc' } }),
    db.campagne.findMany(),
    db.workOrder.findMany({ include: { photos: true } }),
  ])

  const safeUsers = usersRaw.map(({ password, ...user }) => user)
  const data = {
    interventions,
    products,
    agents,
    users: safeUsers,
    quartiers,
    documents,
    complaints,
    stockMovements,
    activityLogs,
    campagnes,
    workOrders,
  }

  return {
    version: '3.1',
    exportedAt: new Date().toISOString(),
    data,
    summary: Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])),
  }
}

export function parseBackupPayload(value: unknown): BackupPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ملف النسخة الاحتياطية غير صالح')
  const candidate = value as Record<string, unknown>
  if (typeof candidate.version !== 'string' || !candidate.version.startsWith('3.')) {
    throw new Error('إصدار النسخة الاحتياطية غير مدعوم')
  }
  if (!candidate.data || typeof candidate.data !== 'object' || Array.isArray(candidate.data)) {
    throw new Error('النسخة لا تحتوي على قسم data')
  }

  const data = candidate.data as Record<string, unknown>
  const normalizedData = Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, asRecords(rows)]))
  return {
    version: candidate.version,
    exportedAt: text(candidate.exportedAt, new Date().toISOString()),
    data: normalizedData,
    summary: Object.fromEntries(Object.entries(normalizedData).map(([key, rows]) => [key, rows.length])),
  }
}

export async function restoreBackupPayload(payload: BackupPayload) {
  const restored: Record<string, number> = {}

  await db.$transaction(async (tx) => {
    const products = asRecords(payload.data.products)
    const agents = asRecords(payload.data.agents)
    const quartiers = asRecords(payload.data.quartiers)
    const campagnes = asRecords(payload.data.campagnes)
    const interventions = asRecords(payload.data.interventions)
    const documents = asRecords(payload.data.documents)
    const complaints = asRecords(payload.data.complaints)
    const workOrders = asRecords(payload.data.workOrders)
    const stockMovements = asRecords(payload.data.stockMovements)
    const productIds = new Map<string, string>()
    const campagneIds = new Map<string, string>()
    const interventionIds = new Map<string, string>()
    const complaintIds = new Map<string, string>()
    const workOrderIds = new Map<string, string>()

    for (const row of quartiers) {
      const entity = 'Quartier'
      const nom = requiredString(row, 'nom', entity)
      const commune = requiredString(row, 'commune', entity)
      await tx.quartier.upsert({
        where: { nom_commune: { nom, commune } },
        create: { id: optionalString(row.id) ?? undefined, nom, commune, latitude: number(row.latitude), longitude: number(row.longitude) },
        update: { latitude: number(row.latitude), longitude: number(row.longitude) },
      })
    }
    restored.quartiers = quartiers.length

    for (const row of products) {
      const entity = 'Product'
      const sourceId = requiredString(row, 'id', entity)
      const reference = requiredString(row, 'reference', entity)
      const values = {
        nom: requiredString(row, 'nom', entity), categorie: text(row.categorie, 'GENERAL'), commune: text(row.commune),
        unite: text(row.unite, 'لتر'), quantiteStock: integer(row.quantiteStock), seuilAlerte: integer(row.seuilAlerte, 10),
        prixUnitaire: number(row.prixUnitaire), fournisseur: text(row.fournisseur), description: text(row.description),
        imagePath: optionalString(row.imagePath), dateExpiration: optionalDate(row.dateExpiration, entity),
      }
      const saved = await tx.product.upsert({ where: { reference }, create: { id: sourceId, reference, ...values }, update: values })
      productIds.set(sourceId, saved.id)
    }
    restored.products = products.length

    for (const row of agents) {
      const entity = 'Agent'
      const id = requiredString(row, 'id', entity)
      const values = {
        nom: requiredString(row, 'nom', entity), prenom: text(row.prenom), telephone: text(row.telephone),
        commune: text(row.commune), fonction: text(row.fonction, 'عون صحية'), actif: boolean(row.actif), teamId: null,
      }
      await tx.agent.upsert({ where: { id }, create: { id, ...values }, update: values })
    }
    restored.agents = agents.length

    for (const row of campagnes) {
      const entity = 'Campagne'
      const sourceId = requiredString(row, 'id', entity)
      const reference = requiredString(row, 'reference', entity)
      const values = {
        nom: requiredString(row, 'nom', entity), type: requiredString(row, 'type', entity), commune: text(row.commune),
        description: text(row.description), objectif: text(row.objectif), budgetPrevu: optionalNumber(row.budgetPrevu),
        coutReel: optionalNumber(row.coutReel), dateDebut: date(row.dateDebut, entity), dateFin: optionalDate(row.dateFin, entity),
        statut: text(row.statut, 'PLANIFIEE'), responsable: text(row.responsable), couleur: text(row.couleur, '#10b981'),
      }
      const saved = await tx.campagne.upsert({ where: { reference }, create: { id: sourceId, reference, ...values }, update: values })
      campagneIds.set(sourceId, saved.id)
    }
    restored.campagnes = campagnes.length

    for (const row of interventions) {
      const entity = 'Intervention'
      const sourceId = requiredString(row, 'id', entity)
      const reference = requiredString(row, 'reference', entity)
      const values = {
        type: requiredString(row, 'type', entity), gisLayer: text(row.gisLayer, 'interventions'), date: date(row.date, entity),
        quartier: text(row.quartier), adresse: text(row.adresse), commune: text(row.commune), latitude: number(row.latitude),
        longitude: number(row.longitude), statut: text(row.statut, 'PLANIFIEE'), description: text(row.description),
        agentNom: text(row.agentNom), produitUtilise: text(row.produitUtilise), quantite: text(row.quantite),
        superficie: text(row.superficie), nombrePrestations: integer(row.nombrePrestations, 1), observations: text(row.observations),
        heureDebut: optionalString(row.heureDebut), heureFin: optionalString(row.heureFin), coutMainOeuvre: optionalNumber(row.coutMainOeuvre),
        coutMateriaux: optionalNumber(row.coutMateriaux), coutTotal: optionalNumber(row.coutTotal),
        campagneId: optionalString(row.campagneId) ? campagneIds.get(String(row.campagneId)) ?? null : null,
      }
      const saved = await tx.intervention.upsert({ where: { reference }, create: { id: sourceId, reference, ...values }, update: values })
      interventionIds.set(sourceId, saved.id)
    }
    restored.interventions = interventions.length

    for (const row of documents) {
      const entity = 'Document'
      const id = requiredString(row, 'id', entity)
      const values = {
        titre: requiredString(row, 'titre', entity), description: text(row.description), categorie: text(row.categorie, 'عام'),
        commune: text(row.commune), nomFichier: requiredString(row, 'nomFichier', entity), cheminFichier: requiredString(row, 'cheminFichier', entity),
        typeFichier: text(row.typeFichier), tailleFichier: integer(row.tailleFichier), reference: text(row.reference),
        dateDocument: optionalDate(row.dateDocument, entity), uploadedBy: text(row.uploadedBy),
      }
      await tx.document.upsert({ where: { id }, create: { id, ...values }, update: values })
    }
    restored.documents = documents.length

    for (const row of complaints) {
      const entity = 'Complaint'
      const sourceId = requiredString(row, 'id', entity)
      const reference = requiredString(row, 'reference', entity)
      const values = {
        nomCitoyen: requiredString(row, 'nomCitoyen', entity), telephone: optionalString(row.telephone), email: optionalString(row.email),
        adresse: text(row.adresse), quartier: optionalString(row.quartier), commune: text(row.commune), type: text(row.type),
        description: text(row.description), priorite: text(row.priorite, 'NORMALE'), statut: text(row.statut, 'EN_ATTENTE'),
        source: text(row.source, 'INTERNAL'), latitude: optionalNumber(row.latitude), longitude: optionalNumber(row.longitude),
        interventionId: optionalString(row.interventionId) ? interventionIds.get(String(row.interventionId)) ?? null : null,
        environmentalDossierId: null, dateReception: date(row.dateReception, entity), dateTraitement: optionalDate(row.dateTraitement, entity),
        observations: optionalString(row.observations),
      }
      const saved = await tx.complaint.upsert({ where: { reference }, create: { id: sourceId, reference, ...values }, update: values })
      complaintIds.set(sourceId, saved.id)

      for (const contact of asRecords(row.contacts)) {
        const contactId = requiredString(contact, 'id', 'ComplaintContact')
        const contactValues = {
          complaintId: saved.id, channel: text(contact.channel), outcome: text(contact.outcome), notes: text(contact.notes),
          contactedAt: date(contact.contactedAt, 'ComplaintContact'), contactedBy: text(contact.contactedBy),
        }
        await tx.complaintContact.upsert({ where: { id: contactId }, create: { id: contactId, ...contactValues }, update: contactValues })
      }
    }
    restored.complaints = complaints.length

    for (const row of workOrders) {
      const entity = 'WorkOrder'
      const sourceId = requiredString(row, 'id', entity)
      const reference = requiredString(row, 'reference', entity)
      const sourceAgentId = optionalString(row.assignedAgentId)
      const values = {
        commune: text(row.commune), title: requiredString(row, 'title', entity), description: text(row.description),
        priority: text(row.priority, 'NORMALE'), status: text(row.status, 'NOUVEAU'),
        complaintId: optionalString(row.complaintId) ? complaintIds.get(String(row.complaintId)) ?? null : null,
        interventionId: optionalString(row.interventionId) ? interventionIds.get(String(row.interventionId)) ?? null : null,
        assignedAgentId: sourceAgentId && agents.some((agent) => agent.id === sourceAgentId) ? sourceAgentId : null,
        scheduledFor: optionalDate(row.scheduledFor, entity), dueAt: optionalDate(row.dueAt, entity), startedAt: optionalDate(row.startedAt, entity),
        completedAt: optionalDate(row.completedAt, entity), completionNotes: optionalString(row.completionNotes),
        latitude: optionalNumber(row.latitude), longitude: optionalNumber(row.longitude), createdBy: text(row.createdBy),
      }
      const saved = await tx.workOrder.upsert({ where: { reference }, create: { id: sourceId, reference, ...values }, update: values })
      workOrderIds.set(sourceId, saved.id)
      for (const photo of asRecords(row.photos)) {
        const storedFileName = requiredString(photo, 'storedFileName', 'WorkOrderPhoto')
        const photoValues = {
          workOrderId: saved.id, originalName: text(photo.originalName), mimeType: text(photo.mimeType), size: integer(photo.size),
          type: text(photo.type, 'AFTER'), caption: optionalString(photo.caption), uploadedBy: text(photo.uploadedBy),
        }
        await tx.workOrderPhoto.upsert({
          where: { storedFileName },
          create: { id: optionalString(photo.id) ?? undefined, storedFileName, ...photoValues },
          update: photoValues,
        })
      }
    }
    restored.workOrders = workOrders.length

    for (const row of interventions) {
      const interventionId = interventionIds.get(requiredString(row, 'id', 'Intervention'))
      if (!interventionId) continue
      for (const material of asRecords(row.materials)) {
        const productId = productIds.get(requiredString(material, 'productId', 'InterventionMaterial'))
        if (!productId) continue
        await tx.interventionMaterial.upsert({
          where: { interventionId_productId: { interventionId, productId } },
          create: { id: optionalString(material.id) ?? undefined, interventionId, productId, quantity: integer(material.quantity) },
          update: { quantity: integer(material.quantity) },
        })
      }
    }

    for (const row of stockMovements) {
      const entity = 'StockMovement'
      const id = requiredString(row, 'id', entity)
      const productId = productIds.get(requiredString(row, 'productId', entity))
      if (!productId) continue
      const values = {
        productId, type: text(row.type), quantity: integer(row.quantity), reason: optionalString(row.reason),
        note: optionalString(row.note), commune: text(row.commune), createdAt: date(row.createdAt, entity),
      }
      await tx.stockMovement.upsert({ where: { id }, create: { id, ...values }, update: values })
    }
    restored.stockMovements = stockMovements.length
  }, { timeout: 120_000 })

  return restored
}

export type BackupTransactionClient = Prisma.TransactionClient
