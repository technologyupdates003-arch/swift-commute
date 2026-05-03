import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { companyNav } from "@/components/layout/companyNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Save, ShieldCheck, ShieldAlert, Smartphone, Building2 } from "lucide-react";

interface MpesaStatus {
  configured: boolean;
  is_enabled: boolean;
  environment: string;
  business_shortcode?: string | null;
  party_b?: string | null;
  callback_url?: string | null;
  has_consumer_key?: boolean;
  has_consumer_secret?: boolean;
  has_passkey?: boolean;
  updated_at?: string;
}

interface Company {
  name: string;
  slug: string;
  contact_email: string | null;
  contact_phone: string | null;
}

const Settings = () => {
  const { companyId, hasRole } = useAuth();
  const isAdmin = hasRole("company_admin") || hasRole("super_admin");

  const [company, setCompany] = useState<Company | null>(null);
  const [companySaving, setCompanySaving] = useState(false);

  const [status, setStatus] = useState<MpesaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    environment: "production",
    business_shortcode: "",
    party_b: "",
    consumer_key: "",
    consumer_secret: "",
    passkey: "",
    callback_url: "",
    is_enabled: false,
  });

  const load = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: co }, { data: mp, error }] = await Promise.all([
        supabase.from("companies").select("name, slug, contact_email, contact_phone").eq("id", companyId).maybeSingle(),
        supabase.functions.invoke("company-mpesa-settings", { body: { action: "get", company_id: companyId } }),
      ]);
      if (co) setCompany(co as Company);
      if (error) throw error;
      const s = (mp?.data ?? null) as MpesaStatus | null;
      setStatus(s);
      if (s) {
        setForm((f) => ({
          ...f,
          environment: "production",
          business_shortcode: s.business_shortcode ?? "",
          party_b: s.party_b ?? "",
          callback_url: s.callback_url ?? "",
          is_enabled: !!s.is_enabled,
        }));
      }
    } catch (e) {
      toast.error("Failed to load settings", { description: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const saveCompany = async () => {
    if (!companyId || !company) return;
    setCompanySaving(true);
    const { error } = await supabase.from("companies").update({
      name: company.name,
      contact_email: company.contact_email,
      contact_phone: company.contact_phone,
    }).eq("id", companyId);
    setCompanySaving(false);
    if (error) return toast.error("Couldn't save", { description: error.message });
    toast.success("Company info saved");
  };

  const saveMpesa = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("company-mpesa-settings", {
        body: { action: "save", company_id: companyId, ...form },
      });
      if (error) throw error;
      setStatus(data?.data ?? null);
      setForm((f) => ({ ...f, consumer_key: "", consumer_secret: "", passkey: "" }));
      toast.success("M-Pesa credentials saved");
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  const clearMpesa = async () => {
    if (!companyId) return;
    if (!confirm("Remove all M-Pesa credentials for this company?")) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("company-mpesa-settings", {
        body: { action: "clear", company_id: companyId },
      });
      if (error) throw error;
      setStatus(null);
      setForm({
        environment: "production", business_shortcode: "", party_b: "",
        consumer_key: "", consumer_secret: "", passkey: "",
        callback_url: "", is_enabled: false,
      });
      toast.success("Credentials removed");
    } catch (e) {
      toast.error("Failed", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardShell title="Settings" subtitle="Company configuration" nav={companyNav}>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your company profile and payment integrations.</p>
        </div>

        {!companyId ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No company linked.</CardContent></Card>
        ) : loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Company profile */}
            <Card className="card-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Company profile</CardTitle>
                <CardDescription>Public-facing details for your company.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Company name</Label>
                    <Input value={company?.name ?? ""} disabled={!isAdmin}
                      onChange={(e) => setCompany((c) => c ? { ...c, name: e.target.value } : c)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Slug</Label>
                    <Input value={company?.slug ?? ""} disabled />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact email</Label>
                    <Input type="email" value={company?.contact_email ?? ""} disabled={!isAdmin}
                      onChange={(e) => setCompany((c) => c ? { ...c, contact_email: e.target.value } : c)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Contact phone</Label>
                    <Input value={company?.contact_phone ?? ""} disabled={!isAdmin}
                      onChange={(e) => setCompany((c) => c ? { ...c, contact_phone: e.target.value } : c)} />
                  </div>
                </div>
                {isAdmin && (
                  <Button onClick={saveCompany} disabled={companySaving} className="bg-brand-gradient hover:opacity-90">
                    {companySaving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                    Save profile
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* M-Pesa */}
            <Card className="card-soft">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" /> M-Pesa Daraja (STK Push)
                    </CardTitle>
                    <CardDescription>Connect your Safaricom Daraja credentials so customers can pay via STK Push.</CardDescription>
                  </div>
                  {status?.configured ? (
                    <Badge variant={status.is_enabled ? "default" : "secondary"} className="gap-1">
                      <ShieldCheck className="h-3 w-3" /> {status.is_enabled ? "Live" : "Configured"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1"><ShieldAlert className="h-3 w-3" /> Not set</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <Alert>
                  <AlertDescription className="text-xs">
                    Credentials are stored securely on the server and never displayed back. Leave a secret field blank to keep the existing value.
                    Get your keys from <a className="underline" href="https://developer.safaricom.co.ke" target="_blank" rel="noreferrer">developer.safaricom.co.ke</a>.
                  </AlertDescription>
                </Alert>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Environment</Label>
                    <Input value="Production (live)" disabled />
                    <p className="text-[11px] text-muted-foreground">All STK pushes run on Safaricom production. No sandbox.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Business shortcode (Paybill / Till)</Label>
                    <Input value={form.business_shortcode} onChange={(e) => setForm({ ...form, business_shortcode: e.target.value })} placeholder="174379" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Party B (receiver shortcode)</Label>
                    <Input value={form.party_b} onChange={(e) => setForm({ ...form, party_b: e.target.value })} placeholder="Usually same as shortcode" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Callback URL</Label>
                    <Input value={form.callback_url} onChange={(e) => setForm({ ...form, callback_url: e.target.value })} placeholder="https://yourdomain.com/mpesa/callback" disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Consumer Key {status?.has_consumer_key && <span className="text-xs text-muted-foreground">(saved — leave blank to keep)</span>}</Label>
                    <Input type="password" autoComplete="off" value={form.consumer_key} onChange={(e) => setForm({ ...form, consumer_key: e.target.value })} placeholder={status?.has_consumer_key ? "••••••••" : ""} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Consumer Secret {status?.has_consumer_secret && <span className="text-xs text-muted-foreground">(saved)</span>}</Label>
                    <Input type="password" autoComplete="off" value={form.consumer_secret} onChange={(e) => setForm({ ...form, consumer_secret: e.target.value })} placeholder={status?.has_consumer_secret ? "••••••••" : ""} disabled={!isAdmin} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Passkey {status?.has_passkey && <span className="text-xs text-muted-foreground">(saved)</span>}</Label>
                    <Input type="password" autoComplete="off" value={form.passkey} onChange={(e) => setForm({ ...form, passkey: e.target.value })} placeholder={status?.has_passkey ? "••••••••" : ""} disabled={!isAdmin} />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="text-sm font-medium">Enable STK Push</div>
                    <div className="text-xs text-muted-foreground">When on, bookings can charge customers via M-Pesa.</div>
                  </div>
                  <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm({ ...form, is_enabled: v })} disabled={!isAdmin} />
                </div>

                {isAdmin && (
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={saveMpesa} disabled={saving} className="bg-brand-gradient hover:opacity-90">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
                      Save M-Pesa settings
                    </Button>
                    {status?.configured && (
                      <Button variant="outline" onClick={clearMpesa} disabled={saving}>
                        Remove credentials
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
};

export default Settings;
