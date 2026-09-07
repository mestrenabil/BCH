export type SanitaryWorkflowStep = 'RECENSER' | 'PLANIFIER' | 'INSPECTER' | 'MESURER' | 'PRELEVER' | 'EVALUER' | 'CONSTATER' | 'CORRIGER' | 'SUIVRE' | 'CLOTURER' | 'ANALYSER'
export type SanitaryEntity = 'ESTABLISHMENT' | 'INSPECTION' | 'FINDING' | 'CORRECTIVE_ACTION' | 'SAMPLE' | 'COUNTER_VISIT'
export type SanitaryRole = 'admin' | 'responsable' | 'agent'

export const SANITARY_WORKFLOW: readonly SanitaryWorkflowStep[] = [
  'RECENSER', 'PLANIFIER', 'INSPECTER', 'MESURER', 'PRELEVER', 'EVALUER', 'CONSTATER', 'CORRIGER', 'SUIVRE', 'CLOTURER', 'ANALYSER',
]

export const SANITARY_STATUS_TRANSITIONS: Record<SanitaryEntity, Record<string, readonly string[]>> = {
  ESTABLISHMENT: {
    ACTIVE: ['SUSPENDED', 'CLOSED'],
    SUSPENDED: ['ACTIVE', 'CLOSED'],
    CLOSED: [],
  },
  INSPECTION: {
    PLANNED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: ['CLOSED'],
    CANCELLED: [],
    CLOSED: [],
  },
  FINDING: {
    OPEN: ['CORRECTED', 'CLOSED'],
    CORRECTED: ['CLOSED', 'OPEN'],
    CLOSED: [],
  },
  CORRECTIVE_ACTION: {
    PENDING: ['IN_PROGRESS', 'DONE'],
    IN_PROGRESS: ['DONE', 'PENDING'],
    DONE: ['VERIFIED', 'IN_PROGRESS'],
    VERIFIED: [],
  },
  SAMPLE: {
    PENDING: ['CONFORM', 'NON_CONFORM'],
    CONFORM: ['NON_CONFORM'],
    NON_CONFORM: ['CONFORM', 'CLOSED'],
    CLOSED: [],
  },
  COUNTER_VISIT: {
    PENDING: ['CONFORM', 'NON_CONFORM', 'CLOSED'],
    CONFORM: ['CLOSED'],
    NON_CONFORM: ['CLOSED'],
    CLOSED: [],
  },
}

export const SANITARY_ROLE_ACTIONS: Record<SanitaryRole, readonly string[]> = {
  admin: ['CREATE', 'UPDATE', 'ASSIGN', 'VALIDATE', 'CLOSE', 'CONFIGURE', 'EXPORT'],
  responsable: ['CREATE', 'UPDATE', 'ASSIGN', 'VALIDATE', 'CLOSE', 'EXPORT'],
  agent: ['CREATE', 'UPDATE', 'MEASURE', 'PHOTO', 'FOLLOW_UP'],
}

export function canTransitionSanitaryStatus(entity: SanitaryEntity, from: string, to: string): boolean {
  return SANITARY_STATUS_TRANSITIONS[entity]?.[from]?.includes(to) ?? false
}

export function canPerformSanitaryAction(role: string, action: string): boolean {
  return SANITARY_ROLE_ACTIONS[role as SanitaryRole]?.includes(action) ?? false
}
