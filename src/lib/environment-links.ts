import { db } from '@/lib/db'

type ComplaintForEnvironmentalLink = {
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
  environmentalDossierId?: string | null
}

type LinkActor = { id: string; nom: string }

type PollutionForEnvironmentalLink = {
  id: string
  reference: string
  type: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  description: string
  source: string
  pollutantName: string
  severity: string
  company: string
  environmentalDossierId?: string | null
}

type WasteForEnvironmentalLink = {
  id: string
  reference: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  description: string
  wasteType: string
  recurring: boolean
  recurrenceCount: number
  source: string
  environmentalDossierId?: string | null
}

type NaturalSiteForEnvironmentalLink = {
  id: string
  reference: string
  name: string
  type: string
  commune: string
  quartier: string
  adresse: string
  latitude: number | null
  longitude: number | null
  area: number | null
  description: string
  protectionLevel: string
  status: string
  threats: string
  environmentalDossierId?: string | null
}

async function uniqueReference(model: 'environmentalDossier' | 'dossier', prefix: string, year: number) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const value = `${prefix}-${year}-${suffix}`
    const exists = model === 'environmentalDossier'
      ? await db.environmentalDossier.findUnique({ where: { reference: value }, select: { id: true } })
      : await db.dossier.findUnique({ where: { reference: value }, select: { id: true } })
    if (!exists) return value
  }
  return `${prefix}-${year}-${Date.now().toString(36).toUpperCase()}`
}

export async function linkComplaintToEnvironmentalDossier(complaint: ComplaintForEnvironmentalLink, actor?: LinkActor) {
  if (complaint.environmentalDossierId) {
    const existing = await db.environmentalDossier.findUnique({ where: { id: complaint.environmentalDossierId } })
    if (existing) return { dossier: existing, alreadyLinked: true }
  }

  const year = new Date().getFullYear()
  const createdBy = actor?.id || 'PUBLIC'
  const createdByName = actor?.nom || 'التبليغ العمومي'
  const title = `بلاغ بيئي ${complaint.reference}`
  const dossier = await db.environmentalDossier.create({
    data: {
      reference: await uniqueReference('environmentalDossier', 'ENV', year),
      title,
      category: 'POLLUTION',
      commune: complaint.commune,
      quartier: complaint.quartier || '',
      adresse: complaint.adresse,
      latitude: complaint.latitude,
      longitude: complaint.longitude,
      description: complaint.description,
      source: complaint.source || 'PUBLIC',
      priority: complaint.priorite,
      notes: JSON.stringify({ complaintId: complaint.id, complaintReference: complaint.reference }),
    },
  })

  const unified = await db.dossier.create({
    data: {
      reference: await uniqueReference('dossier', 'DOS', year),
      office: 'OFFICE_06',
      type: 'ENVIRONMENTAL',
      title,
      description: dossier.description,
      priority: dossier.priority,
      commune: dossier.commune,
      quartier: dossier.quartier,
      adresse: dossier.adresse,
      latitude: dossier.latitude,
      longitude: dossier.longitude,
      createdBy,
      createdByName,
      notes: JSON.stringify({ environmentalDossierId: dossier.id, complaintId: complaint.id }),
      events: {
        create: {
          toStatus: 'NEW',
          action: 'LINK',
          reason: `ربط البلاغ ${complaint.reference} بقسم البيئة`,
          changedBy: createdBy,
          changedByName: createdByName,
          metadata: JSON.stringify({ complaintId: complaint.id, source: complaint.source }),
        },
      },
    },
  })

  const linked = await db.environmentalDossier.update({ where: { id: dossier.id }, data: { unifiedDossierId: unified.id } })
  await db.complaint.update({ where: { id: complaint.id }, data: { environmentalDossierId: linked.id } })
  return { dossier: linked, alreadyLinked: false }
}

export async function linkPollutionIncidentToEnvironmentalDossier(incident: PollutionForEnvironmentalLink, actor?: LinkActor) {
  if (incident.environmentalDossierId) {
    const existing = await db.environmentalDossier.findUnique({ where: { id: incident.environmentalDossierId } })
    if (existing) return { dossier: existing, alreadyLinked: true }
  }
  const year = new Date().getFullYear()
  const createdBy = actor?.id || 'INTERNAL'
  const createdByName = actor?.nom || 'مصلحة الوقاية وحفظ الصحة'
  const title = `حادث تلوث ${incident.reference}`
  const priority = incident.severity === 'CRITICAL' ? 'URGENTE' : incident.severity === 'HIGH' ? 'HAUTE' : 'NORMALE'
  const riskScore = incident.severity === 'CRITICAL' ? 100 : incident.severity === 'HIGH' ? 70 : incident.severity === 'MEDIUM' ? 40 : 15
  const dossier = await db.environmentalDossier.create({ data: {
    reference: await uniqueReference('environmentalDossier', 'ENV', year), title, category: 'POLLUTION', commune: incident.commune,
    quartier: incident.quartier, adresse: incident.adresse, latitude: incident.latitude, longitude: incident.longitude,
    description: incident.description, priority, source: incident.source || 'INTERNAL', probableSource: incident.company,
    riskLevel: incident.severity, riskScore, notes: JSON.stringify({ pollutionIncidentId: incident.id, pollutionReference: incident.reference, pollutantName: incident.pollutantName, type: incident.type }),
  } })
  const unified = await db.dossier.create({ data: {
    reference: await uniqueReference('dossier', 'DOS', year), office: 'OFFICE_06', type: 'ENVIRONMENTAL', title,
    description: dossier.description, priority: dossier.priority, commune: dossier.commune, quartier: dossier.quartier, adresse: dossier.adresse,
    latitude: dossier.latitude, longitude: dossier.longitude, createdBy, createdByName, notes: JSON.stringify({ environmentalDossierId: dossier.id, pollutionIncidentId: incident.id }),
    events: { create: { toStatus: 'NEW', action: 'LINK', reason: `ربط حادث التلوث ${incident.reference} بقسم البيئة`, changedBy: createdBy, changedByName: createdByName, metadata: JSON.stringify({ pollutionIncidentId: incident.id, source: incident.source }) } },
  } })
  const linked = await db.environmentalDossier.update({ where: { id: dossier.id }, data: { unifiedDossierId: unified.id } })
  await db.pollutionIncident.update({ where: { id: incident.id }, data: { environmentalDossierId: linked.id } })
  return { dossier: linked, alreadyLinked: false }
}

export async function linkWasteSpotToEnvironmentalDossier(spot: WasteForEnvironmentalLink, actor?: LinkActor) {
  if (spot.environmentalDossierId) {
    const existing = await db.environmentalDossier.findUnique({ where: { id: spot.environmentalDossierId } })
    if (existing) return { dossier: existing, alreadyLinked: true }
  }
  const year = new Date().getFullYear()
  const createdBy = actor?.id || 'INTERNAL'
  const createdByName = actor?.nom || 'مصلحة الوقاية وحفظ الصحة'
  const title = `نقطة نفايات ${spot.reference}`
  const riskLevel = spot.recurring && spot.recurrenceCount >= 3 ? 'HIGH' : spot.recurring ? 'MEDIUM' : 'LOW'
  const riskScore = riskLevel === 'HIGH' ? 70 : riskLevel === 'MEDIUM' ? 40 : 15
  const dossier = await db.environmentalDossier.create({ data: {
    reference: await uniqueReference('environmentalDossier', 'ENV', year), title, category: 'WASTE', commune: spot.commune,
    quartier: spot.quartier, adresse: spot.adresse, latitude: spot.latitude, longitude: spot.longitude, description: spot.description,
    priority: riskLevel === 'HIGH' ? 'HAUTE' : 'NORMALE', riskLevel, riskScore, source: spot.source || 'INTERNAL',
    notes: JSON.stringify({ wasteSpotId: spot.id, wasteReference: spot.reference, wasteType: spot.wasteType, recurring: spot.recurring, recurrenceCount: spot.recurrenceCount }),
  } })
  const unified = await db.dossier.create({ data: {
    reference: await uniqueReference('dossier', 'DOS', year), office: 'OFFICE_06', type: 'ENVIRONMENTAL', title,
    description: dossier.description, priority: dossier.priority, commune: dossier.commune, quartier: dossier.quartier, adresse: dossier.adresse,
    latitude: dossier.latitude, longitude: dossier.longitude, createdBy, createdByName, notes: JSON.stringify({ environmentalDossierId: dossier.id, wasteSpotId: spot.id }),
    events: { create: { toStatus: 'NEW', action: 'LINK', reason: `ربط نقطة النفايات ${spot.reference} بقسم البيئة`, changedBy: createdBy, changedByName: createdByName, metadata: JSON.stringify({ wasteSpotId: spot.id, recurring: spot.recurring }) } },
  } })
  const linked = await db.environmentalDossier.update({ where: { id: dossier.id }, data: { unifiedDossierId: unified.id } })
  await db.wasteBlackSpot.update({ where: { id: spot.id }, data: { environmentalDossierId: linked.id } })
  return { dossier: linked, alreadyLinked: false }
}

export async function linkNaturalSiteToEnvironmentalDossier(site: NaturalSiteForEnvironmentalLink, actor?: LinkActor) {
  if (site.environmentalDossierId) {
    const existing = await db.environmentalDossier.findUnique({ where: { id: site.environmentalDossierId } })
    if (existing) return { dossier: existing, alreadyLinked: true }
  }
  const year = new Date().getFullYear()
  const createdBy = actor?.id || 'INTERNAL'
  const createdByName = actor?.nom || 'مصلحة الوقاية وحفظ الصحة'
  const title = `موقع طبيعي ${site.name}`
  const riskLevel = site.status === 'THREATENED' ? 'HIGH' : site.status === 'DEGRADED' ? 'CRITICAL' : 'LOW'
  const riskScore = riskLevel === 'CRITICAL' ? 80 : riskLevel === 'HIGH' ? 60 : 10
  const dossier = await db.environmentalDossier.create({ data: {
    reference: await uniqueReference('environmentalDossier', 'ENV', year), title, category: 'OTHER', commune: site.commune,
    quartier: site.quartier, adresse: site.adresse, latitude: site.latitude, longitude: site.longitude, description: site.description,
    priority: riskLevel === 'CRITICAL' ? 'URGENTE' : riskLevel === 'HIGH' ? 'HAUTE' : 'NORMALE', riskLevel, riskScore,
    notes: JSON.stringify({ naturalSiteId: site.id, naturalSiteReference: site.reference, type: site.type, protectionLevel: site.protectionLevel, threats: site.threats, area: site.area }),
  } })
  const unified = await db.dossier.create({ data: {
    reference: await uniqueReference('dossier', 'DOS', year), office: 'OFFICE_06', type: 'ENVIRONMENTAL', title,
    description: dossier.description, priority: dossier.priority, commune: dossier.commune, quartier: dossier.quartier, adresse: dossier.adresse,
    latitude: dossier.latitude, longitude: dossier.longitude, createdBy, createdByName, notes: JSON.stringify({ environmentalDossierId: dossier.id, naturalSiteId: site.id }),
    events: { create: { toStatus: 'NEW', action: 'LINK', reason: `ربط الموقع الطبيعي ${site.reference} بقسم البيئة`, changedBy: createdBy, changedByName: createdByName, metadata: JSON.stringify({ naturalSiteId: site.id, status: site.status }) } },
  } })
  const linked = await db.environmentalDossier.update({ where: { id: dossier.id }, data: { unifiedDossierId: unified.id } })
  await db.naturalSite.update({ where: { id: site.id }, data: { environmentalDossierId: linked.id } })
  return { dossier: linked, alreadyLinked: false }
}
