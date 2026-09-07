import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const ALLOWED_STATUS = new Set([
  'NEW', 'ASSIGNED', 'IN_PROGRESS', 'INSPECTED', 'ACTION_REQUIRED',
  'FOLLOW_UP', 'PENDING_VALIDATION', 'CLOSED', 'ARCHIVED',
])
const ALLOWED_PRIORITY = new Set(['FAIBLE', 'NORMALE', 'HAUTE', 'URGENTE', 'SANITAIRE'])

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const office = searchParams.get('office')
    const type = searchParams.get('type')
    const priority = searchParams.get('priority')
    const search = searchParams.get('search')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (office) where.office = office
    if (type) where.type = type
    if (priority) where.priority = priority
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { title: { contains: search } },
        { description: { contains: search } },
        { quartier: { contains: search } },
        { assignedToName: { contains: search } },
      ]
    }

    const dossiers = await db.dossier.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 1 }, // آخر حدث للحالة الحالية
      },
    })

    const total = await db.dossier.count({ where })

    return NextResponse.json({ dossiers, total })
  } catch (error) {
    console.error('GET dossiers error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل الملفات' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const {
      office, type, title, description,
      commune, quartier, adresse, latitude, longitude,
      priority, assignedTo, assignedToName, dueDate,
      interventionId, complaintId, workOrderId, strayReportId, foodReportId,
    } = body

    if (!title && !description) {
      return NextResponse.json({ error: 'يرجى تقديم عنوان أو وصف للملف' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة قبل إنشاء الملف' }, { status: 400 })
    }

    // توليد المرجع DOS-YYYY-NNNNNN
    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `DOS-${year}-${random}`
      const exists = await db.dossier.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) reference = `DOS-${year}-${Date.now().toString(36).toUpperCase()}`

    const finalPriority = ALLOWED_PRIORITY.has(priority) ? priority : 'NORMALE'
    const initialStatus = assignedTo ? 'ASSIGNED' : 'NEW'

    const dossier = await db.dossier.create({
      data: {
        reference,
        office: office || '',
        type: type || 'OTHER',
        title: title || '',
        description: description || '',
        status: initialStatus,
        priority: finalPriority,
        commune: enforcedCommune,
        quartier: quartier || '',
        adresse: adresse || '',
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        assignedTo: assignedTo || '',
        assignedToName: assignedToName || '',
        dueDate: dueDate ? new Date(dueDate) : null,
        interventionId: interventionId || null,
        complaintId: complaintId || null,
        workOrderId: workOrderId || null,
        strayReportId: strayReportId || null,
        foodReportId: foodReportId || null,
        createdBy: user.id,
        createdByName: user.nom,
        events: {
          create: [{
            fromStatus: null,
            toStatus: initialStatus,
            action: 'CREATE',
            reason: 'إنشاء الملف',
            changedBy: user.id,
            changedByName: user.nom,
            metadata: JSON.stringify({ reference }),
          }],
        },
      },
      include: { events: true },
    })

    await recordActivity({
      user, action: 'CREATE', entityType: 'DOSSIER', entityId: dossier.id,
      commune: enforcedCommune,
      details: { reference: dossier.reference, type: dossier.type, office: dossier.office },
    })

    return NextResponse.json(dossier, { status: 201 })
  } catch (error) {
    console.error('POST dossiers error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء الملف' }, { status: 500 })
  }
}
