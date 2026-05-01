import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import { companyNav } from "@/components/layout/companyNav";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Ticket, Search, RefreshCw } from "lucide-react";

interface BookingRow {
  id: string; ticket_code: string; passenger_name: string; passenger_phone: string;
  seat_number: number; amount: number; status: string; created_at: string; trip_id: string;
  trips: { departure_at: string; routes: { origin: string; destination: string } | null } | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default", pending: "secondary", cancelled: "destructive", refunded: "secondary",
};

const BookingsPage = () => {
  const { companyId } = useAuth();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("bookings")
      .select("id, ticket_code, passenger_name, passenger_phone, seat_number, amount, status, created_at, trip_id, trips(departure_at, routes(origin,destination))")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as any);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const setStatus = async (b: BookingRow, status: string) => {
    const { error } = await supabase.from("bookings").update({ status: status as any }).eq("id", b.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: `Booking ${status}` }); load();
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!s) return true;
      return (
        r.ticket_code.toLowerCase().includes(s) ||
        r.passenger_name.toLowerCase().includes(s) ||
        r.passenger_phone.toLowerCase().includes(s)
      );
    });
  }, [rows, q, filter]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "paid");
    return { count: rows.length, paidCount: paid.length, revenue: paid.reduce((s, r) => s + Number(r.amount), 0) };
  }, [rows]);

  return (
    <DashboardShell title="Bookings" subtitle="Live seat sales" nav={companyNav}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Bookings</h1>
            <p className="text-sm text-muted-foreground">Search tickets, refund or cancel.</p>
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5"><RefreshCw className="h-4 w-4" /> Refresh</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="card-soft"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total</div><div className="text-2xl font-bold">{totals.count}</div></CardContent></Card>
          <Card className="card-soft"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Paid</div><div className="text-2xl font-bold">{totals.paidCount}</div></CardContent></Card>
          <Card className="card-soft"><CardContent className="p-4"><div className="text-xs text-muted-foreground">Revenue (paid)</div><div className="text-2xl font-bold">KES {totals.revenue.toLocaleString()}</div></CardContent></Card>
        </div>

        <Card className="card-soft">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Ticket className="h-5 w-5 text-primary" /><CardTitle className="text-base">All bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ticket, name or phone" className="pl-8" />
              </div>
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No bookings found.</p>
            ) : (
              <div className="divide-y">
                {filtered.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-3 py-3">
                    <div className="flex-1 min-w-[220px]">
                      <div className="font-semibold">{b.passenger_name} <span className="font-mono text-xs text-muted-foreground">#{b.ticket_code}</span></div>
                      <div className="text-xs text-muted-foreground">
                        Seat {b.seat_number} • {b.passenger_phone} • {b.trips?.routes?.origin} → {b.trips?.routes?.destination}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
                    </div>
                    <div className="text-sm font-mono">KES {Number(b.amount).toLocaleString()}</div>
                    <Badge variant={STATUS_VARIANT[b.status] ?? "secondary"} className="capitalize">{b.status}</Badge>
                    {b.status === "paid" && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(b, "refunded")}>Refund</Button>
                    )}
                    {b.status === "pending" && (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(b, "cancelled")}>Cancel</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
};

export default BookingsPage;
