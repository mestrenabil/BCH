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
