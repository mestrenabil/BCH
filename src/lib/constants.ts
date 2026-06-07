// ===== SHARED CONSTANTS & TYPES =====

// ===== AUTH CONSTANTS =====
export const COMMUNE_USER_INFO: Record<string, { username: string; password: string; color: string; icon: string }> = {
  'سلا': { username: 'sla', password: 'sla2025', color: '#059669', icon: '🏙️' },
  'سيدي أبي القنادل': { username: 'bouknadel', password: 'bouknadel2025', color: '#7c3aed', icon: '🏘️' },
  'عامر': { username: 'ameur', password: 'ameur2025', color: '#d97706', icon: '🌄' },
}

// ===== TYPE DEFINITIONS =====
export interface InterventionMaterial {
  id: string; interventionId: string; productId: string; quantity: number; createdAt: string
  product: { id: string; nom: string; unite: string; quantiteStock: number }
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
  latitude: number; longitude: number; statut: string; description: string
  agentNom: string; produitUtilise: string; quantite: string; superficie: string
  nombrePrestations: number; observations: string; reference: string
  commune: string; createdAt: string; updatedAt: string
  heureDebut?: string | null; heureFin?: string | null
  coutMainOeuvre?: number | null; coutMateriaux?: number | null; coutTotal?: number | null
  materials?: InterventionMaterial[]
  documents?: InterventionDocument[]
}

export interface CommuneBreakdown {
  total: number
  DERATISATION: number
  DESINSECTISATION: number
  DESINFECTION: number
}

export interface Statistics {
  total: number; byType: Record<string, number>; byStatut: Record<string, number>
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
  DERATISATION: 'مكافحة القوارض', DESINSECTISATION: 'مكافحة الحشرات', DESINFECTION: 'التطهير والتعقيم',
}
export const STATUT_LABELS: Record<string, string> = {
  PLANIFIEE: 'مبرمجة', EN_COURS: 'جارية', TERMINEE: 'منجزة', ANNULEE: 'ملغاة',
}
export const TYPE_COLORS: Record<string, string> = {
  DERATISATION: '#ef4444', DESINSECTISATION: '#f59e0b', DESINFECTION: '#10b981',
}
export const STATUT_COLORS: Record<string, string> = {
  PLANIFIEE: '#3b82f6', EN_COURS: '#f59e0b', TERMINEE: '#10b981', ANNULEE: '#6b7280',
}
export const COMMUNE_LABELS: Record<string, string> = {
  'سلا': 'جماعة سلا',
  'سيدي أبي القنادل': 'جماعة سيدي أبي القنادل',
  'عامر': 'جماعة عامر',
}
export const COMMUNE_COLORS: Record<string, string> = {
  'سلا': '#059669',
  'سيدي أبي القنادل': '#7c3aed',
  'عامر': '#d97706',
}
export const TYPE_ICONS: Record<string, string> = {
  DERATISATION: '🐀', DESINSECTISATION: '🦟', DESINFECTION: '🧴',
}
export const MONTH_NAMES_AR = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
  'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر',
]

export const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

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
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.2 } },
}

export const cardVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
  hover: { scale: 1.02, transition: { duration: 0.2 } },
}
