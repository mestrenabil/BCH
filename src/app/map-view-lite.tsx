'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore, type CommuneType } from '@/lib/store'
import {
  type Intervention, type Quartier,
  TYPE_LABELS, TYPE_COLORS, TYPE_ICONS, STATUT_LABELS, STATUT_COLORS,
  COMMUNE_LABELS, COMMUNE_COLORS,
} from '@/lib/constants'

const COMMUNE_INFO: { name: string; key: string; color: string; population: string; populationMunicipale: string; populationCompteeAPart: string; menages: string; isBouknadel: boolean }[] = [
  { name: 'جماعة سلا', key: 'سلا', color: '#059669', population: '945,101', populationMunicipale: '938,475', populationCompteeAPart: '6,626', menages: '256,144', isBouknadel: false },
  { name: 'جماعة سيدي أبي القنادل', key: 'سيدي أبي القنادل', color: '#7c3aed', population: '43,598', populationMunicipale: '43,550', populationCompteeAPart: '48', menages: '10,439', isBouknadel: true },
  { name: 'جماعة عامر', key: 'عامر', color: '#d97706', population: '75,942', populationMunicipale: '75,896', populationCompteeAPart: '46', menages: '18,540', isBouknadel: false },
]

interface MapComponentProps {
  interventions: Intervention[]
  quartiers: Quartier[]
  selectedCommune: string
  onMapClick?: (lat: number, lng: number, commune: string | null) => void
  mapClickEnabled?: boolean
  showCommunePopups?: boolean
  onInterventionCreated?: () => void
  centerOn?: { lat: number; lng: number } | null
  onInterventionClick?: (intervention: Intervention, lat: number, lng: number) => void
  tileLayer?: 'street' | 'satellite' | 'dark'
}

function MapView({ interventions, quartiers, selectedCommune, canSeeAllCommunes, onMapClick, onRefresh, onNavigateToInterventions }: { interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean; onMapClick: (lat: number, lng: number, commune: string | null) => void; onRefresh?: () => void; onNavigateToInterventions?: () => void }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [MapComponent, setMapComponent] = useState<React.ComponentType<MapComponentProps> | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hoveredCommune, setHoveredCommune] = useState<string | null>(null)
  const { setSelectedCommune, settings } = useAppStore()

  const [mapError, setMapError] = useState(false)
  const [mapLoadAttempt, setMapLoadAttempt] = useState(0)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Quartier[]>([])
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [centerOnCoords, setCenterOnCoords] = useState<{ lat: number; lng: number } | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchDropdownRef = useRef<HTMLDivElement>(null)

  // === NEW FEATURES STATE ===
  // Floating overlay
  const [overlayIntervention, setOverlayIntervention] = useState<Intervention | null>(null)
  const [overlayPosition, setOverlayPosition] = useState({ x: 100, y: 100 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  // Fullscreen
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Map stats bar
  const [showMapStats, setShowMapStats] = useState(true)

  // Tile layer
  const [tileLayer, setTileLayer] = useState<'street' | 'satellite' | 'dark'>('street')

  // Debounce search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Filter search results when debounced search changes
  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults([])
      setShowSearchDropdown(false)
      return
    }
    const q = debouncedSearch.trim().toLowerCase()
    const filtered = quartiers.filter(qt =>
      qt.nom.toLowerCase().includes(q) ||
      qt.commune.toLowerCase().includes(q)
    )
    setSearchResults(filtered.slice(0, 10))
    setShowSearchDropdown(filtered.length > 0)
  }, [debouncedSearch, quartiers])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node) &&
          searchInputRef.current && !searchInputRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle search result selection
  const handleSearchSelect = useCallback((quartier: Quartier) => {
    setShowSearchDropdown(false)
    setSearchQuery(quartier.nom)
    setCenterOnCoords({ lat: quartier.latitude, lng: quartier.longitude })
  }, [])

  // Clear search
  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setDebouncedSearch('')
    setSearchResults([])
    setShowSearchDropdown(false)
    setCenterOnCoords(null)
  }, [])

  // Filter interventions by search
  const filteredInterventions = React.useMemo(() => {
    if (!debouncedSearch.trim()) return interventions
    const q = debouncedSearch.trim().toLowerCase()
    return interventions.filter(inv =>
      inv.quartier.toLowerCase().includes(q) ||
      inv.adresse.toLowerCase().includes(q)
    )
  }, [interventions, debouncedSearch])

  useEffect(() => {
    setMapError(false)
    import('./map-component').then((mod) => {
      setMapComponent(() => mod.default as unknown as React.ComponentType<MapComponentProps>)
      setMapLoaded(true)
    }).catch(() => {
      setMapError(true)
    })
  }, [mapLoadAttempt])

  const totalPopulation = COMMUNE_INFO.reduce((sum, c) => sum + parseInt(c.population.replace(/,/g, '')), 0)
  const activeCommune = COMMUNE_INFO.find(c => c.key === selectedCommune)

  // Intervention counts by type for current filter
  const typeCounts = Object.entries(TYPE_LABELS).map(([key, label]) => ({
    key, label, color: TYPE_COLORS[key], icon: TYPE_ICONS[key],
    count: filteredInterventions.filter(i => i.type === key).length,
  }))

  // Status counts
  const statusCounts = Object.entries(STATUT_LABELS).map(([key, label]) => ({
    key, label, color: STATUT_COLORS[key],
    count: filteredInterventions.filter(i => i.statut === key).length,
  }))

  // Filtered quartiers for sidebar list
  const filteredQuartiersForSidebar = React.useMemo(() => {
    if (!debouncedSearch.trim()) return quartiers
    const q = debouncedSearch.trim().toLowerCase()
    return quartiers.filter(qt =>
      qt.nom.toLowerCase().includes(q) ||
      qt.commune.toLowerCase().includes(q)
    )
  }, [quartiers, debouncedSearch])

  // === HANDLERS FOR NEW FEATURES ===

  // Intervention click → show floating overlay
  const handleInterventionClick = useCallback((intervention: Intervention, lat: number, lng: number) => {
    setOverlayIntervention(intervention)
    // Position the overlay near center of the map area
    const mapEl = document.getElementById('map-area-container')
    if (mapEl) {
      const rect = mapEl.getBoundingClientRect()
      // Try to compute pixel position from lat/lng via map container
      // Default to a nice position
      const x = Math.min(Math.max(rect.width * 0.1, 20), rect.width - 380)
      const y = Math.min(Math.max(rect.height * 0.15, 20), rect.height - 350)
      setOverlayPosition({ x, y })
    }
  }, [])

  // Draggable overlay handlers — coordinates are relative to #map-area-container
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    // Convert viewport position to container-relative position, then compute offset from current overlay position
    const mapEl = document.getElementById('map-area-container')
    const rect = mapEl?.getBoundingClientRect()
    const relX = rect ? clientX - rect.left : clientX
    const relY = rect ? clientY - rect.top : clientY
    dragOffsetRef.current = {
      x: relX - overlayPosition.x,
      y: relY - overlayPosition.y,
    }
  }, [overlayPosition])

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Global mouse/touch move and up handlers for dragging
  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
      const mapEl = document.getElementById('map-area-container')
      const rect = mapEl?.getBoundingClientRect()
      const relX = rect ? clientX - rect.left : clientX
      const relY = rect ? clientY - rect.top : clientY
      setOverlayPosition({
        x: relX - dragOffsetRef.current.x,
        y: relY - dragOffsetRef.current.y,
      })
    }
    const handleUp = () => { setIsDragging(false) }
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDragging])

  // Compute completion rate for stats bar
  const completionRate = filteredInterventions.length > 0
    ? Math.round((filteredInterventions.filter(i => i.statut === 'TERMINEE').length / filteredInterventions.length) * 100)
    : 0

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] pb-16 lg:pb-0 relative flex">
      {/* Professional Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: isFullscreen ? 0 : 1, x: isFullscreen ? 40 : 0, width: sidebarCollapsed ? 56 : 340 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute top-0 right-0 bottom-0 z-20 flex flex-col bg-white/95 backdrop-blur-xl border-l border-slate-200/60 shadow-2xl overflow-hidden"
        style={{ pointerEvents: isFullscreen ? 'none' : 'auto' }}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="absolute top-3 left-3 z-30 w-8 h-8 bg-white rounded-lg shadow-md border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition-colors"
        >
          <motion.svg
            animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
            xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor"
          >
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </motion.svg>
        </button>

        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-l from-emerald-800 via-teal-700 to-emerald-900 text-white p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-lg">🗺️</div>
                <div>
                  <h3 className="font-bold text-sm">الخريطة التفاعلية — SIG</h3>
                  <p className="text-[10px] text-emerald-200/80">نظام المعلومات الجغرافية</p>
                </div>
              </div>
              <div className="bg-white/10 rounded-lg px-3 py-2 text-[10px] text-emerald-100/80 space-y-0.5">
                <div>🗺️ حدود سلا — قرار رقم 1954.24 (الجريدة الرسمية عدد 7340)</div>
                <div>👥 السكان — HCP إحصاء 2024</div>
              </div>
            </div>

            {/* Search Input */}
            <div className="p-3 pb-2 relative">
              <div className="relative">
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => { if (searchResults.length > 0) setShowSearchDropdown(true) }}
                  placeholder="ابحث عن حي أو عنوان..."
                  className="w-full pr-9 pl-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200 transition-all"
                  dir="rtl"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>
              {/* Search Results Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div
                  ref={searchDropdownRef}
                  className="absolute left-3 right-3 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-50 max-h-60 overflow-y-auto"
                >
                  <div className="p-2">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1.5 px-2">
                      نتائج البحث ({searchResults.length})
                    </p>
                    {searchResults.map((qt) => (
                      <button
                        key={qt.id}
                        onClick={() => handleSearchSelect(qt)}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-emerald-50 transition-colors text-right"
                      >
                        <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center text-xs flex-shrink-0">
                          📍
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-700 truncate">{qt.nom}</p>
                          <p className="text-[10px] text-slate-400">{qt.commune}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 p-3">
              <div className="bg-emerald-50 rounded-xl p-2 text-center border border-emerald-100">
                <div className="text-lg font-bold text-emerald-700">{filteredInterventions.length}</div>
                <div className="text-[9px] text-emerald-600 font-semibold">التدخلات</div>
              </div>
              <div className="bg-violet-50 rounded-xl p-2 text-center border border-violet-100">
                <div className="text-lg font-bold text-violet-700">{quartiers.length}</div>
                <div className="text-[9px] text-violet-600 font-semibold">الأحياء</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-2 text-center border border-amber-100">
                <div className="text-lg font-bold text-amber-700">{COMMUNE_INFO.length}</div>
                <div className="text-[9px] text-amber-600 font-semibold">الجماعات</div>
              </div>
            </div>

            {/* Commune Filter */}
            <div className="px-3 pb-2">
              {canSeeAllCommunes ? (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">🏛️ فلترة الجماعات</p>
                    <span className="text-[9px] text-slate-400">👥 {totalPopulation.toLocaleString('ar-MA')}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSelectedCommune('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${selectedCommune === 'ALL' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}>
                      الكل
                    </button>
                    {COMMUNE_INFO.map((info) => (
                      <button key={info.key}
                        onClick={() => setSelectedCommune(selectedCommune === info.key ? 'ALL' : info.key as CommuneType)}
                        onMouseEnter={() => setHoveredCommune(info.key)}
                        onMouseLeave={() => setHoveredCommune(null)}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                          selectedCommune === info.key ? 'text-white shadow-md' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                        style={selectedCommune === info.key ? { backgroundColor: info.color } : {}}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selectedCommune === info.key ? 'white' : info.color }} />
                        {info.name.replace('جماعة ', '')}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">🏛️ جماعتك</p>
                  {activeCommune && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-white font-bold text-sm"
                      style={{ backgroundColor: activeCommune.color }}>
                      <div className="w-2 h-2 rounded-full bg-white" />
                      {activeCommune.name}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Active Commune Detail */}
            {activeCommune && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="px-3 pb-2"
              >
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: activeCommune.color + '40' }}>
                  <div className="px-3 py-2.5 text-white" style={{ background: `linear-gradient(135deg, ${activeCommune.color}, ${activeCommune.color}dd)` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-white/20 flex items-center justify-center text-xs">🏛️</div>
                        <span className="font-bold text-sm">{activeCommune.name}</span>
                      </div>
                      {activeCommune.isBouknadel && (
                        <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px] font-bold">مقر المكتب</span>
                      )}
                    </div>
                  </div>
                  <div className="p-3 bg-white space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="text-sm font-bold" style={{ color: activeCommune.color }}>{activeCommune.population}</div>
                        <div className="text-[9px] text-slate-500">السكان القانونيون</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-2 text-center">
                        <div className="text-sm font-bold" style={{ color: activeCommune.color }}>{activeCommune.menages}</div>
                        <div className="text-[9px] text-slate-500">الأسر</div>
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-slate-500">
                      <span>المغاربة: <strong className="text-slate-700">{activeCommune.populationMunicipale}</strong></span>
                      <span>🌍 الأجانب: <strong className="text-slate-700">{activeCommune.populationCompteeAPart}</strong></span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Commune Boundaries List */}
            <div className="px-3 pb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">الحدود الترابية • السكان القانونيون 2024</p>
              <div className="space-y-1.5">
                {COMMUNE_INFO.filter(info => canSeeAllCommunes || info.key === selectedCommune).map((info) => (
                  <motion.div
                    key={info.name}
                    onMouseEnter={() => setHoveredCommune(info.key)}
                    onMouseLeave={() => setHoveredCommune(null)}
                    onClick={() => canSeeAllCommunes ? setSelectedCommune(selectedCommune === info.key ? 'ALL' : info.key as CommuneType) : undefined}
                    className={`flex items-center gap-2.5 p-2 rounded-lg transition-all ${
                      canSeeAllCommunes ? 'cursor-pointer' : ''
                    } ${
                      selectedCommune !== 'ALL' && selectedCommune !== info.key ? 'opacity-40' : 'hover:bg-slate-50'
                    } ${hoveredCommune === info.key ? 'bg-slate-50 ring-1 ring-slate-200' : ''}`}
                  >
                    <div className="w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: info.color, backgroundColor: info.color + '20' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-700 font-semibold truncate">{info.name}</span>
                        {info.isBouknadel && <span className="text-[8px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold flex-shrink-0">مقر المكتب</span>}
                      </div>
                      <div className="text-[10px] text-slate-400">👥 {info.population} نسمة</div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 flex-shrink-0">
                      {filteredInterventions.length > 0 && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {filteredInterventions.filter(i => i.commune === info.key).length}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Quartiers List (filtered by search) */}
            {filteredQuartiersForSidebar.length > 0 && (
              <div className="px-3 pb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                  📍 الأحياء {debouncedSearch ? `(${filteredQuartiersForSidebar.length})` : ''}
                </p>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {filteredQuartiersForSidebar.slice(0, 20).map((qt) => {
                    const qtInvs = filteredInterventions.filter(i => i.quartier === qt.nom)
                    return (
                      <button
                        key={qt.id}
                        onClick={() => handleSearchSelect(qt)}
                        className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-emerald-50/50 transition-colors text-right"
                      >
                        <div className="w-4 h-4 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                        </div>
                        <span className="text-[11px] text-slate-600 truncate flex-1">{qt.nom}</span>
                        {qtInvs.length > 0 && (
                          <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded-md font-bold text-slate-500 flex-shrink-0">{qtInvs.length}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Intervention Types */}
            <div className="px-3 pb-2">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">أنواع التدخلات</p>
                <div className="space-y-2">
                  {typeCounts.map((t) => (
                    <div key={t.key} className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: t.color + '15' }}>
                        {t.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-xs text-slate-600 font-medium">{t.label}</div>
                        <div className="w-full bg-slate-200 rounded-full h-1 mt-0.5">
                          <div className="h-full rounded-full transition-all duration-500" style={{
                            width: `${filteredInterventions.length > 0 ? (t.count / filteredInterventions.length * 100) : 0}%`,
                            backgroundColor: t.color,
                          }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 min-w-[1.5rem] text-center">{t.count}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 mt-2 pt-2 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-semibold">المجموع</span>
                  <span className="text-sm font-bold text-emerald-600">{filteredInterventions.length}</span>
                </div>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="px-3 pb-3">
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">حالات التدخلات</p>
                <div className="flex gap-1.5">
                  {statusCounts.map((s) => (
                    <div key={s.key} className="flex-1 rounded-lg p-1.5 text-center" style={{ backgroundColor: s.color + '12' }}>
                      <div className="text-xs font-bold" style={{ color: s.color }}>{s.count}</div>
                      <div className="text-[8px] text-slate-500 font-medium">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Map Container */}
      <div id="map-area-container" className="flex-1 relative">
        {mapError ? (
          <div className="h-full flex items-center justify-center bg-slate-50" dir="rtl">
            <div className="text-center space-y-4 max-w-md mx-auto px-4">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-4xl mx-auto">
                ⚠️
              </div>
              <h3 className="text-xl font-bold text-slate-800">حدث خطأ في تحميل الخريطة</h3>
              <p className="text-slate-500 text-sm">لم نتمكن من تحميل مكون الخريطة. يرجى التحقق من اتصالك والمحاولة مرة أخرى.</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => { setMapLoaded(false); setMapComponent(null); setMapLoadAttempt(prev => prev + 1) }}
                className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-lg shadow-emerald-200 inline-flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                إعادة المحاولة
              </motion.button>
            </div>
          </div>
        ) : mapLoaded && MapComponent ? <MapComponent interventions={filteredInterventions} quartiers={quartiers} selectedCommune={selectedCommune} onMapClick={onMapClick} mapClickEnabled={settings.mapClickEnabled} showCommunePopups={settings.showCommunePopups} onInterventionCreated={onRefresh} centerOn={centerOnCoords} onInterventionClick={handleInterventionClick} tileLayer={tileLayer} /> : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 font-medium">جاري تحميل الخريطة...</p>
            </div>
          </div>
        )}

        {/* === FLOATING MAP CONTROLS === */}

        {/* 1. Fullscreen Toggle Button - top-left */}
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-3 left-3 z-30 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/60 flex items-center justify-center hover:bg-white transition-colors"
          title={isFullscreen ? 'عرض عادي' : 'ملء الشاشة'}
        >
          {isFullscreen ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5 10a1 1 0 01-1 1H3a1 1 0 110-2h1a1 1 0 011 1zm12 0a1 1 0 01-1 1h-1a1 1 0 110-2h1a1 1 0 011 1zm-7-5a1 1 0 011-1h1a1 1 0 110 2h-1a1 1 0 01-1-1zM8 15a1 1 0 011 1h1a1 1 0 110-2H9a1 1 0 01-1 1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13.707 1.707a1 1 0 01-1.414-1.414L17.586 14H16a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0v-1.586l-2.293 2.293z" clipRule="evenodd" />
            </svg>
          )}
        </motion.button>

        {/* 2. Map Layer Toggle - top-left, below fullscreen */}
        <div className="absolute top-16 left-3 z-30 flex flex-col gap-2">
          {(['street', 'satellite', 'dark'] as const).map((layer) => {
            const isActive = tileLayer === layer
            const icons: Record<string, string> = { street: '🗺️', satellite: '🛰️', dark: '🌙' }
            const labels: Record<string, string> = { street: 'خريطة', satellite: 'ساتلية', dark: 'داكنة' }
            return (
              <motion.button
                key={layer}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + (layer === 'satellite' ? 0.1 : layer === 'dark' ? 0.2 : 0) }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setTileLayer(layer)}
                className={`w-10 h-10 rounded-xl shadow-lg border flex items-center justify-center transition-all text-sm ${
                  isActive
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-200'
                    : 'bg-white/90 backdrop-blur-sm text-slate-600 border-slate-200/60 hover:bg-white'
                }`}
                title={labels[layer]}
              >
                {icons[layer]}
              </motion.button>
            )
          })}
        </div>

        {/* 3. Collapsible Map Stats Summary Overlay - top center */}
        <AnimatePresence>
          {showMapStats && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30"
            >
              <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/60 px-4 py-2.5 flex items-center gap-4" dir="rtl">
                {/* Total */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm shadow-md">📋</div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">{filteredInterventions.length}</div>
                    <div className="text-[9px] text-slate-500 font-medium">إجمالي التدخلات</div>
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-slate-200" />

                {/* By Type */}
                <div className="flex items-center gap-2">
                  {typeCounts.map((t) => (
                    <div key={t.key} className="flex items-center gap-1">
                      <div className="w-6 h-6 rounded-md flex items-center justify-center text-[10px]" style={{ backgroundColor: t.color + '18' }}>
                        {t.icon}
                      </div>
                      <span className="text-xs font-bold" style={{ color: t.color }}>{t.count}</span>
                    </div>
                  ))}
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-slate-200" />

                {/* Completion Rate */}
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-md">
                    <span className="text-[9px] font-bold text-white">{completionRate}%</span>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-emerald-700">{completionRate}%</div>
                    <div className="text-[9px] text-slate-500">نسبة الإنجاز</div>
                  </div>
                </div>

                {/* Close button */}
                <button
                  onClick={() => setShowMapStats(false)}
                  className="w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors mr-1"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Show stats button when collapsed */}
        {!showMapStats && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => setShowMapStats(true)}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/60 flex items-center justify-center hover:bg-white transition-colors"
            title="إظهار الإحصائيات"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-600" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
            </svg>
          </motion.button>
        )}

        {/* 4. Floating Intervention Overlay Panel */}
        <AnimatePresence>
          {overlayIntervention && (
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="absolute z-40"
              style={{
                left: overlayPosition.x,
                top: overlayPosition.y,
                cursor: isDragging ? 'grabbing' : 'default',
              }}
            >
              <div
                className="w-[340px] bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-200/60 overflow-hidden"
                dir="rtl"
              >
                {/* Draggable Header */}
                <div
                  onMouseDown={handleDragStart}
                  onTouchStart={handleDragStart}
                  className="cursor-grab active:cursor-grabbing select-none"
                  style={{ background: `linear-gradient(135deg, ${TYPE_COLORS[overlayIntervention.type] || '#059669'}, ${TYPE_COLORS[overlayIntervention.type] || '#059669'}cc)` }}
                >
                  <div className="px-4 py-3 text-white relative">
                    {/* Decorative circles */}
                    <div className="absolute -top-4 -left-4 w-16 h-16 rounded-full bg-white/8" />
                    <div className="absolute -bottom-6 -right-3 w-12 h-12 rounded-full bg-white/5" />

                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-xl backdrop-blur-sm">
                          {TYPE_ICONS[overlayIntervention.type] || '📋'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm leading-tight">{TYPE_LABELS[overlayIntervention.type] || overlayIntervention.type}</h4>
                          <p className="text-[10px] text-white/75 mt-0.5">{overlayIntervention.reference}</p>
                        </div>
                      </div>
                      {/* Close Button */}
                      <button
                        onClick={() => setOverlayIntervention(null)}
                        className="w-7 h-7 rounded-lg bg-white/20 hover:bg-white/35 flex items-center justify-center transition-colors backdrop-blur-sm"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {/* Status & Type Badges */}
                    <div className="flex items-center gap-2 mt-2.5 relative z-10">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm border border-white/20">
                        {TYPE_ICONS[overlayIntervention.type]} {TYPE_LABELS[overlayIntervention.type]}
                      </span>
                      <span
                        className="px-3 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm border"
                        style={{
                          backgroundColor: (STATUT_COLORS[overlayIntervention.statut] || '#6b7280') + '30',
                          borderColor: (STATUT_COLORS[overlayIntervention.statut] || '#6b7280') + '40',
                          color: 'white',
                        }}
                      >
                        {STATUT_LABELS[overlayIntervention.statut] || overlayIntervention.statut}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content — scrollable */}
                <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto">
                  {/* Location Info */}
                  <div className="flex items-start gap-2.5 bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0" style={{ backgroundColor: (TYPE_COLORS[overlayIntervention.type] || '#059669') + '15' }}>
                      📍
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">🏘️ {overlayIntervention.quartier}</p>
                      {overlayIntervention.adresse && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">🏠 {overlayIntervention.adresse}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        📅 {new Date(overlayIntervention.date).toLocaleDateString('ar-MA')}
                        {overlayIntervention.heureDebut && (
                          <span className="mr-2">⏰ {overlayIntervention.heureDebut}{overlayIntervention.heureFin ? ` - ${overlayIntervention.heureFin}` : ''}</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-semibold mb-1">🔖 المرجع</div>
                      <div className="text-xs font-bold text-slate-700 truncate font-mono">{overlayIntervention.reference || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-semibold mb-1">👤 العون</div>
                      <div className="text-xs font-bold text-slate-700 truncate">{overlayIntervention.agentNom || '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-semibold mb-1">📐 المساحة</div>
                      <div className="text-xs font-bold text-slate-700">{overlayIntervention.superficie ? `${overlayIntervention.superficie} م²` : '—'}</div>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-semibold mb-1">🏛️ الجماعة</div>
                      <div className="text-xs font-bold text-slate-700">{COMMUNE_LABELS[overlayIntervention.commune] || overlayIntervention.commune || '—'}</div>
                    </div>
                  </div>

                  {/* Products Used — from produitUtilise field */}
                  {overlayIntervention.produitUtilise && (
                    <div className="bg-emerald-50/80 rounded-xl p-2.5 border border-emerald-100">
                      <div className="text-[9px] text-emerald-600 font-semibold mb-1">💊 المنتج المستعمل</div>
                      <p className="text-xs text-emerald-700 font-medium">{overlayIntervention.produitUtilise}</p>
                    </div>
                  )}

                  {/* Materials / Products Used — from materials array */}
                  {overlayIntervention.materials && overlayIntervention.materials.length > 0 && (
                    <div className="bg-blue-50/80 rounded-xl p-2.5 border border-blue-100">
                      <div className="text-[9px] text-blue-600 font-semibold mb-1.5">🧪 المنتجات المستعملة ({overlayIntervention.materials.length})</div>
                      <div className="space-y-1.5">
                        {overlayIntervention.materials.map((mat) => (
                          <div key={mat.id} className="flex items-center justify-between bg-white/70 rounded-lg px-2.5 py-1.5 border border-blue-50">
                            <span className="text-xs text-slate-700 font-medium truncate flex-1">{mat.product?.nom || '—'}</span>
                            <span className="text-[10px] font-bold text-blue-600 flex-shrink-0 mr-2">
                              {mat.quantity} {mat.product?.unite || ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {overlayIntervention.description && (
                    <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                      <div className="text-[9px] text-slate-400 font-semibold mb-1">📝 الوصف</div>
                      <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">{overlayIntervention.description}</p>
                    </div>
                  )}

                  {/* Observations */}
                  {overlayIntervention.observations && (
                    <div className="bg-amber-50/80 rounded-xl p-2.5 border border-amber-100">
                      <div className="text-[9px] text-amber-600 font-semibold mb-1">💬 الملاحظات</div>
                      <p className="text-xs text-amber-700 leading-relaxed line-clamp-3">{overlayIntervention.observations}</p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-1">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        if (onNavigateToInterventions) onNavigateToInterventions()
                      }}
                      className="flex-1 bg-gradient-to-l from-emerald-600 to-teal-600 text-white py-2.5 rounded-xl text-xs font-bold shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                      عرض التفاصيل
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setOverlayIntervention(null)}
                      className="w-10 h-10 bg-slate-100 hover:bg-slate-200 rounded-xl flex items-center justify-center transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </motion.button>
                  </div>
                </div>

                {/* Drag indicator */}
                <div className="px-4 pb-2">
                  <div className="flex justify-center">
                    <div className="w-12 h-1 bg-slate-200 rounded-full" />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Map click instruction overlay */}
        {settings.mapClickEnabled && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.5 }}
          className="absolute bottom-4 left-4 z-10"
        >
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-4 py-2.5 shadow-lg border border-emerald-100 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm shadow-md">📍</div>
            <div>
              <p className="text-[11px] font-bold text-emerald-700">انقر على الخريطة لإضافة تدخل</p>
              <p className="text-[9px] text-slate-400">اضغط على أي موقع لملء استمارة التدخل</p>
            </div>
          </div>
        </motion.div>
        )}
      </div>
    </div>
  )
}

export default MapView
