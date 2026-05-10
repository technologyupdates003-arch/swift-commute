import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(n || 0);

export default function WithdrawalsManager() {
  const [rows, setRows] = useState<any[]>([]);
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("company_withdrawals")
      .select("*, companies(name)")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows(data ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (id: string, status: "paid" | "rejected") => {
    const { error } = await supabase.rpc("process_company_withdrawal", {
      _withdrawal_id: id, _new_status: status, _reference: refs[id] || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Marked ${status}`);
    load();
  };

  return (
    <Card>
      <CardHeader><CardTitle>Company withdrawal requests</CardTitle></CardHeader>
      <CardContent>
        {loading ? <p>Loading…</p> : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No withdrawal requests.</p>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Date</TableHead><TableHead>Company</TableHead>
              <TableHead>Amount</TableHead><TableHead>Method</TableHead>
              <TableHead>Destination</TableHead><TableHead>Status</TableHead>
              <TableHead>Reference</TableHead><TableHead>Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rows.map((w) => (
                <TableRow key={w.id}>
                  <TableCell className="text-xs">{new Date(w.created_at).toLocaleString()}</TableCell>
                  <TableCell>{w.companies?.name ?? "—"}</TableCell>
                  <TableCell>{fmt(Number(w.amount))}</TableCell>
                  <TableCell className="uppercase">{w.method}</TableCell>
                  <TableCell>{w.destination}</TableCell>
                  <TableCell>
                    <Badge variant={w.status === "paid" ? "default" : w.status === "rejected" ? "destructive" : "secondary"}>
                      {w.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {w.status === "pending" ? (
                      <Input className="h-8 w-32" placeholder="M-Pesa code"
                        value={refs[w.id] ?? ""} onChange={(e) => setRefs({ ...refs, [w.id]: e.target.value })} />
                    ) : (w.reference ?? "—")}
                  </TableCell>
                  <TableCell>
                    {w.status === "pending" && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => act(w.id, "paid")}>Mark paid</Button>
                        <Button size="sm" variant="outline" onClick={() => act(w.id, "rejected")}>Reject</Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
