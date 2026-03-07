import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Você é um mestre em harmonia e teoria musical. Sua tarefa é gerar a posição mais comum e ergonômica para tocar um acorde em um instrumento de cordas com afinação padrão.

Regras:
- Para violão/guitarra (guitar): 6 cordas, afinação E-A-D-G-B-E (grave→agudo). O array "frets" deve ter exatamente 6 elementos.
- Para cavaquinho (cavaquinho): 4 cordas, afinação D-G-B-D. O array "frets" deve ter exatamente 4 elementos.
- Para ukulele (ukulele): 4 cordas, afinação G-C-E-A. O array "frets" deve ter exatamente 4 elementos.
- Use -1 para corda mutada (não tocada), 0 para corda solta.
- "baseFret" indica a casa base quando a posição não está na primeira posição (use 1 se estiver na 1ª posição ou omitir).
- "barres" é um array de pestanas. Cada pestana tem "fret" (casa relativa), "from" (índice da corda inicial, 0-based) e "to" (índice da corda final, 0-based).
- "fingers" indica qual dedo pressiona cada corda: 0=não pressionado, 1=indicador, 2=médio, 3=anelar, 4=mindinho.
- Priorize posições confortáveis e comuns usadas por músicos profissionais.
- Se o acorde tiver inversão (ex: Am/E), priorize o baixo indicado.

Responda APENAS com o JSON, sem explicações.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chordName, instrument } = await req.json();

    if (!chordName || !instrument) {
      return new Response(
        JSON.stringify({ error: "chordName and instrument are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check cache first
    const { data: cached } = await supabase
      .from("ai_generated_chords")
      .select("chord_data")
      .eq("chord_name", chordName)
      .eq("instrument", instrument)
      .maybeSingle();

    if (cached?.chord_data) {
      return new Response(
        JSON.stringify({ chord_data: cached.chord_data, source: "cache" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Call Lovable AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const instrumentLabel: Record<string, string> = {
      guitar: "violão/guitarra (6 cordas, afinação padrão E-A-D-G-B-E)",
      cavaquinho: "cavaquinho (4 cordas, afinação D-G-B-D)",
      ukulele: "ukulele (4 cordas, afinação G-C-E-A)",
    };

    const userPrompt = `Gere a posição para o acorde "${chordName}" no instrumento: ${instrumentLabel[instrument] || instrument}.

Responda ESTRITAMENTE com um JSON neste formato:
{
  "baseFret": 1,
  "frets": [-1, 3, 2, 0, 1, 0],
  "fingers": [0, 3, 2, 0, 1, 0],
  "barres": [{"fret": 1, "from": 0, "to": 5}]
}

Se não houver pestana, use "barres": [].`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required for AI service." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI generation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = rawContent.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    let chordData: any;
    try {
      chordData = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse AI response:", rawContent);
      return new Response(
        JSON.stringify({ error: "AI returned invalid JSON", raw: rawContent }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate structure
    if (!Array.isArray(chordData.frets)) {
      return new Response(
        JSON.stringify({ error: "AI response missing frets array", raw: chordData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize: convert barres format to match our internal format
    const normalizedData = {
      baseFret: chordData.baseFret || 1,
      frets: chordData.frets,
      fingers: chordData.fingers || [],
      barres: (chordData.barres || []).map((b: any) => ({
        fret: b.fret,
        from: b.from ?? b.fromString ?? 0,
        to: b.to ?? b.toString ?? (chordData.frets.length - 1),
      })),
    };

    // 3. Cache in database
    await supabase.from("ai_generated_chords").upsert(
      { chord_name: chordName, instrument, chord_data: normalizedData },
      { onConflict: "chord_name,instrument" }
    );

    return new Response(
      JSON.stringify({ chord_data: normalizedData, source: "ai" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-chord-voicing error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
