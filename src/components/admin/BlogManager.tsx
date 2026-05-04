import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { z } from "zod";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_url: string | null;
  is_published: boolean;
  published_at: string | null;
  company_id: string | null;
  author_id: string;
  created_at: string;
};

const schema = z.object({
  title: z.string().trim().min(3).max(200),
  slug: z.string().trim().min(3).max(120).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers, dashes only"),
  excerpt: z.string().trim().max(400).optional().or(z.literal("")),
  content: z.string().trim().min(10),
  cover_url: z.string().trim().url().optional().or(z.literal("")),
  is_published: z.boolean(),
});

const empty = { title: "", slug: "", excerpt: "", content: "", cover_url: "", is_published: false };

export default function BlogManager({ scope }: { scope: "super" | "company" }) {
  const { user, companyId } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    let q = supabase.from("blog_posts").select("*").order("created_at", { ascending: false });
    if (scope === "company" && companyId) q = q.eq("company_id", companyId);
    const { data } = await q;
    setPosts((data as Post[]) ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope, companyId]);

  const startCreate = () => { setEditingId(null); setForm(empty); setOpen(true); };
  const startEdit = (p: Post) => {
    setEditingId(p.id);
    setForm({
      title: p.title, slug: p.slug, excerpt: p.excerpt ?? "",
      content: p.content, cover_url: p.cover_url ?? "", is_published: p.is_published,
    });
    setOpen(true);
  };

  const save = async () => {
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    if (!user) return;
    setBusy(true);
    const payload = {
      title: parsed.data.title,
      slug: parsed.data.slug,
      content: parsed.data.content,
      excerpt: parsed.data.excerpt || null,
      cover_url: parsed.data.cover_url || null,
      is_published: parsed.data.is_published,
      author_id: user.id,
      company_id: scope === "company" ? companyId : null,
      published_at: parsed.data.is_published ? new Date().toISOString() : null,
    };
    let err;
    if (editingId) {
      ({ error: err } = await supabase.from("blog_posts").update(payload).eq("id", editingId));
    } else {
      ({ error: err } = await supabase.from("blog_posts").insert(payload as never));
    }
    setBusy(false);
    if (err) { toast.error(err.message); return; }
    toast.success(editingId ? "Post updated" : "Post created");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); load(); }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Blog posts</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={startCreate} size="sm" className="gap-1.5"><Plus className="h-4 w-4" /> New post</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Edit post" : "New post"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Slug (URL)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} placeholder="my-post-title" /></div>
              <div><Label>Cover image URL (optional)</Label><Input value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>Excerpt</Label><Textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} /></div>
              <div><Label>Content</Label><Textarea rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded border p-3">
                <Label>Published</Label>
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No posts yet.</p>
        ) : (
          <div className="divide-y">
            {posts.map((p) => (
              <div key={p.id} className="py-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium truncate">{p.title}</p>
                    {p.is_published
                      ? <Badge variant="secondary" className="gap-1"><Eye className="h-3 w-3" /> Published</Badge>
                      : <Badge variant="outline">Draft</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">/{p.slug}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
