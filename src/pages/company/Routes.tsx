import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { companyNav } from "@/components/layout/companyNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Map, Plus, Trash2, Pencil, ArrowRight } from "lucide-react";

interface RouteRow { id: string; origin: string; destination: string; base_price: number; is_active: boolean }

const RoutesPage = () => {
  const { companyId } = useAuth();
  const [rows, setRows] = useState<RouteRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [price, setPrice] = useState(1000);

  const load = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("routes").select("*").eq("company_id", companyId).order("origin");
    setRows((data ?? []) as RouteRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const reset = () => { setEditing(null); setOrigin(""); setDestination(""); setPrice(1000); };
  const openEdit = (r: RouteRow) => { setEditing(r); setOrigin(r.origin); setDestination(r.destination); setPrice(Number(r.base_price)); setOpen(true); };

  const save = async () => {
    if (!companyId || !origin.trim() || !destination.trim()) return;
    const payload = { origin: origin.trim(), destination: destination.trim(), base_price: price };
    if (editing) {
      const { error } = await supabase.from("routes").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: "Route updated" });
    } else {
      const { error } = await supabase.from("routes").insert({ ...payload, company_id: companyId });
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: "Route added" });
    }
    setOpen(false); reset(); load();
  };

  const toggleActive = async (r: RouteRow) => {
    const { error } = await supabase.from("routes").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    load();
  };
  const remove = async (r: RouteRow) => {
    if (!confirm(`Delete route ${r.origin} → ${r.destination}?`)) return;
    const { error } = await supabase.from("routes").delete().eq("id", r.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Route deleted" }); load();
  };

  return (
    <DashboardShell title="Routes" subtitle="Origin → destination" nav={companyNav}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Routes</h1>
            <p className="text-sm text-muted-foreground">Manage travel routes and base pricing.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button className="gap-1.5 bg-brand-gradient hover:opacity-90"><Plus className="h-4 w-4" /> Add route</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit route" : "Add route"}</DialogTitle>
                <DialogDescription>Define an origin, destination, and base price.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Origin</Label><Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Nairobi" /></div>
                  <div className="space-y-1.5"><Label>Destination</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Mombasa" /></div>
                </div>
                <div className="space-y-1.5"><Label>Base price (KES)</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Map className="h-5 w-5 text-primary" /><CardTitle className="text-base">Routes ({rows.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No routes yet.</p>
            ) : (
              <div className="divide-y">
                {rows.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1 min-w-[200px] flex items-center gap-2 font-semibold">
                      {r.origin} <ArrowRight className="h-4 w-4 text-muted-foreground" /> {r.destination}
                    </div>
                    <div className="text-sm font-mono">KES {Number(r.base_price).toLocaleString()}</div>
                    <Badge variant={r.is_active ? "default" : "secondary"}>{r.is_active ? "Active" : "Inactive"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(r)}>{r.is_active ? "Deactivate" : "Activate"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
};

export default RoutesPage;
