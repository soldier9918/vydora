CREATE OR REPLACE FUNCTION public.community_submit(_youtube_id text, _title text, _description text, _category text, _is_short boolean,
  _video uuid, _display_name text, _channel_name text, _channel_url text, _consent boolean, _consent_text text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); sid uuid; ver boolean := false;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Please sign in to submit a video.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM youtube_connections WHERE user_id = me) THEN RAISE EXCEPTION 'Connect your YouTube channel to Vydora before submitting a video.'; END IF;
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