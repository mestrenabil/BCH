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
    await db.product.deleteMany()
    await db.quartier.deleteMany()

    for (const q of quartiers) {
      await db.quartier.create({ data: q })
    }

    // Seed products
    const productsSeed = [
      { nom: 'رودينال', categorie: 'DERATISATION', unite: 'كيلوغرام', quantiteStock: 45, seuilAlerte: 10, prixUnitaire: 120, fournisseur: 'شركة باير المغرب', description: 'مادة سامة لمكافحة القوارض - عجينة' },
      { nom: 'كوماتراكال', categorie: 'DERATISATION', unite: 'كيلوغرام', quantiteStock: 30, seuilAlerte: 8, prixUnitaire: 95, fournisseur: 'شركة سيرتا', description: 'مضاد تخثر لمكافحة الجرذان' },
      { nom: 'بروماديولون', categorie: 'DERATISATION', unite: 'كيلوغرام', quantiteStock: 5, seuilAlerte: 10, prixUnitaire: 150, fournisseur: 'شركة باير المغرب', description: 'مادة فعالة ضد القوارض المقاومة' },
      { nom: 'ديفيناكوم', categorie: 'DERATISATION', unite: 'كيلوغرام', quantiteStock: 0, seuilAlerte: 5, prixUnitaire: 180, fournisseur: 'مختبرات فيرين', description: 'مادة سامة من الجيل الثاني' },
      { nom: 'ديلتميثرين', categorie: 'DESINSECTISATION', unite: 'لتر', quantiteStock: 60, seuilAlerte: 15, prixUnitaire: 85, fournisseur: 'شركة سينجنتا المغرب', description: 'مبيد حشري واسع الطيف' },
      { nom: 'بيرميثرين', categorie: 'DESINSECTISATION', unite: 'لتر', quantiteStock: 3, seuilAlerte: 10, prixUnitaire: 75, fournisseur: 'شركة سينجنتا المغرب', description: 'مبيد حشري للرش المتبقي' },
      { nom: 'سيبرميثرين', categorie: 'DESINSECTISATION', unite: 'لتر', quantiteStock: 40, seuilAlerte: 12, prixUnitaire: 90, fournisseur: 'شركة فايفر', description: 'مبيد حشري سريع المفعول' },
      { nom: 'مالاثيون', categorie: 'DESINSECTISATION', unite: 'لتر', quantiteStock: 25, seuilAlerte: 10, prixUnitaire: 65, fournisseur: 'شركة إيفا فارما', description: 'مبيد حشري عضوي فسفوري' },
      { nom: 'هيبوكلوريت الصوديوم', categorie: 'DESINFECTION', unite: 'لتر', quantiteStock: 100, seuilAlerte: 20, prixUnitaire: 15, fournisseur: 'شركة الكلور المغرب', description: 'محلول مطهر بتركيز 12%' },
      { nom: 'فورمالدهيد', categorie: 'DESINFECTION', unite: 'لتر', quantiteStock: 8, seuilAlerte: 5, prixUnitaire: 45, fournisseur: 'مختبرات كيميد', description: 'مطهر قوي للتعقيم' },
      { nom: 'فينول', categorie: 'DESINFECTION', unite: 'لتر', quantiteStock: 15, seuilAlerte: 8, prixUnitaire: 55, fournisseur: 'مختبرات كيميد', description: 'مطهر للأسطح والأرضيات' },
      { nom: 'أمونيوم رباعي', categorie: 'DESINFECTION', unite: 'لتر', quantiteStock: 50, seuilAlerte: 15, prixUnitaire: 35, fournisseur: 'شركة سيرتا', description: 'مطهر متعدد الاستعمالات' },
      { nom: 'أقنعة واقية', categorie: 'GENERAL', unite: 'وحدة', quantiteStock: 200, seuilAlerte: 50, prixUnitaire: 8, fournisseur: 'مستلزمات السلامة المغرب', description: 'أقنعة FFP2 للحماية' },
      { nom: 'قفازات مطاطية', categorie: 'GENERAL', unite: 'علبة', quantiteStock: 30, seuilAlerte: 10, prixUnitaire: 25, fournisseur: 'مستلزمات السلامة المغرب', description: 'قفازات نيتريل - علبة 100 قطعة' },
      { nom: 'رشاشات ظهرية', categorie: 'GENERAL', unite: 'وحدة', quantiteStock: 12, seuilAlerte: 3, prixUnitaire: 450, fournisseur: 'معدات البستنة المغرب', description: 'رشاشة ظهرية 16 لتر' },
    ]

    for (const p of productsSeed) {
      const prefix = p.categorie === 'DERATISATION' ? 'PR-DR' : p.categorie === 'DESINSECTISATION' ? 'PR-DI' : p.categorie === 'DESINFECTION' ? 'PR-DF' : 'PR-GN'
      const count = await db.product.count({ where: { categorie: p.categorie } })
      const reference = `${prefix}-${String(count + 1).padStart(4, '0')}`
      await db.product.create({ data: { ...p, reference } })
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
