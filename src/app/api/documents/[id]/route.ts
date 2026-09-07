import { unlink } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessCommune, isAdmin, requireAuth, type AuthUser } from '@/lib/auth'
import { getDocumentFilePath } from '@/lib/document-storage'

async function getAuthorizedDocument(user: AuthUser, id: string) {
  const document = await db.document.findUnique({ where: { id } })
  if (!document) return { error: NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 }) }
  if (!canAccessCommune(user, document.commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا المستند' }, { status: 403 }) }
  }
  return { document }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const accessResult = await getAuthorizedDocument(authResult.user, id)
    if ('error' in accessResult) return accessResult.error

    const document = await db.document.findUnique({
      where: { id },
      include: {
        interventions: {
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
              }
            }
          }
        }
      }
    })

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'فشل في تحميل المستند' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const accessResult = await getAuthorizedDocument(user, id)
    if ('error' in accessResult) return accessResult.error
    const existingDocument = accessResult.document

    if (!canAccessCommune(user, existingDocument.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا المستند' }, { status: 403 })
    }

    const body = await request.json()
    const { titre, description, categorie, commune, reference, dateDocument } = body
    const documentDate = dateDocument === undefined ? undefined : (dateDocument ? new Date(dateDocument) : null)

    if (documentDate instanceof Date && Number.isNaN(documentDate.getTime())) {
      return NextResponse.json({ error: 'تاريخ المستند غير صالح' }, { status: 400 })
    }

    const document = await db.document.update({
      where: { id },
      data: {
        ...(titre !== undefined && { titre: String(titre).trim() }),
        ...(description !== undefined && { description: String(description) }),
        ...(categorie !== undefined && { categorie: String(categorie) }),
        ...(reference !== undefined && { reference: String(reference) }),
        ...(dateDocument !== undefined && { dateDocument: documentDate }),
        ...(isAdmin(user) && commune !== undefined && { commune: String(commune) }),
      },
    })

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json({ error: 'فشل في تحديث المستند' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const accessResult = await getAuthorizedDocument(user, id)
    if ('error' in accessResult) return accessResult.error
    const document = accessResult.document

    if (!canAccessCommune(user, document.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذا المستند' }, { status: 403 })
    }

    const filePath = getDocumentFilePath(document.cheminFichier)
    if (filePath) await unlink(filePath).catch(() => undefined)

    await db.document.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'فشل في حذف المستند' }, { status: 500 })
  }
}
