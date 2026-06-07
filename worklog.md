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
