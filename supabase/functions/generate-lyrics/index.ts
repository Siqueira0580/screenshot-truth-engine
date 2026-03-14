import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth guard ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { prompt, style } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: "Envie pelo menos 5 caracteres de contexto." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um assistente de composição musical genial, especialista em música brasileira.
Analise a letra incompleta fornecida pelo utilizador e sugira EXATAMENTE 3 opções curtas (1 ou 2 versos cada) de continuação que façam sentido métrico e temático.
${style ? `O estilo musical é: ${style}. Adapte o vocabulário e a métrica ao estilo.` : ""}
Responda APENAS com um JSON válido, sem markdown:
{"suggestions": ["verso 1", "verso 2", "verso 3"]}`;

    const aiResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Continuação para:\n\n${prompt.slice(-400)}` },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error("AI service unavailable");
    }

    const aiData = await aiResponse.json();
    const rawContent: string = aiData.choices?.[0]?.message?.content?.trim() ?? "";

    let suggestions: string[] = [];
    try {
      const cleanJson = rawContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleanJson);
      suggestions = Array.isArray(parsed.suggestions)
        ? parsed.suggestions.filter((s: unknown) => typeof s === "string").slice(0, 3)
        : [];
    } catch {
      // Fallback: split by double newline
      suggestions = rawContent.split(/\n\n+/).filter((s) => s.trim()).slice(0, 3);
    }

    if (suggestions.length === 0) {
      suggestions = [rawContent.trim()].filter(Boolean);
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("generate-lyrics error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar sugestões. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
