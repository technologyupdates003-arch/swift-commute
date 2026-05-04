import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PublicHeader from "@/components/layout/PublicHeader";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar } from "lucide-react";

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_url: string | null;
  published_at: string | null;
};

const BlogPost = () => {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await supabase
        .from("blog_posts")
        .select("id, slug, title, excerpt, content, cover_url, published_at")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();
      if (!data) setNotFound(true);
      else {
        setPost(data as Post);
        document.title = `${(data as Post).title} – Blog`;
      }
      setLoading(false);
    })();
  }, [slug]);

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      <main className="container py-10 max-w-3xl">
        <Link to="/blog">
          <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> Back to blog
          </Button>
        </Link>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : notFound || !post ? (
          <p className="text-muted-foreground">Post not found.</p>
        ) : (
          <article className="prose prose-slate dark:prose-invert max-w-none">
            {post.cover_url && (
              <img src={post.cover_url} alt={post.title} className="w-full rounded-lg mb-6 aspect-video object-cover" />
            )}
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
            {post.published_at && (
              <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                {new Date(post.published_at).toLocaleDateString()}
              </p>
            )}
            {post.excerpt && <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>}
            <div className="mt-6 whitespace-pre-wrap leading-relaxed">{post.content}</div>
          </article>
        )}
      </main>
    </div>
  );
};

export default BlogPost;
