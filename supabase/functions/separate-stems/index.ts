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

    // Use ryan5453/demucs model (well-maintained, returns structured stems)
    const createRes = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify({
        version: "b26a4313b4d75983d60657f80dfa93b9beb354f6e4fa29ecd27ffe14d60117f6",
        input: {
          audio: audio_url,
          model: "htdemucs",
          output_format: "mp3",
        },
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("Replicate create error:", createRes.status, errBody);

      if (createRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit do Replicate. Aguarde alguns segundos e tente novamente. Se persistir, adicione um método de pagamento em replicate.com." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: `Replicate API error: ${createRes.status}`, details: errBody }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result = await createRes.json();
    console.log("Prediction created:", result.id, "status:", result.status);

    // Poll for completion if not already done (max 10 minutes)
    if (result.status !== "succeeded" && result.status !== "failed") {
      const maxAttempts = 120;
      for (let i = 0; i < maxAttempts; i++) {
        if (result.status === "succeeded" || result.status === "failed" || result.status === "canceled") {
          break;
        }
        await new Promise((r) => setTimeout(r, 5000));
        const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
          headers: { Authorization: `Bearer ${REPLICATE_API_KEY}` },
        });
        result = await pollRes.json();
        console.log(`Poll ${i + 1}: status=${result.status}`);
      }
    }

    if (result.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: `Separation failed: ${result.status}`, details: result.error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Output is { stems: [{ name: "vocals", audio: "url" }, { name: "drums", audio: "url" }, ...] }
    const output = result.output;
    console.log("Separation complete. Output:", JSON.stringify(output));

    // Parse stems - handle both formats
    let stems: Record<string, string> = {};
    if (output?.stems && Array.isArray(output.stems)) {
      // Structured format: { stems: [{ name, audio }] }
      for (const stem of output.stems) {
        stems[stem.name] = stem.audio;
      }
    } else if (typeof output === "object" && output !== null) {
      // Flat format: { vocals: "url", drums: "url", ... }
      stems = output;
    }

    console.log("Parsed stems:", Object.keys(stems));

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Map Demucs stem names to our DB columns
    const stemMapping: Record<string, string> = {
      vocals: "file_vocals",
      drums: "file_percussion",
      other: "file_harmony",
    };

    const updates: Record<string, string> = {};

    for (const [stemName, dbColumn] of Object.entries(stemMapping)) {
      const stemUrl = stems[stemName];
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
        console.error(`Storage upload failed for ${stemName}:`, errText);
        continue;
      }

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/audio-stems/${storagePath}`;
      updates[dbColumn] = publicUrl;
      console.log(`Uploaded ${stemName} -> ${publicUrl}`);
    }

    // Also save bass separately in storage (for future use)
    if (stems.bass) {
      try {
        const bassRes = await fetch(stems.bass);
        if (bassRes.ok) {
          const bassBlob = await bassRes.blob();
          const ext = stems.bass.includes(".wav") ? "wav" : "mp3";
          await fetch(
            `${SUPABASE_URL}/storage/v1/object/audio-stems/${song_id}/bass.${ext}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": bassBlob.type || "audio/mpeg",
                "x-upsert": "true",
              },
              body: bassBlob,
            }
          );
          console.log("Bass stem uploaded separately");
        }
      } catch (e) {
        console.error("Bass upload error:", e);
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
