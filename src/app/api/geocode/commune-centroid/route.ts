import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'
import { communeNamesMatch } from '@/lib/commune-names'

interface BoundaryFeature {
  properties?: { name?: string; nameAr?: string; nameFr?: string; code?: string }
  geometry?: { type: string; coordinates: any[] } | null
}

let featuresPromise: Promise<BoundaryFeature[]> | null = null

function loadFeatures(): Promise<BoundaryFeature[]> {
  if (!featuresPromise) {
    featuresPromise = readFile(path.join(process.cwd(), 'public', 'geography', 'communes.geojson'), 'utf8')
      .then((content) => (JSON.parse(content) as { features?: BoundaryFeature[] }).features || [])
      .catch(() => [])
  }
  return featuresPromise
}

/** يحسب centroid تقريبي + bounding box للمضلع */
function computeBounds(geometry: { type: string; coordinates: any[] } | null | undefined) {
  if (!geometry) return null
  let points: number[][] = []
  if (geometry.type === 'Polygon') {
    points = geometry.coordinates[0] || []
  } else if (geometry.type === 'MultiPolygon') {
    for (const poly of geometry.coordinates) {
      if (poly && poly[0]) points = points.concat(poly[0])
    }
  }
  if (points.length === 0) return null

  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity
  let sumLat = 0, sumLng = 0
  for (const [lng, lat] of points) {
    if (lat < minLat) minLat = lat
    if (lat > maxLat) maxLat = lat
    if (lng < minLng) minLng = lng
    if (lng > maxLng) maxLng = lng
    sumLat += lat
    sumLng += lng
  }
  return {
    lat: sumLat / points.length,
    lng: sumLng / points.length,
    bounds: [
      [minLat, minLng],
      [maxLat, maxLng],
    ] as [[number, number], [number, number]],
  }
}

/**
 * يرجع المركز + الحدود الجغرافية لجماعة معينة بالاسم.
 * عام (لا مصادقة) — معلومات جغرافية فقط.
 *
 * GET /api/geocode/commune-centroid?commune=سلا
 * → { found, commune, lat, lng, bounds: [[south, west], [north, east]] }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const commune = searchParams.get('commune')
    if (!commune) {
      return NextResponse.json({ error: 'يرجى تحديد اسم الجماعة' }, { status: 400 })
    }

    const features = await loadFeatures()
    const match = features.find((f) => {
      const p = f.properties
      return [p?.nameAr, p?.name, p?.nameFr].filter(Boolean).some((n) => typeof n === 'string' && communeNamesMatch(n, commune))
    })

    if (!match || !match.geometry) {
      return NextResponse.json({ found: false, error: 'لم يتم العثور على الجماعة' }, { status: 404 })
    }

    const computed = computeBounds(match.geometry)
    if (!computed) {
      return NextResponse.json({ found: false, error: 'لا توجد حدود جغرافية للجماعة' }, { status: 404 })
    }

    return NextResponse.json({
      found: true,
      commune: match.properties?.nameAr || match.properties?.name || match.properties?.nameFr || commune,
      code: match.properties?.code,
      lat: computed.lat,
      lng: computed.lng,
      bounds: computed.bounds,
      geometry: match.geometry,
    })
  } catch (error) {
    console.error('commune-centroid error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء البحث' }, { status: 500 })
  }
}
