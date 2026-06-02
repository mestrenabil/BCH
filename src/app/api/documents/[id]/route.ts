import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/documents/[id] — Get single document
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 })
    }
    return NextResponse.json(document)
  } catch (error) {
    console.error('Error fetching document:', error)
    return NextResponse.json({ error: 'فشل في تحميل المستند' }, { status: 500 })
  }
}

// PUT /api/documents/[id] — Update document
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { titre, description, categorie, commune, reference, dateDocument } = body

    const document = await db.document.update({
      where: { id },
      data: {
        ...(titre !== undefined && { titre }),
        ...(description !== undefined && { description }),
        ...(categorie !== undefined && { categorie }),
        ...(commune !== undefined && { commune }),
        ...(reference !== undefined && { reference }),
        ...(dateDocument !== undefined && { dateDocument: dateDocument ? new Date(dateDocument) : null }),
      },
    })

    return NextResponse.json(document)
  } catch (error) {
    console.error('Error updating document:', error)
    return NextResponse.json({ error: 'فشل في تحديث المستند' }, { status: 500 })
  }
}

// DELETE /api/documents/[id] — Delete document
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    // Get document to delete the file too
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 })
    }

    // Delete file from disk
    try {
      const fs = await import('fs/promises')
      const path = await import('path')
      const filePath = path.join(process.cwd(), 'public', document.cheminFichier)
      await fs.unlink(filePath).catch(() => { /* file may already be deleted */ })
    } catch { /* ignore file deletion errors */ }

    // Delete from database
    await db.document.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting document:', error)
    return NextResponse.json({ error: 'فشل في حذف المستند' }, { status: 500 })
  }
}
