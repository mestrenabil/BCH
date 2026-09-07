// أنواع المكتب 08: التراخيص واللجان

export interface AuthorizationDossier {
  id: string; reference: string
  applicantName: string; applicantCin: string; applicantPhone: string
  establishmentName: string; activity: string
  commune: string; quartier: string; adresse: string
  requestType: string; rokhasReference: string
  opinionStatus: string; opinionDate: string | null; opinionNotes: string
  reservations: string; competentAuthority: string; legalReference: string
  authorizedBy: string; status: string; checklistJson: string
  notes: string; createdAt: string; updatedAt: string
}

export interface SanitaryOpinion {
  id: string; reference: string
  dossierId: string | null; establishmentName: string; commune: string
  opinionType: string
  result: string; date: string; inspectorName: string
  observations: string; reservations: string; correctiveActions: string
  recommendation: string
  validationStatus: string; validatedBy: string; validatedAt: string | null
  legalReference: string; notes: string
  createdAt: string; updatedAt: string
}

export interface CommitteeVisit {
  id: string; reference: string
  dossierId: string | null; establishmentName: string; commune: string
  visitDate: string; participantsJson: string; inspectionNotes: string
  findingsJson: string
  recommendation: string; reservations: string; correctiveActions: string
  validationStatus: string; validatedBy: string; validatedAt: string | null
  notes: string; status: string
  createdAt: string; updatedAt: string
}
