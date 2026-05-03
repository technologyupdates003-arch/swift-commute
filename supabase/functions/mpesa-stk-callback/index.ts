// Daraja STK callback receiver. Public (no JWT).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const payload = await req.json();
    const cb = payload?.Body?.stkCallback;
    if (!cb) return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const checkoutId = cb.CheckoutRequestID as string;
    const resultCode = Number(cb.ResultCode);
    const resultDesc = String(cb.ResultDesc ?? "");
    let mpesaReceipt: string | null = null;
    if (resultCode === 0 && cb.CallbackMetadata?.Item) {
      const item = cb.CallbackMetadata.Item.find((i: any) => i.Name === "MpesaReceiptNumber");
      mpesaReceipt = item?.Value ?? null;
    }
    const status = resultCode === 0 ? "success" : (resultCode === 1032 ? "cancelled" : "failed");

    const { data: row } = await admin.from("mpesa_stk_requests")
      .update({ result_code: resultCode, result_desc: resultDesc, mpesa_receipt: mpesaReceipt, status, raw_callback: payload })
      .eq("checkout_request_id", checkoutId)
      .select().maybeSingle();

    if (row && status === "success") {
      if (row.purpose === "booking" && row.reference_id) {
        // Mark booking paid (bypass session token check via service role direct update)
        await admin.from("bookings").update({ status: "paid" }).eq("id", row.reference_id);
      } else if (row.purpose === "wallet_topup" && row.user_id) {
        await admin.rpc("credit_user_wallet", {
          _user: row.user_id,
          _amount: row.amount,
          _source: "mpesa_topup",
          _reference: mpesaReceipt,
          _meta: { checkout_request_id: checkoutId },
        });
      }
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("stk-callback error", e);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
