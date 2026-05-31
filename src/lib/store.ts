import { create } from 'zustand'

export type ViewType = 'dashboard' | 'map' | 'interventions' | 'reports'
export type InterventionType = 'DERATISATION' | 'DESINSECTISATION' | 'DESINFECTION'
export type StatutType = 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'ANNULEE'
export type CommuneType = 'سلا' | 'سيدي أبي القنادل' | 'عامر'

interface AppState {
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
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (view) => set({ currentView: view }),
  selectedType: 'ALL',
  setSelectedType: (type) => set({ selectedType: type }),
  selectedYear: '2025',
  setSelectedYear: (year) => set({ selectedYear: year }),
  selectedCommune: 'ALL',
  setSelectedCommune: (commune) => set({ selectedCommune: commune }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isFormOpen: false,
  setIsFormOpen: (open) => set({ isFormOpen: open, ...(open ? {} : { editingInterventionId: null }) }),
  editingInterventionId: null,
  setEditingInterventionId: (id) => set({ editingInterventionId: id, isFormOpen: !!id }),
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}))
