import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { song_id, artist, title, current_style, current_bpm } = await req.json();

    if (!song_id) {
      return new Response(JSON.stringify({ error: "song_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updates: Record<string, string | null> = {};
    let artistImageUrl: string | null = null;

    // Step 1: Fetch artist image from Deezer
    if (artist) {
      try {
        const deezerRes = await fetch(
          `https://api.deezer.com/search/artist?q=${encodeURIComponent(artist)}`
        );
        if (deezerRes.ok) {
          const deezerData = await deezerRes.json();
          if (deezerData.data && deezerData.data.length > 0) {
            artistImageUrl =
              deezerData.data[0].picture_xl ||
              deezerData.data[0].picture_medium ||
              null;
          }
        }
      } catch (e) {
        console.error("Deezer fetch error:", e);
      }

      // Update artist table photo if found
      if (artistImageUrl) {
        const { data: existingArtist } = await supabase
          .from("artists")
          .select("id, photo_url")
          .ilike("name", artist.trim())
          .limit(1);

        if (existingArtist && existingArtist.length > 0 && !existingArtist[0].photo_url) {
          await supabase
            .from("artists")
            .update({ photo_url: artistImageUrl })
            .eq("id", existingArtist[0].id);
        }
      }
    }

    // Step 2: Classify genre via AI if missing
    if (!current_style && artist) {
      try {
        const openaiKey = Deno.env.get("LOVABLE_API_KEY");
        if (openaiKey) {
          const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content:
                    "You classify music genres. Return ONLY a single genre/style word or short phrase in Portuguese (e.g. 'Sertanejo', 'Pop Rock', 'MPB', 'Forró', 'Bossa Nova', 'Gospel', 'Pagode', 'Axé', 'Rock', 'Samba'). No explanation.",
                },
                {
                  role: "user",
                  content: `Qual o gênero musical do artista "${artist}"?`,
                },
              ],
              max_tokens: 20,
              temperature: 0.1,
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const genre = aiData.choices?.[0]?.message?.content?.trim();
            if (genre && genre.length < 40) {
              updates.style = genre;
            }
          }
        }
      } catch (e) {
        console.error("AI genre error:", e);
      }
    }

    // Step 3: Update song record
    updates.enrichment_status = "done";

    const { error: updateError } = await supabase
      .from("songs")
      .update(updates)
      .eq("id", song_id);

    if (updateError) {
      // Mark as failed so we don't retry
      await supabase
        .from("songs")
        .update({ enrichment_status: "failed" } as any)
        .eq("id", song_id);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        artist_image_url: artistImageUrl,
        style: updates.style || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("enrich-song error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
