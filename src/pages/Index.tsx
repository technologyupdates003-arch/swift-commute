import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { MapPin, Calendar, ArrowLeftRight, Search as SearchIcon, ShieldCheck, Ticket, Trophy, Gift, Map as MapIcon, Users, Zap, Headphones } from "lucide-react";
import PublicHeader from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import heroBus from "@/assets/hero-bus.jpg";

type DiscountRow = {
  id: string;
  code: string;
  description: string | null;
  type: "percent" | "fixed";
  value: number;
  company_id: string;
  companies?: { name: string; slug: string } | null;
};

const OFFER_TINTS = [
  "from-orange-400 via-rose-500 to-rose-600",
  "from-sky-500 via-blue-600 to-indigo-700",
  "from-emerald-500 via-teal-600 to-cyan-700",
  "from-amber-400 via-orange-500 to-red-600",
] as const;

const Index = () => {
  const navigate = useNavigate();
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState("");
  const [stats, setStats] = useState({ companies: 0, routes: 0 });
  const [offers, setOffers] = useState<DiscountRow[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: c }, { count: r }, { data: d }] = await Promise.all([
        supabase.from("companies").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase.from("routes").select("*", { count: "exact", head: true }).eq("is_active", true),
        supabase
          .from("discounts")
          .select("id, code, description, type, value, company_id")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      setStats({ companies: c ?? 0, routes: r ?? 0 });
      const base = (d ?? []) as Omit<DiscountRow, "companies">[];
      const ids = Array.from(new Set(base.map((x) => x.company_id)));
      let names: Record<string, { name: string; slug: string }> = {};
      if (ids.length) {
        const { data: cs } = await supabase.from("companies").select("id, name, slug").in("id", ids);
        names = Object.fromEntries((cs ?? []).map((x) => [x.id, { name: x.name, slug: x.slug }]));
      }
      setOffers(base.map((x) => ({ ...x, companies: names[x.company_id] ?? null })));
    })();
  }, []);

  const swap = () => { setOrigin(destination); setDestination(origin); };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams({ origin, destination, date });
    navigate(`/search?${params.toString()}`);
  };

  const featuredOffer = offers[0];

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      {/* HERO */}
      <section className="relative">
        <div
          className="relative h-[360px] w-full bg-cover bg-center md:h-[440px]"
          style={{ backgroundImage: `url(${heroBus})` }}
          aria-label="Bus traveling through city"
        />

        {/* Floating search card */}
        <div className="container relative -mt-24 md:-mt-28">
          <Card className="overflow-visible border-0 shadow-elegant">
            <CardContent className="p-3 md:p-4">
              <form onSubmit={onSearch} className="grid items-end gap-2 lg:grid-cols-[1fr_auto_1fr_1fr_1fr_auto]">
                <Field label="Leaving From" icon={<MapPin className="h-4 w-4 text-primary" />}>
                  <Input className="h-11 border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0" placeholder="Enter city" value={origin} onChange={(e) => setOrigin(e.target.value)} />
                </Field>

                <button
                  type="button"
                  onClick={swap}
                  aria-label="Swap cities"
                  className="hidden h-10 w-10 shrink-0 items-center justify-center self-center rounded-full border bg-background text-muted-foreground transition hover:bg-primary hover:text-primary-foreground lg:flex"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </button>

                <Field label="Going To" icon={<MapPin className="h-4 w-4 text-primary" />}>
                  <Input className="h-11 border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0" placeholder={origin ? "Select destination" : "Select source city first"} value={destination} onChange={(e) => setDestination(e.target.value)} />
                </Field>

                <Field label="Departure" icon={<Calendar className="h-4 w-4 text-primary" />}>
                  <Input type="date" className="h-11 border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0" value={date} onChange={(e) => setDate(e.target.value)} />
                </Field>

                <Field label="Return Date (Optional)" icon={<Calendar className="h-4 w-4 text-primary" />}>
                  <Input type="date" className="h-11 border-0 bg-transparent px-0 text-base font-medium focus-visible:ring-0" placeholder="Select date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
                </Field>

                <Button type="submit" size="lg" className="h-[68px] gap-2 rounded-md bg-primary px-8 text-base font-semibold hover:bg-primary/90">
                  <SearchIcon className="h-4 w-4" /> Search
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Featured promo banner (from a company's discount) */}
      {featuredOffer && (
        <section className="container mt-6">
          <Link to="/search" className="block">
            <PromoBanner offer={featuredOffer} />
          </Link>
        </section>
      )}

      {/* Offers for you */}
      <section className="container mt-12">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Offers for you</h2>
            <p className="mt-1 text-sm text-muted-foreground">Discount codes from our bus partners</p>
          </div>
          <Link to="/offers" className="text-sm font-semibold text-primary hover:underline">View more</Link>
        </div>

        {/* Filter pills */}
        <div className="mt-5 flex flex-wrap gap-2">
          {["All offers Today", "Round Trip Discount", "Early Bird Discount", "Flash Sale", "Special Discount"].map((p, i) => (
            <button
              key={p}
              className={cn(
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                i === 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-primary text-primary hover:bg-primary/5"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {offers.length === 0 && (
            <p className="col-span-full rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No active offers right now. Bus companies can publish discount codes from their dashboard.
            </p>
          )}
          {offers.slice(0, 4).map((o, i) => (
            <OfferCard key={o.id} offer={o} tint={OFFER_TINTS[i % OFFER_TINTS.length]} />
          ))}
        </div>
      </section>

      {/* What's new — pastel tiles */}
      <section className="container mt-16">
        <h2 className="text-2xl font-bold md:text-3xl">What's new</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PastelTile tone="lavender" title="Free Cancellation" desc="Get 100% cash back when you cancel a ticket." icon={<Ticket />} />
          <PastelTile tone="lilac" title="Assurance" desc="Insure your trip against accidents." icon={<ShieldCheck />} />
          <PastelTile tone="butter" title="Spin The Wheel" desc="Spin and win big. Your prize is just a spin away." icon={<Trophy />} />
          <PastelTile tone="violet" title="Earn Points" desc="Travel and get rewarded with points." icon={<Gift />} />
        </div>
      </section>

      {/* Why Choose */}
      <section className="container mt-16">
        <h2 className="text-2xl font-bold md:text-3xl">Why Choose RoadLink for Bus Ticket Booking?</h2>
        <p className="mt-3 max-w-3xl text-muted-foreground">
          RoadLink is East Africa's fastest growing online ticket booking platform. RoadLink is the official ticketing
          partner of several bus operators and over 200+ private bus partners covering more than 200 bus routes.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <FeatureTile tone="mint" badge="ROUTES" badgeColor="bg-emerald-100 text-emerald-700" icon={<MapIcon />} title={`${Math.max(stats.routes, 200).toLocaleString()}+ Bus Tickets`} desc="offering unparalleled choices for your travel needs" />
          <FeatureTile tone="sky" badge="PARTNERS" badgeColor="bg-sky-100 text-sky-700" icon={<Users />} title={`${Math.max(stats.companies, 30)}+ Bus Partners`} desc="ranging from State RTCs to private partners" />
          <FeatureTile tone="butter2" badge="BOOKING" badgeColor="bg-amber-100 text-amber-700" icon={<Zap />} title="Fastest Bus Booking" desc="swift and seamless bus ticket booking experience" />
          <FeatureTile tone="lilac2" badge="SUPPORT" badgeColor="bg-violet-100 text-violet-700" icon={<Headphones />} title="24/7 Customer Support" desc="we are always here to help you with your bookings" />
        </div>
      </section>

      {/* Our Partners */}
      <section className="container mt-16">
        <h2 className="text-2xl font-bold md:text-3xl">Our Partners</h2>
        <p className="mt-2 text-muted-foreground">Trusted by leading bus operators across East Africa</p>
        <PartnerStrip />
      </section>

      {/* Operator CTA */}
      <section className="container mt-16">
        <div className="grid items-center gap-6 rounded-2xl bg-secondary p-8 text-secondary-foreground md:grid-cols-[1fr_auto] md:p-10">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Run a bus company?</h2>
            <p className="mt-2 max-w-xl opacity-90">
              Get a fully managed dashboard for fleet, staff, ticketing, parcels — and configure your own promo codes & discounts.
            </p>
          </div>
          <Link to="/auth"><Button size="lg" variant="secondary" className="bg-white text-secondary hover:bg-white/90">Operator sign in</Button></Link>
        </div>
      </section>

      <footer className="mt-16 border-t bg-secondary text-secondary-foreground">
        <div className="container flex flex-col items-center justify-between gap-3 py-6 text-sm md:flex-row">
          <p>© {new Date().getFullYear()} RoadLink Transport SaaS</p>
          <p className="opacity-80">Built for modern bus operators</p>
        </div>
      </footer>
    </div>
  );
};

const Field = ({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="rounded-md border-r border-border px-4 py-2 last:border-r-0">
    <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
    <div className="mt-0.5 flex items-center gap-2">
      <div className="shrink-0">{icon}</div>
      {children}
    </div>
  </div>
);

const PromoBanner = ({ offer }: { offer: DiscountRow }) => {
  const valueLabel = offer.type === "percent" ? `${offer.value}% off` : `KES ${offer.value} off`;
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary to-secondary p-6 text-primary-foreground shadow-card md:p-7">
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest opacity-90">Special offer</div>
          <h3 className="mt-1 text-2xl font-extrabold md:text-3xl">
            GET <span className="text-amber-300">{valueLabel}</span>
          </h3>
          <p className="mt-1 text-sm opacity-95">
            Use discount code: <span className="ml-1 rounded bg-white/20 px-2 py-0.5 font-mono text-base font-bold">{offer.code}</span>
            {offer.companies?.name && <span className="ml-2 opacity-80">— {offer.companies.name}</span>}
          </p>
        </div>
        <Button variant="secondary" className="bg-white text-primary hover:bg-white/90">Book now</Button>
      </div>
      <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
      <div aria-hidden className="absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
    </div>
  );
};

const OfferCard = ({ offer, tint }: { offer: DiscountRow; tint: string }) => {
  const valueLabel = offer.type === "percent" ? `${offer.value}% OFF` : `KES ${offer.value} OFF`;
  return (
    <Link to="/search" className="group">
      <Card className="overflow-hidden border-0 shadow-card transition group-hover:shadow-elegant">
        <div className={cn("relative h-44 bg-gradient-to-br p-4 text-white", tint)}>
          <div className="absolute right-3 top-3 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-primary shadow">
            Special Offer!!
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="text-xs font-semibold uppercase tracking-wider opacity-90">{offer.companies?.name ?? "Partner"}</div>
            <div className="mt-0.5 text-2xl font-extrabold leading-tight drop-shadow">{valueLabel}</div>
            {offer.description && <div className="mt-1 line-clamp-1 text-xs opacity-90">{offer.description}</div>}
          </div>
        </div>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Use code</div>
            <div className="font-mono text-base font-bold text-foreground">{offer.code}</div>
          </div>
          <span className="text-sm font-semibold text-primary group-hover:underline">Book →</span>
        </CardContent>
      </Card>
    </Link>
  );
};

const TONES = {
  lavender: "bg-[hsl(255_70%_94%)] text-[hsl(255_40%_25%)]",
  lilac:    "bg-[hsl(265_60%_92%)] text-[hsl(265_45%_28%)]",
  butter:   "bg-[hsl(48_95%_88%)]  text-[hsl(35_60%_25%)]",
  violet:   "bg-[hsl(250_55%_88%)] text-[hsl(250_45%_25%)]",
} as const;

const PastelTile = ({ tone, title, desc, icon }: { tone: keyof typeof TONES; title: string; desc: string; icon: React.ReactNode }) => (
  <div className={cn("relative min-h-[160px] overflow-hidden rounded-2xl p-5 transition hover:-translate-y-0.5", TONES[tone])}>
    <div className="text-base font-bold">{title}</div>
    <p className="mt-1 text-sm opacity-80">{desc}</p>
    <div className="absolute -bottom-3 -right-3 flex h-24 w-24 items-center justify-center rounded-full bg-white/40 [&>svg]:h-9 [&>svg]:w-9">
      {icon}
    </div>
  </div>
);

const FEATURE_TONES = {
  mint:    "bg-emerald-50",
  sky:     "bg-sky-50",
  butter2: "bg-amber-50",
  lilac2:  "bg-violet-50",
} as const;

const FeatureTile = ({
  tone, badge, badgeColor, icon, title, desc,
}: {
  tone: keyof typeof FEATURE_TONES; badge: string; badgeColor: string;
  icon: React.ReactNode; title: string; desc: string;
}) => (
  <div className={cn("relative rounded-2xl p-5", FEATURE_TONES[tone])}>
    <span className={cn("absolute right-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", badgeColor)}>{badge}</span>
    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-secondary shadow-sm [&>svg]:h-6 [&>svg]:w-6">{icon}</div>
    <div className="mt-4 text-lg font-bold text-secondary">{title}</div>
    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
  </div>
);

const PartnerStrip = () => {
  const [partners, setPartners] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    supabase.from("companies").select("id, name").eq("is_active", true).limit(8)
      .then(({ data }) => setPartners(data ?? []));
  }, []);
  const items = partners.length > 0 ? partners : [
    { id: "1", name: "Royal Liner" }, { id: "2", name: "Modern Coast" },
    { id: "3", name: "Mash Poa" }, { id: "4", name: "Buscar" },
    { id: "5", name: "Easy Coach" }, { id: "6", name: "Coast Bus" },
  ];
  return (
    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
      {items.map((p) => (
        <div key={p.id} className="flex h-20 items-center justify-center rounded-lg border bg-card px-3 text-center text-sm font-bold text-secondary">
          {p.name}
        </div>
      ))}
    </div>
  );
};

export default Index;
