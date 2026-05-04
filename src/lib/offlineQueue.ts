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
  lastError?: string | null;
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

  private formatSupabaseError(error: any): string {
    if (!error) return 'Unknown Supabase error';
    const message = typeof error.message === 'string' ? error.message : 'Unknown error';
    const code = typeof error.code === 'string' ? error.code : 'n/a';
    const details = typeof error.details === 'string' ? error.details : 'n/a';
    const hint = typeof error.hint === 'string' ? error.hint : 'n/a';
    return `${message} (code=${code}, details=${details}, hint=${hint})`;
  }

  private toShiftEventPayload(event: QueuedEvent): {
    shift_id: string;
    event_type: string;
    latitude: number | null;
    longitude: number | null;
    metadata: Record<string, unknown>;
  } | null {
    const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
    const shiftIdRaw = (payload as any).shift_id;
    const eventType = typeof event.eventType === 'string' ? event.eventType.trim() : '';

    if (!eventType) {
      return null;
    }
    if (typeof shiftIdRaw !== 'string' || !shiftIdRaw.trim()) {
      return null;
    }

    const latRaw = (payload as any).latitude ?? (payload as any).lat ?? null;
    const lngRaw = (payload as any).longitude ?? (payload as any).lng ?? null;

    const latitude = typeof latRaw === 'number' && Number.isFinite(latRaw) ? latRaw : null;
    const longitude = typeof lngRaw === 'number' && Number.isFinite(lngRaw) ? lngRaw : null;

    const metadataRaw = (payload as any).metadata;
    const metadata = metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)
      ? metadataRaw as Record<string, unknown>
      : {};

    let normalizedMetadata: Record<string, unknown> = metadata;
    if (eventType === 'fuel_log') {
      const receiptPhotoPath =
        typeof metadata.receipt_photo_path === 'string' ? metadata.receipt_photo_path.trim() : '';

      if (!receiptPhotoPath || receiptPhotoPath.startsWith('data:')) {
        return null;
      }

      const { receipt_urls: _ignoredReceiptUrls, ...rest } = metadata;
      normalizedMetadata = {
        ...rest,
        receipt_photo_path: receiptPhotoPath,
      };
    }

    // Only valid shift_events columns are returned from this function.
    return {
      shift_id: shiftIdRaw.trim(),
      event_type: eventType,
      latitude,
      longitude,
      metadata: normalizedMetadata,
    };
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
   * Clean legacy queued payloads before sync.
   * - Removes deprecated payload.timestamp from shift_event payloads.
   * - Drops malformed queue entries that cannot be safely synced.
   */
  private sanitizeQueueForSync(): {
    cleanedCount: number;
    droppedCount: number;
    repairedCount: number;
  } {
    let cleanedCount = 0;
    let droppedCount = 0;
    let repairedCount = 0;

    const nextQueue: QueuedEvent[] = [];

    for (const event of this.queue) {
      // Drop malformed legacy queue items safely.
      if (!event || typeof event !== 'object' || !event.id || !event.eventType) {
        console.warn('[offlineQueue] Dropping malformed queue item (missing id/eventType)', {
          event,
        });
        droppedCount += 1;
        continue;
      }

      const payload = event.payload && typeof event.payload === 'object' ? event.payload : {};
      const {
        timestamp: _legacyTimestamp,
        event_type: _legacyEventType,
        shift_id: shiftId,
        lat,
        lng,
        latitude,
        longitude,
        metadata,
      } = payload as Record<string, unknown>;

      const normalizedPayload = {
        shift_id: shiftId,
        latitude: typeof latitude === 'number' ? latitude : (typeof lat === 'number' ? lat : null),
        longitude: typeof longitude === 'number' ? longitude : (typeof lng === 'number' ? lng : null),
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {},
      };

      let normalizedEvent: QueuedEvent = {
        ...event,
        payload: normalizedPayload,
      };

      if (event.status === 'failed') {
        normalizedEvent = {
          ...normalizedEvent,
          status: 'pending',
          retryCount: 0,
        };
        repairedCount += 1;
      }

      const shiftEventPayload = this.toShiftEventPayload(normalizedEvent);
      if (!shiftEventPayload) {
        console.warn('[offlineQueue] Dropping impossible malformed queue item (cannot map to shift_events columns)', {
          eventType: event.eventType,
          queueId: event.id,
          payload: normalizedEvent.payload,
        });
        droppedCount += 1;
        continue;
      }

      if (event.payload !== normalizedEvent.payload || event.status === 'failed') {
        cleanedCount += 1;
      }

      nextQueue.push(normalizedEvent);
    }

    if (cleanedCount > 0 || droppedCount > 0) {
      this.queue = nextQueue;
    }

    return { cleanedCount, droppedCount, repairedCount };
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
      lastError: null,
    };

    this.queue.push(event);
    await this.saveQueue();
    
    console.log('[offlineQueue] Added event to offline queue', {
      queueId: event.id,
      eventType,
      shiftId: payload?.shift_id ?? null,
      payload,
    });
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

    const { cleanedCount, droppedCount, repairedCount } = this.sanitizeQueueForSync();
    if (cleanedCount > 0 || droppedCount > 0 || repairedCount > 0) {
      console.log(
        `[offlineQueue] Repair queue before sync: cleaned=${cleanedCount}, repaired_failed=${repairedCount}, dropped_malformed=${droppedCount}`
      );
      await this.saveQueue();
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
      // Update status to syncing (in memory only, will save at end)
      event.status = 'syncing';
      event.lastError = null;
      // Notify UI of status change
      this.notifySubscribers();

      try {
        const shiftEventPayload = this.toShiftEventPayload(event);
        if (!shiftEventPayload) {
          console.warn('[offlineQueue] Dropping impossible malformed queued event before insert', {
            queueId: event.id,
            eventType: event.eventType,
            payload: event.payload,
          });
          continue;
        }

        console.log('[offlineQueue] Syncing queued shift_event', {
          queueId: event.id,
          eventType: event.eventType,
          shiftId: shiftEventPayload.shift_id,
          payload: shiftEventPayload,
        });

        const { error } = await supabase.from('shift_events').insert(shiftEventPayload);

        if (error) {
          const formattedError = this.formatSupabaseError(error);
          event.lastError = formattedError;
          console.error('[offlineQueue] Failed to sync queued shift_event', {
            queueId: event.id,
            eventType: event.eventType,
            shiftId: shiftEventPayload.shift_id,
            payload: shiftEventPayload,
            supabaseError: formattedError,
          });
          throw error;
        }

        // Success - remove from queue
        console.log('[offlineQueue] Successfully synced queued shift_event', {
          queueId: event.id,
          eventType: event.eventType,
          shiftId: shiftEventPayload.shift_id,
          payload: shiftEventPayload,
        });
      } catch (error: any) {
        const formattedError = this.formatSupabaseError(error);
        console.error('[offlineQueue] Failed to sync event', {
          queueId: event.id,
          eventType: event.eventType,
          shiftId: event?.payload?.shift_id ?? null,
          payload: event?.payload ?? null,
          supabaseError: formattedError,
        });
        
        // Increment retry count
        event.retryCount += 1;
        
        // Mark as failed if max retries reached
        if (event.retryCount >= MAX_RETRY_ATTEMPTS) {
          event.status = 'failed';
          console.warn('[offlineQueue] Event failed after max retries', {
            queueId: event.id,
            eventType: event.eventType,
            shiftId: event?.payload?.shift_id ?? null,
            retries: event.retryCount,
            maxRetries: MAX_RETRY_ATTEMPTS,
            lastError: event.lastError ?? formattedError,
          });
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
