import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { canAccessCommune, requireAuth } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const CONTACT_CHANNELS = new Set(['PHONE', 'WHATSAPP', 'VISIT', 'EMAIL', 'OTHER'])

async function getAuthorizedComplaint(id: string) {
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult

  const complaint = await db.complaint.findUnique({
    where: { id },
    select: { id: true, reference: true, commune: true },
  })
  if (!complaint) return { error: NextResponse.json({ error: 'الشكاية غير موجودة' }, { status: 404 }) }
  if (!canAccessCommune(authResult.user, complaint.commune)) {
    return { error: NextResponse.json({ error: 'ليس لديك صلاحية الوصول لهذه الشكاية' }, { status: 403 }) }
  }

  return { user: authResult.user, complaint }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const accessResult = await getAuthorizedComplaint(id)
    if ('error' in accessResult) return accessResult.error

    const contacts = await db.complaintContact.findMany({
      where: { complaintId: id },
      orderBy: { contactedAt: 'desc' },
    })
    return NextResponse.json({ contacts })
  } catch (error) {
    console.error('GET complaint contacts error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل سجل التواصل' }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const accessResult = await getAuthorizedComplaint(id)
    if ('error' in accessResult) return accessResult.error

    const body = await request.json() as Record<string, unknown>
    const channel = typeof body.channel === 'string' ? body.channel.trim().toUpperCase() : ''
    const outcome = typeof body.outcome === 'string' ? body.outcome.trim() : ''
    const notes = typeof body.notes === 'string' ? body.notes.trim() : ''
    const contactedAt = body.contactedAt ? new Date(String(body.contactedAt)) : new Date()

    if (!CONTACT_CHANNELS.has(channel) || outcome.length < 3 || outcome.length > 500 || notes.length > 2_000 || Number.isNaN(contactedAt.getTime())) {
      return NextResponse.json({ error: 'بيانات التواصل غير صالحة' }, { status: 400 })
    }

    const contact = await db.complaintContact.create({
      data: {
        complaintId: id,
        channel,
        outcome,
        notes,
        contactedAt,
        contactedBy: accessResult.user.nom,
      },
    })
    await recordActivity({
      user: accessResult.user,
      action: 'CREATE',
      entityType: 'COMPLAINT_CONTACT',
      entityId: contact.id,
      commune: accessResult.complaint.commune,
      details: { complaintId: id, reference: accessResult.complaint.reference, channel, outcome },
    })

    return NextResponse.json(contact, { status: 201 })
  } catch (error) {
    console.error('POST complaint contact error:', error)
    return NextResponse.json({ error: 'تعذر حفظ تواصل المشتكي' }, { status: 500 })
  }
}
