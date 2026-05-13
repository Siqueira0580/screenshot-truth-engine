import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MAX_PDF_SIZE = 5 * 1024 * 1024; // 5 MB

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'File must be a PDF' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (file.size > MAX_PDF_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Arquivo muito grande. Máximo permitido: 5MB.' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert PDF to base64
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binary);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Você é um extrator rigoroso de cifras musicais. Converta o conteúdo do PDF para o formato ChordPro estruturado.

REGRAS ABSOLUTAS (PENALIDADE SE DESCUMPRIDAS):

1. TOM (KEY): Procure no documento qual é o Tom/Tonalidade original da música (ex: Tom: G, Key: F#m) e coloque EXATAMENTE esse valor na chave 'musical_key'. Se não achar explicitamente, tente deduzir pelo primeiro/último acorde, mas SEMPRE preencha a chave.

2. INTRODUÇÕES E SOLOS: Se houver uma linha apenas com acordes (como na Introdução ou Solo), VOCÊ DEVE PRESERVAR TODOS OS ESPAÇOS EM BRANCO entre eles. Exemplo: Se no original for 'C      F      G', você DEVE retornar '[C]      [F]      [G]'. NÃO comprima os espaços, eles representam o tempo da música.

3. SEÇÕES: Preserve TODOS os marcadores de estrutura da música que encontrar, como 'Intro:', '[Refrão]', 'Solo:', '[Verso]', 'Ponte:', etc. NÃO OS APAGUE. Se existirem no PDF fonte, mantenha-os integralmente.

4. ALINHAMENTO COM A LETRA: Desça os acordes da linha de cima para a linha de baixo (formato ChordPro). O acorde entre colchetes [Acorde] DEVE ser inserido na coluna EXATA onde estava posicionado. Se o acorde estiver posicionado antes da primeira palavra da linha, adicione espaços em branco antes da palavra para manter o alinhamento físico.

5. FIDELIDADE EXTREMA: NÃO adicione, NÃO remova e NÃO altere nenhum acorde ou palavra da letra original. NÃO tente corrigir gramática ou harmonia.

Retorne APENAS um JSON válido com esta estrutura:
{
  "title": "título da música",
  "artist": "nome do artista/intérprete",
  "composer": "nome do(s) compositor(es)",
  "musical_key": "tom (ex: C, Am, F#m)",
  "style": "gênero musical ou null",
  "bpm": null,
  "time_signature": "compasso se encontrado (ex: 4/4) ou null",
  "body_text": "cifra ChordPro fiel ao original com acordes em colchetes inline",
  "chordpro_text": "mesmo conteúdo ChordPro acima"
}
Se um campo não for encontrado, use null.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Extract all song information from this PDF chord sheet. Return only the JSON object.' },
              { type: 'image_url', image_url: { url: `data:application/pdf;base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.0,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI Gateway error:', aiResponse.status, errText);
      let status = 500;
      let message = 'Falha ao processar o PDF com a IA. Tente novamente.';
      if (aiResponse.status === 429) {
        status = 429;
        message = 'Muitas requisições à IA em pouco tempo. Aguarde cerca de 1 minuto antes de tentar processar este PDF novamente. Se o erro persistir, espere de 5 a 10 minutos.';
      } else if (aiResponse.status === 402) {
        status = 402;
        message = 'Os créditos de IA do workspace acabaram. Adicione saldo em Configurações → Plans & Credits (ou Workspace → Cloud & AI balance) na sua conta Lovable e tente novamente.';
      }
      return new Response(
        JSON.stringify({ error: message }),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';


    // Robust JSON extraction: strip code fences, then slice from first { to last }
    let parsed;
    try {
      let jsonStr = content
        .replace(/```json\s*/gi, '')
        .replace(/```/g, '')
        .trim();
      const first = jsonStr.indexOf('{');
      const last = jsonStr.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        jsonStr = jsonStr.slice(first, last + 1);
      }
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('Failed to parse Gemini response:', content);
      return new Response(
        JSON.stringify({ error: 'Não foi possível interpretar a resposta da IA. Tente novamente.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('PDF parse error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to parse PDF' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
