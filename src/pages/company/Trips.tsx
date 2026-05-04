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
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { CalendarClock, Plus, Trash2, Pencil, Repeat } from "lucide-react";

interface TripRow {
  id: string; price: number; departure_at: string; bus_id: string; route_id: string; status: string;
  is_daily: boolean;
  buses: { plate_number: string } | null;
  routes: { origin: string; destination: string } | null;
}
interface BusOpt { id: string; plate_number: string }
interface RouteOpt { id: string; origin: string; destination: string; base_price: number }

const TripsPage = () => {
  const { companyId } = useAuth();
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [routes, setRoutes] = useState<RouteOpt[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TripRow | null>(null);
  const [routeId, setRouteId] = useState("");
  const [busId, setBusId] = useState("");
  const [departure, setDeparture] = useState("");
  const [price, setPrice] = useState(0);
  const [status, setStatus] = useState("scheduled");
  const [isDaily, setIsDaily] = useState(false);

  const load = async () => {
    if (!companyId) return;
    const [{ data: ts }, { data: bs }, { data: rs }] = await Promise.all([
      supabase.from("trips").select("*, buses(plate_number), routes(origin,destination)").eq("company_id", companyId).order("departure_at", { ascending: false }),
      supabase.from("buses").select("id, plate_number").eq("company_id", companyId).eq("is_active", true),
      supabase.from("routes").select("id, origin, destination, base_price").eq("company_id", companyId).eq("is_active", true),
    ]);
    setTrips((ts ?? []) as any);
    setBuses((bs ?? []) as BusOpt[]);
    setRoutes((rs ?? []) as RouteOpt[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const reset = () => { setEditing(null); setRouteId(""); setBusId(""); setDeparture(""); setPrice(0); setStatus("scheduled"); setIsDaily(false); };
  const openEdit = (t: TripRow) => {
    setEditing(t); setRouteId(t.route_id); setBusId(t.bus_id);
    setDeparture(new Date(t.departure_at).toISOString().slice(0, 16));
    setPrice(Number(t.price)); setStatus(t.status); setIsDaily(!!t.is_daily); setOpen(true);
  };

  const save = async () => {
    if (!companyId || !routeId || !busId || !departure) return toast({ title: "Fill all fields", variant: "destructive" });
    const dep = new Date(departure);
    const hh = String(dep.getHours()).padStart(2, "0");
    const mm = String(dep.getMinutes()).padStart(2, "0");
    const payload: any = {
      route_id: routeId, bus_id: busId, departure_at: dep.toISOString(),
      price, status: status as any, is_daily: isDaily,
      departure_time: `${hh}:${mm}:00`,
    };
    if (editing) {
      const { error } = await supabase.from("trips").update(payload).eq("id", editing.id);
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: "Trip updated" });
    } else {
      const { error } = await supabase.from("trips").insert({ ...payload, company_id: companyId });
      if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
      toast({ title: isDaily ? "Daily trip scheduled — auto-rolls each day" : "Trip scheduled" });
    }
    setOpen(false); reset(); load();
  };

  const remove = async (t: TripRow) => {
    if (!confirm("Delete this trip?")) return;
    const { error } = await supabase.from("trips").delete().eq("id", t.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Trip deleted" }); load();
  };

  const onRouteChange = (id: string) => {
    setRouteId(id);
    const r = routes.find((x) => x.id === id);
    if (r && !editing) setPrice(Number(r.base_price));
  };

  return (
    <DashboardShell title="Trips" subtitle="Daily schedules" nav={companyNav}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Trips</h1>
            <p className="text-sm text-muted-foreground">Schedule departures across your routes.</p>
          </div>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
            <DialogTrigger asChild><Button className="gap-1.5 bg-brand-gradient hover:opacity-90"><Plus className="h-4 w-4" /> Schedule trip</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Edit trip" : "Schedule trip"}</DialogTitle>
                <DialogDescription>Pick a route, bus, time and price.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="space-y-1.5">
                  <Label>Route</Label>
                  <Select value={routeId} onValueChange={onRouteChange}>
                    <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
                    <SelectContent>
                      {routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.origin} → {r.destination}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Bus</Label>
                  <Select value={busId} onValueChange={setBusId}>
                    <SelectTrigger><SelectValue placeholder="Select bus" /></SelectTrigger>
                    <SelectContent>
                      {buses.map((b) => <SelectItem key={b.id} value={b.id}>{b.plate_number}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5"><Label>Departure</Label><Input type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} /></div>
                  <div className="space-y-1.5"><Label>Price (KES)</Label><Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} /></div>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="departed">Departed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-1.5"><Repeat className="h-4 w-4" /> Repeat daily</Label>
                    <p className="text-xs text-muted-foreground">Auto-creates this trip every day at the same time. No need to reschedule.</p>
                  </div>
                  <Switch checked={isDaily} onCheckedChange={setIsDaily} />
                </div>
              </div>
              <DialogFooter><Button onClick={save}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <CalendarClock className="h-5 w-5 text-primary" /><CardTitle className="text-base">Trips ({trips.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {trips.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No trips scheduled. {routes.length === 0 && "Add a route first."} {buses.length === 0 && "Add a bus first."}</p>
            ) : (
              <div className="divide-y">
                {trips.map((t) => (
                  <div key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1 min-w-[200px]">
                      <div className="font-semibold">{t.routes?.origin} → {t.routes?.destination}</div>
                      <div className="text-xs text-muted-foreground">{new Date(t.departure_at).toLocaleString()} • {t.buses?.plate_number}</div>
                    </div>
                    <div className="text-sm font-mono">KES {Number(t.price).toLocaleString()}</div>
                    <Badge variant="secondary" className="capitalize">{t.status}</Badge>
                    {t.is_daily && <Badge className="gap-1"><Repeat className="h-3 w-3" /> Daily</Badge>}
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

export default TripsPage;
