-- Tabela para registrar exclusões de músicas (auditoria)
CREATE TABLE IF NOT EXISTS public.song_deletion_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  song_id uuid NOT NULL,
  title text,
  artist text,
  deleted_by uuid,
  deleted_by_email text,
  deleted_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.song_deletion_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read deletion logs"
ON public.song_deletion_logs FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can insert deletion logs"
ON public.song_deletion_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Trigger para capturar exclusões automaticamente
CREATE OR REPLACE FUNCTION public.log_song_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
BEGIN
  SELECT email INTO user_email FROM public.profiles WHERE id = auth.uid();
  INSERT INTO public.song_deletion_logs (song_id, title, artist, deleted_by, deleted_by_email)
  VALUES (OLD.id, OLD.title, OLD.artist, auth.uid(), user_email);
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS songs_log_deletion ON public.songs;
CREATE TRIGGER songs_log_deletion
BEFORE DELETE ON public.songs
FOR EACH ROW
EXECUTE FUNCTION public.log_song_deletion();