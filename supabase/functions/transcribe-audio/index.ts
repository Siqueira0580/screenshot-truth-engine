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
    const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userId = user.id;

    const { lyrics, song_title, artist, audio_track_id } = await req.json();

    if (!lyrics) {
      return new Response(
        JSON.stringify({ error: "O campo 'lyrics' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um processador de cifras musicais estrito. A sua ÚNICA função é receber uma letra de música e posicionar os acordes corretos colados na sílaba exata onde são tocados, usando OBRIGATORIAMENTE o formato ChordPro (ex: [Am]).

REGRAS INQUEBRÁVEIS:
1. NUNCA duplique acordes. Cada acorde deve aparecer APENAS UMA VEZ, exatamente colado à palavra/sílaba correspondente.
2. NUNCA adicione texto conversacional. Retorne APENAS a cifra formatada.
3. Reconheça e mantenha acordes especiais/complexos sem os simplificar.
4. Mantenha toda a letra original — não omita, resuma ou traduza nada.
5. Quebre as linhas exatamente como o original.
6. Se reconhecer a música, use a harmonia real. Se não, crie uma harmonização plausível.
7. NÃO adicione diretivas ChordPro como {title:}, {artist:}, etc.
8. Use notação cifrada padrão (C, C#, Dm, G7, Am7, Bb, etc.).`;

    const userPrompt = [
      song_title ? `Título: ${song_title}` : "",
      artist ? `Artista: ${artist}` : "",
      "",
      "LETRA:",
      lyrics,
    ]
      .filter(Boolean)
      .join("\n");

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: "user",
          parts: [{ text: userPrompt }],
        }],
        generationConfig: { temperature: 0 },
      }),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      console.error("Gemini error:", status, body);

      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns instantes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Gemini error [${status}]`);
    }

    const aiData = await aiResponse.json();
    let chordProText: string =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    // Post-processing
    const codeBlockMatch = chordProText.match(/```(?:chordpro|text)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      chordProText = codeBlockMatch[1].trim();
    }

    chordProText = chordProText
      .split("\n")
      .filter((line) => {
        const trimmed = line.trim().toLowerCase();
        if (/^(aqui está|espero que|segue a|segue abaixo|pronto|claro|com certeza)/i.test(trimmed)) return false;
        if (/^\{[^}]+\}$/.test(trimmed)) return false;
        if (/^\[[\w#b/+°ø()]+\](\s*\[[\w#b/+°ø()]+\])*\s*$/.test(trimmed)) return false;
        return true;
      })
      .join("\n")
      .trim();

    // Save to audio_tracks if ID provided
    if (audio_track_id) {
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
