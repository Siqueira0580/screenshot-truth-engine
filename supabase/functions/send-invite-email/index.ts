import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { invites, setlistName, senderName } = await req.json();

    // invites: Array<{ email: string; link: string }>
    if (!invites || !Array.isArray(invites) || invites.length === 0) {
      throw new Error("No invites provided");
    }

    const results: { email: string; success: boolean; error?: string }[] = [];

    for (const invite of invites) {
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Smart Cifra <onboarding@resend.dev>",
            to: [invite.email],
            subject: `🎵 Convite para sincronizar: ${setlistName}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
                <h2 style="color: #1a1a2e; margin-bottom: 8px;">🎶 Smart Cifra — Modo Palco</h2>
                <p style="color: #444; font-size: 15px; line-height: 1.6;">
                  Olá! <strong>${senderName || "Um músico"}</strong> convidou você para sincronizar o repertório 
                  <strong>"${setlistName}"</strong> em tempo real.
                </p>
                <p style="color: #444; font-size: 15px; line-height: 1.6;">
                  Com o Modo Palco, todos os músicos veem a mesma música ao mesmo tempo — 
                  o mestre controla a navegação e vocês acompanham automaticamente.
                </p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${invite.link}" 
                     style="display: inline-block; padding: 14px 32px; background: #6366f1; color: #fff; 
                            text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                    Aceitar Convite
                  </a>
                </div>
                <p style="color: #888; font-size: 12px; line-height: 1.5;">
                  Se o botão não funcionar, copie e cole este link no navegador:<br/>
                  <a href="${invite.link}" style="color: #6366f1; word-break: break-all;">${invite.link}</a>
                </p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #aaa; font-size: 11px; text-align: center;">
                  Smart Cifra — Seu teleprompter musical inteligente
                </p>
              </div>
            `,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          results.push({ email: invite.email, success: false, error: data.message || "Resend error" });
        } else {
          results.push({ email: invite.email, success: true });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        results.push({ email: invite.email, success: false, error: msg });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("send-invite-email error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
