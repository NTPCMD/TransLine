import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

type NetworkCallback = (isOnline: boolean) => void;

class NetworkMonitor {
  private subscribers: Set<NetworkCallback> = new Set();
  private currentState: NetInfoState | null = null;
  private unsubscribeNetInfo: (() => void) | null = null;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Subscribe to network state changes
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      this.currentState = state;
      const isOnline = state.isConnected ?? false;
      
      // Notify all subscribers
      this.subscribers.forEach((callback) => {
        try {
          callback(isOnline);
        } catch (error) {
          console.error('Error in network state callback:', error);
        }
      });
    });
  }

  /**
   * Check if currently online
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected ?? false;
  }

  /**
   * Subscribe to network changes
   * Returns an unsubscribe function
   */
  subscribe(callback: NetworkCallback): () => void {
    this.subscribers.add(callback);
    
    // Immediately call with current state if available
    if (this.currentState !== null) {
      const isOnline = this.currentState.isConnected ?? false;
      try {
        callback(isOnline);
      } catch (error) {
        console.error('Error in initial network state callback:', error);
      }
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Get current network type (wifi/cellular/none)
   */
  async getNetworkType(): Promise<string> {
    const state = await NetInfo.fetch();
    return state.type || 'unknown';
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
