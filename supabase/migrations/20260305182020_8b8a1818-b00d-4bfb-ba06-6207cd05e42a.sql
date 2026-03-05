
CREATE TABLE public.sync_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id uuid NOT NULL,
  guest_email text NOT NULL,
  setlist_id uuid NOT NULL REFERENCES public.setlists(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

ALTER TABLE public.sync_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Masters can read own invites" ON public.sync_invites
  FOR SELECT TO authenticated
  USING (master_id = auth.uid());

CREATE POLICY "Guests can read invites by email" ON public.sync_invites
  FOR SELECT TO authenticated
  USING (guest_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Masters can insert invites" ON public.sync_invites
  FOR INSERT TO authenticated
  WITH CHECK (master_id = auth.uid());

CREATE POLICY "Masters can update own invites" ON public.sync_invites
  FOR UPDATE TO authenticated
  USING (master_id = auth.uid());

CREATE POLICY "Guests can update invites by email" ON public.sync_invites
  FOR UPDATE TO authenticated
  USING (guest_email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Masters can delete own invites" ON public.sync_invites
  FOR DELETE TO authenticated
  USING (master_id = auth.uid());
