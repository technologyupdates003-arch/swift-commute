import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import DashboardShell, { DashNavItem } from "@/components/layout/DashboardShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Bus, Clock, MapPin, ArrowRight, Timer, Ticket, Receipt, Smartphone, Banknote, CheckCircle2, RefreshCw, Printer, LayoutDashboard, Package } from "lucide-react";
import SeatMap, { Seat, SeatClass } from "@/components/booking/SeatMap";
import { getSessionToken } from "@/lib/sessionToken";
import { useCountdown } from "@/hooks/useCountdown";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const passengerSchema = z.object({
  name: z.string().trim().min(2, "Name required").max(100),
  phone: z.string().trim().min(7, "Phone required").max(20),
  id_number: z.string().trim().max(30).optional().or(z.literal("")),
});

interface Trip {
  id: string;
  company_id: string;
  bus_id: string;
  route_id: string;
  departure_at: string;
  price: number;
  routes: { origin: string; destination: string } | null;
  buses: { plate_number: string; bus_type: string } | null;
}

interface Discount {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
}

const CLASS_LABEL: Record<SeatClass, string> = { economy: "Economy", business: "Business", vip: "VIP" };

const cashierNav: DashNavItem[] = [
  { to: "/cashier", label: "POS", icon: Ticket, end: true },
  { to: "/company", label: "Reports", icon: LayoutDashboard },
  { to: "/send-parcel", label: "Parcel", icon: Package },
  { to: "/track-parcel", label: "Track", icon: Receipt },
  { to: "/", label: "Home", icon: Bus },
];

const Cashier = () => {
  const navigate = useNavigate();
  const { companyId } = useAuth();
  const sessionToken = getSessionToken();

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<string>("");
  const [seats, setSeats] = useState<Seat[]>([]);
  const [selected, setSelected] = useState<Seat[]>([]);
  const [lockExpiresAt, setLockExpiresAt] = useState<Date | null>(null);
  const countdown = useCountdown(lockExpiresAt);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");

  const [discountCode, setDiscountCode] = useState("");
  const [discount, setDiscount] = useState<Discount | null>(null);

  const [payMethod, setPayMethod] = useState<"mpesa" | "cash">("mpesa");
  const [cashReceived, setCashReceived] = useState("");

  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<{ ticketCode: string; bookingId: string } | null>(null);

  const trip = useMemo(() => trips.find((t) => t.id === tripId) ?? null, [trips, tripId]);

  // Load upcoming trips for this company
  useEffect(() => {
    if (!companyId) return;
    (async () => {
      const { data } = await supabase
        .from("trips")
        .select("id, company_id, bus_id, route_id, departure_at, price, routes(origin,destination), buses(plate_number,bus_type)")
        .eq("company_id", companyId)
        .eq("status", "scheduled")
        .gte("departure_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
        .order("departure_at", { ascending: true })
        .limit(50);
      setTrips((data ?? []) as unknown as Trip[]);
    })();
  }, [companyId]);

  // Load seats when trip changes
  useEffect(() => {
    if (!trip) { setSeats([]); return; }
    (async () => {
      const { data } = await supabase
        .from("seats")
        .select("id, seat_number, class, row_index, col_index, price_multiplier")
        .eq("bus_id", trip.bus_id)
        .eq("is_active", true)
        .order("row_index", { ascending: true })
        .order("col_index", { ascending: true });
      setSeats((data ?? []) as Seat[]);
      setSelected([]);
      setLockExpiresAt(null);
    })();
  }, [trip]);

  // Release locks on unmount/trip switch
  useEffect(() => {
    const release = () => {
      if (!trip) return;
      selected.forEach((s) =>
        supabase.rpc("release_seat_lock", { _trip_id: trip.id, _seat_id: s.id, _session_token: sessionToken })
      );
    };
    window.addEventListener("beforeunload", release);
    return () => { window.removeEventListener("beforeunload", release); release(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.id, selected.map((s) => s.id).join(",")]);

  useEffect(() => {
    if (countdown.expired && lockExpiresAt) {
      toast({ title: "Reservation expired", description: "Pick seats again.", variant: "destructive" });
      setSelected([]); setLockExpiresAt(null);
    }
  }, [countdown.expired, lockExpiresAt]);

  const toggleSeat = useCallback(async (seat: Seat) => {
    if (!trip) return;
    const isSel = selected.some((s) => s.id === seat.id);
    if (isSel) {
      await supabase.rpc("release_seat_lock", { _trip_id: trip.id, _seat_id: seat.id, _session_token: sessionToken });
      const next = selected.filter((s) => s.id !== seat.id);
      setSelected(next);
      if (next.length === 0) setLockExpiresAt(null);
      return;
    }
    const next = [...selected, seat];
    const { data, error } = await supabase.rpc("lock_seats", {
      _trip_id: trip.id, _seat_ids: next.map((s) => s.id), _session_token: sessionToken, _ttl_minutes: 10,
    });
    if (error) { toast({ title: "Couldn't reserve seat", description: error.message, variant: "destructive" }); return; }
    setSelected(next);
    const exp = (data ?? []).map((d: { lock_expires_at: string }) => new Date(d.lock_expires_at).getTime());
    if (exp.length) setLockExpiresAt(new Date(Math.min(...exp)));
  }, [trip, selected, sessionToken]);

  const subtotal = selected.reduce((s, x) => s + Number(trip?.price ?? 0) * Number(x.price_multiplier), 0);
  const discountAmount = useMemo(() => {
    if (!discount || subtotal <= 0) return 0;
    if (discount.type === "percent") return Math.round(subtotal * (Number(discount.value) / 100));
    return Math.min(Number(discount.value), subtotal);
  }, [discount, subtotal]);
  const total = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, Number(cashReceived || 0) - total);

  const applyDiscount = async () => {
    const code = discountCode.trim().toUpperCase();
    if (!code) { setDiscount(null); return; }
    if (!companyId) return;
    const { data, error } = await supabase
      .from("discounts")
      .select("id, code, type, value, is_active, starts_at, ends_at, max_uses, used_count")
      .eq("company_id", companyId)
      .eq("code", code)
      .maybeSingle();
    if (error || !data) { toast({ title: "Invalid code", variant: "destructive" }); setDiscount(null); return; }
    const now = Date.now();
    if (!data.is_active) { toast({ title: "Discount inactive", variant: "destructive" }); setDiscount(null); return; }
    if (data.starts_at && new Date(data.starts_at).getTime() > now) { toast({ title: "Discount not started", variant: "destructive" }); setDiscount(null); return; }
    if (data.ends_at && new Date(data.ends_at).getTime() < now) { toast({ title: "Discount expired", variant: "destructive" }); setDiscount(null); return; }
    if (data.max_uses && data.used_count >= data.max_uses) { toast({ title: "Discount fully used", variant: "destructive" }); setDiscount(null); return; }
    setDiscount({ id: data.id, code: data.code, type: data.type as "percent" | "fixed", value: Number(data.value) });
    toast({ title: `Code ${code} applied` });
  };

  const handleConfirm = async () => {
    if (!trip) return;
    const parsed = passengerSchema.safeParse({ name, phone, id_number: idNumber });
    if (!parsed.success) { toast({ title: "Check passenger details", description: parsed.error.errors[0].message, variant: "destructive" }); return; }
    if (selected.length === 0) { toast({ title: "Select at least one seat", variant: "destructive" }); return; }
    if (payMethod === "cash" && Number(cashReceived || 0) < total) {
      toast({ title: "Not enough cash", description: `Need KES ${total.toLocaleString()}`, variant: "destructive" }); return;
    }

    setBusy(true);

    // Refresh lock
    const { error: lockErr } = await supabase.rpc("lock_seats", {
      _trip_id: trip.id, _seat_ids: selected.map((s) => s.id), _session_token: sessionToken, _ttl_minutes: 10,
    });
    if (lockErr) { setBusy(false); toast({ title: "Lost seats", description: lockErr.message, variant: "destructive" }); setSelected([]); setLockExpiresAt(null); return; }

    const perSeatDiscount = selected.length > 0 ? discountAmount / selected.length : 0;

    const rows = selected.map((s) => {
      const amt = Number(trip.price) * Number(s.price_multiplier);
      return {
        company_id: trip.company_id,
        trip_id: trip.id,
        seat_id: s.id,
        seat_class: s.class,
        seat_number: Number(String(s.seat_number).replace(/\D/g, "")) || s.row_index * 10 + s.col_index,
        passenger_name: parsed.data.name,
        passenger_phone: parsed.data.phone,
        passenger_id_number: parsed.data.id_number || null,
        amount: Math.max(0, amt - perSeatDiscount),
        discount_amount: perSeatDiscount,
        discount_id: discount?.id ?? null,
        status: "pending" as const,
      };
    });

    const { data: inserted, error } = await supabase.from("bookings").insert(rows).select("id, ticket_code");
    if (error || !inserted?.length) { setBusy(false); toast({ title: "Booking failed", description: error?.message, variant: "destructive" }); return; }

    // Confirm payment immediately (cash always; M-Pesa stub for v1 — staff confirms manually here)
    const confirmResults = await Promise.all(
      inserted.map((b) => supabase.rpc("confirm_booking_payment", { _booking_id: b.id, _session_token: sessionToken }))
    );
    const failed = confirmResults.find((r) => r.error);
    setBusy(false);
    if (failed) { toast({ title: "Payment confirmation failed", description: failed.error?.message, variant: "destructive" }); return; }

    toast({ title: "Ticket issued", description: `${inserted.length} seat(s) confirmed.` });
    setConfirmed({ ticketCode: inserted[0].ticket_code, bookingId: inserted[0].id });
  };

  const reset = () => {
    setSelected([]); setLockExpiresAt(null);
    setName(""); setPhone(""); setIdNumber("");
    setDiscountCode(""); setDiscount(null);
    setCashReceived("");
    setConfirmed(null);
    setTripId("");
  };

  return (
    <DashboardShell
      title="Cashier"
      subtitle="Fast POS"
      nav={cashierNav}
      actions={
        <Button size="sm" variant="outline" className="gap-1.5 hidden sm:inline-flex" onClick={reset}>
          <RefreshCw className="h-4 w-4" /> New sale
        </Button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        {/* LEFT: trip + seats */}
        <div className="space-y-6">
          <Card className="card-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                Select trip
              </CardTitle>
            </CardHeader>
            <CardContent>
              {trips.length === 0 ? (
                <p className="text-sm text-muted-foreground">No upcoming trips. Create one in <Link to="/company" className="text-primary underline">Company → Fleet</Link>.</p>
              ) : (
                <Select value={tripId} onValueChange={setTripId}>
                  <SelectTrigger className="h-11"><SelectValue placeholder="Choose route & departure" /></SelectTrigger>
                  <SelectContent>
                    {trips.map((t) => {
                      const dt = new Date(t.departure_at);
                      return (
                        <SelectItem key={t.id} value={t.id}>
                          <span className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            {t.routes?.origin} <ArrowRight className="h-3 w-3" /> {t.routes?.destination}
                            <span className="text-muted-foreground">· {dt.toLocaleString()} · {t.buses?.plate_number}</span>
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}

              {trip && (
                <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-primary-foreground">
                    <Bus className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {trip.routes?.origin} <ArrowRight className="h-3.5 w-3.5" /> {trip.routes?.destination}
                      <Badge variant="secondary" className="uppercase">{trip.buses?.bus_type}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(trip.departure_at).toLocaleString()}</span>
                      <span>Bus {trip.buses?.plate_number}</span>
                      <span>Base KES {Number(trip.price).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {trip && (
            <Card className="card-soft">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                  Pick seats
                </CardTitle>
                {lockExpiresAt && !countdown.expired && (
                  <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                    <Timer className="h-3.5 w-3.5" /> {countdown.label}
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
                  maxSelectable={6}
                />
              </CardContent>
            </Card>
          )}
        </div>

        {/* RIGHT: customer + payment + summary */}
        <div className="space-y-6 xl:sticky xl:top-20 xl:self-start">
          <Card className="card-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="c-phone">Phone (M-Pesa)</Label>
                <Input id="c-phone" inputMode="tel" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Name</Label>
                <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} className="h-11" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-id">National ID (optional)</Label>
                <Input id="c-id" value={idNumber} onChange={(e) => setIdNumber(e.target.value)} maxLength={30} className="h-11" />
              </div>
            </CardContent>
          </Card>

          <Card className="card-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                Discount & payment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Promo code</Label>
                <div className="flex gap-2">
                  <Input value={discountCode} onChange={(e) => setDiscountCode(e.target.value.toUpperCase())} placeholder="TRAVEL10" className="h-11" />
                  <Button variant="outline" onClick={applyDiscount} className="h-11">Apply</Button>
                </div>
                {discount && (
                  <p className="text-xs text-success font-medium">
                    {discount.code}: {discount.type === "percent" ? `${discount.value}% off` : `KES ${discount.value} off`}
                  </p>
                )}
              </div>

              <Tabs value={payMethod} onValueChange={(v) => setPayMethod(v as "mpesa" | "cash")}>
                <TabsList className="grid grid-cols-2 w-full h-11">
                  <TabsTrigger value="mpesa" className="gap-1.5"><Smartphone className="h-4 w-4" />M-Pesa</TabsTrigger>
                  <TabsTrigger value="cash" className="gap-1.5"><Banknote className="h-4 w-4" />Cash</TabsTrigger>
                </TabsList>
              </Tabs>

              {payMethod === "cash" && (
                <div className="space-y-1.5">
                  <Label>Cash received</Label>
                  <Input inputMode="decimal" value={cashReceived} onChange={(e) => setCashReceived(e.target.value)} placeholder="0" className="h-11" />
                  {Number(cashReceived) > 0 && (
                    <p className="text-xs">Change: <span className="font-bold">KES {change.toLocaleString()}</span></p>
                  )}
                </div>
              )}

              {payMethod === "mpesa" && (
                <p className="text-xs text-muted-foreground">M-Pesa STK push will be wired in next pass. For now click confirm to mark as paid after the customer pays manually.</p>
              )}
            </CardContent>
          </Card>

          <Card className="card-soft border-primary/40 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {selected.length === 0 ? (
                <p className="text-sm text-muted-foreground">Pick a trip and seats.</p>
              ) : (
                selected.map((s) => (
                  <Row key={s.id}
                    k={`Seat ${s.seat_number} · ${CLASS_LABEL[s.class]}`}
                    v={`KES ${(Number(trip?.price ?? 0) * Number(s.price_multiplier)).toLocaleString()}`} />
                ))
              )}
              <div className="border-t pt-2" />
              <Row k="Subtotal" v={`KES ${subtotal.toLocaleString()}`} />
              {discountAmount > 0 && <Row k={`Discount (${discount?.code})`} v={`- KES ${discountAmount.toLocaleString()}`} />}
              <Row k="Total" v={`KES ${total.toLocaleString()}`} bold />

              <Button
                className="mt-2 w-full h-12 bg-brand-gradient hover:opacity-90 text-base"
                disabled={busy || selected.length === 0 || countdown.expired}
                onClick={handleConfirm}
              >
                <CheckCircle2 className="h-5 w-5 mr-2" />
                {busy ? "Processing…" : "Confirm & issue ticket"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Confirmation dialog (lightweight inline modal) */}
      {confirmed && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => setConfirmed(null)}>
          <Card className="w-full max-w-sm card-soft" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-6 text-center space-y-3">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="text-lg font-bold">Ticket issued</div>
              <div className="font-mono text-sm bg-muted rounded-lg py-2">{confirmed.ticketCode}</div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1.5" onClick={() => navigate(`/booking/${confirmed.bookingId}`)}>
                  <Printer className="h-4 w-4" /> View/Print
                </Button>
                <Button className="gap-1.5 bg-brand-gradient" onClick={reset}>
                  <RefreshCw className="h-4 w-4" /> New sale
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
};

const Row = ({ k, v, bold }: { k: string; v: string; bold?: boolean }) => (
  <div className={cn("flex items-center justify-between text-sm", bold && "text-base font-bold")}>
    <span className={cn(!bold && "text-muted-foreground")}>{k}</span>
    <span>{v}</span>
  </div>
);

export default Cashier;
