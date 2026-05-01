import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["cashier", "parcel_clerk", "driver", "conductor", "company_admin"];

function genPassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
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
    const { data: userData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const callerId = userData.user.id;

    const body = await req.json();
    const { company_id, full_name, email, phone, role } = body ?? {};
    if (!company_id || !full_name || !email || !role) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!ALLOWED_ROLES.includes(role)) {
      return new Response(JSON.stringify({ error: "Invalid role" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE);

    // Authorize: super admin OR company_admin of this company
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: callerId });
    let authorized = !!isSuper;
    if (!authorized) {
      const { data: isCoAdmin } = await admin.rpc("has_company_role", { _user_id: callerId, _role: "company_admin", _company_id: company_id });
      authorized = !!isCoAdmin;
    }
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create or find auth user
    const password = genPassword();
    let userId: string | null = null;
    let createdUser = false;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, phone: phone ?? null },
    });
    if (createErr) {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
      if (!existing) {
        return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = existing.id;
    } else {
      userId = created.user!.id;
      createdUser = true;
    }

    // Profile linked to company
    await admin.from("profiles").upsert({ id: userId, full_name, phone: phone ?? null, company_id });

    // Grant role (idempotent)
    const { error: rErr } = await admin.from("user_roles").insert({ user_id: userId, role, company_id });
    if (rErr && !rErr.message.toLowerCase().includes("duplicate")) {
      return new Response(JSON.stringify({ error: rErr.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("audit_logs").insert({
      action: "staff.created", entity: "user", entity_id: userId,
      company_id, actor_id: callerId,
      meta: { email, role, created_user: createdUser },
    });

    return new Response(JSON.stringify({
      user_id: userId, email, role,
      temp_password: createdUser ? password : null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message ?? "Server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
