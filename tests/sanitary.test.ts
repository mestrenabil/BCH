import assert from 'node:assert/strict'
import test from 'node:test'
// @ts-expect-error Node's native test runner requires explicit TypeScript extensions.
import { calculateSanitaryMetrics, filterSanitaryMapPoints } from '../src/app/sanitary/metrics.ts'
// @ts-expect-error Node's native test runner requires explicit TypeScript extensions.
import { mergeSanitarySettings, sanitaryLayerVisibility } from '../src/app/sanitary/settings.ts'
import type { Establishment, HealthCard, Inspection, Sample } from '../src/app/sanitary/types.ts'
// @ts-expect-error Node's native test runner requires explicit TypeScript extensions.
import { canPerformSanitaryAction, canTransitionSanitaryStatus, SANITARY_WORKFLOW } from '../src/lib/sanitary-workflow.ts'

const establishment = (overrides: Partial<Establishment> = {}) => ({ riskCategory: 'LOW', status: 'ACTIVE', ...overrides }) as Establishment
const inspection = (result: string): Inspection => ({ overallResult: result } as Inspection)
const card = (overrides: Partial<HealthCard> = {}) => ({ status: 'VALID', expiryDate: null, ...overrides }) as HealthCard
const sample = (conformity: string): Sample => ({ conformity } as Sample)

test('تحسب لوحة المراقبة الصحية مؤشرات المخاطر والنتائج', () => {
  const now = new Date('2026-01-01T00:00:00.000Z')
  const metrics = calculateSanitaryMetrics(
    [establishment({ riskCategory: 'CRITICAL' }), establishment({ riskCategory: 'LOW' })],
    [inspection('CONFORM'), inspection('NON_CONFORM_MAJOR')],
    [card({ status: 'EXPIRED' }), card({ expiryDate: '2026-01-11T00:00:00.000Z' }), card({ expiryDate: '2026-03-01T00:00:00.000Z' })],
    [sample('CONFORM'), sample('NON_CONFORM')],
    now,
  )

  assert.equal(metrics.criticalEstablishments, 1)
  assert.equal(metrics.expiredCards, 1)
  assert.equal(metrics.expiringSoonCards, 1)
  assert.equal(metrics.sampleConformityRate, 50)
  assert.deepEqual(metrics.inspectionsByResult, { CONFORM: 1, NON_CONFORM_MAJOR: 1 })
})

test('تعزل الخريطة نقاط الجماعات المسموح بها والطبقات المطلوبة', () => {
  const points = [
    { layer: 'establishments', commune: 'سلا', id: '1' },
    { layer: 'inspections', commune: 'سلا', id: '2' },
    { layer: 'samples', commune: 'سيدي أبي القنادل', id: '3' },
    { layer: 'complaints', commune: 'سلا', id: '4' },
  ]

  assert.deepEqual(
    filterSanitaryMapPoints(points, ['establishments', 'inspections', 'samples'], ['سلا']).map((point) => point.id),
    ['1', '2'],
  )
})

test('تدمج إعدادات القسم دون فقدان القيم الافتراضية', () => {
  const settings = mergeSanitarySettings({
    map: { showSamples: false, defaultZoom: 15 },
    reporting: { referencePrefix: 'TEST' },
  })

  assert.equal(settings.map.showSamples, false)
  assert.equal(settings.map.defaultZoom, 15)
  assert.equal(settings.map.showBoundary, true)
  assert.equal(settings.reporting.referencePrefix, 'TEST')
  assert.equal(settings.workflow.lockClosedRecords, true)
  assert.deepEqual(sanitaryLayerVisibility(settings), {
    establishments: true,
    inspections: true,
    healthCards: true,
    samples: false,
  })
})

test('تمنع دورة العمل الانتقالات غير المسموح بها', () => {
  assert.equal(canTransitionSanitaryStatus('INSPECTION', 'PLANNED', 'COMPLETED'), true)
  assert.equal(canTransitionSanitaryStatus('INSPECTION', 'CANCELLED', 'COMPLETED'), false)
  assert.equal(canTransitionSanitaryStatus('FINDING', 'OPEN', 'CORRECTED'), true)
  assert.equal(canTransitionSanitaryStatus('FINDING', 'CLOSED', 'OPEN'), false)
  assert.equal(SANITARY_WORKFLOW.length, 11)
})

test('تطبق صلاحيات الدور على العمليات الحساسة', () => {
  assert.equal(canPerformSanitaryAction('agent', 'MEASURE'), true)
  assert.equal(canPerformSanitaryAction('agent', 'CLOSE'), false)
  assert.equal(canPerformSanitaryAction('responsable', 'CLOSE'), true)
  assert.equal(canPerformSanitaryAction('unknown', 'EXPORT'), false)
})
