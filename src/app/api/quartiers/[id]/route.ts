import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const quartier = await db.quartier.findUnique({ where: { id } })
    if (!quartier) return NextResponse.json({ error: 'الحي غير موجود' }, { status: 404 })
    return NextResponse.json(quartier)
  } catch (error) {
    console.error('GET quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nom, commune, latitude, longitude } = body

    // If renaming, check uniqueness
    if (nom) {
      const existing = await db.quartier.findFirst({ where: { nom, id: { not: id } } })
      if (existing) {
        return NextResponse.json({ error: 'حي بهذا الاسم موجود مسبقاً' }, { status: 409 })
      }
    }

    const quartier = await db.quartier.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(commune !== undefined && { commune }),
        ...(latitude !== undefined && { latitude: parseFloat(latitude) || 0 }),
        ...(longitude !== undefined && { longitude: parseFloat(longitude) || 0 }),
      },
    })

    return NextResponse.json(quartier)
  } catch (error) {
    console.error('PUT quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث الحي' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    // Check if quartier is used in any intervention
    const interventionsCount = await db.intervention.count({
      where: { quartier: (await db.quartier.findUnique({ where: { id } }))?.nom },
    })

    await db.quartier.delete({ where: { id } })

    return NextResponse.json({ success: true, interventionsAffected: interventionsCount })
  } catch (error) {
    console.error('DELETE quartier error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف الحي' }, { status: 500 })
  }
}
