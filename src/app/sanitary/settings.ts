export interface SanitarySettings {
  operational: { defaultPriority: string; responseTargetHours: number; requireLocation: boolean; requireEvidenceForClosure: boolean }
  notifications: { urgentAlerts: boolean; inspectionReminders: boolean; sampleReminders: boolean; expiryReminders: boolean }
  map: { defaultZoom: number; showBoundary: boolean; showEstablishments: boolean; showInspections: boolean; showHealthCards: boolean; showSamples: boolean }
  reporting: { referencePrefix: string; defaultFormat: string; includeCoordinates: boolean; includeRiskSummary: boolean }
  workflow: { autoCreateInspection: boolean; lockClosedRecords: boolean; requireClosureNote: boolean }
}

export type SanitarySettingsPatch = {
  [K in keyof SanitarySettings]?: Partial<SanitarySettings[K]>
}

export const DEFAULT_SANITARY_SETTINGS: SanitarySettings = {
  operational: { defaultPriority: 'NORMALE', responseTargetHours: 48, requireLocation: true, requireEvidenceForClosure: true },
  notifications: { urgentAlerts: true, inspectionReminders: true, sampleReminders: true, expiryReminders: true },
  map: { defaultZoom: 13, showBoundary: true, showEstablishments: true, showInspections: true, showHealthCards: true, showSamples: true },
  reporting: { referencePrefix: 'SAN', defaultFormat: 'PDF', includeCoordinates: true, includeRiskSummary: true },
  workflow: { autoCreateInspection: false, lockClosedRecords: true, requireClosureNote: true },
}

export function mergeSanitarySettings(value: SanitarySettingsPatch | null | undefined): SanitarySettings {
  return {
    ...DEFAULT_SANITARY_SETTINGS,
    ...(value || {}),
    operational: { ...DEFAULT_SANITARY_SETTINGS.operational, ...(value?.operational || {}) },
    notifications: { ...DEFAULT_SANITARY_SETTINGS.notifications, ...(value?.notifications || {}) },
    map: { ...DEFAULT_SANITARY_SETTINGS.map, ...(value?.map || {}) },
    reporting: { ...DEFAULT_SANITARY_SETTINGS.reporting, ...(value?.reporting || {}) },
    workflow: { ...DEFAULT_SANITARY_SETTINGS.workflow, ...(value?.workflow || {}) },
  }
}

export function sanitaryLayerVisibility(settings: SanitarySettings) {
  return {
    establishments: settings.map.showEstablishments,
    inspections: settings.map.showInspections,
    healthCards: settings.map.showHealthCards,
    samples: settings.map.showSamples,
  }
}
