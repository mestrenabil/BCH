import { create } from 'zustand'
import { type Language } from './i18n'

export type ViewType = 'dashboard' | 'map' | 'interventions' | 'inventory' | 'reports' | 'documents' | 'users' | 'settings' | 'agents' | 'calendar' | 'kpi' | 'alerts' | 'export' | 'notifications' | 'complaints'
export type InterventionType = 'DERATISATION' | 'DESINSECTISATION' | 'DESINFECTION'
export type StatutType = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'
export type CommuneType = 'سلا' | 'سيدي أبي القنادل' | 'عامر'

export interface AuthUser {
  id: string
  username: string
  nom: string
  commune: string
  role: string
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
}

export interface MapClickCoords {
  latitude: number
  longitude: number
  commune: string | null
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
  selectedType: InterventionType | 'ALL'
  setSelectedType: (type: InterventionType | 'ALL') => void
  selectedYear: string
  setSelectedYear: (year: string) => void
  selectedCommune: CommuneType | 'ALL'
  setSelectedCommune: (commune: CommuneType | 'ALL') => void
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
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  isAuthenticated: false,
  isAuthLoading: true,
  setAuthLoading: (loading) => set({ isAuthLoading: loading }),
  // Navigation
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  selectedType: 'ALL',
  setSelectedType: (type) => set({ selectedType: type }),
  selectedYear: CURRENT_YEAR,
  setSelectedYear: (year) => set({ selectedYear: year }),
  selectedCommune: 'ALL',
  setSelectedCommune: (commune) => set({ selectedCommune: commune }),
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
}
