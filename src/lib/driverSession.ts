import { supabase } from './supabase';

export interface DriverProfileRecord {
  id: string;
  user_id?: string | null;
  full_name?: string | null;
  status?: string | null;
  profile_id?: string | null;
  name?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export interface UserProfileRecord {
  id: string;
  auth_user_id?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  [key: string]: unknown;
}

export interface DriverSessionResult {
  authUserId: string | null;
  driver: DriverProfileRecord | null;
  profile: UserProfileRecord | null;
  error?: string;
}

const isExpectedNoRows = (message?: string | null): boolean => {
  const normalized = (message ?? '').toLowerCase();
  return normalized.includes('0 rows') || normalized.includes('no rows');
};

export function getDriverDisplayName(
  driver: DriverProfileRecord | null,
  profile: UserProfileRecord | null
): string | null {
  const driverName = typeof driver?.name === 'string' ? driver.name.trim() : '';
  if (driverName) {
    return driverName;
  }

  const driverFullName = typeof driver?.full_name === 'string' ? driver.full_name.trim() : '';
  if (driverFullName) {
    return driverFullName;
  }

  const fullName = typeof profile?.full_name === 'string' ? profile.full_name.trim() : '';
  if (fullName) {
    return fullName;
  }

  const combinedName = [profile?.first_name, profile?.last_name]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .trim();

  return combinedName || null;
}

async function fetchProfileRecord(
  authUserId: string,
  profileId?: string | null
): Promise<{ profile: UserProfileRecord | null; error?: string }> {
  if (profileId) {
    const byProfileId = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .maybeSingle();

    if (byProfileId.data) {
      return { profile: byProfileId.data as UserProfileRecord };
    }

    if (
      byProfileId.error &&
      !byProfileId.error.message.toLowerCase().includes('0 rows') &&
      !byProfileId.error.message.toLowerCase().includes('multiple')
    ) {
      console.warn('[DriverSession] Profile lookup by profile_id failed', {
        profileId,
        message: byProfileId.error.message,
      });
    }
  }

  const byAuthUserId = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  if (byAuthUserId.data) {
    return { profile: byAuthUserId.data as UserProfileRecord };
  }

  if (byAuthUserId.error && !byAuthUserId.error.message.toLowerCase().includes('0 rows')) {
    return { profile: null, error: byAuthUserId.error.message };
  }

  return { profile: null };
}

export async function fetchDriverContext(authUserId?: string | null): Promise<DriverSessionResult> {
  let effectiveAuthUserId = authUserId ?? null;

  console.log('[DriverSession] fetchDriverContext:start', {
    providedAuthUserId: authUserId ?? null,
  });

  if (!effectiveAuthUserId) {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return {
        authUserId: null,
        driver: null,
        profile: null,
        error: error.message,
      };
    }
    effectiveAuthUserId = data.user?.id ?? null;
  }

  if (!effectiveAuthUserId) {
    console.log('[DriverSession] fetchDriverContext:no-auth-user');
    return {
      authUserId: null,
      driver: null,
      profile: null,
    };
  }

  console.log('[DriverSession] fetchDriverContext:lookup-driver', {
    authUserId: effectiveAuthUserId,
  });
  const lookup = await supabase
    .from('drivers')
    .select('id, user_id, full_name, status')
    .eq('user_id', effectiveAuthUserId)
    .single();

  if (lookup.error) {
    console.error('[DriverSession] driver lookup by user_id failed', {
      authUserId: effectiveAuthUserId,
      message: lookup.error.message,
    });
    return {
      authUserId: effectiveAuthUserId,
      driver: null,
      profile: null,
      error: lookup.error.message,
    };
  }

  const driverData = lookup.data as DriverProfileRecord;

  const profileLookup = await fetchProfileRecord(
    effectiveAuthUserId,
    (driverData as DriverProfileRecord).profile_id ?? null
  );

  const driver: DriverProfileRecord = {
    ...(driverData as DriverProfileRecord),
    name: getDriverDisplayName(driverData as DriverProfileRecord, profileLookup.profile),
    profile_id:
      ((driverData as DriverProfileRecord).profile_id as string | null | undefined) ??
      profileLookup.profile?.id ??
      null,
  };

  console.log('[DriverSession] fetchDriverContext:success', {
    authUserId: effectiveAuthUserId,
    driverId: driver.id,
    profileId: driver.profile_id ?? null,
  });

  return {
    authUserId: effectiveAuthUserId,
    driver,
    profile: profileLookup.profile,
    error: profileLookup.error,
  };
}
