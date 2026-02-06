# Service Layer API Reference

This document describes the production-ready service layer APIs for the TransLine driver app.

## Overview

The service layer provides centralized, testable APIs for all shift management, GPS tracking, and vehicle assignment operations. All functions handle offline operations automatically via AsyncStorage queue.

---

## Assignment Service (`src/lib/assignment.ts`)

### `getAssignedVehicleForCurrentUser()`

Resolves the assigned vehicle for the current authenticated user with robust 4-step fallback.

```typescript
const { vehicle, assignmentSource } = await getAssignedVehicleForCurrentUser();

// Returns:
// {
//   vehicle: {
//     id: string;
//     registration?: string;
//     rego?: string;
//     plate_number?: string;
//     name?: string;
//     type?: string;
//     depot?: string;
//     depot_name?: string;
//   } | null;
//   assignmentSource: 'assigned_driver_id' | 'vehicle_assignments' | null;
// }
```

**Resolution Order:**
1. Query `vehicles.assigned_driver_id = auth.uid()` (PRIMARY - Portal assigns directly to auth user)
2. Query `vehicles.assigned_driver_id = driver.id` (SECONDARY - Portal assigns to driver record ID)
3. Query `vehicle_assignments` table with `driver_id` (FALLBACK - Legacy assignment table)
4. Return null if none found

**Usage:**
```typescript
// In AssignmentContext or any component needing vehicle
const { vehicle, assignmentSource } = await getAssignedVehicleForCurrentUser();

if (vehicle) {
  console.log(`Assigned: ${vehicle.registration} (from ${assignmentSource})`);
} else {
  console.log('Not assigned');
}
```

**Console Output:**
```
[Assignment] Trying vehicles.assigned_driver_id = {auth_uid}
[Assignment] resolved vehicle: {vehicle_id} from: assigned_driver_id
```

---

## Shift Service (`src/lib/shifts.ts`)

### `createShift(driverId: string, vehicleId: string)`

Create a new shift in the database.

```typescript
const { shift, error } = await createShift(driverId, vehicleId);

// Returns: 
// { shift: Shift | null; error?: string }
// 
// Shift: {
//   id: string;
//   driver_id: string;
//   vehicle_id: string;
//   started_at: string | null;
//   ended_at: string | null;
//   status: string;
//   start_odometer: number | null;
//   end_odometer: number | null;
//   created_at: string;
// }
```

**Behavior:**
- If online: Creates shift record in DB, returns shift data
- If offline: Queues operation to AsyncStorage, returns temp shift with temporary ID

**Usage:**
```typescript
const { shift, error } = await createShift(currentDriver.id, assignedVehicle.id);
if (error) {
  Alert.alert('Failed to start shift', error);
  return;
}
console.log(`Shift started: ${shift.id}`);
```

---

### `getActiveShift(driverId: string)`

Get the currently active shift for a driver.

```typescript
const { shift, error } = await getActiveShift(driverId);

// Returns: { shift: Shift | null; error?: string }
```

**Query:**
```sql
SELECT * FROM shifts 
WHERE driver_id = ? AND ended_at IS NULL
ORDER BY started_at DESC
LIMIT 1
```

**Usage:**
```typescript
const { shift } = await getActiveShift(driver.id);
if (!shift) {
  console.log('No active shift');
  return;
}
console.log(`Active shift: ${shift.id}, started ${shift.started_at}`);
```

---

### `endShift(shiftId: string, endOdometerReading: number, endOdometerPhotoUri?: string)`

End a shift with final odometer reading.

```typescript
const { success, error } = await endShift(
  activeShift.id, 
  9250,  // final odometer reading
  'file:///photos/odometer-end-456.jpg'
);

// Returns: { success: boolean; error?: string }
```

**Behavior:**
- Validates shift exists
- Updates `shifts` table: `ended_at`, `end_odometer`, `status='completed'`
- If offline: Queues operation
- If online: Writes immediately and can flush offline queue

**Usage:**
```typescript
const { success, error } = await endShift(shiftId, finalOdometer, photoUri);
if (!success) {
  Alert.alert('Failed to end shift', error);
  return;
}
console.log('Shift ended successfully');
// Navigate back to main screen
```

---

### `startBreak(shiftId: string)`

Start a break period for the current shift.

```typescript
const { breakId, error } = await startBreak(shiftId);

// Returns: { breakId: string | null; error?: string }
```

**Creates:** Record in `break_logs` table with `start_at`, `type='rest'`

**Usage:**
```typescript
const { breakId, error } = await startBreak(activeShift.id);
if (error) {
  console.error('Failed to start break', error);
  return;
}
console.log(`Break started: ${breakId}`);
// Update UI to show "Break active"
```

---

### `endBreak(breakId: string)`

End an active break period.

```typescript
const { success, error } = await endBreak(breakId);

// Returns: { success: boolean; error?: string }
```

**Updates:** `break_logs` record with `end_at`

**Usage:**
```typescript
const { success, error } = await endBreak(activeBreak.id);
if (!success) {
  console.error('Failed to end break', error);
  return;
}
console.log('Break ended');
// Update UI to show "Shift active"
```

---

### `recordOdometerReading(shiftId: string, vehicleId: string, reading: number, photoUri?: string, kind?: 'start'|'mid'|'end')`

Record an odometer reading with optional photo.

```typescript
const { logId, error } = await recordOdometerReading(
  shiftId,
  vehicleId,
  8950,  // odometer reading (whole number)
  'file:///photos/odometer-start-123.jpg',  // optional photo URI
  'start'  // 'start', 'mid', or 'end'
);

// Returns: { logId: string | null; error?: string }
```

**Creates:** Record in `odometer_logs` table with `reading`, `photo_path`, `kind`, `recorded_at`

**Usage:**
```typescript
// At shift start
const { logId: startLog } = await recordOdometerReading(
  shift.id,
  vehicle.id,
  8950,
  startPhoto,
  'start'
);

// During shift (optional mid-readings)
await recordOdometerReading(shift.id, vehicle.id, 9100, null, 'mid');

// At shift end
const { logId: endLog } = await recordOdometerReading(
  shift.id,
  vehicle.id,
  9250,
  endPhoto,
  'end'
);
```

---

### `recordFuelLog(shiftId: string, vehicleId: string, liters: number, cost?: number, location?: string, photoUri?: string)`

Record a fuel top-up.

```typescript
const { logId, error } = await recordFuelLog(
  shiftId,
  vehicleId,
  45.5,  // liters
  67.50,  // cost (optional)
  'Shell Station, Main St',  // location (optional)
  'file:///photos/fuel-receipt.jpg'  // photo (optional)
);

// Returns: { logId: string | null; error?: string }
```

**Creates:** Record in `fuel_logs` table with `liters`, `cost`, `location`, `photo_path`

**Usage:**
```typescript
const { logId, error } = await recordFuelLog(
  activeShift.id,
  assignedVehicle.id,
  50.0,
  75.00,
  'BP Station'
);
if (error) {
  Alert.alert('Failed to log fuel', error);
  return;
}
Alert.alert('Fuel logged', `Entry ${logId} recorded`);
```

---

## GPS Service (`src/lib/gps.ts`)

### `requestLocationPermissions()`

Request both foreground and background location permissions.

```typescript
const granted = await requestLocationPermissions();

// Returns: boolean (true if both granted)
```

**Behavior:**
- Requests foreground permissions (continuous while app active)
- Requests background permissions (for ongoing tracking)
- Returns true only if both granted

**Usage:**
```typescript
const allowed = await requestLocationPermissions();
if (!allowed) {
  console.warn('Location permissions not granted; GPS tracking disabled');
  // App continues, but GPS not available
  return;
}
console.log('Location permissions granted');
```

---

### `startTracking(shiftId: string)`

Begin GPS location tracking for a shift.

```typescript
await gps.startTracking(shiftId);
```

**Behavior:**
- Checks location permissions
- Starts `watchPositionAsync` with high accuracy
- Records location every 10 seconds or 5 meters (whichever first)
- Automatic stop detection (2+ minutes stationary)
- Queues points/stops if offline

**Console Output:**
```
[GPS] Starting tracking for shift: {shift_id}
[GPS] Update: speed=45.2km/h lat=40.7128 lng=-74.0060
[GPS] Stop event started at: 2026-02-02T14:30:00Z
[GPS] Stop event threshold reached (2+ minutes stationary)
[GPS] Recorded stop event: 120s
```

**Usage:**
```typescript
useEffect(() => {
  if (activeShift) {
    gps.startTracking(activeShift.id);
  }
}, [activeShift]);
```

---

### `stopTracking()`

Stop GPS location tracking.

```typescript
await gps.stopTracking();
```

**Behavior:**
- Removes location subscription
- Ends any active stop event
- Queues final stop event if offline

**Usage:**
```typescript
useEffect(() => {
  return () => {
    // Clean up on component unmount
    gps.stopTracking();
  };
}, []);

// Or when ending shift
const { success } = await endShift(...);
if (success) {
  await gps.stopTracking();
}
```

---

### `recordGPSPoint(shiftId: string, lat: number, lng: number, speed: number, heading: number, accuracy: number)`

Record a GPS point (usually called automatically by `startTracking`).

```typescript
await recordGPSPoint(
  shiftId,
  40.7128,     // latitude
  -74.0060,    // longitude
  45.2,        // speed in km/h
  180,         // heading 0-360 degrees
  5            // accuracy in meters
);
```

**Queuing:**
- If offline: Queues with type 'GPS_POINT'
- If online: Writes immediately to `gps_points` table

**Typical Call Stack:**
```
startTracking()
  └─ watchPositionAsync()
      └─ handleLocationUpdate()
          └─ recordGPSPoint()
```

---

### `recordStopEvent(shiftId: string, stopEvent: StopEvent)`

Record a vehicle stop event.

```typescript
await recordStopEvent(shiftId, {
  shift_id: shiftId,
  started_at: '2026-02-02T14:30:00Z',
  ended_at: '2026-02-02T14:32:00Z',
  lat: 40.7128,
  lng: -74.0060,
  duration_seconds: 120
});
```

**Automatic Triggers:**
- Called when vehicle stationary 2+ minutes
- Called on `stopTracking()` to close any active stop

**Queuing:**
- If offline: Queues with type 'STOP_EVENT'
- If online: Writes to `stop_events` table

---

### `getShiftGPSStats(shiftId: string)`

Get GPS statistics for a completed shift.

```typescript
const { pointCount, stopCount, avgSpeed, error } = await getShiftGPSStats(shiftId);

// Returns:
// {
//   pointCount: number;      // total GPS points recorded
//   stopCount: number;       // total stop events
//   avgSpeed: number;        // average speed (always 0 currently)
//   error?: string;
// }
```

**Usage:**
```typescript
const stats = await getShiftGPSStats(shift.id);
console.log(`Shift recorded ${stats.pointCount} GPS points, ${stats.stopCount} stops`);
```

---

## Offline Queue Integration

All service functions automatically queue operations when offline:

**Offline Queueing:**
```typescript
// When offline, this queues instead of writing
const { success } = await endShift(shiftId, 9250);
// Returns: { success: true } (queued)
// Console: [Shift] Offline: queuing shift end
```

**Queue Flushing:**
```typescript
// When network restored, auto-synced
// Console: [Offline] Flushing queue: 3 items
// Retries with exponential backoff (max 5 attempts)
// Each retry visible in console
```

**Queue Status:**
```typescript
// Check queue via OfflineQueueScreen
// See pending, syncing, and failed operations
// Manually trigger sync if needed
```

---

## Error Handling Pattern

All service functions follow consistent error handling:

```typescript
// Good pattern
const { shift, error } = await createShift(driver.id, vehicle.id);
if (error) {
  console.error('[Service] Error:', error);
  Alert.alert('Error', error);
  return;
}

// Bad pattern - don't do this
try {
  const { shift } = await createShift(...);
  // No error check!
} catch (e) {
  // This won't work; errors returned in object
}
```

---

## Console Logging Reference

Services log with consistent prefixes for easy debugging:

- `[Assignment]` - Vehicle assignment resolution
- `[Shift]` - Shift lifecycle (create, end, break)
- `[Break]` - Break operations
- `[Odometer]` - Odometer readings
- `[Fuel]` - Fuel logs
- `[GPS]` - GPS tracking
- `[Offline]` - Offline queue operations

**Example Full Session Log:**
```
APP BUILD: transline-driver-fullflow-2026-02-02
[Assignment] auth user {uuid}
[Assignment] resolved vehicle: {id} from: assigned_driver_id
[Shift] Created shift: {id}
[GPS] Starting tracking for shift: {id}
[GPS] Update: speed=50km/h ...
[GPS] Stop event started ...
[GPS] Stop event threshold reached
[GPS] Recorded stop event: 120s
[Break] Started break
[Break] Ended break
[Fuel] Recorded fuel log
[Shift] Ended shift
[GPS] Stopping tracking
```

---

## Testing Service Layer

### Unit Test Example
```typescript
import { getAssignedVehicleForCurrentUser } from './assignment';

jest.mock('./supabase');

test('should resolve vehicle from assigned_driver_id', async () => {
  mockSupabase.from('vehicles').select.mockResolvedValue({
    data: { id: 'v1', registration: 'ABC-123', rego: 'ABC123' },
    error: null
  });
  
  const { vehicle, assignmentSource } = await getAssignedVehicleForCurrentUser();
  
  expect(vehicle.id).toBe('v1');
  expect(assignmentSource).toBe('assigned_driver_id');
});
```

### Integration Test Example
```typescript
test('full shift lifecycle offline then sync', async () => {
  // Offline
  networkMonitor.mockOnline(false);
  const { shift } = await createShift(driver.id, vehicle.id);
  expect(offlineQueue.getPendingCount()).toBe(1);
  
  // Go online
  networkMonitor.mockOnline(true);
  await offlineQueue.syncQueue();
  
  // Verify shift exists in Supabase
  const { data: created } = await supabase
    .from('shifts')
    .select('*')
    .eq('id', shift.id)
    .single();
  expect(created).toBeTruthy();
});
```

---

## Performance Notes

- **GPS Points:** Recorded every 10s or 5m, can result in many rows per shift
  - Mitigation: Batch writes in production
  - Current: Single write per point (simple, reliable)

- **Offline Queue:** AsyncStorage limited to ~10MB per app
  - Concern: Very long offline periods could exceed limit
  - Mitigation: Auto-cleanup old failed items after N days

- **Stop Detection:** 2-minute threshold may be customized
  - Current: 120 seconds = 12 updates @ 10s interval
  - Edit: `src/lib/gps.ts` line ~30 to adjust

---

## Future Enhancements

- [ ] Photo upload to Supabase storage
- [ ] Batch GPS point writes (reduce DB load)
- [ ] Geofencing for automatic break detection
- [ ] Route optimization for delivery planning
- [ ] Driver behavior scoring (acceleration, harsh braking)
- [ ] Real-time vehicle tracking via WebSocket
- [ ] Multi-vehicle assignments
- [ ] Scheduled maintenance reminders

---

**Build:** APP BUILD: transline-driver-fullflow-2026-02-02  
**Last Updated:** 2026-02-02
