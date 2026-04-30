import { useEffect, useMemo, useState } from "react";
import DashboardShell, { DashNavItem } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Building2, Percent, Plus, Save, Power, Copy, Activity, BarChart3, ScrollText } from "lucide-react";
import { z } from "zod";

const companySchema = z.object({
  name: z.string().trim().min(2).max(100),
  slug: z.string().trim().min(2).max(60).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  contact_email: z.string().trim().email().max(255).optional().or(z.literal("")),
  contact_phone: z.string().trim().max(20).optional().or(z.literal("")),
  commission_pct: z.coerce.number().min(0).max(100),
  admin_full_name: z.string().trim().min(2).max(100),
  admin_email: z.string().trim().email().max(255),
});

type Company = {
  id: string; name: string; slug: string;
  contact_email: string | null; contact_phone: string | null;
  is_active: boolean; commission_pct: number;
};

const adminNav: DashNavItem[] = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/", label: "Public site", icon: Building2 },
];

const AdminDashboard = () => {
  return (
    <DashboardShell title="Super admin" subtitle="Control center" nav={adminNav}>
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Super admin · Control center</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage tenants, monitor revenue, and review platform activity.</p>
      </div>

      <Tabs defaultValue="companies" className="mt-6">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="companies"><Building2 className="mr-1.5 h-4 w-4" />Companies</TabsTrigger>
          <TabsTrigger value="revenue"><BarChart3 className="mr-1.5 h-4 w-4" />Revenue & analytics</TabsTrigger>
          <TabsTrigger value="audit"><ScrollText className="mr-1.5 h-4 w-4" />Audit logs</TabsTrigger>
        </TabsList>
        <TabsContent value="companies" className="mt-6"><CompaniesTab /></TabsContent>
        <TabsContent value="revenue" className="mt-6"><RevenueTab /></TabsContent>
        <TabsContent value="audit" className="mt-6"><AuditTab /></TabsContent>
      </Tabs>
    </DashboardShell>
  );
};

/* ======================== COMPANIES ======================== */
const CompaniesTab = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", slug: "", contact_email: "", contact_phone: "", commission_pct: 10,
    admin_full_name: "", admin_email: "",
  });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<string, number>>({});
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; company: string } | null>(null);

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
    const { data, error } = await supabase.functions.invoke("admin-create-company", { body: parsed.data });
    setBusy(false);
    if (error || (data as any)?.error) {
      toast({ title: "Failed", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    const res = data as any;
    setOpen(false);
    setForm({ name: "", slug: "", contact_email: "", contact_phone: "", commission_pct: 10, admin_full_name: "", admin_email: "" });
    if (res.admin?.temp_password) {
      setCreatedCreds({ email: res.admin.email, password: res.admin.temp_password, company: res.company.name });
    } else {
      toast({ title: "Company created", description: "Existing user was linked as admin." });
    }
    load();
  };

  const saveCommission = async (id: string) => {
    const v = editing[id];
    if (v === undefined) return;
    if (v < 0 || v > 100) { toast({ title: "Commission must be 0–100%", variant: "destructive" }); return; }
    const { error } = await supabase.from("companies").update({ commission_pct: v }).eq("id", id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Commission updated" });
    setEditing((s) => { const n = { ...s }; delete n[id]; return n; });
    load();
  };

  const toggleActive = async (c: Company) => {
    const { error } = await supabase.from("companies").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: c.is_active ? "Company suspended" : "Company activated" });
    load();
  };

  return (
    <>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-brand-gradient hover:opacity-90"><Plus className="h-4 w-4" /> New company</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Create bus company + admin</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Company name" v={form.name} on={(v) => setForm({ ...form, name: v })} />
              <Field label="Slug (URL-friendly)" v={form.slug} on={(v) => setForm({ ...form, slug: v.toLowerCase() })} />
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Contact email" v={form.contact_email} on={(v) => setForm({ ...form, contact_email: v })} />
                <Field label="Contact phone" v={form.contact_phone} on={(v) => setForm({ ...form, contact_phone: v })} />
              </div>
              <Field label="Commission % per booking" type="number" v={String(form.commission_pct)} on={(v) => setForm({ ...form, commission_pct: Number(v) })} />
              <div className="mt-2 rounded-md border bg-muted/30 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wider">Company admin login</div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Field label="Admin full name" v={form.admin_full_name} on={(v) => setForm({ ...form, admin_full_name: v })} />
                  <Field label="Admin email" v={form.admin_email} on={(v) => setForm({ ...form, admin_email: v })} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">A temporary password is generated and shown once after creation.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button className="bg-brand-gradient" onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3"><CardContent className="p-10 text-center text-muted-foreground">
            No companies yet.
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
                  {c.is_active ? "Active" : "Suspended"}
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

                <Button size="sm" variant={c.is_active ? "outline" : "default"} className="w-full gap-2" onClick={() => toggleActive(c)}>
                  <Power className="h-3.5 w-3.5" />
                  {c.is_active ? "Suspend" : "Activate"}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!createdCreds} onOpenChange={(o) => !o && setCreatedCreds(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Admin credentials — save these now</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">This password will not be shown again. Send it to the company admin securely.</p>
            <div className="rounded-md border bg-muted/30 p-3 font-mono">
              <div><span className="text-muted-foreground">Company:</span> {createdCreds?.company}</div>
              <div><span className="text-muted-foreground">Email:</span> {createdCreds?.email}</div>
              <div><span className="text-muted-foreground">Password:</span> {createdCreds?.password}</div>
            </div>
            <Button className="w-full gap-2" onClick={() => {
              navigator.clipboard.writeText(`Email: ${createdCreds?.email}\nPassword: ${createdCreds?.password}`);
              toast({ title: "Copied to clipboard" });
            }}><Copy className="h-4 w-4" />Copy credentials</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

/* ======================== REVENUE ======================== */
const RevenueTab = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [parcels, setParcels] = useState<any[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: p }, { data: c }] = await Promise.all([
        supabase.from("bookings").select("amount,commission_amount,company_id,status,created_at").eq("status", "paid").limit(5000),
        supabase.from("parcels").select("price,company_id,payment_status,created_at").eq("payment_status", "paid").limit(5000),
        supabase.from("companies").select("*"),
      ]);
      setBookings(b ?? []); setParcels(p ?? []); setCompanies((c ?? []) as Company[]);
    })();
  }, []);

  const stats = useMemo(() => {
    const ticketRev = bookings.reduce((s, x) => s + Number(x.amount || 0), 0);
    const parcelRev = parcels.reduce((s, x) => s + Number(x.price || 0), 0);
    const commission = bookings.reduce((s, x) => s + Number(x.commission_amount || 0), 0);
    const byCompany: Record<string, { tickets: number; parcels: number; bookings: number; parcels_count: number }> = {};
    for (const b of bookings) {
      byCompany[b.company_id] ??= { tickets: 0, parcels: 0, bookings: 0, parcels_count: 0 };
      byCompany[b.company_id].tickets += Number(b.amount || 0);
      byCompany[b.company_id].bookings += 1;
    }
    for (const p of parcels) {
      byCompany[p.company_id] ??= { tickets: 0, parcels: 0, bookings: 0, parcels_count: 0 };
      byCompany[p.company_id].parcels += Number(p.price || 0);
      byCompany[p.company_id].parcels_count += 1;
    }
    return { ticketRev, parcelRev, commission, byCompany };
  }, [bookings, parcels]);

  const fmt = (n: number) => `KES ${Math.round(n).toLocaleString()}`;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Ticket revenue" value={fmt(stats.ticketRev)} />
        <StatCard title="Parcel revenue" value={fmt(stats.parcelRev)} />
        <StatCard title="Platform commission" value={fmt(stats.commission)} highlight />
        <StatCard title="Active companies" value={String(companies.filter((c) => c.is_active).length)} />
      </div>

      <Card className="shadow-card">
        <CardHeader><CardTitle>By company</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr><th className="py-2">Company</th><th>Bookings</th><th>Ticket rev</th><th>Parcels</th><th>Parcel rev</th></tr>
              </thead>
              <tbody className="divide-y">
                {companies.map((c) => {
                  const s = stats.byCompany[c.id] ?? { tickets: 0, parcels: 0, bookings: 0, parcels_count: 0 };
                  return (
                    <tr key={c.id} className="py-2">
                      <td className="py-2 font-medium">{c.name}</td>
                      <td>{s.bookings}</td>
                      <td>{fmt(s.tickets)}</td>
                      <td>{s.parcels_count}</td>
                      <td>{fmt(s.parcels)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ title, value, highlight }: { title: string; value: string; highlight?: boolean }) => (
  <Card className={`shadow-card ${highlight ? "border-primary/40 bg-primary/5" : ""}`}>
    <CardContent className="p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</div>
      <div className="mt-2 text-2xl font-bold">{value}</div>
    </CardContent>
  </Card>
);

/* ======================== AUDIT ======================== */
const AuditTab = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500);
      setLogs(data ?? []);
    })();
    const ch = supabase.channel("audit-feed").on("postgres_changes",
      { event: "INSERT", schema: "public", table: "audit_logs" },
      (payload) => setLogs((prev) => [payload.new as any, ...prev].slice(0, 500))
    ).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = logs.filter((l) =>
    !search.trim() ||
    l.action?.toLowerCase().includes(search.toLowerCase()) ||
    l.entity?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" />Recent activity</CardTitle>
        <Input className="mt-2" placeholder="Filter by action or entity..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-md border">
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No activity yet.</div>}
          {filtered.map((l) => (
            <div key={l.id} className="flex flex-col gap-1 p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono">{l.action}</Badge>
                  <span className="text-xs text-muted-foreground">{l.entity}</span>
                </div>
                {(l.before || l.after || l.meta) && (
                  <div className="mt-1 max-w-2xl truncate text-xs text-muted-foreground">
                    {JSON.stringify(l.after ?? l.meta ?? l.before)}
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, v, on, type = "text" }: { label: string; v: string; on: (v: string) => void; type?: string }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
  </div>
);

export default AdminDashboard;
