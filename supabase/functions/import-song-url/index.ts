import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- HTML Metadata Extraction Helpers ---

function extractMeta(html: string, name: string): string | null {
  // Try og: and regular meta tags
  for (const attr of ["property", "name"]) {
    const re = new RegExp(`<meta\\s+${attr}=["']${name}["']\\s+content=["']([^"']+)["']`, "i");
    const m = html.match(re);
    if (m) return m[1].trim();
    // reversed order
    const re2 = new RegExp(`<meta\\s+content=["']([^"']+)["']\\s+${attr}=["']${name}["']`, "i");
    const m2 = html.match(re2);
    if (m2) return m2[1].trim();
  }
  return null;
}

function extractMusicalKey(html: string): string | null {
  // Cifra Club: <span class="cifra-tom">Tom: <a>G</a></span> or #cifra_tom
  const patterns = [
    /<(?:span|div)[^>]*(?:id=["']cifra_tom["']|class=["'][^"']*cifra[_-]?tom[^"']*["'])[^>]*>[\s\S]*?<a[^>]*>([A-G][#b♯♭]?m?)<\/a>/i,
    /(?:Tom|Key|Tonalidade)\s*:\s*<[^>]*>([A-G][#b♯♭]?m?(?:\/[A-G][#b♯♭]?)?)<\/[^>]*>/i,
    /(?:Tom|Key|Tonalidade)\s*:\s*([A-G][#b♯♭]?m?)/i,
    /data-tom=["']([A-G][#b♯♭]?m?)["']/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return null;
}

function extractComposers(html: string): string | null {
  const patterns = [
    /<(?:span|div|p)[^>]*class=["'][^"']*compositor[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/i,
    /(?:Composi[çc][ãa]o|Compositor(?:es)?|Songwriter|Written\s+by)\s*:\s*([^<\n]+)/i,
    /<(?:span|div|p)[^>]*class=["'][^"']*info-compositor[^"']*["'][^>]*>([\s\S]*?)<\/(?:span|div|p)>/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) {
      const val = m[1].replace(/<[^>]+>/g, "").trim();
      if (val.length > 0 && val.length < 300) return val;
    }
  }
  return null;
}

function extractStyle(html: string): string | null {
  // Try breadcrumbs
  const breadcrumbMatch = html.match(/<(?:nav|ol|ul)[^>]*class=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|ol|ul)>/i);
  if (breadcrumbMatch) {
    const links = [...breadcrumbMatch[1].matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)];
    const genres = ["Rock", "Pop", "MPB", "Sertanejo", "Gospel", "Forró", "Samba", "Pagode", "Bossa Nova", "Axé", "Reggae", "Blues", "Jazz", "Country", "Funk", "R&B", "Hip Hop", "Rap", "Metal", "Punk", "Indie", "Folk", "Soul", "Eletrônica", "EDM"];
    for (const link of links) {
      const text = link[1].replace(/<[^>]+>/g, "").trim();
      for (const g of genres) {
        if (text.toLowerCase().includes(g.toLowerCase())) return g;
      }
    }
  }
  // Try category/genre meta or tags
  const genreMeta = extractMeta(html, "music:genre") || extractMeta(html, "genre");
  if (genreMeta) return genreMeta;
  // Try data-style or genre class
  const styleMatch = html.match(/(?:Estilo|Gênero|Genre|Categoria)\s*:\s*([^<\n,]+)/i);
  if (styleMatch) return styleMatch[1].trim();
  return null;
}

function extractYouTubeUrl(html: string): string | null {
  // Embedded iframe
  const iframeMatch = html.match(/<iframe[^>]*src=["'](https?:\/\/(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]+)[^"']*)["']/i);
  if (iframeMatch) {
    return `https://www.youtube.com/watch?v=${iframeMatch[2]}`;
  }
  // data-video or youtube link in page
  const dataMatch = html.match(/data-(?:video|youtube)(?:-id)?=["']([a-zA-Z0-9_-]{11})["']/i);
  if (dataMatch) {
    return `https://www.youtube.com/watch?v=${dataMatch[1]}`;
  }
  // Direct youtube watch link
  const linkMatch = html.match(/href=["'](https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*)["']/i);
  if (linkMatch) {
    return `https://www.youtube.com/watch?v=${linkMatch[2]}`;
  }
  return null;
}

function extractTitleArtist(html: string): { title: string | null; artist: string | null } {
  // Try OG title first (usually "Música - Artista")
  const ogTitle = extractMeta(html, "og:title");
  if (ogTitle) {
    const parts = ogTitle.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      return { title: parts[0].trim(), artist: parts[1].trim() };
    }
  }
  // Try <title> tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    const cleaned = titleMatch[1].replace(/\s*\|.*$/, "").replace(/\s*-\s*Cifra.*$/i, "").trim();
    const parts = cleaned.split(/\s*[-–—]\s*/);
    if (parts.length >= 2) {
      return { title: parts[0].trim(), artist: parts[1].trim() };
    }
  }
  return { title: null, artist: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    // Step A2: Extract structured metadata from raw HTML before stripping
    const domMeta = {
      musical_key: extractMusicalKey(html),
      composer: extractComposers(html),
      style: extractStyle(html),
      youtube_url: extractYouTubeUrl(html),
      ...extractTitleArtist(html),
    };
    console.log("DOM-extracted metadata:", JSON.stringify(domMeta));

    // Step A3: Smart chord extraction — convert <b> chord tags to [chord] brackets
    // before stripping HTML, to preserve alignment for ChordPro format.
    // Cifra Club uses <b>Chord</b> inside <pre> blocks.
    let processedHtml = html;
    
    // First, try to isolate the <pre> content (where chords+lyrics live)
    const preMatch = processedHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
    let preExtracted = "";
    
    if (preMatch) {
      let preContent = preMatch[1];
      // Remove hidden spans, tablature divs, and irrelevant elements
      preContent = preContent.replace(/<span[^>]*style=["'][^"']*display\s*:\s*none[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "");
      preContent = preContent.replace(/<div[^>]*class=["'][^"']*tablatura[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, "");
      // Convert <b> tags (chords) to [Chord] bracket notation
      preContent = preContent.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "[$1]");
      // Convert <strong> tags too (some sites use these)
      preContent = preContent.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "[$1]");
      // Replace <br> with newlines
      preContent = preContent.replace(/<br\s*\/?>/gi, "\n");
      // Strip remaining HTML tags but preserve text and spaces
      preContent = preContent.replace(/<[^>]+>/g, "");
      // Decode HTML entities
      preContent = preContent.replace(/&nbsp;/g, " ");
      preContent = preContent.replace(/&amp;/g, "&");
      preContent = preContent.replace(/&lt;/g, "<");
      preContent = preContent.replace(/&gt;/g, ">");
      preContent = preContent.replace(/&#\d+;/g, "");
      // Normalize excessive blank lines but PRESERVE horizontal spaces
      preContent = preContent.replace(/\n\s*\n\s*\n/g, "\n\n");
      preExtracted = preContent.trim();
    }

    // Also create a general stripped version for AI context (metadata, etc.)
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

    // If we extracted a <pre> block with bracketed chords, prioritize it
    // Otherwise fall back to the stripped version
    const contentForAI = preExtracted || stripped;
    // Limit to ~8000 chars to stay within token limits
    const truncated = contentForAI.slice(0, 8000);

    // Step B: AI Processing (enhanced prompt with extra fields)
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
Extraia também: Título, Artista, Gênero Musical (ex: Samba, Rock, MPB, Pop, Gospel, Forró, Sertanejo, Bossa Nova), Tom da música (ex: G, Am, C#m), Compositor(es) e link do YouTube se presente.

REGRA ABSOLUTA: NÃO invente acordes. NÃO adicione trechos de música que não estejam no texto bruto fornecido. Use APENAS os dados presentes no texto.
Se o texto bruto não contiver uma cifra musical válida (ex: página de erro, notícias, ou conteúdo sem acordes), retorne ESTRITAMENTE o JSON: {"error": "Nenhuma cifra encontrada neste link."}

Retorne ESTRITAMENTE um JSON válido com as chaves: "title", "artist", "genre", "musical_key", "composer", "youtube_url", "content" (a cifra formatada em ChordPro).
Não inclua nenhum texto fora do JSON. Não use markdown code blocks.`,
          },
          {
            role: "user",
            content: `Extraia a cifra deste texto de site. ${preExtracted ? "Os acordes já estão entre colchetes [Acorde]. Preserve EXATAMENTE os espaços horizontais e a formatação original. NÃO re-alinhe os acordes." : ""}\n\n${truncated}`,
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
                  genre: { type: "string", description: "Musical genre/style" },
                  musical_key: { type: "string", description: "Musical key/tone (e.g. G, Am, C#m)" },
                  composer: { type: "string", description: "Composer(s) name(s)" },
                  youtube_url: { type: "string", description: "YouTube video URL if found" },
                  content: { type: "string", description: "Full song in ChordPro format" },
                },
                required: ["title", "artist", "genre", "content"],
                additionalProperties: false,
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

    // Extract from tool call response
    let result: {
      title: string;
      artist: string;
      genre: string;
      content: string;
      musical_key?: string;
      composer?: string;
      youtube_url?: string;
    };
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

    // Step B2: Merge — DOM-extracted metadata takes priority as ground truth, AI fills gaps
    const merged = {
      title: result.title || domMeta.title || "Sem título",
      artist: result.artist || domMeta.artist || null,
      genre: result.genre || domMeta.style || null,
      content: result.content || "",
      musical_key: domMeta.musical_key || result.musical_key || null,
      composer: domMeta.composer || result.composer || null,
      youtube_url: domMeta.youtube_url || result.youtube_url || null,
      source_url: url,
    };

    console.log("Merged result:", merged.title, "-", merged.artist, "| Key:", merged.musical_key, "| Composer:", merged.composer, "| YT:", merged.youtube_url);

    // Step C: Fetch artist image from Deezer
    let artist_image_url: string | null = null;
    if (merged.artist) {
      try {
        console.log("Fetching artist image from Deezer for:", merged.artist);
        const deezerRes = await fetch(
          "https://api.deezer.com/search/artist?q=" + encodeURIComponent(merged.artist)
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

    return new Response(JSON.stringify({ ...merged, artist_image_url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("import-song-url error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
