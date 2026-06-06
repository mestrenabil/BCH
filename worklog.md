---
Task ID: 1
Agent: main
Task: Link documents with interventions (ربط المستندات مع التدخلات)

Work Log:
- Reviewed the current state of document-intervention linking
- Discovered that most of the feature was already implemented:
  - Prisma schema: `InterventionDocument` model with proper relations
  - API: GET/POST/DELETE `/api/interventions/[id]/documents` and GET `/api/documents/[id]/interventions`
  - API: GET `/api/documents` already includes `interventions` relation
  - API: GET `/api/interventions` already includes `documents` relation
  - Documents view: Full `InterventionPickerDialog` with search, multi-select, link/unlink
  - Interventions view: Full `DocumentPickerDialog` with search, multi-select, link/unlink
  - Intervention card shows document count badge (📎)
- Found one bug: `/api/documents/[id]` GET endpoint did NOT include linked interventions
  - This caused the detail panel to lose intervention data after linking a document to an intervention
- Fixed the `/api/documents/[id]` GET endpoint to include the `interventions` relation
- Verified lint passes cleanly
- Verified dev server starts and responds correctly

Stage Summary:
- The document-intervention linking feature was already fully implemented in both directions
- Fixed `/api/documents/[id]` GET endpoint to include `interventions` relation (was missing)
- Key features already working:
  - From Documents view: Click document → see linked interventions → "ربط بتدخل" button → InterventionPickerDialog
  - From Interventions view: Click intervention → see linked documents → "إرفاق مستند" button → DocumentPickerDialog
  - Both views support linking and unlinking
  - Intervention cards show document count badge (📎 n)
