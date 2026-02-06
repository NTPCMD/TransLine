# Driver App Flow - Acceptance Test Checklist

**Build Stamp:** APP BUILD: transline-driver-fullflow-2026-02-02

## Phase 1: Authentication & Assignment (Pre-Shift)

### Test 1.1: Login Flow
- [ ] Launch app → See SplashScreen
- [ ] Wait 3 seconds → Route to LoginScreen
- [ ] Enter valid credentials → Login succeeds
- [ ] Console shows: `[DriverContext] User authenticated: {auth_user_id}`
- [ ] Build stamp visible in green bar at top

### Test 1.2: Vehicle Assignment Resolution
- [ ] After login, navigate to VehicleAssignmentScreen
- [ ] Check Assignment resolution order:
  - [ ] First tries `vehicles.assigned_driver_id = auth.uid()`
  - [ ] If not found, tries `vehicles.assigned_driver_id = driver.id`
  - [ ] If not found, tries `vehicle_assignments` table with `driver_id`
  - [ ] Console logs should show: `[Assignment] resolved vehicle: {vehicle_id} from: {source}`
- [ ] Vehicle shows correctly even if `vehicle_assignments` table is empty

### Test 1.3: Start Shift Screen Display
- [ ] Navigate to StartShiftScreen
- [ ] Verify assigned vehicle displayed:
  - [ ] Registration/rego/plate_number shown
  - [ ] Vehicle type shown
  - [ ] Depot shown
- [ ] "Begin pre-start checklist" button enabled (only if vehicle assigned)
- [ ] If vehicle not assigned, button disabled with error message

---

## Phase 2: Pre-Shift Checklist

### Test 2.1: Pre-Start Checklist
- [ ] Click "Begin pre-start checklist"
- [ ] PreStartChecklistScreen loads
- [ ] Can mark items as checked/unchecked
- [ ] Submit checklist → Navigate to next screen

### Test 2.2: Wait for Instruction
- [ ] WaitForInstructionScreen displayed
- [ ] Shows assigned vehicle info
- [ ] Can navigate to ReadingsAndPhotos or continue

---

## Phase 3: Shift Start & GPS Tracking

### Test 3.1: Start Shift
- [ ] ActiveShiftScreen loads
- [ ] Console logs: `[GPS] Starting tracking for shift: {shift_id}`
- [ ] GPS watch started (if permissions granted)
- [ ] Shift timer running (shows duration)
- [ ] Drawer accessible with all menu options

### Test 3.2: GPS Tracking Updates
- [ ] Allow location permissions
- [ ] Wait 30 seconds
- [ ] Console logs GPS updates: `[GPS] Update: speed=X km/h lat=X lng=X`
- [ ] Points are recorded to `gps_points` table (visible in Supabase)
- [ ] Heading and accuracy logged

### Test 3.3: Stop Detection
- [ ] Simulate stationary vehicle (turn off/don't move phone)
- [ ] Wait 2+ minutes
- [ ] Console logs: `[GPS] Stop event started at: {timestamp}`
- [ ] Console logs: `[GPS] Stop event threshold reached (2+ minutes stationary)`
- [ ] Resume movement → Console logs: `[GPS] Recorded stop event: {duration}s`
- [ ] Stop event appears in `stop_events` table

---

## Phase 4: Active Shift Features

### Test 4.1: Break Control
- [ ] Click drawer → BreakControl
- [ ] Click "Start Break" → Break logs to database
- [ ] Console: `[Break] Started break: {break_id}`
- [ ] Click "End Break" → Break ended in database
- [ ] Console: `[Break] Ended break: {break_id}`
- [ ] Back to ActiveShiftScreen → Active shift still running

### Test 4.2: Fuel Log
- [ ] Click drawer → FuelLog
- [ ] Enter liters, cost, location
- [ ] Click Submit → Fuel log recorded
- [ ] Console: `[Fuel] Recorded fuel log: {log_id}`
- [ ] Data visible in `fuel_logs` table

### Test 4.3: Send Note
- [ ] Click drawer → SendNote
- [ ] Enter note text
- [ ] Click Submit → Note sent
- [ ] Console confirms event recorded

---

## Phase 5: End Shift & Odometer

### Test 5.1: Navigate to End Shift
- [ ] Click drawer → SendNote (or icon) → EndShift
- [ ] OR: ActiveShiftScreen "End Shift" button → EndShiftScreen
- [ ] EndShiftScreen loads with summary:
  - [ ] Vehicle registration
  - [ ] Shift start time
  - [ ] Start odometer reading
  - [ ] No "End odometer already captured" error

### Test 5.2: Odometer Capture (End Shift)
- [ ] Final Odometer Reading section visible
- [ ] TextField for numeric input available
- [ ] PhotoPicker for "Final odometer photo (required)"
  - [ ] Click "Take photo"
  - [ ] Camera opens
  - [ ] Take photo of odometer
  - [ ] Photo displayed in picker
  - [ ] Photo URI in console

### Test 5.3: End of Shift Checklist
- [ ] "Have you removed all rubbish?" section visible
- [ ] Can select Yes/No
- [ ] Optional notes field available
- [ ] Distance calculated: `Distance: {km} km`

### Test 5.4: Submit End Shift
- [ ] Fill all required fields:
  - [ ] Final odometer reading (whole number)
  - [ ] Final odometer photo (taken)
  - [ ] Rubbish removal (yes/no)
- [ ] Click "Confirm end"
- [ ] Alert: "Confirm distance: X km"
- [ ] Confirm → Shift ends
- [ ] Console: Shift end event logged
- [ ] Navigation back to Login/Splash screen
- [ ] Shift record in database marked as ended:
  - [ ] `ended_at` = current timestamp
  - [ ] `end_odometer` = entered value
  - [ ] `status` = 'completed'

---

## Phase 6: Offline Queue & Sync

### Test 6.1: Offline Queueing (Simulate Offline)
- [ ] Kill network (Airplane mode or disable WiFi)
- [ ] In ActiveShiftScreen, try:
  - [ ] Start break → Console: `[Break] Offline: queuing break start`
  - [ ] Log fuel → Console: `[Fuel] Offline: queuing fuel log`
  - [ ] Send note → Console: `[Note] Offline: queuing note`
- [ ] Actions appear to succeed (temporary IDs returned)
- [ ] Data stored in AsyncStorage offline queue

### Test 6.2: Offline End Shift
- [ ] While offline, fill End Shift form
- [ ] Submit → Console: `[Shift] Offline: queuing shift end`
- [ ] Show offline banner: "Offline - Data will sync when online"
- [ ] Navigation doesn't break

### Test 6.3: Sync on Reconnect
- [ ] Reconnect network
- [ ] App detects network (NetInfo)
- [ ] Console: `[Offline] Flushing queue: {count} items`
- [ ] Each queued item retried:
  - [ ] Retry count shown in console
  - [ ] If fails, retries with exponential backoff
  - [ ] Max 5 attempts before giving up
- [ ] All items flushed from queue
- [ ] Data visible in Supabase tables

### Test 6.4: Queue Persistence
- [ ] Queue offline items (as above)
- [ ] Force-kill app (swipe away)
- [ ] Relaunch app
- [ ] Offline items still in queue (not lost)
- [ ] Can trigger manual sync

---

## Phase 7: GPS Service Integration

### Test 7.1: GPS Lifecycle on Shift Start
- [ ] Start shift → GPS tracking initiates
- [ ] Console: `[GPS] Starting tracking for shift: {shift_id}`
- [ ] Location permissions requested (if not already granted)
- [ ] GPS points appearing in database

### Test 7.2: GPS Lifecycle on Shift End
- [ ] End shift process starts
- [ ] GPS tracking stops
- [ ] Console: `[GPS] Stopping tracking`
- [ ] Any pending stop events closed
- [ ] No more GPS updates after shift end

### Test 7.3: GPS Error Handling
- [ ] Deny location permissions
- [ ] Try to start shift
- [ ] Console: `[GPS] Permission error: Location permissions not granted`
- [ ] App continues (doesn't crash)
- [ ] Shift starts without GPS (graceful degradation)

---

## Phase 8: Data Consistency

### Test 8.1: Shift Record Consistency
- [ ] Start shift → shifts table record created with:
  - [ ] `driver_id` = current driver
  - [ ] `vehicle_id` = assigned vehicle
  - [ ] `started_at` = current timestamp
  - [ ] `status` = 'active'
  - [ ] `started_at` not null, `ended_at` is null
- [ ] During shift → GPS points linked to correct `shift_id`
- [ ] During shift → Break logs linked to correct `shift_id`
- [ ] During shift → Fuel logs linked to correct `shift_id`
- [ ] End shift → Same shift record updated:
  - [ ] `ended_at` = current timestamp
  - [ ] `end_odometer` = entered value
  - [ ] `status` = 'completed'

### Test 8.2: Photo Upload Path
- [ ] End odometer photo captured
- [ ] Photo URI stored in shift record: `end_odometer_photo_path`
- [ ] Photo file uploaded to Supabase storage
- [ ] Photo accessible via URL

### Test 8.3: Constraint Validation
- [ ] End odometer < start odometer → Alert: "Invalid Input"
- [ ] Missing required fields → Alert with specific message
- [ ] Non-integer odometer reading → Alert: "Invalid Input"

---

## Phase 9: UI/UX Consistency

### Test 9.1: Loading States
- [ ] VehicleAssignmentScreen loading → Shows "Loading vehicle assignment..."
- [ ] StartShiftScreen → Button disabled while loading
- [ ] End Shift submit → Button shows "Ending..." and disabled

### Test 9.2: Error Messages
- [ ] Missing assignment → "Vehicle not assigned. Please contact admin."
- [ ] Network error → Shows error in banner
- [ ] GPS permission denied → Graceful error, shift continues

### Test 9.3: Navigation Flow
- [ ] Complete valid flow: Splash → Login → StartShift → Checklist → ActiveShift → EndShift → (Odometer if configured) → Back to Login
- [ ] No dead ends or missing screens
- [ ] Back buttons work (where applicable)
- [ ] Drawer navigation from ActiveShift works

---

## Phase 10: Console Logging Verification

### Expected Console Messages During Full Flow:
```
APP BUILD: transline-driver-fullflow-2026-02-02
[DriverContext] User authenticated: {uuid}
[Assignment] auth user {uuid}
[Assignment] resolved vehicle: {vehicle_id} from: assigned_driver_id
[Shift] Creating shift for driver {driver_id} vehicle {vehicle_id}
[Shift] Created shift: {shift_id}
[GPS] Starting tracking for shift: {shift_id}
[GPS] Update: speed=0.0km/h lat=X.XXXX lng=X.XXXX
[GPS] Stop event started at: {timestamp}
[GPS] Stop event threshold reached (2+ minutes stationary)
[GPS] Recorded stop event: {duration}s
[Break] Started break: {break_id}
[Break] Ended break: {break_id}
[Fuel] Recorded fuel log: {log_id}
[Shift] Ended shift: {shift_id}
[GPS] Stopping tracking
```

---

## Phase 11: Known Issues & Workarounds

### Issue 1: Assignment "column does not exist"
- **Expected Fix:** AssignmentContext now uses robust getAssignedVehicleForCurrentUser()
- **Verification:** Check console for `[Assignment] resolved vehicle` message

### Issue 2: Vehicle assignment not showing if vehicle_assignments empty
- **Expected Fix:** Fallback to vehicles.assigned_driver_id
- **Verification:** Vehicle shows on StartShiftScreen even with empty vehicle_assignments table

### Issue 3: End Shift flow unclear
- **Expected Fix:** EndShiftScreen is final mandatory step with odometer capture
- **Verification:** After shift end, app returns to Login (not middle of flow)

---

## Test Environment Setup

### Prerequisites:
1. Supabase project configured with proper RLS policies
2. Driver user logged in with valid auth.uid
3. Vehicle assigned via either:
   - `vehicles.assigned_driver_id` = auth.uid or driver.id (PRIMARY)
   - OR `vehicle_assignments` record with driver_id (FALLBACK)
4. GPS/Location permissions available (iOS/Android)
5. Camera permissions available for photo capture
6. Network connectivity testable (WiFi toggle)

### Test Data:
```sql
-- Ensure driver exists
SELECT * FROM drivers WHERE auth_user_id = {current_auth_uid};

-- Ensure vehicle assigned
SELECT * FROM vehicles WHERE assigned_driver_id = {driver_id OR auth_uid};

-- Check active shift
SELECT * FROM shifts WHERE driver_id = {driver_id} AND ended_at IS NULL;

-- Check GPS points
SELECT * FROM gps_points WHERE shift_id = {active_shift_id};

-- Check stop events
SELECT * FROM stop_events WHERE shift_id = {active_shift_id};
```

---

## Pass/Fail Criteria

**PASS if:**
- All 11 phases execute without errors
- Console shows expected messages
- Data appears correctly in Supabase tables
- Offline queue syncs on reconnect
- GPS tracking works for full shift duration
- Odometer capture happens at shift end
- Photos upload successfully

**FAIL if:**
- Any phase crashes or shows unexpected error
- "Column does not exist" error appears
- Vehicle not assigned when should be
- GPS tracking doesn't start/stops unexpectedly
- Offline queue doesn't flush on reconnect
- Photos don't upload
- Navigation doesn't flow correctly

---

**Status:** Phase 0-3 + Phase 9 Implemented
**Last Updated:** 2026-02-02
**Next Phase:** Phase 4-8 full integration testing
