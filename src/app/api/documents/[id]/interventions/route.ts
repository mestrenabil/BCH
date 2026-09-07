import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessCommune, requireAuth } from '@/lib/auth'

// GET /api/documents/[id]/interventions — Get all interventions linked to a document
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check document exists
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 })
    }

    if (!canAccessCommune(user, document.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا المستند' }, { status: 403 })
    }

    const interventions = await db.interventionDocument.findMany({
      where: { documentId: id },
      include: {
        intervention: {
          select: {
            id: true,
            reference: true,
            type: true,
            date: true,
            statut: true,
            quartier: true,
            commune: true,
            agentNom: true,
            description: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    // Filter by commune if needed
    const filtered = interventions.filter((item) => canAccessCommune(user, item.intervention.commune))

    return NextResponse.json({ interventions: filtered })
  } catch (error) {
    console.error('GET document interventions error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل التدخلات' }, { status: 500 })
  }
}
