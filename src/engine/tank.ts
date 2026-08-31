/* Tank state.
   ---------------------------------------------------------------
   One plain, serializable tree. No class instances, no functions,
   no back-pointers, no references between entries — species and
   kind are string ids, not object links.

   Session persistence is all that is wanted for now, so nothing is
   written to disk. Keeping the shape serializable costs nothing
   today and makes adding storage later a one-liner:
   JSON.stringify(tank).

   Positions are normalized: x 0..1 left to right, y 0..1 surface to
   floor. The grid is a view parameter, so changing COLS/ROWS never
   touches anything in here.

   THE RULE: every state change self-reverses, and nothing can ever
   be lost. No death, no hunger, no decay, no neglect meter. If a
   mechanic cannot undo itself within about ten seconds or drift back
   on its own, it does not belong in this file. */

import type { Mood } from '../render/palette';

export interface Bubble {
  x: number;
  y: number;
  /** Rise speed in normalized units per second. */
  vy: number;
  /** Phase for horizontal wobble. */
  wob: number;
}

export interface Kelp {
  x: number;
  /** Height in cells. */
  h: number;
  phase: number;
}

/** Food. Sinks, gets eaten, or dissolves at the floor. Never accumulates
    into a problem — there is no overfeeding penalty because there is no
    penalty for anything. */
export interface Pellet {
  x: number;
  y: number;
  vy: number;
}

/* No hunger, no health, no decay.

   `nerve` is fixed at spawn and never changes: it sets how hard and how
   fast this fish overreacts. A tank where one fish bolts at everything
   and another ignores the whole commotion is funnier than a tank that
   moves as one, and it costs a single float.

   `boldness` only rises. Fish that get called come closer over a session
   and never forget, so there is nothing to maintain and no way to fail.

   The three timers run in order — pending, then flee, then freeze — and
   all of them wind down to zero on their own. */
export interface Fish {
  x: number;
  y: number;
  vx: number;
  vy: number;
  species: string;
  /** 0..1, fixed at spawn. Reaction size and delay. */
  nerve: number;
  /** 0..1, monotonically rising. Familiarity with the room. */
  boldness: number;
  age: number;
  /* Open sea, not a box. A fish that wanders past the edge is `away`:
     not drawn, not simulated, but never destroyed — its nerve and its
     boldness are still sitting there waiting. That is what keeps the
     no-loss rule true once fish can leave. `boldness` earns its keep
     here: fish that have been called come back soonest. */
  presence: 'here' | 'away';
  /** tank.t, seconds, at which an away fish returns. */
  returnAt: number;
  /** 0..1 heat from a held loud tone. Decays on its own. */
  tint: number;
  /** ms until a queued reaction fires. */
  pending: number;
  /** ms of flight remaining. */
  flee: number;
  /** ms of the post-flight frozen stare. */
  freeze: number;
  /** 0..1 inflation. Rises while a loud tone holds, then sighs back down. */
  puff: number;
  /** Wander phase. */
  phase: number;
}

/** Appears only in quiet, leaves at the first noise. */
export interface Crab {
  state: 'gone' | 'walking' | 'fleeing';
  x: number;
  vx: number;
}

/** A remembered onset, replayed late and slightly wrong. */
export interface Echo {
  /** tank.t, in seconds, at which this fires. */
  due: number;
  x: number;
}

/** Distant traffic, far beyond the glass. Never reacts to anything and
    never leaves — it is what stops an empty window from being a dead
    one during a long silence. */
export interface Far {
  x: number;
  y: number;
  vx: number;
}

export interface Tank {
  seed: number;
  /** Seconds since wake. */
  t: number;
  mood: Mood;
  /** Smoothed audio drive, 0..1. Slower than features.level. */
  energy: number;
  bubbles: Bubble[];
  kelp: Kelp[];
  fish: Fish[];
  far: Far[];
  pellets: Pellet[];
  crab: Crab;
  echo: Echo[];
  /* Two separate signals, because they do two different jobs.

     `interest` is a leash: it holds the fish already in frame. Any
     activity raises it, food included — a pellet on the way down keeps
     the present shoal from drifting off.

     `summon` is a call: it brings fish back that have already left.
     Only a sustained sound raises it. Food does not, and neither does
     a clap — you cannot startle something into returning, and leaving
     a snack out does not fill an empty window. To get fish back you
     have to hold a note. */
  interest: number;
  /** 0..1. Only sustained sound raises this. Gates returns. */
  summon: number;
  /** ms a loud tone has been held, for the inflation gag. */
  sustainMs: number;
  /** ms a loud tone has been held, for the spreading colour change.
      Separate from sustainMs because the two fire at different rates. */
  tintMs: number;
  /** tank.t of the last pellet, to rate-limit food. */
  lastPelletAt: number;
  /** x of the last thing that startled the fish, so a delayed reaction
      still flees the right way. */
  lastScare: number;
}

let rngState = 1;

function rnd(): number {
  rngState = (rngState * 1664525 + 1013904223) >>> 0;
  return rngState / 4294967296;
}

export const FISH_COUNT = 5;
const SPECIES = ['guppy', 'darter', 'drifter'];

export function createTank(seed = 20260806): Tank {
  rngState = seed >>> 0;

  const kelp: Kelp[] = [];
  const clumps = 5;
  for (let i = 0; i < clumps; i++) {
    kelp.push({
      x: (i + 0.5) / clumps + (rnd() - 0.5) * 0.08,
      h: 3 + Math.floor(rnd() * 5),
      phase: rnd() * Math.PI * 2,
    });
  }

  const fish: Fish[] = [];
  for (let i = 0; i < FISH_COUNT; i++) {
    fish.push({
      x: rnd(),
      y: 0.2 + rnd() * 0.6,
      vx: (rnd() - 0.5) * 0.1,
      vy: 0,
      species: SPECIES[Math.floor(rnd() * SPECIES.length)],
      /* Nerve is dealt across a fixed range rather than drawn at random.
         With a small shoal a uniform draw swings wildly — one seed gave
         four fish that ignore everything out of ten, which makes a
         scare land as a shrug. Spreading [0.05, 0.95] by index
         guarantees one deadpan fish well under the 0.12 cutoff, one
         hair-trigger, and a graded middle, at any FISH_COUNT. The
         jitter is small enough that it cannot cross either end. */
      nerve: 0.05 + (i / Math.max(1, FISH_COUNT - 1)) * 0.9 + (rnd() - 0.5) * 0.03,
      boldness: 0,
      age: rnd() * 100,
      presence: 'here',
      returnAt: 0,
      tint: 0,
      pending: 0,
      flee: 0,
      freeze: 0,
      puff: 0,
      phase: rnd() * Math.PI * 2,
    });
  }

  // Trimmed from seven with the bubbles, for the same reason: the fish
  // are the subject and the background was competing with them.
  const far: Far[] = [];
  for (let i = 0; i < 4; i++) {
    far.push({
      x: rnd(),
      y: 0.15 + rnd() * 0.7,
      vx: (rnd() < 0.5 ? -1 : 1) * (0.006 + rnd() * 0.012),
    });
  }

  return {
    seed,
    t: 0,
    mood: 'day',
    energy: 0,
    bubbles: [],
    kelp,
    fish,
    far,
    pellets: [],
    crab: { state: 'gone', x: -0.1, vx: 0 },
    echo: [],
    interest: 1,
    summon: 0,
    sustainMs: 0,
    tintMs: 0,
    lastPelletAt: -99,
    lastScare: 0.5,
  };
}

export const tank: Tank = createTank();

const MAX_BUBBLES = 12;
const MAX_PELLETS = 12;

export function spawnBubble(x?: number): void {
  if (tank.bubbles.length >= MAX_BUBBLES) return;
  tank.bubbles.push({
    x: x ?? rnd(),
    y: 1,
    vy: 0.12 + rnd() * 0.18,
    wob: rnd() * Math.PI * 2,
  });
}

/* Drops below the waterline, not at it. Spawning at y 0.06 put the
   pellet on the row the surface paints over, so its first frames were
   invisible — and with fish reaching it in half a second, those were
   most of the frames it had. */
export function spawnPellet(x: number): void {
  if (tank.pellets.length >= MAX_PELLETS) return;
  tank.pellets.push({ x, y: 0.16, vy: 0.075 + rnd() * 0.03 });
}

export function tankRandom(): number {
  return rnd();
}
