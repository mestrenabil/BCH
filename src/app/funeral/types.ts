// أنواع المكتب 05: الجنائز والمقابر

export interface DeathCase {
  id: string; reference: string
  deceasedName: string; deceasedCin: string; deceasedAge: number | null; deceasedGender: string
  deathDate: string | null; deathCause: string; deathPlace: string
  commune: string
  morgueStatus: string; morgueAdmissionDate: string | null; morgueReleaseDate: string | null
  source: string; declarantName: string; declarantPhone: string
  status: string; notes: string; burialId: string | null
  createdAt: string; updatedAt: string
}

export interface BurialDossier {
  id: string; reference: string
  deceasedName: string; deceasedCin: string; commune: string
  cemeteryId: string | null; cemetery?: { id: string; reference: string; name: string } | null
  plotSection: string; burialDate: string | null
  authorizationStatus: string; authorizedBy: string; authorizedAt: string | null
  legalReference: string; competentAuthority: string
  deathCaseId: string | null; officiantName: string
  notes: string; status: string
  createdAt: string; updatedAt: string
}

export interface Cemetery {
  id: string; reference: string; name: string; type: string
  commune: string; quartier: string; adresse: string
  latitude: number | null; longitude: number | null
  capacity: number; occupied: number; sectionsJson: string
  status: string; notes: string
  _count?: { burials: number }
  createdAt: string; updatedAt: string
}

export interface CorpseTransport {
  id: string; reference: string; deceasedName: string; commune: string
  originPlace: string; destinationPlace: string; transportDate: string | null
  vehiclePlate: string; driverName: string; driverPhone: string
  authorizationStatus: string; authorizedBy: string; authorizedAt: string | null
  legalReference: string; deathCaseId: string | null
  status: string; notes: string
  createdAt: string; updatedAt: string
}

export interface ExhumationDossier {
  id: string; reference: string; deceasedName: string; deceasedCin: string; commune: string
  cemeteryId: string | null; cemetery?: { id: string; reference: string; name: string } | null
  plotSection: string; originalBurialDate: string | null; exhumationDate: string | null
  reason: string; newDestination: string
  authorizationStatus: string; authorizedBy: string; authorizedAt: string | null
  legalReference: string; competentAuthority: string
  requesterName: string; requesterCin: string
  status: string; notes: string
  createdAt: string; updatedAt: string
}

export interface FuneralDashboardMetrics {
  deathsTotal: number
  morgueAdmitted: number
  burialsTotal: number
  pendingBurialAuthorizations: number
  cemeteriesTotal: number
  fullCemeteries: number
  transportsTotal: number
  pendingTransportAuthorizations: number
  exhumationsTotal: number
  pendingExhumationAuthorizations: number
  pendingAuthorizations: number
}
