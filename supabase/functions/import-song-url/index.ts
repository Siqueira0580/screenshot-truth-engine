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
    // ── Authenticate the caller ─────────────────────────────────
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

    // ── Validate URL: only HTTPS and allowed hosts ──────────────
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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
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

    // Step A.1: Pre-extract structured metadata from HTML before stripping
    let youtubeUrl: string | null = null;
    const ytMatch = html.match(/iframe[^>]+src=["']([^"']*youtube\.com\/embed\/[^"']+)["']/i);
    if (ytMatch) {
      const embedUrl = ytMatch[1];
      const videoIdMatch = embedUrl.match(/embed\/([a-zA-Z0-9_-]+)/);
      youtubeUrl = videoIdMatch ? `https://www.youtube.com/watch?v=${videoIdMatch[1]}` : embedUrl;
      console.log("YouTube URL found:", youtubeUrl);
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

    // Step B: AI Processing
    console.log("Sending to AI for ChordPro extraction...");
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um formatador de texto especializado no padrão ChordPro. Eu vou fornecer-lhe o texto bruto extraído de uma página da web de cifras.
A sua ÚNICA tarefa é encontrar a letra e os acordes DENTRO DESTE TEXTO FORNECIDO e formatá-los para ChordPro (ex: [Am]Sílaba).

Extraia também:
- Título da música
- Nome do Artista
- Gênero Musical (ex: Samba, Rock, MPB, Pop, Gospel, Forró, Sertanejo, Bossa Nova)
- Tom (Key) da música (ex: "G", "Am", "C#m") — procure por indicações como "Tom:", "Key:", ou o tom mencionado no texto
- Compositor(es) — procure por "Composição:", "Compositor:", "Songwriters:" no texto
- BPM se mencionado

REGRA ABSOLUTA: NÃO invente acordes. NÃO adicione trechos de música que não estejam no texto bruto fornecido. Use APENAS os dados presentes no texto.
Se um campo não for encontrado no texto, retorne null para ele.
Se o texto bruto não contiver uma cifra musical válida, retorne ESTRITAMENTE o JSON: {"error": "Nenhuma cifra encontrada neste link."}`,
          },
          {
            role: "user",
            content: `Extraia a cifra e metadados deste texto de site:\n\n${truncated}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_song",
              description: "Extract song data from scraped text into structured ChordPro format with full metadata",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Song title" },
                  artist: { type: "string", description: "Artist name" },
                  genre: { type: "string", description: "Musical genre (e.g. Rock, MPB, Sertanejo)" },
                  musical_key: { type: ["string", "null"], description: "Musical key/tom (e.g. G, Am, C#m)" },
                  composer: { type: ["string", "null"], description: "Composer(s) name(s)" },
                  bpm: { type: ["number", "null"], description: "BPM if found" },
                  content: { type: "string", description: "Full song in ChordPro format" },
                },
                required: ["title", "artist", "genre", "content"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_song" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResp.text();
      console.error("AI error:", aiResp.status, errText);
      throw new Error("Erro na IA ao processar a cifra");
    }

    const aiData = await aiResp.json();

    let result: { title: string; artist: string; genre: string; content: string; musical_key?: string | null; composer?: string | null; bpm?: number | null };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const raw = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("IA não retornou dados estruturados");
      }
      result = JSON.parse(jsonMatch[0]);
    }

    const finalMusicalKey = htmlMusicalKey || result.musical_key || null;
    const finalComposer = htmlComposer || result.composer || null;
    const finalYoutubeUrl = youtubeUrl || null;

    console.log("Extracted:", result.title, "-", result.artist, "| Key:", finalMusicalKey, "| Composer:", finalComposer, "| YouTube:", finalYoutubeUrl);

    // Step C: Fetch artist image from Deezer
    let artist_image_url: string | null = null;
    if (result.artist) {
      try {
        console.log("Fetching artist image from Deezer for:", result.artist);
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
            console.log("Deezer artist image found:", artist_image_url);
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
