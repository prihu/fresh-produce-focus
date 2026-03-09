

## Problem

The delete button icon uses `text-muted-foreground` which is too faint to see on mobile. It only becomes visible on hover (`hover:text-destructive`), which on touch devices requires a long-press or tap-and-hold.

## Fix

In `OrderCard.tsx` line 159, change the button styling to use a visible color by default:

**From:** `text-muted-foreground hover:text-destructive hover:bg-destructive/10`  
**To:** `text-red-400 hover:text-destructive hover:bg-destructive/10`

This makes the trash icon always visible with a soft red tone, darkening on interaction.

### Files Changed
- `src/components/packer/dashboard/OrderCard.tsx` — line 159, update button color class

