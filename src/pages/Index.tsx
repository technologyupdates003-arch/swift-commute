import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Bus, MapPin, Calendar, ShieldCheck, QrCode, Package } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [stats, setStats] = useState({ companies: 0, routes: 0 });

  useEffect(() => {
    (async () => {
      const [{ count: c }, { count: r }] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("routes").select("*", { count: "exact", head: true }).eq("is_active", true),
      ]);
      setStats({ companies: c ?? 0, routes: r ?? 0 });
    })();
  }, []);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ origin, destination, date });
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-hero-gradient text-primary-foreground">
        <div className="container py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <Bus className="h-3.5 w-3.5" /> Trusted bus operators
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight md:text-6xl">
              Travel & send parcels across the country.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/85 md:text-lg">
              Compare schedules, pick your seat, and pay securely — all in one place.
            </p>
          </div>

          {/* Search card */}
          <Card className="mx-auto mt-10 max-w-4xl shadow-elegant">
            <CardContent className="p-4 md:p-6">
              <form onSubmit={onSearch} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">From</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Nairobi" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">To</label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Mombasa" value={destination} onChange={(e) => setDestination(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Date</label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="date" className="pl-9" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                </div>
                <div className="flex items-end">
                  <Button type="submit" size="lg" className="w-full bg-brand-gradient hover:opacity-90 md:w-auto">
                    Search
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y bg-muted/30">
        <div className="container grid grid-cols-2 gap-6 py-8 md:grid-cols-4">
          <Stat label="Active operators" value={stats.companies.toString()} />
          <Stat label="Active routes" value={stats.routes.toString()} />
          <Stat label="Secure payments" value="M-Pesa" />
          <Stat label="Support" value="24 / 7" />
        </div>
      </section>

      {/* Features */}
      <section className="container py-16 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold md:text-4xl">Everything you need on the road</h2>
          <p className="mt-3 text-muted-foreground">
            One platform for ticketing, parcels and operations — built for modern bus companies.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Feature icon={<Bus className="h-5 w-5" />} title="Live seat selection" desc="Visual seat map, no double bookings." />
          <Feature icon={<Package className="h-5 w-5" />} title="Parcel tracking" desc="Send packages along your route with full tracking." />
          <Feature icon={<QrCode className="h-5 w-5" />} title="QR boarding" desc="Conductors verify tickets in seconds." />
          <Feature icon={<ShieldCheck className="h-5 w-5" />} title="Secure payments" desc="M-Pesa STK push with auto-confirmation." />
          <Feature icon={<MapPin className="h-5 w-5" />} title="Multi-route" desc="Operate any number of routes and schedules." />
          <Feature icon={<Calendar className="h-5 w-5" />} title="Smart reports" desc="Daily, weekly and monthly revenue insights." />
        </div>
      </section>

      {/* Operator CTA */}
      <section className="border-t bg-muted/30">
        <div className="container py-16 text-center">
          <h2 className="text-3xl font-bold">Run a bus company?</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Get a fully managed dashboard for fleet, staff, ticketing and parcels. Setup is handled by our team.
          </p>
          <Link to="/auth">
            <Button size="lg" className="mt-6 bg-brand-gradient hover:opacity-90">Operator sign in</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} RoadLink Transport SaaS</p>
          <p>Built for modern bus operators</p>
        </div>
      </footer>
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="text-center">
    <div className="text-2xl font-bold text-foreground md:text-3xl">{value}</div>
    <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

const Feature = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <Card className="shadow-card transition hover:shadow-elegant">
    <CardContent className="p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-gradient text-primary-foreground">{icon}</div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{desc}</p>
    </CardContent>
  </Card>
);

export default Index;
