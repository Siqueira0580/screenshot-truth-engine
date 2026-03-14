CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, avatar_url, terms_accepted)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'last_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((NEW.raw_user_meta_data->>'terms_accepted')::boolean, false)
  );
  RETURN NEW;
END;
$function$;