import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Bus, Save, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type SeatClass = "economy" | "business" | "vip";

interface BusRow { id: string; plate_number: string; capacity: number; bus_type: string }
interface SeatRow {
  id?: string;
  bus_id: string;
  seat_number: string;
  class: SeatClass;
  row_index: number;
  col_index: number;
  price_multiplier: number;
  is_active: boolean;
  _local?: boolean;
}

const CLASS_BG: Record<SeatClass, string> = {
  economy:  "bg-sky-100 hover:bg-sky-200 ring-sky-300",
  business: "bg-rose-100 hover:bg-rose-200 ring-rose-300",
  vip:      "bg-amber-100 hover:bg-amber-200 ring-amber-300",
};

const BusLayoutEditor = ({ companyId }: { companyId: string }) => {
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [busId, setBusId] = useState<string>("");
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [activeClass, setActiveClass] = useState<SeatClass>("economy");
  const [busy, setBusy] = useState(false);

  // Quick-generate form
  const [rows, setRows] = useState(10);
  const [layout, setLayout] = useState<"2x2" | "2x1" | "3x2">("2x2");

  const load = async () => {
    const { data: bs } = await supabase.from("buses").select("id, plate_number, capacity, bus_type").eq("company_id", companyId).order("created_at");
    const list = (bs ?? []) as BusRow[];
    setBuses(list);
    if (list.length && !busId) setBusId(list[0].id);
  };
  useEffect(() => { if (companyId) load(); /* eslint-disable-next-line */ }, [companyId]);

  useEffect(() => {
    if (!busId) { setSeats([]); return; }
    (async () => {
      const { data } = await supabase.from("seats").select("*").eq("bus_id", busId).order("row_index").order("col_index");
      setSeats(((data ?? []) as SeatRow[]).map((s) => ({ ...s, _local: false })));
    })();
  }, [busId]);

  const generate = () => {
    if (!busId) return;
    const cols = layout === "2x2" ? 5 : layout === "2x1" ? 4 : 6; // includes aisle gap
    const aisleCol = layout === "2x2" ? 3 : layout === "2x1" ? 3 : 4;
    const next: SeatRow[] = [];
    let n = 1;
    for (let r = 1; r <= rows; r++) {
      for (let c = 1; c <= cols; c++) {
        if (c === aisleCol) continue;
        next.push({
          bus_id: busId,
          seat_number: String(n),
          class: r <= 2 ? "vip" : r <= 4 ? "business" : "economy",
          row_index: r, col_index: c,
          price_multiplier: r <= 2 ? 1.5 : r <= 4 ? 1.2 : 1.0,
          is_active: true,
          _local: true,
        });
        n++;
      }
    }
    setSeats(next);
    toast({ title: "Layout generated", description: "Adjust seat classes, then save." });
  };

  const cycleClass = (s: SeatRow) => {
    const order: SeatClass[] = ["economy", "business", "vip"];
    const i = order.indexOf(s.class);
    const next = order[(i + 1) % order.length];
    const mult = next === "vip" ? 1.5 : next === "business" ? 1.2 : 1.0;
    setSeats((arr) => arr.map((x) => x === s ? { ...x, class: next, price_multiplier: mult, _local: true } : x));
  };

  const saveAll = async () => {
    if (!busId || seats.length === 0) return;
    setBusy(true);
    // Replace strategy: delete existing, insert fresh. Simple & deterministic.
    const { error: delErr } = await supabase.from("seats").delete().eq("bus_id", busId);
    if (delErr) { setBusy(false); toast({ title: "Save failed", description: delErr.message, variant: "destructive" }); return; }
    const payload = seats.map(({ _local, id, ...rest }) => rest);
    const { error } = await supabase.from("seats").insert(payload);
    setBusy(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Layout saved", description: `${seats.length} seats stored.` });
    // Reload
    const { data } = await supabase.from("seats").select("*").eq("bus_id", busId).order("row_index").order("col_index");
    setSeats(((data ?? []) as SeatRow[]).map((s) => ({ ...s, _local: false })));
  };

  const wipe = async () => {
    if (!busId) return;
    if (!confirm("Delete all seats for this bus?")) return;
    const { error } = await supabase.from("seats").delete().eq("bus_id", busId);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setSeats([]);
    toast({ title: "Cleared" });
  };

  const maxRow = useMemo(() => seats.reduce((m, s) => Math.max(m, s.row_index), 0), [seats]);
  const maxCol = useMemo(() => seats.reduce((m, s) => Math.max(m, s.col_index), 0), [seats]);

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Bus className="h-5 w-5 text-primary" />
          <CardTitle>Bus seat layout</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {buses.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Add a bus first to configure its seats.
          </p>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto] md:items-end">
              <div className="space-y-1.5">
                <Label>Bus</Label>
                <Select value={busId} onValueChange={setBusId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {buses.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.plate_number} • {b.bus_type} • cap {b.capacity}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rows</Label>
                <Input type="number" min={1} max={20} value={rows} onChange={(e) => setRows(Number(e.target.value))} className="w-20" />
              </div>
              <div className="space-y-1.5">
                <Label>Layout</Label>
                <Select value={layout} onValueChange={(v) => setLayout(v as typeof layout)}>
                  <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2x2">2 + 2</SelectItem>
                    <SelectItem value="2x1">2 + 1 (VIP)</SelectItem>
                    <SelectItem value="3x2">3 + 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={generate} variant="outline" className="gap-1.5">
                <Sparkles className="h-4 w-4" /> Generate
              </Button>
              <div className="flex gap-2">
                <Button onClick={saveAll} disabled={busy || seats.length === 0} className="gap-1.5 bg-primary">
                  <Save className="h-4 w-4" /> Save
                </Button>
                <Button onClick={wipe} variant="ghost" size="icon" aria-label="Clear">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
              Click a seat to cycle its class: <b className="text-sky-700">Economy</b> → <b className="text-rose-700">Business</b> → <b className="text-amber-700">VIP</b>.
              VIP price multiplier 1.5×, Business 1.2×, Economy 1.0×.
            </div>

            {seats.length > 0 && (
              <div className="mx-auto w-fit rounded-2xl border-2 border-muted bg-background p-4">
                <div className="mb-3 rounded-md bg-muted px-3 py-1 text-center text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Driver</div>
                <div className="space-y-2">
                  {Array.from({ length: maxRow }).map((_, r) => {
                    const rowIndex = r + 1;
                    return (
                      <div key={rowIndex} className="flex items-center gap-2">
                        <span className="w-5 text-right text-[10px] font-bold text-muted-foreground">{rowIndex}</span>
                        {Array.from({ length: maxCol }).map((_, c) => {
                          const colIndex = c + 1;
                          const seat = seats.find((s) => s.row_index === rowIndex && s.col_index === colIndex);
                          if (!seat) return <div key={colIndex} className="h-10 w-10" />;
                          return (
                            <button
                              key={colIndex}
                              type="button"
                              onClick={() => cycleClass(seat)}
                              className={cn(
                                "h-10 w-10 rounded-lg text-[11px] font-bold ring-2 ring-inset transition",
                                CLASS_BG[seat.class]
                              )}
                              title={`${seat.seat_number} • ${seat.class}`}
                            >
                              {seat.seat_number}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default BusLayoutEditor;
