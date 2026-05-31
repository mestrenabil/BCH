import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const quartiers = [
  { nom: 'بوقنادل القديمة', latitude: 34.0520, longitude: -6.7350 },
  { nom: 'حي المواطنين', latitude: 34.0550, longitude: -6.7280 },
  { nom: 'حي القدس', latitude: 34.0480, longitude: -6.7200 },
  { nom: 'حي المسيرة', latitude: 34.0600, longitude: -6.7320 },
  { nom: 'حي الأمل', latitude: 34.0450, longitude: -6.7400 },
  { nom: 'حي النصر', latitude: 34.0580, longitude: -6.7180 },
  { nom: 'حي السلام', latitude: 34.0430, longitude: -6.7250 },
  { nom: 'حي الوفاء', latitude: 34.0620, longitude: -6.7380 },
  { nom: 'حي الهناء', latitude: 34.0500, longitude: -6.7420 },
  { nom: 'حي الزيتون', latitude: 34.0560, longitude: -6.7450 },
  { nom: 'حي الورود', latitude: 34.0640, longitude: -6.7220 },
  { nom: 'حي الخير', latitude: 34.0470, longitude: -6.7150 },
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

          const latOffset = (Math.random() - 0.5) * 0.005
          const lngOffset = (Math.random() - 0.5) * 0.005

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
