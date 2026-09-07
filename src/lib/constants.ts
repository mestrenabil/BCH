// ===== SHARED CONSTANTS & TYPES =====

// ===== AUTH CONSTANTS =====
export const COMMUNE_USER_INFO: Record<string, { username: string; password: string; color: string; icon: string }> = {
  'سلا': { username: 'sla', password: 'sla2025', color: '#059669', icon: '🏙️' },
  'سيدي أبي القنادل': { username: 'bouknadel', password: 'bouknadel2025', color: '#7c3aed', icon: '🏘️' },
  'عامر': { username: 'ameur', password: 'ameur2025', color: '#d97706', icon: '🌄' },
  'السهول': { username: 'sehoul', password: 'sehoul2025', color: '#0ea5e9', icon: '🌾' },
}

// ===== TYPE DEFINITIONS =====
export interface InterventionMaterial {
  id: string; interventionId: string; productId: string; quantity: number; createdAt: string
  product: { id: string; nom: string; unite: string; quantiteStock: number }
}

export interface InterventionPhoto {
  id: string; interventionId: string; url: string; caption: string | null; type: string; createdAt: string
}

export interface InterventionDocument {
  id: string
  interventionId: string
  documentId: string
  createdAt: string
  document: {
    id: string
    titre: string
    nomFichier: string
    typeFichier: string
    tailleFichier: number
    cheminFichier: string
    categorie?: string
    commune?: string
  }
}

export interface Intervention {
  id: string; type: string; date: string; quartier: string; adresse: string
  gisLayer?: string
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
  commune: string; createdAt: string; updatedAt: string
  heureDebut?: string | null; heureFin?: string | null
  coutMainOeuvre?: number | null; coutMateriaux?: number | null; coutTotal?: number | null
  materials?: InterventionMaterial[]
  documents?: InterventionDocument[]
  photos?: InterventionPhoto[]
}

export interface CommuneBreakdown {
  total: number
  DERATISATION: number
  DESINSECTISATION: number
  DESINFECTION: number
}

export interface Statistics {
  total: number; byType: Record<string, number>; byStatut: Record<string, number>
  complaintsToday: number
  byQuartier: { quartier: string; count: number }[]
  byCommune: Record<string, CommuneBreakdown>
  byCommuneStatus: Record<string, { byStatut: Record<string, number>; total: number }>
  monthly: Record<string, Record<string, number>>
  recent: Intervention[]
  quartiers: { id: string; nom: string; latitude: number; longitude: number }[]
}

export interface Quartier { id: string; nom: string; commune: string; latitude: number; longitude: number }

// ===== CONSTANTS =====
export const TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم', ENVIRONMENT: 'بلاغ بيئي',
}
export const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة', EN_COURS: 'جارية', TERMINEE: 'منجزة', ANNULEE: 'ملغاة',
}
export const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981', ENVIRONMENT: '#0f766e',
}
export const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6', EN_COURS: '#f59e0b', TERMINEE: '#10b981', ANNULEE: '#6b7280',
}
export const COMMUNE_LABELS: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
  'السهول': 'جماعة السهول',
}
export const COMMUNE_COLORS: Record<string, string> = {
  'سلا': '#059669',
  'سيدي أبي القنادل': '#7c3aed',
  'عامر': '#d97706',
  'السهول': '#0ea5e9',
}
export const TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴', ENVIRONMENT: '🌿',
}
export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

export const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

// ===== CAMPAGNE CONSTANTS =====
export interface Campagne {
  id: string
  nom: string
  type: string
  commune: string
  description: string
  objectif: string
  budgetPrevu: number | null
  coutReel: number | null
  dateDebut: string
  dateFin: string | null
  statut: string
  responsable: string
  couleur: string
  reference: string
  createdAt: string
  updatedAt: string
  _count?: { interventions: number }
  interventions?: Array<{
    id: string; reference: string; type: string; statut: string; date: string
    quartier: string; adresse: string; commune: string; agentNom: string
    coutTotal: number | null; superficie: string
  }>
}

export interface CampagneStats {
  total: number
  completed: number
  completionRate: number
  totalCost: number
  totalArea: number
  budgetPrevu: number
  budgetUsage: number
  byStatut: Record<string, number>
  byType: Record<string, number>
  byQuartier: Record<string, number>
  progressionSeries: { date: string; count: number }[]
}

export const CAMPAGNE_TYPE_LABELS: Record<string, string> = {
  DERATISATION: 'مكافحة القوارض',
  DESINSECTISATION: 'مكافحة الحشرات',
  DESINFECTION: 'التطهير والتعقيم',
  MIXTE: 'حملة مختلطة',
}
export const CAMPAGNE_TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444',
  DESINSECTISATION: '#f59e0b',
  DESINFECTION: '#10b981',
  MIXTE: '#8b5cf6',
}
export const CAMPAGNE_TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀',
  DESINSECTISATION: '🦟',
  DESINFECTION: '🧴',
  MIXTE: '🎪',
}
export const CAMPAGNE_STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة',
  EN_COURS: 'جارية',
  TERMINEE: 'منجزة',
  ANNULEE: 'ملغاة',
}
export const CAMPAGNE_STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6',
  EN_COURS: '#f59e0b',
  TERMINEE: '#10b981',
  ANNULEE: '#6b7280',
}
/** Palette of preset colors offered when creating a campagne. */
export const CAMPAGNE_COLOR_PRESETS = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
]

// ===== ACTIVITY LOG CONSTANTS =====
export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  CREATE: 'إنشاء',
  UPDATE: 'تحديث',
  DELETE: 'حذف',
  LOGIN: 'دخول',
  LOGOUT: 'خروج',
  EXPORT: 'تصدير',
  IMPORT: 'استيراد',
  STATUS_CHANGE: 'تغيير الحالة',
}
export const ACTIVITY_ACTION_COLORS: Record<string, string> = {
  CREATE: '#10b981',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
  LOGIN: '#8b5cf6',
  LOGOUT: '#6b7280',
  EXPORT: '#f59e0b',
  IMPORT: '#06b6d4',
  STATUS_CHANGE: '#ec4899',
}
export const ACTIVITY_ACTION_ICONS: Record<string, string> = {
  CREATE: '➕',
  UPDATE: '✏️',
  DELETE: '🗑️',
  LOGIN: '🔐',
  LOGOUT: '🚪',
  EXPORT: '📤',
  IMPORT: '📥',
  STATUS_CHANGE: '🔄',
}
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  INTERVENTION: 'تدخل',
  PRODUCT: 'منتج',
  AGENT: 'عون',
  USER: 'مستخدم',
  DOCUMENT: 'مستند',
  COMPLAINT: 'شكاية',
  SETTINGS: 'إعدادات',
}
export const ENTITY_TYPE_ICONS: Record<string, string> = {
  INTERVENTION: '📋',
  PRODUCT: '📦',
  AGENT: '👤',
  USER: '👥',
  DOCUMENT: '📄',
  COMPLAINT: '📢',
  SETTINGS: '⚙️',
}

// ===== INTERVENTION TEMPLATES =====
export const INTERVENTION_TEMPLATES = [
  {
    id: 'deratisation-standard',
    name: 'مكافحة القوارض معيارية',
    type: 'DERATISATION' as const,
    description: 'معالجة معيارية لمكافحة القوارض',
    produitUtilise: 'سيفوفوس 2%',
    superficie: '500',
    nombrePrestations: '3',
  },
  {
    id: 'desinsectisation-mouches',
    name: 'مكافحة الذباب',
    type: 'DESINSECTISATION' as const,
    description: 'رش مضاد للذباب في الأماكن العامة',
    produitUtilise: 'بيرميثرين 0.5%',
    superficie: '1000',
    nombrePrestations: '2',
  },
  {
    id: 'desinfection-covid',
    name: 'تطهير معمم',
    type: 'DESINFECTION' as const,
    description: 'تطهير شامل للأماكن المشتركة',
    produitUtilise: 'هيبوكلوريت الصوديوم 2%',
    superficie: '800',
    nombrePrestations: '1',
  },
  {
    id: 'deratisation-urgence',
    name: 'مكافحة قوارض طارئة',
    type: 'DERATISATION' as const,
    description: 'تدخل عاجل لمكافحة تفشي القوارض',
    produitUtilise: 'روديفين بلوك',
    statut: 'EN_COURS' as const,
  },
  {
    id: 'desinsectisation-moustiques',
    name: 'مكافحة البعوض',
    type: 'DESINSECTISATION' as const,
    description: 'مكافحة يرقات البعوض في المياه الراكدة',
    produitUtilise: 'أبقات 0.1%',
    superficie: '2000',
  },
]

// ===== ANIMATION VARIANTS =====
export const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.1, 0.25, 1.0] as const } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
}

export const cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
}

// Quality score thresholds
export const QUALITY_SCORE_THRESHOLDS = {
  excellent: 90,
  good: 70,
  average: 50,
  poor: 0,
}

export const QUALITY_SCORE_LABELS: Record<string, { ar: string; fr: string; color: string; icon: string }> = {
  excellent: { ar: 'ممتاز', fr: 'Excellent', color: '#10b981', icon: '🌟' },
  good: { ar: 'جيد', fr: 'Bon', color: '#3b82f6', icon: '👍' },
  average: { ar: 'متوسط', fr: 'Moyen', color: '#f59e0b', icon: '😐' },
  poor: { ar: 'ضعيف', fr: 'Faible', color: '#ef4444', icon: '⚠️' },
}

// Recurrence patterns
export const RECURRENCE_PATTERNS = [
  { key: 'NONE', ar: 'بدون تكرار', fr: 'Sans répétition', icon: '➖' },
  { key: 'DAILY', ar: 'يومي', fr: 'Quotidien', icon: '📅' },
  { key: 'WEEKLY', ar: 'أسبوعي', fr: 'Hebdomadaire', icon: '📆' },
  { key: 'BIWEEKLY', ar: 'نصف شهري', fr: 'Bimensuel', icon: '🗓️' },
  { key: 'MONTHLY', ar: 'شهري', fr: 'Mensuel', icon: '📋' },
  { key: 'QUARTERLY', ar: 'ربعي', fr: 'Trimestriel', icon: '📊' },
]

// ===== CSVR — Gestion des animaux errants =====

export const CSVR_SPECIES_LABELS: Record<string, string> = {
  DOG: 'كلب',
  CAT: 'قط',
  HORSE: 'حصان',
  DONKEY: 'حمار',
  FARM: 'حيوان ضيعة',
  OTHER: 'حيوان آخر',
}
export const CSVR_SPECIES_LABELS_FR: Record<string, string> = {
  DOG: 'Chien',
  CAT: 'Chat',
  HORSE: 'Équin',
  DONKEY: 'Âne',
  FARM: 'Animal de ferme',
  OTHER: 'Autre',
}
export const CSVR_SPECIES_ICONS: Record<string, string> = {
  DOG: '🐕',
  CAT: '🐈',
  HORSE: '🐎',
  DONKEY: '🫏',
  FARM: '🐄',
  OTHER: '🐾',
}
export const CSVR_SPECIES_COLORS: Record<string, string> = {
  DOG: '#f59e0b',
  CAT: '#8b5cf6',
  HORSE: '#92400e',
  DONKEY: '#64748b',
  FARM: '#16a34a',
  OTHER: '#64748b',
}

export const CSVR_PRIORITY_LABELS: Record<string, string> = {
  FAIBLE: 'منخفضة',
  NORMALE: 'عادية',
  HAUTE: 'مرتفعة',
  URGENTE: 'عاجلة',
  SANITAIRE: 'إسعاف صحي',
}
export const CSVR_PRIORITY_COLORS: Record<string, string> = {
  FAIBLE: '#64748b',
  NORMALE: '#3b82f6',
  HAUTE: '#f59e0b',
  URGENTE: '#ef4444',
  SANITAIRE: '#b91c1c',
}

export const CSVR_REPORT_STATUS_LABELS: Record<string, string> = {
  NOUVEAU: 'جديد',
  VERIFICATION: 'قيد التحقق',
  VALIDE: 'مُصادَق عليه',
  MISSION_PLANIFIEE: 'مهمة مبرمجة',
  EN_COURS: 'قيد التدخل',
  TRAITE: 'تمت معالجته',
  PARTIEL: 'معالجة جزئية',
  NON_LOCALISE: 'غير محدد الموقع',
  DOUBLON: 'مكرر',
  CLASSE: 'مؤرشف',
}
export const CSVR_REPORT_STATUS_COLORS: Record<string, string> = {
  NOUVEAU: '#3b82f6',
  VERIFICATION: '#f59e0b',
  VALIDE: '#10b981',
  MISSION_PLANIFIEE: '#8b5cf6',
  EN_COURS: '#06b6d4',
  TRAITE: '#22c55e',
  PARTIEL: '#eab308',
  NON_LOCALISE: '#64748b',
  DOUBLON: '#94a3b8',
  CLASSE: '#9ca3af',
}

export const CSVR_MISSION_STATUS_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة',
  CONFIRME: 'مؤكدة',
  EN_ROUTE: 'في الطريق',
  SUR_PLACE: 'في عين المكان',
  CAPTURE_EN_COURS: 'الاصطياد جارٍ',
  TERMINEE: 'منتهية',
  PARTIEL: 'منجزة جزئياً',
  REPORTEE: 'مؤجلة',
  ANNULEE: 'ملغاة',
}
export const CSVR_MISSION_STATUS_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6',
  CONFIRME: '#8b5cf6',
  EN_ROUTE: '#06b6d4',
  SUR_PLACE: '#0ea5e9',
  CAPTURE_EN_COURS: '#f59e0b',
  TERMINEE: '#22c55e',
  PARTIEL: '#eab308',
  REPORTEE: '#f97316',
  ANNULEE: '#ef4444',
}

export const CSVR_ANIMAL_STATUS_LABELS: Record<string, string> = {
  SIGNALISE: 'مُبلَّغ عنه',
  LOCALISE: 'مُحدَّد الموقع',
  CAPTURE: 'تم اصطياده',
  TRANSPORTE: 'قيد النقل',
  ADMIT_CENTRE: 'مقبول بالمركز',
  QUARANTINE: 'في الحجر الصحي',
  OBSERVATION: 'قيد المراقبة',
  SOINS: 'قيد العلاج',
  APTE_STERIL: 'مُؤهَّل للتعقيم',
  STERILISE: 'مُعقَّم',
  VACCINE: 'مُلقَّح',
  IDENTIFIE: 'مُعرَّف',
  CONVALESCENCE: 'فترة النقاهة',
  PRET_RELACHER: 'جاهز للإطلاق',
  RELACHE: 'تم إطلاقه',
  ADOPTABLE: 'قابل للتبني',
  ADOPTE: 'تم تبنيه',
  TRANSFERE: 'تم تحويله',
  DECEDE: 'متوفى',
  CLOTURE: 'ملف مغلق',
}
export const CSVR_ANIMAL_STATUS_COLORS: Record<string, string> = {
  SIGNALISE: '#3b82f6',
  LOCALISE: '#0ea5e9',
  CAPTURE: '#f59e0b',
  TRANSPORTE: '#06b6d4',
  ADMIT_CENTRE: '#8b5cf6',
  QUARANTINE: '#dc2626',
  OBSERVATION: '#f59e0b',
  SOINS: '#eab308',
  APTE_STERIL: '#14b8a6',
  STERILISE: '#22c55e',
  VACCINE: '#10b981',
  IDENTIFIE: '#0d9488',
  CONVALESCENCE: '#a855f7',
  PRET_RELACHER: '#84cc16',
  RELACHE: '#16a34a',
  ADOPTABLE: '#ec4899',
  ADOPTE: '#db2777',
  TRANSFERE: '#6366f1',
  DECEDE: '#64748b',
  CLOTURE: '#9ca3af',
}

export const CSVR_REPORT_SOURCE_LABELS: Record<string, string> = {
  INTERNAL: 'داخلي',
  PUBLIC: 'مواطن',
  PHONE: 'هاتف',
  AUTHORITY: 'سلطة',
  ASSOCIATION: 'جمعية',
  AGENT: 'عون',
  COMMUNE: 'جماعة',
  EDUCATIONAL: 'مؤسسة تعليمية',
  HEALTH: 'مؤسسة صحية',
  SECURITY: 'أمن / درك',
  PROGRAMMED: 'تدخل مبرمج',
  OTHER: 'مصدر آخر',
}

export const CSVR_SEX_LABELS: Record<string, string> = {
  MALE: 'ذكر',
  FEMALE: 'أنثى',
  UNKNOWN: 'غير معروف',
}

export const CSVR_CAPTURE_STATE_LABELS: Record<string, string> = {
  CALME: 'هادئ',
  PEUREUX: 'خائف',
  AGRESSIF: 'عدواني',
  BLESSE: 'جريح',
  MALADE: 'مريض',
  AMAIGRI: 'نحيل',
  GESTANTE: 'حامل',
  ALLAITANTE: 'مرضع',
}

// ===== Food safety report constants =====

export const FOOD_TYPE_LABELS: Record<string, string> = {
  RESTAURANT: 'مطاعم ومأكولات',
  EXPIRED_PRODUCT: 'منتجات فاسدة',
  STREET_VENDOR: 'باعة متجولون',
  PREMISES_HYGIENE: 'نظافة المحلات',
}

export const FOOD_TYPE_ICONS: Record<string, string> = {
  RESTAURANT: '🍽️',
  EXPIRED_PRODUCT: '🛒',
  STREET_VENDOR: '🛍️',
  PREMISES_HYGIENE: '🗑️',
}

export const FOOD_TYPE_COLORS: Record<string, string> = {
  RESTAURANT: '#dc2626',
  EXPIRED_PRODUCT: '#ea580c',
  STREET_VENDOR: '#d97706',
  PREMISES_HYGIENE: '#6b7280',
}

export const FOOD_REPORT_STATUS_LABELS: Record<string, string> = {
  NOUVEAU: 'جديد',
  VERIFICATION: 'قيد التحقق',
  VALIDE: 'مصادق عليه',
  EN_COURS: 'قيد المعالجة',
  TRAITE: 'تمت المعالجة',
  REJETE: 'مرفوض',
  CLASSE: 'مؤرشف',
}

export const FOOD_REPORT_STATUS_COLORS: Record<string, string> = {
  NOUVEAU: '#3b82f6',
  VERIFICATION: '#f59e0b',
  VALIDE: '#8b5cf6',
  EN_COURS: '#06b6d4',
  TRAITE: '#10b981',
  REJETE: '#ef4444',
  CLASSE: '#94a3b8',
}

// أولويات البلاغات الغذائية
export const FOOD_PRIORITY_LABELS: Record<string, string> = {
  FAIBLE: 'منخفضة',
  NORMALE: 'عادية',
  HAUTE: 'مرتفعة',
  URGENTE: 'عاجلة',
  SANITAIRE: 'صحية خطيرة',
}

export const FOOD_PRIORITY_COLORS: Record<string, string> = {
  FAIBLE: '#94a3b8',
  NORMALE: '#3b82f6',
  HAUTE: '#f59e0b',
  URGENTE: '#ea580c',
  SANITAIRE: '#dc2626',
}

// أنواع المنشآت للاختيار عند الإنشاء الداخلي
export const FOOD_ESTABLISHMENT_TYPES: string[] = [
  'مطعم',
  'مقهى',
  'وجبات سريعة',
  'محل بقالة',
  'سوبر ماركت',
  'دكان حي',
  'بائع متجول',
  'سوق أسبوعي',
  'مخبزة',
  'جزّار',
  'حلواني',
  'مطعم جماعي',
  'محل آخر',
]

// نصائح/توصيات حسب نوع المخالفة (للوحة القيادة)
export const FOOD_TYPE_ADVICE: Record<string, string> = {
  RESTAURANT: 'معاينة شروط النظافة، صلاحية المواد، رخصة الاستغلال',
  EXPIRED_PRODUCT: 'مصادرة المنتجات، فحص سلسلة التبريد، ضبط المخزون',
  STREET_VENDOR: 'ضبط الباعة المتجولين، التحقق من الشهادات الصحية',
  PREMISES_HYGIENE: 'معاينة البنية، التهوية، النفايات، مياه الشرب',
}

// ===== Dossiers unifiés (راجع docs/BACKLOG.md المرحلة 2) =====

// المكاتب التسعة (ثابت، راجع AGENTS.md §3)
export const OFFICES: Record<string, { nameFr: string; nameAr: string; icon: string }> = {
  OFFICE_01: { nameFr: 'Direction', nameAr: 'الإدارة والتوجيه', icon: '🏢' },
  OFFICE_02: { nameFr: 'Contrôle Sanitaire', nameAr: 'المراقبة الصحية والسلامة الغذائية', icon: '🍽️' },
  OFFICE_03: { nameFr: 'Eau & Assainissement', nameAr: 'الماء والتطهير الصحي', icon: '💧' },
  OFFICE_04: { nameFr: 'Lutte Antivectorielle', nameAr: 'محاربة النواقل والتطهير والحيوانات الضالة', icon: '🐀' },
  OFFICE_05: { nameFr: 'Funérailles', nameAr: 'الجنائز والمقابر والمستودع', icon: '⚱️' },
  OFFICE_06: { nameFr: 'Environnement', nameAr: 'المحافظة على البيئة', icon: '🌳' },
  OFFICE_07: { nameFr: 'Réclamations', nameAr: 'الشكايات واليقظة الصحية', icon: '📢' },
  OFFICE_08: { nameFr: 'Autorisations', nameAr: 'التراخيص واللجان', icon: '📋' },
  OFFICE_09: { nameFr: 'Statistiques', nameAr: 'التخطيط والتقارير والإحصائيات', icon: '📊' },
}

// دورة حياة الملف الموحّدة
export const DOSSIER_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد',
  ASSIGNED: 'مُكلّف',
  IN_PROGRESS: 'قيد المعالجة',
  INSPECTED: 'تمت المعاينة',
  ACTION_REQUIRED: 'يتطلب إجراءً',
  FOLLOW_UP: 'متابعة',
  PENDING_VALIDATION: 'بانتظار المصادقة',
  CLOSED: 'مغلق',
  ARCHIVED: 'مؤرشف',
}

export const DOSSIER_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6',
  ASSIGNED: '#8b5cf6',
  IN_PROGRESS: '#06b6d4',
  INSPECTED: '#0ea5e9',
  ACTION_REQUIRED: '#f59e0b',
  FOLLOW_UP: '#eab308',
  PENDING_VALIDATION: '#a855f7',
  CLOSED: '#10b981',
  ARCHIVED: '#94a3b8',
}

// الترتيب المنطقي لدورة الحياة (للعرض)
export const DOSSIER_STATUS_FLOW = [
  'NEW', 'ASSIGNED', 'IN_PROGRESS', 'INSPECTED', 'ACTION_REQUIRED',
  'FOLLOW_UP', 'PENDING_VALIDATION', 'CLOSED', 'ARCHIVED',
]

// أنواع الملفات
export const DOSSIER_TYPE_LABELS: Record<string, string> = {
  INSPECTION: 'تفتيش',
  COMPLAINT: 'شكاية',
  MISSION: 'مهمة',
  INTERVENTION_3D: 'تدخل 3D',
  STRAY_ANIMAL: 'حيوان شارد',
  FOOD_SAFETY: 'سلامة غذائية',
  WORK_ORDER: 'أمر عمل',
  AUTHORIZATION: 'ترخيص',
  ENVIRONMENTAL: 'بيئي',
  WATER: 'مياه',
  SANITATION: 'صرف صحي',
  BURIAL: 'جنائز',
  OTHER: 'أخرى',
}

export const DOSSIER_TYPE_ICONS: Record<string, string> = {
  INSPECTION: '🔍',
  COMPLAINT: '📢',
  MISSION: '🎯',
  INTERVENTION_3D: '🧪',
  STRAY_ANIMAL: '🐾',
  FOOD_SAFETY: '🥗',
  WORK_ORDER: '🧭',
  AUTHORIZATION: '📋',
  ENVIRONMENTAL: '🌳',
  WATER: '💧',
  SANITATION: '🚿',
  BURIAL: '⚱️',
  OTHER: '📁',
}

// إجراءات الـ timeline
export const DOSSIER_EVENT_LABELS: Record<string, string> = {
  CREATE: 'إنشاء',
  STATUS_CHANGE: 'تغيير الحالة',
  ASSIGN: 'تكليف',
  COMMENT: 'تعليق',
  LINK: 'ربط كيان',
}

// ===== Bureau 02: Contrôle Sanitaire (المراقبة الصحية) =====

// حالات المنشأة
export const ESTABLISHMENT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشطة',
  SUSPENDED: 'موقوفة',
  CLOSED: 'مغلقة',
}

export const ESTABLISHMENT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981',
  SUSPENDED: '#f59e0b',
  CLOSED: '#ef4444',
}

// فئات المخاطر
export const RISK_CATEGORY_LABELS: Record<string, string> = {
  LOW: 'منخفض',
  MEDIUM: 'متوسط',
  HIGH: 'مرتفع',
  CRITICAL: 'حرج',
  UNCLASSIFIED: 'غير مصنّف',
}

export const RISK_CATEGORY_COLORS: Record<string, string> = {
  LOW: '#10b981',
  MEDIUM: '#f59e0b',
  HIGH: '#ea580c',
  CRITICAL: '#dc2626',
  UNCLASSIFIED: '#94a3b8',
}

// أنواع التفتيش
export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  INITIAL: 'ابتدائي',
  PERIODIC: 'دوري',
  UNANNOUNCED: 'مفاجئ',
  COMPLAINT: 'بسبب شكاية',
  COUNTER_VISIT: 'معاينة متابعة',
  AUTHORIZATION: 'للترخيص',
  COMMITTEE: 'لجنة',
}

export const INSPECTION_TYPE_ICONS: Record<string, string> = {
  INITIAL: '🆕',
  PERIODIC: '🔄',
  UNANNOUNCED: '⚡',
  COMPLAINT: '📢',
  COUNTER_VISIT: '🔁',
  AUTHORIZATION: '📋',
  COMMITTEE: '👥',
}

// نتائج التفتيش
export const INSPECTION_RESULT_LABELS: Record<string, string> = {
  PENDING: 'قيد المعالجة',
  CONFORM: 'مطابق',
  NON_CONFORM_MINOR: 'مخالفات بسيطة',
  NON_CONFORM_MAJOR: 'مخالفات كبيرة',
  NON_CONFORM_CRITICAL: 'مخالفات حرجة',
  CLOSED: 'إغلاق',
}

export const INSPECTION_RESULT_COLORS: Record<string, string> = {
  PENDING: '#3b82f6',
  CONFORM: '#10b981',
  NON_CONFORM_MINOR: '#f59e0b',
  NON_CONFORM_MAJOR: '#ea580c',
  NON_CONFORM_CRITICAL: '#dc2626',
  CLOSED: '#7f1d1d',
}

// خطورة النقائص
export const FINDING_SEVERITY_LABELS: Record<string, string> = {
  MINOR: 'بسيط',
  MAJOR: 'كبير',
  CRITICAL: 'حرج',
}

export const FINDING_SEVERITY_COLORS: Record<string, string> = {
  MINOR: '#f59e0b',
  MAJOR: '#ea580c',
  CRITICAL: '#dc2626',
}

// أوزان النقائص في درجة المخاطر
export const FINDING_SEVERITY_WEIGHTS: Record<string, number> = {
  MINOR: 5,
  MAJOR: 15,
  CRITICAL: 35,
}

// فئات قائمة الفحص (Checklist categories)
export const INSPECTION_CATEGORIES: { key: string; label: string; icon: string }[] = [
  { key: 'CLEANLINESS', label: 'النظافة العامة', icon: '🧹' },
  { key: 'STAFF_HYGIENE', label: 'نظافة الطاقم', icon: '👷' },
  { key: 'HANDWASHING', label: 'غسل اليدين', icon: '🚿' },
  { key: 'CLOTHING', label: 'الملابس الواقية', icon: '👔' },
  { key: 'SURFACES', label: 'الأسطح', icon: '🪵' },
  { key: 'EQUIPMENT', label: 'المعدات', icon: '🔧' },
  { key: 'STORAGE', label: 'التخزين', icon: '📦' },
  { key: 'COLD_CHAIN', label: 'السلسلة الباردة', icon: '❄️' },
  { key: 'TEMPERATURE', label: 'درجة الحرارة', icon: '🌡️' },
  { key: 'EXPIRATION', label: 'تواريخ الصلاحية', icon: '📅' },
  { key: 'TRACEABILITY', label: 'إمكانية التتبع', icon: '🔗' },
  { key: 'CROSS_CONTAMINATION', label: 'التلوث المتبادل', icon: '⚠️' },
  { key: 'WATER', label: 'الماء', icon: '💧' },
  { key: 'WASTEWATER', label: 'مياه الصرف', icon: '🚽' },
  { key: 'WASTE', label: 'النفايات', icon: '🗑️' },
  { key: 'PEST_CONTROL', label: 'مكافحة الآفات', icon: '🐀' },
  { key: 'CLEANING_DISINFECTION', label: 'التنظيف والتطهير', icon: '🧴' },
  { key: 'CHEMICALS', label: 'المواد الكيميائية', icon: '⚗️' },
  { key: 'TOILETS', label: 'المراحيض', icon: '🚻' },
  { key: 'VENTILATION', label: 'التهوية', icon: '💨' },
]

// حالة الإجراءات التصحيحية
export const CORRECTIVE_ACTION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'بانتظار التنفيذ',
  IN_PROGRESS: 'قيد التنفيذ',
  DONE: 'منجز',
  VERIFIED: 'تم التحقق',
}

export const CORRECTIVE_ACTION_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  IN_PROGRESS: '#06b6d4',
  DONE: '#10b981',
  VERIFIED: '#3b82f6',
}

// حالة البطاقة الصحية
export const HEALTH_CARD_STATUS_LABELS: Record<string, string> = {
  VALID: 'سارية',
  EXPIRED: 'منتهية',
  PENDING: 'بانتظار الفحص',
  RENEWING: 'قيد التجديد',
}

export const HEALTH_CARD_STATUS_COLORS: Record<string, string> = {
  VALID: '#10b981',
  EXPIRED: '#dc2626',
  PENDING: '#f59e0b',
  RENEWING: '#3b82f6',
}

// مطابقة العينات
export const SAMPLE_CONFORMITY_LABELS: Record<string, string> = {
  PENDING: 'بانتظار النتائج',
  CONFORM: 'مطابق',
  NON_CONFORM: 'غير مطابق',
}

export const SAMPLE_CONFORMITY_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CONFORM: '#10b981',
  NON_CONFORM: '#dc2626',
}

// ===== Bureau 03: Eau, Assainissement (الماء والتطهير) =====

export const WATER_POINT_TYPE_LABELS: Record<string, string> = {
  NETWORK: 'شبكة عمومية',
  RESERVOIR: 'خزان',
  TOWER: 'برج مياه',
  FOUNTAIN: 'نافورة عمومية',
  WELL: 'بئر',
  BOREHOLE: 'حفر',
  SOURCE: 'عين/منبع',
  CISTERN: 'صهريج',
  INSTITUTION: 'مؤسسة عمومية',
}

export const WATER_POINT_TYPE_ICONS: Record<string, string> = {
  NETWORK: '🕸️', RESERVOIR: '🛢️', TOWER: '🗼', FOUNTAIN: '⛲',
  WELL: '🕳️', BOREHOLE: '⛏️', SOURCE: '🌊', CISTERN: '🚛', INSTITUTION: '🏛️',
}

export const WATER_POINT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعّالة', MAINTENANCE: 'صيانة', OUT_OF_SERVICE: 'خارج الخدمة',
}
export const WATER_POINT_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981', MAINTENANCE: '#f59e0b', OUT_OF_SERVICE: '#ef4444',
}

export const WATER_MEAS_CONFORMITY_LABELS: Record<string, string> = {
  PENDING: 'بانتظار النتائج', CONFORM: 'مطابق', NON_CONFORM: 'غير مطابق',
}
export const WATER_MEAS_CONFORMITY_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', CONFORM: '#10b981', NON_CONFORM: '#dc2626',
}

export const POOL_TYPE_LABELS: Record<string, string> = {
  SWIMMING: 'مسبح', BASIN: 'حوض', BATHING_SITE: 'موقع استحمام',
}
export const POOL_TYPE_ICONS: Record<string, string> = { SWIMMING: '🏊', BASIN: '🛁', BATHING_SITE: '🏖️' }

export const SANITATION_TYPE_LABELS: Record<string, string> = {
  BLOCKAGE: 'انسداد',
  OVERFLOW: 'فيضان صرف',
  DISCHARGE: 'تصريف مياه عادمة',
  STAGNANT: 'مياه راكدة',
  BROKEN: 'بنية تحطّمت',
  SEPTIC: 'مشكل صهريج/امتصاص',
  NUISANCE: 'إزعاج عمومي',
}
export const SANITATION_TYPE_ICONS: Record<string, string> = {
  BLOCKAGE: '🚧', OVERFLOW: '🌊', DISCHARGE: '🚿', STAGNANT: '💧',
  BROKEN: '🔧', SEPTIC: '🚽', NUISANCE: '😠',
}
export const SANITATION_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', ASSIGNED: 'مُكلّف', IN_PROGRESS: 'قيد المعالجة', VERIFIED: 'تم التحقق', CLOSED: 'مغلق',
}
export const SANITATION_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', ASSIGNED: '#8b5cf6', IN_PROGRESS: '#06b6d4', VERIFIED: '#f59e0b', CLOSED: '#10b981',
}
export const SANITATION_RISK_LABELS: Record<string, string> = {
  LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'مرتفع', CRITICAL: 'حرج',
}
export const SANITATION_RISK_COLORS: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626',
}

// ===== Bureau 04: Lutte Antivectorielle (محاربة النواقل) =====

export const PEST_PRODUCT_CATEGORY_LABELS: Record<string, string> = {
  INSECTICIDE: 'مبيد حشري',
  RODENTICIDE: 'مبيد قوارض',
  DISINFECTANT: 'مطهّر',
  REPELLENT: 'طارد',
  BAIT: 'طُعم',
  OTHER: 'أخرى',
}
export const PEST_PRODUCT_CATEGORY_ICONS: Record<string, string> = {
  INSECTICIDE: '🪲', RODENTICIDE: '🐀', DISINFECTANT: '🧴', REPELLENT: '🚫', BAIT: '🧀', OTHER: '📦',
}

export const PEST_PRODUCT_UNIT_LABELS: Record<string, string> = {
  LITRE: 'لتر', KG: 'كيلوغرام', UNIT: 'وحدة', BOX: 'علبة', GRAM: 'غرام', ML: 'مليلتر',
}

export const PEST_MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ENTREE: 'إدخال', SORTIE: 'إخراج', AJUSTEMENT: 'تسوية', PEREMPTION: 'انتهاء صلاحية',
}
export const PEST_MOVEMENT_TYPE_COLORS: Record<string, string> = {
  ENTREE: '#10b981', SORTIE: '#ef4444', AJUSTEMENT: '#f59e0b', PEREMPTION: '#7f1d1d',
}

// أهداف البيوسيدات
export const PEST_TARGETS: string[] = [
  'فئران', 'جرذان', 'بعوض', 'ذباب', 'صراصير', 'براغيث', 'قراد', 'بق', 'نمل', 'عناكب', 'أخرى',
]

// حالات السع/العضة
export const BITE_ANIMAL_LABELS: Record<string, string> = {
  DOG: 'كلب', CAT: 'قطة', MONKEY: 'قرد', OTHER: 'حيوان آخر',
}
export const BITE_ANIMAL_ICONS: Record<string, string> = { DOG: '🐕', CAT: '🐈', MONKEY: '🐒', OTHER: '🐾' }

export const BITE_ANIMAL_STATUS_LABELS: Record<string, string> = {
  UNKNOWN: 'غير معروف', OWNED: 'مملوك', STRAY: 'شارد', VACCINATED: 'مُلقّح', SUSPECT: 'مشتبه', DEAD: 'نفوق',
}

export const BITE_CASE_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', REPORTED: 'مُبلّغ', FOLLOWING: 'قيد المتابعة', VACCINATION_STARTED: 'بدأ التلقيح', VACCINATION_COMPLETE: 'اكتمل التلقيح', CLOSED: 'مغلق', LOST_CONTACT: 'انقطع الاتصال',
}
export const BITE_CASE_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', REPORTED: '#8b5cf6', FOLLOWING: '#06b6d4', VACCINATION_STARTED: '#f59e0b', VACCINATION_COMPLETE: '#10b981', CLOSED: '#64748b', LOST_CONTACT: '#ef4444',
}

// ===== Bureau 05: Funérailles (الجنائز والمقابر) =====

export const DEATH_CASE_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', MORGUE: 'في المستودع', BURIED: 'مدفون', TRANSPORTED: 'تم النقل', EXHUMED: 'تم النبش', CLOSED: 'مغلق',
}
export const DEATH_CASE_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', MORGUE: '#8b5cf6', BURIED: '#64748b', TRANSPORTED: '#06b6d4', EXHUMED: '#f59e0b', CLOSED: '#94a3b8',
}

export const MORGUE_STATUS_LABELS: Record<string, string> = {
  NONE: 'غير مُدخل', ADMITTED: 'مُدخل', RELEASED: 'تم الإخراج',
}
export const MORGUE_STATUS_COLORS: Record<string, string> = {
  NONE: '#94a3b8', ADMITTED: '#8b5cf6', RELEASED: '#10b981',
}

export const BURIAL_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', AUTHORIZED: 'مُرخّص', BURIED: 'تم الدفن', CLOSED: 'مغلق',
}
export const BURIAL_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', AUTHORIZED: '#10b981', BURIED: '#64748b', CLOSED: '#94a3b8',
}

export const AUTHORIZATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'بانتظار المصادقة', APPROVED: 'موافَق عليه', REJECTED: 'مرفوض',
}
export const AUTHORIZATION_STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', APPROVED: '#10b981', REJECTED: '#ef4444',
}

export const CEMETERY_TYPE_LABELS: Record<string, string> = {
  MUSLIM: 'إسلامي', JEWISH: 'يهودي', CHRISTIAN: 'مسيحي', COMMUNAL: 'بلدي',
}
export const CEMETERY_TYPE_ICONS: Record<string, string> = {
  MUSLIM: '☪️', JEWISH: '✡️', CHRISTIAN: '✝️', COMMUNAL: '🏛️',
}

export const CEMETERY_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'فعّال', FULL: 'ممتلئ', CLOSED: 'مغلق', MAINTENANCE: 'صيانة',
}
export const CEMETERY_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#10b981', FULL: '#ef4444', CLOSED: '#64748b', MAINTENANCE: '#f59e0b',
}

export const TRANSPORT_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', AUTHORIZED: 'مُرخّص', IN_TRANSIT: 'قيد النقل', COMPLETED: 'تم', CANCELLED: 'ملغى',
}
export const TRANSPORT_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', AUTHORIZED: '#10b981', IN_TRANSIT: '#06b6d4', COMPLETED: '#64748b', CANCELLED: '#ef4444',
}

export const EXHUMATION_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', AUTHORIZED: 'مُرخّص', COMPLETED: 'تم', REJECTED: 'مرفوض',
}
export const EXHUMATION_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', AUTHORIZED: '#10b981', COMPLETED: '#64748b', REJECTED: '#ef4444',
}

// ===== Bureau 06: Protection de l'Environnement (البيئة) =====

export const ENV_DOSSIER_CATEGORY_LABELS: Record<string, string> = {
  POLLUTION: 'تلوث', WASTE: 'نفايات', PROJECT: 'مشروع بيئي', IMPACT_REVIEW: 'دراسة أثر',
  SITE: 'موقع', NATURAL_HERITAGE: 'تراث طبيعي', OTHER: 'أخرى',
}
export const ENV_DOSSIER_CATEGORY_ICONS: Record<string, string> = {
  POLLUTION: '🏭', WASTE: '🗑️', PROJECT: '🏗️', IMPACT_REVIEW: '📋', SITE: '📍', NATURAL_HERITAGE: '🏛️', OTHER: '📁',
}

export const POLLUTION_TYPE_LABELS: Record<string, string> = {
  AIR: 'هواء', WATER: 'ماء', SOIL: 'تربة', NOISE: 'ضجيج',
  ODOUR: 'روائح', SMOKE: 'دخان', DUST: 'غبار', WASTEWATER: 'مياه عادمة', INDUSTRIAL: 'تصريف صناعي',
}
export const POLLUTION_TYPE_ICONS: Record<string, string> = {
  AIR: '💨', WATER: '💧', SOIL: '🌍', NOISE: '🔊', ODOUR: '👃', SMOKE: '🏭', DUST: '🌪️', WASTEWATER: '🚿', INDUSTRIAL: '⚗️',
}
export const POLLUTION_SEVERITY_LABELS: Record<string, string> = {
  LOW: 'منخفض', MEDIUM: 'متوسط', HIGH: 'مرتفع', CRITICAL: 'حرج',
}
export const POLLUTION_SEVERITY_COLORS: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ea580c', CRITICAL: '#dc2626',
}
export const POLLUTION_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', INVESTIGATING: 'قيد التحقيق', MITIGATING: 'إجراءات التخفيف', CLOSED: 'مغلق',
}
export const POLLUTION_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', INVESTIGATING: '#f59e0b', MITIGATING: '#06b6d4', CLOSED: '#10b981',
}

export const WASTE_TYPE_LABELS: Record<string, string> = {
  HOUSEHOLD: 'منزلية', CONSTRUCTION: 'بناء', INDUSTRIAL: 'صناعية', GREEN: 'خضراء', MIXED: 'مختلطة',
}
export const WASTE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'نشط', CLEANED: 'تم التنظيف', MONITORING: 'مراقبة', CLOSED: 'مغلق',
}
export const WASTE_STATUS_COLORS: Record<string, string> = {
  ACTIVE: '#ef4444', CLEANED: '#10b981', MONITORING: '#f59e0b', CLOSED: '#64748b',
}

export const NATURAL_SITE_TYPE_LABELS: Record<string, string> = {
  FOREST: 'غابة', WETLAND: 'منطقة رطبة', COASTAL: 'ساحلي', PARK: 'حديقة', RESERVE: 'محمية', HISTORICAL: 'تراثي', OTHER: 'أخرى',
}
export const NATURAL_SITE_TYPE_ICONS: Record<string, string> = {
  FOREST: '🌲', WETLAND: '🦩', COASTAL: '🏖️', PARK: '🏞️', RESERVE: '🛡️', HISTORICAL: '🏛️', OTHER: '📍',
}
export const SITE_PROTECTION_LABELS: Record<string, string> = {
  NONE: 'بدون', LOCAL: 'محلي', REGIONAL: 'جهوي', NATIONAL: 'وطني', INTERNATIONAL: 'دولي',
}
export const SITE_STATUS_LABELS: Record<string, string> = {
  INTACT: 'سليم', THREATENED: 'مهدّد', DEGRADED: 'متدهور', PROTECTED: 'محمي',
}
export const SITE_STATUS_COLORS: Record<string, string> = {
  INTACT: '#10b981', THREATENED: '#f59e0b', DEGRADED: '#ef4444', PROTECTED: '#3b82f6',
}

export const CAMPAIGN_THEME_LABELS: Record<string, string> = {
  WASTE_REDUCTION: 'تقليل النفايات', RECYCLING: 'إعادة التدوير', WATER: 'الماء', AIR: 'الهواء', BIODIVERSITY: 'التنوع البيولوجي', TREE_PLANTING: 'تشجير', GENERAL: 'عام',
}
export const CAMPAIGN_THEME_ICONS: Record<string, string> = {
  WASTE_REDUCTION: '♻️', RECYCLING: '🔄', WATER: '💧', AIR: '💨', BIODIVERSITY: '🦋', TREE_PLANTING: '🌳', GENERAL: '📢',
}
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'مخطّط', ACTIVE: 'نشطة', COMPLETED: 'منجزة', CANCELLED: 'ملغاة',
}
export const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  PLANNED: '#3b82f6', ACTIVE: '#10b981', COMPLETED: '#64748b', CANCELLED: '#ef4444',
}

// ===== Bureau 07: Réclamations et Veille (الشكايات واليقظة) =====
// تصنيف موسّع للشكايات حسب الـ spec

export const COMPLAINT_CATEGORY_LABELS: Record<string, string> = {
  RESTAURANT: 'مطعم',
  FOOD: 'طعام',
  RATS: 'قوارض',
  INSECTS: 'حشرات',
  MOSQUITOES: 'بعوض',
  STRAY_DOGS: 'كلاب ضالة',
  SEWAGE: 'صرف صحي',
  WASTEWATER: 'مياه عادمة',
  WASTE: 'نفايات',
  ODOURS: 'روائح',
  POLLUTION: 'تلوث',
  NOISE: 'ضجيج',
  UNSAFE_PREMISES: 'محل خطير',
  WATER: 'ماء',
  HOUSING_HYGIENE: 'نظافة سكن',
  OTHER: 'أخرى',
}

export const COMPLAINT_CATEGORY_ICONS: Record<string, string> = {
  RESTAURANT: '🍽️', FOOD: '🥗', RATS: '🐀', INSECTS: '🪲', MOSQUITOES: '🦟',
  STRAY_DOGS: '🐕', SEWAGE: '🚽', WASTEWATER: '🚿', WASTE: '🗑️', ODOURS: '👃',
  POLLUTION: '🏭', NOISE: '🔊', UNSAFE_PREMISES: '⚠️', WATER: '💧', HOUSING_HYGIENE: '🏠', OTHER: '📢',
}

// المكتب المختص حسب نوع الشكاية (خرائطة تلقائية)
export const COMPLAINT_OFFICE_MAP: Record<string, string> = {
  RESTAURANT: 'OFFICE_02', FOOD: 'OFFICE_02',
  RATS: 'OFFICE_04', INSECTS: 'OFFICE_04', MOSQUITOES: 'OFFICE_04', STRAY_DOGS: 'OFFICE_04',
  SEWAGE: 'OFFICE_03', WASTEWATER: 'OFFICE_03', WATER: 'OFFICE_03',
  WASTE: 'OFFICE_06', ODOURS: 'OFFICE_06', POLLUTION: 'OFFICE_06',
  NOISE: 'OFFICE_06', UNSAFE_PREMISES: 'OFFICE_02', HOUSING_HYGIENE: 'OFFICE_06',
  OTHER: 'OFFICE_07',
}

// أولويات الشكاية الموحّدة (تطابق الـ spec)
export const VIGILANCE_PRIORITY_LABELS: Record<string, string> = {
  NORMAL: 'عادية', IMPORTANT: 'مهمة', URGENT: 'عاجلة', CRITICAL: 'حرجة',
}
export const VIGILANCE_PRIORITY_COLORS: Record<string, string> = {
  NORMAL: '#3b82f6', IMPORTANT: '#f59e0b', URGENT: '#ea580c', CRITICAL: '#dc2626',
}

// SLA: مهلة المعالجة حسب الأولوية (أيام)
export const VIGILANCE_SLA_DAYS: Record<string, number> = {
  NORMAL: 7, IMPORTANT: 3, URGENT: 1, CRITICAL: 0, // حرجة = فوري
}

// مصادر البلاغات (للعرض في لوحة القيادة الموحّدة)
export const REPORT_SOURCE_LABELS: Record<string, string> = {
  COMPLAINT: 'شكاية مواطنية',
  FOOD_REPORT: 'بلاغ غذائي',
  STRAY_REPORT: 'بلاغ حيوان شارد',
  POLLUTION: 'حادث تلوث',
  SANITATION: 'حادث صرف',
}
export const REPORT_SOURCE_ICONS: Record<string, string> = {
  COMPLAINT: '📢', FOOD_REPORT: '🥗', STRAY_REPORT: '🐾', POLLUTION: '🏭', SANITATION: '🚿',
}

// ===== Bureau 08: Autorisations et Commissions (التراخيص واللجان) =====

export const AUTH_REQUEST_TYPE_LABELS: Record<string, string> = {
  COMMERCIAL: 'ترخيص تجاري', BUILDING: 'رأي بناء', OCCUPANCY: 'رأي سكن', CONFORMITY: 'رأي مطابقة', CLASSIFIED: 'منشأة مصنّفة',
}
export const AUTH_REQUEST_TYPE_ICONS: Record<string, string> = {
  COMMERCIAL: '🏪', BUILDING: '🏗️', OCCUPANCY: '🏠', CONFORMITY: '✅', CLASSIFIED: '🏭',
}

export const AUTH_STATUS_LABELS: Record<string, string> = {
  NEW: 'جديد', UNDER_REVIEW: 'قيد الدراسة', OPINION_ISSUED: 'صدر الرأي', CLOSED: 'مغلق', REJECTED: 'مرفوض',
}
export const AUTH_STATUS_COLORS: Record<string, string> = {
  NEW: '#3b82f6', UNDER_REVIEW: '#f59e0b', OPINION_ISSUED: '#10b981', CLOSED: '#64748b', REJECTED: '#ef4444',
}

// أنواع الآراء (موافقة/تحفظات/رفض)
export const OPINION_RESULT_LABELS: Record<string, string> = {
  PENDING: 'بانتظار', FAVORABLE: 'مؤيّت', FAVORABLE_RESERVATIONS: 'مؤيّت بتحفّظات', UNFAVORABLE: 'معارض', ADDITIONAL_INFO: 'معلومات إضافية مطلوبة',
}
export const OPINION_RESULT_COLORS: Record<string, string> = {
  PENDING: '#f59e0b', FAVORABLE: '#10b981', FAVORABLE_RESERVATIONS: '#3b82f6', UNFAVORABLE: '#ef4444', ADDITIONAL_INFO: '#a855f7',
}

export const COMMITTEE_STATUS_LABELS: Record<string, string> = {
  PLANNED: 'مخطّطة', COMPLETED: 'منجزة', CANCELLED: 'ملغاة',
}
export const COMMITTEE_STATUS_COLORS: Record<string, string> = {
  PLANNED: '#3b82f6', COMPLETED: '#10b981', CANCELLED: '#ef4444',
}

// ===== GIS: طبقات الخريطة العالمية =====

export const GIS_LAYERS: { key: string; label: string; section: string; view: string; icon: string; color: string }[] = [
  { key: 'interventions', label: 'تدخلات 3D', section: 'إدارة التدخلات', view: 'interventions', icon: '🧪', color: '#dc2626' },
  { key: 'deratisation', label: 'مكافحة القوارض', section: 'إدارة التدخلات', view: 'interventions', icon: '🐀', color: '#b91c1c' },
  { key: 'desinsectisation', label: 'مكافحة الحشرات', section: 'إدارة التدخلات', view: 'interventions', icon: '🪲', color: '#c2410c' },
  { key: 'desinfection', label: 'التطهير والتعقيم', section: 'إدارة التدخلات', view: 'interventions', icon: '🧴', color: '#7c3aed' },
  { key: 'complaints', label: 'الشكايات والبلاغات', section: 'الشكايات واليقظة الصحية', view: 'complaints', icon: '📢', color: '#3b82f6' },
  { key: 'quartiers', label: 'الأحياء', section: 'النطاق الترابي', view: 'gis', icon: '🏘️', color: '#64748b' },
  { key: 'establishments', label: 'المنشآت', section: 'الصحة والسلامة الغذائية', view: 'sanitary', icon: '🏪', color: '#10b981' },
  { key: 'inspections', label: 'تفتيش المنشآت', section: 'الصحة والسلامة الغذائية', view: 'sanitary', icon: '🔎', color: '#16a34a' },
  { key: 'healthCards', label: 'البطاقات الصحية', section: 'الصحة والسلامة الغذائية', view: 'sanitary', icon: '🪪', color: '#0f766e' },
  { key: 'samples', label: 'العينات الغذائية', section: 'الصحة والسلامة الغذائية', view: 'sanitary', icon: '🧫', color: '#0891b2' },
  { key: 'waterPoints', label: 'نقاط المياه', section: 'الماء والتطهير', view: 'water', icon: '💧', color: '#06b6d4' },
  { key: 'waterMeasurements', label: 'قياسات المياه', section: 'الماء والتطهير', view: 'water', icon: '🌡️', color: '#0e7490' },
  { key: 'waterSamples', label: 'عينات المياه', section: 'الماء والتطهير', view: 'water', icon: '🧪', color: '#7c3aed' },
  { key: 'waterInspections', label: 'معاينات المياه', section: 'الماء والتطهير', view: 'water', icon: '🔎', color: '#ea580c' },
  { key: 'waterActions', label: 'إجراءات المياه', section: 'الماء والتطهير', view: 'water', icon: '🛠️', color: '#2563eb' },
  { key: 'waterDisinfection', label: 'عمليات تطهير المياه', section: 'الماء والتطهير', view: 'water', icon: '🧴', color: '#059669' },
  { key: 'waterAlerts', label: 'تنبيهات المياه', section: 'الماء والتطهير', view: 'water', icon: '🚨', color: '#be123c' },
  { key: 'sanitationAssets', label: 'أصول الصرف الصحي', section: 'الماء والتطهير', view: 'water', icon: '🏗️', color: '#c2410c' },
  { key: 'waterIncidents', label: 'حوادث المياه والانقطاعات', section: 'الماء والتطهير', view: 'water', icon: '⚠️', color: '#be123c' },
  { key: 'pools', label: 'المسابح ومواقع السباحة', section: 'الماء والتطهير', view: 'water', icon: '🏊', color: '#0284c7' },
  { key: 'sanitation', label: 'حوادث الصرف الصحي', section: 'الماء والتطهير', view: 'water', icon: '🚿', color: '#0891b2' },
  { key: 'pollution', label: 'حوادث التلوث', section: 'حماية البيئة', view: 'environment', icon: '🏭', color: '#ea580c' },
  { key: 'waste', label: 'النفايات والنقط السوداء', section: 'حماية البيئة', view: 'environment', icon: '🗑️', color: '#f59e0b' },
  { key: 'sites', label: 'المواقع الطبيعية', section: 'حماية البيئة', view: 'environment', icon: '🌳', color: '#84cc16' },
  { key: 'environmentalDossiers', label: 'الملفات البيئية', section: 'حماية البيئة', view: 'environment', icon: '🌍', color: '#15803d' },
  { key: 'animals', label: 'بلاغات الحيوانات الشاردة', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🐾', color: '#a855f7' },
  { key: 'captureMissions', label: 'مهام التقاط الحيوانات', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🚐', color: '#9333ea' },
  { key: 'capturedAnimals', label: 'الحيوانات الملتقطة', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🐕‍🦺', color: '#c026d3' },
  { key: 'animalDestinations', label: 'وجهات الحيوانات', section: 'الحيوانات الشاردة', view: 'csvr', icon: '↩️', color: '#0f766e' },
  { key: 'animalHotspots', label: 'النقاط الساخنة للحيوانات', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🔥', color: '#ea580c' },
  { key: 'animalDeaths', label: 'الحيوانات النافقة', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🕊️', color: '#475569' },
  { key: 'animalHealthAlerts', label: 'التنبيهات الصحية للحيوانات', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🩸', color: '#dc2626' },
  { key: 'animalCenters', label: 'مراكز إيواء الحيوانات', section: 'الحيوانات الشاردة', view: 'csvr', icon: '🏠', color: '#7c3aed' },
  { key: 'biteCases', label: 'حالات اللسع والعض', section: 'اليقظة الصحية', view: 'vector', icon: '🐕', color: '#dc2626' },
  { key: 'cemeteries', label: 'المقابر', section: 'تدبير الوفيات والدفن', view: 'funeral', icon: '🪦', color: '#334155' },
  { key: 'burials', label: 'ملفات الدفن', section: 'تدبير الوفيات والدفن', view: 'funeral', icon: '⚰️', color: '#475569' },
  { key: 'exhumations', label: 'ملفات النبش', section: 'تدبير الوفيات والدفن', view: 'funeral', icon: '🧾', color: '#64748b' },
  { key: 'foodReports', label: 'البلاغات الغذائية', section: 'الصحة والسلامة الغذائية', view: 'food', icon: '🥗', color: '#e11d48' },
  { key: 'workOrders', label: 'أوامر العمل', section: 'إدارة العمليات', view: 'workOrders', icon: '🧭', color: '#7c3aed' },
  { key: 'dossiers', label: 'الملفات الموحدة', section: 'إدارة الملفات', view: 'dossiers', icon: '🗂️', color: '#475569' },
]
