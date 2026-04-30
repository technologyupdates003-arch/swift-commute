import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  route_id: z.string().uuid("Pick a route"),
  origin_branch: z.string().uuid().optional().or(z.literal("")),
  destination_branch: z.string().uuid().optional().or(z.literal("")),
  sender_name: z.string().trim().min(2).max(100),
  sender_phone: z.string().trim().min(7).max(20),
  sender_id: z.string().trim().max(40).optional().or(z.literal("")),
  receiver_name: z.string().trim().min(2).max(100),
  receiver_phone: z.string().trim().min(7).max(20),
  description: z.string().trim().min(2).max(500),
  weight: z.coerce.number().positive().max(500),
  quantity: z.coerce.number().int().positive().max(100),
  declared_value: z.coerce.number().nonnegative().max(10_000_000).optional(),
  is_urgent: z.boolean().default(false),
});

type Route = { id: string; origin: string; destination: string; company_id: string; companies?: { name: string } | null };
type Pricing = { route_id: string; base_fee: number; per_kg: number; urgent_surcharge: number };
type Branch = { id: string; name: string; town: string; company_id: string };

const SendParcel = () => {
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pricing, setPricing] = useState<Record<string, Pricing>>({});
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    route_id: "", origin_branch: "", destination_branch: "",
    sender_name: "", sender_phone: "", sender_id: "",
    receiver_name: "", receiver_phone: "",
    description: "", weight: "1", quantity: "1", declared_value: "",
    is_urgent: false,
  });

  useEffect(() => {
    (async () => {
      const [{ data: r }, { data: p }, { data: b }] = await Promise.all([
        supabase.from("routes").select("id, origin, destination, company_id, companies(name)").eq("is_active", true),
        supabase.from("route_parcel_pricing").select("route_id, base_fee, per_kg, urgent_surcharge").eq("is_active", true),
        supabase.from("branches").select("id, name, town, company_id").eq("is_active", true),
      ]);
      setRoutes((r ?? []) as any);
      setPricing(Object.fromEntries((p ?? []).map((x: any) => [x.route_id, x])));
      setBranches((b ?? []) as any);
    })();
  }, []);

  const selectedRoute = routes.find((r) => r.id === form.route_id);
  const routeBranches = useMemo(
    () => branches.filter((b) => selectedRoute && b.company_id === selectedRoute.company_id),
    [branches, selectedRoute]
  );

  const priceEstimate = useMemo(() => {
    const p = pricing[form.route_id];
    const w = parseFloat(form.weight) || 0;
    const q = parseInt(form.quantity) || 0;
    if (!p) return null;
    return Number(p.base_fee) + Number(p.per_kg) * w * q + (form.is_urgent ? Number(p.urgent_surcharge) : 0);
  }, [pricing, form.route_id, form.weight, form.quantity, form.is_urgent]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...form,
      weight: form.weight,
      quantity: form.quantity,
      declared_value: form.declared_value || undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("create_parcel", {
      _route_id: parsed.data.route_id,
      _origin_branch: parsed.data.origin_branch || null,
      _destination_branch: parsed.data.destination_branch || null,
      _sender_name: parsed.data.sender_name,
      _sender_phone: parsed.data.sender_phone,
      _sender_id: parsed.data.sender_id || null,
      _receiver_name: parsed.data.receiver_name,
      _receiver_phone: parsed.data.receiver_phone,
      _description: parsed.data.description,
      _weight: parsed.data.weight,
      _quantity: parsed.data.quantity,
      _declared_value: parsed.data.declared_value ?? null,
      _is_urgent: parsed.data.is_urgent,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    const tracking = (data as any)?.tracking_id;
    toast.success(`Parcel registered. Tracking ID: ${tracking}`);
    navigate(`/track-parcel?id=${tracking}`);
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <main className="container max-w-3xl py-8">
        <h1 className="text-3xl font-bold">Send a parcel</h1>
        <p className="mt-2 text-muted-foreground">Fill the details and we'll generate a tracking ID and pickup code.</p>

        <Card className="mt-6 shadow-card">
          <CardHeader><CardTitle>Parcel details</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-5">
              <div>
                <Label>Route</Label>
                <Select value={form.route_id} onValueChange={(v) => setForm({ ...form, route_id: v, origin_branch: "", destination_branch: "" })}>
                  <SelectTrigger><SelectValue placeholder="Choose a route" /></SelectTrigger>
                  <SelectContent>
                    {routes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.origin} → {r.destination} {r.companies?.name ? `(${r.companies.name})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.route_id && !pricing[form.route_id] && (
                  <p className="mt-1 text-xs text-destructive">This route doesn't have parcel pricing configured.</p>
                )}
              </div>

              {routeBranches.length > 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Origin branch (optional)</Label>
                    <Select value={form.origin_branch} onValueChange={(v) => setForm({ ...form, origin_branch: v })}>
                      <SelectTrigger><SelectValue placeholder="Drop-off office" /></SelectTrigger>
                      <SelectContent>
                        {routeBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} — {b.town}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Destination branch (optional)</Label>
                    <Select value={form.destination_branch} onValueChange={(v) => setForm({ ...form, destination_branch: v })}>
                      <SelectTrigger><SelectValue placeholder="Pickup office" /></SelectTrigger>
                      <SelectContent>
                        {routeBranches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} — {b.town}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Sender name"><Input value={form.sender_name} onChange={(e) => setForm({ ...form, sender_name: e.target.value })} /></Field>
                <Field label="Sender phone"><Input value={form.sender_phone} onChange={(e) => setForm({ ...form, sender_phone: e.target.value })} placeholder="07XX XXX XXX" /></Field>
                <Field label="Sender ID (optional)"><Input value={form.sender_id} onChange={(e) => setForm({ ...form, sender_id: e.target.value })} /></Field>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Receiver name"><Input value={form.receiver_name} onChange={(e) => setForm({ ...form, receiver_name: e.target.value })} /></Field>
                <Field label="Receiver phone"><Input value={form.receiver_phone} onChange={(e) => setForm({ ...form, receiver_phone: e.target.value })} placeholder="07XX XXX XXX" /></Field>
              </div>

              <Field label="Description">
                <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Sealed envelope, electronics, clothes" />
              </Field>

              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Weight (kg)"><Input type="number" min="0.1" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} /></Field>
                <Field label="Quantity"><Input type="number" min="1" step="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field>
                <Field label="Declared value (optional)"><Input type="number" min="0" step="1" value={form.declared_value} onChange={(e) => setForm({ ...form, declared_value: e.target.value })} /></Field>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.is_urgent} onCheckedChange={(v) => setForm({ ...form, is_urgent: !!v })} />
                Urgent delivery (surcharge applies)
              </label>

              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
                <span className="text-sm text-muted-foreground">Estimated price</span>
                <span className="text-xl font-bold">
                  {priceEstimate !== null ? `KES ${priceEstimate.toLocaleString()}` : "—"}
                </span>
              </div>

              <Button type="submit" disabled={submitting || !pricing[form.route_id]} className="w-full" size="lg">
                {submitting ? "Registering..." : "Register parcel"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">Payment is collected at the office (M-Pesa stub).</p>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div><Label className="mb-1 block">{label}</Label>{children}</div>
);

export default SendParcel;
