import crypto from 'crypto'
import path from 'path'
import { mkdir, writeFile } from 'fs/promises'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import {
  getSecureDocumentDirectory,
  getSecureDocumentPath,
  isAllowedDocument,
  MAX_DOCUMENT_SIZE_BYTES,
  sanitizeDocumentFileName,
} from '@/lib/document-storage'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'يرجى اختيار ملف صالح' }, { status: 400 })
    }

    const safeFileName = sanitizeDocumentFileName(file.name)
    if (!safeFileName || !isAllowedDocument(safeFileName, file.type || undefined)) {
      return NextResponse.json({ error: 'نوع الملف غير مدعوم' }, { status: 400 })
    }

    if (file.size === 0 || file.size > MAX_DOCUMENT_SIZE_BYTES) {
      return NextResponse.json({ error: 'حجم الملف يجب أن يكون بين 1 بايت و10 ميغابايت' }, { status: 400 })
    }

    const storedFileName = `${crypto.randomUUID()}${path.extname(safeFileName).toLowerCase()}`
    const storedFilePath = getSecureDocumentPath(storedFileName)
    if (!storedFilePath) {
      return NextResponse.json({ error: 'مسار التخزين غير صالح' }, { status: 400 })
    }

    await mkdir(getSecureDocumentDirectory(), { recursive: true })
    await writeFile(storedFilePath, Buffer.from(await file.arrayBuffer()), { flag: 'wx' })

    return NextResponse.json({
      nomFichier: safeFileName,
      cheminFichier: storedFileName,
      typeFichier: file.type || 'application/octet-stream',
      tailleFichier: file.size,
    }, { status: 201 })
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json({ error: 'فشل في رفع الملف' }, { status: 500 })
  }
}
