
-- Phase 1: Delete Related Data
-- Delete packing photos associated with user's orders
DELETE FROM public.packing_photos 
WHERE order_id IN (
  SELECT id FROM public.orders 
  WHERE packer_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7'
);

-- Delete all orders created by the user
DELETE FROM public.orders 
WHERE packer_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';

-- Delete audit log entries for the user
DELETE FROM public.audit_log 
WHERE user_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';

-- Phase 2: Delete User Records
-- Delete user role assignments
DELETE FROM public.user_roles 
WHERE user_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';

-- Delete user profile
DELETE FROM public.profiles 
WHERE id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';

-- Phase 3: Delete Auth Account
-- Delete the user from auth.users table (this will cascade to any remaining references)
DELETE FROM auth.users 
WHERE id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';

-- Verification queries (optional - run these to confirm deletion)
-- SELECT COUNT(*) FROM public.packing_photos WHERE order_id IN (SELECT id FROM public.orders WHERE packer_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7');
-- SELECT COUNT(*) FROM public.orders WHERE packer_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';
-- SELECT COUNT(*) FROM public.audit_log WHERE user_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';
-- SELECT COUNT(*) FROM public.user_roles WHERE user_id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';
-- SELECT COUNT(*) FROM public.profiles WHERE id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';
-- SELECT COUNT(*) FROM auth.users WHERE id = 'dbe9450e-5c2d-4902-bdd5-d8ac0ba404f7';
