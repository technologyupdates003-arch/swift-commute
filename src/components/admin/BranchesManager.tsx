import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";

type Branch = { id: string; name: string; town: string; phone: string | null; is_active: boolean };

export default function BranchesManager({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<Branch[]>([]);
  const [form, setForm] = useState({ name: "", town: "", phone: "" });

  const load = async () => {
    const { data } = await supabase.from("branches").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setItems((data ?? []) as Branch[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [companyId]);

  const create = async () => {
    if (!form.name.trim() || !form.town.trim()) { toast.error("Name and town required"); return; }
    const { error } = await supabase.from("branches").insert({ company_id: companyId, name: form.name.trim(), town: form.town.trim(), phone: form.phone || null });
    if (error) return toast.error(error.message);
    setForm({ name: "", town: "", phone: "" });
    toast.success("Branch added");
    load();
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("branches").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <Card className="shadow-card">
      <CardHeader><CardTitle>Branches / offices</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="CBD office" /></div>
          <div><Label>Town</Label><Input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="Nairobi" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="07..." /></div>
          <div className="flex items-end"><Button onClick={create} className="w-full gap-2"><Plus className="h-4 w-4" />Add</Button></div>
        </div>

        <div className="divide-y rounded-md border">
          {items.length === 0 && <div className="p-4 text-sm text-muted-foreground">No branches yet.</div>}
          {items.map((b) => (
            <div key={b.id} className="flex items-center justify-between p-3 text-sm">
              <div>
                <div className="font-medium">{b.name} <span className="text-muted-foreground">— {b.town}</span></div>
                {b.phone && <div className="text-xs text-muted-foreground">{b.phone}</div>}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
