import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENRE_MAP: Record<string, number> = {
  "Rock": 152,
  "Pop": 132,
  "Sertanejo": 466,
  "Worship": 461,
  "Samba": 65,
  "Pagode": 65,
  "MPB": 197,
  "Forró": 466,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { genre?: string; action?: string; artists?: string[]; limit?: number } = {};
    try { body = await req.json(); } catch {}

    // --- Artist search mode (photos only) ---
    if (body.action === "search-artists" && body.artists?.length) {
      const results = await Promise.all(
        body.artists.map(async (name: string) => {
          try {
            const res = await fetch(
              `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`
            );
            const json = await res.json();
            const artist = json.data?.[0];
            if (artist) {
              return {
                name,
                deezer_id: artist.id,
                picture: artist.picture_medium || artist.picture,
              };
            }
            return { name, deezer_id: null, picture: null };
          } catch {
            return { name, deezer_id: null, picture: null };
          }
        })
      );
      return new Response(JSON.stringify({ data: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Personalized tracks for specific artists ---
    if (body.action === "personalized-tracks" && body.artists?.length) {
      const perArtist = Math.max(1, Math.floor(20 / body.artists.length));
      const allTracks: any[] = [];

      await Promise.all(
        body.artists.map(async (name: string) => {
          try {
            const res = await fetch(
              `https://api.deezer.com/search?q=artist:"${encodeURIComponent(name)}"&limit=${perArtist}&order=RANKING`
            );
            const json = await res.json();
            if (json.data) allTracks.push(...json.data);
          } catch {}
        })
      );

      return new Response(JSON.stringify({ data: allTracks }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Default: chart/genre tracks ---
    const genre = body.genre || "Todos";
    let url: string;

    if (genre === "Todos" || !GENRE_MAP[genre]) {
      url = "https://api.deezer.com/chart/0/tracks?limit=20";
    } else {
      url = `https://api.deezer.com/search?q=${encodeURIComponent(genre)}&limit=20&order=RANKING`;
    }

    const res = await fetch(url);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("deezer-charts error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch chart data" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
