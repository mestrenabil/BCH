import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { getTerritoryFilterFromValue, isCommuneInTerritoryScope } from '@/lib/territory-scope'
import { ensureComplaintDossier } from '@/lib/vigilance-links'

const INTERVENTION_TYPES = new Set(['DERATISATION', 'DESINSECTISATION', 'DESINFECTION', 'ENVIRONMENT'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const statut = searchParams.get('statut')
    const type = searchParams.get('type')
    const search = searchParams.get('search')

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    const year = Number(searchParams.get('year'))
    if (Number.isInteger(year) && year >= 2020 && year <= 2100) where.createdAt = { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
    if (statut) where.statut = statut
    if (type) where.type = type
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { nomCitoyen: { contains: search } },
        { telephone: { contains: search } },
        { adresse: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const complaints = await db.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    })

    const total = await db.complaint.count({ where })
    const dossierMap = new Map<string, { id: string; reference: string; status: string; dueDate: Date | null }>()
    if (complaints.length > 0) {
      const dossiers = await db.dossier.findMany({
        where: { complaintId: { in: complaints.map((complaint) => complaint.id) } },
        select: { id: true, reference: true, status: true, dueDate: true, complaintId: true },
      })
      for (const dossier of dossiers) {
        if (dossier.complaintId) dossierMap.set(dossier.complaintId, dossier)
      }
    }

    return NextResponse.json({ complaints: complaints.map((complaint) => ({ ...complaint, dossier: dossierMap.get(complaint.id) || null })), total })
  } catch (error) {
    console.error('GET complaints error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الشكايات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { nomCitoyen, telephone, adresse, quartier, commune, type, description, priorite, observations, territoryFilter } = body

    if (!nomCitoyen || !type || !description) {
      return NextResponse.json({ error: 'يرجى ملء جميع الحقول المطلوبة' }, { status: 400 })
    }
    if (!INTERVENTION_TYPES.has(String(type))) {
      return NextResponse.json({ error: 'نوع الشكاية يجب أن يطابق نوع تدخل معتمداً' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء الشكاية' }, { status: 400 })
    }
    if (user.commune === 'ALL' && !isCommuneInTerritoryScope(enforcedCommune, getTerritoryFilterFromValue(territoryFilter))) {
      return NextResponse.json({ error: 'الجماعة المختارة خارج النطاق الترابي المحدد' }, { status: 403 })
    }

    // Generate reference: PL-YYYY-NNN
    const year = new Date().getFullYear()
    const count = await db.complaint.count({
      where: { reference: { startsWith: `PL-${year}-` } },
    })
    const reference = `PL-${year}-${String(count + 1).padStart(3, '0')}`

    const complaint = await db.complaint.create({
      data: {
        reference,
        nomCitoyen,
        telephone: telephone || null,
        adresse: adresse || '',
        quartier: quartier || null,
        commune: enforcedCommune,
        type,
        description,
        priorite: priorite || 'NORMALE',
        observations: observations || null,
      },
    })
    try {
      await ensureComplaintDossier(complaint, user)
    } catch (linkError) {
      console.error('Create complaint dossier error:', linkError)
    }

    return NextResponse.json(complaint, { status: 201 })
  } catch (error) {
    console.error('POST complaints error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الشكاية' }, { status: 500 })
  }
}
