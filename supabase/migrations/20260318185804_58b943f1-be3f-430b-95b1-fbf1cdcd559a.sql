
CREATE OR REPLACE FUNCTION public.get_public_setlist(p_token uuid)
RETURNS TABLE(
  id uuid,
  name text,
  show_date timestamptz,
  start_time text,
  end_time text,
  musicians jsonb,
  is_public boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT s.id, s.name, s.show_date, s.start_time, s.end_time, s.musicians, s.is_public
  FROM setlists s
  WHERE s.public_share_token = p_token
    AND s.is_public = true;
$$;
