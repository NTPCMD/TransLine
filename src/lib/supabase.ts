import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? Constants.expoConfig?.extra?.SUPABASE_URL;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? Constants.expoConfig?.extra?.SUPABASE_ANON_KEY;

// Whether real credentials were found. We intentionally do NOT throw when they
// are missing: this module is imported by every screen/provider at startup, so
// a throw here crashes the whole bundle before React renders anything, which
// shows up as a blank white screen on the installed IPA/APK with no diagnostics.
// Instead we expose this flag and let the app render a readable error screen.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase configuration. Check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or app.json extra).'
  );
}

// Use a syntactically valid placeholder when unconfigured so createClient itself
// does not throw at import time; calls will fail at runtime, but the app stays
// alive and can surface the config error to the user.
export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key',
  {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
