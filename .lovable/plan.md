

## Security Fix Plan

### Current State
- **Refunds table**: Already secure — only the "Admins can manage all refunds" policy exists. The open policies were already removed. No action needed.
- **`test-openai-connectivity`**: `verify_jwt = false`, no auth check in code — fully open.
- **`openai-health-check`**: No entry in `config.toml` (defaults to `verify_jwt = true`), no auth check in code.
- **`/health-check` route**: Unprotected in `App.tsx`.
- **Admin role**: priyankgarg28@gmail.com (UID `49a1a56f-9040-4147-a51c-d5d2867edf2f`) has only `packer` role.

### Changes

#### 1. Assign admin role to priyankgarg28@gmail.com
- SQL insert into `user_roles`: `INSERT INTO public.user_roles (user_id, role) VALUES ('49a1a56f-9040-4147-a51c-d5d2867edf2f', 'admin') ON CONFLICT (user_id, role) DO NOTHING;`

#### 2. Secure `test-openai-connectivity` edge function
Add auth guard at the top of the handler:
- Extract `Authorization` header
- Create Supabase client with the user's token
- Call `supabase.auth.getUser()` to verify identity
- Query `user_roles` table for `admin` role
- Return 401/403 if unauthorized
- Keep `verify_jwt = false` in config.toml (auth validated in code per signing-keys pattern)

#### 3. Secure `openai-health-check` edge function
Same auth + admin guard pattern. Add `[functions.openai-health-check] verify_jwt = false` to `config.toml`.

#### 4. Update `supabase/config.toml`
- Add `[functions.openai-health-check]` section with `verify_jwt = false`
- Keep existing `[functions.test-openai-connectivity]` with `verify_jwt = false`
- Change `[functions.analyze-image]` from `verify_jwt = true` to `verify_jwt = false` (align with signing-keys pattern; it already requires auth via Supabase client)

#### 5. Protect `/health-check` route in `App.tsx`
Wrap with `<ProtectedRoute requiredRole="admin">` so only admin users can access the health check UI.

### Files Changed
| File | Change |
|------|--------|
| Database (insert) | Add admin role for priyankgarg28@gmail.com |
| `supabase/functions/test-openai-connectivity/index.ts` | Add auth + admin role guard |
| `supabase/functions/openai-health-check/index.ts` | Add auth + admin role guard |
| `supabase/config.toml` | Add openai-health-check entry, update analyze-image |
| `src/App.tsx` | Wrap `/health-check` with `<ProtectedRoute requiredRole="admin">` |

### No Impact on Existing Functionality
- Packer users see no changes — they never access `/health-check` or call these edge functions
- The admin user retains their existing `packer` role and gains `admin` access
- `supabase.functions.invoke()` automatically sends the JWT, so the admin's calls work seamlessly

