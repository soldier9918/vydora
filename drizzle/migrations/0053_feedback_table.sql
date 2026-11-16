CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.feedback TO anon;
GRANT INSERT, SELECT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not) may leave feedback; signed-in users can only attach their own user id.
CREATE POLICY feedback_insert ON public.feedback
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    user_id IS NULL OR user_id = auth.uid()
  );

-- Only admins can read feedback.
CREATE POLICY feedback_select_admin ON public.feedback
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Keep messages and categories sane at the database level too.
CREATE OR REPLACE FUNCTION public.guard_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NEW.message := btrim(NEW.message);
  IF char_length(NEW.message) < 3 OR char_length(NEW.message) > 2000 THEN
    RAISE EXCEPTION 'Feedback must be between 3 and 2000 characters.';
  END IF;
  IF NEW.category NOT IN ('general', 'bug', 'idea', 'billing', 'other') THEN
    RAISE EXCEPTION 'Unknown feedback category.';
  END IF;
  IF NEW.email IS NOT NULL AND char_length(NEW.email) > 255 THEN
    RAISE EXCEPTION 'Email is too long.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER feedback_guard
  BEFORE INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.guard_feedback();