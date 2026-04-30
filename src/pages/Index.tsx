import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { MapPin, Calendar, ArrowLeftRight, Search as SearchIcon, ShieldCheck, Ticket, Sparkles, Trophy, Gift } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import heroBus from "@/assets/hero-bus.jpg";

const Index = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState("");
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

  const swap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ origin, destination, date });
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* HERO with illustration */}
      <section className="relative overflow-hidden">
        <div
          className="relative h-[420px] w-full bg-cover bg-center md:h-[480px]"
          style={{ backgroundImage: `linear-gradient(180deg, hsl(0 0% 100% / 0) 0%, hsl(0 0% 100% / 0) 55%, hsl(0 0% 100%) 100%), url(${heroBus})` }}
        >
          <div className="container relative pt-10 md:pt-16">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" /> East Africa's bus network
              </span>
              <h1 className="mt-3 text-3xl font-bold leading-tight text-foreground md:text-5xl">
                Book bus tickets <span className="text-primary">online</span>,<br className="hidden md:block" />
                travel with confidence.
              </h1>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
                Compare schedules from trusted operators, pick your seat, and pay with M-Pesa.
              </p>
            </div>
          </div>
        </div>

        {/* Floating search card */}
        <div className="container relative -mt-28 pb-4 md:-mt-32">
          <Card className="overflow-visible border-0 shadow-elegant">
            <CardContent className="p-4 md:p-6">
              <form onSubmit={onSearch} className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_auto] lg:items-end lg:gap-2">
                <Field label="Leaving from" icon={<MapPin className="h-4 w-4" />}>
                  <Input className="border-0 bg-muted/50 px-3 text-base font-medium focus-visible:ring-1" placeholder="Nairobi" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                </Field>

                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap cities"
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background text-muted-foreground transition hover:bg-primary hover:text-primary-foreground lg:flex"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>

                <Field label="Going to" icon={<MapPin className="h-4 w-4" />}>
                  <Input className="border-0 bg-muted/50 px-3 text-base font-medium focus-visible:ring-1" placeholder="Mombasa" value={destination} onChange={(e) => setDestination(e.target.value)} />
                </Field>

                <Field label="Departure" icon={<Calendar className="h-4 w-4" />}>
                  <Input type="date" className="border-0 bg-muted/50 px-3 text-base font-medium focus-visible:ring-1" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>

                <Field label="Return (optional)" icon={<Calendar className="h-4 w-4" />}>
                  <Input type="date" className="border-0 bg-muted/50 px-3 text-base font-medium focus-visible:ring-1" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </Field>

                <Button type="submit" size="lg" className="h-[58px] gap-2 bg-primary px-6 text-base font-semibold hover:bg-primary/90">
                  <SearchIcon className="h-4 w-4" /> Search
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Promo offer banner */}
      <section className="container mt-6">
        <Link to="/search" className="block">
          <div className="relative overflow-hidden rounded-xl bg-brand-gradient p-5 text-primary-foreground shadow-card md:p-6">
            <div className="relative z-10 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-widest opacity-80">Special offer</div>
                <h3 className="mt-1 text-xl font-bold md:text-2xl">Get KES 100 off your next trip</h3>
                <p className="mt-1 text-sm opacity-90">Use code <span className="rounded bg-white/20 px-2 py-0.5 font-mono font-semibold">ROAD100</span> on any route</p>
              </div>
              <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">Book now</Button>
            </div>
            <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
            <div aria-hidden className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
          </div>
        </Link>
      </section>

      {/* Offers for you */}
      <section className="container mt-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Offers for you</h2>
            <p className="mt-1 text-sm text-muted-foreground">Popular routes with great prices today</p>
          </div>
          <Link to="/search" className="text-sm font-semibold text-primary hover:underline">View more</Link>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OFFERS.map((o) => (
            <OfferCard key={o.title} {...o} />
          ))}
        </div>
      </section>

      {/* What's new — pastel tiles */}
      <section className="container mt-16">
        <h2 className="text-2xl font-bold md:text-3xl">What's new</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PastelTile tone="lavender" title="Free cancellation" desc="Get 100% cashback when you cancel a ticket." icon={<Ticket />} />
          <PastelTile tone="mint" title="Trip assurance" desc="Insure your trip against accidents." icon={<ShieldCheck />} />
          <PastelTile tone="butter" title="Spin & win" desc="Spin the wheel and win exciting prizes." icon={<Trophy />} />
          <PastelTile tone="rose" title="Earn points" desc="Travel and get rewarded with points." icon={<Gift />} />
        </div>
      </section>

      {/* Why choose us */}
      <section className="container mt-16">
        <div className="rounded-2xl border bg-muted/30 p-8 md:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold md:text-3xl">Why choose RoadLink?</h2>
            <p className="mt-3 text-muted-foreground">
              The fastest growing online ticket booking platform in the region — official ticketing partner of leading bus operators with growing route coverage.
            </p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            <BigStat value={`${stats.routes}+`} label="Active routes" />
            <BigStat value={`${stats.companies}+`} label="Bus partners" />
            <BigStat value="24/7" label="Customer support" />
          </div>
        </div>
      </section>

      {/* Operator CTA */}
      <section className="container mt-16">
        <div className="grid items-center gap-6 rounded-2xl bg-secondary p-8 text-secondary-foreground md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Run a bus company?</h2>
            <p className="mt-2 max-w-xl opacity-90">
              Get a fully managed dashboard for fleet, staff, ticketing and parcels. Setup is handled by our team.
            </p>
          </div>
          <Link to="/auth"><Button size="lg" variant="secondary" className="bg-white text-secondary hover:bg-white/90">Operator sign in</Button></Link>
        </div>
      </section>

      <footer className="mt-16 border-t">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-sm text-muted-foreground md:flex-row">
          <p>© {new Date().getFullYear()} RoadLink Transport SaaS</p>
          <p>Built for modern bus operators</p>
        </div>
      </footer>
    </div>
  );
};

const Field = ({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-lg border bg-background p-2.5">
    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon} {label}
    </div>
    <div className="mt-1">{children}</div>
  </div>
);

const OFFERS = [
  { title: "Nairobi → Mombasa", tag: "Coastal route", price: "1,500", tint: "from-orange-400 to-rose-500" },
  { title: "Nairobi → Kisumu",  tag: "Lakeside",     price: "1,200", tint: "from-sky-400 to-indigo-500" },
  { title: "Nairobi → Kampala", tag: "Cross border", price: "2,800", tint: "from-emerald-400 to-teal-600" },
  { title: "Mombasa → Malindi", tag: "Beach run",    price: "600",   tint: "from-amber-400 to-orange-500" },
] as const;

const OfferCard = ({ title, tag, price, tint }: { title: string; tag: string; price: string; tint: string }) => (
  <Link to="/search" className="group">
    <Card className="overflow-hidden border-0 shadow-card transition group-hover:shadow-elegant">
      <div className={cn("relative h-32 bg-gradient-to-br", tint)}>
        <div className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
          Special
        </div>
        <div className="absolute bottom-3 left-3 text-white">
          <div className="text-xs font-medium uppercase tracking-wider opacity-90">{tag}</div>
          <div className="text-lg font-bold leading-tight">{title}</div>
        </div>
      </div>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-[11px] font-medium uppercase text-muted-foreground">From</div>
          <div className="text-lg font-bold text-foreground">KES {price}</div>
        </div>
        <span className="text-sm font-semibold text-primary group-hover:underline">Book →</span>
      </CardContent>
    </Card>
  </Link>
);

const TONES = {
  lavender: "bg-[hsl(255_70%_94%)] text-[hsl(255_40%_25%)]",
  mint:     "bg-[hsl(160_55%_90%)] text-[hsl(165_45%_22%)]",
  butter:   "bg-[hsl(48_95%_88%)]  text-[hsl(35_60%_25%)]",
  rose:     "bg-[hsl(345_85%_92%)] text-[hsl(345_55%_28%)]",
} as const;

const PastelTile = ({ tone, title, desc, icon }: { tone: keyof typeof TONES; title: string; desc: string; icon: React.ReactNode }) => (
  <div className={cn("relative overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5", TONES[tone])}>
    <div className="text-base font-bold">{title}</div>
    <p className="mt-1 text-sm opacity-80">{desc}</p>
    <div className="absolute -bottom-3 -right-3 flex h-20 w-20 items-center justify-center rounded-full bg-white/40 [&>svg]:h-9 [&>svg]:w-9">
      {icon}
    </div>
  </div>
);

const BigStat = ({ value, label }: { value: string; label: string }) => (
  <div className="text-center">
    <div className="text-3xl font-bold text-primary md:text-4xl">{value}</div>
    <div className="mt-1 text-sm font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

export default Index;
