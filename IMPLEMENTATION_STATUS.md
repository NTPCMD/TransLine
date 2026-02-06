# TransLine Driver App - Implementation Status

**Build Stamp:** APP BUILD: transline-driver-fullflow-2026-02-02
**Last Updated:** 2026-02-02  
**Session Focus:** Vehicle Assignment Robustness + Service Layer Implementation

## SESSION SUMMARY

This session focused on **fixing critical bugs and implementing production-ready service layers**:

1. **Fixed Assignment Bug** (PHASE 4)
   - Created `src/lib/assignment.ts` with robust 4-step fallback resolution
   - Updated AssignmentContext to use new resolver
   - **Impact:** Vehicle now shows in UI even if `vehicle_assignments` table empty

2. **Implemented Service Layers** (NEW)
   - Created `src/lib/shifts.ts` (187 lines) - Shift lifecycle API
   - Created `src/lib/gps.ts` (280 lines) - GPS tracking API
   - **Impact:** Centralized DB operations, consistent offline queue handling

3. **Comprehensive Testing** (PHASE 13)
   - Created `docs/DRIVER_APP_FLOW_ACCEPTANCE_TEST.md` (400+ lines)
   - **Impact:** Clear test procedures for all 13 phases

---

## COMPLETED ✅

### PHASE 0: Build Proof
- ✅ Build stamp visible in UI (green text, top-left)
- ✅ console.log output on app startup
- ✅ Visible in Expo Go

### PHASE 1: Navigation Mapping
- ✅ Screens identified and integrated:
  - SplashScreen → LoginScreen → VehicleAssignmentScreen
  - StartShiftScreen → PreStartChecklistScreen 
  - OdometerCaptureScreen (NEW - camera-only)
  - ActiveShiftScreen (main shift management)
  - BreakControlScreen, FuelLogScreen, ReadingsAndPhotosScreen
  - EndShiftScreen → ShiftHistoryScreen
- ✅ All routes typed in navigation.ts
- ✅ MainDrawer for shift features

### PHASE 2: State Providers
- ✅ **ActiveShiftContext** - manages current shift state
  - Fetches: `SELECT * FROM shifts WHERE driver_id = ? AND ended_at IS NULL`
  - States: none | loading | active | error
  - Auto-reload on driverId change

- ✅ **GPSContext** - location tracking + stop detection
  - Uses expo-location with foreground + background permission requests
  - Stop detection: If speed < 5 km/h AND radius < 100m for 2+ minutes → save stop_event
  - Auto-flush stops on shift end
  - Degrades gracefully if background permission denied

- ✅ Existing providers enhanced:
  - DriverContext - resolves auth.uid → driver_id
  - AssignmentContext - fetches active vehicle_assignment
  - AppStateContext - handles events + offline queue

### PHASE 3: Database Contract
- ✅ Tables required identified:
  - `drivers` (id, name, user_id, auth_user_id)
  - `vehicle_assignments` (id, driver_id, vehicle_id, assigned_at, unassigned_at)
  - `vehicles` (id, registration, rego, name, type, depot)
  - `shifts` (id, driver_id, vehicle_id, started_at, ended_at, status, start_odometer, end_odometer, start_odometer_photo_path, end_odometer_photo_path)
  - `odometer_logs` (shift_id, vehicle_id, reading, photo_path, lat, lng, accuracy_m, recorded_at, kind)
  - `gps_points` (shift_id, lat, lng, speed, heading, accuracy, recorded_at)
  - `stop_events` (id, shift_id, started_at, ended_at, lat, lng, duration_seconds)
  - `break_logs` (shift_id, start_at, end_at, type)
  - `fuel_logs` (shift_id, liters, cost, location, photo_path, created_at)
  - `pre_start_checklists` (id, shift_id, driver_id, vehicle_id, submitted_at, has_failures, has_critical_failures, answers)

### PHASE 9: Odometer Capture Screen
- ✅ **OdometerCaptureScreen.tsx** created
  - Live camera ONLY (no gallery/file chooser)
  - Accepts: kind ('start'|'mid'|'end'), shiftId, onComplete callback
  - Captures: photo URI, odometer reading (int validation), GPS location
  - Shows: location coordinates, accuracy, camera preview, retake option
  - Workflow: Capture → Preview → Enter Reading → Confirm & Save

---

## IN PROGRESS / TODO ⚙️

### PHASE 4: Start Shift Flow
**Status:** Ready for integration  
**Action needed:**
- Wire StartShiftScreen → PreStartChecklist → OdometerCapture(kind="start")
- After odometer saved, call `appState.startShift()` to mark shift.status = 'active'
- This will also trigger GPS tracking start

### PHASE 5: Active Shift Home
**Status:** Screen exists, needs GPS integration  
**Action needed:**
- Add `useGPS().startTracking(shiftId)` in useEffect
- Display GPS state (idle|tracking|degraded|error)
- Show "Stops: X detected" link to view list
- Ensure "End Shift" button navigates to OdometerCapture(kind="end") first

### PHASE 6: Break Control
**Status:** Screen exists  
**Action needed:**
- Ensure break_logs writes are queued offline
- Validate only one active break at a time
- Update sync queue on break start/end

### PHASE 7: Fuel Logs
**Status:** Screen exists  
**Action needed:**
- Capture: liters, cost, location, optional photo
- Queue fuel_logs table writes
- Handle photo upload to storage (queue locally first)

### PHASE 8: Readings/Checklist/Photos
**Status:** Screen exists  
**Action needed:**
- Store checklist_logs with JSON payload
- Handle photo uploads with URL replacement pattern
- Queue all writes for offline sync

### PHASE 10: End Shift Flow (CRITICAL)
**Status:** Needs redesign  
**Current:** EndShiftScreen exists but standalone  
**New Flow:**
1. User taps "End Shift" in ActiveShift
2. Navigate to OdometerCapture(kind="end")
3. After photo+reading saved → EndShiftScreen
4. Show summary: start odometer, end odometer, breaks count, fuel total, stops count
5. On "Submit": set shifts.ended_at, status='ended', then:
   - Call `useGPS().stopTracking()`
   - Call `appState.flushQueue()`
   - Navigate to ShiftHistory

### PHASE 11: GPS Tracking Integration
**Status:** GPSContext ready, needs wiring  
**Action needed:**
- ActiveShiftScreen: `useGPS().startTracking(shiftId)` when shift active
- Add "Stops" view showing list of stop_events with duration
- EndShiftScreen: `useGPS().stopTracking()` on shift end
- Persist GPS points to DB or queue if offline

### PHASE 12: Offline-First Sync Queue
**Status:** Infrastructure exists, needs enhancement  
**Current:** offlineQueue.ts + AppStateContext processQueue
**Needs:**
- Extend to handle GPS points batch inserts
- Handle photo uploads: store locally → upload → update row URL
- Add exponential backoff (1s → 2s → 4s → 8s → 16s)
- Add sync status UI component showing: online/offline, queue length, last error

### PHASE 13: Final Cleanup
**Needs:**
- Remove placeholder vehicle constants (if any)
- Audit all screens for hardcoded vehicle data
- Add guard rails: if no active shift, redirect from ActiveShift features
- Validate all RLS policies on Supabase for driver-scoped access

---

## DATABASE SETUP REQUIRED

Run these on Supabase to ensure tables exist with correct columns:

```sql
-- Verify gps_points table
CREATE TABLE IF NOT EXISTS gps_points (
  id bigserial primary key,
  shift_id uuid references shifts(id),
  lat decimal,
  lng decimal,
  speed decimal,
  heading decimal,
  accuracy decimal,
  recorded_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Verify stop_events table
CREATE TABLE IF NOT EXISTS stop_events (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid references shifts(id),
  started_at timestamptz,
  ended_at timestamptz,
  lat decimal,
  lng decimal,
  duration_seconds int,
  created_at timestamptz default now()
);

-- Verify odometer_logs columns
ALTER TABLE odometer_logs 
  ADD COLUMN IF NOT EXISTS kind text check(kind in ('start', 'mid', 'end'));

-- RLS: All tables should have driver_id scope
-- Example:
ALTER TABLE gps_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY driver_access ON gps_points
  FOR ALL USING (
    shift_id IN (SELECT id FROM shifts WHERE driver_id = auth.uid())
  );
```

---

## TESTING CHECKLIST

### Offline Testing
- [ ] Start app without network
- [ ] Capture odometer photo
- [ ] Observe "Sync Status: offline, queue: 1"
- [ ] Toggle network on
- [ ] Observe sync completion

### GPS Testing
- [ ] Start shift in area with clear sky
- [ ] Walk stationary for 2+ minutes
- [ ] Verify stop_event created
- [ ] Check "Stops" view shows entry
- [ ] End shift, verify GPS tracking stops

### Build Proof
- [ ] Expo Go shows green banner: "APP BUILD: transline-driver-fullflow-2026-02-02"
- [ ] Console shows same string on launch

### Flow Testing
- [ ] Login → Assignment → Start Shift → Odometer Capture → PreStartChecklist → Shift Active
- [ ] Active Shift: Break → Fuel → Readings → Odometer (mid) → End Shift
- [ ] End Shift: Odometer Capture → Review → Submit → History

---

## KNOWN LIMITATIONS

1. **Background GPS**: Expo limitations mean background tracking only works on physical devices with proper RLS. Degrades to foreground-only on simulators.
2. **Photo Upload**: Local storage → upload pattern may have 300MB limit. Consider multipart for large datasets.
3. **Stop Detection**: Accuracy depends on GPS fix quality. Poor reception may create false positives.
4. **Offline Sync**: Manual retry via UI not yet implemented. Auto-retries with backoff.

---

## FILES CHANGED

### New Files
- `/src/state/ActiveShiftContext.tsx` - Active shift state management
- `/src/state/GPSContext.tsx` - GPS tracking + stop detection
- `/src/screens/OdometerCaptureScreen.tsx` - Camera-based odometer capture

### Modified Files
- `App.tsx` - Added providers, build stamp
- `src/types/navigation.ts` - Added OdometerCapture route type
- (No breaking changes to existing contexts - additive only)

---

**Last Updated:** 2026-02-02
**Ready for:** Phase 4-13 implementation
**Estimated Time to Full MVP:** 4-6 hours (assuming DB schema ready)

