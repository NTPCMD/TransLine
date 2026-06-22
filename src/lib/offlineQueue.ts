import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from './supabase';
import { networkMonitor } from './networkMonitor';
import { uploadFuelReceipt, uploadShiftPhoto } from './photoUpload';

const QUEUE_STORAGE_KEY = 'transline:offlineQueue';
const RETRY_INTERVAL_MS = 30_000;

const CRITICAL_EVENT_TYPES = new Set([
  'fuel_log',
  'driver_log',
  'break_start',
  'break_end',
  'odometer_start',
  'odometer_end',
  'shift_start',
  'shift_end',
  'location',
]);

export type QueuedShiftEventPayload = {
  shift_id: string;
  event_type: string;
  latitude: number | null;
  longitude: number | null;
  metadata: Record<string, unknown>;
};

export interface QueuedEvent {
  id: string;
  created_at: string;
  table: 'shift_events';
  payload: QueuedShiftEventPayload;
  retry_count: number;
  last_error: string | null;
}

type QueueChangeCallback = (queue: QueuedEvent[]) => void;

class OfflineQueue {
  private queue: QueuedEvent[] = [];
  private isSyncing = false;
  private subscribers: Set<QueueChangeCallback> = new Set();
  private unsubscribeNetwork: (() => void) | null = null;
  private appStateSubscription: { remove: () => void } | null = null;
  private retryInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private lastSyncError: string | null = null;

  constructor() {
    this.initPromise = this.initialize();
  }

  private async ensureInitialized() {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  private formatSupabaseError(error: any): string {
    if (!error) return 'Unknown Supabase error';
    const message = typeof error.message === 'string' ? error.message : 'Unknown error';
    const code = typeof error.code === 'string' ? error.code : 'n/a';
    const details = typeof error.details === 'string' ? error.details : 'n/a';
    const hint = typeof error.hint === 'string' ? error.hint : 'n/a';
    return `${message} (code=${code}, details=${details}, hint=${hint})`;
  }

  private generateId() {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }

  private normalizePayload(eventType: string, payload: any): QueuedShiftEventPayload {
    const raw = payload && typeof payload === 'object' ? payload : {};

    const shiftId =
      typeof raw.shift_id === 'string'
        ? raw.shift_id
        : typeof raw.shiftId === 'string'
          ? raw.shiftId
          : '';

    const latitudeRaw = raw.latitude ?? raw.lat ?? null;
    const longitudeRaw = raw.longitude ?? raw.lng ?? null;

    const metadataRaw = raw.metadata;
    const metadata = metadataRaw && typeof metadataRaw === 'object' && !Array.isArray(metadataRaw)
      ? { ...(metadataRaw as Record<string, unknown>) }
      : {};

    if (eventType === 'fuel_log') {
      const receiptPhotoPath =
        typeof metadata.receipt_photo_path === 'string' ? metadata.receipt_photo_path.trim() : '';
      if (receiptPhotoPath) {
        metadata.receipt_photo_path = receiptPhotoPath;
      }
      if ('receipt_urls' in metadata) {
        delete metadata.receipt_urls;
      }
    }

    return {
      shift_id: shiftId,
      event_type: eventType,
      latitude: typeof latitudeRaw === 'number' && Number.isFinite(latitudeRaw) ? latitudeRaw : null,
      longitude: typeof longitudeRaw === 'number' && Number.isFinite(longitudeRaw) ? longitudeRaw : null,
      metadata,
    };
  }

  private isPayloadMalformed(item: QueuedEvent): string | null {
    if (!item.payload.event_type.trim()) {
      return 'Missing event_type';
    }
    if (!item.payload.shift_id.trim()) {
      return 'Missing shift_id';
    }
    if (!item.payload.metadata || typeof item.payload.metadata !== 'object' || Array.isArray(item.payload.metadata)) {
      return 'Invalid metadata payload';
    }
    return null;
  }

  private migrateItem(raw: any): QueuedEvent {
    if (!raw || typeof raw !== 'object') {
      return {
        id: this.generateId(),
        created_at: new Date().toISOString(),
        table: 'shift_events',
        payload: {
          shift_id: '',
          event_type: 'unknown',
          latitude: null,
          longitude: null,
          metadata: {},
        },
        retry_count: 0,
        last_error: 'Malformed legacy queue item',
      };
    }

    const eventType =
      typeof raw.payload?.event_type === 'string'
        ? raw.payload.event_type
        : typeof raw.eventType === 'string'
          ? raw.eventType
          : '';

    const payload = this.normalizePayload(eventType, raw.payload ?? raw);

    return {
      id: typeof raw.id === 'string' ? raw.id : this.generateId(),
      created_at: typeof raw.created_at === 'string'
        ? raw.created_at
        : typeof raw.timestamp === 'string'
          ? raw.timestamp
          : new Date().toISOString(),
      table: 'shift_events',
      payload,
      retry_count: typeof raw.retry_count === 'number'
        ? raw.retry_count
        : typeof raw.retryCount === 'number'
          ? raw.retryCount
          : 0,
      last_error: typeof raw.last_error === 'string'
        ? raw.last_error
        : typeof raw.lastError === 'string'
          ? raw.lastError
          : null,
    };
  }

  private async initialize() {
    if (this.initialized) return;

    await this.loadQueue();

    this.unsubscribeNetwork = networkMonitor.subscribe((isOnline) => {
      if (!isOnline) return;
      void this.syncQueue();
    });

    this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        void this.syncQueue();
      }
    });

    this.retryInterval = setInterval(() => {
      void this.syncQueue();
    }, RETRY_INTERVAL_MS);

    this.initialized = true;
    void this.syncQueue();
  }

  private async loadQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (!stored) {
        this.queue = [];
        return;
      }

      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) {
        this.queue = [];
        return;
      }

      this.queue = parsed.map((item) => this.migrateItem(item));

      await this.saveQueue();
    } catch (error) {
      console.error('[offlineQueue] Failed to load queue', error);
      this.queue = [];
    }
  }

  private async saveQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notifySubscribers();
    } catch (error) {
      console.error('[offlineQueue] Failed to save queue', error);
    }
  }

  private notifySubscribers(): void {
    const snapshot = [...this.queue];
    this.subscribers.forEach((callback) => {
      try {
        callback(snapshot);
      } catch (error) {
        console.error('[offlineQueue] Error in queue callback', error);
      }
    });
  }

  subscribe(callback: QueueChangeCallback): () => void {
    this.subscribers.add(callback);
    try {
      callback([...this.queue]);
    } catch (error) {
      console.error('[offlineQueue] Error in initial queue callback', error);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  }

  async addEvent(eventType: string, payload: any): Promise<void> {
    await this.ensureInitialized();

    const normalized = this.normalizePayload(eventType, payload);

    const item: QueuedEvent = {
      id: this.generateId(),
      created_at: new Date().toISOString(),
      table: 'shift_events',
      payload: normalized,
      retry_count: 0,
      last_error: null,
    };

    const malformedReason = this.isPayloadMalformed(item);
    if (malformedReason) {
      item.last_error = malformedReason;
    }

    this.queue.push(item);
    await this.saveQueue();

    console.log('[offlineQueue] enqueue', {
      id: item.id,
      event_type: item.payload.event_type,
      shift_id: item.payload.shift_id,
      critical: CRITICAL_EVENT_TYPES.has(item.payload.event_type),
      malformed: malformedReason ?? null,
    });
    console.log('[offlineQueue] remaining count', { count: this.queue.length });
  }

  async syncQueue(): Promise<void> {
    await this.ensureInitialized();

    if (this.isSyncing) return;
    if (this.queue.length === 0) {
      this.lastSyncError = null;
      return;
    }

    const isOnline = await networkMonitor.isOnline();
    if (!isOnline) return;

    this.isSyncing = true;
    console.log('[offlineQueue] retry start', { count: this.queue.length });

    const remaining: QueuedEvent[] = [];

    for (const item of this.queue) {
      const malformedReason = this.isPayloadMalformed(item);
      if (malformedReason) {
        item.retry_count += 1;
        item.last_error = malformedReason;
        this.lastSyncError = malformedReason;
        console.log('[offlineQueue] retry failed', {
          id: item.id,
          event_type: item.payload.event_type,
          retry_count: item.retry_count,
          error: malformedReason,
        });
        remaining.push(item);
        continue;
      }

      try {
        const insertPayload = await this.buildInsertPayload(item);
        // Preserve when the event actually occurred (enqueue time) instead of
        // letting the DB stamp it at sync time — break durations and tracking
        // history are computed from created_at, so a late sync must not shift it.
        const { error } = await supabase
          .from('shift_events')
          .insert({ ...insertPayload, created_at: item.created_at });
        if (error) {
          throw error;
        }

        console.log('[offlineQueue] retry success', {
          id: item.id,
          event_type: item.payload.event_type,
        });
      } catch (err: any) {
        const formatted = this.formatSupabaseError(err);
        item.retry_count += 1;
        item.last_error = formatted;
        this.lastSyncError = formatted;

        console.log('[offlineQueue] retry failed', {
          id: item.id,
          event_type: item.payload.event_type,
          retry_count: item.retry_count,
          error: formatted,
        });
        remaining.push(item);
      }
    }

    this.queue = remaining;
    if (remaining.length === 0) {
      this.lastSyncError = null;
    }
    await this.saveQueue();

    console.log('[offlineQueue] remaining count', { count: this.queue.length });
    this.isSyncing = false;
  }

  /**
   * Produce the row to insert for a queued event. For fuel logs captured while
   * offline we only stored the local receipt URI (the upload needs the network);
   * upload it now and swap in the resulting storage path before inserting.
   */
  private async buildInsertPayload(item: QueuedEvent): Promise<QueuedShiftEventPayload> {
    const eventType = item.payload.event_type;
    const metadata = { ...item.payload.metadata } as Record<string, unknown>;

    if (eventType === 'fuel_log') {
      const localUri = typeof metadata.local_receipt_uri === 'string' ? metadata.local_receipt_uri : '';
      const existingPath =
        typeof metadata.receipt_photo_path === 'string' ? metadata.receipt_photo_path.trim() : '';
      if (!localUri || existingPath) return item.payload;

      const userId = await this.requireUserId('fuel receipt');
      const { path, error } = await uploadFuelReceipt(item.payload.shift_id, localUri, userId);
      if (error || !path) {
        throw new Error(error ?? 'Queued fuel receipt upload failed.');
      }
      delete metadata.local_receipt_uri;
      metadata.receipt_photo_path = path;
      return { ...item.payload, metadata };
    }

    if (eventType === 'odometer_start' || eventType === 'odometer_end') {
      const localUri = typeof metadata.local_photo_uri === 'string' ? metadata.local_photo_uri : '';
      const existingPath = typeof metadata.photo_path === 'string' ? metadata.photo_path.trim() : '';
      if (!localUri || existingPath) return item.payload;

      const userId = await this.requireUserId('odometer photo');
      const type = eventType === 'odometer_start' ? 'pre' : 'post';
      const { path, error } = await uploadShiftPhoto(item.payload.shift_id, type, localUri, userId);
      if (error || !path) {
        throw new Error(error ?? 'Queued odometer photo upload failed.');
      }
      delete metadata.local_photo_uri;
      metadata.photo_path = path;
      return { ...item.payload, metadata };
    }

    return item.payload;
  }

  private async requireUserId(label: string): Promise<string> {
    const { data } = await supabase.auth.getUser();
    const userId = data?.user?.id ?? null;
    if (!userId) {
      throw new Error(`Cannot upload queued ${label}: no authenticated user.`);
    }
    return userId;
  }

  async retryNow(): Promise<void> {
    console.log('[offlineQueue] manual retry pressed');
    await this.syncQueue();
  }

  getQueue(): QueuedEvent[] {
    return [...this.queue];
  }

  /**
   * Returns queued (not-yet-synced) shift events for a shift, optionally filtered
   * by event type. Used by screens (e.g. break control) to overlay pending
   * actions on top of server data so the UI stays correct while offline.
   */
  getQueuedShiftEvents(
    shiftId: string,
    eventTypes?: string[]
  ): Array<{ event_type: string; created_at: string }> {
    const typeFilter = eventTypes ? new Set(eventTypes) : null;
    return this.queue
      .filter((item) => item.payload.shift_id === shiftId)
      .filter((item) => !typeFilter || typeFilter.has(item.payload.event_type))
      .map((item) => ({ event_type: item.payload.event_type, created_at: item.created_at }));
  }

  getQueuedCount(): number {
    return this.queue.length;
  }

  getLastSyncError(): string | null {
    return this.lastSyncError;
  }

  async clearQueue(): Promise<void> {
    this.queue = [];
    this.lastSyncError = null;
    await this.saveQueue();
  }

  destroy() {
    if (this.unsubscribeNetwork) {
      this.unsubscribeNetwork();
      this.unsubscribeNetwork = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }
    this.subscribers.clear();
  }
}

export const offlineQueue = new OfflineQueue();
