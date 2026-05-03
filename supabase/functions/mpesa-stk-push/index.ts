// Initiate Safaricom Daraja STK Push (PRODUCTION ONLY)
// Body: { purpose: "booking" | "wallet_topup", amount, phone, company_id?, booking_id? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DARAJA_BASE = "https://api.safaricom.co.ke"; // production only

function ts() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function normalizePhone(p: string) {
  let s = p.replace(/\D/g, "");
  if (s.startsWith("0")) s = "254" + s.slice(1);
  if (s.startsWith("7") || s.startsWith("1")) s = "254" + s;
  if (s.startsWith("+")) s = s.slice(1);
  return s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: ud } = await userClient.auth.getUser();
    if (!ud?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const userId = ud.user.id;

    const body = await req.json();
    const purpose = body.purpose as string;
    const phone = normalizePhone(String(body.phone ?? ""));
    const amount = Math.max(1, Math.floor(Number(body.amount ?? 0)));
    if (!phone || !amount || !["booking", "wallet_topup"].includes(purpose)) {
      return new Response(JSON.stringify({ error: "Missing/invalid fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let companyId: string | null = body.company_id ?? null;
    let referenceId: string | null = null;
    let accountReference = "Abancool";

    if (purpose === "booking") {
      const bookingId = body.booking_id as string;
      if (!bookingId) return new Response(JSON.stringify({ error: "booking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const { data: bk } = await admin.from("bookings").select("id, company_id, ticket_code, amount, status").eq("id", bookingId).maybeSingle();
      if (!bk) return new Response(JSON.stringify({ error: "Booking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (bk.status === "paid") return new Response(JSON.stringify({ error: "Already paid" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      companyId = bk.company_id;
      referenceId = bk.id;
      accountReference = bk.ticket_code ?? "Booking";
    }

    if (!companyId) return new Response(JSON.stringify({ error: "company_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: cfg } = await admin.from("company_mpesa_settings").select("*").eq("company_id", companyId).maybeSingle();
    if (!cfg || !cfg.is_enabled) {
      return new Response(JSON.stringify({ error: "M-Pesa not enabled for this company" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!cfg.consumer_key || !cfg.consumer_secret || !cfg.passkey || !cfg.business_shortcode) {
      return new Response(JSON.stringify({ error: "M-Pesa credentials incomplete" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // OAuth
    const tokenRes = await fetch(`${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: "Basic " + btoa(`${cfg.consumer_key}:${cfg.consumer_secret}`) },
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return new Response(JSON.stringify({ error: "Daraja auth failed", detail: t }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { access_token } = await tokenRes.json();

    const timestamp = ts();
    const password = btoa(`${cfg.business_shortcode}${cfg.passkey}${timestamp}`);
    const callbackUrl = cfg.callback_url || `${SUPABASE_URL}/functions/v1/mpesa-stk-callback`;

    const stkBody = {
      BusinessShortCode: cfg.business_shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: phone,
      PartyB: cfg.party_b || cfg.business_shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: accountReference.slice(0, 12),
      TransactionDesc: purpose === "booking" ? "Bus booking" : "Wallet top-up",
    };

    const stkRes = await fetch(`${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify(stkBody),
    });
    const stkData = await stkRes.json();

    // Persist request row
    const { data: stkRow } = await admin.from("mpesa_stk_requests").insert({
      company_id: companyId,
      user_id: userId,
      purpose,
      reference_id: referenceId,
      phone, amount,
      account_reference: accountReference,
      merchant_request_id: stkData.MerchantRequestID,
      checkout_request_id: stkData.CheckoutRequestID,
      result_code: stkData.ResponseCode ? Number(stkData.ResponseCode) : null,
      result_desc: stkData.ResponseDescription ?? stkData.errorMessage,
      status: stkData.ResponseCode === "0" ? "pending" : "failed",
    }).select().single();

    if (stkData.ResponseCode !== "0") {
      return new Response(JSON.stringify({ error: stkData.errorMessage || stkData.ResponseDescription || "STK failed", daraja: stkData }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, request: stkRow, message: "STK push sent. Approve on your phone." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("stk-push error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
