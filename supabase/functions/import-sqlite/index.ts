import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DB } from "https://deno.land/x/sqlite@v3.9.1/mod.ts";

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

    // Write the uploaded file to a temp location
    const bytes = new Uint8Array(await file.arrayBuffer());
    const tempPath = "/tmp/import.db";
    await Deno.writeFile(tempPath, bytes);

    // Open SQLite database
    const db = new DB(tempPath);

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const stats = { songs: 0, artists: 0, setlists: 0, setlist_items: 0, errors: [] as string[] };

    // Map old integer IDs to new UUIDs
    const songIdMap = new Map<number, string>();
    const setlistIdMap = new Map<number, string>();

    // 1. Import Artists
    try {
      const artists = db.query("SELECT id, name, about FROM artists");
      for (const [_id, name, about] of artists) {
        if (!name) continue;
        const { error } = await supabase.from("artists").upsert(
          { name: String(name), about: about ? String(about) : null },
          { onConflict: "name" }
        );
        if (error) {
          stats.errors.push(`Artist "${name}": ${error.message}`);
        } else {
          stats.artists++;
        }
      }
    } catch (e) {
      stats.errors.push(`Artists table: ${e.message}`);
    }

    // 2. Import Songs
    try {
      const songs = db.query(
        "SELECT id, title, artist, composer, musical_key, style, body_text, default_speed, loop_count, auto_next, youtube_url, bpm FROM songs"
      );
      for (const row of songs) {
        const [oldId, title, artist, composer, musical_key, style, body_text, default_speed, loop_count, auto_next, youtube_url, bpm] = row;
        if (!title) continue;
        const { data, error } = await supabase
          .from("songs")
          .insert({
            title: String(title),
            artist: artist ? String(artist) : null,
            composer: composer ? String(composer) : null,
            musical_key: musical_key ? String(musical_key) : null,
            style: style ? String(style) : null,
            body_text: body_text ? String(body_text) : null,
            default_speed: default_speed ? Number(default_speed) : 250,
            loop_count: loop_count ? Number(loop_count) : 0,
            auto_next: auto_next !== 0,
            youtube_url: youtube_url ? String(youtube_url) : null,
            bpm: bpm ? Number(bpm) : null,
          })
          .select("id")
          .single();
        if (error) {
          stats.errors.push(`Song "${title}": ${error.message}`);
        } else if (data) {
          songIdMap.set(Number(oldId), data.id);
          stats.songs++;
        }
      }
    } catch (e) {
      stats.errors.push(`Songs table: ${e.message}`);
    }

    // 3. Import Setlists
    try {
      // Check if show_date and show_duration columns exist
      let hasShowDate = false;
      let hasShowDuration = false;
      try {
        const cols = db.query("PRAGMA table_info(setlists)");
        for (const col of cols) {
          if (col[1] === "show_date") hasShowDate = true;
          if (col[1] === "show_duration") hasShowDuration = true;
        }
      } catch (_) {}

      const setlists = db.query("SELECT id, name, created_at" + 
        (hasShowDate ? ", show_date" : "") + 
        (hasShowDuration ? ", show_duration" : "") + 
        " FROM setlists");
      
      for (const row of setlists) {
        const oldId = Number(row[0]);
        const name = String(row[1]);
        const insertData: Record<string, unknown> = { name };
        
        if (hasShowDate && row[3]) insertData.show_date = String(row[3]);
        if (hasShowDuration && row[hasShowDate ? 4 : 3]) {
          insertData.show_duration = Number(row[hasShowDate ? 4 : 3]);
        }

        const { data, error } = await supabase
          .from("setlists")
          .insert(insertData)
          .select("id")
          .single();
        if (error) {
          stats.errors.push(`Setlist "${name}": ${error.message}`);
        } else if (data) {
          setlistIdMap.set(oldId, data.id);
          stats.setlists++;
        }
      }
    } catch (e) {
      stats.errors.push(`Setlists table: ${e.message}`);
    }

    // 4. Import Setlist Items
    try {
      const items = db.query(
        "SELECT setlist_id, song_id, position, loop_count, speed, bpm FROM setlist_items ORDER BY setlist_id, position"
      );
      for (const [setlistId, songId, position, loop_count, speed, bpm] of items) {
        const newSetlistId = setlistIdMap.get(Number(setlistId));
        const newSongId = songIdMap.get(Number(songId));
        if (!newSetlistId || !newSongId) {
          stats.errors.push(`Setlist item: missing mapping for setlist ${setlistId} or song ${songId}`);
          continue;
        }
        const { error } = await supabase.from("setlist_items").insert({
          setlist_id: newSetlistId,
          song_id: newSongId,
          position: Number(position),
          loop_count: loop_count != null ? Number(loop_count) : null,
          speed: speed != null ? Number(speed) : null,
          bpm: bpm != null ? Number(bpm) : null,
        });
        if (error) {
          stats.errors.push(`Setlist item: ${error.message}`);
        } else {
          stats.setlist_items++;
        }
      }
    } catch (e) {
      stats.errors.push(`Setlist items: ${e.message}`);
    }

    db.close();

    // Clean up temp file
    try { await Deno.remove(tempPath); } catch (_) {}

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
