import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { networkMonitor } from './networkMonitor';

const QUEUE_STORAGE_KEY = 'transline:offlineQueue';
const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY = 1000; // 1 second

export interface QueuedEvent {
  id: string;
  timestamp: string;
  eventType: string;
  payload: any;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

type QueueChangeCallback = (queue: QueuedEvent[]) => void;

class OfflineQueue {
  private queue: QueuedEvent[] = [];
  private isSyncing: boolean = false;
  private subscribers: Set<QueueChangeCallback> = new Set();
  private unsubscribeNetwork: (() => void) | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;
    
    // Load queue from storage
    await this.loadQueue();
    
    // Subscribe to network changes for auto-sync
    this.unsubscribeNetwork = networkMonitor.subscribe(async (isOnline) => {
      if (isOnline && this.queue.length > 0) {
        console.log('Network connected, auto-syncing queue...');
        await this.syncQueue();
      }
    });

    this.initialized = true;
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
        console.log(`Loaded ${this.queue.length} events from offline queue`);
      }
    } catch (error) {
      console.error('Failed to load offline queue:', error);
      this.queue = [];
    }
  }

  /**
   * Save queue to AsyncStorage
   */
  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifySubscribers();
    } catch (error) {
      console.error('Failed to save offline queue:', error);
    }
  }

  /**
   * Notify all subscribers of queue changes
   */
  private notifySubscribers(): void {
    this.subscribers.forEach((callback) => {
      try {
        callback([...this.queue]);
      } catch (error) {
        console.error('Error in queue change callback:', error);
      }
    });
  }

  /**
   * Subscribe to queue changes
   */
  subscribe(callback: QueueChangeCallback): () => void {
    this.subscribers.add(callback);
    
    // Immediately call with current queue
    try {
      callback([...this.queue]);
    } catch (error) {
      console.error('Error in initial queue callback:', error);
    }

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Add event to queue
   */
  async addEvent(eventType: string, payload: any): Promise<void> {
    const event: QueuedEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      timestamp: new Date().toISOString(),
      eventType,
      payload,
      retryCount: 0,
      status: 'pending',
    };

    this.queue.push(event);
    await this.saveQueue();
    
    console.log(`Added event to offline queue: ${eventType}`, event.id);
  }

  /**
   * Sync all pending events
   */
  async syncQueue(): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress, skipping...');
      return;
    }

    if (this.queue.length === 0) {
      console.log('Queue is empty, nothing to sync');
      return;
    }

    // Check if online
    const isOnline = await networkMonitor.isOnline();
    if (!isOnline) {
      console.log('Device is offline, cannot sync queue');
      return;
    }

    this.isSyncing = true;
    console.log(`Starting sync of ${this.queue.length} queued events...`);

    const remainingQueue: QueuedEvent[] = [];

    for (const event of this.queue) {
      // Skip already failed events (max retries reached)
      if (event.status === 'failed') {
        remainingQueue.push(event);
        continue;
      }

      // Update status to syncing (in memory only, will save at end)
      event.status = 'syncing';
      // Notify UI of status change
      this.notifySubscribers();

      try {
        const shiftEventPayload = {
          shift_id: event.payload.shift_id || null,
          event_type: event.eventType,
          latitude: event.payload.lat || event.payload.latitude || null,
          longitude: event.payload.lng || event.payload.longitude || null,
          metadata: event.payload.metadata || {},
        };

        const { error } = await supabase.from('shift_events').insert(shiftEventPayload);

        if (error) {
          throw error;
        }

        // Success - remove from queue
        console.log(`Successfully synced event: ${event.eventType}`, event.id);
      } catch (error: any) {
        console.error(`Failed to sync event: ${event.eventType}`, error.message);
        
        // Increment retry count
        event.retryCount += 1;
        
        // Mark as failed if max retries reached
        if (event.retryCount >= MAX_RETRY_ATTEMPTS) {
          event.status = 'failed';
          console.log(`Event failed after ${MAX_RETRY_ATTEMPTS} retries: ${event.eventType}`, event.id);
        } else {
          event.status = 'pending';
        }
        
        // Keep in queue
        remainingQueue.push(event);
      }
    }

    this.queue = remainingQueue;
    // Save once at the end instead of after each event
    await this.saveQueue();
    
    this.isSyncing = false;
    console.log(`Sync completed. ${remainingQueue.length} events remaining in queue`);
  }

  /**
   * Get current queue
   */
  getQueue(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Remove event from queue
   */
  async removeEvent(id: string): Promise<void> {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(event => event.id !== id);
    
    if (this.queue.length !== initialLength) {
      await this.saveQueue();
      console.log(`Removed event from queue: ${id}`);
    }
  }

  /**
   * Clear entire queue
   */
  async clearQueue(): Promise<void> {
    this.queue = [];
    await this.saveQueue();
    console.log('Cleared all events from queue');
  }

  /**
   * Get count of queued events
   */
  getQueuedCount(): number {
    return this.queue.length;
  }

  /**
   * Get count of pending events (excluding failed)
   */
  getPendingCount(): number {
    return this.queue.filter(event => event.status !== 'failed').length;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    this.subscribers.clear();
  }
}

// Export singleton instance
export const offlineQueue = new OfflineQueue();
