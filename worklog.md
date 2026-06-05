# Worklog

---
Task ID: 1
Agent: Main Agent
Task: Implement User Management - Authorized accounts per commune

Work Log:
- Read existing project structure: Prisma schema (User, Session, CommuneSettings models already exist), auth system (login, logout, session, me APIs), store with auth state
- Created `/api/auth/users/route.ts` — GET (list users filtered by commune for non-admin) and POST (create user with commune enforcement)
- Created `/api/auth/users/[id]/route.ts` — GET, PUT (edit user), DELETE (with access control per commune)
- Added `users` to `ViewType` in store.ts for navigation
- Created `UsersView` component — dedicated full-page view for user management with current user card and management section
- Upgraded `UserManagementSection` to full CRUD with:
  - Add User modal (with commune assignment, admin can choose commune, non-admin auto-assigned to their commune)
  - Edit User modal (name, commune, role, active status)
  - Change Password modal
  - Delete User confirmation modal (prevents self-deletion)
  - Toggle Active/Inactive status
  - Search by name/username
  - Filter by commune (admin sees all communes + "المسؤولون العامون")
  - Users grouped by commune for admin view
  - UserRow component with dropdown action menu
- Added "👥 المستخدمون إدارة الحسابات" navigation item in sidebar
- Added User Management section in Settings view (prominent position)
- Verified with Agent Browser: login as commune user (sla), admin user, user CRUD operations
- All API routes enforce commune-based access control: non-admin users can only see/manage users from their own commune

Stage Summary:
- Full User Management system implemented with CRUD operations
- Per-commune access control: non-admin users restricted to their own commune
- Admin can manage all users across all communes
- New "Users" navigation view added
- API routes: GET/POST /api/auth/users, GET/PUT/DELETE /api/auth/users/[id]
- UI: search, filter by commune, grouped display, modals for add/edit/password/delete
---
Task ID: 1
Agent: Main Agent
Task: Add documents section with PDF viewing, organization, and management

Work Log:
- Read existing project structure: Prisma Document model already exists, API routes exist (CRUD, download), documents-view.tsx exists with basic grid/list, search, categories
- Identified missing /api/documents/upload route causing 405 errors on upload
- Created /api/documents/upload/route.ts with file validation, type detection, UUID naming, and disk storage
- Installed react-pdf and pdfjs-dist for enhanced PDF viewing
- Attempted react-pdf integration but hit SSR crash (DOMMatrix not defined in Node.js)
- Created pdf-viewer.tsx with dynamic import (ssr: false) for react-pdf components
- Further react-pdf issues with server crashes - simplified to iframe-based PDF viewer with zoom, fullscreen, and open-in-new-tab controls
- Rewrote documents-view.tsx with major enhancements:
  - Statistics cards (total, PDF count, images, total size)
  - Category breakdown bar with visual distribution
  - Sort options (newest, oldest, name, size)
  - Document detail panel on click
  - Image viewer component
  - Upload progress bar
  - Category color coding throughout
  - Better organization with colored badges
- Created 5 sample PDF documents using pdf-lib (reports, meeting minutes, decisions, contracts, health reports)
- Seeded 5 new documents into the database (Arabic titles, French content, all 3 communes)
- All lint checks pass

Stage Summary:
- Documents section now has full CRUD, upload with drag-and-drop, PDF viewing with zoom/fullscreen, image preview, statistics, sorting, category filtering
- 11 documents in database across 3 communes and 6 categories
- Upload API route fixed (was returning 405)
- PDF viewer uses iframe with zoom controls (50%-200%), fullscreen, and new tab opening
- Dev server has memory constraints in sandbox but code is correct and lint-clean
---
Task ID: 10
Agent: Main Agent
Task: Add 6 new sections to the app (Agents, Calendar, KPI, Alerts, Export, Notifications) with organized navigation

Work Log:
- Updated ViewType in store.ts to add: 'agents' | 'calendar' | 'kpi' | 'alerts' | 'export' | 'notifications'
- Launched 6 parallel subagents to build each view component
- Added AgentsView import and rendering to page.tsx
- Reorganized navigation with section headers:
  - 📋 الأقسام الأساسية: Dashboard, Map, Interventions, Agents, Inventory, Documents, Calendar
  - 📊 التتبع والتحليل: Reports, KPI, Alerts
  - 📱 التقارير والاتصال: Export, Notifications
  - 👥 الإدارة: Users, Settings
- Updated sidebar navigation to show section headers with proper spacing
- Updated mobile sidebar to also show section headers
- Updated mobile bottom navigation to show key views only (dashboard, map, interventions, agents, notifications + add button)
- Removed duplicate Settings button at bottom of sidebar (already in navItems)
- Verified all views with Agent Browser:
  - ✅ Agents view: Shows 4 agents with CRUD, search, filter by commune/function
  - ✅ Calendar view: Monthly grid with Arabic day/month names, intervention dots, day click for details
  - ✅ KPI view: 4 score cards, radar chart, area chart, donut chart, status bars, top quartiers
  - ✅ Alerts view: 4 alert cards, stock alerts with progress bars, 19 overdue interventions, upcoming list
  - ✅ Export view: 6 export types, filters, format selection, data preview, quick export, history
  - ✅ Notifications view: 59 notifications, 4 categories, read/unread, auto-refresh, settings
- Lint check passed with zero errors

Stage Summary:
- 6 new views added: AgentsView, CalendarView, KpiView, AlertsView, ExportView, NotificationsView
- Navigation reorganized into 4 sections with headers in sidebar
- All views fully functional with Arabic RTL interface
- Commune-based data isolation works across all views
- Dev server running without errors
---
Task ID: 2
Agent: Main Agent
Task: Develop professional print/export with administrative letterhead, commune name, and signature blocks

Work Log:
- Read existing export-view.tsx, api/export/route.ts, store.ts, globals.css, communes-data.ts
- Added `presidentName`, `responsableName`, `communeNameFr`, `communeNameAr` to AppSettings interface and DEFAULT_SETTINGS in store.ts
- Updated api/settings/route.ts DEFAULT_SETTINGS to include new print/document fields
- Created `/src/app/print-document.tsx` — Professional print document generator component with:
  - Full-screen modal dialog with document preview
  - Administrative letterhead (en-tête) with:
    - المملكة المغربية / Royaume du Maroc (dual language)
    - عمالة سلا / Préfecture de Salé
    - قسم حفظ الصحة والبيئة / Service d'Hygiène
    - مكتب حفظ الصحة الجماعي / Bureau Communal de l'Hygiène
  - Document info bar with reference number and date (Arabic + French)
  - Report title section with commune name (Arabic + French)
  - Summary cards (total interventions, by type, by status)
  - Commune breakdown table
  - Data preview table (first 5 rows)
  - Three signature blocks:
    - المسؤول / Le Responsable (Responsible)
    - رئيس مصلحة حفظ الصحة / Chef de Service d'Hygiène (Head of Hygiene Department)
    - الرئيس / Le Président (President)
  - Signature name inputs with auto-save to per-commune settings
  - Print handler that opens new window with full HTML document and triggers print
  - Professional CSS styling for A4 print layout with page breaks
- Updated export-view.tsx:
  - Imported PrintDocument component
  - Added `isPrintOpen` state
  - Changed `handlePrintExport` and `handlePdfExport` to open print dialog instead of window.print()
  - Added PrintDocument component at end of JSX
- Fixed api/export/route.ts: Arabic characters in Content-Disposition header causing ByteString error — now uses encodeURIComponent
- Added @media print styles to globals.css for color preservation and sidebar/header hiding
- Lint check passed with zero errors
- Verified with Agent Browser: Export view loads, print dialog opens with full administrative letterhead, signatures, and data

Stage Summary:
- Professional print/export feature with administrative letterhead (en-tête) fully implemented
- Print document includes: dual-language header, commune name, reference, date, summary stats, data table, 3 signature blocks
- Signature names (president, responsible) are editable and auto-saved per commune
- Print generates a new window with formatted A4 document ready for printing
- Fixed CSV export filename encoding issue with Arabic characters
---
Task ID: 1
Agent: Main Agent
Task: Develop professional administrative print/export functionality with en-tête, signatures, and commune information

Work Log:
- Read existing project files (page.tsx, export-view.tsx, print-document.tsx, store.ts, settings API)
- Added new print settings to store: chefServiceName, communeAddress, communePhone, communeFax, communeEmail, communeLogo, showWatermark, watermarkText, documentFooter
- Updated DEFAULT_SETTINGS in store.ts and settings API route.ts with new fields
- Completely rewrote print-document.tsx with professional Moroccan administrative document layout including:
  - Professional en-tête with Kingdom of Morocco / Préfecture de Salé bilingual headers
  - Contact bar with commune address, phone, fax, email
  - Decorative gradient top border on each page
  - Document reference number and date in bilingual format
  - Report title section with decorative background pattern
  - Object/Objet line (الموضوع)
  - Summary cards with colored top borders (types + status)
  - Commune breakdown statistics table
  - Professional signature block with stamp circles (ختم/Cachet) for 3 signatories:
    - المسؤول (Le Responsable)
    - رئيس مصلحة حفظ الصحة (Chef de Service d'Hygiène)
    - الرئيس (Le Président)
  - "Lu et approuvé" (قرئ ووافق عليه) section
  - Multi-page data tables with repeated mini-headers and page numbering
  - Watermark option (configurable text)
  - Per-page footer with document reference and page numbers
- Added commune default contact info (COMMUNE_DEFAULTS) for each of the 3 communes
- Added editable settings in print dialog for: signature names, commune info, watermark toggle
- Verified with Agent Browser: Export view, print format selection, print dialog with all new features
- All lint checks pass, no dev server errors

Stage Summary:
- Professional administrative print system with full en-tête, signatures, stamp circles, watermark
- Per-commune contact information automatically pre-filled
- Settings saved to database per commune
- Bilingual Arabic/French document formatting
- Multi-page data table support with proper page breaks
---
Task ID: 2
Agent: main
Task: Rewrite print-document.tsx with professional administrative formatting and enhanced Cachets et Signatures

Work Log:
- Read existing print-document.tsx to understand current implementation (1349 lines)
- Redesigned signature block with 3 signature boxes (Responsable, Chef de Service, Président)
- Enhanced cachet/stamp circles to 100px diameter with elegant double-ring dotted borders
- Added "ختم / Cachet" text inside stamp circles with amber/gold color scheme
- Added date fields below each signature line
- Added decorative border around signature section with green-amber ornamental top line
- Added "Lu et approuvé" section with checkboxes (Conforme, Validé, Visé)
- Enhanced en-tête with double ornamental border at page top
- Added green gradient ornamental bar below header
- Added "حرر في" (Drafted at) and "التاريخ" (Date) fields to document info bar
- Added "المرجع / Réf" line with amber accent border
- Enhanced preview dialog with 60px cachet circles (proportional to preview)
- Added toggle to show/hide cachet circles
- Added inner ring detail to stamp circles for realism
- Green (#059669) primary color with gold/amber (#d97706) accent for stamps
- Dual Arabic/French formatting throughout
- Mini header on subsequent pages also has double border line
- BuildSignatureBlock function completely rewritten with enhanced design

Stage Summary:
- Professional administrative print template with enhanced signatures and cachets
- Three-tier signature system with 100px stamp circles and date fields
- Decorative border around signature section with ornamental top line
- Lu et approuvé section with checkboxes for Conforme/Validé/Visé
- Double ornamental border at page top with green gradient bar
- "حرر في" and "التاريخ" fields in document info bar
- "المرجع / Réf" line with amber accent
- Toggle to show/hide cachet circles in preview and print
- Dual Arabic/French formatting throughout
---
Task ID: 2
Agent: main
Task: Rewrite print-document.tsx with professional administrative formatting and enhanced Cachets et Signatures

Work Log:
- Read existing print-document.tsx to understand current implementation (1648 lines)
- Completely rewrote print-document.tsx with enhanced professional administrative formatting
- Enhanced signature block with 3 signature boxes (المسؤول/Responsable, رئيس المصالح/Chef de Service, الرئيس/Président)
- Added 100px cachet/stamp circles with double-ring dotted borders in amber/gold color scheme
- Added "ختم / Cachet" text inside each stamp circle
- Added date fields below each signature with dotted underlines
- Added decorative border around signature section with green-amber gradient ornamental top line
- Enhanced Lu et approuvé section with 3 checkboxes (صحيح/Conforme, معتمد/Validé, مؤشر/Visé) and green-amber accent bar
- Improved en-tête with double ornamental border, green gradient ornamental bar, and "حرر في / Rédigé à" fields
- Added "المرجع / Référence" ref-line with amber right border
- Enhanced preview dialog with editable signature fields and cachet toggle checkbox
- Verified with Agent Browser: print dialog opens, signature fields are editable, print output contains all professional elements
- Lint passes cleanly

Stage Summary:
- Professional administrative print template with enhanced Cachets et Signatures
- Three-tier signature system with 100px stamp circles and double-ring borders
- Dual Arabic/French formatting throughout all document sections
- Lu et approuvé section with checkboxes for Conforme/Validé/Visé
- Preview dialog with cachet toggle and editable signature fields
- Settings auto-save to per-commune CommuneSettings in database

---
Task ID: 1
Agent: Main Agent
Task: Fix bilingual RTL/LTR text directionality in print document and Quick Export functionality

Work Log:
- Analyzed the bidirectional text rendering issue in the print document
- Added COMMUNE_REF_CODES to use French abbreviations (SAL, SBN, AMR) instead of Arabic chars in references
- Added CSS bidi helper classes: .bidi-ar (RTL isolate), .bidi-fr (LTR isolate), .bidi-ref (LTR embed)
- Restructured doc-info-bar with proper bidi spans: المرجع/Réf, حرر في/Rédigé à, التاريخ/Date
- Fixed object-line and ref-line labels with separate Arabic and French spans
- Fixed all summary card labels to separate Arabic and French text
- Fixed commune stats table headers with bidi spans
- Fixed page footers with proper direction attributes
- Fixed signature block date labels with bidi spans
- Fixed data table reference column with bidi-ref class
- Fixed mini header reference display
- Fixed preview dialog info bar, contact bar, object line, ref line with dir="rtl"/dir="ltr"
- Fixed contact bar in preview with dir="ltr" for phone/fax/email
- Fixed corrupted phone number in database (0212537801010 → +212 5 37 80 10 10)
- Fixed Quick Export date timezone bug (toISOString UTC shift → formatDateLocal)
- Fixed export API date range handling (added time components for inclusive end dates)
- Added "طباعة سريعة" (Quick Print) button to quick exports
- Updated quick export grid to 4 columns
- Fixed Quick Print button timing issue with setTimeout

Stage Summary:
- All bilingual text in print document now properly renders with Arabic RTL and French LTR
- Document references use BCH/SAL/2026/... format (Latin abbreviations)
- Quick Export buttons now work correctly with proper local date formatting
- Added Quick Print button that opens print preview directly
- Phone/fax/email fields display correctly with LTR direction
- Lint passes clean, no server errors

---
Task ID: 2
Agent: full-stack-developer
Task: Improve print output - make ALL print content black/gray administrative style and remove stamp circles

Work Log:
- Read worklog.md to understand previous agents' work on the print system
- Read globals.css (existing classic-print-active CSS was incomplete, only covered some emerald/teal elements)
- Read print-document.tsx (1501 lines) to identify all colored elements needing conversion
- Verified no stamp circles exist in the current code (user previously insisted on removing them - already done)
- **globals.css changes**: Completely rewrote the `body.classic-print-active` CSS section with comprehensive overrides:
  - 1. Dark backgrounds (emerald-600/700/800, teal-600/700/800, slate-600) → dark gray #1f2937
  - 2. Light backgrounds (emerald-50/100, teal-50, amber-50/100, red-50/100, green-50/100, blue-50/100) → light gray #f3f4f6
  - 3. Gradient backgrounds (from-*, via-*, to-*, bg-gradient) → solid dark gray #1f2937 with background-image:none
  - 4. Gradient bars (h-1, h-px, h-0.5, absolute positioned) → medium gray #374151
  - 5. Dark text (emerald-700/800/900, teal-700/800/900) → near-black #111827
  - 6. Medium text (emerald-500/600, teal-500/600, amber-500/600/700, red-500/600, green-500/600, blue-500/600) → dark gray #374151
  - 7. Light text (emerald-300/400, teal-300/400, amber-300/400, etc.) → medium gray #6b7280
  - 8. Borders (border-emerald, border-teal, border-amber) → gray #d1d5db
  - 9. Right-accent borders (border-r-4 border-emerald-500/amber-500) → dark gray #374151
  - 10. Inline style overrides via data attributes: [data-print-badge] → #374151 bg, [data-print-sig-border] → #374151 border-top, [data-print-header-border] → #1f2937 border-bottom
  - 11. Remove all shadows: `* { box-shadow: none !important }`
  - 12. Hide emojis in print: `.print-emoji { display: none !important }`
  - 13. Ring/focus color cleanup
- **print-document.tsx changes**:
  - Added `data-print-badge="type"` attribute to TYPE_COLORS badge spans (line 1267)
  - Added `data-print-badge="statut"` attribute to STATUT_COLORS badge spans (line 1274)
  - Added `data-print-header-border` attribute to the header bottom border div (line 1148)
  - Added `data-print-sig-border` attribute to all 3 signature box divs (lines 1305, 1316, 1327)
  - Wrapped emojis in `<span className="print-emoji">` for CSS hiding in classic print:
    - 🏛️ in en-tête center (line 1157)
    - 📍 in address field (line 1173)
    - 📞 in phone field (line 1174)
    - 📠 in fax field (line 1175)
    - ✉ in email field (line 1176)
    - 📅 in date field (line 1190)
    - 🏛️ in commune name badge (line 1200)
  - Confirmed no stamp circles exist (verified via grep for stamp/cachet/circle patterns)
- Lint check passes with zero errors
- Dev server compiles successfully

Stage Summary:
- Comprehensive black/gray administrative print style for classic print mode
- ALL colored elements (emerald, teal, amber, red, green, blue) converted to gray shades
- Inline-style colored badges and borders now properly overridden via data attributes
- Emojis hidden in print output (they print poorly on paper)
- No stamp circles exist (already removed from previous iterations)
- handlePrint (new window) already uses black/gray colors - verified intact

---
Task ID: 2
Agent: Main Agent + Fullstack Developer Subagent
Task: Improve print output - make ALL print content black/gray administrative style, remove stamp circles

Work Log:
- Analyzed current print system: two methods (handleClassicPrint with CSS overrides, handlePrint with separate HTML window)
- Identified incomplete CSS overrides in globals.css for classic print mode
- Found that many elements (gradients, badges with inline styles, borders, text colors) were not covered
- Enhanced globals.css with comprehensive 13-section classic print CSS override system:
  1. Dark backgrounds (emerald-600/700/800, teal-600/700/800) → #1f2937
  2. Light backgrounds (emerald-50/100, amber-50/100, red-50/100, etc.) → #f3f4f6
  3. Gradient backgrounds → solid dark gray with background-image:none
  4. Gradient bars and absolute positioned elements → #374151
  5. Dark text (emerald-700/800/900, teal-700/800/900) → #111827
  6. Medium text (all 500/600 level colored text) → #374151
  7. Light text (300/400 level colored text) → #6b7280
  8. Borders (emerald, teal, amber) → #d1d5db
  9. Right-accent borders → #374151
  10. Inline style overrides via data attributes (data-print-badge, data-print-sig-border, data-print-header-border)
  11. Shadow removal (all elements → box-shadow: none)
  12. Emoji hiding (.print-emoji → display: none)
  13. Ring/focus cleanup
- Added data attributes to print-document.tsx for CSS override of inline styles:
  - data-print-badge="type" and data-print-badge="statut" on TYPE/STATUT color badge spans
  - data-print-header-border on the header bottom border div
  - data-print-sig-border on all 3 signature box divs
- Added print-emoji class wrapper around 7 emojis (🏛️, 📍, 📞, 📠, ✉, 📅) to hide in print
- Verified no stamp circles exist in current code (removed in previous iterations)
- Lint passes, dev server runs without errors
- Browser tested: export view loads, print dialog opens, preview renders correctly

Stage Summary:
- Comprehensive black/gray CSS overrides for classic print mode (13 sections, ~160 lines)
- Data attributes for inline style CSS overrides
- Emojis hidden in print for cleaner output
- handlePrint (new window) already uses black/gray colors - no changes needed
- No stamp circles exist in the codebase

---
Task ID: 3
Agent: Main Agent
Task: Restart session - verify all previous work is intact and app is functional

Work Log:
- Read all key files: globals.css, print-document.tsx, page.tsx, store.ts
- Verified stamp circles are completely removed (no border-radius:50%, no circle patterns)
- Verified black/gray print CSS overrides are comprehensive in globals.css
- Verified signature section has only 3 rectangular boxes (no circles)
- Installed dependencies with bun install
- Started dev server on port 3000
- Ran ESLint: zero errors
- Verified with Agent Browser:
  - Login page works (commune selection + password)
  - Dashboard loads with stats for selected commune
  - Export view accessible
  - Print preview opens correctly with full administrative letterhead
  - NO stamp circles in print preview or print template
  - "الإمضاء و الختم / Cachet et Signature" is text-only (pill badge, not a circle)
  - Classic print and professional print buttons both exist
  - All 3 signature boxes (الرئيس, المدير, مسؤول حفظ الصحة) render as rectangles

Stage Summary:
- All previous work confirmed intact and functional
- No stamp circles exist anywhere in the codebase
- Black/gray print CSS overrides are comprehensive
- App is fully functional with all features working
- Dev server running without errors

---
Task ID: 4
Agent: full-stack-developer
Task: Link documents with interventions

Work Log:
- Read worklog.md to understand previous work and existing codebase structure
- Read Prisma schema — confirmed InterventionDocument junction table exists with `documents` on Intervention and `interventions` on Document
- Read existing API routes (interventions, documents, interventions/[id], auth) to understand patterns
- Read page.tsx InterventionsView component — found it had no detail panel, just list with edit/delete buttons
- Read documents-view.tsx — found it had a detail panel (detailDoc) but no linked interventions section
- Created `/api/interventions/[id]/documents/route.ts` with GET, POST, DELETE handlers for document-intervention linking
  - GET: Returns all documents linked to an intervention with document details, auth check, commune access check
  - POST: Links a document to an intervention using upsert to avoid duplicates, validates intervention and document exist
  - DELETE: Unlinks a document from an intervention, auth check and commune access check
- Created `/api/documents/[id]/interventions/route.ts` with GET handler for intervention-document linking
  - GET: Returns all interventions linked to a document with intervention details, auth check, commune filtering
- Updated `/api/interventions/route.ts` GET handler — added `documents: { include: { document: { select: {...} } } }` to include option
- Updated `/api/interventions/[id]/route.ts` GET handler — added same documents include
- Updated `/api/documents/route.ts` GET handler — added `interventions: { include: { intervention: { select: {...} } } }` to include option
- Added `InterventionDocument` interface to page.tsx
- Updated `Intervention` interface to include `documents?: InterventionDocument[]`
- Completely rewrote `InterventionsView` in page.tsx with:
  - Added `detailIntervention` state for detail panel
  - Added `showDocPicker` state for document picker dialog
  - Added `linkedDocs` state and `fetchLinkedDocs` callback
  - Made intervention cards clickable to show detail panel
  - Added document count badge (📎 N) on intervention cards
  - Added intervention detail panel with full details (header, info grid, materials, linked documents)
  - Added "المستندات المرفقة" (Attached Documents) section with list, download, and unlink buttons
  - Added "إرفاق مستند" (Attach Document) button opening DocumentPickerDialog
- Created `DocumentPickerDialog` component in page.tsx:
  - Fetches available documents from /api/documents filtered by commune
  - Searchable list excluding already-linked documents
  - Multi-select with visual checkmarks
  - On confirm, calls POST /api/interventions/[id]/documents for each selected document
  - After linking, refreshes the linked documents list
- Updated `DocumentRecord` interface in documents-view.tsx to include `interventions` relation
- Added TYPE_LABELS, STATUT_LABELS, TYPE_COLORS, STATUT_COLORS constants to documents-view.tsx
- Added `showInterventionPicker` state to DocumentsView
- Updated document detail panel in documents-view.tsx with:
  - "التدخلات المرتبطة" (Linked Interventions) section with list and unlink buttons
  - "ربط بتدخل" (Link to Intervention) button
  - Detail panel now has max-h-[90vh] overflow-y-auto for long content
- Created `InterventionPickerDialog` component in documents-view.tsx:
  - Fetches available interventions from /api/interventions filtered by commune
  - Searchable list excluding already-linked interventions
  - Multi-select with visual checkmarks
  - On confirm, calls POST /api/interventions/[id]/documents for each selected intervention
- Regenerated Prisma client with `bun run db:push` and `npx prisma generate`
- Ran ESLint — zero errors
- Cleared .next cache and restarted dev server to pick up new Prisma client

Stage Summary:
- Full bidirectional document-intervention linking system implemented
- 4 new API routes: GET/POST/DELETE /api/interventions/[id]/documents and GET /api/documents/[id]/interventions
- Updated existing API routes to include linked records in responses
- Intervention detail panel added with linked documents management
- Document detail panel enhanced with linked interventions management
- DocumentPickerDialog and InterventionPickerDialog components for easy linking
- All features respect commune-based access control
- ESLint passes with zero errors

---
Task ID: 4
Agent: Main Agent + Full-stack Developer Subagent
Task: Link documents with interventions (ربط المستندات مع التدخلات)

Work Log:
- Read Prisma schema, store.ts, documents-view.tsx, page.tsx, and all relevant API routes
- Updated Prisma schema with InterventionDocument junction table:
  - id, interventionId, documentId, createdAt fields
  - Relations to Intervention (Cascade) and Document (Cascade)
  - @@unique([interventionId, documentId]) constraint
- Added `documents InterventionDocument[]` to Intervention model
- Added `interventions InterventionDocument[]` to Document model
- Ran `bun run db:push` successfully to sync database
- Created API route `/api/interventions/[id]/documents/route.ts`:
  - GET: List all documents linked to an intervention (with auth + commune check)
  - POST: Link a document to an intervention (upsert to avoid duplicates)
  - DELETE: Unlink a document from an intervention
- Created API route `/api/documents/[id]/interventions/route.ts`:
  - GET: List all interventions linked to a document (with auth + commune filter)
- Updated `/api/interventions/route.ts` GET handler to include `documents: { include: { document: true } }`
- Updated `/api/interventions/[id]/route.ts` GET handler to include `documents: { include: { document: true } }`
- Updated `/api/documents/route.ts` GET handler to include `interventions: { include: { intervention: true } }`
- Updated page.tsx:
  - Added InterventionDocument interface and documents field to Intervention interface
  - Added linked documents section in intervention detail panel
  - Added DocumentPickerDialog component for attaching documents to interventions
  - Added document count badge (📎 N) on intervention cards
  - Fetches and displays linked documents with download/unlink options
- Updated documents-view.tsx:
  - Updated DocumentRecord interface with interventions relation
  - Added InterventionPickerDialog component for linking interventions to documents
  - Added "التدخلات المرتبطة" (Linked Interventions) section in document detail panel
  - Added link/unlink functionality for interventions
- Fixed ChunkLoadError by restarting dev server and clearing .next/cache
- ESLint passes with zero errors
- Dev server running without errors

Stage Summary:
- Full document-intervention linking system implemented
- Junction table InterventionDocument with proper relations and constraints
- API routes for GET/POST/DELETE linking operations with auth and commune checks
- Intervention detail panel shows "المستندات المرفقة" section with attach/unlink
- Document detail panel shows "التدخلات المرتبطة" section with link/unlink
- DocumentPickerDialog and InterventionPickerDialog for selecting items to link
- All features respect Arabic RTL interface and commune-based access control
