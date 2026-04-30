import { useState } from "react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, HelpCircle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

const PrintTicket = () => {
  const [ticket, setTicket] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !phone) {
      toast({ title: "Enter ticket number and phone", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("bookings")
      .select("id")
      .eq("ticket_code", ticket.trim().toUpperCase())
      .eq("passenger_phone", phone.trim())
      .maybeSingle();
    setBusy(false);
    if (error || !data) {
      toast({ title: "Ticket not found", description: "Check your ticket number and phone.", variant: "destructive" });
      return;
    }
    navigate(`/booking/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <section className="bg-gradient-to-r from-primary to-rose-600 py-16 text-primary-foreground">
        <div className="container text-center">
          <h1 className="text-4xl font-extrabold md:text-5xl">Print Ticket</h1>
          <p className="mt-3 text-base opacity-95 md:text-lg">Enter your ticket number to print your bus ticket</p>
        </div>
      </section>

      <section className="container -mt-8">
        <Card className="shadow-elegant">
          <CardContent className="p-6 md:p-8">
            <form onSubmit={search} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Ticket Number</label>
                <Input value={ticket} onChange={(e) => setTicket(e.target.value)} placeholder="Enter your ticket number" className="h-12" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Phone Number</label>
                <div className="flex h-12 items-center rounded-md border bg-background">
                  <span className="px-3 text-sm font-semibold text-muted-foreground">KE +254</span>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter your phone number" className="h-12 border-0" />
                </div>
              </div>
              <Button type="submit" size="lg" className="h-12 gap-2 bg-primary hover:bg-primary/90" disabled={busy}>
                <Printer className="h-4 w-4" /> {busy ? "Searching…" : "Search Ticket"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>

      <section className="container mt-10 max-w-3xl">
        <h2 className="text-2xl font-bold">Need Help?</h2>
        <div className="mt-5 space-y-5">
          <Help icon={<HelpCircle className="h-5 w-5 text-primary" />} title="Where can I find my ticket number?"
            text="Your ticket number is sent to your phone via SMS after successful booking. It's also available in your booking confirmation email." />
          <Help icon={<Phone className="h-5 w-5 text-primary" />} title="What phone number should I use?"
            text="Enter the phone number you used when booking the ticket. This helps us verify your identity and find your ticket." />
        </div>
      </section>

      <div className="h-20" />
    </div>
  );
};

const Help = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <div className="flex gap-3">
    <div className="mt-0.5">{icon}</div>
    <div>
      <div className="font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  </div>
);

export default PrintTicket;
