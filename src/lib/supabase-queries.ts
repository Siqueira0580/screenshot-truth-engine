import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Song = Database["public"]["Tables"]["songs"]["Row"];
type SongInsert = Database["public"]["Tables"]["songs"]["Insert"];
type Setlist = Database["public"]["Tables"]["setlists"]["Row"];
type SetlistInsert = Database["public"]["Tables"]["setlists"]["Insert"];
type SetlistItem = Database["public"]["Tables"]["setlist_items"]["Row"];
type Artist = Database["public"]["Tables"]["artists"]["Row"];

// Songs
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
  const { data, error } = await supabase.from("songs").insert(song).select().single();
  if (error) throw error;
  return data as Song;
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

// Setlists
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
  const { data, error } = await supabase.from("setlists").insert(setlist).select().single();
  if (error) throw error;
  return data as Setlist;
}

export async function deleteSetlist(id: string) {
  const { error } = await supabase.from("setlists").delete().eq("id", id);
  if (error) throw error;
}

export async function addSongToSetlist(setlistId: string, songId: string, position: number) {
  const { error } = await supabase.from("setlist_items").insert({
    setlist_id: setlistId,
    song_id: songId,
    position,
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

// Artists
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

  // Upload (upsert) file
  const { error: uploadError } = await supabase.storage
    .from("artist-photos")
    .upload(filePath, file, { upsert: true });
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from("artist-photos")
    .getPublicUrl(filePath);

  // Update artist record
  const { data, error } = await supabase
    .from("artists")
    .update({ photo_url: urlData.publicUrl })
    .eq("id", artistId)
    .select()
    .single();
  if (error) throw error;
  return data as Artist;
}

// Find or create artist (case-insensitive dedup)
export async function findOrCreateArtist(name: string): Promise<Artist> {
  const { data: existing } = await supabase
    .from("artists")
    .select("*")
    .ilike("name", name.trim())
    .limit(1);

  if (existing && existing.length > 0) {
    return existing[0] as Artist;
  }

  const { data, error } = await supabase
    .from("artists")
    .insert({ name: name.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as Artist;
}

// Fetch songs by artist name
export async function fetchSongsByArtist(
  artistName: string,
  sort: string = "alpha_asc"
) {
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
    default: // alpha_asc
      query = query.order("title", { ascending: true });
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Song[];
}

// Increment access count
export async function incrementAccessCount(id: string) {
  // Simple fetch + update approach
  const { data } = await supabase.from("songs").select("access_count").eq("id", id).single();
  const current = (data as any)?.access_count || 0;
  await supabase.from("songs").update({ access_count: current + 1 } as any).eq("id", id);
}
