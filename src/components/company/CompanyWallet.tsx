import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Wallet, ArrowDownToLine, Loader2 } from "lucide-react";

interface Props { companyId: string }

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 2 }).format(n || 0);

export default function CompanyWallet({ companyId }: Props) {
  const [wallet, setWallet] = useState<{ balance: number; total_credited: number; total_withdrawn: number } | null>(null);
  const [tx, setTx] = useState<any[]>([]);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ amount: "", method: "mpesa", destination: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    const [w, t, wd] = await Promise.all([
      supabase.from("company_wallets").select("balance,total_credited,total_withdrawn").eq("company_id", companyId).maybeSingle(),
      supabase.from("company_wallet_transactions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(25),
      supabase.from("company_withdrawals").select("*").eq("company_id", companyId).order("created_at", { ascending: false }).limit(15),
    ]);
    setWallet(w.data ?? { balance: 0, total_credited: 0, total_withdrawn: 0 });
    setTx(t.data ?? []);
    setWithdrawals(wd.data ?? []);
    setLoading(false);
  }, [companyId]);

  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    const amt = Number(form.amount);
    if (!amt || amt <= 0) return toast.error("Enter a valid amount");
    if (!form.destination.trim()) return toast.error("Destination required");
    setSubmitting(true);
    const { error } = await supabase.rpc("request_company_withdrawal", {
      _company_id: companyId, _amount: amt, _method: form.method,
      _destination: form.destination.trim(), _note: form.note || null,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Withdrawal requested");
    setOpen(false);
    setForm({ amount: "", method: "mpesa", destination: "", note: "" });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/80 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> Available balance
            </CardDescription>
            <CardTitle className="text-3xl">{fmt(wallet?.balance ?? 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" className="w-full" disabled={loading || (wallet?.balance ?? 0) <= 0}>
                  <ArrowDownToLine className="h-4 w-4 mr-2" /> Request withdrawal
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Withdraw funds</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label>Amount (KES)</Label>
                    <Input type="number" min="1" value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                  <div>
                    <Label>Method</Label>
                    <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mpesa">M-Pesa</SelectItem>
                        <SelectItem value="bank">Bank transfer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{form.method === "mpesa" ? "M-Pesa number" : "Bank account"}</Label>
                    <Input value={form.destination}
                      onChange={(e) => setForm({ ...form, destination: e.target.value })}
                      placeholder={form.method === "mpesa" ? "2547XXXXXXXX" : "Bank · Account number"} />
                  </div>
                  <div>
                    <Label>Note (optional)</Label>
                    <Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={submit} disabled={submitting}>
                    {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Submit
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total earned</CardDescription>
            <CardTitle className="text-2xl">{fmt(wallet?.total_credited ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total withdrawn</CardDescription>
            <CardTitle className="text-2xl">{fmt(wallet?.total_withdrawn ?? 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Withdrawal requests</CardTitle></CardHeader>
        <CardContent>
          {withdrawals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No withdrawals yet.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead>
                <TableHead>Method</TableHead><TableHead>Destination</TableHead>
                <TableHead>Status</TableHead><TableHead>Reference</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {withdrawals.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell>{new Date(w.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{fmt(Number(w.amount))}</TableCell>
                    <TableCell className="uppercase">{w.method}</TableCell>
                    <TableCell>{w.destination}</TableCell>
                    <TableCell>
                      <Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>
                        {w.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{w.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
        <CardContent>
          {tx.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet. Earnings appear here once payments are confirmed.</p>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Type</TableHead>
                <TableHead>Source</TableHead><TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {tx.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={t.type === "credit" ? "default" : "secondary"}>{t.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{t.source}</TableCell>
                    <TableCell className={`text-right font-medium ${t.type === "credit" ? "text-success" : ""}`}>
                      {t.type === "credit" ? "+" : "-"}{fmt(Number(t.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
