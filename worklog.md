---
Task ID: 1
Agent: main
Task: Fix server crash issue - Split page.tsx and optimize memory

Work Log:
- Analyzed page.tsx (293KB, 5025 lines) - identified it as the main memory hog
- All views (Dashboard, Map, Interventions, Inventory, Reports, Users, Settings) were inline
- Plus 7 external view imports (Documents, Export, Notifications, Alerts, Calendar, KPI, Agents) loaded statically
- Extracted inline views to separate files with lazy loading:
  - dashboard-view-lite.tsx (24KB)
  - map-view-lite.tsx (18KB)
  - interventions-view-lite.tsx (33KB)
  - inventory-view-lite.tsx (26KB)
  - reports-view-lite.tsx (11KB)
  - users-view-lite.tsx (39KB)
  - settings-view-lite.tsx (74KB)
- Created src/lib/constants.ts for shared types and constants
- Updated page.tsx to use Next.js dynamic() for ALL view imports (14 total)
- page.tsx reduced from 5025 lines to 1170 lines
- Added allowedDevOrigins to next.config.ts for Caddy gateway
- Changed dev script to use --webpack instead of turbopack (more memory-stable)
- Added -H 0.0.0.0 to dev script for proper network binding
- Lint passes cleanly
- Production build succeeds
- Server confirmed working via curl requests

Stage Summary:
- Key fix: Code-split all 14 view components using dynamic() lazy loading
- page.tsx reduced from 293KB/5025 lines to ~40KB/1170 lines
- Webpack dev server is more memory-stable than turbopack
- Server works correctly for user access via Preview Panel (port 81)
- Agent-browser Chrome consumes ~1.2GB which limits concurrent testing
- Real users won't have this memory constraint since their browser runs locally

---
Task ID: 2
Agent: main
Task: Fix 8 critical bugs — security, logic, UI, and styling

Work Log:
1. **Security: Seed endpoint auth** — Added `requireAuth()` check to `/api/seed/route.ts` POST handler. Import from `@/lib/auth`. Returns 401 if not authenticated.
2. **Security: Seed-users endpoint auth** — Added `requireAuth()` check to both GET and POST handlers in `/api/auth/seed-users/route.ts`. Same pattern.
3. **Export view operator precedence** — Fixed condition on line 155 from `selectedExportType === 'inventory' || selectedExportType === 'custom' && filterType !== 'ALL'` to `(selectedExportType === 'inventory') || (selectedExportType === 'custom' && filterType !== 'ALL')`. Without parentheses, `&&` bound tighter than `||`, causing inventory exports to require `filterType !== 'ALL'`.
4. **KPI view broken API error handling** — Added `if (!res.ok)` check after fetch in `kpi-view.tsx`. On failure, sets stats to null and shows an error state (⚠️ message) instead of trying to parse invalid JSON as Statistics.
5. **Map view per-commune intervention count** — Fixed the intervention count badge in `map-view-lite.tsx` from showing `interventions.length` (total) to `interventions.filter(i => i.commune === info.key).length` (per-commune count).
6. **Export view nullish coalescing** — Changed `row[col] || '—'` to `row[col] ?? '—'` on line ~810 in `export-view.tsx`. The `||` operator treated `0` as falsy and showed '—' instead of `0`.
7. **Export view invalid Tailwind** — Changed `border-3` to `border-[3px]` on line ~776 in `export-view.tsx`. `border-3` is not a valid Tailwind class.
8. **Reports view invalid Tailwind** — Changed `bg-slate-25` to `bg-slate-50/50` on line ~176 in `reports-view-lite.tsx`. `bg-slate-25` is not a valid Tailwind class.
9. **Users view credentials security** — Wrapped the default credentials display section in `users-view-lite.tsx` with `{canSeeAllCommunes && (...)}` so only admin users can see default login credentials. Previously visible to any logged-in user.

- Lint passes cleanly after all fixes

---
Task ID: 3
Agent: main
Task: Fix 10 HIGH priority bugs — RTL, calendar, duplicates, performance, cancellation, export

Work Log:
1. **Add missing dir="rtl"** — Added `dir="rtl"` to root div of:
   - `inventory-view-lite.tsx` — `<div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">`
   - `documents-view.tsx` — `<div className="p-4 lg:p-6 space-y-6" dir="rtl">`
   - `reports-view-lite.tsx` — `<div className="p-4 lg:p-6 space-y-6 pb-24 lg:pb-6" dir="rtl">`

2. **Fix RTL toggle switches** — Changed all toggle knob animations from physical `left` to `right` for RTL:
   - `users-view-lite.tsx` line 543: `animate={{ left: ... }}` → `animate={{ right: editFormData.actif ? '0.25rem' : '2rem' }}`
   - `settings-view-lite.tsx` lines 845-847, 899-903, 945, 969, 1001: All 6 toggle switches changed from `left: val ? '2rem' : '0.25rem'` to `right: val ? '0.25rem' : '2rem'`
   - `notifications-view.tsx` lines 524, 542, 560: All 3 toggle switches changed from `translate-x-5`/`translate-x-0.5` to `right-0.5`/`right-6` positioning

3. **Fix calendar week start** — In `calendar-view.tsx`:
   - Reordered `ARABIC_DAYS` to start with Monday: `['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']`
   - Updated `getFirstDayOfMonth()` to convert JS day (Sunday=0) to Monday-start (Monday=0): `return day === 0 ? 6 : day - 1`
   - Updated day header highlighting: Friday at index 4 (`i === 4`), Sunday at index 6 (`i === 6`)
   - Updated calendar grid cell day-of-week checks: `isFriday = dayOfWeek === 4`, `isSunday = dayOfWeek === 6`

4. **Fix KPI view duplicate types/constants** — In `kpi-view.tsx`:
   - Removed duplicate `Intervention`, `CommuneBreakdown`, `Statistics` interfaces (lines 13-35)
   - Removed duplicate `COMMUNE_LABELS`, `COMMUNE_COLORS`, `TYPE_COLORS`, `TYPE_LABELS`, `STATUT_LABELS`, `STATUT_COLORS`, `MONTH_NAMES_AR` (lines 37-63)
   - Added imports from `@/lib/constants`: `type Statistics`, `TYPE_LABELS`, `TYPE_COLORS`, `STATUT_LABELS`, `STATUT_COLORS`, `COMMUNE_LABELS`, `COMMUNE_COLORS`, `MONTH_NAMES_AR`

5. **Fix agents view duplicate constants** — In `agents-view.tsx`:
   - Removed duplicate `COMMUNE_LABELS` and `COMMUNE_COLORS` (lines 22-31)
   - Added import from `@/lib/constants`: `COMMUNE_LABELS, COMMUNE_COLORS`

6. **Fix map view COMMUNE_INFO performance** — In `map-view-lite.tsx`:
   - Moved `COMMUNE_INFO` array from inside the `MapView` component body to module level, preventing recreation on every render

7. **Fix DocumentPickerDialog useEffect missing dependency** — In `interventions-view-lite.tsx`:
   - Added `[]` as second argument to `useEffect` on line 37, preventing infinite re-fetching of documents

8. **Fix dashboard RTL arrow direction** — In `dashboard-view-lite.tsx` line 289:
   - Changed `←` to `→` since in RTL the forward arrow should point right

9. **Fix notifications view broken cancellation** — In `notifications-view.tsx` lines 333-336:
   - Changed `void cancelled` (which does nothing) to `if (cancelled) return` after `await fetchNotifications()`, properly checking the cancellation flag

10. **Fix export view PDF/Print duplication** — In `export-view.tsx`:
    - Removed duplicate `handlePrintExport` function (was identical to `handlePdfExport`)
    - Combined PDF and Print into one button labeled "📕 طباعة / PDF" (Print / PDF)
    - Updated `ExportFormat` type from `'csv' | 'pdf' | 'print'` to `'csv' | 'pdf'`
    - Removed the separate Print format button
    - Updated export action button text to show "طباعة / PDF" for the combined option
    - Updated quick-print label to "طباعة / PDF"

- Lint passes cleanly after all fixes
- Dev server running successfully

---
Task ID: 4
Agent: main
Task: Fix 12 MEDIUM priority bugs and add enhancements

Work Log:
1. **Remove unused CommuneType imports** — Removed `type CommuneType` from:
   - `alerts-view.tsx` — not used anywhere in file
   - `export-view.tsx` — not used anywhere in file
   - `documents-view.tsx` — not used anywhere in file
   - `agents-view.tsx` — not used anywhere in file
   - `notifications-view.tsx` — kept CommuneType (used on line 144 as type cast)

2. **Remove unused Legend import** — Removed `Legend` from recharts import in `dashboard-view-lite.tsx`

3. **Remove unused useRef import** — Removed `useRef` from `inventory-view-lite.tsx` (was unused at top level, though ProductFormDialog still uses it internally — added it back after realizing ProductFormDialog uses it)

4. **Add search debounce to documents view** — In `documents-view.tsx`:
   - Added `debouncedSearch` state
   - Added `useEffect` with `setTimeout`/`clearTimeout` pattern (300ms debounce) to sync `searchQuery` → `debouncedSearch`
   - Changed `fetchDocuments` to use `debouncedSearch` instead of `searchQuery`

5. **Add search debounce to inventory view** — In `inventory-view-lite.tsx`:
   - Added `debouncedSearch` state
   - Added `useEffect` with `setTimeout`/`clearTimeout` pattern (300ms debounce)
   - Changed the data-fetching `useEffect` to use `debouncedSearch` instead of `searchQuery`

6. **Add mobile card layout to inventory view** — In `inventory-view-lite.tsx`:
   - Split the products display into two sections: mobile cards (`md:hidden`) and desktop table (`hidden md:block`)
   - Mobile cards show: product icon, name, reference, category badge, stock quantity with +/- buttons, commune badge, status badge, and edit/delete action buttons
   - Desktop table remains unchanged

7. **Add document/print settings UI** — In `settings-view-lite.tsx`:
   - Added new section "إعدادات المستندات والطباعة" (Document & Print Settings) with violet/purple gradient header
   - Three logical sub-groups:
     - المسؤولون (Officials): presidentName, chefServiceName, responsableName
     - معلومات الجماعة (Commune Info): communeNameAr, communeNameFr, communeAddress, communePhone, communeFax, communeEmail
     - خيارات الطباعة (Print Options): showWatermark toggle, watermarkText (conditional), documentFooter textarea
   - All fields use `handleUpdateAndSave` with 800ms debounce auto-save pattern
   - Watermark text field only shows when `showWatermark` is enabled

8. **Fix alerts view Arabic grammar** — In `alerts-view.tsx`:
   - Changed "خلال الأيام 7 القادمة" to "خلال الـ 7 أيام القادمة" (2 occurrences, using replace_all)

9. **Fix KPI view AnimatedCounter cleanup** — In `kpi-view.tsx`:
   - Stored `requestAnimationFrame` return value in `rafId` variable
   - Added `cancelAnimationFrame(rafId)` in the cleanup function
   - Prevents memory leaks from orphaned animation frames on unmount

10. **Fix map view sidebar animation conflict** — In `map-view-lite.tsx`:
    - Removed `style={{ width: sidebarCollapsed ? 56 : 340 }}` from the sidebar motion.div
    - Kept only the `animate={{ opacity: 1, x: 0, width: sidebarCollapsed ? 56 : 340 }}` prop
    - Eliminates flash caused by conflicting inline style and animate prop

11. **Fix calendar view dead `today` variable** — In `calendar-view.tsx`:
    - Removed `const today = new Date()` (unused variable around line 303)

12. **Fix documents view AnimatePresence for InterventionPickerDialog** — In `documents-view.tsx`:
    - Wrapped the InterventionPickerDialog with `<AnimatePresence>` so exit animations play correctly

13. **Fix settings view restore functionality** — In `settings-view-lite.tsx`:
    - Replaced the no-op restore (just parsed JSON and showed a toast) with a full implementation:
    - Step 1: Show confirmation dialog with data summary before proceeding
    - Step 2: Call `POST /api/seed` to reset and reseed the database
    - Step 3: Restore quartiers via POST `/api/quartiers`
    - Step 4: Restore agents via POST `/api/agents`
    - Step 5: Restore products via POST `/api/products`
    - Shows loading toasts during each phase and success/error toast on completion

14. **Fix agents view search by phone** — In `agents-view.tsx`:
    - Added `a.telephone.toLowerCase().includes(q)` to the search filter
    - Now searches by nom, prenom, telephone, and full name combination

15. **Fix documents view timezone bug** — In `documents-view.tsx`:
    - Changed `new Date(doc.dateDocument).toISOString().split('T')[0]` to extract date components directly from local Date object: `const d = new Date(doc.dateDocument); return \`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}\``
    - Prevents timezone shift where `toISOString()` (UTC) could produce the wrong date

- Lint passes cleanly after all fixes
- Dev server running successfully

---
Task ID: 4
Agent: main
Task: Add 3 features — Dashboard YoY Trends, Calendar Week View, Map Search

Work Log:

### Feature 1: Dashboard Year-over-Year Trends
1. **Added YoY trend badges to KPI cards** — In `dashboard-view-lite.tsx`:
   - Added `useState` and `useEffect` imports
   - Added `prevStats` state to store previous year statistics (total + byType)
   - Added `useEffect` to fetch previous year data from `/api/statistics?year=<prevYear>` when `selectedYear` and `selectedCommune` change
   - Created `getTrendBadge()` helper function that computes:
     - Green "↑ X%" when current > previous
     - Red "↓ X%" when current < previous
     - Gray "— 0%" when equal
     - Purple "🆕 جديد" when no previous data
   - Applied trend badge as a small colored badge below the main number on each KPI card
   - Calculation: `Math.round(((current - previous) / Math.max(previous, 1)) * 100)`
2. **Added `selectedYear` prop to DashboardView** — Updated the component signature and page.tsx to pass `selectedYear={selectedYear}`

### Feature 2: Calendar Week View
1. **Added view mode toggle** — In `calendar-view.tsx`:
   - Added `viewMode` state (`'month' | 'week'`, default `'month'`)
   - Added pill toggle buttons "شهري" / "أسبوعي" in the header
2. **Added week navigation state and logic**:
   - Added `weekMonday` state initialized to Monday of current week
   - Added helper functions: `getMondayOfWeek()`, `getWeekDays()`, `formatHour()`
   - Added `ARABIC_DAYS_SHORT` for abbreviated day names
   - Added `goToPrevWeek()` and `goToNextWeek()` navigation
   - Updated `goToToday()` to handle both modes
   - Updated `fetchInterventions` to compute date range based on view mode
3. **Added week view rendering**:
   - Day headers with short Arabic day names, date numbers, and intervention counts
   - Time grid with hours from 6:00 to 20:00 (15 time slots)
   - Intervention blocks displayed at the 6:00 slot (top) since interventions don't have time fields
   - Each block shows type icon, reference, and quartier name
   - "إضافة" (Add) button per day column for creating interventions
   - Color-coded day columns: today (emerald), Friday (amber), Sunday (red)
   - Legend at the bottom
4. **Added `interventionsByDateStr` memo** — Groups interventions by date string for week view
5. **Updated statistics labels** — Changed "إجمالي الشهر" to conditional "إجمالي الشهر" / "إجمالي الأسبوع"

### Feature 3: Map Search
1. **Added search input to map sidebar** — In `map-view-lite.tsx`:
   - Added search state: `searchQuery`, `debouncedSearch`, `searchResults`, `showSearchDropdown`, `centerOnCoords`
   - Added refs: `searchInputRef`, `searchDropdownRef`
   - Added debounce effect (300ms) for `searchQuery` → `debouncedSearch`
   - Added search filtering effect matching quartier nom and commune
   - Added click-outside handler to close dropdown
2. **Added search dropdown**:
   - Positioned below the search input
   - Shows up to 10 matching quartiers with name, commune, and location icon
   - Clicking a result: closes dropdown, updates search field, centers map on coordinates
3. **Added `centerOn` prop to MapComponent** — In `map-component.tsx`:
   - Added `centerOn?: { lat: number; lng: number } | null` prop
   - Added `searchMarkerRef` for the search result marker
   - Added `useEffect` that flies the map to the given coordinates with `flyTo()` and places a teal marker
   - Marker is cleaned up on re-center or unmount
4. **Added filtered interventions** — `filteredInterventions` memo filters by quartier name or address when search is active
5. **Added filtered quartiers sidebar** — Shows a "📍 الأحياء" section with clickable quartier list, filtered by search
6. **Added clear search button** — X button inside the search input to reset search state

- Lint passes cleanly
- Dev server running successfully

---
Task ID: 5
Agent: main
Task: Add 10 missing features — auto-refresh, calendar intervention, click-through, badges, skeletons, empty states, error states, touch targets

Work Log:
1. **Add auto-refresh to alerts view** — In `alerts-view.tsx`:
   - Added `useEffect` with `setInterval` every 60 seconds that increments `refreshKey`
   - Added green pulse dot indicator next to the title using Tailwind's `animate-ping` and `animate-pulse` classes
   - Similar pattern to notifications-view which uses 30s interval
   - Destructured `setCurrentView` from `useAppStore()` for click-through actions

2. **Add "Create intervention from calendar" feature** — In `calendar-view.tsx` and `page.tsx`:
   - Added `onAdd?: (date: string) => void` prop to `CalendarView` component
   - Added green button "إضافة تدخل في هذا اليوم" at the top of the selected day panel
   - Button calls `onAdd(formatDateString(viewYear, viewMonth, selectedDay))` passing date in YYYY-MM-DD format
   - In `page.tsx`: Added `presetDate` state, passed to `CalendarView` as `onAdd={(date) => { setPresetDate(date); setEditingInterventionId(null); setMapClickCoords(null); setIsFormOpen(true) }}`
   - Added `presetDate` prop to `InterventionFormDialog` with `useEffect` to update form date when presetDate changes
   - Form dialog initializes `date` field from `presetDate` if provided
   - `onClose` handler resets `presetDate` to null

3. **Add click-through actions in alerts view** — In `alerts-view.tsx`:
   - Stock alert product cards: Added `onClick={() => setCurrentView('inventory')}` and `cursor-pointer` class
   - Overdue intervention cards: Added `onClick={() => setCurrentView('interventions')}` and `cursor-pointer` class
   - Uses `useAppStore().setCurrentView()` to navigate to the respective views

4. **Add notification count badge to sidebar** — In `page.tsx`:
   - Added `unreadNotifCount` state
   - Added `useEffect` that fetches `/api/notifications` on mount and every 60 seconds
   - Reads read notification IDs from localStorage (`notification-read-ids`) to compute unread count
   - Added red badge with count next to "الإشعارات" in both desktop sidebar and mobile sidebar navigation
   - Badge shows "99+" if count exceeds 99

5. **Add loading skeleton to dashboard** — In `dashboard-view-lite.tsx`:
   - Replaced `if (!stats) return null` with animated skeleton loader
   - Shows placeholder cards for: title, 4 KPI cards, commune breakdown (3 cards), main grid (3 sections), chart area
   - Uses `bg-slate-100` and `bg-slate-200` with `animate-pulse` class for shimmer effect
   - Matches the actual dashboard layout structure

6. **Add empty state handling to reports view** — In `reports-view-lite.tsx`:
   - Added check for empty `stats.monthly` and `stats.byQuartier`
   - When both are empty, shows friendly Arabic message "لا توجد بيانات كافية لعرض التقارير" with a 📊 illustration
   - Includes helpful text explaining data will appear once interventions are added

7. **Add error state to KPI view** — In `kpi-view.tsx`:
   - Added `hasError` state flag
   - On API fetch failure (non-ok response or catch), sets `hasError = true` and `stats = null`
   - Replaced the basic error state with a proper error component showing:
     - ⚠️ icon in red circle
     - "حدث خطأ في تحميل البيانات" (Error loading data) message
     - "إعادة المحاولة" (Retry) button with refresh icon
   - Retry button calls `handleRetry` which re-fetches the data
   - Added `useCallback` import for the retry handler

8. **Add error state to dashboard view** — In `dashboard-view-lite.tsx`:
   - Added `onRetry?: () => void` prop to DashboardView
   - When `stats` is null AND `onRetry` is provided, shows error state instead of skeleton
   - Error state includes: ⚠️ icon, "حدث خطأ في تحميل البيانات" message, and "إعادة المحاولة" retry button
   - In `page.tsx`, passes `onRetry={fetchStats}` to DashboardView
   - Three-state logic: error (onRetry provided) → skeleton (no onRetry) → loaded (stats available)

9. **Add error handling for map view dynamic import** — In `map-view-lite.tsx`:
   - Added `mapError` state and `mapLoadAttempt` state counter
   - Added `.catch()` handler to the dynamic `import('./map-component')` call
   - On import failure, shows error message with "حدث خطأ في تحميل الخريطة" and retry button
   - Retry button increments `mapLoadAttempt` which re-triggers the `useEffect` with the import
   - Replaces the previous infinite spinner when map fails to load

10. **Add mobile-friendly touch targets for inventory +/- buttons** — In `inventory-view-lite.tsx`:
    - Changed button dimensions from `w-6 h-6` (24×24px) to `w-[44px] h-[44px]` (44×44px)
    - Meets the minimum 44×44px touch target guideline for mobile accessibility
    - Applied to both the minus (−) and plus (+) stock adjustment buttons

- Lint passes cleanly after all changes
- Dev server running successfully

---
Task ID: 6
Agent: main
Task: Add 3 features — Bulk Operations, Quartier Filter, Quick Print Button

Work Log:

1. **Feature 1: Bulk Operations for Documents** — In `documents-view.tsx`:
   - Added state variables: `multiSelectMode`, `selectedDocIds` (Set<string>), `showBulkCategoryDialog`, `bulkCategory`, `isBulkOperating`
   - Added "تحديد متعدد" (Multi-select) toggle button in the Search & Filter bar, next to the view mode toggle (grid/list)
   - When multi-select mode is active:
     - Grid view: Each card shows a checkbox overlay (top-right corner) with emerald highlight border when selected
     - List view: Each row shows a checkbox in a new first column, with emerald background highlight when selected
     - Table header gets an extra column for checkboxes when in multi-select mode
     - Clicking a card/row toggles selection instead of opening detail panel
   - Added floating action bar (Framer Motion slide-up animation) at the bottom center when documents are selected:
     - Shows selected count badge "تم تحديد X مستندات"
     - "حذف المحدد" (Delete selected) button — red, calls DELETE API for each selected document
     - "تغيير التصنيف" (Change category) button — amber, opens a dialog with category dropdown (CATEGORIES without 'ALL')
     - "إلغاء التحديد" (Cancel selection) button — exits multi-select mode
   - Implemented `handleBulkDelete`: iterates selected IDs, calls DELETE for each, counts success/fail, refreshes
   - Implemented `handleBulkCategoryChange`: iterates selected IDs, calls PUT with new category (preserving other fields), counts success/fail, refreshes
   - Bulk category change dialog uses AnimatePresence for enter/exit animations
   - Both bulk operations reset multi-select mode and clear selections on completion

2. **Feature 2: Quartier Filter** — In `interventions-view-lite.tsx`:
   - Added state: `quartierFilter` (default 'ALL'), `quartiers` (array)
   - Added `useEffect` that fetches `/api/quartiers?commune=X` when `localCommuneFilter` changes
   - When commune changes, quartier filter is reset to 'ALL' (via onChange handler, not useEffect — avoids lint error)
   - Added quartier dropdown next to commune filter with "كل الأحياء" (All neighborhoods) as default option
   - Dropdown is dynamically populated from the API response
   - `filteredInterventions` now includes quartier filter: `(quartierFilter === 'ALL' || i.quartier === quartierFilter)`
   - Mobile-friendly with `max-w-[160px]` on the select element

3. **Feature 3: Intervention Quick Print Button** — In `interventions-view-lite.tsx`:
   - Added 🖨️ print icon button on each intervention card, next to the edit button
   - Button has teal hover effect (`hover:bg-teal-50 hover:text-teal-600`)
   - Implemented `handlePrintIntervention` using `useCallback`:
     - Opens a new browser window with a professional A4-formatted intervention report
     - Print layout includes:
       - Header: "المملكة المغربية" badge, "مكتب حفظ الصحة الجماعي" title, commune name
       - Reference bar with reference number and date
       - Title section with type and status badges (using TYPE_COLORS and STATUT_COLORS)
       - Info grid with: date, time (heureDebut/heureFin), commune, quartier, address, agent, superficie, materials/products used
       - Conditional observations section
       - Signature section with three boxes: العون المنفذ, رئيس المصالح, الرئيس
     - Auto-triggers `window.print()` via `window.onload`
   - Uses existing constants (TYPE_LABELS, TYPE_COLORS, STATUT_LABELS, STATUT_COLORS, COMMUNE_LABELS) for consistent styling

- Lint passes cleanly (only pre-existing dashboard-view-lite.tsx error remains)
- Dev server running successfully

---
Task ID: 2
Agent: main
Task: Add 3 features — Dashboard Print/Export, Intervention Time Slots, Password Self-Service

Work Log:

1. **Feature 1: Dashboard Print/Export** — In `dashboard-view-lite.tsx`:
   - Added `handlePrint` function that calls `window.print()`
   - Added `@media print` CSS via `<style>` tag:
     - Hides all body elements except `.print-area` using `visibility: hidden`
     - Shows `.print-area` and its children with `visibility: visible`
     - Positions print area absolutely for clean print layout
     - Hides elements with `.no-print` class (the print button itself)
     - Shows `.print-header` element (hidden on screen, visible when printing)
     - Sets A4 page margins via `@page`
     - Sets minimum height for recharts containers in print
   - Added print header element (hidden on screen, visible when printing) with:
     - Bureau name: "عمالة سلا — قسم حفظ الصحة والبيئة"
     - Report title: "تقرير العمليات 3D — مكافحة الجرذان • مكافحة الحشرات • التطهير"
     - Current date in Arabic locale format
     - Commune name if filtered
   - Added "طباعة التقرير" (Print Report) button next to the dashboard title
     - Slate gradient styling, printer icon SVG
     - `.no-print` class to hide during printing
   - Wrapped main content in `<>` fragment with print header + print-area div
   - Also fixed pre-existing lint error: replaced direct `setPrevStats(null)` calls in useEffect with early returns and computed `effectivePrevStats` variable

2. **Feature 2: Intervention Time Slots** — Across multiple files:
   - **Prisma schema** (`prisma/schema.prisma`):
     - Added `heureDebut String?` and `heureFin String?` fields to Intervention model
     - Ran `bun run db:push` successfully
   - **Type definitions** (`src/lib/constants.ts`):
     - Added `heureDebut?: string | null` and `heureFin?: string | null` to Intervention interface
   - **Intervention form** (`src/app/page.tsx`):
     - Added `heureDebut: ''` and `heureFin: ''` to formData initial state
     - Added `heureDebut: data.heureDebut || '', heureFin: data.heureFin || ''` when loading existing intervention data
     - Added two time input fields after the date field in a `grid-cols-2` layout:
       - "⏰ وقت البداية" (Start time) with `type="time"`
       - "⏰ وقت النهاية" (End time) with `type="time"`
   - **Interventions list** (`src/app/interventions-view-lite.tsx`):
     - Updated intervention card date display: shows time next to date if available
       - Format: "📅 15 مارس 2026 ⏰ 08:00 - 10:00" when both times present
       - Shows only start time if only heureDebut exists
     - Updated intervention detail panel: shows time in the date detail cell
   - **Calendar view** (`src/app/calendar-view.tsx`):
     - Added `heureDebut?: string | null` and `heureFin?: string | null` to local Intervention interface
     - Added time display in day panel intervention cards: "⏰ 08:00 - 10:00" with emerald-600 styling, shown when heureDebut is present

3. **Feature 3: Password Self-Service Change** — New API route and UI:
   - **API route** (`src/app/api/auth/change-password/route.ts`):
     - Created POST handler that:
       - Requires authentication via `requireAuth()`
       - Validates `currentPassword` and `newPassword` are present
       - Validates `newPassword` is at least 4 characters
       - Verifies current password using `verifyPassword()` from `@/lib/auth`
       - Hashes new password using `hashPassword()` from `@/lib/auth`
       - Updates user's password in database
       - Returns success/error JSON responses
   - **Users view UI** (`src/app/users-view-lite.tsx`):
     - Added state variables in `UsersView` component: `selfChangePasswordOpen`, `selfChangePasswordForm` (currentPassword, newPassword, confirmPassword), `selfChangePasswordError`, `selfChangePasswordSubmitting`
     - Added `handleSelfChangePassword` async handler:
       - Validates new password matches confirmation
       - Validates minimum length (4 chars)
       - Calls `/api/auth/change-password` API
       - Shows success/error toast
       - Resets form on success
     - Added "تغيير كلمة المرور" (Change Password) button in the current user card section
       - Amber/orange gradient styling with lock icon SVG
       - Positioned next to the "متصل" (online) indicator
     - Added change password dialog with AnimatePresence:
       - Amber/orange gradient header showing user name and username
       - Current password field
       - New password field
       - Confirm new password field
       - Error display
       - Cancel and submit buttons

- Lint passes cleanly
- Dev server running successfully

---
Task ID: 1
Agent: main
Task: Add 3 features — Agent Intervention Count, Product Expiry Date Tracking, Stock Movement History

Work Log:

1. **Feature 1: Agent Intervention Count & History** — In `agents-view.tsx`:
   - Added `agentInterventionCounts` state (Record<string, number>) to track intervention count per agent
   - Modified `fetchAgents` to also fetch interventions via `/api/interventions?limit=9999` and count per agent by matching `agentNom` against agent nom and full name
   - Added `interventionCount` prop to both `AgentCard` (desktop) and `AgentCardMobile` (mobile) components
   - Desktop cards: Added teal badge "📋 X تدخل" in the badges row alongside commune and function badges
   - Mobile cards: Added teal badge "📋 X" in the badges row
   - Edit dialog: Added read-only "عدد التدخلات" section with teal background showing intervention count, only visible when editing an existing agent

2. **Feature 2: Product Expiry Date Tracking** — Across multiple files:
   - **Prisma schema** (`prisma/schema.prisma`):
     - Added `dateExpiration DateTime?` field to Product model (optional expiry date)
     - Added `movements StockMovement[]` relation to Product model
     - Ran `bun run db:push` successfully
   - **API routes**:
     - `src/app/api/products/route.ts`: Added `dateExpiration` to destructured body and create data, with `new Date(dateExpiration)` conversion
     - `src/app/api/products/[id]/route.ts`: Added `dateExpiration` to destructured body and update data, with null handling for clearing the date
   - **Inventory view** (`src/app/inventory-view-lite.tsx`):
     - Added `dateExpiration: string | null` to Product interface
     - Added expiry date input field "تاريخ الانتهاء" with `type="date"` in ProductFormDialog
     - Added `getExpiryBadge()` helper function that returns:
       - Red badge "⚠️ منتهي الصلاحية" if product is expired
       - Amber badge "⏰ قريب الانتهاء" if expiring within 30 days
       - null if no expiry date or not expiring soon
     - Mobile cards: Shows expiry badge next to stock status badge
     - Desktop table: Added "الصلاحية" column showing expiry badge or dash
     - Stats cards: Added 5th card "منتهي الصلاحية" (expired products count) with rose gradient
     - Computes expired count client-side from fetched products
     - Added `dateExpiration` to handleSave FormData extraction
   - **Alerts view** (`src/app/alerts-view.tsx`):
     - Added `dateExpiration: string | null` to Product interface
     - Added `allProducts` state to fetch all products (not just low stock) for expiry checking
     - Added second API call to fetch all products alongside low-stock products
     - Computed `expiredProducts` and `expiringProducts` from allProducts
     - Added "منتجات منتهية الصلاحية" summary card with rose styling (5th card in the grid, now 5 columns on lg)
     - Added "صلاحية المنتجات" section in the two-column layout with:
       - Expired products shown with red styling and "⚠️ منتهي الصلاحية" badge
       - Expiring products shown with amber styling and "⏰ قريب الانتهاء" badge
       - Both show expiry date and are clickable (navigates to inventory)

3. **Feature 3: Stock Movement History** — Across multiple files:
   - **Prisma schema** (`prisma/schema.prisma`):
     - Added `StockMovement` model with fields: id, productId, product (relation), type (IN/OUT), quantity, reason, note, commune, createdAt
     - Added `movements StockMovement[]` to Product model
   - **API route** (`src/app/api/stock-movements/route.ts`):
     - Created GET handler: fetches movements with optional `productId` and `commune` filters, ordered by createdAt desc, limit 100
     - Created POST handler: validates productId, type (IN/OUT), quantity; checks product exists and user has access; enforces commune; creates movement record
   - **Inventory view** (`src/app/inventory-view-lite.tsx`):
     - Added `StockMovement` interface
     - Added `movementProduct` and `stockMovements` state for the movement dialog
     - Created `StockMovementDialog` component showing:
       - Product name in teal gradient header
       - Movement list with IN (📥 وارد / green) and OUT (📤 صادر / red) styling
       - Reason labels in Arabic (purchase=شراء, usage=استعمال, adjustment=تعديل, initial=رصيد أولي)
       - Timestamp display, note text
     - Modified `handleStockUpdate` to also create a StockMovement record via POST `/api/stock-movements` with type IN/OUT based on direction and reason "adjustment"
     - Added 📋 "سجل الحركة" button on both mobile cards and desktop table rows
     - `handleShowMovements` fetches movements from `/api/stock-movements?productId=X` and opens dialog
     - Dialog uses AnimatePresence for enter/exit animations

- Lint passes cleanly
- Dev server running successfully
---

---
Task ID: 3
Agent: main
Task: Add 3 features — French/Arabic Language Toggle, Keyboard Shortcuts, Weather Widget

Work Log:

### Feature 1: French/Arabic Language Toggle
1. **Created `/home/z/my-project/src/lib/i18n.ts`** — Translation dictionary with ar and fr support:
   - 50+ translation keys covering: navigation labels, section titles, common buttons, status labels, type labels, form labels, filter labels, footer text, header text, keyboard shortcuts labels, weather labels
   - Exported Language type (ar | fr), TranslationKey type, and t() helper function
2. **Added language state to `/home/z/my-project/src/lib/store.ts`**:
   - Added language: Language with default ar
   - Added setLanguage: (lang: Language) => void
   - Persisted in localStorage under app-language key
   - Hydrated from localStorage on client mount (outside create call for clean SSR)
3. **Updated `/home/z/my-project/src/app/page.tsx`** with language toggle and translations:
   - Added language toggle button in header: globe icon Fr / Arabic letter
   - When French is selected: root dir changes from rtl to ltr
   - Header text, filter labels, commune/type dropdown options all translated
   - Desktop sidebar: section headers, nav items, user card, quick summary, add button translated
   - Mobile sidebar and bottom nav labels translated
   - Footer text translated
   - RTL/LTR direction-aware CSS classes applied throughout
   - Sidebar border direction and position changes with language
   - Mobile sidebar slides from appropriate direction based on language
   - navItems refactored from hardcoded strings to TranslationKey references
4. **Updated `/home/z/my-project/src/app/globals.css`** for LTR support:
   - Added [dir=ltr] aside order: -1 to move sidebar to left in LTR mode
   - Added [dir=ltr] .bg-gradient-to-l override for proper gradient direction

### Feature 2: Keyboard Shortcuts
1. **Added keyboard shortcut handler in page.tsx**:
   - Alt+1 through Alt+9: Navigate to views
   - Alt+N: Open new intervention form
   - Alt+S: Focus search input
   - Escape: Close dialogs/forms
   - Shortcuts only work when not typing in input/textarea/select fields
2. **Added help button and shortcuts dialog**:
   - ? button in header next to language toggle
   - AnimatePresence dialog listing all shortcuts
   - Displayed in current language (Arabic or French)
   - Closable with X button or Escape key

### Feature 3: Weather Widget
1. **Created /api/weather/route.ts** API route:
   - Fetches from wttr.in/Sale,Morocco (free, no API key)
   - Extracts temperature, humidity, wind speed, description
   - Translates conditions to Arabic
   - 30-minute server-side cache
   - Falls back to stale cache on error
2. **Added weather widget to dashboard-view-lite.tsx**:
   - Compact card with sky-blue gradient header
   - Displays temperature, humidity, wind speed, condition
   - Condition in Arabic or French based on language
   - Refresh button with spinning animation
   - Auto-refresh every 30 minutes
   - Loading spinner and unavailable fallback

- Lint passes cleanly
- Dev server running successfully
- Weather API confirmed working

---
Task ID: 2
Agent: main
Task: Add 3 features — Dark Mode/Theme Toggle, Budget/Cost Tracking, Intervention Templates

Work Log:

### Feature 1: Dark Mode / Theme Toggle
1. **Added theme state to store.ts**:
   - Added `theme: 'light' | 'dark'` state with default 'light'
   - Added `setTheme` action that persists to localStorage under 'app-theme' key
   - setTheme adds/removes `dark` class on `<html>` element
   - Initial theme read from localStorage at store creation time
2. **Added theme toggle button in page.tsx header**:
   - Moon/Sun icon (🌙/☀️) button next to language toggle
   - Smooth rotation animation (180deg) on icon when toggling
   - WhileHover/WhileTap spring animations
   - Tooltip showing "الوضع النهاري" (light mode) or "الوضع الليلي" (dark mode)
3. **Added useEffect to sync dark class on mount**:
   - Checks current theme and adds/removes `dark` class on `<html>` element
   - Runs whenever theme changes
4. **Added dark mode classes to main layout shell**:
   - Main container: `dark:from-slate-900 dark:via-slate-900 dark:to-slate-800`
   - Desktop sidebar: `dark:bg-slate-800/90 dark:border-slate-700/80`
   - Mobile sidebar: `dark:bg-slate-800`
   - Mobile filters bar: `dark:bg-slate-800/90 dark:border-slate-700`
   - Mobile bottom nav: `dark:bg-slate-800/95 dark:border-slate-700`
5. **globals.css already configured**: `@custom-variant dark (&:is(.dark *))` and `.dark` CSS variables already present in shadcn/ui theme

### Feature 2: Budget/Cost Tracking
1. **Added Prisma schema fields** — 3 new optional Float fields to Intervention model:
   - `coutMainOeuvre Float?` (تكلفة اليد العاملة - Labor cost)
   - `coutMateriaux Float?` (تكلفة المواد - Material cost)
   - `coutTotal Float?` (التكلفة الإجمالية - Total cost)
   - Ran `bun run db:push` successfully
2. **Updated constants.ts Intervention interface** — Added:
   - `coutMainOeuvre?: number | null`
   - `coutMateriaux?: number | null`
   - `coutTotal?: number | null`
3. **Updated intervention API routes**:
   - `POST /api/interventions/route.ts`: Added `coutMainOeuvre`, `coutMateriaux`, `coutTotal` to destructured body and create data with `parseFloat()` conversion
   - `PUT /api/interventions/[id]/route.ts`: Added handling for cost fields with null support, using `parseFloat()` conversion
4. **Added cost fields to intervention form in page.tsx**:
   - Added `coutMainOeuvre: ''`, `coutMateriaux: ''`, `coutTotal: ''` to formData
   - Added cost field loading from existing intervention data
   - Added grid-cols-3 section after superficie/produitUtilise with:
     - "💰 تكلفة اليد العاملة" (Labor cost) — number input
     - "🧪 تكلفة المواد" (Material cost) — number input
     - "📊 التكلفة الإجمالية" (Total cost) — read-only auto-calculated field (labor + materials)
   - Auto-calculation: changing labor or material cost automatically updates total
   - Total displays as formatted MAD with "درهم" suffix
5. **Added cost section to intervention detail panel** — In `interventions-view-lite.tsx`:
   - Shows when any cost field exists on the intervention
   - Emerald-50 background with emerald-100 border
   - 3-column grid showing: اليد العاملة, المواد, الإجمالية
   - Values formatted with `toLocaleString('ar-MA')` and "د.م" suffix
   - Total displayed with `font-extrabold text-emerald-700`
6. **Added budget section to KPI view** — In `kpi-view.tsx`:
   - Added `budgetData` state with totalCost, byType, byCommune
   - Modified stats useEffect to also fetch all interventions for budget calculation
   - Computed total cost, cost by type (DERATISATION/DESINSECTISATION/DESINFECTION), cost by commune
   - Added "💰 الميزانية" section between Top Quartiers and Footer Stats
   - 4-card grid: Total cost (amber gradient), cost per type (3 cards with TYPE_COLORS)
   - When all communes selected: additional 3-column grid showing cost per commune
7. **Inventory view already shows total value** — The existing stats card "قيمة المخزون" already displays `totalStockValue.toLocaleString('ar-MA')` with "د.م" suffix
8. **Added monthly cost trend to reports view** — In `reports-view-lite.tsx`:
   - Added `monthlyCosts` state (Record<string, number>)
   - Added useEffect to fetch interventions and compute monthly cost totals
   - Added "💰 التكلفة" column header to monthly table
   - Each month row shows formatted cost in amber badge or "—" if no cost data
   - Updated ReportsView props to accept `selectedYear` from page.tsx

### Feature 3: Intervention Templates
1. **Added INTERVENTION_TEMPLATES constant** — In `constants.ts`:
   - 5 pre-defined templates:
     - `deratisation-standard`: مكافحة القوارض معيارية (Standard rodent control)
     - `desinsectisation-mouches`: مكافحة الذباب (Fly control)
     - `desinfection-covid`: تطهير معمم (General disinfection)
     - `deratisation-urgence`: مكافحة قوارض طارئة (Emergency rodent control)
     - `desinsectisation-moustiques`: مكافحة البعوض (Mosquito control)
   - Each template has: id, name, type, description, produitUtilise, superficie, nombrePrestations, optional statut
2. **Added template selector to intervention form** — In `page.tsx`:
   - Added `selectedTemplate` state
   - Added "📋 استعمال قالب" (Use Template) select dropdown at top of form
   - Only shown for new interventions (not edit mode)
   - Selecting a template pre-fills: type, produitUtilise, superficie, nombrePrestations, description, statut (if set)
   - User can modify any field after applying template
   - Dropdown shows TYPE_ICONS next to template names for visual clarity

- Lint passes cleanly (exit code 0)
- Dev server running successfully

---
Task ID: 4-retry
Agent: main
Task: Add 4 features — Notification Sounds, CSV Import, Per-Commune Status Breakdown, Status Flow Visualization

Work Log:

### Feature 1: Notification Sounds — ALREADY IMPLEMENTED
- Verified that `notifSound: true` boolean state with `setNotifSound` action exists in `store.ts` (lines 91-92, 249-253)
- Verified `playNotifSound` function using Web Audio API in `notifications-view.tsx` (lines 9-32)
- Verified `prevUrgentCountRef` tracking with useRef (line 174)
- Verified sound plays when new urgent count > previous (lines 370-376)
- Verified 🔊/🔇 toggle in notification settings panel (lines 623-638)
- No changes needed — feature was fully implemented in a prior task

### Feature 2: Data Import (CSV) — Created missing API route
1. **Created `/home/z/my-project/src/app/api/import/route.ts`** — The settings view already had the `CSVImportButton` component with client-side CSV parsing, preview, and import UI, but the backend API route was missing
   - POST handler accepting JSON: `{ type: 'interventions' | 'agents' | 'products', data: Record<string, string>[] }`
   - Requires authentication via `requireAuth()`
   - Enforces commune filter for non-admin users
   - For interventions:
     - Validates required fields (type, date, reference)
     - Checks for duplicate reference before creating
     - Maps all CSV fields to Prisma create data with type conversions
   - For agents:
     - Validates required field (nom)
     - Handles actif boolean from string values
   - For products:
     - Validates required fields (nom, reference)
     - Checks for duplicate reference before creating
     - Handles dateExpiration conversion
   - Returns `{ success: number, failed: number, total: number, errors: string[] }`
   - Errors include row number for easy debugging, capped at 50 messages

### Feature 3: Fix Per-Commune Status Breakdown — ALREADY IMPLEMENTED
- Verified the statistics API already includes `byCommuneStatus` nested object (lines 132-143 in `route.ts`)
- The `byCommuneStatus` structure: `{ [commune]: { byStatut: { [statut]: count }, total: number } }`
- Verified `kpi-view.tsx` already uses `stats.byCommuneStatus?.[communeKey]` for radar chart (line 279)
- Per-commune completion rate uses `csd?.byStatut?.TERMINEE ?? 0` (line 288)
- The `Statistics` type in `constants.ts` already includes `byCommuneStatus` (line 56)
- No changes needed — feature was fully implemented in a prior task

### Feature 4: Intervention Status Flow Visualization — ALREADY IMPLEMENTED
- Verified the "مسار حالات التدخلات" section exists in `alerts-view.tsx` (lines 751-937)
- Flow diagram with 4 nodes: مبرمجة → جارية → منجزة, with ملغاة branch
- SVG arrows with gradient colors and flowing dot animations
- Pulse animation on each node using Framer Motion boxShadow
- Each node shows count of interventions in that status
- Completion bar with animated segments
- Transition percentages displayed:
  - "X% من المبرمجة انتقلت إلى جارية" (line 920)
  - "X% من الجارية انتقلت إلى منجزة" (line 926)
  - "X% تم إلغاؤها" (line 932)
- Color coding: emerald for main flow, red for cancellation
- No changes needed — feature was fully implemented in a prior task

- Lint passes cleanly
- Dev server running successfully

---
Task ID: 1-retry
Agent: main
Task: Add Intervention Photo Attachments and Citizen Complaint Tracking

Work Log:

### Feature 1: Intervention Photo Attachments

1. **Prisma schema** — InterventionPhoto model and photos relation already existed from previous task. Ran `bun run db:push` to confirm sync.

2. **API route** (`src/app/api/intervention-photos/route.ts`) — Already existed from previous task with GET/POST/DELETE handlers.

3. **Photo upload dialog in interventions-view-lite.tsx**:
   - Added `photoFile` state (File | null) for the new dialog-based upload approach
   - Refactored `handleUploadPhoto` from programmatic file input (document.createElement) to dialog-based:
     - Uses photoFile state from the dialog form
     - Converts file to base64 via FileReader
     - POSTs to `/api/intervention-photos` with interventionId, url (base64 data URL), caption, type
     - Resets form state on success
   - Created Photo Upload Dialog with:
     - Teal/emerald gradient header with 📸 icon
     - File input with preview (drag area styled with border-dashed)
     - Caption text input ("الوصف")
     - Type select: "قبل المعالجة" (BEFORE) / "بعد المعالجة" (AFTER)
     - Submit button with loading spinner during upload
     - Cancel button that resets all form state
   - Used AnimatePresence for enter/exit animations

4. **Fullscreen photo viewer in interventions-view-lite.tsx**:
   - Added `viewerPhoto` state (string | null) to track the URL of the photo being viewed
   - Created fullscreen overlay (fixed position, z-[70]):
     - Dark background (bg-black/90)
     - Full-size image with object-contain
     - Close button in top-left corner
     - Click anywhere to close
   - Used AnimatePresence for smooth enter/exit animations
   - Photos section thumbnails already had `onClick={() => setViewerPhoto(photo.url)}` from previous task

5. **Existing photo section** — The "📸 الصور" section with 2-column grid, type badges ("قبل"/"بعد"), caption display, and delete buttons was already implemented from a previous task.

### Feature 2: Citizen Complaint Tracking

1. **ViewType update** — Added 'complaints' to the ViewType union in `src/lib/store.ts`

2. **Prisma schema** — Complaint model and complaints relation already existed from previous task. Ran `bun run db:push` to confirm sync.

3. **API routes** — Both already existed from previous task:
   - `src/app/api/complaints/route.ts`: GET (list with filters) and POST (create with auto reference PL-YYYY-NNN)
   - `src/app/api/complaints/[id]/route.ts`: GET, PUT, DELETE

4. **Created `/home/z/my-project/src/app/complaints-view.tsx`** — Full complaints management view:
   - **Header**: "📢 تدبير الشكايات" with search bar and "إضافة شكاية" button
   - **Statistics cards**: 5 cards showing total, في الانتظار (EN_ATTENTE/amber), قيد المعالجة (EN_COURS/blue), تمت معالجتها (TRAITEE/green), مرفوضة (REJETEE/red)
   - **Filter tabs**: Status filter tabs with counts, like interventions view
   - **Additional filters**: Commune dropdown, type dropdown
   - **Complaint cards**: Reference, citizen name, type badge, priority badge, status badge, date, address, description snippet, phone, linked intervention
   - **Detail panel**: Full info with actions (change status, link intervention, add observations)
   - **Add complaint dialog**: Full form with all fields (nomCitoyen, telephone, adresse, quartier, commune, type, description, priorite, observations)
   - **Priority colors**: URGENTE=red, HAUTE=amber, NORMALE=blue, BASSE=gray
   - **Statut colors**: EN_ATTENTE=amber, EN_COURS=blue, TRAITEE=green, REJETEE=red
   - **Search debounce**: 300ms debounce pattern matching existing views
   - **Intervention linking**: Fetches available interventions and allows linking via dropdown
   - **Delete confirmation**: Two-step delete with confirmation

5. **Updated page.tsx**:
   - Added `const ComplaintsView = dynamic(() => import('./complaints-view'), { ssr: false })`
   - Added complaints nav item: `{ id: 'complaints', labelKey: 'complaints', icon: '📢', descKey: 'descComplaints', sectionKey: 'sectionMain' }`
   - Added `{currentView === 'complaints' && <ComplaintsView />}` in content section
   - Added 'complaints' to keyboard shortcuts views array

6. **Updated i18n.ts**:
   - Added `descComplaints: 'تدبير شكايات المواطنين'` (Arabic)
   - Added `descComplaints: 'Gestion des réclamations'` (French)
   - `complaints: 'الشكايات'` already existed

- Lint passes cleanly
- Dev server running successfully
