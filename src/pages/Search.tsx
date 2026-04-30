import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bus, Clock, MapPin } from "lucide-react";

interface TripRow {
  id: string;
  departure_at: string;
  price: number;
  routes: { origin: string; destination: string } | null;
  buses: { plate_number: string; capacity: number; bus_type: string } | null;
  companies: { name: string } | null;
}

const Search = () => {
  const [params, setParams] = useSearchParams();
  const [origin, setOrigin] = useState(params.get("origin") ?? "");
  const [destination, setDestination] = useState(params.get("destination") ?? "");
  const [date, setDate] = useState(params.get("date") ?? new Date().toISOString().slice(0, 10));
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(false);

  const dayStart = useMemo(() => new Date(date + "T00:00:00").toISOString(), [date]);
  const dayEnd = useMemo(() => new Date(date + "T23:59:59").toISOString(), [date]);

  const runSearch = async () => {
    setLoading(true);
    let query = supabase
      .from("trips")
      .select("id, departure_at, price, routes(origin,destination), buses(plate_number,capacity,bus_type), companies(name)")
      .eq("status", "scheduled")
      .gte("departure_at", dayStart)
      .lte("departure_at", dayEnd)
      .order("departure_at", { ascending: true });

    const { data, error } = await query;
    if (!error && data) {
      const filtered = (data as unknown as TripRow[]).filter((t) => {
        const o = t.routes?.origin?.toLowerCase() ?? "";
        const d = t.routes?.destination?.toLowerCase() ?? "";
        const matchO = !origin || o.includes(origin.toLowerCase());
        const matchD = !destination || d.includes(destination.toLowerCase());
        return matchO && matchD;
      });
      setTrips(filtered);
    }
    setLoading(false);
  };

  useEffect(() => { runSearch(); /* eslint-disable-next-line */ }, [params]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setParams({ origin, destination, date });
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container py-8">
        <Card className="shadow-card">
          <CardContent className="p-4">
            <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
              <Input placeholder="From" value={origin} onChange={(e) => setOrigin(e.target.value)} />
              <Input placeholder="To" value={destination} onChange={(e) => setDestination(e.target.value)} />
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <Button type="submit" className="bg-brand-gradient hover:opacity-90">Search</Button>
            </form>
          </CardContent>
        </Card>

        <div className="mt-6 space-y-3">
          {loading && <p className="text-center text-muted-foreground">Searching trips…</p>}
          {!loading && trips.length === 0 && (
            <Card><CardContent className="p-10 text-center text-muted-foreground">
              No scheduled trips found for this date. Try a different date or city.
            </CardContent></Card>
          )}
          {trips.map((t) => {
            const dt = new Date(t.departure_at);
            return (
              <Card key={t.id} className="shadow-card transition hover:shadow-elegant">
                <CardContent className="flex flex-col items-start gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground">
                      <Bus className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold">{t.companies?.name ?? "Operator"}</h3>
                        <Badge variant="secondary" className="uppercase">{t.buses?.bus_type ?? "normal"}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{t.routes?.origin} → {t.routes?.destination}</span>
                        <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <span>Bus {t.buses?.plate_number}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex w-full items-center justify-between gap-4 md:w-auto">
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">From</div>
                      <div className="text-2xl font-bold text-primary">KES {Number(t.price).toLocaleString()}</div>
                    </div>
                    <Link to={`/book/${t.id}`}>
                      <Button className="bg-brand-gradient hover:opacity-90">Select seat</Button>
                    </Link>
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

export default Search;
