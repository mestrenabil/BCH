import { db } from '@/lib/db'
import { VIGILANCE_SLA_DAYS } from '@/lib/constants'

type LinkActor = { id: string; nom: string }

type ComplaintLink = {
  id: string
  reference: string
  commune: string
  quartier: string | null
  adresse: string
  latitude: number | null
  longitude: number | null
  description: string
  priorite: string
  source: string
  statut: string
  createdAt?: Date | string
}

type FoodLink = {
  id: string
  reference: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  description: string
  reportType: string
  establishmentName: string
  priority: string
  statut: string
  source: string
  createdAt?: Date | string
}

type StrayLink = {
  id: string
  reference: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  description: string
  species: string
  priority: string
  statut: string
  source: string
  createdAt?: Date | string
}

const CLOSED_DOSSIER_STATUSES = new Set(['CLOSED', 'ARCHIVED'])

function normalizedPriority(priority: string): string {
  if (priority === 'URGENTE' || priority === 'SANITAIRE') return 'URGENTE'
  if (priority === 'HAUTE') return 'HAUTE'
  if (priority === 'FAIBLE' || priority === 'BASSE') return 'FAIBLE'
  return 'NORMALE'
}

function slaDueDate(priority: string, createdAt?: Date | string): Date {
  const startedAt = createdAt ? new Date(createdAt) : new Date()
  const key = priority === 'URGENTE' || priority === 'SANITAIRE' ? 'URGENT' : priority === 'HAUTE' ? 'IMPORTANT' : 'NORMAL'
  const days = VIGILANCE_SLA_DAYS[key] ?? 7
  return new Date(startedAt.getTime() + days * 24 * 60 * 60 * 1000)
}

function complaintDossierStatus(status: string): string {
  if (status === 'EN_COURS') return 'IN_PROGRESS'
  if (status === 'TRAITEE') return 'CLOSED'
  if (status === 'REJETEE') return 'ARCHIVED'
  return 'NEW'
}

function foodDossierStatus(status: string): string {
  if (status === 'VERIFICATION' || status === 'EN_COURS') return 'IN_PROGRESS'
  if (status === 'VALIDE') return 'INSPECTED'
  if (status === 'TRAITE') return 'CLOSED'
  if (status === 'REJETE' || status === 'CLASSE') return 'ARCHIVED'
  return 'NEW'
}

function strayDossierStatus(status: string): string {
  if (status === 'VERIFICATION') return 'INSPECTED'
  if (status === 'MISSION_PLANIFIEE') return 'ASSIGNED'
  if (status === 'EN_COURS') return 'IN_PROGRESS'
  if (status === 'PARTIEL') return 'FOLLOW_UP'
  if (status === 'TRAITE') return 'CLOSED'
  if (status === 'DOUBLON' || status === 'CLASSE') return 'ARCHIVED'
  if (status === 'NON_LOCALISE') return 'ACTION_REQUIRED'
  return 'NEW'
}

function actorValues(actor: LinkActor | undefined, source: string) {
  return {
    id: actor?.id || source || 'SYSTEM',
    name: actor?.nom || (source === 'PUBLIC' ? 'التبليغ العمومي' : 'النظام'),
  }
}

async function createDossier(data: {
  relation: 'complaintId' | 'foodReportId' | 'strayReportId'
  relationId: string
  office: string
  type: string
  title: string
  description: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  priority: string
  status: string
  source: string
  createdAt?: Date | string
  actor?: LinkActor
}) {
  const existing = await db.dossier.findFirst({
    where: { [data.relation]: data.relationId },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  const year = new Date().getFullYear()
  const actor = actorValues(data.actor, data.source)
  const priority = normalizedPriority(data.priority)
  const status = data.status || 'NEW'
  const reference = `DOS-${year}-${data.relationId.slice(-8).toUpperCase()}`
  const uniqueReference = await db.dossier.findUnique({ where: { reference }, select: { id: true } })
  const finalReference = uniqueReference ? `DOS-${year}-${Date.now().toString(36).toUpperCase()}` : reference

  return db.dossier.create({
    data: {
      reference: finalReference,
      office: data.office,
      type: data.type,
      title: data.title,
      description: data.description,
      status,
      priority,
      commune: data.commune,
      quartier: data.quartier || '',
      adresse: data.adresse || '',
      latitude: data.latitude,
      longitude: data.longitude,
      dueDate: slaDueDate(data.priority, data.createdAt),
      [data.relation]: data.relationId,
      createdBy: actor.id,
      createdByName: actor.name,
      notes: JSON.stringify({ source: data.source, relation: data.relation }),
      events: {
        create: {
          toStatus: status,
          action: 'LINK',
          reason: `إنشاء ملف موحد من ${data.title}`,
          changedBy: actor.id,
          changedByName: actor.name,
          metadata: JSON.stringify({ relation: data.relation, relationId: data.relationId }),
        },
      },
    },
  })
}

export async function ensureComplaintDossier(complaint: ComplaintLink, actor?: LinkActor) {
  return createDossier({
    relation: 'complaintId',
    relationId: complaint.id,
    office: 'OFFICE_07',
    type: 'COMPLAINT',
    title: `شكاية ${complaint.reference}`,
    description: complaint.description,
    commune: complaint.commune,
    quartier: complaint.quartier || '',
    adresse: complaint.adresse,
    latitude: complaint.latitude,
    longitude: complaint.longitude,
    priority: complaint.priorite,
    status: complaintDossierStatus(complaint.statut),
    source: complaint.source,
    createdAt: complaint.createdAt,
    actor,
  })
}

export async function ensureFoodReportDossier(report: FoodLink, actor?: LinkActor) {
  return createDossier({
    relation: 'foodReportId',
    relationId: report.id,
    office: 'OFFICE_02',
    type: 'FOOD_REPORT',
    title: `بلاغ سلامة غذائية ${report.reference}`,
    description: report.description || report.establishmentName,
    commune: report.commune,
    quartier: report.quartier,
    adresse: report.adresse,
    latitude: report.latitude,
    longitude: report.longitude,
    priority: report.priority,
    status: foodDossierStatus(report.statut),
    source: report.source,
    createdAt: report.createdAt,
    actor,
  })
}

export async function ensureStrayReportDossier(report: StrayLink, actor?: LinkActor) {
  return createDossier({
    relation: 'strayReportId',
    relationId: report.id,
    office: 'OFFICE_04',
    type: 'STRAY_REPORT',
    title: `بلاغ حيوان شارد ${report.reference}`,
    description: report.description,
    commune: report.commune,
    quartier: report.quartier,
    adresse: report.adresse,
    latitude: report.latitude,
    longitude: report.longitude,
    priority: report.priority,
    status: strayDossierStatus(report.statut),
    source: report.source,
    createdAt: report.createdAt,
    actor,
  })
}

async function syncDossier(relation: 'complaintId' | 'foodReportId' | 'strayReportId', relationId: string, status: string, priority: string, source: string, actor?: LinkActor) {
  const dossier = await db.dossier.findFirst({ where: { [relation]: relationId }, orderBy: { createdAt: 'desc' } })
  if (!dossier) return null
  const nextStatus = relation === 'complaintId' ? complaintDossierStatus(status) : relation === 'foodReportId' ? foodDossierStatus(status) : strayDossierStatus(status)
  const nextPriority = normalizedPriority(priority)
  const actorData = actorValues(actor, source)
  const changed = dossier.status !== nextStatus
  const closedAt = CLOSED_DOSSIER_STATUSES.has(nextStatus) ? dossier.closedAt || new Date() : null
  const updateData = {
    status: nextStatus,
    priority: nextPriority,
    dueDate: dossier.dueDate || slaDueDate(priority, dossier.createdAt),
    closedAt,
  }
  if (!changed) return db.dossier.update({ where: { id: dossier.id }, data: updateData })
  return db.dossier.update({
    where: { id: dossier.id },
    data: {
      ...updateData,
      events: {
        create: {
          fromStatus: dossier.status,
          toStatus: nextStatus,
          action: 'STATUS_CHANGE',
          reason: 'مزامنة حالة البلاغ مع الملف الموحد',
          changedBy: actorData.id,
          changedByName: actorData.name,
          metadata: JSON.stringify({ relation, relationId }),
        },
      },
    },
  })
}

export function syncComplaintDossier(complaint: ComplaintLink, actor?: LinkActor) {
  return syncDossier('complaintId', complaint.id, complaint.statut, complaint.priorite, complaint.source, actor)
}

export function syncFoodReportDossier(report: FoodLink, actor?: LinkActor) {
  return syncDossier('foodReportId', report.id, report.statut, report.priority, report.source, actor)
}

export function syncStrayReportDossier(report: StrayLink, actor?: LinkActor) {
  return syncDossier('strayReportId', report.id, report.statut, report.priority, report.source, actor)
}
