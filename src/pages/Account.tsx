import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import PublicHeader from "@/components/layout/PublicHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Bus, Search as SearchIcon, ArrowDownCircle, ArrowUpCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Tx {
  id: string; type: string; amount: number; source: string; reference: string | null; created_at: string;
}
interface Booking {
  id: string; ticket_code: string; status: string; amount: number; passenger_name: string;
  trips: { departure_at: string; routes: { origin: string; destination: string } | null } | null;
  companies: { name: string } | null;
}

const Account = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [balance, setBalance] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);

  const [topupCompany, setTopupCompany] = useState("");
  const [topupAmount, setTopupAmount] = useState(100);
  const [topupPhone, setTopupPhone] = useState("");
  const [topupBusy, setTopupBusy] = useState(false);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const load = async () => {
    if (!user) return;
    const [{ data: w }, { data: t }, { data: b }, { data: cs }] = await Promise.all([
      supabase.from("user_wallets").select("balance").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
      supabase.from("bookings").select("id, ticket_code, status, amount, passenger_name, trips(departure_at, routes(origin,destination)), companies(name)").eq("created_by", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("companies").select("id, name").eq("is_active", true),
    ]);
    setBalance(Number(w?.balance ?? 0));
    setTxs((t ?? []) as Tx[]);
    setBookings((b ?? []) as unknown as Booking[]);
    setCompanies(cs ?? []);
    if (cs && cs[0] && !topupCompany) setTopupCompany(cs[0].id);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  const onTopup = async () => {
    if (!topupCompany || !topupPhone || topupAmount < 1) { toast.error("Enter amount, phone and operator"); return; }
    setTopupBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("mpesa-stk-push", {
        body: { purpose: "wallet_topup", company_id: topupCompany, amount: topupAmount, phone: topupPhone },
      });
      if (error) throw error;
      toast.success("STK push sent — approve on your phone", { description: "Balance updates after confirmation." });
      setTimeout(load, 8000);
    } catch (e: any) {
      toast.error("Top-up failed", { description: e?.message ?? "Try again" });
    } finally { setTopupBusy(false); }
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/search?${new URLSearchParams({ origin, destination, date }).toString()}`);
  };

  return (
    <div className="min-h-screen bg-muted/20">
      <PublicHeader />
      <div className="container py-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">My Account</h1>
          <p className="text-sm text-muted-foreground">Wallet, bookings and quick search.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          {/* Wallet */}
          <Card className="shadow-elegant">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5" /> Wallet</CardTitle>
                  <CardDescription>Pay faster from your balance</CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Balance</div>
                  <div className="text-3xl font-extrabold text-primary">KES {balance.toLocaleString()}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Operator (M-Pesa enabled)</Label>
                  <Select value={topupCompany} onValueChange={setTopupCompany}>
                    <SelectTrigger><SelectValue placeholder="Choose operator" /></SelectTrigger>
                    <SelectContent>
                      {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>M-Pesa phone</Label>
                  <Input placeholder="07XXXXXXXX" value={topupPhone} onChange={(e) => setTopupPhone(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Amount (KES)</Label>
                  <Input type="number" min={1} value={topupAmount} onChange={(e) => setTopupAmount(Number(e.target.value))} />
                </div>
                <div className="flex items-end">
                  <Button onClick={onTopup} disabled={topupBusy} className="w-full bg-brand-gradient hover:opacity-90">
                    {topupBusy ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Wallet className="h-4 w-4 mr-1.5" />}
                    Load wallet via STK
                  </Button>
                </div>
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Recent transactions</div>
                {txs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transactions yet.</p>
                ) : (
                  <div className="divide-y rounded-md border">
                    {txs.map(t => (
                      <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {t.type === "credit"
                            ? <ArrowDownCircle className="h-4 w-4 text-success" />
                            : <ArrowUpCircle className="h-4 w-4 text-destructive" />}
                          <div>
                            <div className="font-medium capitalize">{t.source.replace("_", " ")}</div>
                            <div className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()} {t.reference && `• ${t.reference}`}</div>
                          </div>
                        </div>
                        <div className={t.type === "credit" ? "font-semibold text-success" : "font-semibold text-destructive"}>
                          {t.type === "credit" ? "+" : "-"}KES {Number(t.amount).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Search */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><SearchIcon className="h-5 w-5" /> Search buses</CardTitle>
              <CardDescription>Find your next trip</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSearch} className="space-y-3">
                <div className="space-y-1.5"><Label>From</Label><Input value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Nairobi" /></div>
                <div className="space-y-1.5"><Label>To</Label><Input value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Garissa" /></div>
                <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
                <Button type="submit" className="w-full bg-brand-gradient hover:opacity-90">Search</Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bus className="h-5 w-5" /> My bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bookings yet. <Link to="/search" className="text-primary underline">Search buses</Link>.</p>
            ) : (
              <div className="divide-y rounded-md border">
                {bookings.map(b => (
                  <Link key={b.id} to={`/booking/${b.id}`} className="flex items-center justify-between px-3 py-3 text-sm hover:bg-muted/40">
                    <div>
                      <div className="font-semibold">{b.companies?.name} • {b.trips?.routes?.origin} → {b.trips?.routes?.destination}</div>
                      <div className="text-xs text-muted-foreground">{b.trips?.departure_at && new Date(b.trips.departure_at).toLocaleString()} • {b.passenger_name} • <span className="font-mono">{b.ticket_code}</span></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={b.status === "paid" ? "default" : "secondary"}>{b.status}</Badge>
                      <span className="font-semibold">KES {Number(b.amount).toLocaleString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Account;
