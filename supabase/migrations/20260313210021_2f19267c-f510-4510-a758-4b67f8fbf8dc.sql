
CREATE OR REPLACE FUNCTION public.get_public_setlist_items(p_token uuid)
RETURNS TABLE(
  id uuid,
  "position" int,
  song_id uuid,
  bpm int,
  speed int,
  loop_count int,
  transposed_key text,
  song_title text,
  song_artist text,
  song_musical_key text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT si.id, si.position, si.song_id, si.bpm, si.speed, si.loop_count, si.transposed_key,
         songs.title, songs.artist, songs.musical_key
  FROM setlist_items si
  JOIN setlists s ON s.id = si.setlist_id
  JOIN songs ON songs.id = si.song_id
  WHERE s.public_share_token = p_token
  ORDER BY si.position;
$$;
