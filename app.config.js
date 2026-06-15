export default ({ config }) => ({
  ...config,

  updates: {
    url: "https://u.expo.dev/e31119de-8260-4772-9009-3797a3a3e06a",
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
