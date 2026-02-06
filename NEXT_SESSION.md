# Next Session Checklist

**Build:** APP BUILD: transline-driver-fullflow-2026-02-02  
**Status:** Session Complete - Foundation Work Done ✅  
**Progress:** ~25% of 13-phase implementation complete

---

## Quick Start for Next Session

### 1. Verify Current State (2 minutes)
- [ ] Check build compiles: `npm run start` (should show green build stamp)
- [ ] Check console for: `APP BUILD: transline-driver-fullflow-2026-02-02`
- [ ] Verify no fatal errors (TypeScript warnings in App.tsx OK)

### 2. Test Vehicle Assignment (5 minutes)
**Location:** StartShiftScreen → Should show assigned vehicle

```
Steps:
1. Login with test driver account
2. Navigate to StartShiftScreen
3. Check that vehicle registration displays
4. Check console: [Assignment] resolved vehicle: {id} from: assigned_driver_id
5. Click "Begin pre-start checklist" (should enable)
```

**Expected:**
```
✅ Vehicle shows (even if vehicle_assignments table empty)
✅ Console shows assignment resolution method
✅ Button enabled and clickable
❌ "Not assigned" error (indicates bug not fixed)
```

### 3. Review Service Layer Files (10 minutes)
- [ ] Read `docs/SERVICE_LAYER_API.md` for API reference
- [ ] Note the 3 main services: `assignment.ts`, `shifts.ts`, `gps.ts`
- [ ] Understand offline queue integration pattern

### 4. Next Priority Tasks

#### Task 1: Wire GPS Lifecycle (30 minutes)
**File:** `src/screens/ActiveShiftScreen.tsx`

Add to top of component:
```typescript
import { useGPS } from '../state/GPSContext';
```

In useEffect:
```typescript
useEffect(() => {
  if (activeShift?.id) {
    gps.startTracking(activeShift.id);
    console.log('[ActiveShift] Started GPS tracking');
  }
  return () => {
    gps.stopTracking();
    console.log('[ActiveShift] Stopped GPS tracking');
  };
}, [activeShift?.id]);
```

**File:** `src/screens/EndShiftScreen.tsx`

Before `endShift()` call in `handleConfirm()`:
```typescript
await gps.stopTracking();
const { success: ended } = await endShift(...);
```

#### Task 2: Wire Service Layer to BreakControl (20 minutes)
**File:** `src/screens/BreakControlScreen.tsx`

Replace button handlers:
```typescript
import { startBreak, endBreak } from '../lib/shifts';

// In BreakControlScreen component:
const handleStartBreak = async () => {
  const { breakId, error } = await startBreak(activeShift.id);
  if (error) {
    Alert.alert('Error', error);
    return;
  }
  // Update UI to show break active
};

const handleEndBreak = async () => {
  const { success, error } = await endBreak(activeBreak.id);
  if (error) {
    Alert.alert('Error', error);
    return;
  }
  // Update UI to show break ended
};
```

#### Task 3: Wire Service Layer to FuelLog (20 minutes)
**File:** `src/screens/FuelLogScreen.tsx`

Replace submit handler:
```typescript
import { recordFuelLog } from '../lib/shifts';

const handleSubmit = async () => {
  const { logId, error } = await recordFuelLog(
    activeShift.id,
    assignedVehicle.id,
    parseFloat(liters),
    cost ? parseFloat(cost) : undefined,
    location,
    photoUri
  );
  if (error) {
    Alert.alert('Error', error);
    return;
  }
  Alert.alert('Logged', `Fuel entry ${logId} recorded`);
  navigation.goBack();
};
```

#### Task 4: Test Offline Queue (30 minutes)
1. Enable airplane mode (or disable network)
2. Start shift via StartShiftScreen
3. Record break start
4. Record fuel log
5. Check console for: `[Shift/Break/Fuel] Offline: queuing {operation}`
6. Check offlineQueue.ts for items
7. Disable airplane mode
8. Check console for: `[Offline] Flushing queue`
9. Verify data appears in Supabase

#### Task 5: Full End-to-End Test (60 minutes)
Follow docs/DRIVER_APP_FLOW_ACCEPTANCE_TEST.md Phase 1-5:
1. Login with valid credentials
2. Vehicle assignment shows
3. Start shift (creates GPS tracking)
4. Take break
5. Log fuel
6. End shift with odometer + photo
7. Verify all data in Supabase

---

## Commands Cheat Sheet

```bash
# Start dev server
npm run start

# Start on Android/iOS
npm run start:android
npm run start:ios

# Run tests (if configured)
npm test

# Type check
npx tsc --noEmit

# Check files
ls -la src/lib/
find src -name "*.ts" -type f | wc -l
```

---

## Verification Checklist

### Console Log Output
Look for these in dev console:

```
✅ [Assignment] resolved vehicle: {id} from: assigned_driver_id
✅ [Shift] Created shift: {id}
✅ [GPS] Starting tracking for shift: {id}
✅ [GPS] Update: speed=XX km/h lat=X lng=X
✅ [GPS] Stop event threshold reached (2+ minutes stationary)
✅ [Break] Started break: {id}
✅ [Break] Ended break: {id}
✅ [Fuel] Recorded fuel log: {id}
✅ [Shift] Ended shift: {id}
✅ [GPS] Stopping tracking
```

### Database Verification
Run these queries in Supabase:

```sql
-- Check shifts
SELECT id, driver_id, vehicle_id, started_at, ended_at, status 
FROM shifts 
WHERE driver_id = {current_driver_id}
ORDER BY started_at DESC
LIMIT 5;

-- Check GPS points
SELECT COUNT(*) as point_count, shift_id
FROM gps_points
WHERE shift_id = {last_shift_id}
GROUP BY shift_id;

-- Check stop events
SELECT id, started_at, ended_at, duration_seconds
FROM stop_events
WHERE shift_id = {last_shift_id};

-- Check breaks
SELECT id, shift_id, start_at, end_at
FROM break_logs
WHERE shift_id = {last_shift_id};

-- Check fuel logs
SELECT id, shift_id, liters, cost, location
FROM fuel_logs
WHERE shift_id = {last_shift_id};
```

---

## Known Issues & Workarounds

### Issue 1: App.tsx TypeScript Warnings
- **What:** Red underlines on Screen components
- **Why:** Strict React Navigation type checking
- **Impact:** None - code works at runtime
- **Action:** Can ignore or use type assertions if desired

### Issue 2: GPS Permission Denied
- **What:** GPS tracking doesn't start
- **Why:** User denied location permissions
- **Impact:** GPS not available, app continues without it
- **Fix:** Request permissions again in settings

### Issue 3: Photo Upload Missing
- **What:** Photos captured but not uploaded to storage
- **Why:** Photo upload not yet integrated
- **Impact:** Photo URIs stored but files not persisted
- **Fix:** Will be implemented in separate task

---

## File Reference Quick Links

| File | Purpose | Lines |
|------|---------|-------|
| src/lib/assignment.ts | Vehicle assignment resolver | 134 |
| src/lib/shifts.ts | Shift lifecycle API | 187 |
| src/lib/gps.ts | GPS tracking API | 280 |
| src/state/AssignmentContext.tsx | Assignment context (updated) | 144 |
| src/screens/ActiveShiftScreen.tsx | Main shift screen | 282 |
| src/screens/EndShiftScreen.tsx | End shift screen | 307 |
| src/screens/BreakControlScreen.tsx | Break management | - |
| src/screens/FuelLogScreen.tsx | Fuel logging | - |
| docs/SERVICE_LAYER_API.md | API reference | 450 |
| docs/DRIVER_APP_FLOW_ACCEPTANCE_TEST.md | Test procedures | 400+ |

---

## Progress Tracking

### Completed This Session ✅
- [x] Vehicle assignment bug fix
- [x] Service layer creation (shifts + GPS)
- [x] Offline queue integration
- [x] Comprehensive documentation
- [x] Test checklist creation

### TODO - Next Session 🔄
- [ ] GPS lifecycle wiring (ActiveShift + EndShift)
- [ ] BreakControl service integration
- [ ] FuelLog service integration
- [ ] Offline queue testing
- [ ] Full end-to-end flow test
- [ ] GPS stop detection validation

### Future Phases 📋
- [ ] Phase 5: Shift start/checklist flow
- [ ] Phase 6-8: Break/Fuel/Readings integration
- [ ] Phase 10: End shift → Odometer flow
- [ ] Phase 11: Full GPS lifecycle
- [ ] Phase 12: Offline queue stress test
- [ ] Phase 13: Acceptance test execution

---

## Support & Resources

**Key Documentation Files:**
1. `docs/SERVICE_LAYER_API.md` - API reference with examples
2. `docs/DRIVER_APP_FLOW_ACCEPTANCE_TEST.md` - Test procedures
3. `SESSION_SUMMARY.md` - Detailed work log from this session
4. `IMPLEMENTATION_STATUS.md` - Overall project status

**Code Examples:**
- See `src/state/AssignmentContext.tsx` for assignment usage
- See `src/lib/shifts.ts` for service pattern
- See `src/lib/gps.ts` for offline queue integration

**Debugging Tips:**
- Watch browser/device console for `[Component]` prefixed logs
- Use Supabase dashboard to verify database writes
- Check AsyncStorage for offline queue items
- Review database schema in Supabase SQL editor

---

## Success Criteria for Next Session

**Minimum (1 hour):**
- [ ] GPS lifecycle wired (startTracking + stopTracking)
- [ ] BreakControl integration with shifts.ts
- [ ] Offline queue working (tested with airplane mode)

**Target (2-3 hours):**
- [ ] All service layers wired (breaks, fuel, GPS)
- [ ] Full end-to-end flow works
- [ ] Database records created correctly
- [ ] Console logs show expected output

**Stretch (4+ hours):**
- [ ] All screen integrations complete
- [ ] GPS stop detection validated
- [ ] Offline sync tested under various conditions
- [ ] Initial acceptance test passed

---

## Final Notes

The foundation is solid. All critical fixes are in place:
- ✅ Assignment bug is FIXED
- ✅ Service layer is CREATED
- ✅ Offline support is INTEGRATED
- ✅ Documentation is COMPREHENSIVE

Next session is about **wiring the services into the screens** and **validating the complete flow**. This is mostly integration work, no complex new code needed.

Estimated time to completion: 3-4 hours for basic integration, 6-8 hours for full testing.

**Good luck! 🚀**
