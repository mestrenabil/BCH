import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'
import { NextRequest, NextResponse } from 'next/server'
import { recordActivity } from '@/lib/activity-log'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

const execFileAsync = promisify(execFile)
const demoReference = { startsWith: 'SEED-' }

function getDemoYears() {
  const currentYear = new Date().getFullYear()
  return [currentYear - 2, currentYear - 1, currentYear]
}

async function getDemoStatus() {
  const counts = {
    interventions: await db.intervention.count({ where: { reference: demoReference } }),
    complaints: await db.complaint.count({ where: { reference: demoReference } }),
    workOrders: await db.workOrder.count({ where: { reference: demoReference } }),
    campaigns: await db.campagne.count({ where: { reference: demoReference } }),
    foodReports: await db.foodReport.count({ where: { reference: demoReference } }),
    establishments: await db.establishment.count({ where: { reference: demoReference } }),
    temperatureLogs: await db.temperatureLog.count({ where: { reference: demoReference } }),
    foodProducts: await db.foodProduct.count({ where: { reference: demoReference } }),
    labResults: await db.labResult.count({ where: { reference: demoReference } }),
    foodNonConformities: await db.foodNonConformity.count({ where: { reference: demoReference } }),
    fryingOilChecks: await db.fryingOilCheck.count({ where: { reference: demoReference } }),
    waterPoints: await db.waterPoint.count({ where: { reference: demoReference } }),
    pools: await db.pool.count({ where: { reference: demoReference } }),
    sanitationAssets: await db.sanitationAsset.count({ where: { reference: demoReference } }),
    waterSamples: await db.waterSample.count({ where: { reference: demoReference } }),
    waterInspections: await db.waterInspection.count({ where: { reference: demoReference } }),
    waterActions: await db.waterAction.count({ where: { reference: demoReference } }),
    waterDisinfection: await db.waterDisinfectionOperation.count({ where: { reference: demoReference } }),
    waterDevices: await db.waterDevice.count({ where: { reference: demoReference } }),
    waterLaboratories: await db.waterLaboratory.count({ where: { reference: demoReference } }),
    waterPrograms: await db.waterMonitoringProgram.count({ where: { reference: demoReference } }),
    waterIncidents: await db.waterIncident.count({ where: { reference: demoReference } }),
    waterEmergencyPlans: await db.waterEmergencyPlan.count({ where: { reference: demoReference } }),
    strayReports: await db.strayReport.count({ where: { reference: demoReference } }),
    strayCampaigns: await db.strayCampaign.count({ where: { reference: demoReference } }),
    strayDeathReports: await db.strayAnimalDeathReport.count({ where: { reference: demoReference } }),
    strayHotspots: await db.strayAnimalHotspot.count({ where: { reference: demoReference } }),
    environmentalDossiers: await db.environmentalDossier.count({ where: { reference: demoReference } }),
    environmentalInspections: await db.environmentalInspection.count({ where: { reference: demoReference } }),
    environmentalFollowUps: await db.environmentalFollowUp.count({ where: { reference: demoReference } }),
    environmentalPrograms: await db.environmentalProgram.count({ where: { reference: demoReference } }),
    deathCases: await db.deathCase.count({ where: { reference: demoReference } }),
    authorizationDossiers: await db.authorizationDossier.count({ where: { reference: demoReference } }),
    dossiers: await db.dossier.count({ where: { reference: demoReference } }),
  }
  return {
    years: getDemoYears(),
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  }
}

export async function GET() {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error

  try {
    return NextResponse.json(await getDemoStatus())
  } catch (error) {
    console.error('GET demo-data error:', error)
    return NextResponse.json({ error: 'تعذر قراءة حالة البيانات التجريبية' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireAdmin()
  if ('error' in authResult) return authResult.error
  const { user } = authResult

  try {
    const body = await request.json().catch(() => ({})) as { action?: string; confirmation?: string }
    const action = body.action === 'remove' ? 'remove' : body.action === 'restore' ? 'restore' : null
    const expectedConfirmation = action === 'remove' ? 'REMOVE_DEMO_DATA' : 'RESTORE_DEMO_DATA'
    if (!action || body.confirmation !== expectedConfirmation) {
      return NextResponse.json({ error: 'طلب إدارة البيانات التجريبية غير صالح' }, { status: 400 })
    }

    const scriptPath = path.join(process.cwd(), 'scripts', 'seed-2025.cjs')
    if (!existsSync(scriptPath)) {
      return NextResponse.json({ error: 'سكربت البيانات التجريبية غير متوفر على الخادم' }, { status: 500 })
    }

    const years = getDemoYears()
    const { stdout, stderr } = await execFileAsync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DEMO_ACTION: action === 'remove' ? 'remove' : 'seed',
        SEED_YEARS: years.join(','),
        SKIP_SEED_USERS: 'true',
      },
      timeout: 5 * 60 * 1000,
      maxBuffer: 2 * 1024 * 1024,
    })
    if (stderr.trim()) console.warn('demo-data script warning:', stderr.trim())

    await recordActivity({
      user,
      action: action === 'remove' ? 'DELETE' : 'CREATE',
      entityType: 'DEMO_DATA',
      details: { action, years },
      commune: 'ALL',
    })

    return NextResponse.json({
      message: action === 'remove' ? 'تمت إزالة البيانات التجريبية فقط' : 'تمت إعادة البيانات التجريبية',
      output: stdout.trim(),
      ...(await getDemoStatus()),
    })
  } catch (error) {
    console.error('POST demo-data error:', error)
    return NextResponse.json({ error: 'تعذر تنفيذ عملية البيانات التجريبية' }, { status: 500 })
  }
}
