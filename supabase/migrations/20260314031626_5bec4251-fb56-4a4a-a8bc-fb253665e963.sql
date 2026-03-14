
-- Function: auto-assign admin role if email matches VIP list in global_settings
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  admin_emails_raw text;
  admin_emails text[];
BEGIN
  -- Read admin emails from global_settings (key: 'admin_emails', comma-separated)
  SELECT setting_value INTO admin_emails_raw
  FROM public.global_settings
  WHERE setting_key = 'admin_emails';

  IF admin_emails_raw IS NULL OR admin_emails_raw = '' THEN
    RETURN NEW;
  END IF;

  -- Parse comma-separated list, trimming whitespace
  admin_emails := string_to_array(replace(admin_emails_raw, ' ', ''), ',');

  IF NEW.email = ANY(admin_emails) THEN
    -- Upsert admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger on profile insert or update (covers new signups and re-logins)
DROP TRIGGER IF EXISTS trg_auto_assign_admin ON public.profiles;
CREATE TRIGGER trg_auto_assign_admin
  AFTER INSERT OR UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_admin_role();
