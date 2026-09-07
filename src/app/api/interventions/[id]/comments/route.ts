import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth, type AuthUser } from '@/lib/auth'

async function getAuthorizedIntervention(user: AuthUser, id: string) {
  const intervention = await db.intervention.findUnique({ where: { id }, select: { commune: true } })
  if (!intervention) return { error: NextResponse.json({ error: 'التدخل غير موجود' }, { status: 404 }) }
  if (!canAccessCommune(user, intervention.commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذا التدخل' }, { status: 403 }) }
  }
  return { intervention }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const accessResult = await getAuthorizedIntervention(authResult.user, id)
    if ('error' in accessResult) return accessResult.error

    const comments = await db.interventionComment.findMany({
      where: { interventionId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ comments })
  } catch (error) {
    console.error('Get intervention comments error:', error)
    return NextResponse.json({ error: 'فشل في تحميل التعليقات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error

    const { id } = await params
    const accessResult = await getAuthorizedIntervention(authResult.user, id)
    if ('error' in accessResult) return accessResult.error

    const body = await request.json()
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const type = ['COMMENT', 'NOTE', 'STATUS_CHANGE'].includes(body.type) ? body.type : 'COMMENT'
    if (!content || content.length > 2000) {
      return NextResponse.json({ error: 'محتوى التعليق غير صالح' }, { status: 400 })
    }

    const comment = await db.interventionComment.create({
      data: {
        interventionId: id,
        authorName: authResult.user.nom,
        authorRole: authResult.user.role,
        content,
        type,
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    console.error('Create intervention comment error:', error)
    return NextResponse.json({ error: 'فشل في إضافة التعليق' }, { status: 500 })
  }
}
