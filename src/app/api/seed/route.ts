import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { hashPassword, requireAdmin } from '@/lib/auth'

// Quartiers for each commune with realistic coordinates
const quartiersByCommune = {
  'سيدي أبي القنادل': [
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
  ],
  'سلا': [
    { nom: 'حي حسان', latitude: 34.0500, longitude: -6.7900 },
    { nom: 'حي باب لخروب', latitude: 34.0480, longitude: -6.7850 },
    { nom: 'المدينة القديمة', latitude: 34.0520, longitude: -6.7950 },
    { nom: 'حي الرمال', latitude: 34.0550, longitude: -6.7750 },
    { nom: 'حي السلام', latitude: 34.0420, longitude: -6.7800 },
    { nom: 'حي الأمل', latitude: 34.0580, longitude: -6.7700 },
    { nom: 'حي الطليعة', latitude: 34.0600, longitude: -6.7650 },
    { nom: 'حي النصر', latitude: 34.0460, longitude: -6.7750 },
    { nom: 'حي المحمدية', latitude: 34.0650, longitude: -6.7600 },
    { nom: 'حي المدينة الجديدة', latitude: 34.0700, longitude: -6.7550 },
    { nom: 'حي الأطلس', latitude: 34.0440, longitude: -6.7700 },
    { nom: 'حي الوحدة', latitude: 34.0620, longitude: -6.7680 },
  ],
  'عامر': [
    { nom: 'مركز عامر', latitude: 34.0900, longitude: -6.6500 },
    { nom: 'أولاد عامر', latitude: 34.0950, longitude: -6.6450 },
    { nom: 'المنزه', latitude: 34.0880, longitude: -6.6550 },
    { nom: 'حي الأمل', latitude: 34.0920, longitude: -6.6400 },
    { nom: 'حي النور', latitude: 34.0860, longitude: -6.6600 },
    { nom: 'الحي الإداري', latitude: 34.0910, longitude: -6.6520 },
    { nom: 'حي الزيتون', latitude: 34.0940, longitude: -6.6480 },
    { nom: 'حي الوفاء', latitude: 34.0870, longitude: -6.6430 },
    { nom: 'الدوار الجديد', latitude: 34.0960, longitude: -6.6380 },
    { nom: 'حي السلام', latitude: 34.0850, longitude: -6.6580 },
  ],
  'السهول': [
    { nom: 'مركز السهول', latitude: 33.8250, longitude: -6.7800 },
    { nom: 'قطاع السهول الشمالي', latitude: 33.8950, longitude: -6.8050 },
    { nom: 'قطاع السهول الجنوبي', latitude: 33.7550, longitude: -6.7800 },
  ],
}

const agentsByCommune: Record<string, { nom: string; prenom: string; fonction?: string }[]> = {
  'سلا': [
    { nom: 'أحمد', prenom: 'بنعلي' },
    { nom: 'محمد', prenom: 'العلوي' },
    { nom: 'خالد', prenom: 'السعدي' },
    { nom: 'يوسف', prenom: 'الإدريسي' },
  ],
  'سيدي أبي القنادل': [
    { nom: 'عبد الرحمن', prenom: 'الفاسي' },
    { nom: 'حسن', prenom: 'المكناسي' },
    { nom: 'عمر', prenom: 'الرباطي' },
  ],
  'عامر': [
    { nom: 'سعيد', prenom: 'البيضاوي' },
    { nom: 'مصطفى', prenom: 'المراكشي' },
    { nom: 'إبراهيم', prenom: 'الفكيكي' },
  ],
  'السهول': [
    { nom: 'أيوب', prenom: 'السهولي' },
    { nom: 'سلمى', prenom: 'الزهراء', fonction: 'مراقب' },
    { nom: 'ياسين', prenom: 'العمراني' },
  ],
}

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
  if (process.env.ALLOW_DEMO_SEED !== 'true') {
    return NextResponse.json({ error: 'إدخال البيانات التجريبية معطل' }, { status: 403 })
  }

  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  try {
    await db.intervention.deleteMany()
    await db.product.deleteMany()
    await db.session.deleteMany()
    await db.quartier.deleteMany()

    // Seed users (only if they don't already exist)
    const usersSeed = [
      { username: 'admin', password: hashPassword('admin123'), nom: 'المسؤول العام', commune: 'ALL', role: 'admin' },
      { username: 'sla', password: hashPassword('sla2025'), nom: 'مسؤول جماعة سلا', commune: 'سلا', role: 'responsable' },
      { username: 'bouknadel', password: hashPassword('bouknadel2025'), nom: 'مسؤول جماعة سيدي أبي القنادل', commune: 'سيدي أبي القنادل', role: 'responsable' },
      { username: 'ameur', password: hashPassword('ameur2025'), nom: 'مسؤول جماعة عامر', commune: 'عامر', role: 'responsable' },
      { username: 'sehoul', password: hashPassword('sehoul2025'), nom: 'مسؤول جماعة السهول', commune: 'السهول', role: 'responsable' },
    ]
    for (const u of usersSeed) {
      const existing = await db.user.findUnique({ where: { username: u.username } })
      if (!existing) {
        await db.user.create({ data: u })
      }
    }

    // Seed quartiers for all communes
    for (const [commune, quartiers] of Object.entries(quartiersByCommune)) {
      for (const q of quartiers) {
        await db.quartier.create({ data: { ...q, commune } })
      }
    }

    // Seed products (with commune assignments)
    const productsSeed = [
      // Products for سيدي أبي القنادل
      { nom: 'رودينال', categorie: 'DERATISATION', commune: 'سيدي أبي القنادل', unite: 'كيلوغرام', quantiteStock: 45, seuilAlerte: 10, prixUnitaire: 120, fournisseur: 'شركة باير المغرب', description: 'مادة سامة لمكافحة القوارض - عجينة' },
      { nom: 'كوماتراكال', categorie: 'DERATISATION', commune: 'سيدي أبي القنادل', unite: 'كيلوغرام', quantiteStock: 30, seuilAlerte: 8, prixUnitaire: 95, fournisseur: 'شركة سيرتا', description: 'مضاد تخثر لمكافحة الجرذان' },
      { nom: 'ديلتميثرين', categorie: 'DESINSECTISATION', commune: 'سيدي أبي القنادل', unite: 'لتر', quantiteStock: 60, seuilAlerte: 15, prixUnitaire: 85, fournisseur: 'شركة سينجنتا المغرب', description: 'مبيد حشري واسع الطيف' },
      { nom: 'بيرميثرين', categorie: 'DESINSECTISATION', commune: 'سيدي أبي القنادل', unite: 'لتر', quantiteStock: 3, seuilAlerte: 10, prixUnitaire: 75, fournisseur: 'شركة سينجنتا المغرب', description: 'مبيد حشري للرش المتبقي' },
      { nom: 'هيبوكلوريت الصوديوم', categorie: 'DESINFECTION', commune: 'سيدي أبي القنادل', unite: 'لتر', quantiteStock: 100, seuilAlerte: 20, prixUnitaire: 15, fournisseur: 'شركة الكلور المغرب', description: 'محلول مطهر بتركيز 12%' },
      { nom: 'فورمالدهيد', categorie: 'DESINFECTION', commune: 'سيدي أبي القنادل', unite: 'لتر', quantiteStock: 8, seuilAlerte: 5, prixUnitaire: 45, fournisseur: 'مختبرات كيميد', description: 'مطهر قوي للتعقيم' },

      // Products for سلا
      { nom: 'بروماديولون', categorie: 'DERATISATION', commune: 'سلا', unite: 'كيلوغرام', quantiteStock: 25, seuilAlerte: 5, prixUnitaire: 150, fournisseur: 'شركة باير المغرب', description: 'مادة فعالة ضد القوارض المقاومة' },
      { nom: 'ديفيناكوم', categorie: 'DERATISATION', commune: 'سلا', unite: 'كيلوغرام', quantiteStock: 15, seuilAlerte: 5, prixUnitaire: 180, fournisseur: 'مختبرات فيرين', description: 'مادة سامة من الجيل الثاني' },
      { nom: 'سيبرميثرين', categorie: 'DESINSECTISATION', commune: 'سلا', unite: 'لتر', quantiteStock: 40, seuilAlerte: 12, prixUnitaire: 90, fournisseur: 'شركة فايفر', description: 'مبيد حشري سريع المفعول' },
      { nom: 'مالاثيون', categorie: 'DESINSECTISATION', commune: 'سلا', unite: 'لتر', quantiteStock: 25, seuilAlerte: 10, prixUnitaire: 65, fournisseur: 'شركة إيفا فارما', description: 'مبيد حشري عضوي فسفوري' },
      { nom: 'فينول', categorie: 'DESINFECTION', commune: 'سلا', unite: 'لتر', quantiteStock: 15, seuilAlerte: 8, prixUnitaire: 55, fournisseur: 'مختبرات كيميد', description: 'مطهر للأسطح والأرضيات' },
      { nom: 'أمونيوم رباعي', categorie: 'DESINFECTION', commune: 'سلا', unite: 'لتر', quantiteStock: 50, seuilAlerte: 15, prixUnitaire: 35, fournisseur: 'شركة سيرتا', description: 'مطهر متعدد الاستعمالات' },

      // Products for عامر
      { nom: 'كلوروفينفينوس', categorie: 'DERATISATION', commune: 'عامر', unite: 'كيلوغرام', quantiteStock: 20, seuilAlerte: 5, prixUnitaire: 130, fournisseur: 'شركة سيرتا', description: 'مادة فعالة لمكافحة القوارض' },
      { nom: 'فارنيثين', categorie: 'DESINSECTISATION', commune: 'عامر', unite: 'لتر', quantiteStock: 35, seuilAlerte: 10, prixUnitaire: 80, fournisseur: 'شركة سينجنتا المغرب', description: 'مبيد حشري للرش' },
      { nom: 'ديكلورفوس', categorie: 'DESINSECTISATION', commune: 'عامر', unite: 'لتر', quantiteStock: 20, seuilAlerte: 8, prixUnitaire: 70, fournisseur: 'مختبرات كيميد', description: 'مبيد حشري فسفوري عضوي' },
      { nom: 'كلورهيكسيدين', categorie: 'DESINFECTION', commune: 'عامر', unite: 'لتر', quantiteStock: 40, seuilAlerte: 12, prixUnitaire: 40, fournisseur: 'شركة الكلور المغرب', description: 'مطهر واسع الطيف' },

      // Products for السهول
      { nom: 'رودينال السهول', categorie: 'DERATISATION', commune: 'السهول', unite: 'كيلوغرام', quantiteStock: 25, seuilAlerte: 6, prixUnitaire: 120, fournisseur: 'شركة باير المغرب', description: 'مادة لمكافحة القوارض' },
      { nom: 'ديلتميثرين السهول', categorie: 'DESINSECTISATION', commune: 'السهول', unite: 'لتر', quantiteStock: 30, seuilAlerte: 8, prixUnitaire: 85, fournisseur: 'شركة سينجنتا المغرب', description: 'مبيد حشري للرش' },
      { nom: 'هيبوكلوريت السهول', categorie: 'DESINFECTION', commune: 'السهول', unite: 'لتر', quantiteStock: 50, seuilAlerte: 15, prixUnitaire: 15, fournisseur: 'شركة الكلور المغرب', description: 'محلول مطهر' },

      // Shared products (no commune assignment)
      { nom: 'أقنعة واقية', categorie: 'GENERAL', commune: '', unite: 'وحدة', quantiteStock: 200, seuilAlerte: 50, prixUnitaire: 8, fournisseur: 'مستلزمات السلامة المغرب', description: 'أقنعة FFP2 للحماية' },
      { nom: 'قفازات مطاطية', categorie: 'GENERAL', commune: '', unite: 'علبة', quantiteStock: 30, seuilAlerte: 10, prixUnitaire: 25, fournisseur: 'مستلزمات السلامة المغرب', description: 'قفازات نيتريل - علبة 100 قطعة' },
      { nom: 'رشاشات ظهرية', categorie: 'GENERAL', commune: '', unite: 'وحدة', quantiteStock: 12, seuilAlerte: 3, prixUnitaire: 450, fournisseur: 'معدات البستنة المغرب', description: 'رشاشة ظهرية 16 لتر' },
    ]

    for (const p of productsSeed) {
      const prefix = p.categorie === 'DERATISATION' ? 'PR-DR' : p.categorie === 'DESINSECTISATION' ? 'PR-DI' : p.categorie === 'DESINFECTION' ? 'PR-DF' : 'PR-GN'
      const count = await db.product.count({ where: { categorie: p.categorie } })
      const reference = `${prefix}-${String(count + 1).padStart(4, '0')}`
      await db.product.create({ data: { ...p, reference } })
    }

    // Seed agents for all communes
    for (const [commune, agents] of Object.entries(agentsByCommune)) {
      for (const agent of agents) {
        const existing = await db.agent.findFirst({ where: { nom: agent.nom, prenom: agent.prenom, commune } })
        if (!existing) {
          await db.agent.create({
            data: {
              nom: agent.nom,
              prenom: agent.prenom,
              commune,
              fonction: agent.fonction || 'عون صحية',
              actif: true,
            }
          })
        }
      }
    }

    // Seed interventions for all communes
    const interventions: Array<{
      type: string; date: Date; quartier: string; adresse: string
      commune: string; latitude: number; longitude: number; statut: string
      description: string; agentNom: string; produitUtilise: string
      quantite: string; superficie: string; nombrePrestations: number
      observations: string; reference: string
    }> = []
    let refIndex = 1

    for (const [commune, quartiers] of Object.entries(quartiersByCommune)) {
      const agents = agentsByCommune[commune]

      for (let year = 2024; year <= 2025; year++) {
        for (let month = 0; month < 12; month++) {
          const numInterventions = randomInt(2, 5)
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
              commune,
              latitude: quartier.latitude + latOffset,
              longitude: quartier.longitude + lngOffset,
              statut: year === 2024 ? randomItem(['TERMINEE', 'TERMINEE', 'TERMINEE', 'ANNULEE']) : randomItem(statuts),
              description: `${type === 'DERATISATION' ? 'عملية مكافحة القوارض' : type === 'DESINSECTISATION' ? 'عملية مكافحة الحشرات' : 'عملية تطهير وتعقيم'} بحي ${quartier.nom} — ${commune}`,
              agentNom: (() => { const a = randomItem(agents); return `${a.nom} ${a.prenom}`.trim() })(),
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
    }

    for (const intervention of interventions) {
      await db.intervention.create({ data: intervention })
    }

    return NextResponse.json({
      message: 'تم تهيئة قاعدة البيانات بنجاح',
      quartiers: Object.values(quartiersByCommune).flat().length,
      interventions: interventions.length,
      communes: Object.keys(quartiersByCommune),
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تهيئة قاعدة البيانات' }, { status: 500 })
  }
}
