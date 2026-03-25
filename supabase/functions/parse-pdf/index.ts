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

    const systemPrompt = `You are a music sheet parser. Extract structured information from music PDFs (chord sheets, cifras, lyrics).
Return ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "song title",
  "artist": "artist/performer name",
  "composer": "composer(s) name(s)",
  "musical_key": "musical key (e.g. C, Am, F#m)",
  "style": "music style/genre if identifiable, or null",
  "bpm": null,
  "time_signature": "time signature if found, e.g. 4/4, or null",
  "body_text": "the full lyrics with chord annotations preserved, formatted as plain text with chords above lyrics lines.",
  "chordpro_text": "the full lyrics in ChordPro format with chords inline in brackets, e.g. [C]Letra da [Am]música"
}
Rules:
- For body_text: reconstruct the lyrics with chords ABOVE the corresponding lyrics.
- For chordpro_text: place each chord in square brackets immediately before the syllable it belongs to.
- Keep all chord names exactly as they appear.
- Write lyrics in their original language (Portuguese).
- If a field is not found, use null.
- Do NOT include chord diagrams, tablatures, or tuning info in body_text.`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;

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
        generationConfig: { temperature: 0.1 },
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
