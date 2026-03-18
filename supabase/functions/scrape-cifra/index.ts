import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ok = (body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function extractChordContent(html: string) {
  let title = "";
  const titleMatch = html.match(/<h1[^>]*class="[^"]*t1[^"]*"[^>]*>(.*?)<\/h1>/is)
    || html.match(/<h1[^>]*>(.*?)<\/h1>/is);
  if (titleMatch) title = titleMatch[1].replace(/<[^>]+>/g, "").trim();

  let artist = "";
  const artistMatch = html.match(/<h2[^>]*class="[^"]*t3[^"]*"[^>]*>(.*?)<\/h2>/is)
    || html.match(/<span[^>]*class="[^"]*art_name[^"]*"[^>]*>(.*?)<\/span>/is)
    || html.match(/<a[^>]*class="[^"]*art_name[^"]*"[^>]*>(.*?)<\/a>/is);
  if (artistMatch) artist = artistMatch[1].replace(/<[^>]+>/g, "").trim();

  let content = "";
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
  if (preMatch) {
    content = preMatch[1];
  } else {
    const divMatch = html.match(/<div[^>]*class="[^"]*cifra_cnt[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (divMatch) content = divMatch[1];
  }

  if (!content) return null;

  content = content.replace(/<b>(.*?)<\/b>/g, "[$1]");
  content = content.replace(/<[^>]+>/g, "");
  content = content.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ");

  let musical_key: string | null = null;
  const keyMatch = html.match(/tom[:\s]*<[^>]*>([A-G][#b]?m?)<\/[^>]*>/i)
    || html.match(/"key":\s*"([A-G][#b]?m?)"/i);
  if (keyMatch) musical_key = keyMatch[1];

  return { title, artist, content: content.trim(), musical_key };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return ok({ success: false, error: "Não autorizado." });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return ok({ success: false, error: "Não autorizado." });
    }

    const { query } = await req.json();
    if (!query || typeof query !== "string") {
      return ok({ success: false, error: "Query é obrigatória." });
    }

    console.log("Searching Cifra Club for:", query);

    // Step 1: Search
    const searchUrl = `https://www.cifraclub.com.br/?q=${encodeURIComponent(query)}`;
    const searchResp = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!searchResp.ok) {
      console.error("Search failed:", searchResp.status);
      return await fallbackToAI(query);
    }

    const searchHtml = await searchResp.text();

    const linkMatch = searchHtml.match(/<a[^>]*href="(\/[^"]+\/[^"]+\/)"[^>]*class="[^"]*gs-title[^"]*"/i)
      || searchHtml.match(/<a[^>]*class="[^"]*gs-title[^"]*"[^>]*href="(\/[^"]+\/[^"]+\/)"/i)
      || searchHtml.match(/<a[^>]*href="(\/[^\/]+\/[^\/]+\/)"[^>]*>[^<]*<\/a>/i);

    let cifraUrl: string | null = null;

    if (linkMatch) {
      cifraUrl = `https://www.cifraclub.com.br${linkMatch[1]}`;
    } else {
      const allLinks = [...searchHtml.matchAll(/href="(\/([a-z0-9-]+)\/([a-z0-9-]+)\/)"/gi)];
      const songLink = allLinks.find(m => {
        const path = m[1];
        return !path.includes("/busca/") && !path.includes("/mais-acessadas/") && !path.includes("/popularidade/");
      });
      if (songLink) cifraUrl = `https://www.cifraclub.com.br${songLink[1]}`;
    }

    if (!cifraUrl) {
      console.log("No direct link found");
      return ok({ success: false, error: "Música não localizada no Cifra Club." });
    }

    console.log("Found cifra URL:", cifraUrl);

    // Step 2: Fetch cifra page
    const cifraResp = await fetch(cifraUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pt-BR,pt;q=0.9",
      },
    });

    if (!cifraResp.ok) {
      console.error("Cifra page failed:", cifraResp.status);
      return await fallbackToAI(query);
    }

    const cifraHtml = await cifraResp.text();
    const result = extractChordContent(cifraHtml);

    if (!result || !result.content) {
      console.log("Failed to extract content, falling back to AI");
      return await fallbackToAI(query);
    }

    console.log("Extracted:", result.title, "-", result.artist);

    return ok({
      success: true,
      title: result.title || query,
      artist: result.artist || null,
      content: result.content,
      musical_key: result.musical_key,
      source_url: cifraUrl,
      source: "cifraclub",
    });
  } catch (error) {
    console.error("scrape-cifra error:", error);
    return ok({ success: false, error: "Erro interno ao processar a cifra." });
  }
});

async function fallbackToAI(query: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return ok({ success: false, error: "Música não localizada nas bases de dados." });
  }

  try {
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
            content: `You are a Brazilian music chord sheet expert. Given a song query, return the cifra in ChordPro format.
Return ONLY valid JSON (no markdown):
{
  "title": "song title",
  "artist": "artist name",
  "content": "full lyrics with [chords] in ChordPro format",
  "musical_key": "key e.g. Am, C",
  "source": "ai"
}
If you don't know the song, return exactly: {"error": "ERROR_SONG_NOT_FOUND"}`,
          },
          { role: "user", content: `Busque a cifra para: ${query}` },
        ],
        temperature: 0,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI fallback error:", await aiResponse.text());
      return ok({ success: false, error: "Música não localizada nas bases de dados." });
    }

    const aiResult = await aiResponse.json();
    const content = aiResult.choices?.[0]?.message?.content || "";
    const jsonStr = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (parsed.error) {
      const msg = parsed.error === "ERROR_SONG_NOT_FOUND"
        ? "Música não localizada nas bases de dados."
        : parsed.error;
      return ok({ success: false, error: msg });
    }

    return ok({ success: true, ...parsed });
  } catch (e) {
    console.error("AI parse error:", e);
    return ok({ success: false, error: "Música não localizada nas bases de dados." });
  }
}
