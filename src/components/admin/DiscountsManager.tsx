import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Tag, Trash2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const schema = z.object({
  code: z.string().trim().min(2).max(30).regex(/^[A-Z0-9_-]+$/i, "Letters, numbers, dash, underscore only"),
  description: z.string().trim().max(140).optional().or(z.literal("")),
  type: z.enum(["percent", "fixed"]),
  value: z.coerce.number().positive().max(100000),
  max_uses: z.coerce.number().int().positive().optional().or(z.nan()),
  starts_at: z.string().optional().or(z.literal("")),
  ends_at: z.string().optional().or(z.literal("")),
});

type Row = {
  id: string; code: string; description: string | null;
  type: "percent" | "fixed"; value: number;
  max_uses: number | null; used_count: number;
  starts_at: string | null; ends_at: string | null;
  is_active: boolean;
};

const empty = { code: "", description: "", type: "percent" as const, value: 10, max_uses: "", starts_at: "", ends_at: "" };

const DiscountsManager = ({ companyId }: { companyId: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<typeof empty>(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("discounts").select("*").eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setRows((data as Row[]) ?? []);
  };
  useEffect(() => { if (companyId) load(); }, [companyId]);

  const create = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("discounts").insert({
      company_id: companyId,
      code: parsed.data.code.toUpperCase(),
      description: parsed.data.description || null,
      type: parsed.data.type,
      value: parsed.data.value,
      max_uses: Number.isFinite(parsed.data.max_uses as number) ? (parsed.data.max_uses as number) : null,
      starts_at: parsed.data.starts_at || null,
      ends_at: parsed.data.ends_at || null,
    });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Discount created" });
    setOpen(false); setForm(empty); load();
  };

  const toggle = async (id: string, is_active: boolean) => {
    const { error } = await supabase.from("discounts").update({ is_active }).eq("id", id);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("discounts").delete().eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Discount deleted" });
    load();
  };

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Tag className="h-5 w-5 text-primary" />
          <CardTitle>Discount codes</CardTitle>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 bg-primary"><Plus className="h-4 w-4" /> New code</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create discount code</DialogTitle></DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Code" v={form.code} on={(v) => setForm({ ...form, code: v.toUpperCase() })} placeholder="BUSCAR26" />
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "percent" | "fixed" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount (KES)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Field label={form.type === "percent" ? "Percent off" : "KES off"} v={String(form.value)} on={(v) => setForm({ ...form, value: Number(v) as any })} type="number" />
              <Field label="Max uses (optional)" v={form.max_uses} on={(v) => setForm({ ...form, max_uses: v })} type="number" placeholder="Unlimited" />
              <Field label="Starts at (optional)" v={form.starts_at} on={(v) => setForm({ ...form, starts_at: v })} type="datetime-local" />
              <Field label="Ends at (optional)" v={form.ends_at} on={(v) => setForm({ ...form, ends_at: v })} type="datetime-local" />
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Description</Label>
                <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Special offer on every booking" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={create} disabled={busy} className="bg-primary">{busy ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No discount codes yet. Create your first promo to attract more bookings.
          </p>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
                <div className="flex items-center gap-3">
                  <div className="rounded-md bg-primary/10 px-2.5 py-1 font-mono text-sm font-bold text-primary">{r.code}</div>
                  <div>
                    <div className="text-sm font-semibold">
                      {r.type === "percent" ? `${r.value}% off` : `KES ${r.value} off`}
                    </div>
                    {r.description && <div className="text-xs text-muted-foreground">{r.description}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {r.used_count}{r.max_uses ? `/${r.max_uses}` : ""} used
                  </Badge>
                  <div className="flex items-center gap-2">
                    <Switch checked={r.is_active} onCheckedChange={(v) => toggle(r.id, v)} />
                    <span className="text-xs text-muted-foreground">{r.is_active ? "Active" : "Off"}</span>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => remove(r.id)} aria-label="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Field = ({ label, v, on, type = "text", placeholder }: { label: string; v: string; on: (v: string) => void; type?: string; placeholder?: string }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input type={type} value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
  </div>
);

export default DiscountsManager;
