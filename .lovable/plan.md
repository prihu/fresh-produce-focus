

## Impact Analysis: Configurable Model Selection — Zero Negative Impact

### What Changes

Each of the 3 edge functions gets one line added at the top of its logic:

```typescript
const model = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-4o';
```

Then every hardcoded `'gpt-4o'` or `'gpt-4o-mini'` string is replaced with that variable.

### Why There Is Zero Impact

| Concern | Analysis |
|---------|----------|
| **No secrets set yet** | `Deno.env.get()` returns `undefined`, so the `||` fallback kicks in. The exact same model strings used today (`gpt-4o`, `gpt-4o-mini`) become the defaults. Behavior is identical. |
| **Secrets set later** | Only takes effect when you explicitly add a secret in the Supabase dashboard. Until then, nothing changes. |
| **Invalid model name set** | OpenAI returns a clear error; the functions already handle API errors gracefully and surface them to the UI. No crash, no data loss. |
| **analyze-image (core pipeline)** | Default remains `gpt-4o` — the exact model used today. Packer workflow is unaffected. |
| **health-check / connectivity test** | Default remains `gpt-4o-mini` / `gpt-4o` respectively — same as today. Admin-only pages, no user-facing impact. |
| **No new dependencies** | `Deno.env.get()` is a built-in Deno API already used everywhere for `OPENAI_API_KEY`. |
| **No database changes** | None. |
| **No frontend changes** | None. |

### Implementation Plan

#### 1. `supabase/functions/analyze-image/index.ts`
- Add `const model = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-4o';` before the OpenAI call (~line 386)
- Replace `model: 'gpt-4o'` with `model` on line 387

#### 2. `supabase/functions/test-openai-connectivity/index.ts`
- Add `const model = Deno.env.get('OPENAI_MODEL_PRIMARY') || 'gpt-4o';` before line 73
- Replace both `model: 'gpt-4o'` (lines 74 and 110) with `model`

#### 3. `supabase/functions/openai-health-check/index.ts`
- Add `const model = Deno.env.get('OPENAI_MODEL_LIGHTWEIGHT') || 'gpt-4o-mini';` before line 105
- Replace both `model: 'gpt-4o-mini'` (lines 106 and 128) with `model`

### Summary

This is a pure refactor with hardcoded defaults matching current values. No behavior changes unless you explicitly set `OPENAI_MODEL_PRIMARY` or `OPENAI_MODEL_LIGHTWEIGHT` secrets in the Supabase dashboard later. Zero second-order impact.

