import { useEffect, useState } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

type Row = {
  id: string; code: string; description: string | null;
  type: "percent" | "fixed"; value: number;
  ends_at: string | null;
  companies?: { name: string } | null;
};

const Offers = () => {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("discounts")
        .select("id, code, description, type, value, ends_at, company_id")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const base = (data ?? []) as (Omit<Row, "companies"> & { company_id: string })[];
      const ids = Array.from(new Set(base.map((x) => x.company_id)));
      let names: Record<string, { name: string }> = {};
      if (ids.length) {
        const { data: cs } = await supabase.from("companies").select("id, name").in("id", ids);
        names = Object.fromEntries((cs ?? []).map((x) => [x.id, { name: x.name }]));
      }
      setRows(base.map((x) => ({ ...x, companies: names[x.company_id] ?? null })));
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <div className="container py-10">
        <h1 className="text-3xl font-bold">All Offers</h1>
        <p className="mt-1 text-muted-foreground">Active discount codes from our bus partners</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No active offers right now.
            </p>
          )}
          {rows.map((o) => (
            <Card key={o.id} className="shadow-card">
              <CardContent className="p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-primary">{o.companies?.name ?? "Partner"}</div>
                <div className="mt-1 text-2xl font-extrabold">
                  {o.type === "percent" ? `${o.value}% off` : `KES ${o.value} off`}
                </div>
                {o.description && <p className="mt-1 text-sm text-muted-foreground">{o.description}</p>}
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">Code</div>
                    <div className="font-mono text-base font-bold">{o.code}</div>
                  </div>
                  {o.ends_at && (
                    <div className="text-right text-xs text-muted-foreground">
                      Ends<br /><span className="font-semibold">{new Date(o.ends_at).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Offers;
