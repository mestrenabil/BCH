import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { readFile } from 'fs/promises'
import path from 'path'

// GET /api/documents/download/[id] — Serve/download a document file
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 })
    }

    const filePath = path.join(process.cwd(), 'public', document.cheminFichier)
    const fileBuffer = await readFile(filePath)

    // Determine content type
    const ext = document.nomFichier.split('.').pop()?.toLowerCase() || ''
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
    }

    const contentType = contentTypes[ext] || 'application/octet-stream'

    // For PDFs, display inline; for others, force download
    const disposition = ext === 'pdf' ? 'inline' : 'attachment'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `${disposition}; filename="${encodeURIComponent(document.nomFichier)}"`,
        'Content-Length': fileBuffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json({ error: 'فشل في تحميل الملف' }, { status: 500 })
  }
}
