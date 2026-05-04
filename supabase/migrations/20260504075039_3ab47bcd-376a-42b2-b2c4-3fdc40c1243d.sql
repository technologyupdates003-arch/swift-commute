-- BLOG POSTS
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NULL,
  author_id uuid NOT NULL,
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text,
  content text NOT NULL,
  cover_url text,
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_blog_posts_published ON public.blog_posts(is_published, published_at DESC);
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blog_public_read" ON public.blog_posts
  FOR SELECT USING (is_published = true);
CREATE POLICY "blog_super_all" ON public.blog_posts
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));
CREATE POLICY "blog_company_admin_read_own" ON public.blog_posts
  FOR SELECT USING (company_id IS NOT NULL AND public.has_company_role(auth.uid(),'company_admin',company_id));
CREATE POLICY "blog_company_admin_insert_own" ON public.blog_posts
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND company_id IS NOT NULL
    AND public.has_company_role(auth.uid(),'company_admin',company_id)
  );
CREATE POLICY "blog_company_admin_update_own" ON public.blog_posts
  FOR UPDATE USING (company_id IS NOT NULL AND public.has_company_role(auth.uid(),'company_admin',company_id))
  WITH CHECK (company_id IS NOT NULL AND public.has_company_role(auth.uid(),'company_admin',company_id));
CREATE POLICY "blog_company_admin_delete_own" ON public.blog_posts
  FOR DELETE USING (company_id IS NOT NULL AND public.has_company_role(auth.uid(),'company_admin',company_id));

CREATE TRIGGER tg_blog_posts_updated BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- API KEYS (per-company)
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  key_prefix text NOT NULL,           -- first 8 chars, shown in UI
  key_hash text NOT NULL UNIQUE,      -- sha256 hex of full key
  scopes text[] NOT NULL DEFAULT ARRAY['read','write']::text[],
  created_by uuid,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_company ON public.api_keys(company_id);
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apik_company_read" ON public.api_keys
  FOR SELECT USING (
    public.is_super_admin(auth.uid())
    OR public.has_company_role(auth.uid(),'company_admin',company_id)
  );
CREATE POLICY "apik_super_all" ON public.api_keys
  FOR ALL USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- generation/revocation via SECURITY DEFINER RPCs
CREATE OR REPLACE FUNCTION public.create_api_key(_company_id uuid, _name text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _raw text;
  _full text;
  _hash text;
  _prefix text;
  _id uuid;
BEGIN
  IF NOT (public.is_super_admin(auth.uid())
          OR public.has_company_role(auth.uid(),'company_admin',_company_id)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'Name required'; END IF;

  _raw := encode(gen_random_bytes(32), 'hex');
  _full := 'abk_live_' || _raw;
  _hash := encode(digest(_full,'sha256'),'hex');
  _prefix := substr(_full,1,12);

  INSERT INTO public.api_keys (company_id, name, key_prefix, key_hash, created_by)
  VALUES (_company_id, _name, _prefix, _hash, auth.uid())
  RETURNING id INTO _id;

  RETURN jsonb_build_object('id',_id,'api_key',_full,'key_prefix',_prefix);
END $$;

CREATE OR REPLACE FUNCTION public.revoke_api_key(_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _co uuid;
BEGIN
  SELECT company_id INTO _co FROM public.api_keys WHERE id = _id;
  IF _co IS NULL THEN RAISE EXCEPTION 'Key not found'; END IF;
  IF NOT (public.is_super_admin(auth.uid())
          OR public.has_company_role(auth.uid(),'company_admin',_co)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.api_keys SET revoked_at = now() WHERE id = _id AND revoked_at IS NULL;
END $$;

-- pgcrypto for digest()
CREATE EXTENSION IF NOT EXISTS pgcrypto;