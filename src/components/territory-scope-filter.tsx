'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ALL_TERRITORIES,
  type TerritoryCatalog,
  type TerritoryCatalogEntry,
  type TerritoryFilter,
} from '@/lib/geography'

type Props = {
  filter: TerritoryFilter
  onChange: (filter: TerritoryFilter) => void
  className?: string
}

function territoryName(entry: TerritoryCatalogEntry): string {
  return entry.nameAr || entry.name || entry.nameFr
}

export default function TerritoryScopeFilter({ filter, onChange, className = '' }: Props) {
  const [catalog, setCatalog] = useState<TerritoryCatalog | null>(null)

  useEffect(() => {
    let active = true
    fetch('/geography/catalog.json')
      .then((response) => response.ok ? response.json() : null)
      .then((data: TerritoryCatalog | null) => {
        if (active && data?.regions && data?.provinces && data?.communes) setCatalog(data)
      })
      .catch(() => undefined)
    return () => { active = false }
  }, [])

  const provinces = useMemo(() => (catalog?.provinces || [])
    .filter((province) => filter.regionCode === ALL_TERRITORIES || province.regionCode === filter.regionCode)
    .sort((first, second) => territoryName(first).localeCompare(territoryName(second), 'ar')), [catalog, filter.regionCode])

  const communes = useMemo(() => (catalog?.communes || [])
    .filter((commune) => {
      if (filter.provinceCode !== ALL_TERRITORIES) return commune.provinceCode === filter.provinceCode
      return filter.regionCode === ALL_TERRITORIES || commune.regionCode === filter.regionCode
    })
    .sort((first, second) => territoryName(first).localeCompare(territoryName(second), 'ar')), [catalog, filter.provinceCode, filter.regionCode])

  const selectClass = 'min-w-0 rounded-lg border border-white/20 bg-white/95 px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-emerald-400'

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`} dir="rtl">
      <span className="text-xs font-bold text-emerald-100">🌐 النطاق الترابي:</span>
      <select
        value={filter.regionCode}
        onChange={(event) => onChange({ regionCode: event.target.value, provinceCode: ALL_TERRITORIES, communeCode: ALL_TERRITORIES })}
        className={selectClass}
        aria-label="الجهة"
      >
        <option value={ALL_TERRITORIES}>كل الجهات</option>
        {catalog?.regions.map((region) => <option key={region.code} value={region.code}>{territoryName(region)}</option>)}
      </select>
      <select
        value={filter.provinceCode}
        onChange={(event) => {
          const province = catalog?.provinces.find((entry) => entry.code === event.target.value)
          onChange({
            regionCode: province?.regionCode || filter.regionCode,
            provinceCode: event.target.value,
            communeCode: ALL_TERRITORIES,
          })
        }}
        className={selectClass}
        aria-label="الإقليم أو العمالة"
      >
        <option value={ALL_TERRITORIES}>كل الأقاليم والعمالات</option>
        {provinces.map((province) => <option key={province.code} value={province.code}>{territoryName(province)}</option>)}
      </select>
      <select
        value={filter.communeCode}
        onChange={(event) => {
          const commune = catalog?.communes.find((entry) => entry.code === event.target.value)
          onChange({
            regionCode: commune?.regionCode || filter.regionCode,
            provinceCode: commune?.provinceCode || filter.provinceCode,
            communeCode: event.target.value,
          })
        }}
        className={selectClass}
        aria-label="الجماعة"
      >
        <option value={ALL_TERRITORIES}>كل الجماعات</option>
        {communes.map((commune) => <option key={commune.code} value={commune.code}>{territoryName(commune)}</option>)}
      </select>
    </div>
  )
}
