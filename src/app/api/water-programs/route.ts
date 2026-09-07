import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'
import { getScopedCommuneFilter, requireAuth, resolveRecordCommune } from '@/lib/auth'
import { recordActivity } from '@/lib/activity-log'

const programTypes = new Set(['QUALITY', 'DISINFECTION', 'SANITATION', 'POOL', 'EMERGENCY'])
const statuses = new Set(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED'])

async function createReference() {
  const year = new Date().getFullYear()
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const suffix = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('').toUpperCase()
    const reference = `PRG-WATER-${year}-${suffix}`
    if (!await db.waterMonitoringProgram.findUnique({ where: { reference }, select: { id: true } })) return reference
  }
  return `PRG-WATER-${year}-${Date.now().toString(36).toUpperCase()}`
}

function optionalDate(value: unknown) {
  if (!value) return null
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date
}

function optionalInt(value: unknown) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const where: Record<string, unknown> = {}
    const communeFilter = getScopedCommuneFilter(user, searchParams)
    if (communeFilter) where.commune = communeFilter
    if (searchParams.get('status')) where.status = searchParams.get('status')
    const programs = await db.waterMonitoringProgram.findMany({ where, orderBy: [{ status: 'asc' }, { startDate: 'desc' }], take: 500 })
    const total = await db.waterMonitoringProgram.count({ where })
    return NextResponse.json({ programs, total })
  } catch (error) {
    console.error('GET water-programs error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء تحميل برامج المراقبة' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { user } = authResult
    const body = await request.json() as Record<string, unknown>
    const name = String(body.name || '').trim()
    if (!name) return NextResponse.json({ error: 'اسم البرنامج مطلوب' }, { status: 400 })
    const commune = resolveRecordCommune(user, body.commune)
    if (!commune) return NextResponse.json({ error: 'ليست لديك صلاحية على الجماعة المحددة' }, { status: 403 })
    const programType = String(body.programType || 'QUALITY')
    const status = String(body.status || 'PLANNED')
    if (!programTypes.has(programType) || !statuses.has(status)) return NextResponse.json({ error: 'نوع أو حالة البرنامج غير صالحة' }, { status: 400 })
    const program = await db.waterMonitoringProgram.create({ data: { reference: await createReference(), name, commune, programType, status, objective: String(body.objective || ''), targetArea: String(body.targetArea || ''), responsible: String(body.responsible || user.nom || ''), team: String(body.team || ''), startDate: optionalDate(body.startDate), endDate: optionalDate(body.endDate), frequencyDays: optionalInt(body.frequencyDays), targetCount: optionalInt(body.targetCount), completedCount: optionalInt(body.completedCount) || 0, notes: String(body.notes || '') } })
    await recordActivity({ user, action: 'CREATE', entityType: 'WATER_MONITORING_PROGRAM', entityId: program.id, commune, details: { reference: program.reference, programType, status } })
    return NextResponse.json(program, { status: 201 })
  } catch (error) {
    console.error('POST water-programs error:', error)
    return NextResponse.json({ error: 'حدث خطأ أثناء إنشاء برنامج المراقبة' }, { status: 500 })
  }
}
