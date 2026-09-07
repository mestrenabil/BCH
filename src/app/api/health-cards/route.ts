import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, getScopedCommuneFilter, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const expiringDays = searchParams.get('expiringDays')
    const limit = Math.min(parseInt(searchParams.get('limit') || '500', 10), 1000)

    const communeFilter = getScopedCommuneFilter(user, searchParams)

    const where: Record<string, unknown> = {}
    if (communeFilter) where.commune = communeFilter
    if (status) where.status = status
    if (search) {
      where.OR = [
        { reference: { contains: search } },
        { workerName: { contains: search } },
        { workerCin: { contains: search } },
        { cardNumber: { contains: search } },
        { occupation: { contains: search } },
      ]
    }

    // فلتر الانتهاء الوشيك
    if (expiringDays) {
      const days = parseInt(expiringDays, 10)
      const limit_date = new Date()
      limit_date.setDate(limit_date.getDate() + days)
      where.expiryDate = { lte: limit_date }
    }

    const healthCards = await db.healthCard.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        establishment: { select: { id: true, reference: true, name: true } },
      },
    })

    const total = await db.healthCard.count({ where })

    return NextResponse.json({ healthCards, total })
  } catch (error) {
    console.error('GET health-cards error:', error)
    return NextResponse.json({ error: 'حدث خطأ' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult

    const body = await request.json()
    const { workerName, workerCin, establishmentId, occupation, commune, cardNumber, issueDate, expiryDate, examinationDate, notes } = body

    if (!workerName) {
      return NextResponse.json({ error: 'يرجى تقديم اسم العامل' }, { status: 400 })
    }

    const enforcedCommune = resolveRecordCommune(user, commune)
    if (!enforcedCommune) {
      return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    }

    // حدّد الحالة بناءً على تاريخ الانتهاء
    let status = 'VALID'
    if (expiryDate) {
      const exp = new Date(expiryDate)
      if (exp < new Date()) status = 'EXPIRED'
    } else {
      status = 'PENDING'
    }

    const year = new Date().getFullYear()
    let reference = ''
    for (let attempt = 0; attempt < 5; attempt++) {
      const random = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
      const candidate = `CS-${year}-${random}`
      const exists = await db.healthCard.findUnique({ where: { reference: candidate }, select: { id: true } })
      if (!exists) { reference = candidate; break }
    }
    if (!reference) reference = `CS-${year}-${Date.now().toString(36).toUpperCase()}`

    const healthCard = await db.healthCard.create({
      data: {
        reference,
        workerName,
        workerCin: workerCin || '',
        establishmentId: establishmentId || null,
        occupation: occupation || '',
        commune: enforcedCommune,
        cardNumber: cardNumber || '',
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        examinationDate: examinationDate ? new Date(examinationDate) : null,
        status,
        notes: notes || '',
      },
    })

    await recordActivity({
      user, action: 'CREATE', entityType: 'HEALTH_CARD', entityId: healthCard.id,
      commune: enforcedCommune, details: { reference: healthCard.reference, workerName },
    })

    return NextResponse.json(healthCard, { status: 201 })
  } catch (error) {
    console.error('POST health-cards error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء البطاقة الصحية' }, { status: 500 })
  }
}
