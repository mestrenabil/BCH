import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const argumentsByName = new Map()
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsByName.set(process.argv[index], process.argv[index + 1])
}

const requiredArgument = (name) => {
  const value = argumentsByName.get(name)
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

const decodeXml = (value) => value
  .replaceAll('&amp;', '&')
  .replaceAll('&lt;', '<')
  .replaceAll('&gt;', '>')
  .replaceAll('&quot;', '"')
  .replaceAll('&#39;', "'")
  .trim()

const field = (placemark, name) => {
  const match = placemark.match(new RegExp(`<SimpleData\\s+name="${name}">([\\s\\S]*?)<\\/SimpleData>`))
  return match ? decodeXml(match[1]) : ''
}

const numberField = (placemark, name) => {
  const rawValue = field(placemark, name)
  if (!rawValue) return null
  const value = Number(rawValue)
  return Number.isFinite(value) ? Math.round(value) : null
}

const communeOverrides = {
  'MA-04-441-0111': { households: 5188, foreigners: 50 },
}

const ring = (coordinates) => coordinates
  .trim()
  .split(/\s+/)
  .map((point) => point.split(',').slice(0, 2).map(Number))
  .filter(([longitude, latitude]) => Number.isFinite(longitude) && Number.isFinite(latitude))
  .map(([longitude, latitude]) => [
    Number(longitude.toFixed(6)),
    Number(latitude.toFixed(6)),
  ])

const geometry = (placemark) => {
  const polygons = [...placemark.matchAll(/<Polygon>([\s\S]*?)<\/Polygon>/g)]
    .map((polygon) => [...polygon[1].matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)]
      .map((coordinates) => ring(coordinates[1]))
      .filter((coordinates) => coordinates.length >= 4))
    .filter((coordinates) => coordinates.length > 0)

  if (polygons.length === 0) return null
  if (polygons.length === 1) return { type: 'Polygon', coordinates: polygons[0] }
  return { type: 'MultiPolygon', coordinates: polygons }
}

const codeParts = (code) => code.split('-').filter(Boolean)

const convert = async ({ inputPath, level }) => {
  const source = await readFile(inputPath, 'utf8')
  const placemarks = source.match(/<Placemark>[\s\S]*?<\/Placemark>/g) || []
  const features = placemarks.map((placemark) => {
    const code = field(placemark, 'ISO')
    const polygon = geometry(placemark)
    if (!code || !polygon) return null

    const parts = codeParts(code)
    const properties = {
      code,
      name: field(placemark, 'nom_ar') || field(placemark, 'nom_fr'),
      nameAr: field(placemark, 'nom_ar'),
      nameFr: field(placemark, 'nom_fr'),
      population: numberField(placemark, 'P_ensemble'),
      households: numberField(placemark, 'P_menages'),
      regionCode: parts.slice(0, 2).join('-'),
      provinceCode: parts.length >= 3 ? parts.slice(0, 3).join('-') : null,
      level,
    }

    if (level === 'commune' && communeOverrides[code]) {
      Object.assign(properties, communeOverrides[code])
    }

    return { type: 'Feature', properties, geometry: polygon }
  }).filter(Boolean)

  if (features.length === 0) throw new Error(`No valid ${level} features found in ${inputPath}`)
  return { type: 'FeatureCollection', features }
}

const outputDirectory = resolve(requiredArgument('--output'))
const regions = await convert({ inputPath: requiredArgument('--regions'), level: 'region' })
const provinces = await convert({ inputPath: requiredArgument('--provinces'), level: 'province' })
const communes = await convert({ inputPath: requiredArgument('--communes'), level: 'commune' })

const catalogEntry = (feature) => ({
  code: feature.properties.code,
  name: feature.properties.name,
  nameAr: feature.properties.nameAr,
  nameFr: feature.properties.nameFr,
  regionCode: feature.properties.regionCode,
  provinceCode: feature.properties.provinceCode,
  population: feature.properties.population,
  households: feature.properties.households,
  foreigners: feature.properties.foreigners ?? null,
})

const catalog = {
  regions: regions.features.map(catalogEntry),
  provinces: provinces.features.map(catalogEntry),
  communes: communes.features.map(catalogEntry),
}

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(resolve(outputDirectory, 'regions.geojson'), JSON.stringify(regions)),
  writeFile(resolve(outputDirectory, 'provinces.geojson'), JSON.stringify(provinces)),
  writeFile(resolve(outputDirectory, 'communes.geojson'), JSON.stringify(communes)),
  writeFile(resolve(outputDirectory, 'catalog.json'), JSON.stringify(catalog)),
])

console.log(JSON.stringify({
  regions: regions.features.length,
  provinces: provinces.features.length,
  communes: communes.features.length,
  outputDirectory,
}, null, 2))
