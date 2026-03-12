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
    // ── Auth guard ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userSupabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userSupabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const userId = claimsData.claims.sub as string;
    // ── End auth guard ──────────────────────────────────────────

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

      // Verify the caller owns the audio track for this song
      const { data: track } = await userSupabase
        .from("audio_tracks")
        .select("id")
        .eq("song_id", song_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!track) {
        return new Response(
          JSON.stringify({ error: "Forbidden: you do not own this audio track" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Starting stem separation for song:", song_id, "user:", userId);

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
          JSON.stringify({ error: "Stem separation service error" }),
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

      // Verify ownership on poll too
      const { data: track } = await userSupabase
        .from("audio_tracks")
        .select("id")
        .eq("song_id", song_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!track) {
        return new Response(
          JSON.stringify({ error: "Forbidden: you do not own this audio track" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${encodeURIComponent(prediction_id)}`, {
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
          JSON.stringify({ status: result.status, error: "Stem separation failed" }),
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

        const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        const stemMapping: Record<string, string> = {
          vocals: "file_vocals",
          drums: "file_percussion",
          other: "file_harmony",
          bass: "file_guitar",
        };

        const updates: Record<string, string> = {};

        for (const [stemName, dbColumn] of Object.entries(stemMapping)) {
          const stemUrl = stems[stemName];
          if (!stemUrl) continue;

          console.log(`Downloading ${stemName}`);
          const stemRes = await fetch(stemUrl);
          if (!stemRes.ok) { console.error(`Failed to download ${stemName}`); continue; }

          const stemArrayBuffer = await stemRes.arrayBuffer();
          const stemUint8 = new Uint8Array(stemArrayBuffer);
          const ext = stemUrl.includes(".wav") ? "wav" : "mp3";
          const storagePath = `${song_id}/${stemName}.${ext}`;
          const contentType = ext === "wav" ? "audio/wav" : "audio/mpeg";

          const { error: uploadError } = await adminSupabase.storage
            .from("audio-stems")
            .upload(storagePath, stemUint8, {
              contentType,
              upsert: true,
            });

          if (uploadError) {
            console.error(`Upload failed for ${stemName}:`, JSON.stringify(uploadError));
            continue;
          }

          const { data: urlData } = adminSupabase.storage.from("audio-stems").getPublicUrl(storagePath);
          updates[dbColumn] = urlData.publicUrl;
          console.log(`Uploaded ${stemName}`);
        }

        // Update DB — scoped to the user's audio track
        if (Object.keys(updates).length > 0) {
          const { error: updateError } = await adminSupabase
            .from("audio_tracks")
            .update(updates)
            .eq("song_id", song_id)
            .eq("user_id", userId);

          if (updateError) {
            console.error("DB update error:", updateError);
            return new Response(
              JSON.stringify({ status: "failed", error: "Failed to save stems" }),
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
    console.error("separate-stems error:", e);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
