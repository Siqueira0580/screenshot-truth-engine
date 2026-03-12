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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── Authenticate the caller ─────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const userId = claimsData.claims.sub;

    const { lyrics, song_title, artist, audio_track_id } = await req.json();

    if (!lyrics) {
      return new Response(
        JSON.stringify({ error: "O campo 'lyrics' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Prompt para gerar ChordPro ──────────────────────────────
    const systemPrompt = `Você é um músico profissional e cifrador especialista.
O usuário vai fornecer a LETRA de uma música (e opcionalmente título/artista).
Sua tarefa é devolver a letra inteira no formato ChordPro, posicionando os acordes
EXATAMENTE sobre as sílabas corretas usando colchetes. Exemplo: [C]Parabéns pra [G]você.

Regras estritas:
1. Use SOMENTE o formato de colchetes: [Acorde]
2. Mantenha toda a letra original — não omita, resuma ou traduza nada.
3. Quebre as linhas exatamente como o original.
4. Se reconhecer a música, use a harmonia real. Se não reconhecer, crie uma harmonização plausível no estilo indicado.
5. NÃO adicione comentários, explicações ou metadados — retorne APENAS o texto ChordPro puro.
6. Use notação cifrada padrão (C, C#, Dm, G7, Am7, Bb, etc.).`;

    const userPrompt = [
      song_title ? `Título: ${song_title}` : "",
      artist ? `Artista: ${artist}` : "",
      "",
      "LETRA:",
      lyrics,
    ]
      .filter(Boolean)
      .join("\n");

    // ── Chamada ao Lovable AI Gateway ───────────────────────────
    const aiResponse = await fetch(AI_GATEWAY, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const body = await aiResponse.text();
      console.error("AI gateway error:", status, body);
      throw new Error(`AI gateway error [${status}]`);
    }

    const aiData = await aiResponse.json();
    const chordProText: string =
      aiData.choices?.[0]?.message?.content?.trim() ?? "";

    // ── Salvar na tabela audio_tracks (se ID fornecido) ─────────
    if (audio_track_id) {
      // Use service role to write, but first verify ownership
      const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: track, error: fetchError } = await serviceSupabase
        .from("audio_tracks")
        .select("user_id")
        .eq("id", audio_track_id)
        .single();

      if (fetchError || !track || track.user_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Acesso negado: você não é o dono desta faixa de áudio." }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { error: updateError } = await serviceSupabase
        .from("audio_tracks")
        .update({ ai_chordpro_text: chordProText })
        .eq("id", audio_track_id);

      if (updateError) {
        console.error("Erro ao salvar ChordPro:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ chordpro: chordProText }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("transcribe-audio error:", error);
    return new Response(
      JSON.stringify({ error: "Transcription service unavailable. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
