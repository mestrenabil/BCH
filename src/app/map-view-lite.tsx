'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useAppStore, type CommuneType } from '@/lib/store'
import {
  type Intervention, type Quartier,
  TYPE_LABELS, TYPE_COLORS, TYPE_ICONS, STATUT_LABELS, STATUT_COLORS,
} from '@/lib/constants'

const COMMUNE_INFO: { name: string; key: string; color: string; population: string; populationMunicipale: string; populationCompteeAPart: string; menages: string; isBouknadel: boolean }[] = [
  { name: 'جماعة سلا', key: 'سلا', color: '#059669', population: '945,101', populationMunicipale: '938,475', populationCompteeAPart: '6,626', menages: '256,144', isBouknadel: false },
  { name: 'جماعة سيدي أبي القنادل', key: 'سيدي أبي القنادل', color: '#7c3aed', population: '43,598', populationMunicipale: '43,550', populationCompteeAPart: '48', menages: '10,439', isBouknadel: true },
  { name: 'جماعة عامر', key: 'عامر', color: '#d97706', population: '75,942', populationMunicipale: '75,896', populationCompteeAPart: '46', menages: '18,540', isBouknadel: false },
]

function MapView({ interventions, quartiers, selectedCommune, canSeeAllCommunes, onMapClick, onRefresh }: { interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: CommuneType | 'ALL'; canSeeAllCommunes: boolean; onMapClick: (lat: number, lng: number, commune: string | null) => void; onRefresh?: () => void }) {
  const [mapLoaded, setMapLoaded] = useState(false)
  const [MapComponent, setMapComponent] = useState<React.ComponentType<{ interventions: Intervention[]; quartiers: Quartier[]; selectedCommune: string; onMapClick?: (lat: number, lng: number, commune: string | null) => void; mapClickEnabled?: boolean; showCommunePopups?: boolean; onInterventionCreated?: () => void }> | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [hoveredCommune, setHoveredCommune] = useState<string | null>(null)
  const { setSelectedCommune, settings } = useAppStore()

  const [mapError, setMapError] = useState(false)
  const [mapLoadAttempt, setMapLoadAttempt] = useState(0)

  useEffect(() => {
    setMapError(false)
    import('./map-component').then((mod) => {
      setMapComponent(() => mod.default)
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
    count: interventions.filter(i => i.type === key).length,
  }))

  // Status counts
  const statusCounts = Object.entries(STATUT_LABELS).map(([key, label]) => ({
    key, label, color: STATUT_COLORS[key],
    count: interventions.filter(i => i.statut === key).length,
  }))

  return (
    <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] pb-16 lg:pb-0 relative flex">
      {/* Professional Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: 40 }}
        animate={{ opacity: 1, x: 0, width: sidebarCollapsed ? 56 : 340 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="absolute top-0 right-0 bottom-0 z-20 flex flex-col bg-white/95 backdrop-blur-xl border-l border-slate-200/60 shadow-2xl overflow-hidden"
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

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2 p-3">
              <div className="bg-emerald-50 rounded-xl p-2 text-center border border-emerald-100">
                <div className="text-lg font-bold text-emerald-700">{interventions.length}</div>
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
                      {interventions.length > 0 && (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded-md">
                          {interventions.filter(i => i.commune === info.key).length}
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

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
                            width: `${interventions.length > 0 ? (t.count / interventions.length * 100) : 0}%`,
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
                  <span className="text-sm font-bold text-emerald-600">{interventions.length}</span>
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
      <div className="flex-1 relative">
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
        ) : mapLoaded && MapComponent ? <MapComponent interventions={interventions} quartiers={quartiers} selectedCommune={selectedCommune} onMapClick={onMapClick} mapClickEnabled={settings.mapClickEnabled} showCommunePopups={settings.showCommunePopups} onInterventionCreated={onRefresh} /> : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-4">
              <div className="w-14 h-14 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-slate-500 font-medium">جاري تحميل الخريطة...</p>
            </div>
          </div>
        )}
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
