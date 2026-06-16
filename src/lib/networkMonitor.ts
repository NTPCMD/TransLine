import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

// Configure NetInfo to work in Expo Go without a custom native build.
// reachabilityUrl is a lightweight head request used when the native module
// cannot determine internet reachability independently.
NetInfo.configure({
  reachabilityUrl: 'https://clients3.google.com/generate_204',
  reachabilityTest: async (response) => response.status === 204,
  reachabilityLongTimeout: 60 * 1000,
  reachabilityShortTimeout: 5 * 1000,
  reachabilityRequestTimeout: 15 * 1000,
  reachabilityShouldRun: () => true,
});

type NetworkCallback = (isOnline: boolean) => void;

/**
 * Decides whether a failed Supabase write should be treated as a connectivity
 * problem (safe to queue offline) versus a real server-side rejection that the
 * user must see. A PostgREST/Postgres error that carries a `code` reached the
 * database and is a genuine rejection (constraint, permission, raised
 * exception) — never hide that behind "Saved offline". A failure with no code
 * is almost always a transport/connectivity drop, so queueing is appropriate.
 */
export function isTransportError(code?: string | null, message?: string | null): boolean {
  if (code && code.trim().length > 0) return false;
  if (message && /Network request failed|Failed to fetch|Load failed|network error|timeout|timed out|ECONN|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return true;
  }
  // No structured error code → assume a connectivity/transport issue.
  return true;
}

/** Lightweight HTTP probe — used as a fallback when the native module is absent. */
async function httpProbeOnline(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.status === 204 || res.ok;
  } catch {
    return false;
  }
}

class NetworkMonitor {
  private subscribers: Set<NetworkCallback> = new Set();
  private currentIsOnline: boolean = true;
  private currentState: NetInfoState | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;
  private nativeModuleAvailable: boolean = true;

  constructor() {
    this.initialize();
  }

  private notify(isOnline: boolean) {
    this.currentIsOnline = isOnline;
    this.subscribers.forEach((callback) => {
      try {
        callback(isOnline);
      } catch (error) {
        console.error('[NetworkMonitor] subscriber error', error);
      }
    });
  }

  private initialize() {
    try {
      this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
        this.currentState = state;
        const isOnline = state.isConnected ?? false;
        this.notify(isOnline);
      });
    } catch (error: unknown) {
      // Native module not available (e.g. older Expo Go without custom dev client)
      this.nativeModuleAvailable = false;
      console.warn('[NetworkMonitor] NetInfo native module unavailable, using HTTP probe fallback', error);
      this.startPollingFallback();
    }
  }

  /** Poll every 10 s via HTTP when native module is absent. */
  private startPollingFallback() {
    const poll = async () => {
      const online = await httpProbeOnline();
      if (online !== this.currentIsOnline) {
        this.notify(online);
      }
    };
    void poll();
    setInterval(() => { void poll(); }, 10_000);
  }

  /**
   * Check if currently online
   */
  async isOnline(): Promise<boolean> {
    if (!this.nativeModuleAvailable) {
      return httpProbeOnline();
    }
    try {
      const state = await NetInfo.fetch();
      return state.isConnected ?? false;
    } catch (error) {
      console.warn('[NetworkMonitor] NetInfo.fetch failed, using HTTP probe', error);
      return httpProbeOnline();
    }
  }

  /**
   * Subscribe to network changes
   * Returns an unsubscribe function
   */
  subscribe(callback: NetworkCallback): () => void {
    this.subscribers.add(callback);

    // Immediately call with current known state
    try {
      callback(this.currentIsOnline);
    } catch (error) {
      console.error('[NetworkMonitor] error in initial callback', error);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current network type (wifi/cellular/none)
   */
  async getNetworkType(): Promise<string> {
    if (!this.nativeModuleAvailable) {
      return 'unknown';
    }
    try {
      const state = await NetInfo.fetch();
      return state.type || 'unknown';
    } catch (error) {
      console.warn('[NetworkMonitor] getNetworkType failed', error);
      return this.currentState?.type || 'unknown';
    }
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    this.subscribers.clear();
  }
}

// Export singleton instance
export const networkMonitor = new NetworkMonitor();
