import { useEffect, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { companyNav } from "@/components/layout/companyNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Bus, Plus, Trash2, Pencil } from "lucide-react";
import BusLayoutEditor from "@/components/admin/BusLayoutEditor";

interface BusRow { id: string; plate_number: string; capacity: number; bus_type: string; is_active: boolean }

const Fleet = () => {
  const { companyId } = useAuth();
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BusRow | null>(null);
  const [plate, setPlate] = useState("");
  const [capacity, setCapacity] = useState(45);
  const [busType, setBusType] = useState("normal");

  const load = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("buses").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setBuses((data ?? []) as BusRow[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const reset = () => { setEditing(null); setPlate(""); setCapacity(45); setBusType("normal"); };

  const openEdit = (b: BusRow) => {
    setEditing(b); setPlate(b.plate_number); setCapacity(b.capacity); setBusType(b.bus_type); setOpen(true);
  };

  const save = async () => {
    if (!companyId || !plate.trim()) return;
    if (editing) {
      const { error } = await supabase.from("buses").update({ plate_number: plate.trim(), capacity, bus_type: busType as any }).eq("id", editing.id);
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: "Bus updated" });
    } else {
      const { error } = await supabase.from("buses").insert({ company_id: companyId, plate_number: plate.trim(), capacity, bus_type: busType as any });
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: "Bus added" });
    }
    setOpen(false); reset(); load();
  };

  const toggleActive = async (b: BusRow) => {
    const { error } = await supabase.from("buses").update({ is_active: !b.is_active }).eq("id", b.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    load();
  };

  const remove = async (b: BusRow) => {
    if (!confirm(`Delete bus ${b.plate_number}? This also deletes its seats.`)) return;
    const { error } = await supabase.from("buses").delete().eq("id", b.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Bus deleted" }); load();
  };

  return (
    <DashboardShell title="Fleet" subtitle="Buses & layouts" nav={companyNav}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fleet</h1>
            <p className="text-sm text-muted-foreground">Manage buses and design seat layouts.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild>
              <Button className="gap-1.5 bg-brand-gradient hover:opacity-90"><Plus className="h-4 w-4" /> Add bus</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit bus" : "Add bus"}</DialogTitle>
                <DialogDescription>Register a vehicle in your fleet.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5"><Label>Plate number</Label><Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="KDA 123A" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Capacity</Label><Input type="number" min={1} max={80} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} /></div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select value={busType} onValueChange={setBusType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="vip">VIP</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Bus className="h-5 w-5 text-primary" /><CardTitle className="text-base">Buses ({buses.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {buses.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No buses yet. Add your first bus.</p>
            ) : (
              <div className="divide-y">
                {buses.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1 min-w-[160px]">
                      <div className="font-semibold">{b.plate_number}</div>
                      <div className="text-xs text-muted-foreground">Capacity {b.capacity} • {b.bus_type}</div>
                    </div>
                    <Badge variant={b.is_active ? "default" : "secondary"}>{b.is_active ? "Active" : "Inactive"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(b)}>{b.is_active ? "Deactivate" : "Activate"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(b)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {companyId && <BusLayoutEditor companyId={companyId} />}
      </div>
    </DashboardShell>
  );
};

export default Fleet;
