import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map category names to Deezer genre IDs
const GENRE_MAP: Record<string, number> = {
  "Rock": 152,
  "Pop": 132,
  "Sertanejo": 466,
  "Worship": 461,   // Gospel/Religious
  "Samba": 65,
  "Pagode": 65,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let body: { genre?: string } = {};
    try { body = await req.json(); } catch {}

    const genre = body.genre || "Todos";
    let url: string;

    if (genre === "Todos" || !GENRE_MAP[genre]) {
      url = "https://api.deezer.com/chart/0/tracks?limit=20";
    } else {
      // Use Deezer search endpoint filtered by genre name
      url = `https://api.deezer.com/search?q=${encodeURIComponent(genre)}&limit=20&order=RANKING`;
    }

    const res = await fetch(url);
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
