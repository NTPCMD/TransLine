import { supabase } from './supabase';

/**
 * Upload a driver log photo to the driver_log_photos bucket.
 * Path: {userId}/{shiftId|unassigned}/{timestamp}.jpg
 */
export async function uploadDriverLogPhoto(
  shiftId: string | null,
  photoUri: string,
  userId: string
): Promise<{ path: string; error?: string }> {
  const filename = `${Date.now()}.jpg`;
  const shiftSegment = shiftId ?? 'unassigned';
  const storagePath = `${userId}/${shiftSegment}/${filename}`;
  const BUCKET = 'driver_log_photos';

  console.log('[photoUpload] preparing driver log blob', { storagePath, BUCKET });
  let blob: Blob;
  try {
    if (photoUri.startsWith('data:')) {
      const parts = photoUri.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      blob = new Blob([u8arr], { type: mimeType });
    } else {
      const resp = await fetch(photoUri);
      if (!resp.ok) {
        throw new Error(`Failed to fetch photo: ${resp.status} ${resp.statusText}`);
      }
      blob = await resp.blob();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { path: '', error: `Failed to process photo URI: ${msg}` };
  }

  console.log('[photoUpload] uploading driver log photo', { bucket: BUCKET, path: storagePath });
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    console.error('[photoUpload] driver log upload failed', { bucket: BUCKET, path: storagePath, error: uploadError.message });
    return { path: '', error: uploadError.message };
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
): Promise<{ path: string; error?: string }> {
  const filename = `${Date.now()}.jpg`;
  const storagePath = `${userId}/${shiftId}/${filename}`;
  const BUCKET = 'fuel_receipts';

  console.log('[photoUpload] preparing fuel receipt blob', { storagePath, BUCKET });
  let blob: Blob;
  try {
    if (photoUri.startsWith('data:')) {
      const parts = photoUri.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      blob = new Blob([u8arr], { type: mimeType });
    } else {
      const resp = await fetch(photoUri);
      if (!resp.ok) {
        throw new Error(`Failed to fetch photo: ${resp.status} ${resp.statusText}`);
      }
      blob = await resp.blob();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { path: '', error: `Failed to process photo URI: ${msg}` };
  }

  console.log('[photoUpload] uploading fuel receipt to bucket', BUCKET, 'path', storagePath);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    console.error('[photoUpload] fuel receipt upload failed', { bucket: BUCKET, path: storagePath, error: uploadError.message });
    return { path: '', error: uploadError.message };
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
): Promise<{ path: string; error?: string }> {
  const filename = `${type}-${shiftId}-${Date.now()}.jpg`;
  const storagePath = `${userId}/${filename}`;
  const BUCKET = 'odometer_photos';

  console.log('[photoUpload] preparing blob', { storagePath, BUCKET });
  let blob: Blob;
  try {
    if (photoUri.startsWith('data:')) {
      const parts = photoUri.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
      const bstr = atob(parts[1]);
      const n = bstr.length;
      const u8arr = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        u8arr[i] = bstr.charCodeAt(i);
      }
      blob = new Blob([u8arr], { type: mimeType });
    } else {
      const resp = await fetch(photoUri);
      if (!resp.ok) {
        throw new Error(`Failed to fetch photo: ${resp.status} ${resp.statusText}`);
      }
      blob = await resp.blob();
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { path: '', error: `Failed to process photo URI: ${msg}` };
  }

  console.log('[photoUpload] uploading to bucket', BUCKET, 'path', storagePath);
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    console.error('[photoUpload] upload failed', { bucket: BUCKET, path: storagePath, error: uploadError.message });
    return { path: '', error: uploadError.message };
  }

  console.log('[photoUpload] upload success', { bucket: BUCKET, path: storagePath });
  return { path: storagePath };
}
