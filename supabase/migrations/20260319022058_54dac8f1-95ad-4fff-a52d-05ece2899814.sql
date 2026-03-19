
-- 1. Tabela de curtidas
CREATE TABLE public.setlist_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, setlist_id)
);

ALTER TABLE public.setlist_likes ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer pessoa autenticada pode ler likes
CREATE POLICY "Anyone can read likes" ON public.setlist_likes
  FOR SELECT TO authenticated USING (true);

-- INSERT: apenas o próprio utilizador
CREATE POLICY "Users can insert own likes" ON public.setlist_likes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- DELETE: apenas o próprio utilizador
CREATE POLICY "Users can delete own likes" ON public.setlist_likes
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Tabela de comentários
CREATE TABLE public.setlist_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.setlist_comments ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer pessoa autenticada pode ler comentários
CREATE POLICY "Anyone can read comments" ON public.setlist_comments
  FOR SELECT TO authenticated USING (true);

-- INSERT: apenas o próprio utilizador
CREATE POLICY "Users can insert own comments" ON public.setlist_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- DELETE: apenas o próprio utilizador
CREATE POLICY "Users can delete own comments" ON public.setlist_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
