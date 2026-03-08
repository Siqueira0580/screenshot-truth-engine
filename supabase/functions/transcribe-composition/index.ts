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

    // Determine the MIME type for the audio
    const audioMime = mime_type || "audio/webm";

    const systemPrompt = `Você é um transcritor musical profissional especializado em música brasileira.
O usuário vai enviar um áudio gravado de voz (cantando ou falando uma composição musical).
Sua tarefa é:
1. Transcrever EXATAMENTE o que foi dito/cantado no áudio, em português brasileiro.
2. Se possível, identificar as notas/acordes que estão sendo cantados e adicioná-los no formato ChordPro (ex: [G]palavra [Am]outra).
3. Se não conseguir identificar acordes com certeza, retorne apenas o texto transcrito SEM colchetes.
4. Mantenha quebras de linha naturais para versos.
5. Se o áudio estiver vazio ou inaudível, retorne uma string vazia.
${style ? `6. O estilo musical é: ${style}. Use isso como contexto para harmonização.` : ""}

FORMATO DE RESPOSTA OBRIGATÓRIO — responda APENAS com um JSON válido, sem markdown, sem explicações:
{"transcription": "texto transcrito aqui com [Acordes] se detectados", "detected_key": "tom detectado ou null"}

Para detected_key: analise a progressão de acordes que você inseriu e deduza o tom real (ex: se usou [G], [Em], [C], [D] → detected_key: "G"). Se não inseriu acordes, retorne null.`;

    // Build the user message with inline audio data for Gemini
    const userContent: any[] = [
      {
        type: "image_url",
        image_url: {
          url: `data:${audioMime};base64,${audio_base64}`,
        },
      },
      {
        type: "text",
        text: existing_text
          ? `Contexto: o compositor já escreveu o seguinte antes desta gravação:\n${existing_text}\n\nAgora transcreva APENAS o novo áudio acima. Não repita o texto existente.`
          : "Transcreva o áudio acima no formato ChordPro.",
      },
    ];

    console.log("Sending audio to AI gateway, mime:", audioMime, "base64 length:", audio_base64.length);

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
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error [${status}]: ${body}`);
    }

    const aiData = await aiResponse.json();
    const transcription: string =
      aiData.choices?.[0]?.message?.content?.trim() ?? "";

    console.log("Transcription result:", transcription.substring(0, 100));

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
