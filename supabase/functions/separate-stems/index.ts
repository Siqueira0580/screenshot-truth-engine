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
    const { audio_url, song_id } = await req.json();

    if (!audio_url || !song_id) {
      return new Response(
        JSON.stringify({ error: "audio_url and song_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "REPLICATE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Starting stem separation for song:", song_id);

    // Create prediction with Demucs (htdemucs model)
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "25a173108cff36ef9f80f854c162d01df9e6528be175794b81571db245b1c10c",
        input: {
          audio: audio_url,
          stem: "none", // returns all stems
        },
      }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.error("Replicate create error:", createRes.status, errText);
      return new Response(
        JSON.stringify({ error: `Replicate API error: ${createRes.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const prediction = await createRes.json();
    console.log("Prediction created:", prediction.id);

    // Poll for completion (max 10 minutes)
    let result = prediction;
    const maxAttempts = 120;
    for (let i = 0; i < maxAttempts; i++) {
      if (result.status === "succeeded" || result.status === "failed" || result.status === "canceled") {
        break;
      }

      await new Promise((r) => setTimeout(r, 5000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
      });
      result = await pollRes.json();
      console.log(`Poll ${i + 1}: status=${result.status}`);
    }

    if (result.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: `Separation failed: ${result.status}`, details: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Result output is an object with stem URLs: { vocals, drums, bass, other }
    const output = result.output;
    console.log("Separation complete. Output keys:", Object.keys(output));

    // Download stems and upload to storage
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const stemMapping: Record<string, string> = {
      vocals: "file_vocals",
      drums: "file_percussion",
      other: "file_harmony", // "other" contains harmony/instruments
    };

    const updates: Record<string, string> = {};

    for (const [stemName, dbColumn] of Object.entries(stemMapping)) {
      const stemUrl = output[stemName];
      if (!stemUrl) {
        console.log(`No ${stemName} stem in output`);
        continue;
      }

      console.log(`Downloading ${stemName} from ${stemUrl}`);
      const stemRes = await fetch(stemUrl);
      if (!stemRes.ok) {
        console.error(`Failed to download ${stemName}: ${stemRes.status}`);
        continue;
      }

      const stemBlob = await stemRes.blob();
      const storagePath = `${song_id}/${stemName}.wav`;

      // Upload to Supabase storage
      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/audio-stems/${storagePath}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            "Content-Type": stemBlob.type || "audio/wav",
            "x-upsert": "true",
          },
          body: stemBlob,
        }
      );

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        console.error(`Storage upload failed for ${stemName}:`, errText);
        continue;
      }

      // Get public URL
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/audio-stems/${storagePath}`;
      updates[dbColumn] = publicUrl;
      console.log(`Uploaded ${stemName} -> ${publicUrl}`);
    }

    // Also include bass in harmony (combine conceptually - store bass URL too if needed)
    if (output.bass) {
      const bassRes = await fetch(output.bass);
      if (bassRes.ok) {
        const bassBlob = await bassRes.blob();
        const bassPath = `${song_id}/bass.wav`;
        await fetch(
          `${SUPABASE_URL}/storage/v1/object/audio-stems/${bassPath}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              "Content-Type": bassBlob.type || "audio/wav",
              "x-upsert": "true",
            },
            body: bassBlob,
          }
        );
        console.log("Bass stem uploaded separately");
      }
    }

    // Update audio_tracks record
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
          JSON.stringify({ error: "Failed to update database", details: updateError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        stems: Object.keys(updates),
        message: `${Object.keys(updates).length} stems separados com sucesso`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Separation error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
