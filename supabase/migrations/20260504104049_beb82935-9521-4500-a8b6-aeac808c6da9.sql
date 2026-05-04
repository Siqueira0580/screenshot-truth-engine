CREATE TABLE public.user_login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  login_at timestamptz NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

CREATE INDEX idx_user_login_logs_user_login_at
  ON public.user_login_logs (user_id, login_at DESC);

ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin or self can read login logs"
  ON public.user_login_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR user_id = auth.uid());

CREATE POLICY "User can insert own login log"
  ON public.user_login_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can delete login logs"
  ON public.user_login_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));