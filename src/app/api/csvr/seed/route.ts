import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import type { StrayReport, CaptureMission } from '@prisma/client'

export async function POST() {
  try {
    if (process.env.ALLOW_DEMO_SEED !== 'true') {
      return NextResponse.json({ error: 'السيد غير مُفعَّل. ضع ALLOW_DEMO_SEED=true في .env' }, { status: 403 })
    }
    const authResult = await requireAdmin()
    if ('error' in authResult) return authResult.error

    // Clear existing CSVR demo data
    await db.strayReportPhoto.deleteMany()
    await db.captureMissionPhoto.deleteMany()
    await db.strayAnimalPhoto.deleteMany()
    await db.strayAnimalStatus.deleteMany()
    await db.strayReport.deleteMany()
    await db.strayAnimal.deleteMany()
    await db.captureMission.deleteMany()

    const communes = ['سلا', 'سيدي أبي القنادل', 'عامر', 'السهول']
    const species = ['DOG', 'CAT', 'OTHER']
    const priorities = ['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE']
    const statuses = ['NOUVEAU', 'VALIDE', 'MISSION_PLANIFIEE', 'TRAITE']
    const quartiers = ['حي السلام', 'حي النهضة', 'حي الأمل', 'المدينة القديمة', 'حي الوردة', 'حي الفتح']
    const animalStatuses = ['CAPTURE', 'ADMIT_CENTRE', 'STERILISE', 'VACCINE', 'RELACHE', 'ADOPTABLE']

    const year = new Date().getFullYear()

    // Create sample reports
    const reports: StrayReport[] = []
    for (let i = 0; i < 15; i++) {
      const commune = communes[i % communes.length]
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const report = await db.strayReport.create({
        data: {
          reference: `SIG-CSVR-${year}-${random}`,
          source: i % 3 === 0 ? 'PUBLIC' : 'INTERNAL',
          declarantName: i % 3 === 0 ? `مواطن ${i + 1}` : '',
          declarantPhone: i % 3 === 0 ? `06${Math.floor(10000000 + Math.random() * 89999999)}` : '',
          commune,
          quartier: quartiers[i % quartiers.length],
          adresse: `${quartiers[i % quartiers.length]} - شارع ${i + 1}`,
          latitude: 34.05 + (Math.random() - 0.5) * 0.1,
          longitude: -6.8 + (Math.random() - 0.5) * 0.1,
          species: species[i % species.length],
          estimatedCount: 1 + Math.floor(Math.random() * 5),
          isAggressive: i % 7 === 0,
          isInjured: i % 5 === 0,
          rabiesSuspect: i % 12 === 0,
          description: `بلاغ رقم ${i + 1} - ${species[i % species.length] === 'DOG' ? 'كلب' : species[i % species.length] === 'CAT' ? 'قط' : 'حيوان'} شارد في المنطقة`,
          priority: priorities[i % priorities.length],
          statut: statuses[i % statuses.length],
          createdAt: new Date(Date.now() - i * 86400000 * 2),
        },
      })
      reports.push(report)
    }

    // Create sample missions
    const missions: CaptureMission[] = []
    for (let i = 0; i < 5; i++) {
      const commune = communes[i % communes.length]
      const mission = await db.captureMission.create({
        data: {
          reference: `MIS-CSVR-${year}-${String(i + 1).padStart(3, '0')}`,
          commune,
          quartier: quartiers[i % quartiers.length],
          latitude: 34.05 + (Math.random() - 0.5) * 0.1,
          longitude: -6.8 + (Math.random() - 0.5) * 0.1,
          scheduledAt: new Date(Date.now() + i * 86400000),
          priority: priorities[i % priorities.length],
          statut: i < 2 ? 'PLANIFIEE' : 'TERMINEE',
          teamLead: `المسؤول ${i + 1}`,
          driver: `السائق ${i + 1}`,
          agents: JSON.stringify([`العون ${i + 1}أ`, `العون ${i + 1}ب`]),
          cagesAvailable: 4 + i,
          estimatedAnimals: 2 + i,
          capturedCount: i < 2 ? null : 2 + i,
          observedCount: i < 2 ? null : 3 + i,
          completedAt: i < 2 ? null : new Date(Date.now() - i * 86400000),
        },
      })
      missions.push(mission)
    }

    // Create sample animals
    for (let i = 0; i < 12; i++) {
      const commune = communes[i % communes.length]
      const sp = species[i % species.length]
      const statut = animalStatuses[i % animalStatuses.length]
      const sex = i % 3 === 0 ? 'MALE' : i % 3 === 1 ? 'FEMALE' : 'UNKNOWN'
      const colors = ['بني', 'أسود', 'أبيض', 'رمادي', 'بني وأبيض', 'أسود وأبيض']
      const animal = await db.strayAnimal.create({
        data: {
          csvrNumber: `BCH-CSVR-${year}-${String(i + 1).padStart(6, '0')}`,
          species: sp,
          breed: sp === 'DOG' ? 'متوسط الحجم' : sp === 'CAT' ? 'قط منزلي' : '',
          sex,
          estimatedAge: `${1 + (i % 5)} سنة`,
          weight: 5 + (i % 15),
          size: i % 3 === 0 ? 'SMALL' : i % 3 === 1 ? 'MEDIUM' : 'LARGE',
          primaryColor: colors[i % colors.length],
          qrCode: `BCH-CSVR-${year}-${String(i + 1).padStart(6, '0')}`,
          missionId: missions[i % missions.length].id,
          captureDate: new Date(Date.now() - i * 86400000 * 3),
          captureLocation: quartiers[i % quartiers.length],
          captureQuartier: quartiers[i % quartiers.length],
          captureLatitude: 34.05 + (Math.random() - 0.5) * 0.1,
          captureLongitude: -6.8 + (Math.random() - 0.5) * 0.1,
          capturedBy: `العون ${i + 1}`,
          captureState: i % 4 === 0 ? 'CALME' : i % 4 === 1 ? 'PEUREUX' : i % 4 === 2 ? 'BLESSE' : 'MALADE',
          statut,
          commune,
          shelterName: statut === 'RELACHE' ? '' : 'مركز الاستقبال البلدي',
          boxOrCage: statut === 'RELACHE' ? '' : `قفص ${i + 1}`,
          createdBy: 'system',
        },
      })

      await db.strayAnimalStatus.create({
        data: {
          animalId: animal.id,
          fromStatus: null,
          toStatus: 'CAPTURE',
          reason: 'الاصطياد الأولي',
          changedBy: 'system',
        },
      })

      if (statut !== 'CAPTURE') {
        await db.strayAnimalStatus.create({
          data: {
            animalId: animal.id,
            fromStatus: 'CAPTURE',
            toStatus: statut,
            reason: 'تحديث الحالة',
            changedBy: 'system',
            createdAt: new Date(Date.now() - i * 86400000 * 2),
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      created: { reports: reports.length, missions: missions.length, animals: 12 },
    })
  } catch (error) {
    console.error('POST csvr/seed error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء البيانات التجريبية' }, { status: 500 })
  }
}
