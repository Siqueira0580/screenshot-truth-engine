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
    const { song_id, artist, title, current_style, current_bpm, current_musical_key, current_composer } = await req.json();

    if (!song_id) {
      return new Response(JSON.stringify({ error: "song_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const updates: Record<string, string | number | null> = {};
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

    // Step 2: Classify genre, BPM, tone, and composers via AI if missing
    const needsGenre = !current_style && artist;
    const needsBpm = (!current_bpm || current_bpm === 0) && artist && title;
    const needsKey = !current_musical_key && artist && title;
    const needsComposer = !current_composer && artist && title;

    if (needsGenre || needsBpm || needsKey || needsComposer) {
      try {
        const openaiKey = Deno.env.get("LOVABLE_API_KEY");
        if (openaiKey) {
          const fieldDescriptions: string[] = [];
          if (needsGenre) fieldDescriptions.push('"genre": gênero musical em português (ex: Sertanejo, MPB, Pop Rock) ou null se não souber');
          if (needsBpm) fieldDescriptions.push('"bpm": BPM original de estúdio como número inteiro ou null se não souber');
          if (needsKey) fieldDescriptions.push('"tone": tom original da música (ex: C, Am, G#m) ou null se não souber');
          if (needsComposer) fieldDescriptions.push('"composers": nomes dos compositores separados por vírgula ou null se não souber');

          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                    'You are a music metadata expert. Return ONLY valid JSON with the requested fields. No explanation, no markdown. If you are not sure about a value, return null for that field. Never invent data.',
                },
                {
                  role: "user",
                  content: `Analise a música "${title || ''}" de "${artist}". Retorne um JSON com: ${fieldDescriptions.join("; ")}. Formato exato: { ${needsGenre ? '"genre": "string|null"' : ''}${needsBpm ? ', "bpm": number|null' : ''}${needsKey ? ', "tone": "string|null"' : ''}${needsComposer ? ', "composers": "string|null"' : ''} }`,
                },
              ],
              max_tokens: 120,
              temperature: 0.1,
            }),
          });

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const raw = aiData.choices?.[0]?.message?.content?.trim();
            console.log(`AI response for "${title}": ${raw}`);
            try {
              const parsed = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
              if (needsGenre && parsed.genre && typeof parsed.genre === "string" && parsed.genre.length < 40) {
                updates.style = parsed.genre;
              }
              if (needsBpm && parsed.bpm != null) {
                const bpmVal = typeof parsed.bpm === "string" ? parseInt(parsed.bpm, 10) : parsed.bpm;
                if (typeof bpmVal === "number" && bpmVal > 20 && bpmVal < 300) {
                  updates.bpm = bpmVal;
                }
              }
              if (needsKey && parsed.tone && typeof parsed.tone === "string" && parsed.tone.length < 10) {
                updates.musical_key = parsed.tone;
              }
              if (needsComposer && parsed.composers && typeof parsed.composers === "string" && parsed.composers.length < 200) {
                updates.composer = parsed.composers;
              }
            } catch {
              console.error("Failed to parse AI JSON response");
            }
          }
        }
      } catch (e) {
        console.error("AI enrichment error:", e);
      }
    }

    // Step 3: Update song record
    updates.enrichment_status = "done";

    const { error: updateError } = await supabase
      .from("songs")
      .update(updates)
      .eq("id", song_id);

    if (updateError) {
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
        bpm: updates.bpm || null,
        musical_key: updates.musical_key || null,
        composer: updates.composer || null,
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
