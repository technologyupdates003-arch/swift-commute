import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, MapPin, CheckCircle2 } from "lucide-react";

type Movement = { status: string; location: string | null; note: string | null; created_at: string };
type Tracked = {
  tracking_id: string; status: string; payment_status: string; price: number;
  sender_name: string; receiver_name: string; description: string; weight_kg: number;
  company: string; origin: string; destination: string; created_at: string;
  movements: Movement[];
};

const statusColor: Record<string, string> = {
  created: "bg-muted text-foreground",
  paid: "bg-blue-500 text-white",
  dispatched: "bg-indigo-500 text-white",
  in_transit: "bg-amber-500 text-white",
  arrived: "bg-teal-500 text-white",
  ready_for_pickup: "bg-emerald-500 text-white",
  delivered: "bg-green-600 text-white",
  cancelled: "bg-destructive text-destructive-foreground",
};

const TrackParcel = () => {
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get("id") ?? "");
  const [data, setData] = useState<Tracked | null>(null);
  const [loading, setLoading] = useState(false);

  const lookup = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("track_parcel", { _tracking_id: id.trim().toUpperCase() });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("No parcel found with that tracking ID"); setData(null); return; }
    setData(data as unknown as Tracked);
  };

  useEffect(() => { if (code) lookup(code); /* eslint-disable-next-line */ }, []);

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <main className="container max-w-3xl py-8">
        <h1 className="text-3xl font-bold">Track your parcel</h1>
        <p className="mt-2 text-muted-foreground">Enter your tracking ID (e.g. PRC-XXXXXXXX).</p>

        <Card className="mt-6 shadow-card">
          <CardContent className="flex gap-2 p-4">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="PRC-XXXXXXXX" className="uppercase" />
            <Button onClick={() => { setParams({ id: code }); lookup(code); }} disabled={loading}>
              {loading ? "Searching..." : "Track"}
            </Button>
          </CardContent>
        </Card>

        {data && (
          <Card className="mt-6 shadow-card">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" />{data.tracking_id}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{data.company}</p>
                </div>
                <Badge className={statusColor[data.status] ?? ""}>{data.status.replace(/_/g, " ")}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{data.origin}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{data.destination}</span>
              </div>
              <div className="grid gap-3 rounded-md border bg-muted/30 p-3 text-sm md:grid-cols-2">
                <div><span className="text-muted-foreground">Sender:</span> {data.sender_name}</div>
                <div><span className="text-muted-foreground">Receiver:</span> {data.receiver_name}</div>
                <div><span className="text-muted-foreground">Description:</span> {data.description}</div>
                <div><span className="text-muted-foreground">Weight:</span> {data.weight_kg} kg</div>
                <div><span className="text-muted-foreground">Price:</span> KES {Number(data.price).toLocaleString()}</div>
                <div><span className="text-muted-foreground">Payment:</span> {data.payment_status}</div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Timeline</h3>
                <ol className="relative space-y-4 border-l-2 border-muted pl-5">
                  {[...data.movements].reverse().map((m, i) => (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      </span>
                      <div className="text-sm font-medium capitalize">{m.status.replace(/_/g, " ")}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}{m.location ? ` · ${m.location}` : ""}
                      </div>
                      {m.note && <div className="text-xs">{m.note}</div>}
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default TrackParcel;
