-- Assign admin role to priyankgarg28@gmail.com (UID: 49a1a56f-9040-4147-a51c-d5d2867edf2f)
INSERT INTO public.user_roles (user_id, role) 
VALUES ('49a1a56f-9040-4147-a51c-d5d2867edf2f', 'admin') 
ON CONFLICT (user_id, role) DO NOTHING;