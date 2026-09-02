/* Palette.
   ---------------------------------------------------------------
   Palette entries are (fg, bg) pairs. Every glyph tile in the atlas is
   painted with its own background, so a dirty-cell blit fully covers
   the cell it replaces — no clearRect pass is needed anywhere.

   Three complete banks — day, dusk, night — rather than one bank whose
   colours change. Recolouring would mean rebuilding the atlas on every
   mood shift; three banks make a mood shift an index offset instead.
   The cost is 27 rows of atlas, about 1900x810 px, which is nothing.

   Night is the brightest the tank ever gets in one respect: GLOW goes
   up, not down. Quiet is meant to be rewarded, so the state you reach
   by leaving it alone should be the one worth looking at. */

export interface Attr {
  fg: string;
  bg: string;
}

/** Slot names, used as an index within whichever bank is current. */
export const A = {
  WATER_DIM: 0,
  WATER: 1,
  SURFACE: 2,
  FISH: 3,
  FISH_ALT: 4,
  KELP: 5,
  BUBBLE: 6,
  UI: 7,
  GLOW: 8,
  TINT1: 9,
  TINT2: 10,
} as const;

export const SLOTS = 11;

export type Mood = 'dawn' | 'day' | 'dusk' | 'night';

export const MOODS: Mood[] = ['dawn', 'day', 'dusk', 'night'];

export const BANK: Record<Mood, number> = {
  dawn: 0,
  day: SLOTS,
  dusk: SLOTS * 2,
  night: SLOTS * 3,
};

const BG_DAWN = '#141a26';
const BG_DAY = '#b3e2fd';
const BG_DUSK = '#0d1218';
const BG_NIGHT = '#020609';

/** Also applied to the page behind the canvas, so the letterboxing
    either side of the 1020px grid matches the water. */
export const BANK_BG: Record<Mood, string> = {
  dawn: BG_DAWN,
  day: BG_DAY,
  dusk: BG_DUSK,
  night: BG_NIGHT,
};

/* Order must match A. */

const DAWN = [
  '#26313f', // WATER_DIM
  '#3d5266', // WATER
  '#d99a7a', // SURFACE — sunrise catching the top of the water
  '#c8b89a', // FISH
  '#c07a52', // FISH_ALT
  '#3a6a4a', // KELP
  '#b8c8d8', // BUBBLE
  '#8a94a0', // UI
  '#7fd8b4', // GLOW
  '#e0a058', // TINT1 — first stage of a held tone
  '#e06868', // TINT2 — second stage
];

/* Daylight, and the only bank that inverts: pale water with the figures
   dark against it, which is what looking into lit shallow water actually
   gives you. Everything else in the palette assumes dark glyphs on
   light, so the UI and the motes go down rather than up.

   Contrast here is carried by *value*, and colour is free on top of it.
   An early pass spent value and chroma on the same move — darkening the
   fish until they were legible left them at so little chroma that they
   read as black silhouettes, and the tank lost the thing it is for.

   The bank is now pushed to cartoon chroma: hues near the edge of the
   gamut, held down in value only as far as legibility at a 20x30 cell
   demands. That ceiling is real and it bites the light hues hardest —
   a fully saturated green or orange is *bright*, and brightness is the
   one thing this bank has no room for. Where a colour had to give, it
   gave value and kept chroma.

   Every tile in this bank carries BG_DAY as its background, so the
   water the eye reads is mostly the background itself and the mote
   colours are a texture over it. Bluing the water means moving BG_DAY,
   not only the three water slots — and deepening BG_DAY costs every
   figure contrast, which is why it stays light while the ink goes
   vivid.

   Two slots invert here and are easy to get backwards, because on the
   dark banks they are the bright things:

   - BUBBLE is white everywhere else. White on pale water is 1.4:1 —
     the bubbles were there and could not be seen. On this bank the
     highlight has to go *down*, so it is a strong blue.
   - TINT1/TINT2 mark a fish being heated by a held note. A bright
     amber lands at 1.6:1, so holding a note made a fish fade out
     rather than glow — the opposite of the effect. Both are held dark
     enough to darken the fish they land on.

   Mote slots are the exception that stays weak on purpose: WATER_DIM
   and WATER are a texture in the water, not figures on it. */
const DAY = [
  '#5cc8f0', // WATER_DIM — blue texture over the background
  '#1cc4d6', // WATER — vivid cyan
  '#0098e0', // SURFACE — electric blue glint at the top of the water
  '#00788f', // FISH — fully saturated teal
  '#eb5010', // FISH_ALT — vivid orange; also the crab
  '#0a9c3f', // KELP — vivid green, held down in value to stay readable
  '#0a6fd0', // BUBBLE — see note below; the one slot that inverts twice
  '#2b6f96', // UI — recessive on purpose; it is not part of the picture
  '#00875a', // GLOW
  '#d96a00', // TINT1 — first stage of a held tone
  '#f01050', // TINT2 — second stage, hotter than the fish orange
];

const DUSK = [
  '#1c2733',
  '#2e4a5c',
  '#c08a6a',
  '#c4b48c',
  '#b8683c',
  '#2c5c3c',
  '#9fbcc8',
  '#7a868f',
  '#7fd8b4',
  '#d09048',
  '#c85a5a',
];

const NIGHT = [
  '#0a1a22',
  '#102e3a',
  '#2c6a7c',
  '#6a6a58',
  '#6b4530',
  '#173d26',
  '#4f7b85',
  '#4a5a60',
  '#a8ffd8', // bioluminescence: the one colour that brightens after dark
  '#9a6b3c',
  '#9a4650',
];

export const PALETTE: Attr[] = [
  ...DAWN.map((fg) => ({ fg, bg: BG_DAWN })),
  ...DAY.map((fg) => ({ fg, bg: BG_DAY })),
  ...DUSK.map((fg) => ({ fg, bg: BG_DUSK })),
  ...NIGHT.map((fg) => ({ fg, bg: BG_NIGHT })),
];
