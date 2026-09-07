export const ALL_TERRITORIES = 'ALL'

export type TerritoryFilter = {
  regionCode: string
  provinceCode: string
  communeCode: string
}

export type TerritoryCatalogEntry = {
  code: string
  name: string
  nameAr: string
  nameFr: string
  regionCode: string
  provinceCode: string | null
  population: number | null
  households: number | null
  foreigners: number | null
}

export type TerritoryCatalog = {
  regions: TerritoryCatalogEntry[]
  provinces: TerritoryCatalogEntry[]
  communes: TerritoryCatalogEntry[]
}

export const DEFAULT_TERRITORY_FILTER: TerritoryFilter = {
  regionCode: ALL_TERRITORIES,
  provinceCode: ALL_TERRITORIES,
  communeCode: ALL_TERRITORIES,
}

export function hasTerritorySelection(filter: TerritoryFilter): boolean {
  return filter.regionCode !== ALL_TERRITORIES ||
    filter.provinceCode !== ALL_TERRITORIES ||
    filter.communeCode !== ALL_TERRITORIES
}

export function appendTerritoryParams(params: URLSearchParams, filter: TerritoryFilter): URLSearchParams {
  if (filter.regionCode !== ALL_TERRITORIES) params.set('regionCode', filter.regionCode)
  if (filter.provinceCode !== ALL_TERRITORIES) params.set('provinceCode', filter.provinceCode)
  if (filter.communeCode !== ALL_TERRITORIES) params.set('communeCode', filter.communeCode)
  return params
}

/**
 * Resolve a TerritoryFilter to a human-readable Arabic label using the catalog.
 * Returns null when no specific territory is selected (all-ALL).
 * The catalog is fetched once and cached in a module-level promise.
 */
let _catalogCache: TerritoryCatalog | null = null
let _catalogPromise: Promise<TerritoryCatalog | null> | null = null

export async function loadTerritoryCatalog(): Promise<TerritoryCatalog | null> {
  if (_catalogCache) return _catalogCache
  if (_catalogPromise) return _catalogPromise
  _catalogPromise = fetch('/geography/catalog.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((data: TerritoryCatalog | null) => {
      if (data?.regions && data?.provinces && data?.communes) {
        _catalogCache = data
      }
      return _catalogCache
    })
    .catch(() => null)
  return _catalogPromise
}

/**
 * Returns a label like "جماعة سلا", "عمالة سلا", or "جهة الرباط سلا القنيطرة"
 * depending on the most specific selection in the filter.
 * Returns null if no territory is selected (all set to ALL).
 */
export function territoryFilterLabel(filter: TerritoryFilter, catalog: TerritoryCatalog | null): string | null {
  if (!hasTerritorySelection(filter) || !catalog) return null
  const name = (code: string, entries: TerritoryCatalogEntry[]): string | undefined =>
    entries.find((e) => e.code === code)?.nameAr
  if (filter.communeCode !== ALL_TERRITORIES) {
    return name(filter.communeCode, catalog.communes) || null
  }
  if (filter.provinceCode !== ALL_TERRITORIES) {
    const n = name(filter.provinceCode, catalog.provinces)
    return n ? (n.startsWith('عمالة') || n.startsWith('إقليم') ? n : `عمالة/إقليم ${n}`) : null
  }
  if (filter.regionCode !== ALL_TERRITORIES) {
    const n = name(filter.regionCode, catalog.regions)
    return n ? `جهة ${n}` : null
  }
  return null
}

