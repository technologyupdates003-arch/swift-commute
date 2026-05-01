import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Trash2, Copy, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type AppRole = "cashier" | "parcel_clerk" | "driver" | "conductor" | "company_admin";

const ROLE_OPTIONS: { value: AppRole; label: string; desc: string }[] = [
  { value: "cashier", label: "Cashier", desc: "Sells tickets at the counter" },
  { value: "parcel_clerk", label: "Parcel clerk", desc: "Registers & releases parcels" },
  { value: "conductor", label: "Conductor", desc: "Verifies seats & boarding" },
  { value: "driver", label: "Driver", desc: "Trip operator" },
  { value: "company_admin", label: "Company admin", desc: "Full company access" },
];

interface StaffRow {
  role_id: string;
  user_id: string;
  role: AppRole;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

export default function StaffManager({ companyId }: { companyId: string }) {
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", role: "cashier" as AppRole });
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("id, user_id, role, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load staff", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
    let profilesMap: Record<string, { full_name: string | null; phone: string | null }> = {};
    if (ids.length) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", ids);
      profilesMap = Object.fromEntries((profs ?? []).map((p) => [p.id, { full_name: p.full_name, phone: p.phone }]));
    }
    setRows(
      (roles ?? []).map((r) => ({
        role_id: r.id,
        user_id: r.user_id,
        role: r.role as AppRole,
        full_name: profilesMap[r.user_id]?.full_name ?? null,
        phone: profilesMap[r.user_id]?.phone ?? null,
        created_at: r.created_at,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (companyId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const submit = async () => {
    if (!form.full_name || !form.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setTempPassword(null);
    const { data, error } = await supabase.functions.invoke("company-create-staff", {
      body: { company_id: companyId, ...form },
    });
    setSubmitting(false);
    if (error || (data as any)?.error) {
      toast({ title: "Failed to add staff", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    if ((data as any)?.temp_password) {
      setTempPassword({ email: form.email, password: (data as any).temp_password });
    }
    toast({ title: "Staff added", description: `${form.full_name} can now sign in.` });
    setForm({ full_name: "", email: "", phone: "", role: "cashier" });
    await load();
  };

  const revoke = async (role_id: string, name: string | null) => {
    if (!confirm(`Remove ${name ?? "this staff member"}'s access?`)) return;
    const { data, error } = await supabase.functions.invoke("company-revoke-staff", {
      body: { role_id, company_id: companyId },
    });
    if (error || (data as any)?.error) {
      toast({ title: "Failed to remove", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Access revoked" });
    await load();
  };

  const copyPw = async () => {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword.password);
    toast({ title: "Password copied" });
  };

  return (
    <Card className="card-soft">
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Staff</CardTitle>
          <CardDescription>Drivers, cashiers, conductors, parcel clerks & co-admins.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTempPassword(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><UserPlus className="h-4 w-4" /> Add staff</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a staff member</DialogTitle>
              <DialogDescription>They'll receive an account and a temporary password.</DialogDescription>
            </DialogHeader>
            {tempPassword ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                  <div className="font-medium">Account ready ✅</div>
                  <div className="mt-1 text-muted-foreground">Email: <span className="font-mono">{tempPassword.email}</span></div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-muted-foreground">Temp password:</span>
                    <code className="rounded bg-background px-2 py-1 text-xs">{tempPassword.password}</code>
                    <Button type="button" size="sm" variant="ghost" onClick={copyPw}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Share this securely. Ask them to change it after first login.</p>
                </div>
                <DialogFooter>
                  <Button onClick={() => { setTempPassword(null); setOpen(false); }}>Done</Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <Label>Full name</Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Jane Doe" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@example.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label>Phone (optional)</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+2547..." />
                </div>
                <div className="grid gap-1.5">
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AppRole })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          <div className="flex flex-col">
                            <span>{r.label}</span>
                            <span className="text-xs text-muted-foreground">{r.desc}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                  <Button onClick={submit} disabled={submitting}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create staff
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading staff…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No staff yet. Click <span className="font-medium">Add staff</span> to invite drivers, cashiers, conductors and parcel clerks.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {rows.map((s) => (
              <div key={s.role_id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.full_name ?? "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">{s.phone ?? ""}</div>
                </div>
                <Badge variant="secondary" className="capitalize">{s.role.replace("_", " ")}</Badge>
                <Button variant="ghost" size="icon" onClick={() => revoke(s.role_id, s.full_name)} aria-label="Revoke">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
