import { supabase } from './supabase';

/**
 * Upload a shift odometer photo (pre or post) to the odometer-photos bucket.
 * Path: odometer-photos/shifts/{shiftId}/{type}-{timestamp}.jpg
 */
export async function uploadShiftPhoto(
  shiftId: string,
  type: 'pre' | 'post',
  photoUri: string
): Promise<{ path: string; error?: string }> {
  const storagePath = `shifts/${shiftId}/${type}-${Date.now()}.jpg`;

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

  const { error: uploadError } = await supabase.storage
    .from('odometer-photos')
    .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) {
    console.error('[photoUpload] uploadShiftPhoto error:', uploadError.message);
    return { path: '', error: uploadError.message };
  }

  return { path: storagePath };
}
