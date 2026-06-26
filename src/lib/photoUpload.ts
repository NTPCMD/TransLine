import { supabase } from './supabase';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';

export type StorageErrorDetails = {
  message: string;
  statusCode: string | number;
  name: string;
  code: string;
  details: string;
  hint: string;
  bucket: string;
  path: string;
  raw: unknown;
};

export type UploadResult = {
  path: string;
  error?: string;
  errorDetails?: StorageErrorDetails;
  storageResponse?: {
    data: unknown;
    error: unknown;
  };
};

function randomSuffix(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildStoragePath(driverId: string, shiftId: string, type: string): string {
  if (!driverId?.trim()) {
    throw new Error('driverId is required for storage path');
  }
  if (!shiftId?.trim()) {
    throw new Error('shiftId is required for storage path');
  }
  return `${driverId}/${shiftId}/${type}-${randomSuffix()}.jpg`;
}

function extractStorageErrorDetails(bucket: string, path: string, error: unknown): StorageErrorDetails {
  if (!error || typeof error !== 'object') {
    return {
      message: 'Unknown storage error',
      statusCode: 'n/a',
      name: 'n/a',
      code: 'n/a',
      details: 'n/a',
      hint: 'n/a',
      bucket,
      path,
      raw: error,
    };
  }

  const storageError = error as {
    message?: unknown;
    statusCode?: unknown;
    name?: unknown;
    code?: unknown;
    details?: unknown;
    hint?: unknown;
  };

  return {
    message: typeof storageError.message === 'string' ? storageError.message : 'Unknown storage error',
    statusCode:
      typeof storageError.statusCode === 'string' || typeof storageError.statusCode === 'number'
        ? storageError.statusCode
        : 'n/a',
    name: typeof storageError.name === 'string' ? storageError.name : 'n/a',
    code: typeof storageError.code === 'string' ? storageError.code : 'n/a',
    details: typeof storageError.details === 'string' ? storageError.details : 'n/a',
    hint: typeof storageError.hint === 'string' ? storageError.hint : 'n/a',
    bucket,
    path,
    raw: error,
  };
}

/**
 * Reads a captured photo (a file:// URI or a data: URI) into an ArrayBuffer.
 * React Native cannot reliably upload a Blob to Supabase Storage — Blobs built
 * from local files fail the upload with "Network request failed" on-device — so
 * we upload an ArrayBuffer decoded from base64 instead, which works reliably.
 */
async function readPhotoAsArrayBuffer(photoUri: string): Promise<ArrayBuffer> {
  let base64: string;
  if (photoUri.startsWith('data:')) {
    base64 = photoUri.split(',')[1] ?? '';
  } else {
    base64 = await FileSystem.readAsStringAsync(photoUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
  if (!base64) {
    throw new Error('Photo is empty or could not be read.');
  }
  return decodeBase64(base64);
}

/**
 * Upload a driver log photo to the driver_log_photos bucket.
 * Path: {userId}/{shiftId|unassigned}/{timestamp}.jpg
 */
export async function uploadDriverLogPhoto(
  shiftId: string | null,
  photoUri: string,
  userId: string
): Promise<UploadResult> {
  const shiftSegment = shiftId ?? 'unassigned';
  let storagePath = '';
  try {
    storagePath = buildStoragePath(userId, shiftSegment, 'driver-log');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { path: '', error: message };
  }
  const BUCKET = 'driver_log_photos';

  console.log('[photoUpload] preparing driver log blob', { bucket: BUCKET, path: storagePath });
  let fileBody: ArrayBuffer;
  try {
    fileBody = await readPhotoAsArrayBuffer(photoUri);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { path: '', error: `Failed to process photo URI: ${msg}` };
  }

  console.log('[photoUpload] uploading driver log photo', { bucket: BUCKET, path: storagePath });
  const uploadResult = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBody, { contentType: 'image/jpeg', upsert: false });

  const { data: uploadData, error: uploadError } = uploadResult;
  console.log('[photoUpload] driver log upload response', {
    bucket: BUCKET,
    path: storagePath,
    data: uploadData,
    error: uploadError,
  });

  if (uploadError) {
    const errorDetails = extractStorageErrorDetails(BUCKET, storagePath, uploadError);
    console.error('[photoUpload] driver log upload failed', errorDetails);
    return {
      path: '',
      error: errorDetails.message,
      errorDetails,
      storageResponse: { data: uploadData, error: uploadError },
    };
  }

  console.log('[photoUpload] driver log upload success', { bucket: BUCKET, path: storagePath });
  return { path: storagePath };
}

/**
 * Upload a fuel receipt photo to the fuel_receipts bucket.
 * Path: {userId}/{shiftId}/{timestamp}.jpg
 */
export async function uploadFuelReceipt(
  shiftId: string,
  photoUri: string,
  userId: string
): Promise<UploadResult> {
  let storagePath = '';
  try {
    storagePath = buildStoragePath(userId, shiftId, 'fuel-receipt');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { path: '', error: message };
  }
  const BUCKET = 'fuel_receipts';

  console.log('[photoUpload] preparing fuel receipt blob', { bucket: BUCKET, path: storagePath });
  let fileBody: ArrayBuffer;
  try {
    fileBody = await readPhotoAsArrayBuffer(photoUri);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { path: '', error: `Failed to process photo URI: ${msg}` };
  }

  console.log('[photoUpload] uploading fuel receipt to bucket', BUCKET, 'path', storagePath);
  const uploadResult = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBody, { contentType: 'image/jpeg', upsert: false });

  const { data: uploadData, error: uploadError } = uploadResult;
  console.log('[photoUpload] fuel receipt upload response', {
    bucket: BUCKET,
    path: storagePath,
    data: uploadData,
    error: uploadError,
  });

  if (uploadError) {
    const errorDetails = extractStorageErrorDetails(BUCKET, storagePath, uploadError);
    console.error('[photoUpload] fuel receipt upload failed', errorDetails);
    return {
      path: '',
      error: errorDetails.message,
      errorDetails,
      storageResponse: { data: uploadData, error: uploadError },
    };
  }

  console.log('[photoUpload] fuel receipt upload success', { bucket: BUCKET, path: storagePath });
  return { path: storagePath };
}

/**
 * Upload a shift odometer photo (pre or post) to the odometer_photos bucket.
 * Path: {userId}/{type}-{shiftId}-{timestamp}.jpg
 */
export async function uploadShiftPhoto(
  shiftId: string,
  type: 'pre' | 'post',
  photoUri: string,
  userId: string
): Promise<UploadResult> {
  let storagePath = '';
  try {
    storagePath = buildStoragePath(userId, shiftId, type === 'pre' ? 'odometer-start' : 'odometer-end');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { path: '', error: message };
  }
  const BUCKET = 'odometer_photos';

  console.log('[photoUpload] preparing blob', { bucket: BUCKET, path: storagePath });
  let fileBody: ArrayBuffer;
  try {
    fileBody = await readPhotoAsArrayBuffer(photoUri);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { path: '', error: `Failed to process photo URI: ${msg}` };
  }

  console.log('[photoUpload] uploading to bucket', BUCKET, 'path', storagePath);
  const uploadResult = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileBody, { contentType: 'image/jpeg', upsert: false });

  const { data: uploadData, error: uploadError } = uploadResult;
  console.log('[photoUpload] odometer upload response', {
    bucket: BUCKET,
    path: storagePath,
    data: uploadData,
    error: uploadError,
  });

  if (uploadError) {
    const errorDetails = extractStorageErrorDetails(BUCKET, storagePath, uploadError);
    console.error('[photoUpload] upload failed', errorDetails);
    return {
      path: '',
      error: errorDetails.message,
      errorDetails,
      storageResponse: { data: uploadData, error: uploadError },
    };
  }

  console.log('[photoUpload] upload success', { bucket: BUCKET, path: storagePath });
  return { path: storagePath };
}
