import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const intervention = await db.intervention.findUnique({ where: { id } })
    if (!intervention) {
      return NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 })
    }
    return NextResponse.json(intervention)
  } catch (error) {
    console.error('GET intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل البيانات' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const intervention = await db.intervention.update({
      where: { id },
      data: {
        ...body,
        date: body.date ? new Date(body.date) : undefined,
        latitude: body.latitude ? parseFloat(body.latitude) : undefined,
        longitude: body.longitude ? parseFloat(body.longitude) : undefined,
        nombrePrestations: body.nombrePrestations ? parseInt(body.nombrePrestations) : undefined,
      },
    })
    return NextResponse.json(intervention)
  } catch (error) {
    console.error('PUT intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث التدخل' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.intervention.delete({ where: { id } })
    return NextResponse.json({ message: 'تم حذف التدخل بنجاح' })
  } catch (error) {
    console.error('DELETE intervention error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف التدخل' }, { status: 500 })
  }
}
