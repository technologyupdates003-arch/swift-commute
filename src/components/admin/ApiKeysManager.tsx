import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, Plus, Copy, Ban, ShieldAlert } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  company_id: string;
};

export default function ApiKeysManager({ scope }: { scope: "super" | "company" }) {
  const { companyId } = useAuth();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [companies, setCompanies] = useState<Array<{ id: string; name: string }>>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  const load = async () => {
    let q = supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    if (scope === "company" && companyId) q = q.eq("company_id", companyId);
    const { data } = await q;
    setKeys((data as ApiKey[]) ?? []);
    if (scope === "super") {
      const { data: cs } = await supabase.from("companies").select("id, name").order("name");
      setCompanies(cs ?? []);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, companyId]);

  const create = async () => {
    const targetCompany = scope === "company" ? companyId : selectedCompany;
    if (!targetCompany) { toast.error("Select a company"); return; }
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_api_key", {
      _company_id: targetCompany, _name: name.trim(),
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { api_key: string };
    setRevealed(result.api_key);
    setName("");
    setSelectedCompany("");
    load();
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key? It will stop working immediately.")) return;
    const { error } = await supabase.rpc("revoke_api_key", { _id: id });
    if (error) toast.error(error.message); else { toast.success("Key revoked"); load(); }
  };

  const copy = (txt: string) => { navigator.clipboard.writeText(txt); toast.success("Copied"); };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> API keys</CardTitle>
          <CardDescription>Use keys to authenticate REST API calls. See <a className="underline" href="/api">/api docs</a>.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setRevealed(null); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{revealed ? "Save your new API key" : "Create API key"}</DialogTitle></DialogHeader>
            {revealed ? (
              <>
                <Alert><ShieldAlert className="h-4 w-4" />
                  <AlertDescription>This key is shown once. Copy and store it securely — you won't see it again.</AlertDescription>
                </Alert>
                <div className="flex gap-2 mt-2">
                  <Input readOnly value={revealed} className="font-mono text-xs" />
                  <Button size="icon" variant="outline" onClick={() => copy(revealed)}><Copy className="h-4 w-4" /></Button>
                </div>
                <DialogFooter><Button onClick={() => { setRevealed(null); setOpen(false); }}>Done</Button></DialogFooter>
              </>
            ) : (
              <>
                <div className="grid gap-3">
                  <div><Label>Key name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Production server" /></div>
                  {scope === "super" && (
                    <div>
                      <Label>Company</Label>
                      <select className="w-full h-10 px-3 rounded-md border bg-background" value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
                        <option value="">Select company…</option>
                        {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={create} disabled={busy}>{busy ? "Creating…" : "Create"}</Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No API keys yet.</p>
        ) : (
          <div className="divide-y">
            {keys.map((k) => (
              <div key={k.id} className="py-3 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{k.name}</p>
                    {k.revoked_at
                      ? <Badge variant="destructive">Revoked</Badge>
                      : <Badge variant="secondary">Active</Badge>}
                  </div>
                  <code className="text-xs text-muted-foreground">{k.key_prefix}…</code>
                  <p className="text-xs text-muted-foreground">
                    Created {new Date(k.created_at).toLocaleDateString()}
                    {k.last_used_at && ` · Last used ${new Date(k.last_used_at).toLocaleDateString()}`}
                  </p>
                </div>
                {!k.revoked_at && (
                  <Button size="sm" variant="outline" onClick={() => revoke(k.id)} className="gap-1.5">
                    <Ban className="h-4 w-4" /> Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
