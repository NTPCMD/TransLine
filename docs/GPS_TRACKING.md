# GPS Location Tracking

## Overview

The TransLine mobile app includes GPS location tracking functionality to monitor driver locations during active shifts. Location events are stored in the `shift_events` table using the `logLocationEvent` function.

## Implementation

### Location Events Service

The `logLocationEvent` function (`src/lib/locationEvents.ts`) logs location fixes to the `shift_events` table:

```typescript
import { logLocationEvent, getGpsFix } from '../lib/locationEvents';

// Get a single GPS fix
const fix = await getGpsFix();

// Log a location event for a shift
await logLocationEvent(shiftId, fix.latitude, fix.longitude);
```

### Database Storage

Location events are stored in the `shift_events` table:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key (auto-generated) |
| shift_id | UUID | Reference to active shift |
| event_type | text | `'location'` |
| latitude | numeric | Latitude coordinate |
| longitude | numeric | Longitude coordinate |
| metadata | jsonb | Additional data (nullable) |
| created_at | timestamptz | Auto-set on insert |

### Permissions

The app requests foreground location permissions when needed:

1. On first attempt, user is prompted to grant location access
2. If denied, location fix is not obtained
3. Permission status is checked before each location operation

## Privacy & Security

### Row Level Security (RLS)

RLS policies ensure drivers can only:
- View their own shift events
- Insert events for their own shifts

### Data Retention

Location events are associated with shifts via `shift_id`. They are retained as part of the shift audit trail.

## Performance Considerations

### Battery Impact

To minimize battery drain:
- Use High accuracy (not Highest) for balance
- Request location only when needed
- Tracking only active during shifts

## Error Handling

### Permission Denied

If location permission is denied:
- User is notified with explanation
- Shift can continue without location logging

### Network Errors

If database insert fails:
- Error is logged to console
- Next update will attempt to save again

## Testing

### Manual Testing

1. **Start Tracking**:
   - Start a new shift
   - Verify permission prompt appears
   - Grant permission
   - Check that location events are logged to `shift_events`

2. **During Shift**:
   - Move device or use location simulation
   - Verify events appear in `shift_events` with `event_type = 'location'`

3. **Stop Tracking**:
   - End the shift
   - Confirm no more location events are saved

### Database Verification

```sql
-- Check recent location events for a shift
SELECT * FROM shift_events 
WHERE shift_id = '<shift-id>' AND event_type = 'location'
ORDER BY created_at DESC
LIMIT 10;

-- Count location events per shift
SELECT shift_id, COUNT(*) as event_count
FROM shift_events
WHERE event_type = 'location'
GROUP BY shift_id
ORDER BY event_count DESC;
```

## Future Enhancements

Potential improvements:
- Background location tracking (requires additional permissions)
- Offline location caching with sync on reconnect
- Geofencing for depot arrival/departure
- Route replay visualization
- Speed and distance analytics
