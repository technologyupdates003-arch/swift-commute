import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Truck, MapPin, CheckCircle2, KeyRound } from "lucide-react";

type Parcel = {
  id: string; tracking_id: string; status: string; payment_status: string;
  sender_name: string; sender_phone: string;
  receiver_name: string; receiver_phone: string;
  description: string; weight_kg: number; price: number;
  pickup_otp: string; created_at: string;
};

const STATUS_FLOW = ["created", "paid", "dispatched", "in_transit", "arrived", "ready_for_pickup", "delivered", "cancelled"];
const statusColor: Record<string, string> = {
  created: "bg-muted text-foreground", paid: "bg-blue-500 text-white",
  dispatched: "bg-indigo-500 text-white", in_transit: "bg-amber-500 text-white",
  arrived: "bg-teal-500 text-white", ready_for_pickup: "bg-emerald-500 text-white",
  delivered: "bg-green-600 text-white", cancelled: "bg-destructive text-destructive-foreground",
};

export default function ParcelsManager({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Parcel[]>([]);
  const [search, setSearch] = useState("");
  const [otpDialog, setOtpDialog] = useState<{ id: string; tracking: string } | null>(null);
  const [otp, setOtp] = useState("");

  const load = async () => {
    const { data } = await supabase.from("parcels").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(200);
    setItems((data ?? []) as Parcel[]);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("parcels-co").on("postgres_changes",
      { event: "*", schema: "public", table: "parcels", filter: `company_id=eq.${companyId}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [companyId]);

  const filtered = items.filter((p) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return p.tracking_id.toLowerCase().includes(q) || p.sender_phone.includes(q)
      || p.receiver_phone.includes(q) || p.receiver_name.toLowerCase().includes(q);
  });

  const setStatus = async (p: Parcel, status: string, location?: string, note?: string) => {
    const { error } = await supabase.rpc("update_parcel_status", { _parcel_id: p.id, _new_status: status as any, _location: location ?? null, _note: note ?? null });
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status.replace(/_/g, " ")}`);
  };
  const markPaid = async (p: Parcel) => {
    const code = window.prompt("M-Pesa code (or leave blank for stub):") ?? "";
    const { error } = await supabase.rpc("mark_parcel_paid", { _parcel_id: p.id, _mpesa_code: code });
    if (error) return toast.error(error.message);
    toast.success("Payment recorded");
  };
  const verifyPickup = async () => {
    if (!otpDialog) return;
    const { error } = await supabase.rpc("verify_parcel_pickup", { _parcel_id: otpDialog.id, _otp: otp.trim() });
    if (error) return toast.error(error.message);
    toast.success("Parcel delivered");
    setOtpDialog(null); setOtp("");
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle>Parcels</CardTitle>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search tracking ID, phone, receiver..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="divide-y rounded-md border">
          {filtered.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No parcels yet.</div>}
          {filtered.map((p) => (
            <div key={p.id} className="flex flex-col gap-3 p-3 text-sm md:flex-row md:items-center md:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold">{p.tracking_id}</span>
                  <Badge className={statusColor[p.status]}>{p.status.replace(/_/g, " ")}</Badge>
                  <Badge variant={p.payment_status === "paid" ? "default" : "outline"}>{p.payment_status}</Badge>
                </div>
                <div className="mt-1 text-muted-foreground">
                  {p.sender_name} ({p.sender_phone}) → {p.receiver_name} ({p.receiver_phone})
                </div>
                <div className="text-xs text-muted-foreground">{p.description} · {p.weight_kg}kg · KES {Number(p.price).toLocaleString()}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {p.payment_status !== "paid" && <Button size="sm" variant="outline" onClick={() => markPaid(p)}>Mark paid</Button>}
                <Select onValueChange={(v) => setStatus(p, v)}>
                  <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Update status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_FLOW.filter((s) => s !== p.status).map((s) => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(p.status === "arrived" || p.status === "ready_for_pickup") && (
                  <Button size="sm" className="gap-1" onClick={() => { setOtpDialog({ id: p.id, tracking: p.tracking_id }); setOtp(""); }}>
                    <KeyRound className="h-3.5 w-3.5" />Verify pickup
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>

      <Dialog open={!!otpDialog} onOpenChange={(o) => !o && setOtpDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Verify pickup — {otpDialog?.tracking}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Enter the 6-digit code from the receiver</Label>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="123456" maxLength={6} className="text-center text-2xl tracking-[0.5em]" />
            <Button onClick={verifyPickup} className="w-full">Confirm delivery</Button>
            <p className="text-xs text-muted-foreground">For testing the OTP is also visible in the parcels list (until SMS is wired).</p>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
