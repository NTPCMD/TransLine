# GPS Location Tracking

## Overview

The TransLine mobile app includes GPS location tracking functionality to monitor driver locations during active shifts. This feature provides real-time location data for fleet management and route optimization.

## Implementation

### LocationTracker Service

The `LocationTracker` class (`src/lib/locationTracking.ts`) provides a singleton service for managing GPS tracking:

```typescript
import { locationTracker } from '../lib/locationTracking';

// Start tracking when shift begins
await locationTracker.startTracking(shiftId);

// Stop tracking when shift ends
locationTracker.stopTracking();

// Get current location once
const location = await locationTracker.getCurrentLocation();
```

### Tracking Configuration

**Default Settings:**
- **Update Interval**: 30 seconds
- **Distance Interval**: 100 meters
- **Accuracy**: High accuracy mode

Location updates are triggered when either:
- 30 seconds have elapsed since last update, OR
- The device has moved 100 meters or more

### Database Storage

Location logs are stored in the `location_logs` table with the following data:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| shift_id | UUID | Reference to active shift |
| latitude | DECIMAL(10,8) | Latitude coordinate |
| longitude | DECIMAL(11,8) | Longitude coordinate |
| accuracy | DECIMAL | Location accuracy in meters |
| speed | DECIMAL | Speed in meters per second |
| heading | DECIMAL | Heading in degrees (0-359) |
| timestamp | TIMESTAMPTZ | Time of location capture |
| created_at | TIMESTAMPTZ | Database insert time |

### Permissions

The app requests foreground location permissions when tracking starts:

1. On first attempt, user is prompted to grant location access
2. If denied, tracking will not start but shift can continue
3. Permission status is checked before each location operation

### Integration Points

**Starting a Shift** (`AppStateContext.tsx`):
```typescript
const startShift = async () => {
  // ... create shift in database
  
  // Start location tracking
  if (activeShiftId) {
    await locationTracker.startTracking(activeShiftId);
  }
};
```

**Ending a Shift** (`AppStateContext.tsx`):
```typescript
const endShift = async () => {
  // Stop location tracking first
  locationTracker.stopTracking();
  
  // ... update shift status
};
```

**Active Shift Screen** (`ActiveShiftScreen.tsx`):
- Displays tracking status indicator
- Shows last location update time
- Allows manual location refresh

## Privacy & Security

### Row Level Security (RLS)

RLS policies ensure drivers can only:
- View their own location logs
- Insert logs for their own shifts

Admins and service roles have full access for fleet management.

### Data Retention

Location logs are associated with shifts via foreign key. When a shift is deleted, all associated location logs are automatically removed (CASCADE).

## Performance Considerations

### Indexes

The following indexes optimize location log queries:
- `idx_location_logs_shift_id` - Fast shift-based lookups
- `idx_location_logs_timestamp` - Efficient time-range queries

### Battery Impact

To minimize battery drain:
- Use High accuracy (not Highest) for balance
- 30-second minimum interval prevents excessive updates
- Tracking only active during shifts
- Watch subscription is properly cleaned up on stop

## Error Handling

### Permission Denied

If location permission is denied:
- User is notified with explanation
- Shift can continue without tracking
- No location logs are saved

### GPS Signal Loss

If GPS signal is lost:
- Last known location remains available
- Updates resume when signal returns
- No error alerts to avoid distraction

### Network Errors

If database insert fails:
- Error is logged to console
- Location data is lost (no local caching for privacy)
- Next update will attempt to save again

## Testing

### Manual Testing

1. **Start Tracking**:
   - Start a new shift
   - Verify permission prompt appears
   - Grant permission
   - Check that location updates begin

2. **During Shift**:
   - Move device or use location simulation
   - Verify updates occur every 30 seconds or 100 meters
   - Check `location_logs` table in database

3. **Stop Tracking**:
   - End the shift
   - Verify tracking stops
   - Confirm no more location logs are saved

### Database Verification

```sql
-- Check recent location logs for a shift
SELECT * FROM location_logs 
WHERE shift_id = '<shift-id>'
ORDER BY timestamp DESC
LIMIT 10;

-- Count logs per shift
SELECT shift_id, COUNT(*) as log_count
FROM location_logs
GROUP BY shift_id
ORDER BY log_count DESC;
```

## Future Enhancements

Potential improvements:
- Background location tracking (requires additional permissions)
- Offline location caching with sync on reconnect
- Geofencing for depot arrival/departure
- Route replay visualization
- Speed and distance analytics
