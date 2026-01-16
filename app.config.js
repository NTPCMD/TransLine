export default ({ config }) => ({
  ...config,

  updates: {
    url: "https://u.expo.dev/e31119de-8260-4772-9009-3797a3a3e06a",
  },

  runtimeVersion: {
    policy: "appVersion",
  },

  extra: {
    ...config.extra,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  },
});
