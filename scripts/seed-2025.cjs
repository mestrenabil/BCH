/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

if (!process.env.DATABASE_URL) {
  const envPath = path.join(process.cwd(), '.env')
  if (fs.existsSync(envPath)) {
    const env = fs.readFileSync(envPath, 'utf8')
    const rawDatabaseUrl = env.match(/^DATABASE_URL=(.*)$/m)?.[1]?.trim()
    const databaseUrl = rawDatabaseUrl && ((rawDatabaseUrl.startsWith('"') && rawDatabaseUrl.endsWith('"')) || (rawDatabaseUrl.startsWith("'") && rawDatabaseUrl.endsWith("'")))
      ? rawDatabaseUrl.slice(1, -1)
      : rawDatabaseUrl
    if (databaseUrl) process.env.DATABASE_URL = databaseUrl
  }
}

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const requestedYear = Number(process.env.SEED_YEAR || '2025')
const requestedYears = String(process.env.SEED_YEARS || '')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value) && value >= 2020 && value <= 2100)
const YEARS = [...new Set(requestedYears.length > 0
  ? requestedYears
  : [Number.isInteger(requestedYear) && requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : 2025])]
const DEMO_ACTION = process.env.DEMO_ACTION === 'remove' ? 'remove' : 'seed'
let YEAR = YEARS[0]

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
    where: { commune: commune.name, nom: 'عون', prenom: `تجريبي ${commune.code}` },
  })
  if (existing) {
    counted('agents')
    return existing
  }
  const agent = await prisma.agent.create({
    data: {
      nom: 'عون',
      prenom: `تجريبي ${commune.code}`,
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
    createdBy: 'seed-demo',
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
  const inspection = await prisma.inspection.findUnique({ where: { reference: `SEED-INSP-${YEAR}-${commune.code}` } })
  const foodSample = await prisma.sample.findUnique({ where: { reference: `SEED-ECH-${YEAR}-${commune.code}` } })
  await upsertReference('temperatureLog', `SEED-TEMP-${YEAR}-${commune.code}`, {
    establishmentId: establishment.id,
    inspectionId: inspection.id,
    commune: point.commune,
    equipmentType: 'REFRIGERATOR',
    equipmentName: 'ثلاجة الحفظ التجريبية',
    product: 'منتجات طازجة',
    measuredAt: date(20, 2),
    temperature: 4,
    referenceMin: 0,
    referenceMax: 5,
    conformity: 'CONFORM',
    deviceCode: `SEED-THERMO-${commune.code}`,
    agentName: `${agent.nom} ${agent.prenom}`,
    notes: `قياس تجريبي لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'temperatureLogs')
  await upsertReference('foodProduct', `SEED-FPROD-${YEAR}-${commune.code}`, {
    establishmentId: establishment.id,
    inspectionId: inspection.id,
    commune: point.commune,
    product: 'منتج غذائي تجريبي',
    category: 'مواد طازجة',
    brand: 'علامة تجريبية',
    lot: `LOT-FOOD-${YEAR}-${commune.code}`,
    supplier: 'مورد غذائي تجريبي',
    receivedAt: date(15, 2),
    expiryDate: date(15, 8),
    quantity: 25,
    unit: 'kg',
    storage: 'تبريد',
    packagingCondition: 'سليمة',
    labelingStatus: 'CONFORM',
    traceabilityStatus: 'CONFORM',
    conformity: 'CONFORM',
    observedTemperature: 4,
    notes: `تتبع منتج افتراضي لسنة ${YEAR}`,
  }, 'foodProducts')
  await upsertReference('labResult', `SEED-LAB-FOOD-${YEAR}-${commune.code}`, {
    sampleId: foodSample.id,
    establishmentId: establishment.id,
    commune: point.commune,
    laboratory: 'مختبر مراقبة الأغذية التجريبي',
    receivedAt: date(23, 2),
    analyzedAt: date(25, 2),
    parameter: 'الجراثيم الهوائية',
    resultValue: 'ضمن الحدود',
    unit: 'UFC/g',
    method: 'طريقة تحليل مخبرية تجريبية',
    referenceValue: 'قيمة مرجعية مهيأة',
    conformity: 'CONFORM',
    notes: `نتيجة تحليل افتراضية لسنة ${YEAR}`,
  }, 'labResults')
  await upsertReference('foodNonConformity', `SEED-NC-${YEAR}-${commune.code}`, {
    establishmentId: establishment.id,
    inspectionId: inspection.id,
    commune: point.commune,
    category: 'CLEANLINESS',
    description: 'ملاحظة بسيطة تم تصحيحها خلال الزيارة',
    level: 'MINOR',
    evidenceJson: JSON.stringify({ source: 'seed-demo' }),
    status: 'CLOSED',
    deadline: date(26, 2),
    responsible: 'مسؤول المنشأة التجريبي',
    correctiveAction: 'تنظيف وتعقيم مساحة التحضير',
    createdBy: 'seed-demo',
  }, 'foodNonConformities')
  await upsertReference('fryingOilCheck', `SEED-OIL-${YEAR}-${commune.code}`, {
    establishmentId: establishment.id,
    inspectionId: inspection.id,
    commune: point.commune,
    fryerName: 'مقلاة تجريبية',
    oilType: 'زيت نباتي',
    firstUseDate: date(18, 2),
    checkedAt: date(20, 2),
    appearance: 'صافي',
    color: 'ذهبي',
    odor: 'عادي',
    foam: 'غير موجودة',
    residues: 'قليلة',
    useTemperature: 175,
    tpmValue: 18,
    deviceCode: `SEED-OIL-METER-${commune.code}`,
    conformity: 'CONFORM',
    collector: `${agent.nom} ${agent.prenom}`,
    notes: `فحص زيت افتراضي لسنة ${YEAR}`,
  }, 'fryingOilChecks')

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
  const pool = await prisma.pool.findUnique({ where: { reference: `SEED-PISC-${YEAR}-${commune.code}` } })
  const sanitationIncident = await prisma.sanitationIncident.findUnique({ where: { reference: `SEED-ASS-${YEAR}-${commune.code}` } })
  await upsertReference('sanitationAsset', `SEED-ASS-AST-${YEAR}-${commune.code}`, {
    name: `قناة صرف تجريبية ${commune.name}`,
    type: 'SEWER_LINE',
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude - 0.0035,
    longitude: point.longitude - 0.0025,
    operator: 'الجماعة الترابية',
    status: 'ACTIVE',
    capacity: 1200,
    capacityUnit: 'm³/j',
    lastMaintenanceAt: date(2, 1),
    nextMaintenanceAt: date(2, 7),
    description: `منشأة تطهير سائل تجريبية لسنة ${YEAR}`,
  }, 'sanitationAssets')
  await upsertReference('waterLaboratory', `SEED-LAB-WATER-${YEAR}-${commune.code}`, {
    commune: point.commune,
    name: `مختبر مياه تجريبي ${commune.name}`,
    laboratoryType: 'PUBLIC',
    accreditationStatus: 'PENDING',
    accreditationReference: `SEED-ACC-${YEAR}-${commune.code}`,
    contactName: 'مسؤول مختبر تجريبي',
    phone: '0600000000',
    email: 'lab.seed@example.test',
    address: point.quartier,
    turnaroundDays: 3,
    parameters: 'pH, chlore, turbidité, microbiologie',
    active: true,
    notes: `مختبر افتراضي لسنة ${YEAR}`,
  }, 'waterLaboratories')
  await upsertReference('waterMonitoringProgram', `SEED-PRG-WATER-${YEAR}-${commune.code}`, {
    commune: point.commune,
    name: `برنامج مراقبة المياه ${YEAR}`,
    programType: 'QUALITY',
    objective: 'تتبع جودة مياه الشرب والمسابح',
    targetArea: point.quartier,
    responsible: `${agent.nom} ${agent.prenom}`,
    team: 'فريق المياه التجريبي',
    status: 'COMPLETED',
    startDate: date(1, 0),
    endDate: date(30, 10),
    frequencyDays: 30,
    targetCount: 12,
    completedCount: 12,
    notes: 'برنامج افتراضي للعرض والإحصائيات',
  }, 'waterPrograms')
  const waterSampleReference = `SEED-PREL-${YEAR}-${commune.code}`
  await upsertReference('waterSample', waterSampleReference, {
    waterPointId: waterPoint.id,
    commune: point.commune,
    sampleType: 'DRINKING_WATER',
    sampleDate: date(24, 2),
    sampleTime: '09:30',
    collectorName: `${agent.nom} ${agent.prenom}`,
    volumeMl: 500,
    containerType: 'قارورة معقمة',
    sterile: true,
    transportTemperature: 4,
    departureAt: date(24, 2),
    laboratoryArrivalAt: date(24, 2),
    laboratory: `مختبر مياه تجريبي ${commune.name}`,
    reason: 'مراقبة دورية',
    requestedTests: 'فيزيوكيميائية وميكروبيولوجية',
    observation: `عينة افتراضية لسنة ${YEAR}`,
    status: 'VALIDATED',
    laboratoryResult: 'CONFORM',
    resultReceivedAt: date(26, 2),
    validatedBy: `${agent.nom} ${agent.prenom}`,
    validatedAt: date(27, 2),
    validationNote: 'نتيجة مطابقة تجريبية',
  }, 'waterSamples')
  const waterSample = await prisma.waterSample.findUnique({ where: { reference: waterSampleReference } })
  await ensureByFields('waterSampleEvent', {
    sampleId: waterSample.id,
    action: 'VALIDATED',
    actorName: 'Seeder demo',
  }, {
    sampleId: waterSample.id,
    action: 'VALIDATED',
    actorId: 'seed-demo',
    actorName: 'Seeder demo',
    occurredAt: date(27, 2),
    note: `اكتمال سلسلة العينة التجريبية لسنة ${YEAR}`,
  }, 'waterSampleEvents')
  const waterInspectionReference = `SEED-INS-WATER-${YEAR}-${commune.code}`
  await upsertReference('waterInspection', waterInspectionReference, {
    waterPointId: waterPoint.id,
    sampleId: waterSample.id,
    commune: point.commune,
    inspectionDate: date(24, 2),
    inspectorName: `${agent.nom} ${agent.prenom}`,
    checklistJson: JSON.stringify({ sourceProtected: true, chlorineChecked: true }),
    observation: 'وضعية سليمة في المعاينة التجريبية',
    probability: 1,
    severity: 1,
    riskScore: 10,
    riskLevel: 'LOW',
    conformity: 'CONFORM',
    correctiveAction: 'مواصلة المراقبة الدورية',
    followUpDate: date(24, 5),
    status: 'CLOSED',
    closedAt: date(27, 2),
  }, 'waterInspections')
  const waterInspection = await prisma.waterInspection.findUnique({ where: { reference: waterInspectionReference } })
  await upsertReference('waterDevice', `SEED-DEV-WATER-${YEAR}-${commune.code}`, {
    commune: point.commune,
    waterPointId: waterPoint.id,
    name: 'جهاز متعدد القياسات التجريبي',
    type: 'MULTIMETER',
    serialNumber: `SEED-SN-${YEAR}-${commune.code}`,
    manufacturer: 'مصنع تجريبي',
    model: 'BCH-DEMO',
    status: 'ACTIVE',
    calibrationDueDate: date(20, 10),
    notes: `جهاز افتراضي لسنة ${YEAR}`,
  }, 'waterDevices')
  const waterDevice = await prisma.waterDevice.findUnique({ where: { reference: `SEED-DEV-WATER-${YEAR}-${commune.code}` } })
  await ensureByFields('waterDeviceCalibration', {
    deviceId: waterDevice.id,
    certificateReference: `SEED-CAL-${YEAR}-${commune.code}`,
  }, {
    deviceId: waterDevice.id,
    calibrationDate: date(10, 0),
    nextDueDate: date(10, 10),
    performedBy: 'مختبر المعايرة التجريبي',
    certificateReference: `SEED-CAL-${YEAR}-${commune.code}`,
    result: 'CONFORM',
    notes: 'معايرة افتراضية ناجحة',
  }, 'waterDeviceCalibrations')
  await prisma.waterMeasurement.update({
    where: { reference: `SEED-MES-${YEAR}-${commune.code}` },
    data: { sampleId: waterSample.id, deviceId: waterDevice.id },
  })
  await upsertReference('waterAction', `SEED-ACT-WATER-${YEAR}-${commune.code}`, {
    waterPointId: waterPoint.id,
    inspectionId: waterInspection.id,
    sampleId: waterSample.id,
    sanitationIncidentId: sanitationIncident.id,
    commune: point.commune,
    actionType: 'CONTROL',
    priority: 'NORMAL',
    status: 'CLOSED',
    responsible: `${agent.nom} ${agent.prenom}`,
    plannedDate: date(24, 2),
    executedDate: date(25, 2),
    followUpDate: date(24, 5),
    measures: 'قياس الكلور وأخذ عينة',
    outcome: 'مطابق',
    observation: `إجراء مائي تجريبي لسنة ${YEAR}`,
    closedAt: date(27, 2),
  }, 'waterActions')
  await upsertReference('waterDisinfectionOperation', `SEED-DSV-WATER-${YEAR}-${commune.code}`, {
    poolId: pool.id,
    commune: point.commune,
    operationDate: date(26, 2),
    operationType: 'CHLORINATION',
    productName: 'هيبوكلوريت الصوديوم التجريبي',
    activeSubstance: 'Chlore actif',
    lotNumber: `SEED-CHL-${YEAR}-${commune.code}`,
    doseValue: 1.2,
    doseUnit: 'mg/L',
    treatedVolume: 500,
    volumeUnit: 'm³',
    residualBefore: 0.4,
    residualAfter: 1.1,
    contactTimeMin: 30,
    operator: `${agent.nom} ${agent.prenom}`,
    status: 'VERIFIED',
    result: 'CONFORM',
    observation: `عملية تعقيم افتراضية لسنة ${YEAR}`,
  }, 'waterDisinfection')
  await upsertReference('waterIncident', `SEED-INC-WATER-${YEAR}-${commune.code}`, {
    commune: point.commune,
    quartier: point.quartier,
    adresse: point.quartier,
    latitude: point.latitude + 0.0035,
    longitude: point.longitude - 0.0025,
    incidentType: 'LOW_PRESSURE',
    severity: 'LOW',
    source: 'INTERNAL',
    description: `حادث مياه تجريبي لسنة ${YEAR}`,
    affectedPopulation: 120,
    affectedPoints: 1,
    startedAt: date(5, 6),
    resolvedAt: date(5, 6),
    assignedTo: `${agent.nom} ${agent.prenom}`,
    status: 'CLOSED',
    response: 'تم التنسيق وإرجاع الضغط إلى مستواه العادي',
    notes: 'سجل افتراضي للعرض',
  }, 'waterIncidents')
  await upsertReference('waterEmergencyPlan', `SEED-URG-WATER-${YEAR}-${commune.code}`, {
    commune: point.commune,
    title: `خطة طوارئ المياه ${YEAR}`,
    planType: 'OUTAGE',
    trigger: 'انقطاع يتجاوز أربع ساعات',
    riskLevel: 'MEDIUM',
    status: 'CLOSED',
    responsible: `${agent.nom} ${agent.prenom}`,
    alternativeSource: 'صهريج ماء تجريبي',
    activatedAt: date(5, 6),
    targetCloseAt: date(6, 6),
    closedAt: date(5, 6),
    measures: 'تعبئة الصهريج وإخبار المصالح المعنية',
    communicationNote: 'إشعار تجريبي للسكان',
    notes: `خطة افتراضية لسنة ${YEAR}`,
  }, 'waterEmergencyPlans')
  await ensureByFields('waterThreshold', {
    commune: point.commune,
    parameter: `SEED_CHLORINE_${YEAR}`,
  }, {
    commune: point.commune,
    parameter: `SEED_CHLORINE_${YEAR}`,
    label: `حد الكلور التجريبي ${YEAR}`,
    unit: 'mg/L',
    minValue: 0.2,
    maxValue: 1.5,
    active: true,
    notes: 'قيمة تجريبية وليست مرجعًا قانونيًا',
  }, 'waterThresholds')

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
  const environmentalDossier = await prisma.environmentalDossier.findUnique({
    where: { reference: `SEED-ENV-${YEAR}-${commune.code}` },
  })
  await upsertReference('environmentalInspection', `SEED-EINS-${YEAR}-${commune.code}`, {
    environmentalDossierId: environmentalDossier.id,
    commune: point.commune,
    inspectionDate: date(12, 3),
    inspectorName: `${agent.nom} ${agent.prenom}`,
    observation: 'معاينة بيئية تجريبية مكتملة',
    probableSource: 'نشاط محلي محدود',
    extent: 'نطاق الحي',
    exposedPopulation: 40,
    milieu: 'AIR',
    probability: 1,
    severity: 2,
    riskScore: 20,
    riskLevel: 'LOW',
    resolution: 'YES',
    nextAction: 'المراقبة الدورية',
    nextFollowUpDate: date(12, 6),
    notes: `تفتيش افتراضي لسنة ${YEAR}`,
  }, 'environmentalInspections')
  await upsertReference('environmentalFollowUp', `SEED-EFOL-${YEAR}-${commune.code}`, {
    environmentalDossierId: environmentalDossier.id,
    commune: point.commune,
    followUpDate: date(20, 3),
    employeeName: `${agent.nom} ${agent.prenom}`,
    currentStatus: 'تمت المعالجة',
    damageRemoved: 'YES',
    notes: `متابعة بيئية تجريبية لسنة ${YEAR}`,
    nextAction: 'إغلاق الملف ومواصلة الرصد',
    nextFollowUpDate: date(20, 8),
  }, 'environmentalFollowUps')
  await upsertReference('environmentalProgram', `SEED-EPRG-${YEAR}-${commune.code}`, {
    year: YEAR,
    operation: 'مراقبة النقاط البيئية',
    axis: 'الحد من التلوث والنفايات',
    commune: point.commune,
    environmentalDossierId: environmentalDossier.id,
    quartier: point.quartier,
    objective: 'تحسين الرصد والاستجابة للشكايات البيئية',
    responsible: `${agent.nom} ${agent.prenom}`,
    startDate: date(1, 0),
    endDate: date(30, 10),
    budget: 15000,
    indicator: 'عدد عمليات الرصد المنجزة',
    quantitativeTarget: 12,
    achieved: 12,
    progress: 100,
    status: 'COMPLETED',
    notes: `برنامج بيئي افتراضي لسنة ${YEAR}`,
  }, 'environmentalPrograms')

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
    createdBy: 'seed-demo',
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
    createdBy: 'seed-demo',
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
  const seededAnimal = await prisma.strayAnimal.findUnique({
    where: { csvrNumber: `SEED-ANIMAL-${YEAR}-${commune.code}` },
  })
  const biteCase = await prisma.biteCase.findUnique({
    where: { reference: `SEED-MORS-${YEAR}-${commune.code}` },
  })
  const center = await ensureByFields('strayAnimalCenter', {
    name: `SEED مركز إيواء ${YEAR} ${commune.code}`,
    commune: point.commune,
  }, {
    name: `SEED مركز إيواء ${YEAR} ${commune.code}`,
    type: 'REFUGE',
    commune: point.commune,
    adresse: point.quartier,
    latitude: point.latitude + 0.0065,
    longitude: point.longitude + 0.001,
    responsible: `${agent.nom} ${agent.prenom}`,
    telephone: '0600000000',
    capacity: 40,
    status: 'ACTIVE',
    notes: `مركز افتراضي لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalCenters')
  await ensureByFields('strayAnimalAdmission', {
    animalId: seededAnimal.id,
    centerId: center.id,
    admittedAt: date(10, 3),
  }, {
    animalId: seededAnimal.id,
    centerId: center.id,
    admittedAt: date(10, 3),
    releasedAt: date(18, 3),
    boxOrZone: 'A-01',
    generalCondition: 'مستقرة',
    weight: 18,
    temperature: 38.5,
    observation: 'دخول تجريبي للمركز',
    agent: `${agent.nom} ${agent.prenom}`,
    createdBy: 'seed-demo',
  }, 'animalAdmissions')
  await ensureByFields('strayAnimalTransport', {
    animalId: seededAnimal.id,
    departureDate: date(10, 3),
    destination: center.name,
  }, {
    animalId: seededAnimal.id,
    departureDate: date(10, 3),
    departureTime: '11:00',
    arrivalDate: date(10, 3),
    arrivalTime: '11:30',
    vehicle: `SEED-CSVR-${commune.code}`,
    driver: 'سائق تجريبي',
    agent: `${agent.nom} ${agent.prenom}`,
    destination: center.name,
    animalCount: 1,
    notes: `نقل افتراضي لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalTransports')
  await ensureByFields('strayAnimalHealthAlert', {
    animalId: seededAnimal.id,
    reportedAt: date(11, 3),
    createdBy: 'seed-demo',
  }, {
    animalId: seededAnimal.id,
    reportedAt: date(11, 3),
    type: 'OTHER',
    urgency: 'NORMAL',
    clinicalSuspicion: false,
    vaccinationStatus: 'VACCINATED',
    measureTaken: 'فحص بيطري احترازي',
    healthServiceInformed: true,
    authorityInformed: false,
    resolvedAt: date(12, 3),
    notes: `تنبيه صحي تجريبي مغلق لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalHealthAlerts')
  await upsertReference('strayAnimalDeathReport', `SEED-CSVR-DEC-${YEAR}-${commune.code}`, {
    reportedAt: date(15, 4),
    species: 'DOG',
    quantity: 1,
    commune: point.commune,
    quartier: point.quartier,
    location: point.quartier,
    latitude: point.latitude + 0.007,
    longitude: point.longitude + 0.001,
    apparentCause: 'حادث سير تجريبي',
    accident: true,
    healthSuspicion: false,
    removalDate: date(15, 4),
    team: 'فريق CSVR التجريبي',
    destination: 'مرفق مهيأ',
    handlingMode: 'جمع صحي',
    observations: `سجل افتراضي لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalDeathReports')
  await upsertReference('strayAnimalHotspot', `SEED-CSVR-HOT-${YEAR}-${commune.code}`, {
    name: `نقطة تجمع تجريبية ${commune.name}`,
    commune: point.commune,
    quartier: point.quartier,
    location: point.quartier,
    latitude: point.latitude + 0.006,
    longitude: point.longitude - 0.001,
    priority: 'MODERATE',
    status: 'MONITORING',
    reportCount: 3,
    groupCount: 1,
    biteCount: 1,
    interventionCount: 2,
    lastReviewDate: date(10, 4),
    nextReviewDate: date(10, 7),
    resolutionNotes: 'برمجة مرور دوري للفريق',
    notes: `نقطة افتراضية لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalHotspots')
  await ensureByFields('strayPartner', {
    name: `SEED شريك بيطري ${YEAR} ${commune.code}`,
    commune: point.commune,
  }, {
    name: `SEED شريك بيطري ${YEAR} ${commune.code}`,
    type: 'VETERINARY',
    commune: point.commune,
    contact: 'طبيب بيطري تجريبي',
    telephone: '0600000000',
    email: 'partner.seed@example.test',
    status: 'ACTIVE',
    notes: `شريك افتراضي لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalPartners')
  await ensureByFields('strayAnimalIdentification', {
    type: 'MICROCHIP',
    number: `SEED-CHIP-${YEAR}-${commune.code}`,
  }, {
    animalId: seededAnimal.id,
    type: 'MICROCHIP',
    number: `SEED-CHIP-${YEAR}-${commune.code}`,
    date: date(13, 3),
    operator: 'طبيب بيطري تجريبي',
    notes: 'تعريف افتراضي للحيوان',
    createdBy: 'seed-demo',
  }, 'animalIdentifications')
  await ensureByFields('strayAnimalCareEvent', {
    animalId: seededAnimal.id,
    type: 'VACCINATION',
    date: date(13, 3),
  }, {
    animalId: seededAnimal.id,
    type: 'VACCINATION',
    date: date(13, 3),
    practitioner: 'طبيب بيطري تجريبي',
    facility: center.name,
    weight: 18,
    temperature: 38.5,
    generalCondition: 'جيدة',
    diagnosis: 'سليم ظاهريًا',
    treatment: 'تلقيح وقائي',
    vaccineName: 'لقاح تجريبي',
    vaccineLot: `SEED-VAC-${YEAR}-${commune.code}`,
    dose: '1 ml',
    nextDate: date(13, 9),
    notes: `رعاية افتراضية لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalCareEvents')
  await ensureByFields('strayAnimalDestination', {
    animalId: seededAnimal.id,
    type: 'RETURN',
    date: date(18, 3),
  }, {
    animalId: seededAnimal.id,
    type: 'RETURN',
    date: date(18, 3),
    time: '10:00',
    site: point.quartier,
    commune: point.commune,
    quartier: point.quartier,
    latitude: point.latitude + 0.006,
    longitude: point.longitude,
    structure: center.name,
    vaccinationConfirmed: true,
    sterilizationConfirmed: true,
    identificationConfirmed: true,
    notes: `وجهة افتراضية لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalDestinations')
  await ensureByFields('strayAnimalFollowUp', {
    animalId: seededAnimal.id,
    type: 'POST_RELEASE',
    createdBy: 'seed-demo',
  }, {
    animalId: seededAnimal.id,
    type: 'POST_RELEASE',
    scheduledDate: date(25, 3),
    visitDate: date(25, 3),
    status: 'COMPLETED',
    contactName: `${agent.nom} ${agent.prenom}`,
    welfareStatus: 'جيدة',
    location: point.quartier,
    outcome: 'استقرار الحالة',
    notes: `متابعة افتراضية لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalFollowUps')
  const strayCampaignReference = `SEED-CSVR-CAMP-${YEAR}-${commune.code}`
  await upsertReference('strayCampaign', strayCampaignReference, {
    year: YEAR,
    type: 'VACCINATION',
    name: `حملة CSVR تجريبية ${YEAR}`,
    commune: point.commune,
    zone: point.quartier,
    objective: 'التلقيح والتعريف بالحيوانات',
    responsible: `${agent.nom} ${agent.prenom}`,
    partners: 'شريك بيطري تجريبي',
    startDate: date(1, 3),
    endDate: date(30, 3),
    indicator: 'عدد الحيوانات المستفيدة',
    quantitativeTarget: 20,
    achieved: 18,
    status: 'COMPLETED',
    notes: `حملة افتراضية لسنة ${YEAR}`,
    createdBy: 'seed-demo',
  }, 'animalCampaigns')
  const strayCampaign = await prisma.strayCampaign.findUnique({ where: { reference: strayCampaignReference } })
  await ensureByFields('strayCampaignActivity', {
    campaignId: strayCampaign.id,
    date: date(13, 3),
    type: 'VACCINATION',
  }, {
    campaignId: strayCampaign.id,
    date: date(13, 3),
    type: 'VACCINATION',
    zone: point.quartier,
    quantity: 18,
    staff: `${agent.nom} ${agent.prenom}`,
    latitude: point.latitude,
    longitude: point.longitude,
    notes: 'نشاط حملة تجريبي',
    createdBy: 'seed-demo',
  }, 'animalCampaignActivities')
  await ensureByFields('biteVaccinationStep', {
    biteCaseId: biteCase.id,
    stepKey: 'DAY_0',
  }, {
    biteCaseId: biteCase.id,
    stepKey: 'DAY_0',
    label: 'جرعة اليوم صفر',
    status: 'DONE',
    scheduledDate: date(12, 3),
    administeredDate: date(12, 3),
    vaccineType: 'لقاح تجريبي',
    route: 'IM',
    lotNumber: `SEED-RAB-${YEAR}-${commune.code}`,
    facility: 'مركز صحي تجريبي',
    administeredBy: 'مهني صحي تجريبي',
    notes: 'متابعة تلقيح افتراضية',
  }, 'biteVaccinations')

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
    createdBy: 'seed-demo',
    createdByName: 'Seeder demo',
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
    uploadedBy: 'seed-demo',
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
    contactedBy: 'seed-demo',
  }, {
    complaintId: complaint.id,
    channel: 'PHONE',
    outcome: 'RESOLVED',
    notes: 'تم التواصل بنجاح',
    contactedAt: date(15, 1),
    contactedBy: 'seed-demo',
  }, 'complaintContacts')
  await ensureByFields('interventionComment', {
    interventionId: interventions.DERATISATION.id,
    authorName: 'Seeder demo',
    content: `ملاحظة تجريبية لسنة ${YEAR}`,
  }, {
    interventionId: interventions.DERATISATION.id,
    authorName: 'Seeder demo',
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
    userName: 'Seeder demo',
    details: JSON.stringify({ source: 'seed', year: YEAR }),
    commune: point.commune,
    createdAt: date(8, 0),
  }, 'activityLogs')

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
    userName: 'Seeder demo',
    createdAt: date(4, 0),
  }, 'pestStockMovements')

  const animal = await prisma.strayAnimal.findUnique({ where: { csvrNumber: `SEED-ANIMAL-${YEAR}-${commune.code}` } })
  await ensureByFields('strayAnimalStatus', {
    animalId: animal.id,
    toStatus: 'CAPTURE',
    changedBy: 'seed-demo',
  }, {
    animalId: animal.id,
    fromStatus: 'SIGNALISE',
    toStatus: 'CAPTURE',
    reason: 'تم التقاط الحيوان ضمن المهمة التجريبية',
    changedBy: 'seed-demo',
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
    changedByName: 'Seeder demo',
    metadata: JSON.stringify({ year: YEAR }),
    createdAt: date(20, 5),
  }, 'dossierEvents')
}

async function seededIds(model, uniqueField = 'reference') {
  const rows = await prisma[model].findMany({
    where: { [uniqueField]: { startsWith: 'SEED-' } },
    select: { id: true },
  })
  return rows.map((row) => row.id)
}

async function removeDemoData() {
  const ids = {
    interventions: await seededIds('intervention'),
    inspections: await seededIds('inspection'),
    products: await seededIds('product'),
    pestProducts: await seededIds('pestProduct'),
    animals: await seededIds('strayAnimal', 'csvrNumber'),
    documents: await seededIds('document'),
    dossiers: await seededIds('dossier'),
    waterSamples: await seededIds('waterSample'),
    waterDevices: await seededIds('waterDevice'),
  }
  const removed = {}
  const remove = async (model, where) => {
    const result = await prisma[model].deleteMany({ where })
    removed[model] = (removed[model] || 0) + result.count
  }
  const seedReference = { reference: { startsWith: 'SEED-' } }

  await remove('activityLog', { OR: [{ userName: { in: ['Seeder 2025', 'Seeder demo'] } }, { details: { contains: '"source":"seed"' } }] })
  await remove('dossierEvent', { dossierId: { in: ids.dossiers } })
  await remove('dossier', seedReference)

  await remove('committeeVisit', seedReference)
  await remove('sanitaryOpinion', seedReference)
  await remove('authorizationDossier', seedReference)
  await remove('awarenessCampaign', seedReference)

  await remove('corpseTransport', seedReference)
  await prisma.deathCase.updateMany({ where: seedReference, data: { burialId: null } })
  await prisma.burialDossier.updateMany({ where: seedReference, data: { deathCaseId: null } })
  await remove('exhumationDossier', seedReference)
  await remove('burialDossier', seedReference)
  await remove('deathCase', seedReference)
  await remove('cemetery', seedReference)

  await remove('biteVaccinationStep', { biteCaseId: { in: await seededIds('biteCase') } })
  await remove('biteCase', seedReference)
  await remove('strayCampaignActivity', { campaignId: { in: await seededIds('strayCampaign') } })
  await remove('strayCampaign', seedReference)
  await remove('strayAnimalFollowUp', { animalId: { in: ids.animals } })
  await remove('strayAnimalDestination', { animalId: { in: ids.animals } })
  await remove('strayAnimalCareEvent', { animalId: { in: ids.animals } })
  await remove('strayAnimalIdentification', { OR: [{ animalId: { in: ids.animals } }, { number: { startsWith: 'SEED-' } }] })
  await remove('strayAnimalHealthAlert', { animalId: { in: ids.animals } })
  await remove('strayAnimalTransport', { animalId: { in: ids.animals } })
  await remove('strayAnimalAdmission', { animalId: { in: ids.animals } })
  await remove('strayAnimalStatus', { animalId: { in: ids.animals } })
  await remove('strayAnimal', { csvrNumber: { startsWith: 'SEED-' } })
  await remove('strayAnimalCenter', { name: { startsWith: 'SEED ' } })
  await remove('strayPartner', { name: { startsWith: 'SEED ' } })
  await remove('strayAnimalDeathReport', seedReference)
  await remove('strayAnimalHotspot', seedReference)
  await remove('strayReport', seedReference)
  await remove('captureMission', seedReference)

  await remove('workOrder', seedReference)
  await remove('complaint', seedReference)
  await remove('interventionDocument', { OR: [{ interventionId: { in: ids.interventions } }, { documentId: { in: ids.documents } }] })
  await remove('interventionMaterial', { OR: [{ interventionId: { in: ids.interventions } }, { productId: { in: ids.products } }] })
  await remove('stockMovement', { productId: { in: ids.products } })
  await remove('interventionComment', { interventionId: { in: ids.interventions } })
  await remove('intervention', seedReference)
  await remove('campagne', seedReference)
  await remove('document', seedReference)
  await remove('product', seedReference)
  await remove('pestStockMovement', { productId: { in: ids.pestProducts } })
  await remove('pestProduct', seedReference)

  await remove('finding', { inspectionId: { in: ids.inspections } })
  await remove('correctiveAction', { inspectionId: { in: ids.inspections } })
  await remove('counterVisit', { inspectionId: { in: ids.inspections } })
  await remove('temperatureLog', seedReference)
  await remove('foodProduct', seedReference)
  await remove('labResult', seedReference)
  await remove('foodNonConformity', seedReference)
  await remove('fryingOilCheck', seedReference)
  await remove('healthCard', seedReference)
  await remove('sample', seedReference)
  await remove('inspection', seedReference)
  await remove('establishment', seedReference)
  await remove('foodReport', seedReference)

  await remove('waterSampleEvent', { sampleId: { in: ids.waterSamples } })
  await remove('waterDeviceCalibration', { deviceId: { in: ids.waterDevices } })
  await remove('waterAction', seedReference)
  await remove('waterDisinfectionOperation', seedReference)
  await remove('waterInspection', seedReference)
  await remove('waterMeasurement', seedReference)
  await remove('waterSample', seedReference)
  await remove('waterDevice', seedReference)
  await remove('waterMonitoringProgram', seedReference)
  await remove('waterLaboratory', seedReference)
  await remove('waterEmergencyPlan', seedReference)
  await remove('waterIncident', seedReference)
  await remove('waterThreshold', { parameter: { startsWith: 'SEED_' } })
  await remove('sanitationAsset', seedReference)
  await remove('sanitationIncident', seedReference)
  await remove('pool', seedReference)
  await remove('waterPoint', seedReference)

  await remove('environmentalInspection', seedReference)
  await remove('environmentalFollowUp', seedReference)
  await remove('environmentalProgram', seedReference)
  await remove('pollutionIncident', seedReference)
  await remove('wasteBlackSpot', seedReference)
  await remove('naturalSite', seedReference)
  await remove('environmentalDossier', seedReference)

  console.log('تمت إزالة البيانات التجريبية فقط مع الاحتفاظ بالبيانات الحقيقية.')
  console.table(removed)
}

async function main() {
  if (DEMO_ACTION === 'remove') {
    await removeDemoData()
    return
  }

  if (process.env.SKIP_SEED_USERS !== 'true') await ensureUsers()
  for (const year of YEARS) {
    YEAR = year
    for (const commune of communes) await seedCommune(commune)
  }
  console.log(`تمت تهيئة بيانات المنصة والأقسام الافتراضية للسنوات ${YEARS.join('، ')} دون حذف البيانات الحالية.`)
  console.table(counters)
}

main()
  .catch((error) => {
    console.error('فشل مدير البيانات التجريبية:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
