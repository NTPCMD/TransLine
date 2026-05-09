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
    .maybeSingle();

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

  if (!lookup.data) {
    console.warn('[DriverSession] driver lookup by user_id: no match, trying profile fallback', {
      authUserId: effectiveAuthUserId,
    });

    // Fallback 1: find profile where auth_user_id matches, then find driver by profile_id
    const profileByAuthId = await supabase
      .from('profiles')
      .select('id')
      .eq('auth_user_id', effectiveAuthUserId)
      .maybeSingle();

    // Fallback 2: profile.id may equal the auth UUID directly
    const profileIds = Array.from(
      new Set([profileByAuthId.data?.id, effectiveAuthUserId].filter(Boolean) as string[])
    );

    let fallbackDriver: DriverProfileRecord | null = null;
    for (const pid of profileIds) {
      const byProfileId = await supabase
        .from('drivers')
        .select('id, user_id, full_name, status, profile_id')
        .eq('profile_id', pid)
        .maybeSingle();
      if (byProfileId.data) {
        fallbackDriver = byProfileId.data as DriverProfileRecord;
        console.log('[DriverSession] driver found via profile_id fallback', {
          authUserId: effectiveAuthUserId,
          profileId: pid,
          driverId: fallbackDriver.id,
        });
        break;
      }
    }

    if (!fallbackDriver) {
      // Fallback 3: look up by email via auth user → profiles.email → drivers.email
      console.warn('[DriverSession] profile_id fallbacks failed, trying email fallback', {
        authUserId: effectiveAuthUserId,
      });

      const { data: authUserData } = await supabase.auth.getUser();
      const authEmail = authUserData?.user?.email ?? null;

      if (authEmail) {
        // Try drivers table directly by email field
        const byEmail = await supabase
          .from('drivers')
          .select('id, user_id, full_name, status, profile_id, email')
          .eq('email', authEmail)
          .maybeSingle();

        if (byEmail.data) {
          fallbackDriver = byEmail.data as DriverProfileRecord;
          console.log('[DriverSession] driver found via email fallback', {
            authUserId: effectiveAuthUserId,
            email: authEmail,
            driverId: fallbackDriver.id,
          });
        }

        // Try profiles by email → driver by profile_id
        if (!fallbackDriver) {
          const profileByEmail = await supabase
            .from('profiles')
            .select('id')
            .eq('email', authEmail)
            .maybeSingle();

          if (profileByEmail.data?.id) {
            const byProfileEmail = await supabase
              .from('drivers')
              .select('id, user_id, full_name, status, profile_id')
              .eq('profile_id', profileByEmail.data.id)
              .maybeSingle();

            if (byProfileEmail.data) {
              fallbackDriver = byProfileEmail.data as DriverProfileRecord;
              console.log('[DriverSession] driver found via profile email fallback', {
                authUserId: effectiveAuthUserId,
                email: authEmail,
                profileId: profileByEmail.data.id,
                driverId: fallbackDriver.id,
              });
            }
          }
        }
      }
    }

    if (!fallbackDriver) {
      console.error('[DriverSession] driver lookup exhausted — no driver record found', {
        authUserId: effectiveAuthUserId,
      });
      return {
        authUserId: effectiveAuthUserId,
        driver: null,
        profile: null,
        error: 'No driver account found for this user. Please contact your administrator.',
      };
    }

    // Continue with the fallback driver record
    const profileLookupFallback = await fetchProfileRecord(
      effectiveAuthUserId,
      fallbackDriver.profile_id ?? null
    );
    const driverFallback: DriverProfileRecord = {
      ...fallbackDriver,
      name: getDriverDisplayName(fallbackDriver, profileLookupFallback.profile),
      profile_id:
        (fallbackDriver.profile_id as string | null | undefined) ??
        profileLookupFallback.profile?.id ??
        null,
    };
    console.log('[DriverSession] fetchDriverContext:success (fallback)', {
      authUserId: effectiveAuthUserId,
      driverId: driverFallback.id,
      profileId: driverFallback.profile_id ?? null,
    });
    return {
      authUserId: effectiveAuthUserId,
      driver: driverFallback,
      profile: profileLookupFallback.profile,
      error: profileLookupFallback.error,
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
