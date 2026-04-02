import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_HOSTS = [
  "cifraclub.com.br",
  "www.cifraclub.com.br",
  "letras.mus.br",
  "www.letras.mus.br",
  "ultimate-guitar.com",
  "www.ultimate-guitar.com",
  "tabs.ultimate-guitar.com",
  "cifras.com.br",
  "www.cifras.com.br",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: userData, error: userError } = await userSupabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new Response(JSON.stringify({ error: "URL inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsedUrl.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Apenas URLs HTTPS são permitidas" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!ALLOWED_HOSTS.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith("." + h))) {
      return new Response(
        JSON.stringify({ error: "Domínio não permitido. Use links do CifraClub, Letras, Ultimate Guitar ou Cifras." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const GEMINI_API_KEY = Deno.env.get("VITE_GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      throw new Error("VITE_GEMINI_API_KEY is not configured");
    }

    // Step A: Scrape the page
    console.log("Fetching URL:", url);
    const pageResp = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!pageResp.ok) {
      return new Response(
        JSON.stringify({ error: `Não foi possível acessar a URL (status ${pageResp.status})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = await pageResp.text();

    // Step A.1: Pre-extract structured metadata from HTML
    let youtubeUrl: string | null = null;
    const ytMatch = html.match(/iframe[^>]+src=["']([^"']*youtube\.com\/embed\/[^"']+)["']/i);
    if (ytMatch) {
      const embedUrl = ytMatch[1];
      const videoIdMatch = embedUrl.match(/embed\/([a-zA-Z0-9_-]+)/);
      youtubeUrl = videoIdMatch ? `https://www.youtube.com/watch?v=${videoIdMatch[1]}` : embedUrl;
    }

    let htmlMusicalKey: string | null = null;
    const keyPatterns = [
      /<a[^>]*id=["']?cifra_tom["']?[^>]*>([^<]+)<\/a>/i,
      /<[^>]*class=["'][^"']*cifra[_-]?tom[^"']*["'][^>]*>([^<]+)/i,
      /Tom:\s*<[^>]*>([A-G][#b]?m?\s*)/i,
      /Tom:\s*([A-G][#b]?m?)\b/i,
    ];
    for (const pat of keyPatterns) {
      const m = html.match(pat);
      if (m) { htmlMusicalKey = m[1].trim(); break; }
    }

    let htmlComposer: string | null = null;
    const composerPatterns = [
      /<[^>]*class=["'][^"']*compositor[^"']*["'][^>]*>([^<]+)/i,
      /Composi[çc][ãa]o:\s*([^<\n]+)/i,
      /Compositor(?:es)?:\s*([^<\n]+)/i,
    ];
    for (const pat of composerPatterns) {
      const m = html.match(pat);
      if (m) { htmlComposer = m[1].trim(); break; }
    }

    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#\d+;/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const truncated = stripped.slice(0, 8000);

    // Step B: Gemini AI Processing
    console.log("Sending to Gemini for ChordPro extraction...");

    const systemPrompt = `Você é um extrator rigoroso de cifras musicais. Converta o texto/HTML fornecido para o formato ChordPro estruturado.

REGRAS ABSOLUTAS (PENALIDADE SE DESCUMPRIDAS):

1. TOM (KEY): Procure no início do documento qual é o Tom/Tonalidade original da música (ex: Tom: G, Key: F#m) e coloque EXATAMENTE esse valor na chave 'musical_key'. Se não achar explicitamente, tente deduzir pelo primeiro/último acorde, mas SEMPRE preencha a chave.

2. INTRODUÇÕES E SOLOS: Se houver uma linha apenas com acordes (como na Introdução ou Solo), VOCÊ DEVE PRESERVAR TODOS OS ESPAÇOS EM BRANCO entre eles. Exemplo: Se no original for 'C      F      G', você DEVE retornar '[C]      [F]      [G]'. NÃO comprima os espaços, eles representam o tempo da música.

3. SEÇÕES: Preserve TODOS os marcadores de estrutura da música que encontrar, como 'Intro:', '[Refrão]', 'Solo:', '[Verso]', 'Ponte:', etc. NÃO OS APAGUE. Se existirem no texto fonte, mantenha-os integralmente.

4. ALINHAMENTO COM A LETRA: Desça os acordes da linha de cima para a linha de baixo (formato ChordPro). O acorde entre colchetes [Acorde] DEVE ser inserido na coluna EXATA onde estava posicionado. Se o acorde estiver posicionado antes da primeira palavra da linha, adicione espaços em branco antes da palavra para manter o alinhamento físico.

5. FIDELIDADE EXTREMA: NÃO adicione, NÃO remova e NÃO altere nenhum acorde ou palavra da letra original. NÃO tente corrigir gramática ou harmonia.

Extraia também: Título, Artista, Gênero Musical, Tom, Compositor(es), BPM (se mencionado).
Se um campo não for encontrado, retorne null.
Se o texto bruto não contiver uma cifra musical válida, retorne ESTRITAMENTE o JSON: {"error": "Nenhuma cifra encontrada neste link."}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

    const aiResp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{
          role: "user",
          parts: [{ text: `Extraia a cifra e metadados deste texto de site:\n\n${truncated}` }],
        }],
        tools: [{
          functionDeclarations: [{
            name: "extract_song",
            description: "Extract song data from scraped text into structured ChordPro format with full metadata",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Song title" },
                artist: { type: "string", description: "Artist name" },
                genre: { type: "string", description: "Musical genre (e.g. Rock, MPB, Sertanejo)" },
                musical_key: { type: "string", description: "Musical key/tom da música original (e.g. G, Am, C#m). SEMPRE preencha, deduzindo se necessário." },
                composer: { type: "string", description: "Composer(s) name(s)", nullable: true },
                bpm: { type: "number", description: "BPM if found", nullable: true },
                content: { type: "string", description: "Full song in ChordPro format. Preserve ALL whitespace between chords in intro/solo lines and ALL section markers (Intro:, [Refrão], Solo:, etc.)" },
              },
              required: ["title", "artist", "genre", "musical_key", "content"],
            },
          }],
        }],
        toolConfig: {
          functionCallingConfig: {
            mode: "ANY",
            allowedFunctionNames: ["extract_song"],
          },
        },
        generationConfig: { temperature: 0.0, topK: 1, topP: 0.1 },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("Gemini error:", aiResp.status, errText);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Erro na IA ao processar a cifra");
    }

    const aiData = await aiResp.json();

    let result: { title: string; artist: string; genre: string; content: string; musical_key?: string | null; composer?: string | null; bpm?: number | null };

    const functionCall = aiData.candidates?.[0]?.content?.parts?.[0]?.functionCall;
    if (functionCall?.args) {
      result = functionCall.args;
    } else {
      const rawText = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("IA não retornou dados estruturados");
      }
      result = JSON.parse(jsonMatch[0]);
    }

    const finalMusicalKey = htmlMusicalKey || result.musical_key || null;
    const finalComposer = htmlComposer || result.composer || null;
    const finalYoutubeUrl = youtubeUrl || null;

    console.log("Extracted:", result.title, "-", result.artist, "| Key:", finalMusicalKey);

    // Step C: Fetch artist image from Deezer
    let artist_image_url: string | null = null;
    if (result.artist) {
      try {
        const deezerRes = await fetch(
          "https://api.deezer.com/search/artist?q=" + encodeURIComponent(result.artist)
        );
        if (deezerRes.ok) {
          const deezerData = await deezerRes.json();
          if (deezerData?.data?.length > 0) {
            artist_image_url =
              deezerData.data[0].picture_xl ||
              deezerData.data[0].picture_big ||
              deezerData.data[0].picture_medium ||
              null;
          }
        }
      } catch (deezerErr) {
        console.warn("Deezer fetch failed (non-critical):", deezerErr);
      }
    }

    return new Response(JSON.stringify({
      ...result,
      musical_key: finalMusicalKey,
      composer: finalComposer,
      youtube_url: finalYoutubeUrl,
      bpm: result.bpm || null,
      artist_image_url,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-song-url error:", e);
    return new Response(
      JSON.stringify({ error: "Failed to process song URL. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
