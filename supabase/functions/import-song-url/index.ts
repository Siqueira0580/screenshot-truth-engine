import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Strip scripts, styles, and HTML tags to get raw text
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

    // Limit to ~8000 chars to stay within token limits
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
            content: `Você é um assistente musical especializado em cifras. Extraia a cifra/letra do texto fornecido (que foi extraído de um site de cifras). 
Formate a música rigorosamente no formato ChordPro, colocando os acordes entre colchetes sobre as sílabas corretas (ex: [Am]Hoje eu [G]sei).
Identifique o Título, o Artista e classifique o Gênero Musical (ex: Samba, Rock, MPB, Pop, Gospel, Forró, Sertanejo, Bossa Nova).
Retorne ESTRITAMENTE um JSON válido com as chaves: "title", "artist", "genre", "content" (a cifra formatada em ChordPro).
Não inclua nenhum texto fora do JSON. Não use markdown code blocks.`,
          },
          {
            role: "user",
            content: `Extraia a cifra deste texto de site:\n\n${truncated}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_song",
              description: "Extract song data from scraped text into structured ChordPro format",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Song title" },
                  artist: { type: "string", description: "Artist name" },
                  genre: { type: "string", description: "Musical genre" },
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
    let result: { title: string; artist: string; genre: string; content: string };
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      // Fallback: try parsing content directly
      const raw = aiData.choices?.[0]?.message?.content || "";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("IA não retornou dados estruturados");
      }
      result = JSON.parse(jsonMatch[0]);
    }

    console.log("Extracted:", result.title, "-", result.artist);

    return new Response(JSON.stringify(result), {
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
