/* What each URL is.
   ---------------------------------------------------------------
   Every variant page is the same bundle; only this table differs.
   Each `dist/*.html` carries `data-variant` on <html>, `main.tsx`
   reads it once, and everything downstream reads this table rather
   than testing the variant name again.

   One table instead of a condition per feature: adding a variant is
   a row here plus an HTML entry in `vite.config.ts`, and it is not
   possible to add one that is flipped in `App` but unpinned in
   `main.tsx` because both read the same row. */

import type { Mood } from './render/palette';

export type Variant = 'normal' | 'upside-down' | 'light' | 'upside-down-light';

export interface VariantSpec {
  /** Whole page rendered rotated 180°, for a panel mounted upside down. */
  flipped: boolean;
  /** Bank this page is pinned to, or null to follow the clock. */
  mood: Mood | null;
}

export const VARIANTS: Record<Variant, VariantSpec> = {
  'normal': { flipped: false, mood: null },
  'upside-down': { flipped: true, mood: null },
  'light': { flipped: false, mood: 'day' },
  'upside-down-light': { flipped: true, mood: 'day' },
};

/** An unknown `data-variant` falls back to the plain tank rather than
    throwing — a mistyped attribute should cost the variant, not the page. */
export function specFor(variant: string): VariantSpec {
  return VARIANTS[variant as Variant] ?? VARIANTS.normal;
}

/** `day` is the only light bank, so it is the only one whose pre-boot
    chrome (page background, Boot screen) needs to be light too. */
export function isLight(spec: VariantSpec): boolean {
  return spec.mood === 'day';
}
