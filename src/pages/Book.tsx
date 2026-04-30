import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Bus, Clock, MapPin, ArrowRight, Timer } from "lucide-react";
import { cn } from "@/lib/utils";
import SeatMap, { Seat, SeatClass } from "@/components/booking/SeatMap";
import { getSessionToken } from "@/lib/sessionToken";
import { useCountdown } from "@/hooks/useCountdown";

interface TripDetail {
  id: string;
  company_id: string;
  bus_id: string;
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

const CLASS_LABEL: Record<SeatClass, string> = { economy: "Economy", business: "Business", vip: "VIP" };

const Book = () => {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const sessionToken = getSessionToken();

  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<Seat[]>([]);
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const countdown = useCountdown(lockExpiresAt);

  // Load trip + seats
  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const { data: t } = await supabase
        .from("trips")
        .select("id, company_id, bus_id, departure_at, price, routes(origin,destination), buses(plate_number,capacity,bus_type), companies(name)")
        .eq("id", tripId)
        .maybeSingle();
      const trip = t as unknown as TripDetail;
      setTrip(trip);

      if (trip?.bus_id) {
        const { data: s } = await supabase
          .from("seats")
          .select("id, seat_number, class, row_index, col_index, price_multiplier")
          .eq("bus_id", trip.bus_id)
          .eq("is_active", true)
          .order("row_index", { ascending: true })
          .order("col_index", { ascending: true });
        setSeats((s ?? []) as Seat[]);
      }
    })();
  }, [tripId]);

  // Release locks when leaving the page or tab close
  useEffect(() => {
    const release = () => {
      selected.forEach((s) =>
        supabase.rpc("release_seat_lock", { _trip_id: tripId!, _seat_id: s.id, _session_token: sessionToken })
      );
    };
    window.addEventListener("beforeunload", release);
    return () => {
      window.removeEventListener("beforeunload", release);
      release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, selected.map((s) => s.id).join(",")]);

  // Show countdown expiry toast
  useEffect(() => {
    if (countdown.expired && lockExpiresAt) {
      toast({ title: "Reservation expired", description: "Please pick your seats again.", variant: "destructive" });
      setSelected([]);
      setLockExpiresAt(null);
    }
  }, [countdown.expired, lockExpiresAt]);

  const toggleSeat = useCallback(async (seat: Seat) => {
    if (!tripId) return;
    const isSelected = selected.some((s) => s.id === seat.id);

    if (isSelected) {
      // release this seat
      await supabase.rpc("release_seat_lock", { _trip_id: tripId, _seat_id: seat.id, _session_token: sessionToken });
      const next = selected.filter((s) => s.id !== seat.id);
      setSelected(next);
      if (next.length === 0) setLockExpiresAt(null);
      return;
    }

    const next = [...selected, seat];
    const { data, error } = await supabase.rpc("lock_seats", {
      _trip_id: tripId,
      _seat_ids: next.map((s) => s.id),
      _session_token: sessionToken,
      _ttl_minutes: 10,
    });
    if (error) {
      toast({ title: "Couldn't reserve seat", description: error.message, variant: "destructive" });
      return;
    }
    setSelected(next);
    const exp = (data ?? []).map((d: any) => new Date(d.lock_expires_at).getTime());
    if (exp.length) setLockExpiresAt(new Date(Math.min(...exp)));
  }, [tripId, selected, sessionToken]);

  const totalPrice = selected.reduce((sum, s) => sum + Number(trip?.price ?? 0) * Number(s.price_multiplier), 0);

  const handleConfirm = async () => {
    if (!trip || selected.length === 0) return;
    const parsed = passengerSchema.safeParse({ name, phone, id_number: idNumber });
    if (!parsed.success) {
      toast({ title: "Check passenger details", description: parsed.error.errors[0].message, variant: "destructive" });
      return;
    }
    setBusy(true);

    // Refresh the lock right before creating bookings
    const { error: lockErr } = await supabase.rpc("lock_seats", {
      _trip_id: trip.id,
      _seat_ids: selected.map((s) => s.id),
      _session_token: sessionToken,
      _ttl_minutes: 10,
    });
    if (lockErr) {
      setBusy(false);
      toast({ title: "Lost your seats", description: lockErr.message, variant: "destructive" });
      setSelected([]); setLockExpiresAt(null);
      return;
    }

    const rows = selected.map((s) => ({
      company_id: trip.company_id,
      trip_id: trip.id,
      seat_id: s.id,
      seat_class: s.class,
      seat_number: Number(String(s.seat_number).replace(/\D/g, "")) || s.row_index * 10 + s.col_index,
      passenger_name: parsed.data.name,
      passenger_phone: parsed.data.phone,
      passenger_id_number: parsed.data.id_number || null,
      amount: Number(trip.price) * Number(s.price_multiplier),
      status: "pending" as const,
    }));

    const { data, error } = await supabase.from("bookings").insert(rows).select("id, ticket_code").limit(1);
    setBusy(false);
    if (error) {
      toast({ title: "Booking failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Booking created", description: `Proceed to payment to confirm your seat${selected.length > 1 ? "s" : ""}.` });
    navigate(`/booking/${data![0].id}`);
  };

  if (!trip) {
    return (
      <div className="min-h-screen bg-muted/20">
        <PublicHeader />
        <div className="container py-16 text-center text-muted-foreground">Loading trip…</div>
      </div>
    );
  }

  const dt = new Date(trip.departure_at);

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container grid gap-6 py-8 lg:grid-cols-[1fr_380px]">
        {/* Left */}
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Choose your seat</CardTitle>
              {lockExpiresAt && !countdown.expired && (
                <span className="flex items-center gap-1.5 rounded-full bg-warning/15 px-3 py-1 text-sm font-bold text-warning-foreground">
                  <Timer className="h-4 w-4 text-amber-600" />
                  <span className="text-amber-700">Seats reserved for {countdown.label}</span>
                </span>
              )}
            </CardHeader>
            <CardContent>
              <SeatMap
                seats={seats}
                tripId={trip.id}
                selectedSeatIds={selected.map((s) => s.id)}
                onToggle={toggleSeat}
                sessionToken={sessionToken}
                maxSelectable={4}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right */}
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
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pick at least one seat to continue.</p>
              ) : (
                <div className="space-y-1.5">
                  {selected.map((s) => (
                    <Row key={s.id}
                      k={`Seat ${s.seat_number} (${CLASS_LABEL[s.class]})`}
                      v={`KES ${(Number(trip.price) * Number(s.price_multiplier)).toLocaleString()}`} />
                  ))}
                </div>
              )}
              <div className="my-2 border-t" />
              <Row k="Total" v={`KES ${totalPrice.toLocaleString()}`} bold />
              <Button
                className="mt-3 w-full bg-brand-gradient hover:opacity-90"
                size="lg"
                disabled={selected.length === 0 || busy || countdown.expired}
                onClick={handleConfirm}
              >
                {busy ? "Reserving…" : "Confirm & pay"}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Seat reservation auto-releases after 10 minutes if you don't pay.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={cn("flex items-center justify-between text-sm", bold && "text-base font-bold")}>
    <span className={cn(!bold && "text-muted-foreground")}>{k}</span>
    <span>{v}</span>
  </div>
);

export default Book;
