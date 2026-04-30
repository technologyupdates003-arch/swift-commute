import { useEffect, useState } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Building2, Percent, Plus, Save } from "lucide-react";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  contact_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(20).optional().or(z.literal("")),
  commission_pct: z.coerce.number().min(0).max(100),
});

type Company = {
  id: string; name: string; slug: string;
  contact_email: string | null; contact_phone: string | null;
  is_active: boolean; commission_pct: number;
};

const AdminDashboard = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", contact_email: "", contact_phone: "", commission_pct: 10 });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<string, number>>({});

  const load = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies((data as Company[]) ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    const parsed = companySchema.safeParse(form);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("companies").insert({
      name: parsed.data.name,
      slug: parsed.data.slug,
      contact_email: parsed.data.contact_email || null,
      contact_phone: parsed.data.contact_phone || null,
      commission_pct: parsed.data.commission_pct,
    });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Company created" });
    setOpen(false);
    setForm({ name: "", slug: "", contact_email: "", contact_phone: "", commission_pct: 10 });
    load();
  };

  const saveCommission = async (id: string) => {
    const v = editing[id];
    if (v === undefined) return;
    if (v < 0 || v > 100) {
      toast({ title: "Commission must be 0–100%", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("companies").update({ commission_pct: v }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Commission updated" });
    setEditing((s) => { const n = { ...s }; delete n[id]; return n; });
    load();
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Super admin</h1>
            <p className="mt-1 text-muted-foreground">Manage all bus companies and platform commissions.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-brand-gradient hover:opacity-90"><Plus className="h-4 w-4" /> New company</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create bus company</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Field label="Name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
                <Field label="Slug" v={form.slug} on={(v) => setForm({ ...form, slug: v.toLowerCase() })} />
                <Field label="Contact email" v={form.contact_email} on={(v) => setForm({ ...form, contact_email: v })} />
                <Field label="Contact phone" v={form.contact_phone} on={(v) => setForm({ ...form, contact_phone: v })} />
                <Field label="Commission % per booking" v={String(form.commission_pct)} type="number" on={(v) => setForm({ ...form, commission_pct: Number(v) })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button className="bg-brand-gradient" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {companies.length === 0 && (
            <Card className="md:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-muted-foreground">
              No companies yet. Create your first operator.
            </CardContent></Card>
          )}
          {companies.map((c) => {
            const isEditing = editing[c.id] !== undefined;
            return (
              <Card key={c.id} className="shadow-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-base">{c.name}</CardTitle>
                  </div>
                  <Badge variant={c.is_active ? "default" : "secondary"} className={c.is_active ? "bg-success" : ""}>
                    {c.is_active ? "Active" : "Inactive"}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div>Slug: <span className="font-mono">{c.slug}</span></div>
                  {c.contact_email && <div>{c.contact_email}</div>}
                  {c.contact_phone && <div>{c.contact_phone}</div>}

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-foreground">
                      <Percent className="h-3.5 w-3.5" /> Platform commission
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number" min={0} max={100} step={0.1}
                        value={isEditing ? editing[c.id] : c.commission_pct}
                        onChange={(e) => setEditing((s) => ({ ...s, [c.id]: Number(e.target.value) }))}
                        className="h-9 w-24"
                      />
                      <span className="text-sm font-semibold text-foreground">%</span>
                      {isEditing && (
                        <Button size="sm" className="ml-auto gap-1.5 bg-primary" onClick={() => saveCommission(c.id)}>
                          <Save className="h-3.5 w-3.5" /> Save
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
  </div>
);

export default AdminDashboard;
