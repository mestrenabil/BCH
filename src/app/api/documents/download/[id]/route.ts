import { access, readFile } from 'fs/promises'
import { constants } from 'fs'
import path from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { getDocumentFilePath } from '@/lib/document-storage'

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
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const document = await db.document.findUnique({ where: { id } })
    if (!document) {
      return NextResponse.json({ error: 'المستند غير موجود' }, { status: 404 })
    }
    if (!canAccessCommune(authResult.user, document.commune)) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا المستند' }, { status: 403 })
    }

    const filePath = getDocumentFilePath(document.cheminFichier)
    if (!filePath) {
      return NextResponse.json({ error: 'مسار الملف غير صالح' }, { status: 400 })
    }

    try {
      await access(filePath, constants.R_OK)
    } catch {
      return NextResponse.json({ error: 'الملف غير موجود على الخادم — يرجى إعادة رفعه' }, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)
    const extension = path.extname(document.nomFichier).slice(1).toLowerCase()
    const contentType = contentTypes[extension] || 'application/octet-stream'

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.nomFichier)}`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Error serving document:', error)
    return NextResponse.json({ error: 'فشل في تحميل الملف' }, { status: 500 })
  }
}
