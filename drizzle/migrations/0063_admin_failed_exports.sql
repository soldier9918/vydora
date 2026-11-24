ALTER TABLE public.video_exports ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE public.video_exports ADD COLUMN IF NOT EXISTS failed_at timestamptz;
CREATE OR REPLACE FUNCTION public.admin_failed_exports(_limit integer DEFAULT 200)
RETURNS TABLE(id uuid, user_id uuid, video_id uuid, email text, title text, source text, quality text, format text, error_message text, credits_charged integer, refunded boolean, created_at timestamptz, failed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'pg_catalog', 'public', 'pg_temp'
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT f.* FROM (
    SELECT e.id, e.user_id, e.video_id, u.email::text, v.title, 'browser'::text AS source,
      e.quality, e.format, e.error_message, e.credits_charged, e.refunded, e.created_at, e.failed_at
    FROM public.video_exports e
    LEFT JOIN auth.users u ON u.id = e.user_id
    LEFT JOIN public.videos v ON v.id = e.video_id
    WHERE e.status = 'failed'
      AND NOT EXISTS (SELECT 1 FROM public.admin_hidden_users h WHERE h.user_id = e.user_id)
    UNION ALL
    SELECT r.id, r.user_id, r.video_id, u.email::text, v.title, 'cloud'::text,
      v.quality, 'mp4'::text, r.error, r.credits_charged, r.credits_refunded, r.created_at, r.updated_at
    FROM public.render_jobs r
    LEFT JOIN auth.users u ON u.id = r.user_id
    LEFT JOIN public.videos v ON v.id = r.video_id
    WHERE r.status = 'failed'
      AND NOT EXISTS (SELECT 1 FROM public.admin_hidden_users h WHERE h.user_id = r.user_id)
  ) f
  ORDER BY coalesce(f.failed_at, f.created_at) DESC, f.id
  LIMIT greatest(1, least(coalesce(_limit, 200), 500));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_failed_exports(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_failed_exports(integer) TO authenticated;
COMMENT ON FUNCTION public.admin_failed_exports(integer) IS 'Read-only admin failure report; does not expose media or modify exports, refunds or credit balances.';