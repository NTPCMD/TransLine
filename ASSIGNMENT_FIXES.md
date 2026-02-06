# Assignment Resolution Fixes - Summary

## Problem Statement
The app was displaying "Vehicle not assigned" even when drivers had assigned vehicles. The issue was caused by:

1. **Repeated fetch cycles** - AssignmentContext was fetching without debouncing, potentially missing assignments
2. **Missing error handling** - Assignment resolution wasn't properly handling database query errors
3. **Non-existent column references** - Queries referenced columns that don't exist in the schema
4. **Invalid field access** - StartShiftScreen tried to access `vehicle.name` which doesn't exist

## Root Cause Analysis

### Database Column Issues
The Supabase schema uses:
- `drivers.auth_user_id` (NOT `drivers.user_id`)
- `vehicles.registration`, `vehicles.rego`, `vehicles.plate_number` for vehicle identification
- NO `vehicles.name` field (removed from schema)
- `vehicle_assignments` table uses `assigned_at` field (NOT `created_at`)

### Assignment Flow Issues
The assignment resolver has a priority:
1. **Primary**: `vehicles.assigned_driver_id = auth.uid()` (Portal assigns directly to auth user ID)
2. **Secondary**: `vehicles.assigned_driver_id = driver.id` (Portal assigns to driver record ID)
3. **Tertiary**: `vehicle_assignments` table with `driver_id` (Legacy fallback)

## Fixes Applied

### 1. AssignmentContext.tsx - Debouncing & Error Handling
**File**: [src/state/AssignmentContext.tsx](src/state/AssignmentContext.tsx)

**Changes**:
- ✅ Added `lastFetchAt` state tracking to implement fetch debouncing
- ✅ Added `FETCH_DEBOUNCE_MS = 2000` constant (2-second debounce window)
- ✅ Added `force` parameter to `fetchAssignment()` to bypass debounce when needed
- ✅ Added error extraction from resolution: `error: resolveError`
- ✅ Added error state handling when resolution fails
- ✅ Updated `useEffect` to call `fetchAssignment(true)` on mount (forces initial fetch)
- ✅ Updated auth state change listener to use `fetchAssignment(true)` (forces refresh on login/logout)

**Benefits**:
- Prevents hammering the database with repeated assignments queries
- Allows forced refreshes on auth changes
- Properly propagates and displays resolution errors
- Ensures vehicle data is loaded on app startup

### 2. lib/assignment.ts - Already Correct
**File**: [src/lib/assignment.ts](src/lib/assignment.ts)

**Status**: ✅ No changes needed
- Already uses `auth_user_id` (correct column)
- Already uses `assigned_driver_id` for vehicle matching (correct)
- Already selects valid fields from vehicles table
- Already handles errors in all Supabase queries
- Already implements robust priority-based assignment resolution

### 3. StartShiftScreen.tsx - Removed Invalid Field Reference
**File**: [src/screens/StartShiftScreen.tsx](src/screens/StartShiftScreen.tsx#L24)

**Changes**:
```typescript
// BEFORE
const vehicleRegistration =
  state.vehicleRegistration ??
  assignedVehicle?.registration ??
  vehicle?.registration ??
  vehicle?.rego ??
  vehicle?.plate_number ??
  vehicle?.name;  // ❌ REMOVED - doesn't exist

// AFTER
const vehicleRegistration =
  state.vehicleRegistration ??
  assignedVehicle?.registration ??
  vehicle?.registration ??
  vehicle?.rego ??
  vehicle?.plate_number;  // ✅ Valid fallback chain
```

**Benefits**:
- Eliminates TypeScript errors
- Uses only fields that exist in database schema
- Maintains graceful fallback to 'Not assigned' display

## Verification

### Database Schema Validation
The fixes align with the actual Supabase schema:

```sql
-- drivers table: uses auth_user_id (NOT user_id)
CREATE TABLE drivers (
  id UUID PRIMARY KEY,
  auth_user_id UUID NOT NULL,
  -- ... other columns
);

-- vehicles table: has registration, rego, plate_number (NO name field)
CREATE TABLE vehicles (
  id UUID PRIMARY KEY,
  registration TEXT,
  rego TEXT,
  plate_number TEXT,
  assigned_driver_id UUID,
  assigned_at TIMESTAMP,
  -- ... other columns
);

-- vehicle_assignments table: uses assigned_at (NOT created_at)
CREATE TABLE vehicle_assignments (
  id UUID PRIMARY KEY,
  driver_id UUID NOT NULL,
  vehicle_id UUID NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  unassigned_at TIMESTAMP,
  -- ... other columns
);
```

### Assignment Resolution Flow
The implementation correctly tries these in order:

1. **Check vehicles.assigned_driver_id = auth.uid()**
   - Most direct: Portal assigns straight to authenticated user
   - Query: `SELECT ... FROM vehicles WHERE assigned_driver_id = ?`

2. **Fetch driver record**
   - Query: `SELECT id FROM drivers WHERE auth_user_id = ?`

3. **Check vehicles.assigned_driver_id = driver.id**
   - Portal assigns to driver record ID
   - Query: `SELECT ... FROM vehicles WHERE assigned_driver_id = ?`

4. **Fallback to vehicle_assignments table**
   - Query: `SELECT vehicle_id FROM vehicle_assignments WHERE driver_id = ? AND unassigned_at IS NULL`

## Console Logs for Debugging

The updated code provides clear [Assignment] logs:

```
[Assignment] Auth user: abc-123
[Assignment] [STEP 1] Checking vehicles.assigned_driver_id = auth.uid()
[Assignment] ✓ Found vehicle via vehicles.assigned_driver_id (auth.uid): vehicle-456
[Assignment] Resolved vehicle: vehicle-456 via: vehicles.assigned_driver_id
```

## Testing Checklist

- [ ] **Login with an assigned driver account**
  - Expected: Assignment resolves to the assigned vehicle
  - Console shows: `[Assignment] ✓ Found vehicle ...`
  - Screen displays: Vehicle registration (not "Vehicle not assigned")

- [ ] **Login with an unassigned driver account**
  - Expected: Status stays 'unassigned'
  - Console shows: `[Assignment] ✗ No vehicle assignment found through any method`
  - Screen displays: "Vehicle not assigned"

- [ ] **Rapid assignment checks (within 2 seconds)**
  - Expected: Debounce prevents repeated queries
  - Console shows: `[Assignment] Skipping fetch (debounced, last fetch X ms ago)`

- [ ] **Force refresh after 2 seconds**
  - Expected: New fetch occurs
  - Console shows: Fresh assignment resolution logs

- [ ] **Auth state change (login/logout)**
  - Expected: Assignment refreshes immediately
  - Console shows: Fresh resolution logs

## Files Modified

1. ✅ [src/state/AssignmentContext.tsx](src/state/AssignmentContext.tsx) - Added debouncing, error handling, forced refresh
2. ✅ [src/screens/StartShiftScreen.tsx](src/screens/StartShiftScreen.tsx) - Removed reference to non-existent `vehicle.name`

## Files NOT Modified (Already Correct)

- [src/lib/assignment.ts](src/lib/assignment.ts) - Already has robust resolution logic
- [sql/rls_driver_policies.sql](sql/rls_driver_policies.sql) - Schema correct
- All other screens using `useActiveAssignment()` - Work correctly with vehicle data

## Next Steps

1. Deploy the changes to test environment
2. Monitor console logs for assignment resolution
3. Verify that previously "unassigned" drivers now see their vehicles
4. Test that unassigned drivers still see "Vehicle not assigned" message
5. Confirm no repeated database queries in network inspector
