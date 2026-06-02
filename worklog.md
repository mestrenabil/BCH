---
Task ID: 1
Agent: Main
Task: Link intervention materials with inventory stock - deduction and dropdown

Work Log:
- Cleared .next cache to fix ChunkLoadError
- Added InterventionMaterial junction model to Prisma schema (interventionId, productId, quantity)
- Updated Product model to include interventions relation
- Updated Intervention model to include materials relation
- Ran prisma db push and prisma generate
- Created /api/products/for-dropdown API endpoint (returns only products with stock > 0)
- Updated /api/interventions POST route to accept materials array, validate stock, deduct quantities
- Updated /api/interventions/[id] PUT route to handle materials update (restore old stock, deduct new)
- Updated /api/interventions/[id] DELETE route to restore stock when deleting intervention
- Updated /api/interventions GET route to include materials with product info
- Updated InterventionFormDialog with dynamic materials list (product dropdown + quantity input)
- Updated map popup form with materials section (dynamic add/remove rows)
- Updated intervention popup display to show linked materials
- Updated InterventionsView to show materials info in list items
- Added product filtering by intervention type (DERATISATION, DESINSECTISATION, etc.)
- Tested full flow: create intervention with materials, verified stock deduction from 45→43 for رودينال

Stage Summary:
- Feature complete: Materials from inventory appear in dropdown when creating/editing interventions
- Stock is automatically deducted when intervention is created
- Stock is restored when intervention is deleted
- Stock is properly managed when intervention is updated (old quantities restored, new quantities deducted)
- Server-side validation prevents using more stock than available
- Backward compatible: old interventions without materials still work fine
- "Free text" material field kept for materials not in inventory

---
Task ID: 6-9
Agent: main
Task: Update frontend for commune filtering across map, inventory, and reports

Work Log:
- Read and analyzed the full page.tsx structure (~1500+ lines) to identify exact line numbers for all changes
- Updated `fetchStats` to include commune param via URLSearchParams (selectedCommune !== 'ALL' → params.set('commune', selectedCommune))
- Updated `fetchInterventions` to include commune param in the URLSearchParams spread
- Added `selectedCommune` to the useEffect dependency array that triggers fetchStats/fetchInterventions on filter changes
- Added `commune: string` field to Intervention interface
- Added `localCommuneFilter` state to InterventionsView component
- Updated `filteredInterventions` to filter by both statut and commune client-side
- Added commune dropdown select after the status filter in InterventionsView
- Added commune badge in each intervention card (after TYPE_LABELS badge) using COMMUNE_COLORS and COMMUNE_LABELS
- Added `commune: string` field to Product interface
- Added `filterCommune` state to InventoryView component
- Updated products fetch useEffect to include commune param and added filterCommune to dependency array
- Added commune dropdown select in InventoryView filter bar (after category buttons)
- Added الجماعة column header in products table
- Added الجماعة cell in products table body with commune badge (using COMMUNE_COLORS/COMMUNE_LABELS) or "مشترك" for empty
- Added commune select field in ProductFormDialog (after الفئة select) with "مشترك (كل الجماعات)" default option
- Updated handleSave in InventoryView to include commune in the data object sent to API
- ReportsView already shows commune badge and stats are now filtered by the global selectedCommune via fetchStats - no changes needed
- Map view interventions are already filtered by the global selectedCommune via fetchInterventions - no changes needed
- Ran lint: all checks passed with no errors
- Checked dev.log: API requests properly include commune parameter, no errors

Stage Summary:
- All 3 sections (map/interventions, inventory, reports) now support commune filtering
- Global header commune selector drives API-level filtering for stats and interventions
- Local commune dropdowns added in InterventionsView and InventoryView for additional client-side filtering
- Product form includes commune selection field
- Products table includes الجماعة column with visual badges
- Intervention cards display commune badges
---
Task ID: 1-9
Agent: main
Task: Add commune filtering across map interventions, inventory, and reports

Work Log:
- Added `commune` field to Product model in Prisma schema with default empty string
- Pushed schema changes to database with `prisma db push`
- Updated interventions API (GET) to accept `commune` query parameter
- Updated statistics API to accept `commune` query parameter  
- Updated products API (GET) to accept `commune` query parameter with OR logic (commune-specific + shared products)
- Updated products API (POST) to accept `commune` field
- Updated products API (PUT) to accept `commune` field
- Updated fetchStats to pass commune parameter
- Updated fetchInterventions to pass commune parameter
- Added selectedCommune to useEffect dependency array for auto-refresh
- Added localCommuneFilter to InterventionsView with dropdown
- Added commune badge in intervention cards
- Added filterCommune state to InventoryView with dropdown
- Added "الجماعة" column to products table header and body
- Added commune select field to ProductFormDialog
- Updated handleSave to include commune in product data
- Added commune to Intervention and Product interfaces
- Reports and Map views already filtered via API params

Stage Summary:
- Commune filtering works across all three sections: map, inventory, reports
- API-level filtering ensures efficient database queries
- Inventory shows both commune-specific and shared products when a commune is selected
- Product form includes commune selector
- All existing functionality preserved
---
Task ID: quartier-management
Agent: main
Task: Add quartier (neighborhood) CRUD management

Work Log:
- Added `commune` field to Quartier model in Prisma schema
- Pushed schema changes to database
- Created `/api/quartiers` API route with GET (with commune filter) and POST
- Created `/api/quartiers/[id]` API route with GET, PUT, DELETE
- Added `QuartierManagementSection` component in Settings view
  - List quartiers grouped by commune with colored badges
  - Search and filter by commune
  - Add/edit quartier dialog with name, commune, latitude, longitude
  - Delete confirmation dialog
- Updated Quartier interface to include `commune` field
- Updated intervention form quartier dropdown to show commune name next to quartier name
- Fixed lint error (setState in effect) by using proper useEffect pattern
- Cleared .next cache and restarted server for Prisma Client update

Stage Summary:
- Full CRUD for quartiers available in Settings page
- Quartiers can be filtered by commune
- Intervention form shows commune alongside quartier name for clarity
- All existing functionality preserved

---
Task ID: auth-system
Agent: main
Task: Add commune-based login system where each commune has its own responsible person who controls only their commune

Work Log:
- Added User and Session models to Prisma schema
- Created /lib/auth.ts with auth utilities
- Created auth API routes (login, logout, me, seed-users)
- Updated Zustand store with auth state
- Created LoginPage component with commune selection and login form
- Updated HomePage with auth flow (check auth, show login, load data only when authenticated)
- Updated header with user info and logout, locked commune selector for non-admin
- Updated mobile filters and sidebar with user info
- Added UserManagementSection in Settings
- Updated seed route to create default users
- Tested all auth APIs successfully

Stage Summary:
- Full commune-based authentication system implemented
- 4 default users: admin (all communes), sla (سلا), bouknadel (سيدي أبي القنادل), ameur (عامر)
- Commune responsable users can only see data for their own commune
- Admin user has access to all communes
- Session management with HTTP-only cookies (24h expiry)
- Beautiful RTL Arabic login page with commune selection
- User info displayed in header, sidebar, and footer
- Settings page includes user management section
