export default ({ config }) => ({
  ...config,

  updates: {
    // Derived from the EAS project id in app.json rather than hardcoded: the previous
    // literal pointed at e31119de-8260-4772-9009-3797a3a3e06a while app.json declares
    // f2fb53e7-a81c-44f6-88ed-6651027ba157, so the two had silently drifted apart.
    // Harmless only because updates are disabled; enabling them would have published
    // to a different project than the one this app builds under.
    url: `https://u.expo.dev/${config.extra?.eas?.projectId}`,
    enabled: false,
  },

  runtimeVersion: {
    policy: "appVersion",
  },

  extra: {
    ...config.extra,
    // Fall back to the value already baked into app.json's `extra` so a build
    // machine without EXPO_PUBLIC_* env vars set never clobbers it with
    // undefined (which previously white-screened the IPA/APK at startup).
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL ?? config.extra?.SUPABASE_URL,
    SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? config.extra?.SUPABASE_ANON_KEY,
  },
});
