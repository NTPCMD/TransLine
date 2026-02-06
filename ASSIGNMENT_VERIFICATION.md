# Vehicle Assignment - Quick Verification Guide

## What Was Fixed

### 1. **Debouncing in AssignmentContext** ✅
   - Added debounce mechanism to prevent repeated database queries within 2 seconds
   - Added `force` parameter to bypass debounce when needed (auth changes)
   - Initial mount now calls `fetchAssignment(true)` to ensure first load works

### 2. **Error Handling in AssignmentContext** ✅
   - Now properly captures and displays errors from the assignment resolution
   - Sets status to 'error' when something goes wrong
   - Provides error messages for debugging

### 3. **Removed Invalid Column Reference** ✅
   - StartShiftScreen no longer references `vehicle.name` (doesn't exist in schema)
   - Uses valid fallback chain: registration → rego → plate_number

## How to Test

### Test Case 1: Driver with Assigned Vehicle
1. Login with a driver account that has an assigned vehicle
2. **Expected Result**: 
   - ✅ Screen shows vehicle registration (not "Vehicle not assigned")
   - ✅ Console shows `[Assignment] ✓ Found vehicle via...`
   - ✅ No repeated queries in network tab (debounced)

### Test Case 2: Driver Without Assignment
1. Login with an unassigned driver account
2. **Expected Result**:
   - ✅ Screen shows "Vehicle not assigned"
   - ✅ Console shows `[Assignment] ✗ No vehicle assignment found through any method`

### Test Case 3: Rapid Navigations (Test Debounce)
1. Navigate back and forth between screens rapidly (5+ times in 2 seconds)
2. **Expected Result**:
   - ✅ Only ONE assignment query in network tab
   - ✅ Console shows "Skipping fetch (debounced, last fetch X ms ago)"

### Test Case 4: Login/Logout
1. Login and logout (or let session expire)
2. **Expected Result**:
   - ✅ Assignment refreshes immediately on auth state change
   - ✅ Console shows fresh resolution logs (not debounced)

## Console Logs to Look For

### Success Case
```
[Assignment] Auth user: [uuid]
[Assignment] [STEP 1] Checking vehicles.assigned_driver_id = auth.uid()
[Assignment] ✓ Found vehicle via vehicles.assigned_driver_id (auth.uid): [vehicle-id]
[Assignment] Resolved vehicle: [vehicle-id] via: vehicles.assigned_driver_id
```

### No Assignment Case
```
[Assignment] Auth user: [uuid]
[Assignment] [STEP 1] Checking vehicles.assigned_driver_id = auth.uid()
[Assignment] [STEP 1] No vehicle found with assigned_driver_id = auth.uid()
[Assignment] [STEP 2] Fetching driver record where auth_user_id = auth.uid()
[Assignment] [STEP 2] Found driver record, id: [driver-id]
[Assignment] [STEP 3] Checking vehicles.assigned_driver_id = driver.id
[Assignment] [STEP 3] No vehicle found with assigned_driver_id = driver.id
[Assignment] [STEP 4] Checking vehicle_assignments table (fallback)
[Assignment] [STEP 4] No active assignment in vehicle_assignments table
[Assignment] ✗ No vehicle assignment found through any method
```

### Debounced Case
```
[Assignment] Skipping fetch (debounced, last fetch 1234 ms ago)
```

## Network Inspector Checks

### What You Should NOT See
❌ Multiple identical GET requests to `/rest/v1/vehicles` within 2 seconds
❌ Multiple identical GET requests to `/rest/v1/drivers` within 2 seconds
❌ Multiple identical GET requests to `/rest/v1/vehicle_assignments` within 2 seconds

### What You SHOULD See
✅ Single GET request when screen first loads
✅ Single GET request when auth state changes
✅ Single GET request after 2-second debounce window expires

## TypeScript Compilation

The app should compile without assignment-related errors:
```bash
npm run type-check
```

✅ **No errors** in:
- `src/state/AssignmentContext.tsx`
- `src/screens/StartShiftScreen.tsx`
- `src/lib/assignment.ts`

## Rollback Plan

If issues occur, the changes are minimal and easily reversible:

1. **Remove debouncing** - Delete `lastFetchAt` state and debounce logic
2. **Remove force parameter** - Change `fetchAssignment(true)` back to `fetchAssignment()`
3. **Restore vehicle.name fallback** - Add `vehicle?.name` back to StartShiftScreen (though it won't exist)

## Database Schema Verification

To verify the schema is correct:

```sql
-- Check drivers table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'drivers';
-- Should show: auth_user_id (NOT user_id)

-- Check vehicles table  
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vehicles';
-- Should show: registration, rego, plate_number (NO name)

-- Check vehicle_assignments table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vehicle_assignments';
-- Should show: assigned_at, unassigned_at (NOT created_at)
```

## Next Session Tasks

- [ ] Deploy fixes to staging environment
- [ ] Run manual test cases above
- [ ] Monitor console logs for any issues
- [ ] Check network tab for unnecessary queries
- [ ] Verify all driver types (assigned/unassigned) work correctly
- [ ] Test on slow/unreliable networks if possible
- [ ] Deploy to production once verified
