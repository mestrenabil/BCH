---
Task ID: 1
Agent: Main Agent
Task: Fix map page issue where window/sidebar disappears when map loads

Work Log:
- Diagnosed the issue using Agent Browser: found z-index stacking context conflict between Leaflet panes (z-200 to z-700) and floating controls (z-30)
- The Leaflet container had z-index: auto, so its child panes participated in the parent stacking context, covering the floating controls
- Also found that the sidebar was 340px wide on mobile (390px screen), covering almost the entire map
- Fixed z-index issue by:
  1. Adding `position: relative; zIndex: 1` to the Leaflet map container in map-component.tsx, creating a proper stacking context
  2. Increased all floating control z-indices from z-30 to z-[1000] in map-view-lite.tsx
  3. Changed sidebar z-index from z-20 to z-[1000]
  4. Changed intervention overlay z-index from z-40 to z-[1001]
- Fixed mobile sidebar by:
  1. Hidden desktop sidebar on mobile (added `hidden lg:flex`)
  2. Created separate mobile sidebar overlay with AnimatePresence, max-width 85vw/340px
  3. Added backdrop overlay (semi-transparent black) behind mobile sidebar
  4. Added hamburger menu button (top-right, lg:hidden) to toggle mobile sidebar
  5. Mobile sidebar has close button and commune filter options
- Verified fixes with Agent Browser on both desktop (1280x800) and mobile (390x844) viewports
- Confirmed marker click overlay works correctly and stays visible after map renders
- No browser errors or console errors

Stage Summary:
- Key fix: z-index stacking context for Leaflet container (map-component.tsx line 1609)
- Key fix: All floating controls now use z-[1000] instead of z-30
- Key fix: Mobile-responsive sidebar with overlay pattern
- Desktop sidebar: hidden on mobile, visible on lg+ screens
- Mobile sidebar: toggle via hamburger button, 85vw max width, close button
- All verified working via Agent Browser
