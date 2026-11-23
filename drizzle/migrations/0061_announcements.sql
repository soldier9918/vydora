CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  link_url text,
  link_text text,
  tone text NOT NULL DEFAULT 'info',
  audience text NOT NULL DEFAULT 'all',
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  allow_dismiss boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.active_announcements()
RETURNS TABLE(id uuid, message text, link_url text, link_text text, tone text, allow_dismiss boolean, updated_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.id, a.message, a.link_url, a.link_text, a.tone, a.allow_dismiss, a.updated_at FROM announcements a
  WHERE a.is_active AND (a.starts_at IS NULL OR a.starts_at <= now()) AND (a.ends_at IS NULL OR a.ends_at > now())
    AND (a.audience = 'all'
      OR (a.audience = 'logged_in' AND auth.uid() IS NOT NULL)
      OR (a.audience = 'paid_only' AND auth.uid() IS NOT NULL AND (public.has_active_subscription(auth.uid()) OR public.has_role(auth.uid(),'admin'))))
  ORDER BY a.created_at DESC LIMIT 3 $$;

CREATE OR REPLACE FUNCTION public.admin_announcements()
RETURNS SETOF public.announcements LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN QUERY SELECT * FROM announcements ORDER BY created_at DESC;
END $$;

CREATE OR REPLACE FUNCTION public.admin_save_announcement(_id uuid, _message text, _link_url text, _link_text text, _tone text, _audience text, _starts_at timestamptz, _ends_at timestamptz, _is_active boolean, _allow_dismiss boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  _message := btrim(coalesce(_message,''));
  IF char_length(_message) < 3 OR char_length(_message) > 280 THEN RAISE EXCEPTION 'Message must be 3 to 280 characters.'; END IF;
  IF _tone NOT IN ('info','update','warning','urgent') THEN RAISE EXCEPTION 'Unknown tone'; END IF;
  IF _audience NOT IN ('all','logged_in','paid_only') THEN RAISE EXCEPTION 'Unknown audience'; END IF;
  _link_url := nullif(btrim(coalesce(_link_url,'')),'');
  IF _link_url IS NOT NULL AND _link_url !~ '^(https://[^\s"<>]+|/[^\s"<>]*)$' THEN RAISE EXCEPTION 'Link must start with https:// or /'; END IF;
  IF _starts_at IS NOT NULL AND _ends_at IS NOT NULL AND _ends_at <= _starts_at THEN RAISE EXCEPTION 'End time must be after start time.'; END IF;
  IF _id IS NULL THEN
    INSERT INTO announcements(message, link_url, link_text, tone, audience, starts_at, ends_at, is_active, allow_dismiss)
    VALUES (_message, _link_url, left(nullif(btrim(coalesce(_link_text,'')),''),40), _tone, _audience, _starts_at, _ends_at, coalesce(_is_active,true), coalesce(_allow_dismiss,true)) RETURNING id INTO rid;
  ELSE
    UPDATE announcements SET message=_message, link_url=_link_url, link_text=left(nullif(btrim(coalesce(_link_text,'')),''),40), tone=_tone, audience=_audience,
      starts_at=_starts_at, ends_at=_ends_at, is_active=coalesce(_is_active,true), allow_dismiss=coalesce(_allow_dismiss,true), updated_at=now()
    WHERE id=_id RETURNING id INTO rid;
  END IF;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.admin_set_announcement_active(_id uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE announcements SET is_active=_active, updated_at=now() WHERE id=_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_announcement(_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  DELETE FROM announcements WHERE id=_id;
END $$;

REVOKE ALL ON FUNCTION public.admin_announcements(), public.admin_save_announcement(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,boolean), public.admin_set_announcement_active(uuid,boolean), public.admin_delete_announcement(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.admin_announcements(), public.admin_save_announcement(uuid,text,text,text,text,text,timestamptz,timestamptz,boolean,boolean), public.admin_set_announcement_active(uuid,boolean), public.admin_delete_announcement(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.active_announcements() TO anon, authenticated;