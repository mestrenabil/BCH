/**
 * convert-kml-to-geojson.ts
 *
 * Converts the KML file (communes_maroc_corrigees_1503.kml) with 1,503 Moroccan communes
 * into:
 *   1. public/geography/communes.geojson  — GeoJSON FeatureCollection for map rendering
 *   2. public/geography/catalog.json      — Territory hierarchy for filter dropdowns
 *
 * Usage:
 *   npx tsx scripts/convert-kml-to-geojson.ts
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// ── KML parsing helpers ──────────────────────────────────────────────

interface SimpleData {
  _name: string
  _text: string
}

interface Placemark {
  ExtendedData?: { SchemaData?: { SimpleData?: SimpleData[] } }
  MultiGeometry?: { Polygon?: KmlPolygon[] }
  Polygon?: KmlPolygon[]
}

interface KmlPolygon {
  outerBoundaryIs?: { LinearRing?: { coordinates: string } }
  innerBoundaryIs?: { LinearRing?: { coordinates: string } }[]
}

interface KmlDocument {
  Document?: {
    Folder?: { Placemark?: Placemark[] }
  }
}

/** Parse coordinates string "lng,lat lng,lat ..." into GeoJSON [lng, lat] arrays */
function parseCoordinates(coordsStr: string): number[][] {
  return coordsStr
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const [lng, lat] = pair.split(',').map(Number)
      return [lng, lat]
    })
}

/** Extract SimpleData fields from a Placemark into a flat record */
function extractData(Placemark: Placemark): Record<string, string> {
  const data: Record<string, string> = {}
  const simpleDataArray = Placemark.ExtendedData?.SchemaData?.SimpleData
  if (!simpleDataArray) return data
  for (const sd of simpleDataArray) {
    if (sd._name) data[sd._name] = sd._text ?? ''
  }
  return data
}

/** Extract polygons from a Placemark (handles both MultiGeometry and bare Polygon) */
function extractPolygons(Placemark: Placemark): KmlPolygon[] {
  if (Placemark.MultiGeometry?.Polygon) return Placemark.MultiGeometry.Polygon
  if (Placemark.Polygon) return Placemark.Polygon
  return []
}

/** Convert a KML Polygon to a GeoJSON Polygon coordinate array */
function toGeoJsonPolygon(kmlPoly: KmlPolygon): number[][][] {
  const rings: number[][] = []
  if (kmlPoly.outerBoundaryIs?.LinearRing?.coordinates) {
    rings.push(parseCoordinates(kmlPoly.outerBoundaryIs.LinearRing.coordinates))
  }
  const innerBounds = kmlPoly.innerBoundaryIs
  if (innerBounds && Array.isArray(innerBounds)) {
    for (const inner of innerBounds) {
      if (inner.LinearRing?.coordinates) {
        rings.push(parseCoordinates(inner.LinearRing.coordinates))
      }
    }
  }
  return rings
}

// ── Naive XML parser (no external dependencies) ──────────────────────

/**
 * Minimal KML parser that extracts Placemark elements with their data and geometry.
 * Uses a simple state machine to avoid pulling in heavy XML libraries.
 */

function parseKml(xml: string): Placemark[] {
  const placemarks: Placemark[] = []

  // Find all Placemark blocks
  const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g
  let match: RegExpExecArray | null

  while ((match = placemarkRegex.exec(xml)) !== null) {
    const block = match[1]

    // Extract SimpleData
    const data: Record<string, string> = {}
    const sdRegex = /<SimpleData\s+name="([^"]*)">([^<]*)<\/SimpleData>/g
    let sdMatch: RegExpExecArray | null
    while ((sdMatch = sdRegex.exec(block)) !== null) {
      data[sdMatch[1]] = sdMatch[2]
    }

    // Check for MultiGeometry
    const isMulti = /<MultiGeometry>/.test(block)
    const isPoly = /<Polygon>/.test(block)

    // Extract all Polygon blocks
    const polygons: KmlPolygon[] = []
    const polyRegex = /<Polygon>([\s\S]*?)<\/Polygon>/g
    let polyMatch: RegExpExecArray | null
    while ((polyMatch = polyRegex.exec(block)) !== null) {
      const polyBlock = polyMatch[1]

      // Outer boundary
      const outerMatch = /<outerBoundaryIs>\s*<LinearRing>\s*<coordinates>([\s\S]*?)<\/coordinates>\s*<\/LinearRing>\s*<\/outerBoundaryIs>/.exec(polyBlock)

      // Inner boundaries
      const inners: KmlPolygon['innerBoundaryIs'] = []
      const innerRegex = /<innerBoundaryIs>\s*<LinearRing>\s*<coordinates>([\s\S]*?)<\/coordinates>\s*<\/LinearRing>\s*<\/innerBoundaryIs>/g
      let innerMatch: RegExpExecArray | null
      while ((innerMatch = innerRegex.exec(polyBlock)) !== null) {
        inners.push({
          LinearRing: { coordinates: innerMatch[1] }
        })
      }

      if (outerMatch) {
        polygons.push({
          outerBoundaryIs: { LinearRing: { coordinates: outerMatch[1] } },
          innerBoundaryIs: inners.length > 0 ? inners : undefined,
        })
      }
    }

    const placemark: Placemark = {
      ExtendedData: {
        SchemaData: {
          SimpleData: Object.entries(data).map(([_name, _text]) => ({ _name, _text })),
        },
      },
    }

    if (isMulti) {
      placemark.MultiGeometry = { Polygon: polygons }
    } else if (isPoly) {
      placemark.Polygon = polygons
    }

    placemarks.push(placemark)
  }

  return placemarks
}

// ── ISO code hierarchy extraction ───────────────────────────────────

function parseISOCode(iso: string): { regionCode: string; provinceCode: string; communeCode: string } {
  // MA-XX-YYY-ZZZZ
  const parts = iso.split('-')
  return {
    regionCode: `${parts[0]}-${parts[1]}`,
    provinceCode: `${parts[0]}-${parts[1]}-${parts[2]}`,
    communeCode: iso,
  }
}

// ── Main ────────────────────────────────────────────────────────────

function main() {
  console.log('📂 Reading KML file...')
  const kmlPath = join(ROOT, '..', 'communes_maroc_corrigees_1503.kml')
  const kmlContent = readFileSync(kmlPath, 'utf-8')
  console.log(`   KML file: ${(kmlContent.length / 1024 / 1024).toFixed(1)} MB`)

  console.log('🔍 Parsing KML...')
  const placemarks = parseKml(kmlContent)
  console.log(`   Found ${placemarks.length} Placemarks`)

  // Read existing catalog to preserve region/province metadata
  console.log('📂 Reading existing catalog.json...')
  const catalogPath = join(ROOT, 'public', 'geography', 'catalog.json')
  const existingCatalog = JSON.parse(readFileSync(catalogPath, 'utf-8'))

  // Build lookup maps for existing regions and provinces
  const existingRegionsMap = new Map<string, typeof existingCatalog.regions[0]>()
  for (const r of existingCatalog.regions) {
    existingRegionsMap.set(r.code, r)
  }
  const existingProvincesMap = new Map<string, typeof existingCatalog.provinces[0]>()
  for (const p of existingCatalog.provinces) {
    existingProvincesMap.set(p.code, p)
  }

  // Process placemarks into features
  console.log('🔄 Converting to GeoJSON features...')
  const features: CommuneFeature[] = []
  const communesCatalog: typeof existingCatalog.communes = []

  // Track unique regions and provinces from KML data
  const regionsFromKml = new Map<string, { code: string; name: string; population: number; households: number }>()
  const provincesFromKml = new Map<string, { code: string; regionCode: string; name: string; population: number; households: number }>()

  let errorCount = 0

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i]
    const data = extractData(pm)
    const iso = data['ISO']
    const nomFr = data['nom_fr'] || ''
    const nomAr = data['nom_ar'] || ''
    const pEnsemble = data['P_ensemble'] ? parseFloat(data['P_ensemble']) : null
    const pMasculin = data['P_masculin'] ? parseFloat(data['P_masculin']) : null
    const pFeminins = data['P_feminins'] ? parseFloat(data['P_feminins']) : null
    const pMenagesRaw = data['P_menages']
    const pMenages = pMenagesRaw && pMenagesRaw.trim() !== '' ? parseFloat(pMenagesRaw) : null
    const surface = data['s'] ? parseFloat(data['s']) : null

    if (!iso) {
      console.error(`   ⚠️  Placemark ${i + 1}: missing ISO code, skipping`)
      errorCount++
      continue
    }

    const { regionCode, provinceCode, communeCode } = parseISOCode(iso)
    const polygons = extractPolygons(pm)

    if (polygons.length === 0) {
      console.error(`   ⚠️  Placemark ${i + 1} (${nomFr}): no polygons found, skipping`)
      errorCount++
      continue
    }

    // Convert to GeoJSON MultiPolygon
    const coordinates: number[][][][] = polygons.map((p) => toGeoJsonPolygon(p))

    const feature: CommuneFeature = {
      type: 'Feature',
      properties: {
        code: communeCode,
        name: nomAr,
        nameAr: nomAr,
        nameFr: nomFr,
        population: pEnsemble,
        populationMale: pMasculin,
        populationFemale: pFeminins,
        households: pMenages,
        surface: surface,
        regionCode: regionCode,
        provinceCode: provinceCode,
        level: 'commune',
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: coordinates,
      },
    }

    features.push(feature)

    // Build catalog entry
    communesCatalog.push({
      code: communeCode,
      name: nomAr,
      nameAr: nomAr,
      nameFr: nomFr,
      regionCode: regionCode,
      provinceCode: provinceCode,
      population: pEnsemble ?? 0,
      households: pMenages,
      foreigners: null,
    })

    // Aggregate region data
    const rEntry = regionsFromKml.get(regionCode)
    if (rEntry) {
      rEntry.population += pEnsemble ?? 0
      rEntry.households += pMenages ?? 0
    } else {
      regionsFromKml.set(regionCode, {
        code: regionCode,
        name: nomAr, // will be overwritten from existing catalog
        population: pEnsemble ?? 0,
        households: pMenages ?? 0,
      })
    }

    // Aggregate province data
    const pEntry = provincesFromKml.get(provinceCode)
    if (pEntry) {
      pEntry.population += pEnsemble ?? 0
      pEntry.households += pMenages ?? 0
    } else {
      provincesFromKml.set(provinceCode, {
        code: provinceCode,
        regionCode: regionCode,
        name: nomFr, // will be overwritten from existing catalog
        population: pEnsemble ?? 0,
        households: pMenages ?? 0,
      })
    }
  }

  console.log(`   ✅ ${features.length} features created (${errorCount} errors)`)

  // Build regions array — use existing catalog names where available
  const regions = [...regionsFromKml.values()].map((r) => {
    const existing = existingRegionsMap.get(r.code)
    return {
      code: r.code,
      name: existing?.name || r.name,
      nameAr: existing?.nameAr || r.name,
      nameFr: existing?.nameFr || '',
      regionCode: r.code,
      provinceCode: null,
      population: existing?.population || r.population,
      households: existing?.households || r.households,
      foreigners: existing?.foreigners || null,
    }
  })

  // Sort regions by code
  regions.sort((a, b) => a.code.localeCompare(b.code))

  // Build provinces array — use existing catalog names where available
  const provinces = [...provincesFromKml.values()].map((p) => {
    const existing = existingProvincesMap.get(p.code)
    return {
      code: p.code,
      name: existing?.name || p.name,
      nameAr: existing?.nameAr || p.name,
      nameFr: existing?.nameFr || '',
      regionCode: p.regionCode,
      provinceCode: p.code,
      population: existing?.population || p.population,
      households: existing?.households || p.households,
      foreigners: existing?.foreigners || null,
    }
  })

  // Sort provinces by code
  provinces.sort((a, b) => a.code.localeCompare(b.code))

  // Sort communes by code
  communesCatalog.sort((a, b) => a.code.localeCompare(b.code))

  // ── Write GeoJSON ──────────────────────────────────────────────
  const geojson = {
    type: 'FeatureCollection',
    features: features,
  }

  const geojsonPath = join(ROOT, 'public', 'geography', 'communes.geojson')
  console.log(`💾 Writing communes.geojson (${features.length} features)...`)
  writeFileSync(geojsonPath, JSON.stringify(geojson), 'utf-8')
  const geojsonSize = (Buffer.byteLength(JSON.stringify(geojson)) / 1024 / 1024).toFixed(1)
  console.log(`   Written: ${geojsonSize} MB`)

  // ── Write Catalog ──────────────────────────────────────────────
  const catalog = {
    regions: regions,
    provinces: provinces,
    communes: communesCatalog,
  }

  console.log(`💾 Writing catalog.json (${regions.length} regions, ${provinces.length} provinces, ${communesCatalog.length} communes)...`)
  writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8')
  const catalogSize = (Buffer.byteLength(JSON.stringify(catalog)) / 1024).toFixed(0)
  console.log(`   Written: ${catalogSize} KB`)

  // ── Summary ────────────────────────────────────────────────────
  console.log('\n✅ Conversion complete!')
  console.log(`   Regions: ${regions.length}`)
  console.log(`   Provinces: ${provinces.length}`)
  console.log(`   Communes: ${communesCatalog.length}`)
  console.log(`   Errors: ${errorCount}`)

  // Verify the 4 managed communes
  const managed = ['MA-04-441-0100', 'MA-04-441-0108', 'MA-04-441-0111', 'MA-04-441-0113']
  console.log('\n🔍 Managed communes check:')
  for (const code of managed) {
    const c = communesCatalog.find((c) => c.code === code)
    if (c) {
      console.log(`   ✅ ${code}: ${c.nameFr} (${c.nameAr}) — pop: ${c.population}`)
    } else {
      console.log(`   ❌ ${code}: NOT FOUND`)
    }
  }
}

// Simple GeoJSON type stubs (no import needed)
interface CommuneFeature {
  type: 'Feature'
  properties: Record<string, unknown>
  geometry: { type: 'MultiPolygon'; coordinates: number[][][][] }
}

main()
