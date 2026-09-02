/* Biomes.
   ---------------------------------------------------------------
   A biome is everything about *where* the window looks: four palette
   banks, the glyphs the scene is drawn with, and how the three fish
   archetypes are dressed and how fast they move.

   Data only — this file imports nothing, so `palette.ts` can own the
   live state without a cycle.

   **The archetypes are fixed across biomes on purpose.** `tank.fish`
   stores a species name, and the tank is a plain serializable tree that
   survives a biome change; if a biome could introduce its own species
   the stored name might not exist in the next one. Every biome instead
   maps the same three — guppy, darter, drifter — to its own sprites and
   speeds. The shoal is the same shoal, dressed for the place, and
   nothing has to be respawned to move it.

   **One biome's banks are in the atlas at a time.** Four moods times
   eleven slots is 44 rows; three biomes at once would be 132, and the
   atlas is a real texture on a Pi 4B with 2GB shared. Switching biome
   rebuilds the atlas instead, which is the same trade the palette
   already documents for mood changes and rarer. */

/** Eleven colours in the order of `A` in palette.ts. */
export type Bank = readonly string[];

export interface Biome {
  /** Shown in the menu. Keep it short; the panel is 51 columns. */
  label: string;
  bg: { dawn: string; day: string; dusk: string; night: string };
  banks: { dawn: Bank; day: Bank; dusk: Bank; night: Bank };
  /** Kelp-like flora, as [leaning left, upright, leaning right]. */
  flora: string;
  /** Sea floor, as [low, mid, high] against a noise field. */
  floor: string;
  /** Drifting motes, cycled by position. */
  motes: string;
  /** Waterline, cycled by position and time. */
  surface: string;
  /** Sprites per archetype, as [swimming right, swimming left]. */
  sprites: Record<string, [string, string]>;
  /** Normalized [0,1] units per second. */
  speed: Record<string, number>;
  /** Ambient bubbles per second, before any sound. */
  bubbleRate: number;
}

/* --- reef: the original. Warm shallow water. -------------------- */

const REEF: Biome = {
  label: 'reef',
  bg: { dawn: '#141a26', day: '#b3e2fd', dusk: '#0d1218', night: '#020609' },
  banks: {
    dawn: [
      '#26313f', '#3d5266', '#d99a7a', '#c8b89a', '#c07a52', '#3a6a4a',
      '#b8c8d8', '#8a94a0', '#7fd8b4', '#e0a058', '#e06868',
    ],
    day: [
      '#5cc8f0', '#1cc4d6', '#0098e0', '#00788f', '#eb5010', '#0a9c3f',
      '#0a6fd0', '#2b6f96', '#00875a', '#d96a00', '#f01050',
    ],
    dusk: [
      '#1c2733', '#2e4a5c', '#c08a6a', '#c4b48c', '#b8683c', '#2c5c3c',
      '#9fbcc8', '#7a868f', '#7fd8b4', '#d09048', '#c85a5a',
    ],
    night: [
      '#0a1a22', '#102e3a', '#2c6a7c', '#6a6a58', '#6b4530', '#173d26',
      '#4f7b85', '#4a5a60', '#a8ffd8', '#9a6b3c', '#9a4650',
    ],
  },
  flora: '(|)',
  floor: '._,',
  motes: ".`'.,",
  surface: '~~-_-~^',
  sprites: {
    guppy: ['><>', '<><'],
    darter: ['=>', '<='],
    drifter: ['o>', '<o'],
  },
  speed: { guppy: 0.1, darter: 0.18, drifter: 0.06 },
  bubbleRate: 0.12,
};

/* --- kelp: cold temperate forest. Green, taller, slower. -------- */

const KELP: Biome = {
  label: 'kelp',
  bg: { dawn: '#16211f', day: '#cfe8d8', dusk: '#101a17', night: '#04100c' },
  banks: {
    dawn: [
      '#24352f', '#3a5c4c', '#d0a07a', '#c2c096', '#b0764a', '#2f7a48',
      '#b4ccc0', '#87968c', '#7fd8a8', '#dc9a50', '#d86a60',
    ],
    day: [
      '#86d2b6', '#2fbf8e', '#00a86b', '#0d6b73', '#d1490f', '#166b34',
      '#0a6fd0', '#3c6b5c', '#00875a', '#d96a00', '#d3184c',
    ],
    dusk: [
      '#243a33', '#365a4b', '#c08a6a', '#bcb488', '#b0683c', '#2a5c3e',
      '#9fc8b4', '#77877e', '#7fd8a8', '#d09048', '#c85a5a',
    ],
    night: [
      '#0a1c16', '#0f3026', '#2c7c60', '#61705a', '#66452f', '#12401f',
      '#4f857a', '#48605a', '#a8ffd0', '#96683a', '#96464e',
    ],
  },
  flora: '{|}',
  floor: '.-,',
  motes: "'`.,,",
  surface: '~-~~_-',
  sprites: {
    guppy: ['>=>', '<=<'],
    darter: ['->', '<-'],
    drifter: ['c>', '<c'],
  },
  // Colder water, heavier fish: the whole shoal reads slower than the reef.
  speed: { guppy: 0.08, darter: 0.14, drifter: 0.045 },
  bubbleRate: 0.08,
};

/* --- abyss: below the light. Dark at every hour. ---------------- */

const ABYSS: Biome = {
  label: 'abyss',
  /* `day` is the shallowest this ever gets, and it is still dark —
     sunlight does not reach, so the clock changes very little here.
     That makes the abyss the one biome where a light variant page is
     not light, which is correct rather than a bug: the page background
     follows the bank, so the frame goes dark with the water. */
  bg: { dawn: '#050b12', day: '#08131c', dusk: '#04090f', night: '#01050a' },
  banks: {
    dawn: [
      '#0d1c26', '#123246', '#2a6a8c', '#7a8c96', '#7a5a3c', '#123a3a',
      '#4f7b95', '#3f5560', '#7fd8ff', '#8a6b3c', '#9a4650',
    ],
    day: [
      '#102634', '#164058', '#3a86a8', '#93a6b0', '#8a6640', '#164a46',
      '#5f92ac', '#4a6070', '#8fe8ff', '#a07a40', '#b05058',
    ],
    dusk: [
      '#0a1a24', '#0f2c3e', '#256080', '#6a7c88', '#6b4d30', '#0f3634',
      '#456f88', '#3a4e58', '#6fd0f8', '#7a5c34', '#8a4048',
    ],
    night: [
      '#06121a', '#0a2230', '#1c5470', '#5a6a74', '#5a4028', '#0a2c2a',
      '#356078', '#2f424c', '#a8ffe8', '#6a5030', '#7a3844',
    ],
  },
  // No light means no plants; these are vent tubeworms standing in for
  // the kelp, using the same three lean glyphs the scene already draws.
  flora: ':i:',
  floor: '._:',
  motes: "..`'.",
  surface: '-~--_',
  sprites: {
    guppy: ['>o>', '<o<'],
    darter: [':>', '<:'],
    drifter: ['0>', '<0'],
  },
  speed: { guppy: 0.07, darter: 0.13, drifter: 0.04 },
  bubbleRate: 0.05,
};

export const BIOMES: Record<string, Biome> = {
  reef: REEF,
  kelp: KELP,
  abyss: ABYSS,
};

export const BIOME_NAMES = Object.keys(BIOMES);

export const DEFAULT_BIOME = 'reef';
