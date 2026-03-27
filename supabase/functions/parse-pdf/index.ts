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

    const GEMINI_API_KEY = Deno.env.get('VITE_GEMINI_API_KEY');
    if (!GEMINI_API_KEY) {
      throw new Error('VITE_GEMINI_API_KEY not configured');
    }

    const systemPrompt = `Você é um extrator e conversor de cifras rigoroso. Sua ÚNICA função é converter a cifra do PDF para o formato ChordPro sem alterar absolutamente NADA do conteúdo.

REGRAS ABSOLUTAS (PENALIDADE SE DESCUMPRIDAS):
1. FIDELIDADE EXTREMA: NÃO adicione, NÃO remova e NÃO altere nenhum acorde ou palavra da letra original.
2. POSIÇÃO PRECISA: Se a cifra original estiver no formato tradicional (acordes na linha de cima), você DEVE descer o acorde para a linha de baixo colocando-o entre colchetes ([Acorde]) EXATAMENTE na mesma posição (coluna/sílaba) onde ele estava alinhado originalmente.
3. ZERO INVENÇÃO: NÃO adicione marcações de [Refrão], [Intro] ou [Verso] se não existirem no PDF fonte. NÃO tente corrigir gramática ou harmonia.
4. ESPAÇAMENTOS: Mantenha as quebras de linha exatas.

Retorne APENAS um JSON válido (sem markdown, sem code blocks) com esta estrutura:
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: base64 } },
            { text: 'Extract all song information from this PDF chord sheet. Return only the JSON object.' },
          ],
        }],
        generationConfig: { temperature: 0.0, topK: 1, topP: 0.1 },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('Gemini error:', aiResponse.status, errText);
      throw new Error('AI processing failed');
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || '';

    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse Gemini response:', content);
      return new Response(
        JSON.stringify({ text: content }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
