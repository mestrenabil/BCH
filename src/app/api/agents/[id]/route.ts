import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params
    const agent = await db.agent.findUnique({ where: { id } })
    if (!agent) return NextResponse.json({ error: 'العون غير موجود' }, { status: 404 })

    // Non-admin users can only view agents from their own commune
    if (user.commune !== 'ALL' && agent.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا العون' }, { status: 403 })
    }

    return NextResponse.json(agent)
  } catch (error) {
    console.error('GET agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check the agent belongs to user's commune
    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'العون غير موجود' }, { status: 404 })
    if (user.commune !== 'ALL' && existing.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية تعديل هذا العون' }, { status: 403 })
    }

    const body = await request.json()
    const { nom, prenom, telephone, commune, fonction, actif } = body

    // Non-admin users cannot change the commune
    const enforcedCommune = user.commune !== 'ALL' ? user.commune : (commune !== undefined ? commune : existing.commune)

    const agent = await db.agent.update({
      where: { id },
      data: {
        ...(nom !== undefined && { nom }),
        ...(prenom !== undefined && { prenom }),
        ...(telephone !== undefined && { telephone }),
        commune: enforcedCommune,
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
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { id } = await params

    // Check the agent belongs to user's commune
    const existing = await db.agent.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'العون غير موجود' }, { status: 404 })
    if (user.commune !== 'ALL' && existing.commune !== user.commune) {
      return NextResponse.json({ error: 'ليس لديك صلاحية حذف هذا العون' }, { status: 403 })
    }

    await db.agent.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE agent error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء حذف العون' }, { status: 500 })
  }
}
