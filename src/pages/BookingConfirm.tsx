import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getSessionToken } from "@/lib/sessionToken";

const BookingConfirm = () => {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, ticket_code, status, seat_id, seat_class, seat_number, amount, passenger_name, passenger_phone, trips(departure_at, routes(origin,destination)), companies(name)")
        .eq("id", id)
        .maybeSingle();
      setBooking(data);
    })();
  }, [id]);

  const [phone, setPhone] = useState("");
  const payViaMpesa = async () => {
    if (!booking) return;
    if (!phone || phone.length < 9) {
      toast({ title: "Phone required", description: "Enter your M-Pesa number", variant: "destructive" });
      return;
    }
    setPaying(true);
    const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
      body: { purpose: "booking", booking_id: booking.id, amount: booking.amount, phone },
    });
    setPaying(false);
    if (error || (data as any)?.error) {
      toast({ title: "STK push failed", description: (data as any)?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Check your phone", description: "Approve the M-Pesa STK push to confirm your seat." });
    // Poll booking for paid status
    const start = Date.now();
    const tick = setInterval(async () => {
      const { data: b } = await supabase.from("bookings").select("status").eq("id", booking.id).maybeSingle();
      if (b?.status === "paid") { clearInterval(tick); setBooking({ ...booking, status: "paid" }); toast({ title: "Payment confirmed" }); }
      if (Date.now() - start > 90000) clearInterval(tick);
    }, 3000);
  };

  if (!booking) {
    return (
      <div className="min-h-screen bg-muted/20">
        <PublicHeader />
        <div className="container py-16 text-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  const isPaid = booking.status === "paid";
  const seatLabel = booking.seat_class
    ? `${booking.seat_number} • ${String(booking.seat_class).toUpperCase()}`
    : `#${booking.seat_number}`;

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container max-w-2xl py-10">
        <Card className="shadow-elegant">
          <CardHeader className="text-center">
            <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full ${isPaid ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}`}>
              {isPaid ? <CheckCircle2 className="h-7 w-7" /> : <Clock className="h-7 w-7" />}
            </div>
            <CardTitle className="text-2xl">{isPaid ? "Ticket confirmed" : "Awaiting payment"}</CardTitle>
            <p className="text-sm text-muted-foreground">Ticket code <span className="font-mono font-semibold">{booking.ticket_code}</span></p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row k="Operator" v={booking.companies?.name ?? "—"} />
            <Row k="Route" v={`${booking.trips?.routes?.origin ?? ""} → ${booking.trips?.routes?.destination ?? ""}`} />
            <Row k="Departure" v={booking.trips?.departure_at ? new Date(booking.trips.departure_at).toLocaleString() : "—"} />
            <Row k="Seat" v={seatLabel} />
            <Row k="Passenger" v={booking.passenger_name} />
            <Row k="Phone" v={booking.passenger_phone} />
            <Row k="Amount" v={`KES ${Number(booking.amount).toLocaleString()}`} />
            <Row k="Status" v={<Badge variant={isPaid ? "default" : "secondary"} className={isPaid ? "bg-success" : ""}>{booking.status}</Badge>} />
            {!isPaid && (
              <div className="mt-2 space-y-2">
                <label className="text-xs text-muted-foreground">M-Pesa phone</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XXXXXXXX" />
                <Button className="w-full bg-brand-gradient hover:opacity-90" size="lg" onClick={payViaMpesa} disabled={paying}>
                  {paying ? "Sending STK push…" : `Pay KES ${Number(booking.amount).toLocaleString()} via M-Pesa`}
                </Button>
              </div>
            )}
            <Link to="/"><Button variant="outline" className="w-full">Back to home</Button></Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
  <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
    <span className="text-muted-foreground">{k}</span>
    <span className="font-medium">{v}</span>
  </div>
);

export default BookingConfirm;
