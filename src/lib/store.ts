import { create } from 'zustand'
import { DEFAULT_TERRITORY_FILTER, type TerritoryFilter } from '@/lib/geography'
import { type Language } from './i18n'

export type ViewType = 'dashboard' | 'map' | 'interventions' | 'inventory' | 'reports' | 'documents' | 'users' | 'settings' | 'agents' | 'calendar' | 'kpi' | 'alerts' | 'export' | 'notifications' | 'complaints' | 'workOrders' | 'operations' | 'activityLog' | 'timeline' | 'campagnes' | 'helpCenter' | 'csvr' | 'food' | 'dossiers' | 'sanitary' | 'water' | 'vector' | 'funeral' | 'environment' | 'vigilance' | 'authorizations' | 'gis' | 'geohealth' | 'reportsOffice' | 'calendarUnified'

export const DEFAULT_NAV_ORDER: ViewType[] = [
  'dashboard', 'map', 'interventions', 'agents', 'inventory', 'documents', 'calendar', 'complaints', 'workOrders', 'campagnes',
  'csvr', 'food', 'dossiers', 'sanitary', 'water', 'vector', 'funeral', 'environment', 'vigilance', 'authorizations', 'gis', 'geohealth',
  'reportsOffice', 'calendarUnified', 'reports', 'operations', 'kpi', 'alerts', 'export', 'notifications', 'activityLog', 'timeline',
  'users', 'settings', 'helpCenter',
]

export type CsvrSubTab = 'dashboard' | 'alerts' | 'reports' | 'map' | 'missions' | 'animals' | 'care' | 'centers' | 'transport' | 'adoption' | 'health' | 'bites' | 'deaths' | 'hotspots' | 'partners' | 'identification' | 'photos' | 'campaigns' | 'followup' | 'exports' | 'settings'
export type FoodSubTab = 'dashboard' | 'list' | 'map'
export type DossierSubTab = 'list' | 'detail'
export type SanitarySubTab = 'dashboard' | 'map' | 'establishments' | 'inspections' | 'healthCards' | 'samples' | 'settings'
export type WaterSubTab = 'dashboard' | 'map' | 'points' | 'measurements' | 'samples' | 'inspections' | 'thresholds' | 'devices' | 'alerts' | 'reports' | 'actions' | 'pools' | 'sanitation' | 'disinfection' | 'assets' | 'emergency' | 'incidents' | 'laboratories' | 'programs' | 'planning' | 'settings'
export type VectorSubTab = 'dashboard' | 'products' | 'bites'
export type FuneralSubTab = 'dashboard' | 'deaths' | 'burials' | 'cemeteries' | 'transports' | 'exhumations'
export type EnvironmentSubTab = 'dashboard' | 'map' | 'dossiers' | 'detail' | 'inspections' | 'programs' | 'followup' | 'complaints' | 'establishments' | 'pollution' | 'water' | 'waste' | 'sites' | 'vigilance' | 'campaigns' | 'settings'
export type GisLayerFocus = string | null
export type VigilanceSubTab = 'dashboard' | 'all' | 'byCategory'
export type AuthSubTab = 'dashboard' | 'dossiers' | 'opinions' | 'visits'
export type InterventionType = 'DERATISATION' | 'DESINSECTISATION' | 'DESINFECTION'
export type StatutType = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'
export type CommuneType = string

export interface AuthUser {
  id: string
  username: string
  nom: string
  commune: string
  managedCommunes: string[]
  communeGroupName: string | null
  navVisibilityJson: string
  role: string
  agentId: string | null
}

export type OverlaySectionKey =
  | 'location' | 'details' | 'timeDetails' | 'costs' | 'product'
  | 'materials' | 'description' | 'observations' | 'documents' | 'photos'
  | 'coordinates' | 'systemInfo' | 'quickActions' | 'progressIndicator' | 'comments'

export const OVERLAY_SECTION_LABELS: Record<OverlaySectionKey, { ar: string; icon: string; defaultVisible: boolean }> = {
  location: { ar: 'الموقع', icon: '📍', defaultVisible: true },
  details: { ar: 'التفاصيل', icon: '📋', defaultVisible: true },
  timeDetails: { ar: 'أوقات التدخل', icon: '⏰', defaultVisible: true },
  costs: { ar: 'التكاليف', icon: '💰', defaultVisible: true },
  product: { ar: 'المنتج المستعمل', icon: '💊', defaultVisible: true },
  materials: { ar: 'المنتجات المستعملة', icon: '🧪', defaultVisible: true },
  description: { ar: 'الوصف', icon: '📝', defaultVisible: true },
  observations: { ar: 'الملاحظات', icon: '💬', defaultVisible: true },
  documents: { ar: 'الوثائق', icon: '📄', defaultVisible: true },
  photos: { ar: 'الصور', icon: '📸', defaultVisible: true },
  coordinates: { ar: 'الإحداثيات الجغرافية', icon: '🌍', defaultVisible: false },
  systemInfo: { ar: 'معلومات النظام', icon: '⚙️', defaultVisible: false },
  quickActions: { ar: 'إجراءات سريعة', icon: '⚡', defaultVisible: false },
  progressIndicator: { ar: 'مؤشر التقدم', icon: '📊', defaultVisible: false },
  comments: { ar: 'التعليقات', icon: '💬', defaultVisible: true },
}

export interface AppSettings {
  animationsEnabled: boolean
  mapClickEnabled: boolean
  showCommunePopups: boolean
  mapDefaultTile: 'light' | 'satellite'
  mapClusterRadius: number
  defaultCommune: CommuneType | 'ALL'
  defaultYear: string
  interventionsPerPage: number
  stockAlertEnabled: boolean
  stockAlertThreshold: number
  deadlineReminderEnabled: boolean
  deadlineReminderDays: number
  fontSize: 'small' | 'medium' | 'large'
  compactMode: boolean
  navVisibility: Record<ViewType, boolean>
  navOrder: ViewType[]
  // Overlay section visibility
  overlaySectionVisibility: Record<OverlaySectionKey, boolean>
  // Print / Document settings
  presidentName: string
  responsableName: string
  chefServiceName: string
  communeNameFr: string
  communeNameAr: string
  communeAddress: string
  communePhone: string
  communeFax: string
  communeEmail: string
  communeLogo: string
  showWatermark: boolean
  watermarkText: string
  documentFooter: string
  // Favorites
  favoriteInterventions: string[] // array of intervention IDs
  // Quick stats widget
  showQuickStats: boolean
  // Notification sounds
  notificationSoundsEnabled: boolean
  // Recurrence
  recurrenceEnabled: boolean
  // PWA
  pwaInstallDismissed: boolean
  // Map
  mapShowHeatmap: boolean
  mapShowDrawing: boolean
}

export interface MapClickCoords {
  latitude: number
  longitude: number
  commune: string | null
  quartier: string | null
}

interface AppState {
  // Auth
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  isAuthenticated: boolean
  isAuthLoading: boolean
  setAuthLoading: (loading: boolean) => void
  // Navigation
  currentView: ViewType
  setCurrentView: (view: ViewType) => void
  csvrSubTab: CsvrSubTab
  setCsvrSubTab: (tab: CsvrSubTab) => void
  foodSubTab: FoodSubTab
  setFoodSubTab: (tab: FoodSubTab) => void
  dossierSubTab: DossierSubTab
  setDossierSubTab: (tab: DossierSubTab) => void
  sanitarySubTab: SanitarySubTab
  setSanitarySubTab: (tab: SanitarySubTab) => void
  waterSubTab: WaterSubTab
  setWaterSubTab: (tab: WaterSubTab) => void
  vectorSubTab: VectorSubTab
  setVectorSubTab: (tab: VectorSubTab) => void
  funeralSubTab: FuneralSubTab
  setFuneralSubTab: (tab: FuneralSubTab) => void
  environmentSubTab: EnvironmentSubTab
  setEnvironmentSubTab: (tab: EnvironmentSubTab) => void
  gisFocusLayer: GisLayerFocus
  setGisFocusLayer: (layer: GisLayerFocus) => void
  vigilanceSubTab: VigilanceSubTab
  setVigilanceSubTab: (tab: VigilanceSubTab) => void
  authSubTab: AuthSubTab
  setAuthSubTab: (tab: AuthSubTab) => void
  selectedType: InterventionType | 'ALL'
  setSelectedType: (type: InterventionType | 'ALL') => void
  selectedYear: string
  setSelectedYear: (year: string) => void
  selectedCommune: CommuneType | 'ALL'
  setSelectedCommune: (commune: CommuneType | 'ALL') => void
  territoryFilter: TerritoryFilter
  setTerritoryFilter: (filter: TerritoryFilter) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  isFormOpen: boolean
  setIsFormOpen: (open: boolean) => void
  editingInterventionId: string | null
  setEditingInterventionId: (id: string | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  // Theme
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  // Settings — per-commune, loaded from DB
  settings: AppSettings
  settingsLoaded: boolean
  settingsCommune: string // which commune's settings are currently loaded
  updateSettings: (partial: Partial<AppSettings>) => void
  loadSettings: (commune?: string) => Promise<AppSettings | null>
  saveSettings: () => Promise<boolean>
  resetSettings: () => Promise<boolean>
  setSettings: (settings: AppSettings, commune: string) => void
  // Notification sound
  notifSound: boolean
  setNotifSound: (v: boolean) => void
  // Map
  mapClickCoords: MapClickCoords | null
  setMapClickCoords: (coords: MapClickCoords | null) => void
  // Language
  language: Language
  setLanguage: (lang: Language) => void
  // Favorites
  favorites: string[]
  toggleFavorite: (id: string) => void
  isFavorite: (id: string) => boolean
  // Bulk selection
  selectedInterventions: string[]
  setSelectedInterventions: (ids: string[]) => void
  toggleInterventionSelection: (id: string) => void
  clearSelection: () => void
  // Comparison
  comparisonIds: string[]
  setComparisonIds: (ids: string[]) => void
  // Quick stats
  showQuickStatsWidget: boolean
  setShowQuickStatsWidget: (show: boolean) => void
}

export const CURRENT_YEAR = new Date().getFullYear().toString()
export const CURRENT_YEAR_NUM = new Date().getFullYear()

/** Generate year options from current year back to N years */
export function getYearOptions(yearsBack: number = 10): { value: string; label: string }[] {
  const current = new Date().getFullYear()
  const options: { value: string; label: string }[] = []
  for (let y = current; y >= current - yearsBack; y--) {
    options.push({ value: y.toString(), label: y.toString() })
  }
  return options
}

export const DEFAULT_SETTINGS: AppSettings = {
  animationsEnabled: true,
  mapClickEnabled: true,
  showCommunePopups: false,
  mapDefaultTile: 'light',
  mapClusterRadius: 50,
  defaultCommune: 'ALL',
  defaultYear: CURRENT_YEAR,
  interventionsPerPage: 50,
  stockAlertEnabled: true,
  stockAlertThreshold: 10,
  deadlineReminderEnabled: true,
  deadlineReminderDays: 3,
  fontSize: 'medium',
  compactMode: false,
  navVisibility: Object.fromEntries(DEFAULT_NAV_ORDER.map((view) => [view, true])) as Record<ViewType, boolean>,
  navOrder: [...DEFAULT_NAV_ORDER],
  // Overlay section visibility — defaults from OVERLAY_SECTION_LABELS
  overlaySectionVisibility: Object.fromEntries(
    Object.entries(OVERLAY_SECTION_LABELS).map(([key, val]) => [key, val.defaultVisible])
  ) as Record<OverlaySectionKey, boolean>,
  // Print / Document settings
  presidentName: '',
  responsableName: '',
  chefServiceName: '',
  communeNameFr: '',
  communeNameAr: '',
  communeAddress: '',
  communePhone: '',
  communeFax: '',
  communeEmail: '',
  communeLogo: '',
  showWatermark: false,
  watermarkText: 'BCH',
  documentFooter: '',
  favoriteInterventions: [],
  showQuickStats: true,
  notificationSoundsEnabled: true,
  recurrenceEnabled: true,
  pwaInstallDismissed: false,
  mapShowHeatmap: false,
  mapShowDrawing: false,
}

export const useAppStore = create<AppState>((set, get) => {
  // Initialize theme from localStorage
  let initialTheme: 'light' | 'dark' = 'light'
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('app-theme')
    if (saved === 'dark' || saved === 'light') initialTheme = saved
  }

  return {
  // Auth
  user: null,
  setUser: (user) => {
    const normalizedUser = user
      ? {
          ...user,
          managedCommunes: Array.isArray(user.managedCommunes) ? user.managedCommunes : [],
          communeGroupName: user.communeGroupName ?? null,
        }
      : null

    set({
      user: normalizedUser,
      isAuthenticated: !!normalizedUser,
      selectedCommune: normalizedUser?.managedCommunes.length && normalizedUser.managedCommunes.length > 1
        ? 'ALL'
        : (normalizedUser?.commune && normalizedUser.commune !== 'ALL' ? normalizedUser.commune as CommuneType : 'ALL'),
      territoryFilter: DEFAULT_TERRITORY_FILTER,
    })
  },
  isAuthenticated: false,
  isAuthLoading: true,
  setAuthLoading: (loading) => set({ isAuthLoading: loading }),
  // Navigation
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  csvrSubTab: 'dashboard',
  setCsvrSubTab: (tab) => set({ csvrSubTab: tab }),
  foodSubTab: 'dashboard',
  setFoodSubTab: (tab) => set({ foodSubTab: tab }),
  dossierSubTab: 'list',
  setDossierSubTab: (tab) => set({ dossierSubTab: tab }),
  sanitarySubTab: 'dashboard',
  setSanitarySubTab: (tab) => set({ sanitarySubTab: tab }),
  waterSubTab: 'dashboard',
  setWaterSubTab: (tab) => set({ waterSubTab: tab }),
  vectorSubTab: 'dashboard',
  setVectorSubTab: (tab) => set({ vectorSubTab: tab }),
  funeralSubTab: 'dashboard',
  setFuneralSubTab: (tab) => set({ funeralSubTab: tab }),
  environmentSubTab: 'dashboard',
  setEnvironmentSubTab: (tab) => set({ environmentSubTab: tab }),
  gisFocusLayer: null,
  setGisFocusLayer: (layer) => set({ gisFocusLayer: layer }),
  vigilanceSubTab: 'dashboard',
  setVigilanceSubTab: (tab) => set({ vigilanceSubTab: tab }),
  authSubTab: 'dashboard',
  setAuthSubTab: (tab) => set({ authSubTab: tab }),
  selectedType: 'ALL',
  setSelectedType: (type) => set({ selectedType: type }),
  selectedYear: CURRENT_YEAR,
  setSelectedYear: (year) => set({ selectedYear: year }),
  selectedCommune: 'ALL',
  setSelectedCommune: (commune) => set({ selectedCommune: commune }),
  territoryFilter: DEFAULT_TERRITORY_FILTER,
  setTerritoryFilter: (territoryFilter) => set({ territoryFilter }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isFormOpen: false,
  setIsFormOpen: (open) => set({ isFormOpen: open, ...(open ? {} : { editingInterventionId: null, mapClickCoords: null }) }),
  editingInterventionId: null,
  setEditingInterventionId: (id) => set({ editingInterventionId: id, isFormOpen: !!id }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  // Theme
  theme: initialTheme,
  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-theme', theme)
      if (theme === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
    set({ theme })
  },
  // Settings
  settings: { ...DEFAULT_SETTINGS },
  settingsLoaded: false,
  settingsCommune: '',
  setSettings: (settings, commune) => set({ settings, settingsCommune: commune, settingsLoaded: true }),
  updateSettings: (partial) => {
    set((state) => ({ settings: { ...state.settings, ...partial } }))
    // Auto-save to backend after a brief delay (debounced in practice by the component)
  },
  loadSettings: async (commune?: string) => {
    try {
      const params = new URLSearchParams()
      if (commune) params.set('commune', commune)
      const res = await fetch(`/api/settings?${params.toString()}`)
      if (!res.ok) return null
      const data = await res.json()
      const loadedSettings = { ...DEFAULT_SETTINGS, ...data.settings } as AppSettings
      set({ settings: loadedSettings, settingsCommune: data.commune, settingsLoaded: true })
      return loadedSettings
    } catch {
      return null
    }
  },
  saveSettings: async () => {
    const { settings, settingsCommune, user } = get()
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commune: settingsCommune || user?.commune,
          settings,
        }),
      })
      if (!res.ok) return false
      const data = await res.json()
      set({ settings: { ...DEFAULT_SETTINGS, ...data.settings }, settingsCommune: data.commune })
      return true
    } catch {
      return false
    }
  },
  resetSettings: async () => {
    const { settingsCommune, user } = get()
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commune: settingsCommune || user?.commune }),
      })
      if (!res.ok) return false
      const data = await res.json()
      set({ settings: { ...DEFAULT_SETTINGS, ...data.settings }, settingsCommune: data.commune })
      return true
    } catch {
      return false
    }
  },
  // Notification sound — persisted in localStorage
  notifSound: true,
  setNotifSound: (v) => {
    set({ notifSound: v })
    try { localStorage.setItem('notif-sound', String(v)) } catch { /* ignore */ }
  },
  // Map
  mapClickCoords: null,
  setMapClickCoords: (coords) => set({ mapClickCoords: coords }),
  // Language — persisted in localStorage
  language: 'ar' as Language,
  setLanguage: (lang) => {
    set({ language: lang })
    try { localStorage.setItem('app-language', lang) } catch { /* ignore */ }
  },
  // Favorites — persisted in localStorage
  favorites: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('favorite-interventions') || '[]') : [],
  toggleFavorite: (id) => set((state) => {
    const current = state.favorites
    const updated = current.includes(id) ? current.filter(f => f !== id) : [...current, id]
    try { localStorage.setItem('favorite-interventions', JSON.stringify(updated)) } catch { /* ignore */ }
    return { favorites: updated }
  }),
  isFavorite: (id) => get().favorites.includes(id),
  // Bulk selection
  selectedInterventions: [],
  setSelectedInterventions: (ids) => set({ selectedInterventions: ids }),
  toggleInterventionSelection: (id) => set((state) => {
    const current = state.selectedInterventions
    const updated = current.includes(id) ? current.filter(f => f !== id) : [...current, id]
    return { selectedInterventions: updated }
  }),
  clearSelection: () => set({ selectedInterventions: [] }),
  // Comparison
  comparisonIds: [],
  setComparisonIds: (ids) => set({ comparisonIds: ids }),
  // Quick stats
  showQuickStatsWidget: true,
  setShowQuickStatsWidget: (show) => set({ showQuickStatsWidget: show }),
}})

// Hydrate persisted values from localStorage on client
if (typeof window !== 'undefined') {
  try {
    const ns = localStorage.getItem('notif-sound')
    if (ns !== null) useAppStore.setState({ notifSound: ns === 'true' })
  } catch { /* ignore */ }
  try {
    const lang = localStorage.getItem('app-language')
    if (lang === 'fr' || lang === 'ar') useAppStore.setState({ language: lang as Language })
  } catch { /* ignore */ }
  try {
    const favs = localStorage.getItem('favorite-interventions')
    if (favs) useAppStore.setState({ favorites: JSON.parse(favs) })
  } catch { /* ignore */ }
}
