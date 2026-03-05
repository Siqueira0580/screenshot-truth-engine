import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
    const body = await req.json();
    const action = body.action || "start";

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "REPLICATE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: START — create prediction and return ID
    if (action === "start") {
      const { audio_url, song_id } = body;
      if (!audio_url || !song_id) {
        return new Response(
          JSON.stringify({ error: "audio_url and song_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Starting stem separation for song:", song_id);

      const createRes = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "b26a4313b4d75983d60657f80dfa93b9beb354f6e4fa29ecd27ffe14d60117f6",
          input: { audio: audio_url, model: "htdemucs", output_format: "mp3" },
        }),
      });

      if (!createRes.ok) {
        const errBody = await createRes.text();
        console.error("Replicate create error:", createRes.status, errBody);
        return new Response(
          JSON.stringify({ error: `Replicate API error: ${createRes.status}`, details: errBody }),
          { status: createRes.status === 402 ? 402 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const result = await createRes.json();
      console.log("Prediction created:", result.id, "status:", result.status);

      return new Response(
        JSON.stringify({ prediction_id: result.id, status: result.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ACTION: POLL — check status, if done download and store stems
    if (action === "poll") {
      const { prediction_id, song_id } = body;
      if (!prediction_id || !song_id) {
        return new Response(
          JSON.stringify({ error: "prediction_id and song_id are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction_id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      const result = await pollRes.json();
      console.log("Poll status:", result.status);

      if (result.status === "processing" || result.status === "starting") {
        return new Response(
          JSON.stringify({ status: result.status }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (result.status === "failed" || result.status === "canceled") {
        return new Response(
          JSON.stringify({ status: result.status, error: result.error }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (result.status === "succeeded") {
        // Parse stems
        const output = result.output;
        let stems: Record<string, string> = {};
        if (output?.stems && Array.isArray(output.stems)) {
          for (const stem of output.stems) {
            stems[stem.name] = stem.audio;
          }
        } else if (typeof output === "object" && output !== null) {
          stems = output;
        }

        console.log("Parsed stems:", Object.keys(stems));

        const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const stemMapping: Record<string, string> = {
          vocals: "file_vocals",
          drums: "file_percussion",
          other: "file_harmony",
        };

        const updates: Record<string, string> = {};

        for (const [stemName, dbColumn] of Object.entries(stemMapping)) {
          const stemUrl = stems[stemName];
          if (!stemUrl) continue;

          console.log(`Downloading ${stemName}`);
          const stemRes = await fetch(stemUrl);
          if (!stemRes.ok) { console.error(`Failed to download ${stemName}`); continue; }

          const stemBlob = await stemRes.blob();
          const ext = stemUrl.includes(".wav") ? "wav" : "mp3";
          const storagePath = `${song_id}/${stemName}.${ext}`;

          const uploadRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/audio-stems/${storagePath}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": stemBlob.type || "audio/mpeg",
                "x-upsert": "true",
              },
              body: stemBlob,
            }
          );

          if (!uploadRes.ok) {
            const errText = await uploadRes.text();
            console.error(`Upload failed for ${stemName}:`, errText);
            continue;
          }

          updates[dbColumn] = `${SUPABASE_URL}/storage/v1/object/public/audio-stems/${storagePath}`;
          console.log(`Uploaded ${stemName}`);
        }

        // Update DB
        if (Object.keys(updates).length > 0) {
          const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
          const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
          const { error: updateError } = await supabase
            .from("audio_tracks")
            .update(updates)
            .eq("song_id", song_id);

          if (updateError) {
            console.error("DB update error:", updateError);
            return new Response(
              JSON.stringify({ status: "failed", error: "DB update failed" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }

        return new Response(
          JSON.stringify({ status: "succeeded", stems: Object.keys(updates) }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ status: result.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
