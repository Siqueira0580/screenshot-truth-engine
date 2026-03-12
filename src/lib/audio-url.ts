import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves an audio file reference to a playable URL.
 * Handles both legacy full public URLs and new storage paths.
 * For private buckets, generates a signed URL valid for 1 hour.
 */
export async function resolveAudioUrl(fileRef: string | null): Promise<string | null> {
  if (!fileRef) return null;

  // If it's already a signed URL or a full URL with token, use as-is
  if (fileRef.includes('token=')) return fileRef;

  // If it's a legacy public URL, extract the path
  let path = fileRef;
  const publicPrefix = '/storage/v1/object/public/audio-stems/';
  const idx = fileRef.indexOf(publicPrefix);
  if (idx !== -1) {
    path = fileRef.substring(idx + publicPrefix.length);
  } else if (fileRef.startsWith('http')) {
    // Other full URL format — try to extract path after bucket name
    const match = fileRef.match(/audio-stems\/(.+)$/);
    if (match) {
      path = match[1];
    } else {
      // Can't parse, return as-is (might still work or fail gracefully)
      return fileRef;
    }
  }

  const { data, error } = await supabase.storage
    .from('audio-stems')
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    console.error('Failed to create signed URL for:', path, error);
    return null;
  }

  return data.signedUrl;
}
