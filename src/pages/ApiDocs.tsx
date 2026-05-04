import { useEffect } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Code2, KeyRound, Lock, Globe } from "lucide-react";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const Endpoint = ({
  method, path, auth, summary, body, response,
}: { method: string; path: string; auth: "public" | "api_key"; summary: string; body?: string; response?: string }) => (
  <Card className="overflow-hidden">
    <CardHeader className="bg-muted/30">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="font-mono">{method}</Badge>
        <code className="text-sm font-mono break-all">{path}</code>
        <Badge variant={auth === "public" ? "secondary" : "default"} className="ml-auto gap-1">
          {auth === "public" ? <Globe className="h-3 w-3" /> : <KeyRound className="h-3 w-3" />}
          {auth === "public" ? "Public" : "API key"}
        </Badge>
      </div>
      <CardTitle className="text-base mt-2 font-medium">{summary}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-3 pt-4 text-sm">
      {body && (
        <div>
          <p className="font-semibold mb-1">Request body</p>
          <pre className="bg-muted rounded p-3 text-xs overflow-x-auto"><code>{body}</code></pre>
        </div>
      )}
      {response && (
        <div>
          <p className="font-semibold mb-1">Example response</p>
          <pre className="bg-muted rounded p-3 text-xs overflow-x-auto"><code>{response}</code></pre>
        </div>
      )}
    </CardContent>
  </Card>
);

const ApiDocs = () => {
  useEffect(() => { document.title = "API Documentation – Abancool Travel"; }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container py-10 max-w-4xl space-y-8">
        <header>
          <Badge variant="outline" className="mb-3 gap-1"><Code2 className="h-3 w-3" /> Developer API</Badge>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Abancool Travel API</h1>
          <p className="mt-2 text-muted-foreground">
            REST endpoints for searching trips, tracking parcels, creating bookings, and initiating M-Pesa payments.
          </p>
        </header>

        <Card>
          <CardHeader><CardTitle className="text-lg">Base URL</CardTitle></CardHeader>
          <CardContent>
            <pre className="bg-muted rounded p-3 text-xs overflow-x-auto"><code>{BASE}</code></pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2"><Lock className="h-5 w-5" /> Authentication</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <p>
              Public read endpoints (trip search, parcel tracking) require no key.
              Write endpoints (bookings, STK push) require a per-company API key generated in your
              company dashboard <strong>Settings → API keys</strong>.
            </p>
            <p>Send the key as a header on every request:</p>
            <pre className="bg-muted rounded p-3 text-xs overflow-x-auto"><code>x-api-key: abk_live_xxxxxxxxxxxxxxxx</code></pre>
            <p className="text-muted-foreground">
              Keys are shown once at creation. Store them securely and rotate by revoking + creating a new key.
            </p>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Public endpoints</h2>

          <Endpoint
            method="GET"
            path={`/rest/v1/trips?status=eq.scheduled&select=id,departure_at,price,routes(origin,destination),companies(name)`}
            auth="public"
            summary="Search scheduled trips (via PostgREST)"
            response={`[
  {
    "id": "uuid",
    "departure_at": "2026-05-05T07:00:00Z",
    "price": 1500,
    "routes": { "origin": "Nairobi", "destination": "Mombasa" },
    "companies": { "name": "Coastliner" }
  }
]`}
          />

          <Endpoint
            method="POST"
            path="/rpc/track_parcel"
            auth="public"
            summary="Track a parcel by its tracking ID"
            body={`{ "_tracking_id": "PRC-AB12CD34" }`}
            response={`{
  "tracking_id": "PRC-AB12CD34",
  "status": "in_transit",
  "company": "Coastliner",
  "origin": "Nairobi",
  "destination": "Mombasa",
  "movements": [...]
}`}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Authenticated endpoints</h2>

          <Endpoint
            method="POST"
            path="/mpesa-stk-push"
            auth="api_key"
            summary="Initiate M-Pesa STK push for a booking or wallet top-up"
            body={`{
  "purpose": "booking" | "wallet_topup",
  "reference_id": "uuid (booking id, optional for wallet)",
  "phone": "2547XXXXXXXX",
  "amount": 1500,
  "company_id": "uuid"
}`}
            response={`{
  "ok": true,
  "checkout_request_id": "ws_CO_...",
  "merchant_request_id": "..."
}`}
          />

          <Endpoint
            method="POST"
            path="/mpesa-stk-callback"
            auth="public"
            summary="Safaricom callback (configure this URL in your Daraja app)"
            body={`Body provided by Safaricom — do not call directly.`}
          />
        </section>

        <Card className="border-primary/30 bg-primary/5">
          <CardHeader><CardTitle className="text-lg">Rate limits & errors</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>Standard HTTP status codes apply. <code>401</code> = missing/invalid key, <code>403</code> = revoked or wrong company, <code>429</code> = rate limit.</p>
            <p>Errors return JSON: <code>{`{ "error": "message" }`}</code></p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ApiDocs;
