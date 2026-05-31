import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Quartier coordinates verified against Bouknadel commune boundary (OSM Relation 2498879)
// Boundary box: Lat 34.1101-34.1290, Lon -6.7501 to -6.7281
const quartiers = [
  { nom: 'بوقنادل القديمة', latitude: 34.1235, longitude: -6.7335 },
  { nom: 'حي المواطنين', latitude: 34.1210, longitude: -6.7310 },
  { nom: 'حي القدس', latitude: 34.1190, longitude: -6.7350 },
  { nom: 'حي المسيرة', latitude: 34.1250, longitude: -6.7380 },
  { nom: 'حي الأمل', latitude: 34.1155, longitude: -6.7420 },
  { nom: 'حي النصر', latitude: 34.1180, longitude: -6.7295 },
  { nom: 'حي السلام', latitude: 34.1130, longitude: -6.7370 },
  { nom: 'حي الوفاء', latitude: 34.1270, longitude: -6.7345 },
  { nom: 'حي الهناء', latitude: 34.1160, longitude: -6.7450 },
  { nom: 'حي الزيتون', latitude: 34.1240, longitude: -6.7410 },
  { nom: 'حي الورود', latitude: 34.1260, longitude: -6.7305 },
  { nom: 'حي الخير', latitude: 34.1115, longitude: -6.7390 },
]

const agents = [
  'أحمد بنعلي',
  'محمد العلوي',
  'خالد السعدي',
  'يوسف الإدريسي',
  'عبد الرحمن الفاسي',
  'حسن المكناسي',
  'عمر الرباطي',
  'سعيد البيضاوي',
]

const produits: Record<string, string[]> = {
  DERATISATION: ['رودينال', 'كوماتراكال', 'بروماديولون', 'ديفيناكوم'],
  DESINSECTISATION: ['ديلتميثرين', 'بيرميثرين', 'سيبرميثرين', 'مالاثيون'],
  DESINFECTION: ['هيبوكلوريت الصوديوم', 'فورمالدهيد', 'فينول', 'أمونيوم رباعي'],
}

const statuts = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']
const types = ['DERATISATION', 'DESINSECTISATION', 'DESINFECTION']

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateReference(index: number, type: string, year: number): string {
  const prefix = type === 'DERATISATION' ? 'DR' : type === 'DESINSECTISATION' ? 'DI' : 'DF'
  return `${prefix}-${year}-${String(index).padStart(4, '0')}`
}

export async function POST() {
  try {
    await db.intervention.deleteMany()
    await db.quartier.deleteMany()

    for (const q of quartiers) {
      await db.quartier.create({ data: q })
    }

    const interventions = []
    let refIndex = 1

    for (let year = 2024; year <= 2025; year++) {
      for (let month = 0; month < 12; month++) {
        const numInterventions = randomInt(3, 8)
        for (let i = 0; i < numInterventions; i++) {
          const type = randomItem(types)
          const quartier = randomItem(quartiers)
          const produit = randomItem(produits[type])
          const day = randomInt(1, 28)
          const date = new Date(year, month, day)

          const latOffset = (Math.random() - 0.5) * 0.003
          const lngOffset = (Math.random() - 0.5) * 0.003

          interventions.push({
            type,
            date,
            quartier: quartier.nom,
            adresse: `${randomInt(1, 150)} شارع ${randomItem(['الحسن الثاني', 'محمد الخامس', 'الوحدة', 'النصر', 'السلام', 'الأمل', 'الفتح', 'الاستقلال'])}`,
            latitude: quartier.latitude + latOffset,
            longitude: quartier.longitude + lngOffset,
            statut: year === 2024 ? randomItem(['TERMINEE', 'TERMINEE', 'TERMINEE', 'ANNULEE']) : randomItem(statuts),
            description: `${type === 'DERATISATION' ? 'عملية مكافحة القوارض' : type === 'DESINSECTISATION' ? 'عملية مكافحة الحشرات' : 'عملية تطهير وتعقيم'} بحي ${quartier.nom}`,
            agentNom: randomItem(agents),
            produitUtilise: produit,
            quantite: `${randomInt(1, 20)} ${type === 'DESINFECTION' ? 'لتر' : 'كيلوغرام'}`,
            superficie: `${randomInt(50, 5000)} متر مربع`,
            nombrePrestations: randomInt(1, 5),
            observations: randomItem([
              'تمت العملية بنجاح',
              'يحتاج إلى متابعة',
              'وضع صحي متردٍ',
              'نظيف نسبياً',
              'يحتاج إلى تدخل إضافي',
              'تم رصد وجود آفات كثيفة',
              '',
              '',
            ]),
            reference: generateReference(refIndex++, type, year),
          })
        }
      }
    }

    for (const intervention of interventions) {
      await db.intervention.create({ data: intervention })
    }

    return NextResponse.json({
      message: 'تم تهيئة قاعدة البيانات بنجاح',
      quartiers: quartiers.length,
      interventions: interventions.length,
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تهيئة قاعدة البيانات' }, { status: 500 })
  }
}
