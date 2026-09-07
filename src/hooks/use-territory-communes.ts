'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  ALL_TERRITORIES,
  type TerritoryCatalog,
  type TerritoryCatalogEntry,
  type TerritoryFilter,
} from '@/lib/geography'

export function territoryCommuneName(commune: TerritoryCatalogEntry): string {
  return commune.nameAr || commune.name || commune.nameFr
}

export function useTerritoryCommunes(filter: TerritoryFilter, enabled: boolean) {
  const [catalog, setCatalog] = useState<TerritoryCatalog | null>(null)

  useEffect(() => {
    if (!enabled) return

    let active = true
    fetch('/geography/catalog.json')
      .then((response) => response.ok ? response.json() : null)
      .then((data: TerritoryCatalog | null) => {
        if (active && data) setCatalog(data)
      })
      .catch(() => undefined)

    return () => { active = false }
  }, [enabled])

  const communes = useMemo(() => {
    if (!enabled || !catalog) return []

    const scopedCommunes = catalog.communes
      .filter((commune) => (
        (filter.regionCode === ALL_TERRITORIES || commune.regionCode === filter.regionCode) &&
        (filter.provinceCode === ALL_TERRITORIES || commune.provinceCode === filter.provinceCode) &&
        (filter.communeCode === ALL_TERRITORIES || commune.code === filter.communeCode)
      ))
      .sort((first, second) => territoryCommuneName(first).localeCompare(territoryCommuneName(second), 'ar'))

    return scopedCommunes
  }, [catalog, enabled, filter.communeCode, filter.provinceCode, filter.regionCode])

  return { communes, isLoading: enabled && !catalog }
}
