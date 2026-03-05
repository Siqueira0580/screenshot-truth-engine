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

    // Convert PDF to base64 for AI processing
    const arrayBuffer = await file.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Use Lovable AI to extract structured data from the PDF
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
            content: `You are a music sheet parser. Extract structured information from music PDFs (chord sheets, cifras, lyrics).
Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "song title",
  "artist": "artist/performer name",
  "composer": "composer(s) name(s)",
  "musical_key": "musical key (e.g. C, Am, F#m)",
  "style": "music style/genre if identifiable, or null",
  "bpm": null,
  "time_signature": "time signature if found, e.g. 4/4, or null",
  "body_text": "the full lyrics with chord annotations preserved, formatted as plain text with chords above lyrics lines. Each chord line followed by its lyric line. Use line breaks."
}
Rules:
- For body_text: reconstruct the lyrics with chords ABOVE the corresponding lyrics, one chord line then one lyric line, separated by newlines.
- Keep all chord names exactly as they appear (e.g. F7M, C7(9), Gm6).
- Write lyrics in their original language (Portuguese).
- If a field is not found, use null.
- Do NOT include chord diagrams, tablatures, or tuning info in body_text.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'file',
                file: {
                  filename: file.name,
                  file_data: `data:application/pdf;base64,${base64}`,
                },
              },
              {
                type: 'text',
                text: 'Extract all song information from this PDF chord sheet. Return only the JSON object.',
              },
            ],
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI Gateway error:', errText);
      throw new Error('AI processing failed');
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || '';

    // Parse the JSON from AI response (handle potential markdown wrapping)
    let parsed;
    try {
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('Failed to parse AI response:', content);
      // Fallback: return raw text
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
