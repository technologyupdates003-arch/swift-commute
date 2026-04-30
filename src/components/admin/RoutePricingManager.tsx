import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Route = { id: string; origin: string; destination: string };
type Pricing = { route_id: string; base_fee: number; per_kg: number; urgent_surcharge: number };

export default function RoutePricingManager({ companyId }: { companyId: string }) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [pricing, setPricing] = useState<Record<string, Pricing>>({});

  const load = async () => {
    const { data: r } = await supabase.from("routes").select("id, origin, destination").eq("company_id", companyId).eq("is_active", true);
    const ids = (r ?? []).map((x) => x.id);
    setRoutes((r ?? []) as Route[]);
    if (ids.length) {
      const { data: p } = await supabase.from("route_parcel_pricing").select("route_id, base_fee, per_kg, urgent_surcharge").in("route_id", ids);
      setPricing(Object.fromEntries((p ?? []).map((x: any) => [x.route_id, x])));
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const save = async (route_id: string, vals: Partial<Pricing>) => {
    const current = pricing[route_id] ?? { route_id, base_fee: 0, per_kg: 0, urgent_surcharge: 0 };
    const next = { ...current, ...vals };
    setPricing({ ...pricing, [route_id]: next });
    const { error } = await supabase.from("route_parcel_pricing").upsert({
      route_id, company_id: companyId,
      base_fee: next.base_fee, per_kg: next.per_kg, urgent_surcharge: next.urgent_surcharge,
      is_active: true,
    }, { onConflict: "route_id" });
    if (error) toast.error(error.message);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Parcel pricing per route</CardTitle>
        <p className="text-sm text-muted-foreground">Final price = base + (per-kg × weight × quantity) + (urgent surcharge if marked).</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {routes.length === 0 && <div className="text-sm text-muted-foreground">Add routes first.</div>}
        {routes.map((r) => {
          const p = pricing[r.id] ?? { route_id: r.id, base_fee: 0, per_kg: 0, urgent_surcharge: 0 };
          return (
            <div key={r.id} className="grid items-end gap-3 rounded-md border p-3 md:grid-cols-4">
              <div className="text-sm">
                <div className="font-medium">{r.origin} → {r.destination}</div>
              </div>
              <NumField label="Base fee" value={p.base_fee} onBlur={(v) => save(r.id, { base_fee: v })} />
              <NumField label="Per kg" value={p.per_kg} onBlur={(v) => save(r.id, { per_kg: v })} />
              <NumField label="Urgent surcharge" value={p.urgent_surcharge} onBlur={(v) => save(r.id, { urgent_surcharge: v })} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NumField({ label, value, onBlur }: { label: string; value: number; onBlur: (v: number) => void }) {
  const [v, setV] = useState(String(value ?? 0));
  useEffect(() => setV(String(value ?? 0)), [value]);
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min="0" step="1" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => onBlur(parseFloat(v) || 0)} />
    </div>
  );
}
