import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) return NextResponse.json({ error: 'العون غير موجود' }, { status: 404 })
    return NextResponse.json(agent)
  } catch (error) {
    console.error('GET agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { nom, prenom, telephone, commune, fonction, actif } = body

    const agent = await db.agent.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(prenom !== undefined && { prenom }),
        ...(telephone !== undefined && { telephone }),
        ...(commune !== undefined && { commune }),
        ...(fonction !== undefined && { fonction }),
        ...(actif !== undefined && { actif }),
      },
    })

    return NextResponse.json(agent)
  } catch (error) {
    console.error('PUT agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحديث العون' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await db.agent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف العون' }, { status: 500 })
  }
}
