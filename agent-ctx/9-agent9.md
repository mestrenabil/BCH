# Task 9 - Notifications Center View

## Task
Create the Notifications Center View component at `/home/z/my-project/src/app/notifications-view.tsx`

## Work Completed

### Created `/home/z/my-project/src/app/notifications-view.tsx`
- Full Arabic RTL Notifications Center component
- `'use client'` directive, imports from `@/lib/store`, `sonner`, `framer-motion`
- 4 notification categories: عاجل (Urgent/red), تحذير (Warning/amber), معلومة (Info/blue), نجاح (Success/green)
- 6 notification types generated from existing API data:
  - Stock Critical (quantiteStock === 0) → urgent
  - Stock Low (quantiteStock <= seuilAlerte && > 0) → warning
  - Overdue Interventions (PLANIFIEE/EN_COURS, date < today) → urgent
  - Upcoming Interventions (PLANIFIEE within N days) → info
  - Recent Completions (TERMINEE in last 2 days) → success
  - New Documents (created in last 3 days) → info
- Notification cards with right border color coding, unread tinted background
- Statistics cards (4 clickable, filter by category)
- Category filter pills with counts and unread indicators
- "Mark all as read" button
- Read/unread state in localStorage under `notifications-read`
- Auto-refresh every 30 seconds via refreshKey pattern
- Collapsible settings panel with toggles for stock/overdue/upcoming alerts + reminder days slider (1-7)
- Settings persisted to localStorage under `notification-settings`
- Action buttons navigate to inventory/interventions/documents views
- Custom scrollbar, empty state with bell icon
- Motion animations for entry/removal

### Modified `/home/z/my-project/src/app/page.tsx`
- Added import: `import NotificationsView from './notifications-view'`
- Added navItem: `{ id: 'notifications', label: 'الإشعارات', icon: '🔔', desc: 'مركز التنبيهات' }`
- Added rendering: `{currentView === 'notifications' && <NotificationsView />}`

### Lint
- Zero errors/warnings for notifications-view.tsx
- Overall lint: clean
