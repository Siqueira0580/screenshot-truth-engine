import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLANS: Record<string, { title: string; unit_price: number }> = {
  monthly: {
    title: "Smart Cifra PRO — Mensal",
    unit_price: 14.9,
  },
  annual: {
    title: "Smart Cifra PRO — Anual (10% OFF)",
    unit_price: 160.92,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Utilizador não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { plan_type = "monthly" } = await req.json();
    const plan = PLANS[plan_type];

    if (!plan) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      console.error("MP_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Serviço de pagamento indisponível" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mp-webhook`;

    // Encode billing cycle in external_reference: "userId|cycle"
    const externalReference = `${user.id}|${plan_type}`;

    const preferenceBody = {
      items: [
        {
          title: plan.title,
          quantity: 1,
          unit_price: plan.unit_price,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: user.email,
      },
      external_reference: externalReference,
      back_urls: {
        success: `${req.headers.get("origin") || "https://smartcifra.com"}/planos?status=success`,
        failure: `${req.headers.get("origin") || "https://smartcifra.com"}/planos?status=failure`,
        pending: `${req.headers.get("origin") || "https://smartcifra.com"}/planos?status=pending`,
      },
      auto_return: "approved",
      notification_url: webhookUrl,
      statement_descriptor: "SMARTCIFRA PRO",
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
    };

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify(preferenceBody),
      }
    );

    if (!mpResponse.ok) {
      const errBody = await mpResponse.text();
      console.error("Mercado Pago API error:", errBody);
      return new Response(
        JSON.stringify({ error: "Falha ao criar sessão de pagamento" }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const preference = await mpResponse.json();

    return new Response(
      JSON.stringify({
        init_point: preference.init_point,
        sandbox_init_point: preference.sandbox_init_point,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error in create-mp-checkout:", err);
    return new Response(
      JSON.stringify({ error: "Serviço indisponível" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
