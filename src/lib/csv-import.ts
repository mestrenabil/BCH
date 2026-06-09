// CSV Import utility for interventions

export interface CSVImportResult {
  success: number
  errors: number
  total: number
  errorMessages: string[]
}

export interface CSVRow {
  [key: string]: string
}

export function parseCSV(csvText: string): CSVRow[] {
  const lines = csvText.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
  const rows: CSVRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''))
    const row: CSVRow = {}
    headers.forEach((header, idx) => {
      row[header] = values[idx] || ''
    })
    rows.push(row)
  }

  return rows
}

export function mapCSVRowToIntervention(row: CSVRow): {
  type: string
  date: string
  quartier: string
  adresse: string
  commune: string
  latitude: number
  longitude: number
  statut: string
  description: string
  agentNom: string
  produitUtilise: string
  quantite: string
  superficie: string
} | null {
  try {
    // Map CSV columns to intervention fields
    // Support both Arabic and French column names
    const type = row['type'] || row['النوع'] || 'DERATISATION'
    const date = row['date'] || row['التاريخ'] || new Date().toISOString().split('T')[0]
    const quartier = row['quartier'] || row['الحي'] || ''
    const adresse = row['adresse'] || row['العنوان'] || ''
    const commune = row['commune'] || row['الجماعة'] || 'سلا'
    const latitude = parseFloat(row['latitude'] || row['خط العرض'] || '34.05')
    const longitude = parseFloat(row['longitude'] || row['خط الطول'] || '-6.80')
    const statut = row['statut'] || row['الحالة'] || 'PLANIFIEE'
    const description = row['description'] || row['الوصف'] || ''
    const agentNom = row['agent'] || row['العون'] || ''
    const produitUtilise = row['produit'] || row['المنتج'] || ''
    const quantite = row['quantite'] || row['الكمية'] || ''
    const superficie = row['superficie'] || row['المساحة'] || ''

    if (!quartier && !adresse) return null

    // Validate type
    const validTypes = ['DERATISATION', 'DESINSECTISATION', 'DESINFECTION']
    const normalizedType = validTypes.includes(type.toUpperCase()) ? type.toUpperCase() : 'DERATISATION'

    // Validate statut
    const validStatuses = ['PLANIFIEE', 'EN_COURS', 'TERMINEE', 'ANNULEE']
    const normalizedStatut = validStatuses.includes(statut.toUpperCase()) ? statut.toUpperCase() : 'PLANIFIEE'

    return {
      type: normalizedType,
      date,
      quartier,
      adresse,
      commune,
      latitude: isNaN(latitude) ? 34.05 : latitude,
      longitude: isNaN(longitude) ? -6.80 : longitude,
      statut: normalizedStatut,
      description,
      agentNom,
      produitUtilise,
      quantite,
      superficie,
    }
  } catch {
    return null
  }
}

export async function importCSVData(csvText: string, onProgress?: (current: number, total: number) => void): Promise<CSVImportResult> {
  const rows = parseCSV(csvText)
  let success = 0
  let errors = 0
  const errorMessages: string[] = []

  for (let i = 0; i < rows.length; i++) {
    if (onProgress) onProgress(i + 1, rows.length)

    const intervention = mapCSVRowToIntervention(rows[i])
    if (!intervention) {
      errors++
      errorMessages.push(`صف ${i + 2}: بيانات غير كافية`)
      continue
    }

    try {
      const res = await fetch('/api/interventions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(intervention),
      })
      if (res.ok) {
        success++
      } else {
        errors++
        const data = await res.json().catch(() => ({}))
        errorMessages.push(`صف ${i + 2}: ${data.error || 'خطأ غير معروف'}`)
      }
    } catch {
      errors++
      errorMessages.push(`صف ${i + 2}: خطأ في الاتصال`)
    }
  }

  return { success, errors, total: rows.length, errorMessages }
}
