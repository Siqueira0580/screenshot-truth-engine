
CREATE OR REPLACE FUNCTION public.prevent_user_id_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id <> OLD.user_id THEN
    RAISE EXCEPTION 'Operação não permitida: Não é possível transferir a autoria (user_id).';
  END IF;
  RETURN NEW;
END;
$$;
