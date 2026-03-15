UPDATE public.global_settings SET setting_value = 'admin@exemplo.com,duda.siqueira2@gmail.com', updated_at = now() WHERE setting_key = 'admin_emails';

-- Also directly assign admin role if user already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'duda.siqueira2@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;