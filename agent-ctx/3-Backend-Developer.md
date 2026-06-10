# Task 3 - Backend Developer: Prisma Schema Updates + API Routes

## Task
Add new Prisma models and API routes for Activity Log, Comments, Data Backup, and Bulk Actions.

## Work Completed

### 1. Prisma Schema Updates (`prisma/schema.prisma`)
- Added `ActivityLog` model with fields: id, userId, userName, action, entityType, entityId, details, commune, ipAddress, createdAt
- Added `InterventionComment` model with fields: id, interventionId (FK to Intervention), authorName, authorRole, content, type, createdAt, updatedAt
- Added `comments InterventionComment[]` relation to existing Intervention model
- Ran `bun run db:push` successfully

### 2. API Routes Created
- **`/api/activity-log/route.ts`**: GET (with limit/offset/action/entityType/commune/userId filters) + POST
- **`/api/interventions/[id]/comments/route.ts`**: GET (ordered by createdAt desc) + POST (validates content + authorName)
- **`/api/backup/route.ts`**: GET - exports all data as JSON (excludes user passwords), uses sequential fetches to avoid memory issues
- **`/api/interventions/bulk/route.ts`**: POST - supports delete, updateStatus, updateCommune, export actions

### 3. Supporting Changes
- Updated `src/lib/db.ts` to handle Prisma client cache invalidation when schema changes (detects missing models like activityLog/interventionComment in cached client and forces recreation)
- Removed verbose Prisma query logging and debug console.logs to reduce memory pressure in dev server

### Verification
- Lint passes cleanly (0 errors, 0 warnings)
- Activity-log API tested: POST returns 201, GET returns {logs, total}
- Backup API tested: GET returns 200 with full data export
- All endpoints follow existing project patterns (NextRequest/NextResponse, db from @/lib/db)
