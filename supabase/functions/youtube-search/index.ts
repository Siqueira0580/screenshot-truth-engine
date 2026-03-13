import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Query is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedQuery = query.trim().slice(0, 200);

    // Use Piped API (public YouTube frontend, no API key needed)
    const pipedInstances = [
      "https://pipedapi.kavin.rocks",
      "https://pipedapi.adminforge.de",
      "https://api.piped.privacydev.net",
    ];

    let results: any[] = [];
    let lastError = "";

    for (const instance of pipedInstances) {
      try {
        const url = `${instance}/search?q=${encodeURIComponent(sanitizedQuery)}&filter=videos`;
        const resp = await fetch(url, {
          headers: { "User-Agent": "SmartCifra/1.0" },
          signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) {
          lastError = `${instance}: ${resp.status}`;
          continue;
        }

        const data = await resp.json();
        if (data?.items?.length > 0) {
          results = data.items
            .filter((item: any) => item.type === "stream")
            .slice(0, 8)
            .map((item: any) => ({
              videoId: item.url?.replace("/watch?v=", "") || "",
              title: item.title || "",
              thumbnail: item.thumbnail || "",
              channelName: item.uploaderName || "",
              duration: item.duration || 0,
            }));
          break;
        }
      } catch (e) {
        lastError = `${instance}: ${e.message}`;
        continue;
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
