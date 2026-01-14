# TransLine Mobile App - Build & Distribution Guide

## Prerequisites

### Required Accounts
1. **Expo Account** (Free)
   - Sign up: https://expo.dev/signup
   - Used for EAS Build service

2. **Apple Developer Account** ($99/year)
   - Only required for iOS builds
   - URL: https://developer.apple.com

3. **Google Play Console** ($25 one-time - OPTIONAL)
   - Only needed if publishing to Play Store later
   - For APK distribution, this is NOT required

### Required Tools

Install globally:
```bash
npm install -g eas-cli
npm install -g expo-cli
```

---

## Initial Setup (One-Time)

### 1. Login to EAS
```bash
eas login
```

### 2. Configure Project
```bash
cd /path/to/TransLine
eas build:configure
```

This creates `eas.json` and links your project to Expo.

### 3. Update Bundle Identifiers

Edit `app.json` and replace with your identifiers:
```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.transline"
    },
    "android": {
      "package": "com.yourcompany.transline"
    }
  }
}
```

**IMPORTANT:** iOS bundle ID must match your Apple Developer account!

### 4. Add Production Supabase Credentials

Create a production Supabase project (separate from development):

1. Go to https://supabase.com/dashboard
2. Create new project: "TransLine Production"
3. Copy URL and anon key

Update `app.json`:
```json
{
  "expo": {
    "extra": {
      "supabaseUrl": "https://YOUR_PROJECT.supabase.co",
      "supabaseAnonKey": "YOUR_PRODUCTION_ANON_KEY"
    }
  }
}
```

---

## Building for Android (APK)

### Build APK
```bash
npm run build:android
```

Or directly:
```bash
eas build --platform android --profile production
```

### What Happens:
1. EAS uploads your code to Expo servers
2. Builds Android APK (takes 10-20 minutes)
3. Generates signing key automatically (first build)
4. Provides download link when complete

### Download APK
After build completes, you'll get a URL like:
```
✔ Build complete!
  https://expo.dev/artifacts/eas/abc123xyz.apk
```

Or check all builds:
```bash
eas build:list
```

### Install APK on Android Devices

**Method 1: Direct Link**
1. Send the download URL to drivers
2. They open it on their Android device
3. Download the APK
4. Tap to install (may need to enable "Install from Unknown Sources")

**Method 2: QR Code**
- EAS provides a QR code after build
- Drivers scan with their phone camera
- Opens download page

**Method 3: Cloud Storage**
1. Upload APK to Google Drive / Dropbox
2. Share link with drivers
3. They download and install

---

## Building for iOS (Ad Hoc)

### Build IPA (Ad Hoc)
```bash
npm run build:ios
```

Or directly:
```bash
eas build --platform ios --profile production
```

### First Build - Apple Authentication
EAS will prompt:
```
✔ Log in to your Apple Developer account
  Email: your-apple-id@example.com
  Password: ••••••••
  2FA Code: 123456

✔ Select team
  → Your Company Name (Team ID: ABC123)

✔ Would you like EAS to manage your certificates?
  → Yes (Recommended)
```

**What EAS Does:**
- Creates/reuses distribution certificate
- Creates Ad Hoc provisioning profile
- Stores credentials securely
- Handles renewals automatically

### Download IPA
After build completes:
```
✔ Build complete!
  https://expo.dev/artifacts/eas/xyz789.ipa
```

### Install IPA on iOS Devices

**Method 1: TestFlight (Recommended)**
1. Upload IPA to App Store Connect
2. Add drivers as internal testers
3. They install TestFlight app
4. Install TransLine from TestFlight

**Method 2: Direct Install (Ad Hoc)**

Requirements:
- Device UDIDs must be registered in Apple Developer account
- Maximum 100 devices per year

Steps:
1. Get device UDIDs from drivers:
   - Settings > General > About > Name (tap 7 times reveals UDID)
   - Or use: https://udid.tech

2. Add UDIDs to Apple Developer:
   - https://developer.apple.com/account/resources/devices
   - Devices > + > Enter UDID

3. Rebuild with new devices:
   ```bash
   eas build --platform ios --profile production
   ```

4. Share IPA via:
   - Apple Configurator
   - Diawi: https://www.diawi.com
   - TestFlight

---

## Build Both Platforms
```bash
npm run build:both
```

Builds Android APK and iOS IPA simultaneously.

---

## Managing Builds

### List All Builds
```bash
eas build:list
```

### View Build Details
```bash
eas build:view [BUILD_ID]
```

### Cancel Running Build
```bash
eas build:cancel
```

---

## Updating the App

### Increment Version
Edit `app.json`:
```json
{
  "expo": {
    "version": "1.0.1",  // Update this
    "ios": {
      "buildNumber": "2"  // Update this
    },
    "android": {
      "versionCode": 2  // Update this
    }
  }
}
```

### Build New Version
```bash
npm run build:both
```

### Distribute to Users
Send new APK/IPA download links to drivers.

---

## Troubleshooting

### "Invalid Bundle Identifier"
- Verify bundle ID in `app.json` matches Apple Developer account
- Check for typos

### "Certificate Expired"
```bash
eas credentials
# Select iOS > Production > Build Credentials > Remove
# Then rebuild - EAS will create new certificate
```

### "Build Failed - Missing Dependencies"
```bash
rm -rf node_modules package-lock.json
npm install
npm run build:android
```

### "Provisioning Profile Doesn't Include Device"
1. Add device UDID to Apple Developer
2. Rebuild app

---

## Production Checklist

Before distributing to drivers:

**Testing:**
- [ ] Test on physical Android device
- [ ] Test on physical iOS device (if building iOS)
- [ ] Verify login works with production Supabase
- [ ] Test GPS tracking logs to database
- [ ] Test push notifications work
- [ ] Test offline mode queues events
- [ ] Complete full shift workflow (start to end)
- [ ] Test photo uploads to Supabase Storage

**Configuration:**
- [ ] Production Supabase URL configured
- [ ] Production Supabase anon key configured
- [ ] Bundle identifiers set correctly
- [ ] Version numbers updated
- [ ] Privacy policy included
- [ ] App icons optimized (1024x1024)

**Distribution:**
- [ ] APK tested and working
- [ ] IPA tested and working (if iOS)
- [ ] Download links ready
- [ ] Installation instructions prepared
- [ ] Driver onboarding documentation ready

---

## Cost Summary

**For APK Distribution (Android):**
- Expo Account: **FREE**
- EAS Build: **FREE** (up to 30 builds/month on free tier)
- Distribution: **FREE** (APK can be shared directly)

**Total: $0/month** ✅

**For iOS Ad Hoc Distribution:**
- Expo Account: **FREE**
- Apple Developer: **$99/year**
- EAS Build: **FREE** (same free tier)
- Distribution: **FREE** (Ad Hoc allows direct install)

**Total: $99/year** for iOS

---

## Support

**EAS Build Documentation:**
https://docs.expo.dev/build/introduction/

**EAS Submit Documentation:**
https://docs.expo.dev/submit/introduction/

**Community Forum:**
https://forums.expo.dev/

**Get Help:**
```bash
eas build --help
eas submit --help
```
