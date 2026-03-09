

## Plan: Rename "Zepto" to "FreshCheck AI" across the app

Three files need updating:

1. **`src/pages/Auth.tsx`** (line 93): Change `"Zepto Quality Assurance"` → `"FreshCheck AI Quality Assurance"`
2. **`src/pages/Packer.tsx`** (line 14): Change `"Zepto Freshness Checker"` → `"FreshCheck AI Freshness Checker"`
3. **`supabase/functions/analyze-image/index.ts`** (line 395): Change `"Zepto grocery delivery"` → `"FreshCheck AI grocery delivery"`

All three are simple string replacements. The edge function change will deploy automatically.

