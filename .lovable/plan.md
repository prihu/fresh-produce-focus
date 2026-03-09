

## Root Cause Analysis

The "Loading permissions..." stuck screen when switching tabs is caused by a **stale closure bug** in `SecureAuthContext.tsx`.

### The Bug

1. `handleAuthStateChange` is defined in the component body and reads `rolesFetched` from React state
2. The `useEffect` on line 170 has an **empty dependency array `[]`**, so the `onAuthStateChange` callback (line 203-208) captures `handleAuthStateChange` **from the first render only**
3. In that first-render closure, `rolesFetched` is permanently `false`
4. When the user switches tabs and comes back, Supabase fires auth events (e.g. token refresh or session re-validation). If the event is NOT `TOKEN_REFRESHED`, it falls through to line 109
5. Line 109 checks `!rolesFetched` -- which is **always `true`** due to the stale closure -- so it re-fetches roles every time, setting `rolesLoading = true`
6. If `fetchUserRoles()` is slow or hangs (common after tab switch due to network reconnection), `rolesLoading` stays `true` and the UI shows "Loading permissions..." indefinitely

### The Fix

Two changes in `SecureAuthContext.tsx`:

**1. Use a `useRef` for `rolesFetched` instead of `useState`**
- Refs are not subject to stale closures -- they always hold the current value
- This ensures the `onAuthStateChange` callback correctly sees `rolesFetched = true` after initial fetch, preventing unnecessary role re-fetches on tab switch

**2. Add a 10-second timeout to `fetchUserRoles()`**
- Wrap the Supabase query in `Promise.race([query, timeout])` as a safety net
- If it times out, `rolesLoading` is cleared and the user sees an error toast instead of infinite spinner

### Also Fix: Build Errors

The build errors in `analyze-image/index.ts` and `openai-health-check/index.ts` are unrelated TypeScript issues (`unknown` type on catch variables, wrong array typing). These need `(error as Error).message` casts and proper type annotations.

### Files Changed
- `src/contexts/SecureAuthContext.tsx` -- ref instead of state for `rolesFetched`, add timeout to `fetchUserRoles`
- `supabase/functions/analyze-image/index.ts` -- fix `unknown` type errors on catch variables
- `supabase/functions/openai-health-check/index.ts` -- fix array type and `unknown` type errors

