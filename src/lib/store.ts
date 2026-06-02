import { create } from 'zustand'

export type ViewType = 'dashboard' | 'map' | 'interventions' | 'inventory' | 'reports' | 'settings'
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

interface AppSettings {
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
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => void
  resetSettings: () => void
  mapClickCoords: MapClickCoords | null
  setMapClickCoords: (coords: MapClickCoords | null) => void
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

const DEFAULT_SETTINGS: AppSettings = {
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
}

export const useAppStore = create<AppState>((set) => ({
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
  settings: DEFAULT_SETTINGS,
  updateSettings: (partial) => set((state) => ({ settings: { ...state.settings, ...partial } })),
  resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
  mapClickCoords: null,
  setMapClickCoords: (coords) => set({ mapClickCoords: coords }),
}))
