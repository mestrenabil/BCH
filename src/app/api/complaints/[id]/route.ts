import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const complaint = await db.complaint.findUnique({
      where: { id },
      include: { intervention: true },
    })

    if (!complaint) {
      return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    }

    return NextResponse.json(complaint)
  } catch (error) {
    console.error('GET complaint error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الشكاية' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const body = await request.json()

    const existing = await db.complaint.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}
    const allowedFields = ['nomCitoyen', 'telephone', 'adresse', 'quartier', 'commune', 'type', 'description', 'priorite', 'statut', 'interventionId', 'observations']
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field] === '' ? null : body[field]
      }
    }

    // If statut changed to TRAITEE, set dateTraitement
    if (body.statut === 'TRAITEE' && existing.statut !== 'TRAITEE') {
      updateData.dateTraitement = new Date()
    }

    const complaint = await db.complaint.update({
      where: { id },
      data: updateData,
    })

    return NextResponse.json(complaint)
  } catch (error) {
    console.error('PUT complaint error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الشكاية' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const existing = await db.complaint.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 })
    }

    await db.complaint.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE complaint error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الشكاية' }, { status: 500 })
  }
}
