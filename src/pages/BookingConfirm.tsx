import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CheckCircle2, Clock } from "lucide-react";

const BookingConfirm = () => {
  const { id } = useParams<{ id: string }>();
  const [booking, setBooking] = useState<any>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, ticket_code, status, seat_number, amount, passenger_name, passenger_phone, trips(departure_at, routes(origin,destination)), companies(name)")
        .eq("id", id)
        .maybeSingle();
      setBooking(data);
    })();
  }, [id]);

  const simulatePayment = async () => {
    if (!booking) return;
    setPaying(true);
    // Stub: just mark as paid. Real M-Pesa STK push would go through an edge function.
    const { error } = await supabase.from("bookings").update({ status: "paid" }).eq("id", booking.id);
    setPaying(false);
    if (error) {
      toast({ title: "Payment failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Payment confirmed", description: "Ticket marked as paid (stub)." });
    setBooking({ ...booking, status: "paid" });
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
            <Row k="Seat" v={`#${booking.seat_number}`} />
            <Row k="Passenger" v={booking.passenger_name} />
            <Row k="Phone" v={booking.passenger_phone} />
            <Row k="Amount" v={`KES ${Number(booking.amount).toLocaleString()}`} />
            <Row k="Status" v={<Badge variant={isPaid ? "default" : "secondary"} className={isPaid ? "bg-success" : ""}>{booking.status}</Badge>} />
            {!isPaid && (
              <Button className="mt-2 w-full bg-brand-gradient hover:opacity-90" size="lg" onClick={simulatePayment} disabled={paying}>
                {paying ? "Processing…" : "Simulate M-Pesa payment"}
              </Button>
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
