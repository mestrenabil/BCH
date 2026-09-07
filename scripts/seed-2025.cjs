/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8')
    const databaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim()
    if (databaseUrl) process.env.DATABASE_URL = databaseUrl
  }
}

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const requestedYear = Number(process.env.SEED_YEAR || '2025')
const YEAR = Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : 2025

const communes = [
  { code: 'SLA', name: 'سلا', quartier: 'حي حسان', latitude: 34.05, longitude: -6.79 },
  { code: 'BKN', name: 'سيدي أبي القنادل', quartier: 'بوقنادل القديمة', latitude: 34.1235, longitude: -6.7335 },
  { code: 'AMR', name: 'عامر', quartier: 'مركز عامر', latitude: 34.09, longitude: -6.65 },
  { code: 'SHL', name: 'السهول', quartier: 'مركز السهول', latitude: 33.825, longitude: -6.78 },
]

const types = [
  { code: 'DR', value: 'DERATISATION', product: 'رودينال' },
  { code: 'DI', value: 'DESINSECTISATION', product: 'ديلتميثرين' },
  { code: 'DF', value: 'DESINFECTION', product: 'هيبوكلوريت الصوديوم' },
]

const counters = {}
function counted(layer) {
  counters[layer] = (counters[layer] || 0) + 1
}

function date(day, month = 0) {
  return new Date(Date.UTC(YEAR, month, day, 9, 0, 0))
}

async function upsertReference(model, reference, data, layer, uniqueField = 'reference') {
  await prisma[model].upsert({
    where: { [uniqueField]: reference },
    update: {},
    create: { [uniqueField]: reference, ...data },
  })
  counted(layer)
}

async function ensureByFields(model, where, data, layer) {
  const existing = await prisma[model].findFirst({ where })
  if (existing) {
    counted(layer)
    return existing
  }
  const created = await prisma[model].create({ data })
  counted(layer)
  return created
}

async function ensureQuartier(commune) {
  const existing = await prisma.quartier.findFirst({
    where: { nom: commune.quartier, commune: commune.name },
  })
  if (existing) return existing
  return prisma.quartier.create({
    data: {
      nom: commune.quartier,
      commune: commune.name,
      latitude: commune.latitude,
      longitude: commune.longitude,
    },
  })
}

async function ensureAgent(commune) {
  const existing = await prisma.agent.findFirst({
    where: { commune: commune.name, nom: 'عون', prenom: `2025 ${commune.code}` },
  })
  if (existing) {
    counted('agents')
    return existing
  }
  const agent = await prisma.agent.create({
    data: {
      nom: 'عون',
      prenom: `2025 ${commune.code}`,
      commune: commune.name,
      fonction: 'عون صحي',
      actif: true,
    },
  })
  counted('agents')
  return agent
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

async function ensureUsers() {
  const users = [
    { username: 'admin', password: 'admin123', nom: 'المسؤول العام', commune: 'ALL', role: 'admin' },
    { username: 'sla', password: 'sla2025', nom: 'مسؤول جماعة سلا', commune: 'سلا', role: 'responsable' },
    { username: 'bouknadel', password: 'bouknadel2025', nom: 'مسؤول جماعة سيدي أبي القنادل', commune: 'سيدي أبي القنادل', role: 'responsable' },
    { username: 'ameur', password: 'ameur2025', nom: 'مسؤول جماعة عامر', commune: 'عامر', role: 'responsable' },
    { username: 'sehoul', password: 'sehoul2025', nom: 'مسؤول جماعة السهول', commune: 'السهول', role: 'responsable' },
  ]
  for (const user of users) {
    const existing = await prisma.user.findUnique({ where: { username: user.username } })
    if (existing) {
      counted('users')
      continue
    }
    await prisma.user.create({
      data: {
        username: user.username,
        password: hashPassword(user.password),
        nom: user.nom,
        commune: user.commune,
        role: user.role,
        managedCommunes: user.commune === 'ALL' ? '[]' : JSON.stringify([user.commune]),
        actif: true,
      },
    })
    counted('users')
  }
}

async function seedCommune(commune) {
  const quartier = await ensureQuartier(commune)
  const agent = await ensureAgent(commune)
  const point = {
    quartier: quartier.nom,
    latitude: commune.latitude,
    longitude: commune.longitude,
    commune: commune.name,
  }

  const interventions = {}
  for (const [index, type] of types.entries()) {
    const reference = `SEED-INT-${YEAR}-${commune.code}-${type.code}`
    await upsertReference('intervention', reference, {
      type: type.value,
      gisLayer: type.value === 'DERATISATION' ? 'deratisation' : type.value === 'DESINSECTISATION' ? 'desinsectisation' : 'desinfection',
      date: date(8 + index * 7, index),
      quartier: point.quartier,
      adresse: `نقطة تجريبية ${YEAR} — ${commune.name}`,
      commune: point.commune,
      latitude: point.latitude + index * 0.001,
      longitude: point.longitude + index * 0.001,
      statut: index === 0 ? 'TERMINEE' : index === 1 ? 'EN_COURS' : 'PLANIFIEE',
      description: `تدخل تجريبي لسنة ${YEAR} في طبقة ${type.value}`,
      agentNom: `${agent.nom} ${agent.prenom}`,
      produitUtilise: type.product,
      quantite: index === 2 ? '20 لتر' : '10 كيلوغرام',
      superficie: '500 متر مربع',
      nombrePrestations: 1 + index,
      observations: 'بيانات افتراضية قابلة للتعديل من المنصة',
    }, 'interventions')
    interventions[type.value] = await prisma.intervention.findUnique({ where: { reference } })
  }

  const complaintReference = `SEED-PL-${YEAR}-${commune.code}`
  await upsertReference('complaint', complaintReference, {
    nomCitoyen: 'مواطن تجريبي',
    telephone: '0600000000',
    email: '',
    adresse: point.quartier,
    quartier: point.quartier,
    commune: point.commune,
    type: 'DERATISATION',
    description: `بلاغ تجريبي مرتبط بسنة ${YEAR}`,
    priorite: 'NORMALE',
    statut: 'TRAITEE',
    source: 'INTERNAL',
    latitude: point.latitude,
    longitude: point.longitude,
    interventionId: interventions.DERATISATION.id,
    dateReception: date(12, 1),
    dateTraitement: date(14, 1),
    observations: 'بيانات افتراضية للعرض والاختبار',
  }, 'complaints')
  const complaint = await prisma.complaint.findUnique({ where: { reference: complaintReference } })

  const workOrderReference = `SEED-OT-${YEAR}-${commune.code}`
  await upsertReference('workOrder', workOrderReference, {
    commune: point.commune,
    title: `أمر عمل تجريبي ${YEAR}`,
    description: 'أمر عمل افتراضي مرتبط ببلاغ وتدخل تجريبي',
    priority: 'NORMALE',
    status: 'TERMINE',
    complaintId: complaint.id,
    interventionId: interventions.DERATISATION.id,
    assignedAgentId: agent.id,
    scheduledFor: date(16, 1),
    completedAt: date(17, 1),
    latitude: point.latitude,
    longitude: point.longitude,
    createdBy: 'seed-2025',
  }, 'workOrders')
  const workOrder = await prisma.workOrder.findUnique({ where: { reference: workOrderReference } })

  const establishmentReference = `SEED-EST-${YEAR}-${commune.code}`
  await upsertReference('establishment', establishmentReference, {
    name: `منشأة تجريبية ${commune.name}`,
    activity: 'مطعم',
    category: 'II',
    ownerName: 'مستغل تجريبي',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.002,
    longitude: point.longitude + 0.002,
    status: 'ACTIVE',
    riskCategory: 'MEDIUM',
    riskScore: 35,
    description: `منشأة افتراضية لسنة ${YEAR}`,
  }, 'establishments')
  const establishment = await prisma.establishment.findUnique({ where: { reference: establishmentReference } })

  await upsertReference('inspection', `SEED-INSP-${YEAR}-${commune.code}`, {
    establishmentId: establishment.id,
    type: 'PERIODIC',
    commune: point.commune,
    inspectionDate: date(20, 2),
    inspectorName: `${agent.nom} ${agent.prenom}`,
    overallResult: 'CONFORM',
    riskScore: 35,
    checklistJson: JSON.stringify({ CLEANLINESS: 'CONFORM' }),
    status: 'COMPLETED',
  }, 'inspections')
  await upsertReference('healthCard', `SEED-CS-${YEAR}-${commune.code}`, {
    workerName: 'عامل تجريبي',
    establishmentId: establishment.id,
    occupation: 'مستخدم مطعم',
    commune: point.commune,
    cardNumber: `CS-${YEAR}-${commune.code}`,
    issueDate: date(5, 2),
    expiryDate: date(5, 1),
    examinationDate: date(4, 2),
    status: 'VALID',
  }, 'healthCards')
  await upsertReference('sample', `SEED-ECH-${YEAR}-${commune.code}`, {
    establishmentId: establishment.id,
    commune: point.commune,
    product: 'ماء الشرب',
    sampleDate: date(22, 2),
    reason: 'مراقبة دورية',
    collectorName: `${agent.nom} ${agent.prenom}`,
    laboratory: 'مختبر تجريبي',
    requestedTests: 'تحاليل ميكروبيولوجية',
    resultsJson: JSON.stringify({ result: 'CONFORM' }),
    conformity: 'CONFORM',
  }, 'samples')

  const waterPointReference = `SEED-PE-${YEAR}-${commune.code}`
  await upsertReference('waterPoint', waterPointReference, {
    name: `نقطة مياه تجريبية ${commune.name}`,
    type: 'NETWORK',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.003,
    longitude: point.longitude - 0.002,
    operator: 'الجماعة الترابية',
    status: 'ACTIVE',
  }, 'waterPoints')
  const waterPoint = await prisma.waterPoint.findUnique({ where: { reference: waterPointReference } })
  await upsertReference('waterMeasurement', `SEED-MES-${YEAR}-${commune.code}`, {
    waterPointId: waterPoint.id,
    commune: point.commune,
    sampleNumber: `MES-${YEAR}-${commune.code}`,
    measurementDate: date(25, 2),
    chlorineResidual: 0.5,
    ph: 7.2,
    temperature: 20,
    turbidity: 0.8,
    labTestsJson: JSON.stringify({ ecoli: 0, totalColiforms: 0 }),
    conformity: 'CONFORM',
    collectorName: `${agent.nom} ${agent.prenom}`,
    laboratory: 'مختبر المياه التجريبي',
  }, 'waterMeasurements')
  await upsertReference('pool', `SEED-PISC-${YEAR}-${commune.code}`, {
    name: `مسبح تجريبي ${commune.name}`,
    type: 'SWIMMING',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude - 0.002,
    longitude: point.longitude + 0.003,
    operator: 'الجماعة الترابية',
    status: 'ACTIVE',
    waterType: 'TREATED',
    lastPh: 7.3,
    lastChlorine: 1.1,
    lastInspection: date(26, 2),
  }, 'pools')
  await upsertReference('sanitationIncident', `SEED-ASS-${YEAR}-${commune.code}`, {
    type: 'BLOCKAGE',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude - 0.003,
    longitude: point.longitude - 0.003,
    description: `حادث صرف صحي تجريبي لسنة ${YEAR}`,
    riskLevel: 'MEDIUM',
    source: 'INTERNAL',
    status: 'CLOSED',
    assignedTo: `${agent.nom} ${agent.prenom}`,
    resolution: 'تمت المعالجة',
    closedAt: date(28, 2),
  }, 'sanitation')

  await upsertReference('pollutionIncident', `SEED-POL-${YEAR}-${commune.code}`, {
    type: 'AIR',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.004,
    longitude: point.longitude - 0.003,
    description: `رصد بيئي تجريبي لسنة ${YEAR}`,
    source: 'INTERNAL',
    pollutantName: 'غبار',
    severity: 'LOW',
    status: 'CLOSED',
    mitigation: 'المراقبة الدورية',
  }, 'pollution')
  await upsertReference('wasteBlackSpot', `SEED-DEP-${YEAR}-${commune.code}`, {
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude - 0.004,
    longitude: point.longitude + 0.004,
    description: `نقطة نفايات تجريبية لسنة ${YEAR}`,
    wasteType: 'MIXED',
    recurring: true,
    recurrenceCount: 2,
    source: 'INTERNAL',
    status: 'MONITORING',
    notes: 'بيانات افتراضية للعرض',
  }, 'waste')
  await upsertReference('naturalSite', `SEED-SITE-${YEAR}-${commune.code}`, {
    name: `موقع طبيعي تجريبي ${commune.name}`,
    type: 'PARK',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.005,
    longitude: point.longitude + 0.004,
    area: 2.5,
    description: `موقع طبيعي افتراضي لسنة ${YEAR}`,
    protectionLevel: 'LOCAL',
    status: 'PROTECTED',
  }, 'sites')
  await upsertReference('environmentalDossier', `SEED-ENV-${YEAR}-${commune.code}`, {
    title: `ملف بيئي تجريبي ${commune.name}`,
    category: 'OTHER',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude - 0.005,
    longitude: point.longitude - 0.004,
    description: `ملف بيئي افتراضي لسنة ${YEAR}`,
    riskScore: 20,
    riskLevel: 'LOW',
    priority: 'NORMALE',
    status: 'CLOSED',
    progress: 100,
  }, 'environmentalDossiers')

  const missionReference = `SEED-MIS-CSVR-${YEAR}-${commune.code}`
  await upsertReference('captureMission', missionReference, {
    commune: point.commune,
    quartier: point.quartier,
    latitude: point.latitude + 0.006,
    longitude: point.longitude,
    zone: `منطقة تجريبية ${commune.name}`,
    scheduledAt: date(10, 3),
    priority: 'NORMALE',
    statut: 'TERMINEE',
    teamLead: `${agent.nom} ${agent.prenom}`,
    agents: JSON.stringify([`${agent.nom} ${agent.prenom}`]),
    estimatedAnimals: 2,
    observedCount: 2,
    capturedCount: 1,
    completedAt: date(10, 3),
    createdBy: 'seed-2025',
  }, 'captureMissions')
  const mission = await prisma.captureMission.findUnique({ where: { reference: missionReference } })
  const strayReportReference = `SEED-SIG-CSVR-${YEAR}-${commune.code}`
  await upsertReference('strayReport', strayReportReference, {
    source: 'INTERNAL',
    declarantName: 'عون تجريبي',
    commune: point.commune,
    quartier: point.quartier,
    secteur: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.006,
    longitude: point.longitude,
    species: 'DOG',
    estimatedCount: 2,
    nearMarket: true,
    description: `بلاغ حيوان شارد تجريبي لسنة ${YEAR}`,
    priority: 'NORMALE',
    statut: 'TRAITE',
    missionId: mission.id,
  }, 'animals')
  const strayReport = await prisma.strayReport.findUnique({ where: { reference: strayReportReference } })
  await upsertReference('strayAnimal', `SEED-ANIMAL-${YEAR}-${commune.code}`, {
    species: 'DOG',
    sex: 'UNKNOWN',
    estimatedAge: 'بالغ',
    size: 'MEDIUM',
    primaryColor: 'بني',
    reportId: strayReport.id,
    missionId: mission.id,
    captureDate: date(10, 3),
    captureLocation: point.quartier,
    captureQuartier: point.quartier,
    captureLatitude: point.latitude + 0.006,
    captureLongitude: point.longitude,
    capturedBy: `${agent.nom} ${agent.prenom}`,
    captureState: 'هادئ',
    statut: 'CAPTURE',
    commune: point.commune,
    createdBy: 'seed-2025',
  }, 'capturedAnimals', 'csvrNumber')
  await upsertReference('biteCase', `SEED-MORS-${YEAR}-${commune.code}`, {
    victimName: 'حالة تجريبية',
    animalType: 'DOG',
    animalStatus: 'STRAY',
    animalDescription: 'حيوان غير معروف',
    biteDate: date(12, 3),
    biteLocation: point.quartier,
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude - 0.006,
    longitude: point.longitude,
    description: `حالة عض تجريبية لسنة ${YEAR}`,
    source: 'INTERNAL',
    status: 'CLOSED',
    reportingDate: date(12, 3),
    followUpNotes: 'تمت المتابعة الإدارية',
    strayReportId: strayReport.id,
  }, 'biteCases')

  const cemeteryReference = `SEED-CIM-${YEAR}-${commune.code}`
  await upsertReference('cemetery', cemeteryReference, {
    name: `مقبرة تجريبية ${commune.name}`,
    type: 'MUSLIM',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: commune.latitude - 0.007,
    longitude: commune.longitude - 0.004,
    capacity: 1000,
    occupied: 120,
    sectionsJson: JSON.stringify(['A', 'B']),
    status: 'ACTIVE',
  }, 'cemeteries')
  const cemetery = await prisma.cemetery.findUnique({ where: { reference: cemeteryReference } })
  await upsertReference('burialDossier', `SEED-DEF-${YEAR}-${commune.code}`, {
    deceasedName: 'بيانات دفن تجريبية',
    commune: point.commune,
    cemeteryId: cemetery.id,
    plotSection: 'A-001',
    burialDate: date(18, 3),
    authorizationStatus: 'APPROVED',
    status: 'BURIED',
  }, 'burials')
  await upsertReference('exhumationDossier', `SEED-EXH-${YEAR}-${commune.code}`, {
    deceasedName: 'بيانات نبش تجريبية',
    commune: point.commune,
    cemeteryId: cemetery.id,
    plotSection: 'B-001',
    originalBurialDate: date(1, 3),
    exhumationDate: date(22, 3),
    reason: 'إجراء إداري تجريبي',
    newDestination: 'وجهة تجريبية',
    authorizationStatus: 'APPROVED',
    status: 'COMPLETED',
  }, 'exhumations')

  const foodReportReference = `SEED-FOOD-${YEAR}-${commune.code}`
  await upsertReference('foodReport', foodReportReference, {
    source: 'INTERNAL',
    declarantName: 'مبلغ تجريبي',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.002,
    longitude: point.longitude + 0.002,
    reportType: 'RESTAURANT',
    establishmentName: `منشأة تجريبية ${commune.name}`,
    establishmentType: 'مطعم',
    description: `بلاغ غذائي تجريبي لسنة ${YEAR}`,
    priority: 'NORMALE',
    statut: 'TRAITE',
  }, 'foodReports')
  const foodReport = await prisma.foodReport.findUnique({ where: { reference: foodReportReference } })
  await upsertReference('dossier', `SEED-DOS-${YEAR}-${commune.code}`, {
    office: 'OFFICE_09',
    type: '3D_INTERVENTION',
    title: `ملف موحد تجريبي ${commune.name}`,
    description: `ملف موحد مرتبط ببيانات سنة ${YEAR}`,
    status: 'CLOSED',
    priority: 'NORMALE',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude,
    longitude: point.longitude,
    interventionId: interventions.DERATISATION.id,
    complaintId: complaint.id,
    workOrderId: workOrder.id,
    strayReportId: strayReport.id,
    foodReportId: foodReport.id,
    createdBy: 'seed-2025',
    createdByName: 'Seeder 2025',
  }, 'dossiers')

  const campaignReference = `SEED-CAMP-${YEAR}-${commune.code}`
  await upsertReference('campagne', campaignReference, {
    nom: `حملة صحية تجريبية ${commune.name}`,
    type: 'MIXTE',
    commune: point.commune,
    description: `حملة افتراضية موحدة لسنة ${YEAR}`,
    objectif: 'اختبار دورة تدبير الحملات والتدخلات',
    budgetPrevu: 25000,
    dateDebut: date(1, 0),
    dateFin: date(31, 11),
    statut: 'TERMINEE',
    responsable: `${agent.nom} ${agent.prenom}`,
    couleur: '#10b981',
  }, 'campagnes')
  const campaign = await prisma.campagne.findUnique({ where: { reference: campaignReference } })
  await prisma.intervention.update({ where: { id: interventions.DERATISATION.id }, data: { campagneId: campaign.id } })

  const products = []
  for (const [index, type] of types.entries()) {
    const productReference = `SEED-PRD-${YEAR}-${commune.code}-${type.code}`
    await upsertReference('product', productReference, {
      nom: `${type.product} ${commune.name}`,
      categorie: type.value,
      commune: point.commune,
      unite: type.value === 'DESINFECTION' ? 'لتر' : 'كيلوغرام',
      quantiteStock: 100 - index * 15,
      seuilAlerte: 10,
      prixUnitaire: 50 + index * 20,
      fournisseur: 'مورد تجريبي',
      description: `مادة افتراضية لسنة ${YEAR}`,
    }, 'products')
    products.push(await prisma.product.findUnique({ where: { reference: productReference } }))
  }
  for (const [index, type] of types.entries()) {
    await ensureByFields('interventionMaterial', {
      interventionId: interventions[type.value].id,
      productId: products[index].id,
    }, {
      interventionId: interventions[type.value].id,
      productId: products[index].id,
      quantity: 5 + index,
    }, 'interventionMaterials')
    await ensureByFields('stockMovement', {
      productId: products[index].id,
      type: 'IN',
      quantity: 100 - index * 15,
      commune: point.commune,
      note: `رصيد افتتاحي ${YEAR}`,
    }, {
      productId: products[index].id,
      type: 'IN',
      quantity: 100 - index * 15,
      reason: 'initial',
      note: `رصيد افتتاحي ${YEAR}`,
      commune: point.commune,
      createdAt: date(2, 0),
    }, 'stockMovements')
  }

  await ensureByFields('communeSettings', { commune: point.commune }, {
    commune: point.commune,
    settings: JSON.stringify({ seedYear: YEAR, mapEnabled: true, defaultLayer: 'interventions' }),
  }, 'communeSettings')
  await ensureByFields('csvrSettings', { commune: point.commune }, {
    commune: point.commune,
    settings: JSON.stringify({ seedYear: YEAR, shelters: ['مركز تجريبي'], centers: ['مركز بيطري تجريبي'] }),
  }, 'csvrSettings')

  const document = await ensureByFields('document', { reference: `SEED-DOC-${YEAR}-${commune.code}` }, {
    titre: `محضر تدخل تجريبي ${YEAR}`,
    description: 'وثيقة افتراضية مرتبطة بالتدخل لأغراض الاختبار',
    categorie: 'محاضر',
    commune: point.commune,
    nomFichier: `seed-${YEAR}-${commune.code}.pdf`,
    cheminFichier: `seed/${YEAR}/seed-${commune.code}.pdf`,
    typeFichier: 'pdf',
    tailleFichier: 0,
    reference: `SEED-DOC-${YEAR}-${commune.code}`,
    dateDocument: date(3, 0),
    uploadedBy: 'seed-2025',
  }, 'documents')
  await ensureByFields('interventionDocument', {
    interventionId: interventions.DERATISATION.id,
    documentId: document.id,
  }, {
    interventionId: interventions.DERATISATION.id,
    documentId: document.id,
  }, 'interventionDocuments')
  await ensureByFields('complaintContact', {
    complaintId: complaint.id,
    channel: 'PHONE',
    contactedBy: 'seed-2025',
  }, {
    complaintId: complaint.id,
    channel: 'PHONE',
    outcome: 'RESOLVED',
    notes: 'تم التواصل بنجاح',
    contactedAt: date(15, 1),
    contactedBy: 'seed-2025',
  }, 'complaintContacts')
  await ensureByFields('interventionComment', {
    interventionId: interventions.DERATISATION.id,
    authorName: 'Seeder 2025',
    content: `ملاحظة تجريبية لسنة ${YEAR}`,
  }, {
    interventionId: interventions.DERATISATION.id,
    authorName: 'Seeder 2025',
    authorRole: 'admin',
    content: `ملاحظة تجريبية لسنة ${YEAR}`,
    type: 'COMMENT',
  }, 'interventionComments')
  await ensureByFields('activityLog', {
    action: 'CREATE',
    entityType: 'INTERVENTION',
    entityId: interventions.DERATISATION.id,
    commune: point.commune,
  }, {
    action: 'CREATE',
    entityType: 'INTERVENTION',
    entityId: interventions.DERATISATION.id,
    userName: 'Seeder 2025',
    details: JSON.stringify({ source: 'seed', year: YEAR }),
    commune: point.commune,
    createdAt: date(8, 0),
  }, 'activityLogs')

  const inspection = await prisma.inspection.findUnique({ where: { reference: `SEED-INSP-${YEAR}-${commune.code}` } })
  await ensureByFields('finding', {
    inspectionId: inspection.id,
    category: 'CLEANLINESS',
    description: `ملاحظة تفتيش تجريبية ${YEAR}`,
  }, {
    inspectionId: inspection.id,
    category: 'CLEANLINESS',
    description: `ملاحظة تفتيش تجريبية ${YEAR}`,
    severity: 'MINOR',
    weight: 1,
    status: 'CORRECTED',
  }, 'findings')
  await ensureByFields('correctiveAction', {
    inspectionId: inspection.id,
    description: `إجراء تصحيحي تجريبي ${YEAR}`,
  }, {
    inspectionId: inspection.id,
    description: `إجراء تصحيحي تجريبي ${YEAR}`,
    responsible: `${agent.nom} ${agent.prenom}`,
    deadline: date(25, 2),
    status: 'DONE',
    verifiedAt: date(27, 2),
    verifiedBy: `${agent.nom} ${agent.prenom}`,
  }, 'correctiveActions')
  await ensureByFields('counterVisit', {
    inspectionId: inspection.id,
    visitorName: `${agent.nom} ${agent.prenom}`,
    visitDate: date(28, 2),
  }, {
    inspectionId: inspection.id,
    visitDate: date(28, 2),
    visitorName: `${agent.nom} ${agent.prenom}`,
    result: 'CONFORM',
    findingsResolved: '1',
    notes: 'تم إغلاق الملاحظة التجريبية',
  }, 'counterVisits')

  const pestProductReference = `SEED-PP-${YEAR}-${commune.code}`
  await upsertReference('pestProduct', pestProductReference, {
    commercialName: `مبيد تجريبي ${commune.name}`,
    activeSubstance: 'مادة فعالة تجريبية',
    category: 'RODENTICIDE',
    formulation: 'حبيبات',
    concentration: '0.005%',
    lotNumber: `LOT-${YEAR}-${commune.code}`,
    unit: 'KG',
    quantityStock: 80,
    thresholdAlert: 10,
    expiryDate: date(31, 11),
    target: 'rats',
    supplier: 'مورد مبيدات تجريبي',
    unitPrice: 120,
    commune: point.commune,
    description: `مبيد افتراضي لسنة ${YEAR}`,
  }, 'pestProducts')
  const pestProduct = await prisma.pestProduct.findUnique({ where: { reference: pestProductReference } })
  await ensureByFields('pestStockMovement', {
    productId: pestProduct.id,
    type: 'ENTREE',
    quantity: 80,
    commune: point.commune,
    interventionRef: interventions.DERATISATION.reference,
  }, {
    productId: pestProduct.id,
    type: 'ENTREE',
    quantity: 80,
    reason: 'رصيد افتتاحي',
    interventionRef: interventions.DERATISATION.reference,
    commune: point.commune,
    userName: 'Seeder 2025',
    createdAt: date(4, 0),
  }, 'pestStockMovements')

  const animal = await prisma.strayAnimal.findUnique({ where: { csvrNumber: `SEED-ANIMAL-${YEAR}-${commune.code}` } })
  await ensureByFields('strayAnimalStatus', {
    animalId: animal.id,
    toStatus: 'CAPTURE',
    changedBy: 'seed-2025',
  }, {
    animalId: animal.id,
    fromStatus: 'SIGNALISE',
    toStatus: 'CAPTURE',
    reason: 'تم التقاط الحيوان ضمن المهمة التجريبية',
    changedBy: 'seed-2025',
    notes: `حالة سنة ${YEAR}`,
    createdAt: date(10, 3),
  }, 'animalStatuses')

  const deathReference = `SEED-DEC-${YEAR}-${commune.code}`
  await upsertReference('deathCase', deathReference, {
    deceasedName: 'حالة وفاة تجريبية',
    deathDate: date(5, 4),
    deathPlace: point.quartier,
    commune: point.commune,
    morgueStatus: 'RELEASED',
    source: 'INTERNAL',
    declarantName: 'مبلغ تجريبي',
    status: 'BURIED',
    notes: `بيانات افتراضية لسنة ${YEAR}`,
  }, 'deathCases')
  const deathCase = await prisma.deathCase.findUnique({ where: { reference: deathReference } })
  const burial = await prisma.burialDossier.findUnique({ where: { reference: `SEED-DEF-${YEAR}-${commune.code}` } })
  await prisma.burialDossier.update({ where: { id: burial.id }, data: { deathCaseId: deathCase.id } })
  await prisma.deathCase.update({ where: { id: deathCase.id }, data: { burialId: burial.id } })
  await upsertReference('corpseTransport', `SEED-TRANS-${YEAR}-${commune.code}`, {
    deceasedName: 'حالة وفاة تجريبية',
    commune: point.commune,
    originPlace: 'مستشفى تجريبي',
    destinationPlace: `مقبرة تجريبية ${commune.name}`,
    transportDate: date(6, 4),
    vehiclePlate: `TEST-${commune.code}`,
    driverName: 'سائق تجريبي',
    authorizationStatus: 'APPROVED',
    authorizedBy: 'مسؤول تجريبي',
    authorizedAt: date(5, 4),
    deathCaseId: deathCase.id,
    status: 'COMPLETED',
  }, 'corpseTransports')

  await upsertReference('awarenessCampaign', `SEED-CAMP-ENV-${YEAR}-${commune.code}`, {
    title: `حملة توعية بيئية ${commune.name}`,
    theme: 'WASTE_REDUCTION',
    commune: point.commune,
    description: `حملة توعوية افتراضية لسنة ${YEAR}`,
    targetAudience: 'السكان',
    startDate: date(1, 5),
    endDate: date(30, 5),
    budget: 10000,
    participantsCount: 80,
    organizerName: 'قسم الوقاية وحفظ الصحة',
    status: 'COMPLETED',
    outcomes: 'تم تنفيذ النشاط التجريبي',
  }, 'awarenessCampaigns')

  const authorizationReference = `SEED-AUT-${YEAR}-${commune.code}`
  await upsertReference('authorizationDossier', authorizationReference, {
    applicantName: 'طالب ترخيص تجريبي',
    applicantPhone: '0600000000',
    establishmentName: establishment.name,
    activity: 'مطعم',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    requestType: 'COMMERCIAL',
    opinionStatus: 'FAVORABLE',
    opinionDate: date(10, 5),
    opinionNotes: 'رأي تجريبي قابل للمراجعة',
    competentAuthority: 'قسم الوقاية وحفظ الصحة',
    status: 'OPINION_ISSUED',
    checklistJson: JSON.stringify(['بطاقة التعريف', 'التصميم', 'شهادة المطابقة']),
  }, 'authorizationDossiers')
  const authorization = await prisma.authorizationDossier.findUnique({ where: { reference: authorizationReference } })
  await upsertReference('sanitaryOpinion', `SEED-AVIS-${YEAR}-${commune.code}`, {
    dossierId: authorization.id,
    establishmentName: establishment.name,
    commune: point.commune,
    opinionType: 'COMMERCIAL',
    result: 'FAVORABLE',
    date: date(10, 5),
    inspectorName: `${agent.nom} ${agent.prenom}`,
    observations: 'المعطيات مطابقة في النموذج التجريبي',
    validationStatus: 'APPROVED',
    validatedBy: `${agent.nom} ${agent.prenom}`,
    validatedAt: date(11, 5),
  }, 'sanitaryOpinions')
  await upsertReference('committeeVisit', `SEED-VIS-${YEAR}-${commune.code}`, {
    dossierId: authorization.id,
    establishmentName: establishment.name,
    commune: point.commune,
    visitDate: date(12, 5),
    participantsJson: JSON.stringify([`${agent.nom} ${agent.prenom}`, 'عضو لجنة تجريبي']),
    inspectionNotes: 'زيارة لجنة تجريبية',
    findingsJson: JSON.stringify([]),
    recommendation: 'FAVORABLE',
    validationStatus: 'APPROVED',
    validatedBy: `${agent.nom} ${agent.prenom}`,
    validatedAt: date(12, 5),
    status: 'COMPLETED',
  }, 'committeeVisits')

  const dossier = await prisma.dossier.findUnique({ where: { reference: `SEED-DOS-${YEAR}-${commune.code}` } })
  await ensureByFields('dossierEvent', {
    dossierId: dossier.id,
    toStatus: 'CLOSED',
    action: 'CREATE',
  }, {
    dossierId: dossier.id,
    toStatus: 'CLOSED',
    action: 'CREATE',
    reason: 'إنشاء ملف تجريبي مكتمل',
    changedByName: 'Seeder 2025',
    metadata: JSON.stringify({ year: YEAR }),
    createdAt: date(20, 5),
  }, 'dossierEvents')
}

async function main() {
  await ensureUsers()
  for (const commune of communes) await seedCommune(commune)
  console.log(`تمت تهيئة بيانات المنصة والأقسام الافتراضية لسنة ${YEAR} دون حذف البيانات الحالية.`)
  console.table(counters)
}

main()
  .catch((error) => {
    console.error('فشل Seeder 2025:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
