# Task 2: Fix bugs and add SIG features to map-component.tsx

## Agent: SIG/Map Developer

## Changes Made

### Bug Fixes
1. **Intervention type** - Added missing `commune` (string) field and optional fields: `heureDebut?`, `heureFin?`, `coutMainOeuvre?`, `coutMateriaux?`, `coutTotal?`, `photos?`, `documents?`, `createdAt?`, `updatedAt?`

### SIG Features Added
2. **Coordinate tracking** - Added `onMouseMove?: (coords: {lat, lng, zoom}) => void` prop. Wires to Leaflet map `mousemove` event.
3. **Measure distance mode** - Added `measureMode?: boolean` and `onMeasureResult?: (distance, points) => void` props. When active:
   - Click to add measurement points with red numbered markers
   - Dashed red polyline between points
   - Distance labels (Arabic: كم/م) between consecutive points
   - Total distance label at last point
   - Double-click finishes measurement and calls onMeasureResult
   - Crosshair cursor, disables double-click zoom during measure
   - Full cleanup when deactivated
4. **Compass/North arrow** - Custom Leaflet Control in top-right corner with red north arrow, N label, and gray S/E/W indicators

### Backward Compatibility
- All new Intervention fields are optional except `commune` (string)
- Existing map click handler updated to skip when measureMode is active
- All existing functionality preserved

## Files Modified
- `/home/z/my-project/src/app/map-component.tsx`
- `/home/z/my-project/worklog.md`
