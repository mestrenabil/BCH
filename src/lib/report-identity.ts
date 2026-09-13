import { db } from '@/lib/db'

export type ReportIdentity = {
  kingdomNameAr: string
  kingdomNameFr: string
  provinceNameAr: string
  provinceNameFr: string
  serviceNameAr: string
  serviceNameFr: string
  communeNameAr: string
  communeNameFr: string
  communeAddress: string
  communePhone: string
  communeFax: string
  communeEmail: string
  documentFooter: string
}

const DEFAULT_IDENTITY: ReportIdentity = {
  kingdomNameAr: 'المملكة المغربية',
  kingdomNameFr: 'Royaume du Maroc',
  provinceNameAr: '',
  provinceNameFr: '',
  serviceNameAr: 'قسم الوقاية وحفظ الصحة',
  serviceNameFr: "Service de prévention et d'hygiène",
  communeNameAr: '',
  communeNameFr: '',
  communeAddress: '',
  communePhone: '',
  communeFax: '',
  communeEmail: '',
  documentFooter: '',
}

function parseSettings(value: string | null | undefined): Partial<ReportIdentity> {
  try {
    const parsed = JSON.parse(value || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

// إعدادات الجماعة تتقدم على الإعدادات المشتركة عند إنشاء أي ملف إداري.
export async function getReportIdentity(commune: string): Promise<ReportIdentity> {
  const [shared, local] = await Promise.all([
    db.communeSettings.findUnique({ where: { commune: 'ALL' } }),
    commune !== 'ALL' ? db.communeSettings.findUnique({ where: { commune } }) : Promise.resolve(null),
  ])
  const identity = { ...DEFAULT_IDENTITY, ...parseSettings(shared?.settings), ...parseSettings(local?.settings) }
  if (!identity.communeNameAr && commune !== 'ALL') identity.communeNameAr = commune
  return identity
}

export function createAdministrativeCsvHeader(identity: ReportIdentity, title: string, scope: string): unknown[][] {
  const reference = `BCH/${new Date().getFullYear()}/${String(Date.now()).slice(-6)}`
  return [
    [identity.kingdomNameAr, identity.kingdomNameFr],
    [identity.provinceNameAr, identity.provinceNameFr],
    [identity.communeNameAr || scope, identity.communeNameFr],
    [identity.serviceNameAr, identity.serviceNameFr],
    ['عنوان التقرير', title],
    ['النطاق الترابي', scope],
    ['المرجع', reference],
    ['تاريخ الاستخراج', new Date().toLocaleString('ar-MA')],
    ['بيانات الاتصال', [identity.communeAddress, identity.communePhone, identity.communeFax, identity.communeEmail].filter(Boolean).join(' | ')],
    [],
  ]
}
