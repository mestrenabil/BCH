# Task 4 - Link Documents with Interventions

## Summary
Implemented a full bidirectional document-intervention linking system for the 3D management app.

## Key Changes

### API Routes Created
1. **GET/POST/DELETE `/api/interventions/[id]/documents`** - Manage documents linked to an intervention
2. **GET `/api/documents/[id]/interventions`** - Get interventions linked to a document

### API Routes Updated
3. **GET `/api/interventions`** - Now includes `documents` relation in response
4. **GET `/api/interventions/[id]`** - Now includes `documents` relation in response
5. **GET `/api/documents`** - Now includes `interventions` relation in response

### Frontend Changes (page.tsx)
- Added `InterventionDocument` interface
- Updated `Intervention` interface with `documents?: InterventionDocument[]`
- InterventionsView: Added detail panel with linked documents section
- Added DocumentPickerDialog for multi-select document attachment
- Intervention cards are now clickable to show detail panel
- Document count badge (📎 N) shown on intervention cards

### Frontend Changes (documents-view.tsx)
- Updated `DocumentRecord` interface with `interventions` relation
- Added intervention-related constants (TYPE_LABELS, STATUT_LABELS, etc.)
- Document detail panel now has "التدخلات المرتبطة" (Linked Interventions) section
- Added InterventionPickerDialog for multi-select intervention linking
- Unlink buttons for both directions

### Database
- Prisma client regenerated to include `documents` relation on Intervention and `interventions` on Document
- No schema changes needed - InterventionDocument junction table already existed

## Notes
- All API routes enforce authentication and commune-based access control
- Prisma client needed regeneration (rm -rf node_modules/.prisma + prisma generate) for new relation fields to be recognized
- .next cache needed clearing for Next.js to pick up the new Prisma client
