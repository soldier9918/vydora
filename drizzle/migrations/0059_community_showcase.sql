CREATE TABLE public.community_creators (
  user_id uuid PRIMARY KEY,
  slug text NOT NULL UNIQUE DEFAULT lower(substr(md5(gen_random_uuid()::text),1,10)),
  display_name text NOT NULL DEFAULT '',
  channel_name text NOT NULL DEFAULT '',
  channel_url text NOT NULL DEFAULT '',
  bio text NOT NULL DEFAULT '',
  avatar_url text,
  consent_withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.community_creators TO authenticated;
GRANT ALL ON public.community_creators TO service_role;
ALTER TABLE public.community_creators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own creator read" ON public.community_creators FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.community_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_id uuid,
  youtube_video_id text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL,
  is_short boolean NOT NULL DEFAULT false,
  verified_vydora boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  featured boolean NOT NULL DEFAULT false,
  consent_text text NOT NULL,
  consent_at timestamptz NOT NULL,
  withdrawn_at timestamptz,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX community_one_live_per_video ON public.community_submissions(youtube_video_id) WHERE status IN ('pending','approved');
CREATE INDEX community_status_idx ON public.community_submissions(status, created_at DESC);
GRANT SELECT ON public.community_submissions TO authenticated;
GRANT ALL ON public.community_submissions TO service_role;
ALTER TABLE public.community_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own submissions read" ON public.community_submissions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.community_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.community_submissions(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.community_clean(_t text, _max int) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT left(btrim(regexp_replace(regexp_replace(coalesce(_t,''), '<[^>]*>', '', 'g'), '[[:cntrl:]]', ' ', 'g')), _max) $$;

CREATE OR REPLACE FUNCTION public.community_submit(_youtube_id text, _title text, _description text, _category text, _is_short boolean,
  _video uuid, _display_name text, _channel_name text, _channel_url text, _consent boolean, _consent_text text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); sid uuid; ver boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in to submit a video.'; END IF;
  IF _consent IS NOT TRUE OR coalesce(_consent_text,'') = '' THEN RAISE EXCEPTION 'Please tick the consent box to submit.'; END IF;
  IF _youtube_id IS NULL OR _youtube_id !~ '^[A-Za-z0-9_-]{11}$' THEN RAISE EXCEPTION 'That is not a valid YouTube video link.'; END IF;
  IF _category NOT IN ('horror','history','education','science','storytelling','finance','shorts','entertainment','other') THEN RAISE EXCEPTION 'Choose a category.'; END IF;
  IF char_length(public.community_clean(_title,120)) < 3 THEN RAISE EXCEPTION 'Add a title of at least 3 characters.'; END IF;
  IF _channel_url IS NULL OR _channel_url !~ '^https://(www\.|m\.)?youtube\.com/(@[A-Za-z0-9._-]{3,100}|channel/UC[A-Za-z0-9_-]{22}|c/[A-Za-z0-9._-]{1,100})/?$' THEN RAISE EXCEPTION 'Add a valid YouTube channel link.'; END IF;
  IF char_length(public.community_clean(_channel_name,80)) < 1 THEN RAISE EXCEPTION 'Add your channel name.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('community:'||me::text));
  IF (SELECT count(*) FROM community_submissions WHERE user_id = me AND created_at > now() - interval '1 day') >= 5 THEN
    RAISE EXCEPTION 'You can submit up to 5 videos a day. Please try again tomorrow.'; END IF;
  IF EXISTS (SELECT 1 FROM community_submissions WHERE youtube_video_id = _youtube_id AND status IN ('pending','approved')) THEN
    RAISE EXCEPTION 'This video has already been submitted.'; END IF;
  IF _video IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM videos WHERE id = _video AND user_id = me) THEN RAISE EXCEPTION 'Project not found.'; END IF;
    ver := EXISTS (SELECT 1 FROM youtube_uploads WHERE video_id = _video AND user_id = me AND youtube_video_id = _youtube_id);
  ELSE
    ver := EXISTS (SELECT 1 FROM youtube_uploads WHERE user_id = me AND youtube_video_id = _youtube_id);
  END IF;
  INSERT INTO community_creators(user_id, display_name, channel_name, channel_url)
    VALUES (me, public.community_clean(_display_name,60), public.community_clean(_channel_name,80), _channel_url)
    ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, channel_name = EXCLUDED.channel_name,
      channel_url = EXCLUDED.channel_url, consent_withdrawn_at = NULL, updated_at = now();
  INSERT INTO community_submissions(user_id, video_id, youtube_video_id, title, description, category, is_short, verified_vydora, consent_text, consent_at)
    VALUES (me, _video, _youtube_id, public.community_clean(_title,120), public.community_clean(_description,1000), _category, coalesce(_is_short,false), ver, left(_consent_text,1000), now())
    RETURNING id INTO sid;
  RETURN sid;
END $$;

CREATE OR REPLACE FUNCTION public.community_withdraw(_id uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE community_submissions SET status = 'withdrawn', featured = false, withdrawn_at = now(), updated_at = now()
   WHERE id = _id AND user_id = auth.uid() AND status <> 'withdrawn';
  RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION public.community_withdraw_all() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  UPDATE community_submissions SET status = 'withdrawn', featured = false, withdrawn_at = now(), updated_at = now()
   WHERE user_id = auth.uid() AND status <> 'withdrawn';
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE community_creators SET consent_withdrawn_at = now(), updated_at = now() WHERE user_id = auth.uid();
  RETURN n;
END $$;

CREATE OR REPLACE FUNCTION public.community_update_profile(_display_name text, _channel_name text, _channel_url text, _bio text, _avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in.'; END IF;
  IF _channel_url !~ '^https://(www\.|m\.)?youtube\.com/(@[A-Za-z0-9._-]{3,100}|channel/UC[A-Za-z0-9_-]{22}|c/[A-Za-z0-9._-]{1,100})/?$' THEN RAISE EXCEPTION 'Add a valid YouTube channel link.'; END IF;
  IF _avatar_url IS NOT NULL AND _avatar_url <> '' AND _avatar_url !~ '^https://[A-Za-z0-9.-]+/[^\s"<>]{0,400}$' THEN RAISE EXCEPTION 'Picture link must start with https://'; END IF;
  INSERT INTO community_creators(user_id, display_name, channel_name, channel_url, bio, avatar_url)
  VALUES (auth.uid(), community_clean(_display_name,60), community_clean(_channel_name,80), _channel_url, community_clean(_bio,400), nullif(_avatar_url,''))
  ON CONFLICT (user_id) DO UPDATE SET display_name = EXCLUDED.display_name, channel_name = EXCLUDED.channel_name, channel_url = EXCLUDED.channel_url,
    bio = EXCLUDED.bio, avatar_url = EXCLUDED.avatar_url, updated_at = now();
END $$;

-- Public read: approved, not withdrawn, owner consent active. No user ids or emails.
CREATE OR REPLACE FUNCTION public.community_gallery(_creator text DEFAULT NULL, _id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, youtube_video_id text, title text, description text, category text, is_short boolean, verified_vydora boolean,
  featured boolean, approved_at timestamptz, creator_slug text, creator_name text, channel_name text, channel_url text, creator_bio text, creator_avatar text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.youtube_video_id, s.title, s.description, s.category, s.is_short, s.verified_vydora, s.featured, s.reviewed_at,
         c.slug, nullif(c.display_name,''), c.channel_name, c.channel_url, c.bio, c.avatar_url
    FROM community_submissions s JOIN community_creators c ON c.user_id = s.user_id
   WHERE s.status = 'approved' AND s.withdrawn_at IS NULL AND c.consent_withdrawn_at IS NULL
     AND (_creator IS NULL OR c.slug = _creator) AND (_id IS NULL OR s.id = _id)
   ORDER BY s.featured DESC, s.reviewed_at DESC NULLS LAST LIMIT 500 $$;
GRANT EXECUTE ON FUNCTION public.community_gallery(text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.community_report(_id uuid, _reason text, _details text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Please sign in to report a video.'; END IF;
  IF _reason NOT IN ('not_mine','inappropriate','misleading','spam','other') THEN RAISE EXCEPTION 'Choose a reason.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM community_submissions WHERE id = _id AND status = 'approved') THEN RAISE EXCEPTION 'Video not found.'; END IF;
  IF (SELECT count(*) FROM community_reports WHERE reporter_id = auth.uid() AND created_at > now() - interval '1 day') >= 10 THEN
    RAISE EXCEPTION 'You have sent a lot of reports today. Please try again tomorrow.'; END IF;
  IF EXISTS (SELECT 1 FROM community_reports WHERE reporter_id = auth.uid() AND submission_id = _id AND status = 'open') THEN RETURN; END IF;
  INSERT INTO community_reports(submission_id, reporter_id, reason, details) VALUES (_id, auth.uid(), _reason, community_clean(_details,1000));
END $$;

CREATE OR REPLACE FUNCTION public.admin_community() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  RETURN jsonb_build_object(
    'submissions', COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC) FROM (
      SELECT s.id, s.youtube_video_id, s.title, s.description, s.category, s.is_short, s.verified_vydora, s.status, s.featured,
             s.consent_text, s.consent_at, s.withdrawn_at, s.reviewed_at, s.review_note, s.created_at, u.email::text AS email,
             c.display_name, c.channel_name, c.channel_url, c.consent_withdrawn_at,
             (SELECT count(*) FROM community_reports r WHERE r.submission_id = s.id AND r.status = 'open') AS open_reports
        FROM community_submissions s LEFT JOIN auth.users u ON u.id = s.user_id LEFT JOIN community_creators c ON c.user_id = s.user_id
       ORDER BY s.created_at DESC LIMIT 500) x), '[]'::jsonb),
    'reports', COALESCE((SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC) FROM (
      SELECT r.id, r.submission_id, r.reason, r.details, r.status, r.created_at, s.title FROM community_reports r
        JOIN community_submissions s ON s.id = r.submission_id ORDER BY r.created_at DESC LIMIT 300) r), '[]'::jsonb));
END $$;

CREATE OR REPLACE FUNCTION public.admin_community_moderate(_id uuid, _action text, _note text DEFAULT NULL,
  _category text DEFAULT NULL, _description text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF _action = 'approve' THEN
    UPDATE community_submissions SET status = 'approved', reviewed_at = now(), review_note = _note, updated_at = now() WHERE id = _id AND status IN ('pending','rejected','removed');
  ELSIF _action = 'reject' THEN
    UPDATE community_submissions SET status = 'rejected', featured = false, reviewed_at = now(), review_note = _note, updated_at = now() WHERE id = _id AND status <> 'withdrawn';
  ELSIF _action = 'remove' THEN
    UPDATE community_submissions SET status = 'removed', featured = false, review_note = _note, updated_at = now() WHERE id = _id AND status <> 'withdrawn';
  ELSIF _action = 'feature' THEN
    UPDATE community_submissions SET featured = true, updated_at = now() WHERE id = _id AND status = 'approved';
  ELSIF _action = 'unfeature' THEN
    UPDATE community_submissions SET featured = false, updated_at = now() WHERE id = _id;
  ELSIF _action = 'edit' THEN
    IF _category IS NOT NULL AND _category NOT IN ('horror','history','education','science','storytelling','finance','shorts','entertainment','other') THEN RAISE EXCEPTION 'Unknown category'; END IF;
    UPDATE community_submissions SET category = coalesce(_category, category),
      description = CASE WHEN _description IS NULL THEN description ELSE community_clean(_description,1000) END, updated_at = now() WHERE id = _id;
  ELSE RAISE EXCEPTION 'Unknown action'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.admin_community_report_done(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE community_reports SET status = 'reviewed' WHERE id = _id;
END $$;

REVOKE EXECUTE ON FUNCTION public.community_submit(text,text,text,text,boolean,uuid,text,text,text,boolean,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.community_submit(text,text,text,text,boolean,uuid,text,text,text,boolean,text) TO authenticated;