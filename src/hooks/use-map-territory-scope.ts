'use client'

import { useMemo } from 'react'
import { hasTerritorySelection, type TerritoryFilter } from '@/lib/geography'
import { territoryCommuneName, useTerritoryCommunes } from '@/hooks/use-territory-communes'

type ScopeUser = {
  role: string
  commune: string
  managedCommunes?: string[]
} | null | undefined

/**
 * يوحّد نطاق الخرائط الفرعية مع نطاق الحساب والفلتر الترابي الوطني.
 * القيمة الفارغة تعني أن المسؤول العام يعرض النطاق الوطني كاملاً.
 */
export function useMapTerritoryScope(
  user: ScopeUser,
  selectedCommune: string,
  territoryFilter: TerritoryFilter,
  useTerritoryFilter: boolean,
) {
  const shouldResolveCatalogScope = user?.role === 'admin' && selectedCommune === 'ALL' &&
    useTerritoryFilter && hasTerritorySelection(territoryFilter)
  const { communes: territoryCommunes, isLoading } = useTerritoryCommunes(territoryFilter, shouldResolveCatalogScope)

  const allowedCommunes = useMemo(() => {
    const managedCommunes = Array.isArray(user?.managedCommunes)
      ? [...new Set(user.managedCommunes.filter((commune) => commune && commune !== 'ALL'))]
      : []
    const accountCommunes = managedCommunes.length > 0
      ? managedCommunes
      : (user?.commune && user.commune !== 'ALL' ? [user.commune] : [])

    if (user?.role !== 'admin') {
      if (selectedCommune !== 'ALL' && accountCommunes.includes(selectedCommune)) return [selectedCommune]
      return accountCommunes
    }
    if (selectedCommune !== 'ALL') return [selectedCommune]
    if (shouldResolveCatalogScope) return territoryCommunes.map(territoryCommuneName)
    return []
  }, [selectedCommune, shouldResolveCatalogScope, territoryCommunes, user])

  return { allowedCommunes, isLoading: shouldResolveCatalogScope && isLoading }
}
