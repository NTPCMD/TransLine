# Push Notifications

## Overview

The TransLine mobile app implements push notifications using Expo's notification system. This enables the operations team to send real-time alerts, reminders, and updates to drivers.

## Implementation

### PushNotificationManager Service

The `PushNotificationManager` class (`src/lib/pushNotifications.ts`) provides a singleton service:

```typescript
import { pushNotificationManager } from '../lib/pushNotifications';

// Register for notifications (call after login)
const token = await pushNotificationManager.registerForPushNotifications();

// Save token to database
if (token && driverId) {
  await pushNotificationManager.savePushToken(driverId, token);
}

// Send local notification
await pushNotificationManager.sendLocalNotification(
  'Shift Reminder',
  'Your shift starts in 30 minutes'
);
```

### Notification Types

The system supports these notification categories:

| Type | Description | Example |
|------|-------------|---------|
| Shift Reminders | Upcoming shift notifications | "Shift starts in 30 min" |
| Operations Alerts | Urgent operational messages | "Route change: Bus 42" |
| Announcements | General company updates | "New policy effective Monday" |
| Incident Updates | Status of reported incidents | "Incident #123 resolved" |
| Maintenance Alerts | Vehicle maintenance notices | "Bus 15 due for service" |

### Database Storage

Push tokens are stored in the `driver_push_tokens` table:

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| driver_id | UUID | Reference to driver profile |
| push_token | TEXT | Expo push token string |
| platform | TEXT | 'ios' or 'android' |
| updated_at | TIMESTAMPTZ | Last token update time |

**Constraints:**
- Unique constraint on `(driver_id, platform)`
- Allows one token per platform per driver

### Permissions

**iOS:**
- Permission request shown on first registration attempt
- User can grant or deny
- Settings can be changed in iOS Settings app

**Android:**
- Permissions typically granted by default (Android 12 and below)
- Android 13+ requires explicit permission

### Notification Channel (Android)

A default notification channel is created with:
- **Name**: "default"
- **Importance**: MAX (shows on lock screen)
- **Vibration**: Pattern [0, 250, 250, 250]
- **LED Color**: #C62828 (TransLine red)

### Integration Points

**After Login** (`LoginScreen.tsx`):
```typescript
const handleLogin = async () => {
  // ... authenticate user
  
  // Register for push notifications
  const pushToken = await pushNotificationManager.registerForPushNotifications();
  if (pushToken && currentDriver) {
    await pushNotificationManager.savePushToken(currentDriver.id, pushToken);
  }
};
```

**Profile Screen** (`ProfileScreen.tsx`):
- Toggle notification settings on/off
- Control sound and vibration preferences
- Settings stored in AsyncStorage

**App.tsx** (optional):
```typescript
useEffect(() => {
  // Setup notification listeners
  pushNotificationManager.setupNotificationListener((notification) => {
    console.log('Notification received:', notification);
  });

  pushNotificationManager.setupNotificationResponseListener((response) => {
    // Handle notification tap
    const data = response.notification.request.content.data;
    // Navigate based on notification type
  });

  return () => {
    pushNotificationManager.removeListeners();
  };
}, []);
```

## Notification Settings

### Storage

User preferences are stored in AsyncStorage:

```typescript
interface NotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
}
```

**Key**: `transline:notificationSettings`

### Loading Settings

```typescript
const settings = await pushNotificationManager.getSettings();
// Returns defaults if not set:
// { enabled: true, sound: true, vibration: true }
```

### Saving Settings

```typescript
await pushNotificationManager.saveSettings({
  enabled: true,
  sound: false,
  vibration: true,
});
```

## Sending Notifications

### From Server/Backend

Use Expo's Push API to send notifications:

```javascript
const message = {
  to: 'ExponentPushToken[xxxxx]',
  sound: 'default',
  title: 'Shift Reminder',
  body: 'Your shift starts in 30 minutes',
  data: { shiftId: '123', type: 'shift_reminder' },
};

await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(message),
});
```

### From App (Local)

```typescript
await pushNotificationManager.sendLocalNotification(
  'Break Reminder',
  'Time to take your mandatory break',
  { type: 'break_reminder' }
);
```

## Privacy & Security

### Row Level Security (RLS)

RLS policies ensure:
- Drivers can only manage their own tokens
- Service role has full access for sending notifications

### Token Management

- Tokens are device-specific
- Tokens can change (app reinstall, OS updates)
- Tokens should be refreshed periodically
- Old tokens are automatically replaced (upsert operation)

## Error Handling

### Permission Denied

If notification permission is denied:
- Token registration returns `null`
- App continues to function normally
- User can enable later in device settings
- Profile screen shows "Notifications Disabled"

### Token Registration Failure

If token retrieval fails:
- Error logged to console
- Returns `null` gracefully
- User can retry from Profile screen
- No impact on other app functionality

### Network Errors

If token save to database fails:
- Error logged
- Token remains in AsyncStorage
- Retry on next app launch
- User notified if persistent failure

## Testing

### Manual Testing

1. **Initial Setup**:
   - Login to app
   - Verify permission prompt appears
   - Grant notification permission
   - Check token saved to database

2. **Local Notification**:
   - Trigger local notification from Profile screen
   - Verify it appears in notification tray
   - Tap notification and verify app opens

3. **Settings**:
   - Toggle notification settings in Profile
   - Verify settings persist across app restarts
   - Test sound/vibration toggles

4. **Server Push** (requires backend):
   - Send test notification from server
   - Verify delivery to device
   - Check notification tap navigation

### Database Verification

```sql
-- Check push tokens for a driver
SELECT * FROM driver_push_tokens 
WHERE driver_id = '<driver-id>';

-- Count registered devices
SELECT platform, COUNT(*) 
FROM driver_push_tokens 
GROUP BY platform;

-- Find tokens updated recently
SELECT * FROM driver_push_tokens
WHERE updated_at > NOW() - INTERVAL '7 days'
ORDER BY updated_at DESC;
```

## Platform-Specific Notes

### iOS

- Requires Apple Developer account for production
- Test on physical device (not simulator)
- APNs certificate needed for Expo Push service
- Users can disable per-app notifications in iOS Settings

### Android

- Works in emulator and physical devices
- FCM credentials configured via Expo
- Notification channels customizable per category
- Users can customize per-channel in Android Settings

## Configuration

### app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#C62828"
        }
      ]
    ],
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#C62828"
    }
  }
}
```

### Project ID

Update the `projectId` in `pushNotifications.ts`:
```typescript
const tokenData = await Notifications.getExpoPushTokenAsync({
  projectId: 'your-actual-project-id', // From Expo dashboard
});
```

## Future Enhancements

Potential improvements:
- Scheduled notifications (shift reminders)
- Notification categories for filtering
- Rich notifications with images
- Action buttons in notifications
- Notification history screen
- Do Not Disturb mode
- Notification preferences per category
