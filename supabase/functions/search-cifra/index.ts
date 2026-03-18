import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth Guard ---
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

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // --- End Auth Guard ---

    const { query } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are a Brazilian music chord sheet (cifra) expert. Given a song name (and optionally artist), you MUST search the web for the real, accurate cifra from trusted sources like Cifra Club, Letras.mus.br, or Ultimate Guitar.

CRITICAL RULES:
1. You MUST base your response on real chord data found on the internet. Do NOT invent or hallucinate chords.
2. If you cannot find the exact song or are not confident about the accuracy of the chords, return: {"error": "Música não encontrada. Por favor, cole o link direto da cifra para garantir a precisão."}
3. Always prefer the most popular/verified version of the cifra.

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "song title",
  "artist": "artist/performer name",
  "composer": "composer(s) if known, or null",
  "musical_key": "musical key (e.g. C, Am, F#m)",
  "style": "music style/genre (e.g. Samba, Pagode, MPB, Sertanejo)",
  "bpm": estimated BPM as number or null,
  "time_signature": "time signature e.g. 4/4",
  "body_text": "the full lyrics with chord annotations in ChordPro format. Place chords inside brackets before the syllable they belong to, e.g. [Am]Hoje eu [G]sei. Include all verses, choruses, bridges.",
  "source_url": "URL of the source where you found the cifra, or null"
}

Rules for body_text format:
- Use ChordPro format: chords in [brackets] inline with lyrics
- Use standard Brazilian cifra chord notation (Am, F7M, G7, etc).
- Include section markers like {title: Intro}, {comment: Refrão}, etc.
- Include ALL verses, choruses, bridges.`
          },
          {
            role: 'user',
            content: `Busque na internet a cifra completa e precisa para: ${query}`,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione créditos ao workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errText = await aiResponse.text();
      console.error('AI Gateway error:', errText);
      throw new Error('AI processing failed');
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ error: 'Não foi possível encontrar a cifra. Tente colar o link direto do site de cifras.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (parsed.error) {
      return new Response(
        JSON.stringify({ error: parsed.error }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsed.title) {
      return new Response(
        JSON.stringify({ error: 'Música não encontrada. Tente incluir o nome do artista ou cole o link direto.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Search cifra error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro ao buscar cifra' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
