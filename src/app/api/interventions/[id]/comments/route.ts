import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/interventions/[id]/comments
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const comments = await db.interventionComment.findMany({
      where: { interventionId: id },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ comments })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch comments' }, { status: 500 })
  }
}

// POST /api/interventions/[id]/comments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { authorName, authorRole, content, type } = body

    if (!content || !authorName) {
      return NextResponse.json({ error: 'Content and author name are required' }, { status: 400 })
    }

    const comment = await db.interventionComment.create({
      data: {
        interventionId: id,
        authorName,
        authorRole: authorRole || '',
        content,
        type: type || 'COMMENT',
      },
    })

    return NextResponse.json(comment, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create comment' }, { status: 500 })
  }
}
