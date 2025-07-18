
-- Step 1: Create System User Record for Edge Functions
-- This fixes the foreign key constraint violation in audit_log table
INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    invited_at,
    confirmation_token,
    confirmation_sent_at,
    recovery_token,
    recovery_sent_at,
    email_change_token_new,
    email_change,
    email_change_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    created_at,
    updated_at,
    phone,
    phone_confirmed_at,
    phone_change,
    phone_change_token,
    phone_change_sent_at,
    confirmed_at,
    email_change_token_current,
    email_change_confirm_status,
    banned_until,
    reauthentication_token,
    reauthentication_sent_at,
    is_sso_user,
    deleted_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000000'::uuid,
    'authenticated',
    'authenticated',
    'system@zepto.internal',
    '',
    now(),
    null,
    '',
    null,
    '',
    null,
    '',
    '',
    null,
    null,
    '{"provider": "system", "providers": ["system"], "is_system_user": true}'::jsonb,
    '{"full_name": "System User", "is_system": true, "purpose": "Edge Functions and System Operations"}'::jsonb,
    false,
    now(),
    now(),
    null,
    null,
    '',
    '',
    null,
    now(),
    '',
    0,
    null,
    '',
    null,
    false,
    null
) ON CONFLICT (id) DO NOTHING;

-- Step 2: Database Recovery - Reset stuck processing photos
UPDATE public.packing_photos 
SET ai_analysis_status = 'pending',
    description = 'Reset from stuck processing state'
WHERE ai_analysis_status = 'processing' 
AND created_at < now() - interval '10 minutes';

-- Step 3: Clean up any failed audit log entries (optional, for cleanliness)
DELETE FROM public.audit_log 
WHERE user_id = '00000000-0000-0000-0000-000000000001'::uuid 
AND action = 'UPDATE' 
AND table_name = 'packing_photos' 
AND created_at < now() - interval '1 hour';
