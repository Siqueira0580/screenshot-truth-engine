import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Database } from "https://esm.sh/sql.js@1.10.3/dist/sql-wasm.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Load sql.js WASM
    const wasmUrl = "https://sql.js.org/dist/sql-wasm.wasm";
    const wasmResp = await fetch(wasmUrl);
    const wasmBinary = await wasmResp.arrayBuffer();

    // Initialize SQL.js with the WASM binary
    const initSqlJs = (await import("https://esm.sh/sql.js@1.10.3")).default;
    const SQL = await initSqlJs({ wasmBinary });
    const db = new SQL.Database(bytes);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const stats = { songs: 0, artists: 0, setlists: 0, setlist_items: 0, errors: [] as string[] };
    const songIdMap = new Map<number, string>();
    const setlistIdMap = new Map<number, string>();

    // Helper to run a query and get results as array of objects
    function query(sql: string) {
      try {
        const stmt = db.prepare(sql);
        const rows: Record<string, unknown>[] = [];
        while (stmt.step()) {
          const row = stmt.getAsObject();
          rows.push(row);
        }
        stmt.free();
        return rows;
      } catch (e) {
        stats.errors.push(`Query error (${sql.slice(0, 50)}): ${e.message}`);
        return [];
      }
    }

    // 1. Import Artists
    const artists = query("SELECT id, name, about FROM artists");
    for (const row of artists) {
      if (!row.name) continue;
      const { error } = await supabase.from("artists").upsert(
        { name: String(row.name), about: row.about ? String(row.about) : null },
        { onConflict: "name" }
      );
      if (error) stats.errors.push(`Artist "${row.name}": ${error.message}`);
      else stats.artists++;
    }

    // 2. Import Songs
    const songs = query("SELECT id, title, artist, composer, musical_key, style, body_text, default_speed, loop_count, auto_next, youtube_url, bpm FROM songs");
    for (const row of songs) {
      if (!row.title) continue;
      const { data, error } = await supabase
        .from("songs")
        .insert({
          title: String(row.title),
          artist: row.artist ? String(row.artist) : null,
          composer: row.composer ? String(row.composer) : null,
          musical_key: row.musical_key ? String(row.musical_key) : null,
          style: row.style ? String(row.style) : null,
          body_text: row.body_text ? String(row.body_text) : null,
          default_speed: row.default_speed ? Number(row.default_speed) : 250,
          loop_count: row.loop_count ? Number(row.loop_count) : 0,
          auto_next: row.auto_next !== 0,
          youtube_url: row.youtube_url ? String(row.youtube_url) : null,
          bpm: row.bpm ? Number(row.bpm) : null,
        })
        .select("id")
        .single();
      if (error) stats.errors.push(`Song "${row.title}": ${error.message}`);
      else if (data) {
        songIdMap.set(Number(row.id), data.id);
        stats.songs++;
      }
    }

    // 3. Import Setlists
    const setlists = query("SELECT id, name, created_at FROM setlists");
    for (const row of setlists) {
      const { data, error } = await supabase
        .from("setlists")
        .insert({ name: String(row.name) })
        .select("id")
        .single();
      if (error) stats.errors.push(`Setlist "${row.name}": ${error.message}`);
      else if (data) {
        setlistIdMap.set(Number(row.id), data.id);
        stats.setlists++;
      }
    }

    // 4. Import Setlist Items
    const items = query("SELECT setlist_id, song_id, position, loop_count, speed, bpm FROM setlist_items ORDER BY setlist_id, position");
    for (const row of items) {
      const newSetlistId = setlistIdMap.get(Number(row.setlist_id));
      const newSongId = songIdMap.get(Number(row.song_id));
      if (!newSetlistId || !newSongId) {
        stats.errors.push(`Setlist item: missing mapping for setlist ${row.setlist_id} or song ${row.song_id}`);
        continue;
      }
      const { error } = await supabase.from("setlist_items").insert({
        setlist_id: newSetlistId,
        song_id: newSongId,
        position: Number(row.position),
        loop_count: row.loop_count != null ? Number(row.loop_count) : null,
        speed: row.speed != null ? Number(row.speed) : null,
        bpm: row.bpm != null ? Number(row.bpm) : null,
      });
      if (error) stats.errors.push(`Setlist item: ${error.message}`);
      else stats.setlist_items++;
    }

    db.close();

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
