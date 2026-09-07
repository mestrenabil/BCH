import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    const year = Number(searchParams.get('year')) || undefined
    const where = { ...(communeFilter ? { commune: communeFilter } : {}), ...(year ? { year } : {}) }
    const programs = await db.environmentalProgram.findMany({ where, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }], take: 500, include: { environmentalDossier: { select: { id: true, reference: true, title: true } } } })
    return NextResponse.json({ programs })
  } catch (error) {
    console.error('GET environmental programs error:', error)
    return NextResponse.json({ error: 'تعذر تحميل البرنامج البيئي' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json()
    if (!String(body.operation || '').trim()) return NextResponse.json({ error: 'اسم العملية مطلوب' }, { status: 400 })
    const environmentalDossierId = body.environmentalDossierId ? String(body.environmentalDossierId) : null
    const dossier = environmentalDossierId ? await db.environmentalDossier.findUnique({ where: { id: environmentalDossierId }, select: { id: true, commune: true } }) : null
    if (environmentalDossierId && !dossier) return NextResponse.json({ error: 'الملف البيئي المرتبط غير موجود' }, { status: 404 })
    if (dossier && !resolveRecordCommune(user, dossier.commune)) return NextResponse.json({ error: 'غير مصرح بالملف البيئي المرتبط' }, { status: 403 })
    const commune = dossier?.commune || resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'يرجى تحديد الجماعة' }, { status: 400 })
    const year = Math.max(2020, Math.min(2100, Number(body.year) || new Date().getFullYear()))
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const quantitativeTarget = Math.max(0, Number(body.quantitativeTarget) || 0)
    const achieved = Math.max(0, Number(body.achieved) || 0)
    const progress = quantitativeTarget > 0 ? Math.max(0, Math.min(100, Math.round((achieved / quantitativeTarget) * 100))) : Math.max(0, Math.min(100, Number(body.progress) || 0))
    const program = await db.environmentalProgram.create({ data: {
      reference: `EPRG-${year}-${suffix}`, year, operation: body.operation.trim(), axis: body.axis || '', commune, quartier: body.quartier || '',
      environmentalDossierId,
      objective: body.objective || '', responsible: body.responsible || '', startDate: body.startDate ? new Date(body.startDate) : null, endDate: body.endDate ? new Date(body.endDate) : null,
      budget: body.budget === '' || body.budget == null ? null : Number(body.budget), indicator: body.indicator || '', quantitativeTarget,
      achieved, progress, status: body.status || 'PLANNED', notes: body.notes || '',
    } })
    await recordActivity({ user, action: 'CREATE', entityType: 'ENVIRONMENTAL_PROGRAM', entityId: program.id, commune, details: { reference: program.reference, operation: program.operation } })
    return NextResponse.json(program, { status: 201 })
  } catch (error) {
    console.error('POST environmental program error:', error)
    return NextResponse.json({ error: 'فشل إنشاء العملية البيئية' }, { status: 500 })
  }
}
