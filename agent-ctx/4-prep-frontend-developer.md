# Task 4-prep: Update Store, Constants, and i18n for 20 New Features

## Agent: Frontend Developer

## Summary
Updated three core library files to support 20 new features being added to the Arabic RTL intervention management system.

## Changes Made

### 1. store.ts
- **ViewType**: Added `'activityLog' | 'timeline'`
- **AppSettings**: Added 7 new fields (favoriteInterventions, showQuickStats, notificationSoundsEnabled, recurrenceEnabled, pwaInstallDismissed, mapShowHeatmap, mapShowDrawing)
- **DEFAULT_SETTINGS**: Added defaults for all new AppSettings fields
- **AppState**: Added 10 new state fields/actions (favorites, toggleFavorite, isFavorite, selectedInterventions, setSelectedInterventions, toggleInterventionSelection, clearSelection, comparisonIds, setComparisonIds, showQuickStatsWidget, setShowQuickStatsWidget)
- **Implementation**: Full Zustand store implementation with localStorage persistence for favorites
- **Hydration**: Added favorites hydration from localStorage

### 2. i18n.ts
- Added ~90 new translation keys to both `ar` and `fr` sections covering:
  - New views (activityLog, timeline)
  - New features (favorites, bulkActions, comparison, qualityScore, etc.)
  - Bulk action labels, comments, quality, backup, comparison, timeline, filter, QR, recurrence, import, drawing, print sections

### 3. constants.ts
- Added `QUALITY_SCORE_THRESHOLDS` and `QUALITY_SCORE_LABELS`
- Added `ACTIVITY_ACTION_LABELS` for activity log actions
- Added `ENTITY_TYPE_LABELS` for entity type display
- Added `RECURRENCE_PATTERNS` for recurrence scheduling

## Verification
- `bun run lint` passes cleanly
- All TypeScript types are correct
- Both ar and fr translations are complete and matching
