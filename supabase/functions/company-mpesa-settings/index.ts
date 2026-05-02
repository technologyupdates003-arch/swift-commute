import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const { action, company_id } = body as { action: string; company_id: string };

    if (!company_id || !action) {
      return new Response(JSON.stringify({ error: "Missing action or company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorize: super admin or company_admin of that company
    const [{ data: isSuper }, { data: isAdmin }] = await Promise.all([
      admin.rpc("is_super_admin", { _user_id: userId }),
      admin.rpc("has_company_role", { _user_id: userId, _role: "company_admin", _company_id: company_id }),
    ]);
    if (!isSuper && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const { data, error } = await admin.rpc("get_company_mpesa_status", { _company_id: company_id });
      if (error) throw error;
      return new Response(JSON.stringify({ data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "save") {
      const {
        environment, business_shortcode, party_b,
        consumer_key, consumer_secret, passkey,
        callback_url, is_enabled,
      } = body;

      if (environment && !["sandbox", "production"].includes(environment)) {
        return new Response(JSON.stringify({ error: "Invalid environment" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch existing to preserve secrets if blank
      const { data: existing } = await admin
        .from("company_mpesa_settings")
        .select("*").eq("company_id", company_id).maybeSingle();

      const payload: Record<string, unknown> = {
        company_id,
        environment: environment ?? existing?.environment ?? "sandbox",
        business_shortcode: business_shortcode ?? existing?.business_shortcode ?? null,
        party_b: party_b ?? existing?.party_b ?? null,
        callback_url: callback_url ?? existing?.callback_url ?? null,
        is_enabled: typeof is_enabled === "boolean" ? is_enabled : existing?.is_enabled ?? false,
        consumer_key: consumer_key && consumer_key.length > 0 ? consumer_key : existing?.consumer_key ?? null,
        consumer_secret: consumer_secret && consumer_secret.length > 0 ? consumer_secret : existing?.consumer_secret ?? null,
        passkey: passkey && passkey.length > 0 ? passkey : existing?.passkey ?? null,
      };

      const { error } = await admin
        .from("company_mpesa_settings")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;

      const { data: status } = await admin.rpc("get_company_mpesa_status", { _company_id: company_id });
      return new Response(JSON.stringify({ ok: true, data: status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "clear") {
      const { error } = await admin
        .from("company_mpesa_settings")
        .delete().eq("company_id", company_id);
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
