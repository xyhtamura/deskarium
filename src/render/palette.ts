/* Palette.
   ---------------------------------------------------------------
   Palette entries are (fg, bg) pairs. Every glyph tile in the atlas is
   painted with its own background, so a dirty-cell blit fully covers
   the cell it replaces — no clearRect pass is needed anywhere.

   Four complete banks — dawn, day, dusk, night — rather than one bank
   whose colours change. Recolouring would mean rebuilding the atlas on
   every mood shift; four banks make a mood shift an index offset
   instead, at 44 rows of atlas.

   The colours themselves come from the current biome (`biomes.ts`), so
   a biome change *does* rebuild the atlas. That is the same trade in
   the other direction: mood changes about once an hour and must be
   free, biome changes when somebody asks for it and can afford a few
   milliseconds. Holding every biome's banks at once would be 132 rows
   of texture on a Pi with 2GB shared, which is the thing being avoided.

   Night is the brightest the tank ever gets in one respect: GLOW goes
   up, not down. Quiet is meant to be rewarded, so the state you reach
   by leaving it alone should be the one worth looking at. */

import { BIOMES, BIOME_NAMES, DEFAULT_BIOME, type Biome } from './biomes';

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

/* The live bank set. Both are filled by `setBiome` and mutated **in
   place**, never reassigned: every module that imported them at load
   holds the same object, so a biome change reaches all of them without
   anyone re-reading anything.

   Changing these invalidates the glyph atlas, which bakes a background
   into every tile. `paletteVersion` is how the frame loop notices. */
export const PALETTE: Attr[] = [];

/** Also applied to the page behind the canvas, so the letterboxing
    either side of the 1020px grid matches the water. */
export const BANK_BG: Record<Mood, string> = {
  dawn: '',
  day: '',
  dusk: '',
  night: '',
};

let biome: Biome = BIOMES[DEFAULT_BIOME];
let paletteVersion = 0;

export function currentBiome(): Biome {
  return biome;
}

export function currentBiomeName(): string {
  return BIOME_NAMES.find((n) => BIOMES[n] === biome) ?? DEFAULT_BIOME;
}

/** Bumped whenever the atlas would have to be rebuilt. */
export function getPaletteVersion(): number {
  return paletteVersion;
}

export function setBiome(name: string): void {
  const next = BIOMES[name];
  if (!next || next === biome) return;
  biome = next;
  applyBiome();
}

function applyBiome(): void {
  PALETTE.length = 0;
  for (const mood of MOODS) {
    const bg = biome.bg[mood];
    for (const fg of biome.banks[mood]) PALETTE.push({ fg, bg });
    BANK_BG[mood] = bg;
  }
  paletteVersion++;
}

applyBiome();
