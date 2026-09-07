import { readFile } from 'fs/promises'
import path from 'path'
import legacyCommuneBoundaries from '@/app/communes-data'
import { communeNamesMatch } from '@/lib/commune-names'

type Position = ReadonlyArray<number>
type Ring = ReadonlyArray<Position>
type Polygon = ReadonlyArray<Ring>
type Geometry = { type: 'Polygon'; coordinates: Polygon } | { type: 'MultiPolygon'; coordinates: ReadonlyArray<Polygon> }
type BoundaryFeatureProperties = {
  code?: string
  name?: string
  nameAr?: string
  nameFr?: string
  regionCode?: string
  provinceCode?: string
  population?: number | null
  surface?: number | null
}
type BoundaryFeature = { properties?: BoundaryFeatureProperties; geometry?: Geometry | null }

export interface CommuneLookupResult {
  commune: string
  code?: string
  nameFr?: string
  regionCode?: string
  provinceCode?: string
  /** المسافة (بالأمتار) لأقرب مضلع جماعة — مفيدة ك fallback عند عدم التطابق التام */
  distance?: number
}

let nationalFeaturesPromise: Promise<BoundaryFeature[]> | null = null

function loadNationalFeatures(): Promise<BoundaryFeature[]> {
  if (!nationalFeaturesPromise) {
    nationalFeaturesPromise = readFile(path.join(process.cwd(), 'public', 'geography', 'communes.geojson'), 'utf8')
      .then((content) => {
        const data = JSON.parse(content) as { features?: BoundaryFeature[] }
        return data.features || []
      })
      .catch(() => [])
  }
  return nationalFeaturesPromise
}

function isPointInRing(latitude: number, longitude: number, ring: Ring): boolean {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const [currentLongitude, currentLatitude] = ring[index]
    const [previousLongitude, previousLatitude] = ring[previous]
    const intersects = ((currentLatitude > latitude) !== (previousLatitude > latitude)) &&
      (longitude < (previousLongitude - currentLongitude) * (latitude - currentLatitude) / (previousLatitude - currentLatitude) + currentLongitude)
    if (intersects) inside = !inside
  }
  return inside
}

function isPointInPolygon(latitude: number, longitude: number, polygon: Polygon): boolean {
  return polygon.length > 0 && isPointInRing(latitude, longitude, polygon[0]) &&
    !polygon.slice(1).some((ring) => isPointInRing(latitude, longitude, ring))
}

function isPointInGeometry(latitude: number, longitude: number, geometry: Geometry | null | undefined): boolean {
  if (!geometry) return false
  if (geometry.type === 'Polygon') return isPointInPolygon(latitude, longitude, geometry.coordinates)
  return geometry.coordinates.some((polygon) => isPointInPolygon(latitude, longitude, polygon))
}

function featureMatchesCommune(feature: BoundaryFeature, commune: string): boolean {
  const properties = feature.properties
  return [properties?.nameAr, properties?.name, properties?.nameFr]
    .filter(Boolean)
    .some((name) => typeof name === 'string' && communeNamesMatch(name, commune))
}

/**
 * بحث عكسي: يجد الجماعة الترابية التي تحتوي نقطة جغرافية معينة.
 * يكرّر كل مضلعات الـ geojson الوطني ويعيد أول تطابق.
 * يرجع null إذا لم تكن النقطة داخل أي جماعة معروفة.
 */
export async function getCommuneForPoint(latitude: number, longitude: number): Promise<CommuneLookupResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null

  const features = await loadNationalFeatures()
  for (const feature of features) {
    if (!feature.geometry) continue
    if (isPointInGeometry(latitude, longitude, feature.geometry)) {
      const p = feature.properties || {}
      return {
        commune: p.nameAr || p.name || p.nameFr || '',
        code: p.code,
        nameFr: p.nameFr,
        regionCode: p.regionCode,
        provinceCode: p.provinceCode,
      }
    }
  }
  return null
}

/** Returns null when no known boundary is available for the commune. */
export async function isCoordinateInCommune(commune: string, latitude: number, longitude: number): Promise<boolean | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !commune) return false

  const nationalFeature = (await loadNationalFeatures()).find((feature) => featureMatchesCommune(feature, commune))
  if (nationalFeature) return isPointInGeometry(latitude, longitude, nationalFeature.geometry)

  const legacyFeatures = (legacyCommuneBoundaries as unknown as { features?: BoundaryFeature[] }).features || []
  const legacyFeature = legacyFeatures.find((feature) => featureMatchesCommune(feature, commune))
  return legacyFeature ? isPointInGeometry(latitude, longitude, legacyFeature.geometry) : null
}

/**
 * يرشّح النقاط حسب وجود إحداثياتها داخل مضلع الجماعة المطلوبة.
 * عند غياب مضلع جماعة معيّنة يستعمل اسم الجماعة كحل احتياطي حتى لا تختفي البيانات.
 */
export async function filterPointsToCommunes<T extends { lat: number; lng: number; commune?: string }>(
  points: T[],
  communes: string[],
): Promise<T[]> {
  const requestedCommunes = [...new Set(communes.filter((commune) => Boolean(commune && commune !== 'ALL')))]
  if (requestedCommunes.length === 0) return points

  const nationalFeatures = await loadNationalFeatures()
  const legacyFeatures = (legacyCommuneBoundaries as unknown as { features?: BoundaryFeature[] }).features || []
  const boundaries = requestedCommunes.map((commune) => ({
    commune,
    feature: nationalFeatures.find((feature) => featureMatchesCommune(feature, commune))
      || legacyFeatures.find((feature) => featureMatchesCommune(feature, commune)),
  }))

  return points.filter((point) => {
    const matchingBoundaries = boundaries.filter((entry) => entry.feature?.geometry)
    if (matchingBoundaries.length === 0) {
      return requestedCommunes.some((commune) => point.commune && communeNamesMatch(point.commune, commune))
    }

    if (matchingBoundaries.some((entry) => isPointInGeometry(point.lat, point.lng, entry.feature?.geometry))) {
      return true
    }

    const communesWithoutBoundary = boundaries.filter((entry) => !entry.feature?.geometry).map((entry) => entry.commune)
    return Boolean(point.commune && communesWithoutBoundary.some((commune) => communeNamesMatch(point.commune || '', commune)))
  })
}
