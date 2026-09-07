import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_SPECIES = new Set(['DOG', 'CAT', 'HORSE', 'DONKEY', 'FARM', 'OTHER'])
const ALLOWED_SEX = new Set(['MALE', 'FEMALE', 'UNKNOWN'])
const ALLOWED_STATUS = new Set([
  'SIGNALISE', 'LOCALISE', 'CAPTURE', 'TRANSPORTE', 'ADMIT_CENTRE', 'QUARANTINE',
  'OBSERVATION', 'SOINS', 'APTE_STERIL', 'STERILISE', 'VACCINE', 'IDENTIFIE',
  'CONVALESCENCE', 'PRET_RELACHER', 'RELACHE', 'ADOPTABLE', 'ADOPTE', 'TRANSFERE',
  'DECEDE', 'CLOTURE',
])
const ALLOWED_SIZE = new Set(['', 'SMALL', 'MEDIUM', 'LARGE'])
const ALLOWED_CAPTURE_STATE = new Set([
  '', 'CALME', 'PEUREUX', 'AGRESSIF', 'BLESSE', 'MALADE', 'AMAIGRI', 'GESTANTE', 'ALLAITANTE',
])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const species = searchParams.get('species')
    const sex = searchParams.get('sex')
    const shelter = searchParams.get('shelter')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (statut) where.statut = statut
    if (species) where.species = species
    if (sex) where.sex = sex
    if (shelter) where.shelterName = { contains: shelter }
    if (search) {
      where.OR = [
        { csvrNumber: { contains: search } },
        { microchipNumber: { contains: search } },
        { tagNumber: { contains: search } },
        { breed: { contains: search } },
        { primaryColor: { contains: search } },
        { captureQuartier: { contains: search } },
      ]
    }

    const animals = await db.strayAnimal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    })

    const total = await db.strayAnimal.count({ where })

    return NextResponse.json({ animals, total })
  } catch (error) {
    console.error('GET csvr/animals error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل سجل الحيوانات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      commune, missionId, reportId,
      species, breed, sex, estimatedAge, weight, size, primaryColor, secondaryColors,
      distinctiveMarks, microchipNumber, tagNumber, collarNumber,
      captureDate, captureTime, captureLocation, captureQuartier,
      captureLatitude, captureLongitude, capturedBy,
      captureState, hasParasites, diseaseSuspect, captureNotes,
      statut, shelterName, boxOrCage, territoryFilter,
    } = body

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء سجل الحيوان' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    const finalSpecies = ALLOWED_SPECIES.has(species) ? species : 'DOG'
    const finalSex = ALLOWED_SEX.has(sex) ? sex : 'UNKNOWN'
    const finalStatus = ALLOWED_STATUS.has(statut) ? statut : 'CAPTURE'
    const finalSize = ALLOWED_SIZE.has(size) ? size : ''
    const finalCaptureState = ALLOWED_CAPTURE_STATE.has(captureState) ? captureState : ''

    // Generate csvrNumber: BCH-CSVR-YYYY-NNNNNN
    const year = new Date().getFullYear()
    let csvrNumber = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await db.strayAnimal.count({ where: { csvrNumber: { startsWith: `BCH-CSVR-${year}-` } } })
      const candidate = `BCH-CSVR-${year}-${String(count + 1 + attempt).padStart(6, '0')}`
      const exists = await db.strayAnimal.findUnique({ where: { csvrNumber: candidate }, select: { id: true } })
      if (!exists) { csvrNumber = candidate; break }
    }
    if (!csvrNumber) {
      csvrNumber = `BCH-CSVR-${year}-${Date.now().toString(36).toUpperCase()}`
    }

    const animal = await db.strayAnimal.create({
      data: {
        csvrNumber,
        species: finalSpecies,
        breed: breed || '',
        sex: finalSex,
        estimatedAge: estimatedAge || '',
        weight: weight ?? null,
        size: finalSize,
        primaryColor: primaryColor || '',
        secondaryColors: secondaryColors || '',
        distinctiveMarks: distinctiveMarks || '',
        microchipNumber: microchipNumber || '',
        tagNumber: tagNumber || '',
        collarNumber: collarNumber || '',
        qrCode: csvrNumber, // use csvrNumber as QR identifier
        reportId: reportId || null,
        missionId: missionId || null,
        captureDate: captureDate ? new Date(captureDate) : null,
        captureTime: captureTime || null,
        captureLocation: captureLocation || '',
        captureQuartier: captureQuartier || '',
        captureLatitude: captureLatitude ?? null,
        captureLongitude: captureLongitude ?? null,
        capturedBy: capturedBy || '',
        captureState: finalCaptureState,
        hasParasites: Boolean(hasParasites),
        diseaseSuspect: Boolean(diseaseSuspect),
        captureNotes: captureNotes || '',
        statut: finalStatus,
        commune: enforcedCommune,
        shelterName: shelterName || '',
        boxOrCage: boxOrCage || '',
        createdBy: user.nom,
      },
    })

    // Create initial status history entry
    await db.strayAnimalStatus.create({
      data: {
        animalId: animal.id,
        fromStatus: null,
        toStatus: finalStatus,
        reason: 'إنشاء السجل',
        changedBy: user.nom,
      },
    })

    await recordActivity({
      user, action: 'CREATE', entityType: 'CSVR_ANIMAL', entityId: animal.id,
      commune: enforcedCommune, details: { csvrNumber, species: finalSpecies, sex: finalSex },
    })

    return NextResponse.json(animal, { status: 201 })
  } catch (error) {
    console.error('POST csvr/animals error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء سجل الحيوان' }, { status: 500 })
  }
}
