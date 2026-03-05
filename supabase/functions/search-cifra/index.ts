import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
            content: `You are a Brazilian music chord sheet (cifra) expert. Given a song name (and optionally artist), generate the complete cifra with chords and lyrics in Portuguese.

Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "song title",
  "artist": "artist/performer name",
  "composer": "composer(s) if known, or null",
  "musical_key": "musical key (e.g. C, Am, F#m)",
  "style": "music style/genre (e.g. Samba, Pagode, MPB, Sertanejo)",
  "bpm": estimated BPM as number or null,
  "time_signature": "time signature e.g. 4/4",
  "body_text": "the full lyrics with chord annotations. Format: chord line above lyric line, separated by newlines. Use standard chord notation (Am, F7M, G7, etc)."
}

Rules:
- Write lyrics in Portuguese (original language).
- Place chords ABOVE the corresponding lyrics on separate lines.
- Use standard Brazilian cifra chord notation.
- If you're not sure about the exact chords, provide your best approximation.
- Include all verses, choruses, bridges.
- If the song is not found or unknown, set title to null.`
          },
          {
            role: 'user',
            content: `Gere a cifra completa para: ${query}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!aiResponse.ok) {
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
        JSON.stringify({ error: 'Não foi possível gerar a cifra. Tente com mais detalhes.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!parsed.title) {
      return new Response(
        JSON.stringify({ error: 'Música não encontrada. Tente incluir o nome do artista.' }),
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
