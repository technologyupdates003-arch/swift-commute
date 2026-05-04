import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "lucide-react";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
};

const Blog = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Blog – Abancool Travel";
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, cover_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(50);
      setPosts((data as Post[]) ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container py-10">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Travel stories & updates</h1>
          <p className="mt-2 text-muted-foreground">News, route launches, and tips from Abancool Travel.</p>
        </header>

        {loading ? (
          <p className="text-muted-foreground">Loading posts…</p>
        ) : posts.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No posts yet. Check back soon.</CardContent></Card>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} to={`/blog/${p.slug}`} className="group">
                <Card className="overflow-hidden h-full transition-shadow hover:shadow-elegant">
                  {p.cover_url && (
                    <div className="aspect-video overflow-hidden bg-muted">
                      <img src={p.cover_url} alt={p.title} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="line-clamp-2 group-hover:text-primary">{p.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {p.excerpt && <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>}
                    {p.published_at && (
                      <Badge variant="secondary" className="mt-3 gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.published_at).toLocaleDateString()}
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Blog;
