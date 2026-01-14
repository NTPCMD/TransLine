# Offline & Reliability - Phase 2

## Overview

The TransLine mobile app now supports offline-first architecture, allowing drivers to continue working without internet connectivity. Events are automatically queued and synced when the connection is restored.

## Architecture

### Components

1. **Network Monitor** (`src/lib/networkMonitor.ts`)
   - Tracks online/offline status using `@react-native-community/netinfo`
   - Provides subscription-based notifications for network state changes
   - Singleton service accessible throughout the app

2. **Offline Queue** (`src/lib/offlineQueue.ts`)
   - Manages event queue with AsyncStorage persistence
   - Automatically syncs when network becomes available
   - Implements retry logic with exponential backoff (max 5 attempts)
   - Tracks event status: pending, syncing, failed

3. **Network Status Banner** (`src/components/NetworkStatusBanner.tsx`)
   - Visual indicator showing network/queue status
   - Red banner when offline
   - Yellow banner when online with queued events
   - Auto-hides when online with empty queue

4. **Offline Queue Screen** (`src/screens/OfflineQueueScreen.tsx`)
   - UI for viewing and managing queued events
   - Manual sync and clear queue options
   - Pull-to-refresh functionality
   - Real-time status updates

## How It Works

### Event Creation Flow

1. When `createEvent()` is called in AppStateContext:
   - Check network connectivity using NetworkMonitor
   - If offline: Add event to OfflineQueue immediately
   - If online: Try to insert to Supabase
   - On Supabase error: Add event to OfflineQueue as fallback

2. Events in the queue are automatically synced when:
   - Network becomes available (automatic)
   - User manually triggers sync via OfflineQueue screen
   - App initializes with queued events

### Queue Persistence

- Queue is stored in AsyncStorage under key `transline:offlineQueue`
- Persists across app restarts and force closes
- Loaded on app initialization

### Retry Logic

- Failed events are retried up to 5 times
- Each retry increments the retry count
- After 5 failed attempts, event is marked as "failed"
- Failed events remain in queue but won't be retried automatically
- Users can manually clear failed events via the UI

## Testing Scenarios

### 1. Offline Event Queueing

**Steps:**
1. Disable wifi/cellular on device
2. Navigate to active shift
3. Log fuel or report incident
4. Check NetworkStatusBanner - should show "🔴 Offline - Events will sync when connected"
5. Navigate to Offline Queue screen
6. Verify events appear with "PENDING" status

**Expected Result:** 
- Events are queued successfully
- No errors shown to user
- Events visible in Offline Queue screen

### 2. Background Sync

**Steps:**
1. With events queued (from test 1), re-enable network
2. Wait 5-10 seconds
3. Check Offline Queue screen
4. Verify events are removed from queue
5. Check Supabase `events` table for inserted records

**Expected Result:**
- Events automatically sync within 30 seconds
- Events removed from queue after successful sync
- Records appear in Supabase database

### 3. Manual Sync

**Steps:**
1. Queue some events while offline
2. Enable network
3. Open Offline Queue screen
4. Tap "Sync Now" button
5. Observe events syncing and being removed

**Expected Result:**
- Sync happens immediately
- Status changes from PENDING → SYNCING → (removed)
- Success confirmation

### 4. Pull-to-Refresh

**Steps:**
1. Open Offline Queue screen with queued events
2. Pull down on the list
3. Observe refresh animation and sync

**Expected Result:**
- Pull-to-refresh triggers sync
- Same behavior as "Sync Now" button

### 5. Retry Logic

**Steps:**
1. Simulate Supabase error (e.g., invalid shift_id)
2. Try to create event
3. Check Offline Queue screen
4. Observe retry count increasing on each sync attempt
5. After 5 attempts, verify status changes to "FAILED"

**Expected Result:**
- Retry count increments on each failed attempt
- Status changes to FAILED after 5 retries
- Failed events remain in queue but don't retry automatically

### 6. Persistence Across Restarts

**Steps:**
1. Queue events while offline
2. Force close app (swipe away from recents)
3. Reopen app
4. Navigate to Offline Queue screen
5. Verify events are still queued

**Expected Result:**
- Events persist across app restarts
- Queue is loaded from AsyncStorage on app init
- No data loss

### 7. Network Status Banner

**Steps:**
1. Test banner in different states:
   - Offline: Should show red banner
   - Online with queued events: Should show yellow banner with count
   - Online with empty queue: Should be hidden
2. Navigate between screens
3. Verify banner appears consistently

**Expected Result:**
- Banner shows correct state on all screens where it's added
- Auto-updates when network state or queue changes

### 8. Queue Count Badge

**Steps:**
1. Queue some events
2. Check ActiveShiftScreen
3. Verify "Offline Queue (N)" button shows count
4. Sync events
5. Verify count updates to empty or removes badge

**Expected Result:**
- Queue count displayed in button label
- Updates in real-time as queue changes

## UI Access Points

### Viewing Offline Queue

1. **From Active Shift Screen:**
   - Look for "Offline Queue" button (shows count when items queued)
   - Tap to open queue management screen

2. **From Drawer Menu:**
   - Open drawer (Menu button in top-right of Active Shift screen)
   - Select "Offline Queue" option

### Network Status Indicators

- **Banner at top of screen:** Shows on ActiveShiftScreen and EndShiftScreen
- **Queue count badge:** On ActiveShiftScreen "Offline Queue" button

## API Changes

### AppState

New property added to AppState interface:
```typescript
queuedEventsCount: number  // Count of events in offline queue
```

### createEvent Return Value

No changes to signature, but behavior enhanced:
- Returns `{ status: 'queued', error?: string }` when event is queued
- Returns `{ status: 'sent' }` when successfully sent to Supabase
- Returns `{ status: 'error', error: string }` on unrecoverable error

## Dependencies Added

- `@react-native-community/netinfo@^11.1.0` - Network state monitoring

## Configuration

### app.json

Added AsyncStorage plugin:
```json
{
  "expo": {
    "plugins": [
      ["@react-native-async-storage/async-storage"]
    ]
  }
}
```

## Troubleshooting

### Events Not Syncing

1. Check network connectivity
2. Check Offline Queue screen for error status
3. Verify shift_id, driver_id, vehicle_id are valid
4. Check app logs for Supabase errors

### Queue Not Persisting

1. Verify AsyncStorage permissions in app.json
2. Check for AsyncStorage errors in logs
3. Reinstall app to reset AsyncStorage

### Network Status Not Updating

1. Verify NetInfo permissions
2. Check NetworkMonitor subscription is active
3. Test with airplane mode toggle

## Future Enhancements

Potential improvements for future phases:

1. **Offline-First for Shifts**
   - Queue shift start/end operations
   - Handle shift creation without connectivity

2. **Conflict Resolution**
   - Handle merge conflicts when multiple devices queue same event
   - Implement last-write-wins or manual resolution

3. **Advanced Retry Strategies**
   - Per-event retry scheduling instead of sequential
   - Intelligent backoff based on error type
   - Circuit breaker pattern for persistent failures

4. **Queue Analytics**
   - Track sync success rate
   - Monitor queue size over time
   - Alert on persistently failed events

5. **Offline Data Browsing**
   - Cache shift history for offline viewing
   - Store announcements for offline access
   - Prefetch critical data

## Security Considerations

- Queue stored in AsyncStorage (encrypted on device)
- No sensitive data stored in queue beyond what's already in events
- Queue cleared on user logout (handled by existing resetShift)
- CodeQL security scan passed with 0 vulnerabilities

## Performance Considerations

- AsyncStorage operations are asynchronous and non-blocking
- Queue saves are batched during sync to reduce I/O
- Network state changes trigger sync immediately
- Auto-refresh interval in UI is 2 seconds (minimal impact)

## Support

For issues or questions:
- Check app logs for error messages
- Review Supabase event logs
- Contact development team with queue status screenshot
