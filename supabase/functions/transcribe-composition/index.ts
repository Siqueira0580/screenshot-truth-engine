import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

    const { audio_base64, mime_type, style, existing_text } = await req.json();

    if (!audio_base64) {
      return new Response(
        JSON.stringify({ error: "O campo 'audio_base64' é obrigatório." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt = `Você é um transcritor musical profissional.
O usuário vai enviar um áudio gravado de voz (cantando ou falando uma composição musical).
Sua tarefa é:
1. Transcrever EXATAMENTE o que foi dito/cantado no áudio.
2. Se possível, identificar as notas/acordes que estão sendo cantados e adicioná-los no formato ChordPro (ex: [G]palavra [Am]outra).
3. Se não conseguir identificar acordes com certeza, retorne apenas o texto transcrito SEM colchetes.
4. Retorne APENAS o texto transcrito (com ou sem acordes). SEM explicações, comentários ou metadados.
5. Mantenha quebras de linha naturais para versos.
${style ? `6. O estilo musical é: ${style}. Use isso como contexto para harmonização se identificar notas.` : ""}`;

    const userContent: any[] = [
      {
        type: "input_audio",
        input_audio: {
          data: audio_base64,
          format: mime_type?.includes("webm") ? "webm" : "wav",
        },
      },
    ];

    if (existing_text) {
      userContent.push({
        type: "text",
        text: `Contexto: o compositor já escreveu o seguinte antes desta gravação:\n${existing_text}\n\nAgora transcreva APENAS o novo áudio acima. Não repita o texto existente.`,
      });
    }

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
          { role: "user", content: userContent },
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
      throw new Error(`AI gateway error [${status}]`);
    }

    const aiData = await aiResponse.json();
    const transcription: string =
      aiData.choices?.[0]?.message?.content?.trim() ?? "";

    return new Response(
      JSON.stringify({ transcription }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("transcribe-composition error:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
