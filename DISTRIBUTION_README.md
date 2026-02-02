# TransLine Driver App - Installation Guide

## Developer Quickstart (Expo Go)

The Expo app root is the repository root (`/workspace/TransLine`).

Run the driver app:

```bash
cd /workspace/TransLine
npx expo start
```

If you need a tunnel for device testing:

```bash
npx expo start --tunnel
```

## For Android Drivers

### Step 1: Enable Installation from Unknown Sources
1. Open **Settings** on your Android device
2. Go to **Security** or **Privacy**
3. Enable **Install from Unknown Sources** or **Unknown Sources**
   (On newer Android: Settings > Apps > Special Access > Install Unknown Apps > Chrome/Browser > Allow)

### Step 2: Download the App
1. Open this link on your Android phone: [DOWNLOAD LINK]
2. Tap **Download**
3. Wait for download to complete

### Step 3: Install
1. Tap the downloaded file (usually in Downloads folder or notification)
2. Tap **Install**
3. Tap **Open** when installation completes

### Step 4: Grant Permissions
The app will ask for:
- **Location** - Required for shift tracking (Allow Always)
- **Camera** - Required for odometer photos (Allow)
- **Photos** - Required to save odometer images (Allow)
- **Notifications** - For operational alerts (Allow)

## For iPhone Drivers

### Installation via TestFlight (Recommended)
1. Install TestFlight from App Store: https://apps.apple.com/app/testflight/id899247664
2. Open invitation link sent via email
3. Tap **Install** in TestFlight
4. Open TransLine app from home screen

### First Launch
1. Open TransLine app
2. Allow permissions when prompted:
   - Location (Allow While Using App)
   - Camera (Allow)
   - Photos (Allow)
   - Notifications (Allow)

## Login Credentials

You will receive login credentials from your fleet manager:
- Email: your.email@transline.com
- Password: [Provided separately]

## Need Help?

Contact your fleet manager or IT support:
- Email: support@transline.com
- Phone: [SUPPORT NUMBER]

## Privacy

Read our privacy policy: [PRIVACY_POLICY.md]
Your location is only tracked during active shifts.
