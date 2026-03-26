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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("VITE_GEMINI_API_KEY is not configured");

    const { audio_base64, mime_type, style, existing_text } = await req.json();

    if (!audio_base64) {
      return new Response(
        JSON.stringify({ error: "O campo 'audio_base64' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audioMime = mime_type || "audio/webm";

    const systemPrompt = `Você é um transcritor musical profissional especializado em música brasileira.
O usuário vai enviar um áudio gravado de voz (cantando ou falando uma composição musical).
Sua tarefa é:
1. Transcrever EXATAMENTE o que foi dito/cantado no áudio, em português brasileiro.
2. Se possível, identificar as notas/acordes e adicioná-los no formato ChordPro (ex: [G]palavra [Am]outra).
3. Se não conseguir identificar acordes com certeza, retorne apenas o texto transcrito SEM colchetes.
4. Mantenha quebras de linha naturais para versos.
5. Se o áudio estiver vazio ou inaudível, retorne uma string vazia.
${style ? `6. O estilo musical é: ${style}. Use isso como contexto para harmonização.` : ""}

FORMATO DE RESPOSTA OBRIGATÓRIO — responda APENAS com um JSON válido, sem markdown, sem explicações:
{"transcription": "texto transcrito aqui com [Acordes] se detectados", "detected_key": "tom detectado ou null"}`;

    const userText = existing_text
      ? `Contexto: o compositor já escreveu o seguinte antes desta gravação:\n${existing_text}\n\nAgora transcreva APENAS o novo áudio acima. Não repita o texto existente.`
      : "Transcreva o áudio acima no formato ChordPro.";

    console.log("Sending audio to Gemini, mime:", audioMime, "base64 length:", audio_base64.length);

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: audioMime, data: audio_base64 } },
            { text: userText },
          ],
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
          JSON.stringify({ error: "Limite de requisições excedido. Tente novamente." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error("Gemini transcription service unavailable");
    }

    const aiData = await aiResponse.json();
    const rawContent: string =
      aiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    console.log("Raw Gemini response:", rawContent.substring(0, 200));

    let transcription = "";
    let detected_key: string | null = null;
    try {
      const cleanJson = rawContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      const parsed = JSON.parse(cleanJson);
      transcription = parsed.transcription?.trim() ?? "";
      detected_key = parsed.detected_key || null;
    } catch {
      console.log("Could not parse JSON, using raw text as transcription");
      transcription = rawContent;
    }

    console.log("Transcription result:", transcription.substring(0, 100), "Detected key:", detected_key);

    return new Response(
      JSON.stringify({ transcription, detected_key }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("transcribe-composition error:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao transcrever o áudio. Tente novamente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
