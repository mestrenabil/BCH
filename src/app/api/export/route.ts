import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getCommuneFilter } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const year = searchParams.get('year')
    const requestedCommune = searchParams.get('commune')
    const type = searchParams.get('type')

    // Enforce commune filter based on user's role
    const communeFilter = getCommuneFilter(user, requestedCommune)

    const where: Record<string, unknown> = {}
    if (year) {
      const start = new Date(parseInt(year), 0, 1)
      const end = new Date(parseInt(year), 11, 31)
      where.date = { gte: start, lte: end }
    }
    if (communeFilter) where.commune = communeFilter
    if (type) where.type = type

    const interventions = await db.intervention.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        materials: {
          include: {
            product: { select: { nom: true, unite: true } }
          }
        }
      }
    })

    const TYPE_LABELS: Record<string, string> = {
      DERATISATION: 'مكافحة القوارض',
      DESINSECTISATION: 'مكافحة الحشرات',
      DESINFECTION: 'التطهير والتعقيم',
    }
    const STATUT_LABELS: Record<string, string> = {
      PLANIFIEE: 'مبرمجة',
      EN_COURS: 'جارية',
      TERMINEE: 'منجزة',
      ANNULEE: 'ملغاة',
    }

    if (format === 'csv') {
      const BOM = '\uFEFF'
      const headers = ['المرجع', 'النوع', 'التاريخ', 'الحي', 'العنوان', 'الجماعة', 'الحالة', 'العون', 'المساحة', 'الملاحظات', 'المواد المستعملة']
      const rows = interventions.map(int => {
        const materialsStr = int.materials.map(m => `${m.product.nom}(${m.quantity} ${m.product.unite})`).join(' | ')
        return [
          int.reference,
          TYPE_LABELS[int.type] || int.type,
          new Date(int.date).toLocaleDateString('ar-MA'),
          int.quartier,
          int.adresse,
          int.commune,
          STATUT_LABELS[int.statut] || int.statut,
          int.agentNom,
          int.superficie,
          int.observations,
          materialsStr || int.produitUtilise,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`)
      })

      const csv = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="interventions-${year || 'all'}${communeFilter ? '-' + communeFilter : ''}.csv"`,
        },
      })
    }

    // JSON format
    return NextResponse.json({ interventions, total: interventions.length })
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء التصدير' }, { status: 500 })
  }
}
