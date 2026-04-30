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
import { Building2, Plus } from "lucide-react";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  contact_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(20).optional().or(z.literal("")),
});

const AdminDashboard = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", slug: "", contact_email: "", contact_phone: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("companies").select("*").order("created_at", { ascending: false });
    setCompanies(data ?? []);
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
    });
    setBusy(false);
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Company created" });
    setOpen(false);
    setForm({ name: "", slug: "", contact_email: "", contact_phone: "" });
    load();
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Super admin</h1>
            <p className="mt-1 text-muted-foreground">Manage all bus companies on the platform.</p>
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
          {companies.map((c) => (
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
              <CardContent className="text-sm text-muted-foreground">
                <div>Slug: <span className="font-mono">{c.slug}</span></div>
                {c.contact_email && <div>{c.contact_email}</div>}
                {c.contact_phone && <div>{c.contact_phone}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

const Field = ({ label, v, on }: { label: string; v: string; on: (v: string) => void }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input value={v} onChange={(e) => on(e.target.value)} />
  </div>
);

export default AdminDashboard;
