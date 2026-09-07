import catalogJson from '../../public/geography/catalog.json'
import { ALL_TERRITORIES, type TerritoryCatalog, type TerritoryFilter } from '@/lib/geography'

const catalog = catalogJson as TerritoryCatalog

export type CommuneScope = string | { in: string[] } | null

function territoryName(entry: TerritoryCatalog['communes'][number]): string {
  return entry.nameAr || entry.name || entry.nameFr
}

export function getTerritoryFilterFromSearchParams(searchParams: URLSearchParams): TerritoryFilter {
  return {
    regionCode: searchParams.get('regionCode') || ALL_TERRITORIES,
    provinceCode: searchParams.get('provinceCode') || ALL_TERRITORIES,
    communeCode: searchParams.get('communeCode') || ALL_TERRITORIES,
  }
}

export function getTerritoryFilterFromValue(value: unknown): TerritoryFilter {
  const filter = value && typeof value === 'object' ? value as Partial<TerritoryFilter> : {}
  return {
    regionCode: typeof filter.regionCode === 'string' ? filter.regionCode : ALL_TERRITORIES,
    provinceCode: typeof filter.provinceCode === 'string' ? filter.provinceCode : ALL_TERRITORIES,
    communeCode: typeof filter.communeCode === 'string' ? filter.communeCode : ALL_TERRITORIES,
  }
}

export function getCommuneScope(filter: TerritoryFilter): CommuneScope {
  if (filter.communeCode !== ALL_TERRITORIES) {
    const commune = catalog.communes.find((entry) => entry.code === filter.communeCode)
    return commune ? territoryName(commune) : { in: [] }
  }

  if (filter.provinceCode === ALL_TERRITORIES && filter.regionCode === ALL_TERRITORIES) {
    return null
  }

  const communes = catalog.communes
    .filter((entry) => (
      (filter.regionCode === ALL_TERRITORIES || entry.regionCode === filter.regionCode) &&
      (filter.provinceCode === ALL_TERRITORIES || entry.provinceCode === filter.provinceCode)
    ))
    .map(territoryName)

  return { in: [...new Set(communes)] }
}

export function isCommuneInTerritoryScope(commune: string, filter: TerritoryFilter): boolean {
  const scope = getCommuneScope(filter)
  if (scope === null) return true
  if (typeof scope === 'string') return scope === commune
  return scope.in.includes(commune)
}

export function areCommunesInSameProvince(communes: string[]): boolean {
  const uniqueCommunes = [...new Set(communes)]
  if (uniqueCommunes.length < 2) return true

  const provinceCodes = uniqueCommunes.map((commune) => {
    const entry = catalog.communes.find((item) => territoryName(item) === commune)
    return entry?.provinceCode || null
  })
  return provinceCodes.every(Boolean) && new Set(provinceCodes).size === 1
}
