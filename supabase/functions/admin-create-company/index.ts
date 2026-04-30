import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function genPassword(len = 14) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = claims.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: callerId });
    if (!isSuper) {
      return new Response(JSON.stringify({ error: "Forbidden — super admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { name, slug, contact_email, contact_phone, commission_pct, admin_email, admin_full_name } = body ?? {};
    if (!name || !slug || !admin_email || !admin_full_name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Create company
    const { data: company, error: cErr } = await admin.from("companies").insert({
      name, slug, contact_email: contact_email ?? null, contact_phone: contact_phone ?? null,
      commission_pct: commission_pct ?? 0, is_active: true,
    }).select().single();
    if (cErr) {
      return new Response(JSON.stringify({ error: cErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Create or fetch auth user
    const password = genPassword();
    let userId: string | null = null;
    let createdUser = false;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: admin_email,
      password,
      email_confirm: true,
      user_metadata: { full_name: admin_full_name },
    });
    if (createErr) {
      // already-registered? look up
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list.users.find((u: any) => u.email?.toLowerCase() === admin_email.toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = existing.id;
    } else {
      userId = created.user!.id;
      createdUser = true;
    }

    // 3. Link profile to company
    await admin.from("profiles").upsert({ id: userId, full_name: admin_full_name, company_id: company.id });

    // 4. Grant company_admin role
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role: "company_admin", company_id: company.id });
    if (rErr && !rErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: rErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 5. Audit
    await admin.from("audit_logs").insert({
      action: "company_admin.created", entity: "user", entity_id: userId,
      company_id: company.id, actor_id: callerId,
      meta: { email: admin_email, created_user: createdUser },
    });

    return new Response(JSON.stringify({
      company,
      admin: { user_id: userId, email: admin_email, temp_password: createdUser ? password : null },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
