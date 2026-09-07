import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { type, data, territoryFilter } = body as { type: 'interventions' | 'agents' | 'products'; data: Record<string, string>[]; territoryFilter?: unknown }

    if (!type || !data || !Array.isArray(data)) {
      return NextResponse.json({ error: 'البيانات غير صالحة' }, { status: 400 })
    }

    if (!['interventions', 'agents', 'products'].includes(type)) {
      return NextResponse.json({ error: 'نوع البيانات غير مدعوم' }, { status: 400 })
    }

    const territorialScope = getTerritoryFilterFromValue(territoryFilter)
    const resolveImportedCommune = (requestedCommune: string): string | null => {
      const commune = resolveRecordCommune(user, requestedCommune)
      if (!commune) return null
      if (user.commune === 'ALL' && !isCommuneInTerritoryScope(commune, territorialScope)) return null
      return commune
    }
    let success = 0
    let failed = 0
    const errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      try {
        if (type === 'interventions') {
          // Validate required fields
          if (!row.type || !row.date || !row.reference) {
            errors.push(`صف ${i + 1}: حقول مطلوبة مفقودة (type, date, reference)`)
            failed++
            continue
          }

          const commune = resolveImportedCommune(row.commune || '')
          if (!commune) {
            errors.push(`صف ${i + 1}: يجب تحديد جماعة ضمن نطاق حسابك`)
            failed++
            continue
          }

          // Check for duplicate reference
          const existing = await db.intervention.findUnique({ where: { reference: row.reference } })
          if (existing) {
            errors.push(`صف ${i + 1}: المرجع '${row.reference}' موجود مسبقاً`)
            failed++
            continue
          }

          await db.intervention.create({
            data: {
              type: row.type,
              date: new Date(row.date),
              quartier: row.quartier || '',
              adresse: row.adresse || '',
              commune,
              latitude: parseFloat(row.latitude) || 0,
              longitude: parseFloat(row.longitude) || 0,
              statut: row.statut || 'PLANIFIEE',
              description: row.description || '',
              agentNom: row.agentNom || '',
              produitUtilise: row.produitUtilise || '',
              quantite: row.quantite || '',
              superficie: row.superficie || '',
              nombrePrestations: parseInt(row.nombrePrestations) || 1,
              observations: row.observations || '',
              heureDebut: row.heureDebut || null,
              heureFin: row.heureFin || null,
              coutMainOeuvre: row.coutMainOeuvre ? parseFloat(row.coutMainOeuvre) : null,
              coutMateriaux: row.coutMateriaux ? parseFloat(row.coutMateriaux) : null,
              coutTotal: row.coutTotal ? parseFloat(row.coutTotal) : null,
              reference: row.reference,
            },
          })
          success++
        } else if (type === 'agents') {
          if (!row.nom) {
            errors.push(`صف ${i + 1}: اسم العون مطلوب`)
            failed++
            continue
          }

          const commune = resolveImportedCommune(row.commune || '')
          if (!commune) {
            errors.push(`صف ${i + 1}: يجب تحديد جماعة ضمن نطاق حسابك`)
            failed++
            continue
          }

          await db.agent.create({
            data: {
              nom: row.nom,
              prenom: row.prenom || '',
              telephone: row.telephone || '',
              commune,
              fonction: row.fonction || 'عون صحية',
              actif: row.actif !== undefined ? row.actif === 'true' || row.actif === '1' : true,
            },
          })
          success++
        } else if (type === 'products') {
          if (!row.nom || !row.reference) {
            errors.push(`صف ${i + 1}: اسم المنتج والمرجع مطلوبان`)
            failed++
            continue
          }

          const commune = resolveImportedCommune(row.commune || '')
          if (!commune) {
            errors.push(`صف ${i + 1}: يجب تحديد جماعة ضمن نطاق حسابك`)
            failed++
            continue
          }

          // Check for duplicate reference
          const existing = await db.product.findUnique({ where: { reference: row.reference } })
          if (existing) {
            errors.push(`صف ${i + 1}: مرجع المنتج '${row.reference}' موجود مسبقاً`)
            failed++
            continue
          }

          await db.product.create({
            data: {
              nom: row.nom,
              categorie: row.categorie || 'GENERAL',
              commune,
              unite: row.unite || 'لتر',
              quantiteStock: parseInt(row.quantiteStock) || 0,
              seuilAlerte: parseInt(row.seuilAlerte) || 10,
              prixUnitaire: parseFloat(row.prixUnitaire) || 0,
              fournisseur: row.fournisseur || '',
              description: row.description || '',
              reference: row.reference,
              dateExpiration: row.dateExpiration ? new Date(row.dateExpiration) : null,
            },
          })
          success++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'خطأ غير معروف'
        errors.push(`صف ${i + 1}: ${msg}`)
        failed++
      }
    }

    return NextResponse.json({
      success,
      failed,
      total: data.length,
      errors: errors.slice(0, 50), // Limit error messages
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء الاستيراد' }, { status: 500 })
  }
}
