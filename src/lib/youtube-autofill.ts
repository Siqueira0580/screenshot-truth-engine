import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Extracts YouTube video ID from common URL formats.
 */
function extractYouTubeId(url: string): string | null {
  const regex = /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
  const match = url.match(regex);
  return match?.[1] ?? null;
}

/**
 * Searches for a YouTube video using the existing edge function.
 * Returns the first result's URL, or null if nothing found.
 */
async function searchYouTubeVideo(
  title: string,
  artist: string | null
): Promise<string | null> {
  const query = artist
    ? `${title} ${artist} official audio`
    : `${title} official audio`;

  try {
    const { data, error } = await supabase.functions.invoke("youtube-search", {
      body: { query },
    });

    if (error || !data?.results?.length) return null;

    const videoId = data.results[0]?.videoId;
    return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
  } catch {
    return null;
  }
}

/**
 * Scans all songs in a setlist and auto-fills missing YouTube links.
 * Runs in background — does NOT block navigation.
 */
export async function autoFillMissingYouTubeLinks(
  setlistId: string,
  onComplete?: () => void
) {
  try {
    // Step A: fetch setlist items with song data
    const { data: items, error } = await supabase
      .from("setlist_items")
      .select("song_id, songs(id, title, artist, youtube_url)")
      .eq("setlist_id", setlistId);

    if (error || !items?.length) return;

    // Step B: filter songs without youtube_url
    const songsToUpdate = items
      .map((item: any) => item.songs)
      .filter(
        (song: any) =>
          song && !song.youtube_url && song.title
      );

    // Deduplicate by song id
    const uniqueSongs = Array.from(
      new Map(songsToUpdate.map((s: any) => [s.id, s])).values()
    ) as { id: string; title: string; artist: string | null }[];

    if (uniqueSongs.length === 0) return;

    // Step C: inform user
    toast.info(
      `Buscando vídeos do YouTube para ${uniqueSongs.length} música${uniqueSongs.length > 1 ? "s" : ""}...`,
      { duration: 4000 }
    );

    let filled = 0;

    // Step D: search and update each song sequentially to avoid rate limits
    for (const song of uniqueSongs) {
      const url = await searchYouTubeVideo(song.title, song.artist);
      if (url) {
        const { error: updateError } = await supabase
          .from("songs")
          .update({ youtube_url: url })
          .eq("id", song.id);

        if (!updateError) filled++;
      }
    }

    if (filled > 0) {
      toast.success(
        `${filled} link${filled > 1 ? "s" : ""} do YouTube preenchido${filled > 1 ? "s" : ""} automaticamente!`
      );
      onComplete?.();
    }
  } catch (err) {
    console.error("autoFillMissingYouTubeLinks error:", err);
  }
}
