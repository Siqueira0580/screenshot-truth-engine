import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { word } = await req.json();
    if (!word || typeof word !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'word'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not configured");

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: "Você é um dicionário de rimas em português brasileiro. Retorne APENAS um array JSON válido de strings, sem markdown, sem explicações, sem crases." }],
        },
        contents: [{
          role: "user",
          parts: [{ text: `Gere uma lista de 20 a 30 palavras em português que rimam perfeitamente com a palavra "${word}". Retorne APENAS um array JSON de strings. Exemplo: ["amor", "dor", "flor"]` }],
        }],
        generationConfig: { temperature: 0.5 },
      }),
    });

    if (response.status === 429) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!response.ok) {
      const t = await response.text();
      console.error("Gemini error:", response.status, t);
      throw new Error("Gemini API error");
    }

    const data = await response.json();
    let content = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "[]";

    content = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let rhymes: string[] = [];
    try {
      rhymes = JSON.parse(content);
      if (!Array.isArray(rhymes)) rhymes = [];
      rhymes = rhymes.filter((r: unknown) => typeof r === "string").slice(0, 40);
    } catch {
      console.error("Failed to parse Gemini rhymes response:", content);
      rhymes = [];
    }

    return new Response(JSON.stringify({ rhymes }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-rhymes error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate rhymes" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
