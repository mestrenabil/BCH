import { NextRequest, NextResponse } from 'next/server'
import { getCommuneForPoint } from '@/lib/commune-boundaries'
import { loadTerritoryCatalog } from '@/lib/geography'
import { db } from '@/lib/db'

function distanceInMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const earthRadius = 6_371_000
  const toRadians = (value: number) => value * Math.PI / 180
  const deltaLat = toRadians(lat2 - lat1)
  const deltaLng = toRadians(lng2 - lng1)
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLng / 2) ** 2
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * بحث عكسي جغرافي: من إحداثيات (lat/lng) → الجماعة + الإقليم + الجهة.
 *
 * الاستعمال:
 *   GET /api/geocode/reverse?lat=34.05&lng=-6.8
 *
 * الاستجابة:
 *   200 { commune, code, nameFr, region, province, regionCode, provinceCode }
 *   404 { error } — النقطة خارج أي جماعة معروفة
 *
 * عام (لا يتطلب مصادقة) لأنه معلومات جغرافية فقط.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = parseFloat(searchParams.get('lat') || '')
    const lng = parseFloat(searchParams.get('lng') || '')

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: 'إحداثيات غير صالحة' }, { status: 400 })
    }

    const result = await getCommuneForPoint(lat, lng)
    if (!result || !result.commune) {
      return NextResponse.json({ error: 'النقطة خارج أي جماعة معروفة', found: false }, { status: 404 })
    }

    // إثراء النتيجة بأسماء الجهة والإقليم من الكتالوج
    let region: string | undefined
    let province: string | undefined
    try {
      const catalog = await loadTerritoryCatalog()
      if (catalog && result.regionCode) {
        const r = catalog.regions.find((x) => x.code === result.regionCode)
        if (r) region = r.nameAr || r.name || r.nameFr
      }
      if (catalog && result.provinceCode) {
        const p = catalog.provinces.find((x) => x.code === result.provinceCode)
        if (p) province = p.nameAr || p.name || p.nameFr
      }
    } catch {
      // تجاهل — الكتالوج غير ضروري للنتيجة الأساسية
    }

    // اختيار أقرب حي مسجل داخل الجماعة نفسها لإكمال النماذج آلياً.
    const quartiers = await db.quartier.findMany({
      where: { commune: result.commune },
      select: { nom: true, latitude: true, longitude: true },
    })
    const nearestQuartier = quartiers
      .filter((quartier) => Number.isFinite(quartier.latitude) && Number.isFinite(quartier.longitude) && (quartier.latitude !== 0 || quartier.longitude !== 0))
      .map((quartier) => ({ ...quartier, distance: distanceInMeters(lat, lng, quartier.latitude, quartier.longitude) }))
      .sort((first, second) => first.distance - second.distance)[0]

    return NextResponse.json({
      found: true,
      commune: result.commune,
      quartier: nearestQuartier?.nom || null,
      quartierDistanceMeters: nearestQuartier ? Math.round(nearestQuartier.distance) : null,
      code: result.code,
      nameFr: result.nameFr,
      region,
      province,
      regionCode: result.regionCode,
      provinceCode: result.provinceCode,
      latitude: lat,
      longitude: lng,
    })
  } catch (error) {
    console.error('reverse geocode error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء البحث الجغرافي' }, { status: 500 })
  }
}
