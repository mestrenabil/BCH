import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

// GET /api/interventions/[id]/documents — Get all documents linked to an intervention
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check intervention exists and user has access
    const intervention = await db.intervention.findUnique({ where: { id } })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    if (user.commune !== 'ALL' && intervention.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا التدخل' }, { status: 403 })
    }

    const documents = await db.interventionDocument.findMany({
      where: { interventionId: id },
      include: {
        document: {
          select: {
            id: true,
            titre: true,
            nomFichier: true,
            typeFichier: true,
            tailleFichier: true,
            cheminFichier: true,
            categorie: true,
            commune: true,
            reference: true,
            dateDocument: true,
            uploadedBy: true,
            createdAt: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ documents })
  } catch (error) {
    console.error('GET intervention documents error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل المستندات' }, { status: 500 })
  }
}

// POST /api/interventions/[id]/documents — Link a document to an intervention
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check intervention exists and user has access
    const intervention = await db.intervention.findUnique({ where: { id } })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    if (user.commune !== 'ALL' && intervention.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا التدخل' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'معرف المستند مطلوب' }, { status: 400 })
    }

    // Check document exists
    const document = await db.document.findUnique({ where: { id: documentId } })
    if (!document) {
      return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 })
    }

    // Use upsert to avoid duplicates
    const link = await db.interventionDocument.upsert({
      where: {
        interventionId_documentId: { interventionId: id, documentId }
      },
      create: { interventionId: id, documentId },
      update: {},
      include: {
        document: {
          select: {
            id: true,
            titre: true,
            nomFichier: true,
            typeFichier: true,
            tailleFichier: true,
            cheminFichier: true,
          }
        }
      }
    })

    return NextResponse.json(link, { status: 201 })
  } catch (error) {
    console.error('POST intervention document link error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء ربط المستند بالتدخل' }, { status: 500 })
  }
}

// DELETE /api/interventions/[id]/documents — Unlink a document from an intervention
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check intervention exists and user has access
    const intervention = await db.intervention.findUnique({ where: { id } })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    if (user.commune !== 'ALL' && intervention.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا التدخل' }, { status: 403 })
    }

    const body = await request.json()
    const { documentId } = body

    if (!documentId) {
      return NextResponse.json({ error: 'معرف المستند مطلوب' }, { status: 400 })
    }

    await db.interventionDocument.deleteMany({
      where: { interventionId: id, documentId }
    })

    return NextResponse.json({ message: 'تم فك الارتباط بنجاح' })
  } catch (error) {
    console.error('DELETE intervention document link error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء فك الارتباط' }, { status: 500 })
  }
}
