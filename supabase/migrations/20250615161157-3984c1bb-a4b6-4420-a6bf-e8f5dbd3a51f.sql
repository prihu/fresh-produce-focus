
-- This migration assigns the 'packer' role to all existing users who do not have any role assigned yet.
-- This is necessary because a previous migration might have cleared the user_roles table,
-- and the trigger to assign roles only runs for new user sign-ups.

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'packer'
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id
WHERE ur.user_id IS NULL;
