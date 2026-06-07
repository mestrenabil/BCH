# Task 1 - Agent: main

## Task: Add 3 features — Agent Intervention Count, Product Expiry Date Tracking, Stock Movement History

### Summary
All three features were implemented successfully.

### Feature 1: Agent Intervention Count & History
- Modified `agents-view.tsx` to fetch intervention counts alongside agents
- Added teal "📋 X تدخل" badge on both desktop and mobile agent cards
- Added read-only intervention count field in the agent edit dialog

### Feature 2: Product Expiry Date Tracking
- Added `dateExpiration DateTime?` to Product model in Prisma schema
- Updated both product API routes to handle the new field
- Added expiry date input to product form
- Added expiry badges (red for expired, amber for expiring within 30 days)
- Added "منتهي الصلاحية" stats card in inventory view
- Added expired/expiring products section in alerts view

### Feature 3: Stock Movement History
- Added `StockMovement` model to Prisma schema
- Created `/api/stock-movements` API route with GET and POST handlers
- Stock adjustments now create movement records
- Added stock movement dialog with IN/OUT styling (green/red)
- Movement history accessible via 📋 button on each product

### Files Modified
- `prisma/schema.prisma` — Added dateExpiration, StockMovement model, movements relation
- `src/app/agents-view.tsx` — Intervention count fetching and display
- `src/app/inventory-view-lite.tsx` — Full rewrite with expiry dates and stock movements
- `src/app/alerts-view.tsx` — Expired products alerts section
- `src/app/api/products/route.ts` — Handle dateExpiration
- `src/app/api/products/[id]/route.ts` — Handle dateExpiration
- `src/app/api/stock-movements/route.ts` — New API route

### Verification
- `bun run db:push` succeeded
- `bun run lint` passes cleanly
- Dev server running on port 3000
