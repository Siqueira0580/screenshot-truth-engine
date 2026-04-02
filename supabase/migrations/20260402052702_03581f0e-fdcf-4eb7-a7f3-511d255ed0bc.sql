
CREATE TABLE public.group_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.community_groups(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read invites"
ON public.group_invites FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Group creator can insert invites"
ON public.group_invites FOR INSERT TO authenticated
WITH CHECK (is_group_creator(auth.uid(), group_id));

CREATE POLICY "Authenticated can update invite status"
ON public.group_invites FOR UPDATE TO authenticated
USING (true)
WITH CHECK (status IN ('accepted', 'rejected'));

CREATE POLICY "Group creator can delete invites"
ON public.group_invites FOR DELETE TO authenticated
USING (is_group_creator(auth.uid(), group_id));
