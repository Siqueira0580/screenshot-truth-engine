import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth: extract caller identity ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userSupabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    // ── Parse file ──
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return new Response(JSON.stringify({ error: "No file uploaded" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (file.size > MAX_FILE_SIZE) {
      return new Response(JSON.stringify({ error: `File too large. Max ${MAX_FILE_SIZE / 1024 / 1024}MB.` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    // Load sql.js WASM
    const wasmUrl = "https://sql.js.org/dist/sql-wasm.wasm";
    const wasmResp = await fetch(wasmUrl);
    const wasmBinary = await wasmResp.arrayBuffer();

    const initSqlJs = (await import("https://esm.sh/sql.js@1.10.3")).default;
    const SQL = await initSqlJs({ wasmBinary });
    const db = new SQL.Database(bytes);

    // Use service role for writes, but always attribute to authenticated user
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const stats = { songs: 0, artists: 0, setlists: 0, setlist_items: 0, errors: [] as string[] };
    const songIdMap = new Map<number, string>();
    const setlistIdMap = new Map<number, string>();

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
        stats.errors.push(`Query error: ${(e as Error).message}`);
        return [];
      }
    }

    // 1. Import Artists – attribute to caller
    const artists = query("SELECT id, name, about FROM artists");
    for (const row of artists) {
      if (!row.name) continue;
      const { error } = await supabase.from("artists").upsert(
        { name: String(row.name), about: row.about ? String(row.about) : null, created_by: userId },
        { onConflict: "name" }
      );
      if (error) stats.errors.push(`Artist "${row.name}": ${error.message}`);
      else stats.artists++;
    }

    // 2. Import Songs – attribute to caller
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
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) stats.errors.push(`Song "${row.title}": ${error.message}`);
      else if (data) {
        songIdMap.set(Number(row.id), data.id);
        stats.songs++;
      }
    }

    // Also add imported songs to user's library
    for (const newSongId of songIdMap.values()) {
      await supabase.from("user_library").upsert(
        { user_id: userId, song_id: newSongId },
        { onConflict: "user_id,song_id" }
      );
    }

    // 3. Import Setlists – attribute to caller
    const setlists = query("SELECT id, name, created_at FROM setlists");
    for (const row of setlists) {
      const { data, error } = await supabase
        .from("setlists")
        .insert({ name: String(row.name), user_id: userId })
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
    return new Response(JSON.stringify({ error: "Import failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
