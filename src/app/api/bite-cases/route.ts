import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set(['NEW', 'REPORTED', 'FOLLOWING', 'VACCINATION_STARTED', 'VACCINATION_COMPLETE', 'CLOSED', 'LOST_CONTACT'])
const ALLOWED_ANIMAL = new Set(['DOG', 'CAT', 'MONKEY', 'OTHER'])
const ALLOWED_EXPOSURE = new Set(['UNKNOWN', 'I', 'II', 'III'])
const ALLOWED_VACCINE_TYPES = new Set(['UNKNOWN', 'HDCV', 'PCECV', 'PVRV', 'CCEEV_OTHER', 'OTHER'])
const ALLOWED_ROUTES = new Set(['UNKNOWN', 'ID', 'IM'])
const ALLOWED_PROTOCOLS = new Set(['PENDING_ASSESSMENT', 'WHO_ID_2_SITE_0_3_7', 'WHO_ID_PREVIOUSLY_VACCINATED_0_3', 'AUTHORITY_DEFINED', 'NO_PEP'])

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function asBoolean(value: unknown) {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function plannedSteps(protocol: string, biteDate: Date, vaccineType: string, route: string) {
  const steps: Array<{ stepKey: string; label: string; scheduledDate: Date; vaccineType: string; route: string }> = []
  const add = (stepKey: string, label: string, days: number) => {
    const scheduledDate = new Date(biteDate)
    scheduledDate.setDate(scheduledDate.getDate() + days)
    steps.push({ stepKey, label, scheduledDate, vaccineType, route })
  }
  if (protocol === 'WHO_ID_2_SITE_0_3_7') {
    add('DAY_0', 'الجرعة 0 — يوم التعرض', 0)
    add('DAY_3', 'الجرعة 3', 3)
    add('DAY_7', 'الجرعة 7', 7)
  }
  if (protocol === 'WHO_ID_PREVIOUSLY_VACCINATED_0_3') {
    add('DAY_0', 'الجرعة 0 — يوم التعرض', 0)
    add('DAY_3', 'الجرعة 3', 3)
  }
  return steps
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const animalType = searchParams.get('animalType')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (animalType) where.animalType = animalType
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { victimName: { contains: search } },
        { victimPhone: { contains: search } },
        { victimCin: { contains: search } },
        { victimRegistrationNumber: { contains: search } },
        { declarantName: { contains: search } },
        { quartier: { contains: search } },
        { biteLocation: { contains: search } },
      ]
    }
    const biteCases = await db.biteCase.findMany({ where, include: { animal: { select: { id: true, csvrNumber: true, species: true, commune: true } }, vaccinationSteps: { orderBy: { scheduledDate: 'asc' } } }, orderBy: { biteDate: 'desc' }, take: limit })
    const total = await db.biteCase.count({ where })
    return NextResponse.json({ biteCases, total })
  } catch (error) {
    console.error('GET bite-cases error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    const {
      victimName, victimAge, victimGender, victimPhone, victimCin, victimRegistrationNumber, victimAddress,
      guardianName, guardianPhone, declarantName, declarantPhone,
      animalType, animalStatus, animalDescription,
      biteDate, biteLocation, commune, quartier, adresse, latitude, longitude, biteSite,
      description, medicalFacility, medicalReferralDate, source, strayReportId,
      exposureCategory, woundWashConfirmed, woundWashDate, woundCareNotes,
      vaccineType, vaccineRoute, pepProtocol, rigIndicated, rigAdministered, rigType, rigDate, vaccinationNotes,
      animalId,
    } = body

    if (!victimName && !description && !victimCin && !victimRegistrationNumber) {
      return NextResponse.json({ error: 'يرجى تقديم اسم المصاب أو رقم البطاقة أو رقم التسجيل أو وصف الحالة' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })

    let linkedAnimalId: string | null = null
    if (animalId) {
      const linkedAnimal = await db.strayAnimal.findUnique({ where: { id: animalId }, select: { id: true, commune: true, species: true } })
      if (!linkedAnimal) return NextResponse.json({ error: 'الحيوان المرتبط غير موجود' }, { status: 400 })
      if (linkedAnimal.commune !== enforcedCommune) return NextResponse.json({ error: 'الحيوان خارج جماعة الحالة' }, { status: 400 })
      linkedAnimalId = linkedAnimal.id
    }

    const year = new Date().getFullYear()
    let reference = ''
    for (let i = 0; i < 5; i++) {
      const r = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const c = `MORS-${year}-${r}`
      if (!await db.biteCase.findUnique({ where: { reference: c }, select: { id: true } })) { reference = c; break }
    }
    if (!reference) reference = `MORS-${year}-${Date.now().toString(36).toUpperCase()}`

    const finalAnimal = ALLOWED_ANIMAL.has(animalType) ? animalType : 'DOG'
    const finalExposure = ALLOWED_EXPOSURE.has(exposureCategory) ? exposureCategory : 'UNKNOWN'
    const finalVaccineType = ALLOWED_VACCINE_TYPES.has(vaccineType) ? vaccineType : 'UNKNOWN'
    const finalRoute = ALLOWED_ROUTES.has(vaccineRoute) ? vaccineRoute : 'UNKNOWN'
    const finalProtocol = ALLOWED_PROTOCOLS.has(pepProtocol) ? pepProtocol : 'PENDING_ASSESSMENT'
    const finalBiteDate = optionalDate(biteDate) || new Date()
    const finalWoundWashDate = optionalDate(woundWashDate)
    const finalMedicalReferralDate = optionalDate(medicalReferralDate)
    const finalRigDate = optionalDate(rigDate)

    const biteCase = await db.$transaction(async (transaction) => {
      const created = await transaction.biteCase.create({
        data: {
        reference,
        victimName: String(victimName || '').trim().slice(0, 160), victimAge: victimAge ? parseInt(victimAge, 10) : null,
        victimGender: String(victimGender || '').slice(0, 20), victimPhone: String(victimPhone || '').trim().slice(0, 40),
        victimCin: String(victimCin || '').trim().slice(0, 40),
        victimRegistrationNumber: String(victimRegistrationNumber || '').trim().slice(0, 60),
        victimAddress: String(victimAddress || '').trim().slice(0, 300),
        guardianName: String(guardianName || '').trim().slice(0, 160), guardianPhone: String(guardianPhone || '').trim().slice(0, 40),
        declarantName: String(declarantName || '').trim().slice(0, 160), declarantPhone: String(declarantPhone || '').trim().slice(0, 40),
        animalType: finalAnimal, animalStatus: animalStatus || 'UNKNOWN', animalDescription: animalDescription || '',
        biteDate: finalBiteDate, biteLocation: String(biteLocation || '').trim().slice(0, 300),
        commune: enforcedCommune, quartier: quartier || '', adresse: adresse || '',
        latitude: latitude ?? null, longitude: longitude ?? null, biteSite: biteSite || '',
        description: String(description || '').trim().slice(0, 3000),
        medicalFacility: String(medicalFacility || '').trim().slice(0, 200),
        medicalReferralDate: finalMedicalReferralDate,
        exposureCategory: finalExposure, woundWashConfirmed: asBoolean(woundWashConfirmed),
        woundWashDate: finalWoundWashDate, woundCareNotes: String(woundCareNotes || '').trim().slice(0, 1500),
        vaccineType: finalVaccineType, vaccineRoute: finalRoute, pepProtocol: finalProtocol,
        rigIndicated: asBoolean(rigIndicated), rigAdministered: asBoolean(rigAdministered),
        rigType: String(rigType || '').trim().slice(0, 120), rigDate: finalRigDate,
        vaccinationNotes: String(vaccinationNotes || '').trim().slice(0, 2000),
        source: source || 'INTERNAL',
        status: 'NEW', reportingDate: new Date(),
        strayReportId: strayReportId || null,
        animalId: linkedAnimalId,
        },
      })

      const steps = [
        { biteCaseId: created.id, stepKey: 'WOUND_CARE', label: 'غسل وتنظيف الجرح', status: asBoolean(woundWashConfirmed) ? 'DONE' : 'PLANNED', scheduledDate: finalBiteDate, administeredDate: finalWoundWashDate, vaccineType: '', route: '', lotNumber: '', facility: '', administeredBy: '', notes: String(woundCareNotes || '').trim().slice(0, 1500) },
        ...plannedSteps(finalProtocol, finalBiteDate, finalVaccineType, finalRoute).map((step) => ({ ...step, biteCaseId: created.id, status: 'PLANNED', administeredDate: null, lotNumber: '', facility: '', administeredBy: '', notes: '' })),
        ...(asBoolean(rigIndicated) ? [{ biteCaseId: created.id, stepKey: 'RIG', label: 'الغلوبولين المناعي للسعار — يحدده المختص', status: asBoolean(rigAdministered) ? 'DONE' : 'PLANNED', scheduledDate: finalRigDate || finalBiteDate, administeredDate: asBoolean(rigAdministered) ? finalRigDate : null, vaccineType: '', route: '', lotNumber: '', facility: '', administeredBy: '', notes: String(rigType || '').trim().slice(0, 120) }] : []),
      ]
      await transaction.biteVaccinationStep.createMany({ data: steps })
      return transaction.biteCase.findUnique({ where: { id: created.id }, include: { vaccinationSteps: { orderBy: { scheduledDate: 'asc' } } } })
    })
    if (!biteCase) return NextResponse.json({ error: 'تعذر إنشاء حالة العض' }, { status: 500 })

    await recordActivity({
      user, action: 'CREATE', entityType: 'BITE_CASE', entityId: biteCase.id,
      commune: enforcedCommune, details: { reference: biteCase.reference, animalType: finalAnimal, animalId: linkedAnimalId },
    })

    return NextResponse.json(biteCase, { status: 201 })
  } catch (error) {
    console.error('POST bite-cases error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}
