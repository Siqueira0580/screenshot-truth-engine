import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type SongInsert = Database["public"]["Tables"]["songs"]["Insert"];
type Setlist = Database["public"]["Tables"]["setlists"]["Row"];
type SetlistInsert = Database["public"]["Tables"]["setlists"]["Insert"];
type SetlistItem = Database["public"]["Tables"]["setlist_items"]["Row"];
type Artist = Database["public"]["Tables"]["artists"]["Row"];

// Helper to get current user id
async function getCurrentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  return user.id;
}

// ─── USER LIBRARY (junction table) ───

/** Fetch only songs in the current user's personal library */
export async function fetchUserLibrary() {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("user_library")
    .select("song_id, added_at, songs(*)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({ ...row.songs, added_at: row.added_at })) as (Song & { added_at: string })[];
}

/** Add a song to the user's personal library */
export async function addToUserLibrary(songId: string) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("user_library")
    .upsert({ user_id: userId, song_id: songId }, { onConflict: "user_id,song_id" });
  if (error) throw error;
}

/** Remove a song from the user's personal library (does NOT delete the global song) */
export async function removeFromUserLibrary(songId: string) {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("user_library")
    .delete()
    .eq("user_id", userId)
    .eq("song_id", songId);
  if (error) throw error;
}

/** Bulk-add all global songs to user library */
export async function addAllSongsToLibrary() {
  const userId = await getCurrentUserId();
  const { data: allSongs } = await supabase.from("songs").select("id");
  if (!allSongs || allSongs.length === 0) return;
  const inserts = allSongs.map((s) => ({ user_id: userId, song_id: s.id }));
  // batch in chunks of 500
  for (let i = 0; i < inserts.length; i += 500) {
    const chunk = inserts.slice(i, i + 500);
    await supabase.from("user_library").upsert(chunk, { onConflict: "user_id,song_id" });
  }
}

/** Add songs matching certain artists/styles to user library */
export async function addFilteredSongsToLibrary(artists: string[], styles: string[]) {
  const userId = await getCurrentUserId();
  let songIds: string[] = [];

  if (artists.length > 0) {
    const { data } = await supabase
      .from("songs")
      .select("id")
      .in("artist", artists);
    if (data) songIds.push(...data.map((s) => s.id));
  }

  if (styles.length > 0) {
    const { data } = await supabase
      .from("songs")
      .select("id")
      .in("style", styles);
    if (data) songIds.push(...data.map((s) => s.id));
  }

  const unique = [...new Set(songIds)];
  if (unique.length === 0) return;

  const inserts = unique.map((sid) => ({ user_id: userId, song_id: sid }));
  for (let i = 0; i < inserts.length; i += 500) {
    const chunk = inserts.slice(i, i + 500);
    await supabase.from("user_library").upsert(chunk, { onConflict: "user_id,song_id" });
  }
}

/** Clear entire user library */
export async function clearUserLibrary() {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("user_library")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}

// ─── DUPLICATE CHECK ───

/** Check if a song with the same title+artist already exists for the current user.
 *  Returns the existing song id if found, null otherwise.
 *  For edits, pass excludeId to avoid matching the song being edited. */
export async function checkDuplicateSong(
  title: string,
  artist: string | null,
  excludeId?: string
): Promise<string | null> {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;

  const userId = await getCurrentUserId();

  // Build query: match title (case-insensitive) + created_by current user
  let query = supabase
    .from("songs")
    .select("id")
    .ilike("title", trimmedTitle)
    .eq("created_by", userId);

  // Match artist case-insensitive, or both null
  if (artist && artist.trim()) {
    query = query.ilike("artist", artist.trim());
  } else {
    query = query.is("artist", null);
  }

  // Exclude current song when editing
  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data } = await query.limit(1);
  return data && data.length > 0 ? data[0].id : null;
}

// ─── GLOBAL SONGS ───

export async function fetchSongs() {
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .order("title");
  if (error) throw error;
  return data as Song[];
}

export async function fetchSong(id: string) {
  const { data, error } = await supabase
    .from("songs")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Song;
}

export async function createSong(song: SongInsert) {
  const { data: { user } } = await supabase.auth.getUser();
  const sanitized = {
    ...song,
    title: song.title?.trim() || "",
    artist: song.artist?.trim().replace(/\s+/g, " ") || null,
    ...(user ? { created_by: user.id } : {}),
  };
  const { data, error } = await supabase.from("songs").insert(sanitized as any).select().single();
  if (error) throw error;
  return data as Song;
}

/** Create a song globally AND add it to the user's library */
export async function createSongAndAddToLibrary(song: SongInsert) {
  const created = await createSong(song);
  try {
    await addToUserLibrary(created.id);
  } catch (e) {
    console.warn("Could not add to user library:", e);
  }
  return created;
}

export async function updateSong(id: string, song: Partial<SongInsert>) {
  const { data, error } = await supabase.from("songs").update(song).eq("id", id).select().single();
  if (error) throw error;
  return data as Song;
}

export async function deleteSong(id: string) {
  const { error } = await supabase.from("songs").delete().eq("id", id);
  if (error) throw error;
}

// ─── SETLISTS ───

export async function fetchSetlists() {
  const { data, error } = await supabase
    .from("setlists")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Setlist[];
}

export async function fetchSetlist(id: string) {
  const { data, error } = await supabase
    .from("setlists")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Setlist;
}

export async function fetchSetlistItems(setlistId: string) {
  const { data, error } = await supabase
    .from("setlist_items")
    .select("*, songs(*)")
    .eq("setlist_id", setlistId)
    .order("position");
  if (error) throw error;
  return data;
}

export async function createSetlist(setlist: SetlistInsert) {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("setlists")
    .insert({ ...setlist, user_id: userId } as any)
    .select()
    .single();
  if (error) throw error;
  return data as Setlist;
}

export async function deleteSetlist(id: string) {
  const { error } = await supabase.from("setlists").delete().eq("id", id);
  if (error) throw error;
}

export async function updateSetlist(id: string, data: Record<string, any>) {
  const { data: updated, error } = await supabase
    .from("setlists")
    .update(data)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return updated;
}

export async function addSongToSetlist(setlistId: string, songId: string, position: number, speed?: number | null) {
  const { error } = await supabase.from("setlist_items").insert({
    setlist_id: setlistId,
    song_id: songId,
    position,
    ...(speed != null ? { speed } : {}),
  });
  if (error) throw error;
}

export async function removeSongFromSetlist(itemId: string) {
  const { error } = await supabase.from("setlist_items").delete().eq("id", itemId);
  if (error) throw error;
}

export async function updateSetlistItemPositions(items: { id: string; position: number }[]) {
  for (const item of items) {
    await supabase.from("setlist_items").update({ position: item.position }).eq("id", item.id);
  }
}

export async function bulkUpdateSetlistItems(
  items: { id: string; loop_count: number | null; speed: number | null; bpm: number | null }[]
) {
  for (const item of items) {
    await supabase
      .from("setlist_items")
      .update({ loop_count: item.loop_count, speed: item.speed, bpm: item.bpm })
      .eq("id", item.id);
  }
}

// ─── ARTISTS ───

export async function fetchArtists() {
  const { data, error } = await supabase.from("artists").select("*").order("name");
  if (error) throw error;
  return data as Artist[];
}

export async function createArtist(artist: { name: string; about?: string }) {
  const { data, error } = await supabase.from("artists").insert(artist).select().single();
  if (error) throw error;
  return data as Artist;
}

export async function deleteArtist(id: string) {
  const { error } = await supabase.from("artists").delete().eq("id", id);
  if (error) throw error;
}

export async function updateArtistPhoto(artistId: string, file: File) {
  const fileExt = file.name.split(".").pop();
  const filePath = `${artistId}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("artist-photos")
    .upload(filePath, file, { upsert: true });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage
    .from("artist-photos")
    .getPublicUrl(filePath);

  const { data, error } = await supabase
    .from("artists")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", artistId)
    .select()
    .single();
  if (error) throw error;
  return data as Artist;
}

function normalizeArtistName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

export async function findOrCreateArtist(name: string, photoUrl?: string): Promise<Artist> {
  const normalized = normalizeArtistName(name);
  const userId = await getCurrentUserId();

  const { data: existing } = await supabase
    .from("artists")
    .select("*")
    .ilike("name", normalized)
    .limit(1);

  if (existing && existing.length > 0) {
    if (photoUrl && !existing[0].photo_url) {
      await supabase
        .from("artists")
        .update({ photo_url: photoUrl })
        .eq("id", existing[0].id);
      return { ...existing[0], photo_url: photoUrl } as Artist;
    }
    return existing[0] as Artist;
  }

  const { data, error } = await supabase
    .from("artists")
    .insert({ name: normalized, photo_url: photoUrl || null, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return data as Artist;
}

export async function fetchSongsByArtist(artistName: string, sort: string = "alpha_asc") {
  let query = supabase.from("songs").select("*").ilike("artist", artistName);

  switch (sort) {
    case "alpha_desc":
      query = query.order("title", { ascending: false });
      break;
    case "most_accessed":
      query = query.order("access_count", { ascending: false });
      break;
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    default:
      query = query.order("title", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Song[];
}

export async function incrementAccessCount(id: string) {
  const { data } = await supabase.from("songs").select("access_count").eq("id", id).single();
  const current = (data as any)?.access_count || 0;
  await supabase.from("songs").update({ access_count: current + 1 } as any).eq("id", id);
}

export async function createSetlistFromSelection(
  name: string,
  sourceItems: { song_id: string; loop_count: number | null; speed: number | null; bpm: number | null; transposed_key: string | null }[]
) {
  const userId = await getCurrentUserId();
  const { data: newSetlist, error: setlistError } = await supabase
    .from("setlists")
    .insert({ name, user_id: userId } as any)
    .select()
    .single();
  if (setlistError) throw setlistError;

  const inserts = sourceItems.map((item, i) => ({
    setlist_id: (newSetlist as Setlist).id,
    song_id: item.song_id,
    position: i + 1,
    loop_count: item.loop_count,
    speed: item.speed,
    bpm: item.bpm,
    transposed_key: item.transposed_key,
  }));

  const { error: itemsError } = await supabase.from("setlist_items").insert(inserts);
  if (itemsError) throw itemsError;

  return newSetlist as Setlist;
}
