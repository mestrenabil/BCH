---
Task ID: 9
Agent: Main Agent
Task: Add "new intervention from map click" feature — click on map location to create intervention

Work Log:
- Added MapClickCoords interface to Zustand store (latitude, longitude, commune)
- Added mapClickCoords and setMapClickCoords state to store
- Modified map-component.tsx: added onMapClick prop, click handler with pulsing marker + popup
- Modified MapView in page.tsx: accepts and passes onMapClick, added floating instruction overlay
- Modified InterventionFormDialog: accepts mapClickCoords, pre-fills coordinates, shows green banner
- All lint checks pass with 0 errors

Stage Summary:
- Users can click anywhere on the map to add a new intervention at that location
- Click creates pulsing green marker with popup showing coordinates, commune, and add button
- Form pre-fills lat/lng with green highlighting and "موقع محدد من الخريطة" banner
- Floating instruction overlay on map: "انقر على الخريطة لإضافة تدخل"
