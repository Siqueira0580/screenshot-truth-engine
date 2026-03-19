
-- Garantir realtime (idempotente com DO block)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Garantir índices (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_dm_sender ON public.direct_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON public.direct_messages(receiver_id, created_at DESC);
