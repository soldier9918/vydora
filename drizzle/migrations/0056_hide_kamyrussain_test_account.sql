INSERT INTO public.admin_hidden_users(user_id)
SELECT id FROM auth.users WHERE lower(email) = 'kamyrussain@gmail.com'
ON CONFLICT DO NOTHING;