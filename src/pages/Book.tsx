import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Bus, Clock, MapPin, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TripDetail {
  id: string;
  company_id: string;
  departure_at: string;
  price: number;
  routes: { origin: string; destination: string } | null;
  buses: { plate_number: string; capacity: number; bus_type: string } | null;
  companies: { name: string } | null;
}

const passengerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  id_number: z.string().trim().max(30).optional().or(z.literal("")),
});

const Book = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const { data: t } = await supabase
        .from("trips")
        .select("id, company_id, departure_at, price, routes(origin,destination), buses(plate_number,capacity,bus_type), companies(name)")
        .eq("id", tripId)
        .maybeSingle();
      setTrip(t as unknown as TripDetail);

      const { data: bookings } = await supabase
        .from("bookings")
        .select("seat_number, status")
        .eq("trip_id", tripId)
        .in("status", ["pending", "paid"]);
      setTaken(new Set((bookings ?? []).map((b) => b.seat_number)));
    })();
  }, [tripId]);

  const handleConfirm = async () => {
    if (!trip || selected === null) return;
    const parsed = passengerSchema.safeParse({ name, phone, id_number: idNumber });
    if (!parsed.success) {
      toast({ title: "Check passenger details", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.from("bookings").insert({
      company_id: trip.company_id,
      trip_id: trip.id,
      seat_number: selected,
      passenger_name: parsed.data.name,
      passenger_phone: parsed.data.phone,
      passenger_id_number: parsed.data.id_number || null,
      amount: trip.price,
      status: "pending",
    }).select("id, ticket_code").single();
    setBusy(false);
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Booking created", description: `Ticket ${data.ticket_code} reserved. Proceed to payment.` });
    navigate(`/booking/${data.id}`);
  };

  if (!trip) {
    return (
      <div className="min-h-screen bg-muted/20">
        <PublicHeader />
        <div className="container py-16 text-center text-muted-foreground">Loading trip…</div>
      </div>
    );
  }

  const capacity = trip.buses?.capacity ?? 40;
  const dt = new Date(trip.departure_at);

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_380px]">
        {/* Left: trip + seats */}
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardContent className="flex flex-wrap items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground">
                <Bus className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{trip.companies?.name}</h2>
                  <Badge variant="secondary" className="uppercase">{trip.buses?.bus_type}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{trip.routes?.origin} <ArrowRight className="h-3 w-3" /> {trip.routes?.destination}</span>
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{dt.toLocaleString()}</span>
                  <span>Bus {trip.buses?.plate_number}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader><CardTitle>Choose your seat</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <Legend swatch="bg-seat-available border" label="Available" />
                <Legend swatch="bg-seat-selected" label="Selected" />
                <Legend swatch="bg-seat-taken" label="Taken" />
              </div>

              <div className="mx-auto max-w-md rounded-xl border-2 border-dashed bg-background p-4">
                <div className="mb-4 rounded-md bg-muted py-2 text-center text-xs font-medium uppercase text-muted-foreground">
                  Driver
                </div>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: capacity }).map((_, i) => {
                    const seat = i + 1;
                    const isTaken = taken.has(seat);
                    const isSelected = selected === seat;
                    // Aisle gap on column 3
                    const isAisle = (i % 5) === 2;
                    return (
                      <div key={seat} className={cn(isAisle && "invisible")}>
                        {!isAisle && (
                          <button
                            type="button"
                            disabled={isTaken}
                            onClick={() => setSelected(seat)}
                            className={cn(
                              "flex h-10 w-full items-center justify-center rounded-md text-xs font-semibold transition",
                              isTaken && "cursor-not-allowed bg-seat-taken text-seat-taken-foreground",
                              !isTaken && !isSelected && "bg-seat-available text-seat-available-foreground hover:ring-2 hover:ring-ring",
                              isSelected && "bg-seat-selected text-seat-selected-foreground shadow-elegant"
                            )}
                          >
                            {seat}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: passenger + summary */}
        <div className="space-y-6">
          <Card className="shadow-card">
            <CardHeader><CardTitle>Passenger details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (M-Pesa)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXX" maxLength={20} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="id">National ID (optional)</Label>
                <Input id="id" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={30} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-elegant">
            <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <Row k="Seat" v={selected ? `#${selected}` : "—"} />
              <Row k="Fare" v={`KES ${Number(trip.price).toLocaleString()}`} />
              <Row k="Service" v="KES 0" />
              <div className="my-2 border-t" />
              <Row k="Total" v={`KES ${Number(trip.price).toLocaleString()}`} bold />
              <Button
                className="mt-3 w-full bg-brand-gradient hover:opacity-90"
                size="lg"
                disabled={selected === null || busy}
                onClick={handleConfirm}
              >
                {busy ? "Reserving…" : "Confirm & pay"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Payments are stubbed in this version — booking will be created as <em>pending</em>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Legend = ({ swatch, label }: { swatch: string; label: string }) => (
  <span className="flex items-center gap-1.5">
    <span className={cn("inline-block h-4 w-4 rounded", swatch)} />
    {label}
  </span>
);

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={cn("flex items-center justify-between text-sm", bold && "text-base font-bold")}>
    <span className={cn(!bold && "text-muted-foreground")}>{k}</span>
    <span>{v}</span>
  </div>
);

export default Book;
