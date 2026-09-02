/* Fish.
   ---------------------------------------------------------------
   Boids-lite — separation, weak cohesion, wander, bounds — with the
   sound meanings layered on top. The steering runs whether or not
   anything is making noise, because the window has to be watchable in
   silence; sound only bends a system that is already moving.

   This is a window onto open sea, not a box. There are no side walls.
   What holds fish in frame is `tank.interest`, which rises with any
   activity in the room and bleeds away over about half a minute of
   quiet. While it is high the fish are gently turned back at the
   edges; as it falls the leash goes slack and they simply swim out.
   Make any noise and they file back in.

   A fish that leaves is `away`, never destroyed — its nerve and its
   hard-won boldness sit offscreen waiting. That is what keeps the
   no-loss rule true now that leaving exists, and it is where boldness
   finally earns its keep: fish that have been called come back first.

   The sound meanings, split by how a sound is made rather than how
   loud it is, so they are learnable without instructions:

     sharp + loud   -> a threat. Scatter, overshoot, freeze, sidle back.
     sharp + soft   -> food. A pellet drops and the nearest fish break
                       for it. Food also holds interest up, which keeps
                       the window populated — it is a lure, never a
                       requirement. Nothing here starves.
     held + low     -> a call. Fish gather at the pitch and rise.
     held + loud    -> heat. Fish inflate and change colour, and the
                       longer it goes on the more of them turn. */

import { put, toCellX, toCellY } from './grid';
import { A } from '../render/palette';
import { tank, spawnBubble, spawnPellet, tankRandom, type Fish, type Pellet } from './tank';
import { features } from '../audio/features';
import { vad } from '../audio/vad';

/** Above this, an onset is a threat; below it, an onset is food. */
const STARTLE_LEVEL = 0.62;

/** A held tone this loud inflates a fish, and recolours the shoal. */
const PUFF_LEVEL = 0.55;
const PUFF_MS = 1200;
const TINT_MS = 650;

/** Sustained speech below this brightness reads as a call. */
const CALL_BRIGHT = 0.45;

/* How much of an utterance is spent proving it is one. It used to be
   600ms, which is most of a spoken phrase — a 1.2s phrase bought only
   0.6s of summon, and the shoal could not be called by talking to it.
   350ms matches the VAD's own `minSpeechMs`, so a sound counts as a
   call exactly when the VAD is willing to call it speech. */
const CALL_MS = 350;

/** Below this an onset is room noise, not someone feeding the fish. */
const FEED_MIN_LEVEL = 0.25;

/** Food cannot arrive faster than this, or a conversation carpets the
    window in pellets nobody can see individually. */
const PELLET_GAP_S = 1.5;

const SPEED: Record<string, number> = {
  guppy: 0.10,
  darter: 0.18,
  drifter: 0.06,
};

const SPRITE: Record<string, [string, string]> = {
  guppy: ['><>', '<><'],
  darter: ['=>', '<='],
  drifter: ['o>', '<o'],
};
const PUFFED = '<@>';

const TOP = 0.1;
const BOTTOM = 0.9;

/** Past this, a fish has left the window. */
const OFFSCREEN = 0.12;

/* Where the leash starts pulling, while there is interest to pull with.
   A fleeing fish crossed the old 0.08 band in about a tenth of a
   second, which is not enough contact for the leash to turn anything —
   it was a rule the tank could not enforce. Starting the pull further
   in gives it time to act on a fish that is leaving under its own
   panic, without walling anything in: interest still decides whether
   there is any pull at all, and in a quiet room there is none. */
const EDGE = 0.18;

const NEIGHBOUR = 0.18;
const SEPARATION = 0.06;

/** Interest at or above this means the room is engaging enough to stay
    in; below it, the fish start drifting for the edges in proportion. */
const LEASH_INTEREST = 0.25;

/** How hard a bored fish heads for the nearest edge. Tuned so a silent
    room empties over a couple of minutes rather than on a stopwatch —
    see `npm run balance`. */
const DRIFT = 0.05;

export function updateFish(dt: number): void {
  const dts = dt / 1000;

  const scared = features.onset && features.level > STARTLE_LEVEL;
  const sustained =
    vad.speaking &&
    vad.speechMs > CALL_MS &&
    features.level > 0.15 &&
    features.level < STARTLE_LEVEL;
  const calling = sustained && features.bright < CALL_BRIGHT;

  /* Only a held sound summons. A clap cannot startle a fish into
     coming back, and food left out cannot fill an empty window — food
     holds the shoal that is already here, which is a different job.
     A low call pulls hardest; ordinary talk still works, slower.

     Calling has to survive the gaps in speech, because speech is
     mostly gaps. At 0.15/s the decay very nearly cancelled the 0.2/s
     that talking earned, so summon sat under the gate through any
     normal back-and-forth and the window stayed empty while someone
     was plainly talking to it. Draining is now slow enough that a
     pause costs progress without erasing it — the leaky-bucket
     ratio is what makes calling feel like calling rather than like
     holding a note without breathing. */
  if (sustained) tank.summon = Math.min(1, tank.summon + dts * (calling ? 0.6 : 0.3));
  else tank.summon = Math.max(0, tank.summon - dts * 0.06);

  /* Feeding needs a deliberate sound, and a gap in the talking.

     An onset fires on spectral flux alone, so a fan tick or a keyboard
     press clears the bar while sitting barely above the noise floor —
     which is why the window filled with food nobody asked for. The
     level floor is what separates a sound someone made from a sound
     the room made.

     Suppressing it during a held note keeps feeding from colliding
     with the call and the heat, which share the same stretch of audio
     and are trying to say something else with it. */
  const fed =
    features.onset &&
    !sustained &&
    features.level >= FEED_MIN_LEVEL &&
    features.level <= STARTLE_LEVEL;

  if (scared) {
    tank.lastScare = features.bright;
    for (const f of tank.fish) {
      if (f.presence === 'away' || f.flee > 0) continue;
      // The steadiest fish never reacts at all. That fish is doing more
      // comic work than any of the others.
      if (f.nerve < 0.12) continue;
      f.pending = 20 + (1 - f.nerve) * 320;
      f.freeze = 0;
    }
  }

  /* Food lands anywhere, not at the pitch.

     Placing it by brightness piled it against the right-hand edge, and
     the reason is structural rather than a tuning miss: an onset IS a
     transient, and transients are broadband. Measuring brightness at
     the moment of the attack samples the click, not the voice, so it
     reads high almost every time. Pitch placement is sound for sounds
     that are held — the call target and the heat zone still use it,
     and those measure a sustained tone. It is wrong for anything
     triggered by an onset. */
  if (fed && tank.t - tank.lastPelletAt > PELLET_GAP_S) {
    tank.lastPelletAt = tank.t;
    spawnPellet(clampX(0.06 + tankRandom() * 0.88));
  }

  // Inflation gag. Leaks away faster than it fills, so a held note
  // inflates and an ordinary conversation never does.
  const loud = features.level > PUFF_LEVEL;
  if (loud) tank.sustainMs += dt;
  else tank.sustainMs = Math.max(0, tank.sustainMs - dt * 2);
  if (tank.sustainMs > PUFF_MS) {
    tank.sustainMs = 0;
    puffNearest(features.bright);
  }

  // Heat spreads: one more fish turns colour every TINT_MS the tone is
  // held, so a long note walks across the shoal.
  if (loud) tank.tintMs += dt;
  else tank.tintMs = Math.max(0, tank.tintMs - dt * 1.5);
  if (tank.tintMs > TINT_MS) {
    tank.tintMs -= TINT_MS;
    tintNearest(features.bright);
  }

  /* Two things slow the fish down, and they used to be one.

     The hour is now the palette's business, so night slowing the shoal
     is a fact about night rather than a stand-in for quiet. Quiet still
     slows them too, through `interest` — that behaviour was the useful
     half of the old silence ladder and it survives the move to the
     clock. */
  const hour = tank.mood === 'night' ? 0.6 : tank.mood === 'day' ? 1 : 0.85;
  const speedScale = hour * (0.55 + tank.interest * 0.45);

  for (const f of tank.fish) {
    if (f.presence === 'away') {
      maybeReturn(f, dts);
      continue;
    }

    f.age += dts;
    if (f.tint > 0) f.tint = Math.max(0, f.tint - dts * 0.08);

    if (f.puff > 0) {
      const was = f.puff;
      f.puff -= dts * 0.25;
      if (f.puff <= 0) {
        f.puff = 0;
        if (was > 0.3) spawnBubble(f.x); // the sigh
      }
    }

    if (f.pending > 0) {
      f.pending -= dt;
      if (f.pending <= 0) {
        f.pending = 0;
        /* A scatter, not an eviction. At 0.85/s for 0.8s the overshoot
           carried two thirds of the tank, so a single bang threw most
           of the shoal clean out of the window and every one of them
           then had to be called back. The gag is the overshoot and the
           deadpan freeze that follows, and both need the fish to still
           be on screen to land. */
        f.flee = 300 + f.nerve * 300;
        const away = f.x < tank.lastScare ? -1 : 1;
        f.vx = away * (0.22 + f.nerve * 0.3);
        f.vy = 0.1 + f.nerve * 0.14;
      }
    }

    if (f.flee > 0) {
      f.flee -= dt;
      if (f.flee <= 0) {
        f.flee = 0;
        // The overshoot lands and the fish just stops, mid-water,
        // pretending that was intentional.
        f.freeze = 240 + (1 - f.nerve) * 280;
        f.vx *= 0.08;
        f.vy *= 0.08;
      }
      integrate(f, dts);
      continue;
    }

    if (f.freeze > 0) {
      f.freeze -= dt;
      if (f.freeze < 0) f.freeze = 0;
      f.vx *= 0.85;
      f.vy *= 0.85;
      integrate(f, dts);
      continue;
    }

    let ax = 0;
    let ay = 0;

    // --- flock ---
    let cx = 0;
    let cy = 0;
    let n = 0;
    for (const o of tank.fish) {
      if (o === f || o.presence === 'away') continue;
      const dx = o.x - f.x;
      const dy = o.y - f.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > NEIGHBOUR * NEIGHBOUR) continue;
      n++;
      cx += o.x;
      cy += o.y;
      if (d2 < SEPARATION * SEPARATION && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        ax -= (dx / d) * 0.35;
        ay -= (dy / d) * 0.35;
      }
    }
    if (n > 0) {
      ax += (cx / n - f.x) * 0.25;
      ay += (cy / n - f.y) * 0.25;
    }

    // --- wander ---
    f.phase += dts * (0.6 + f.nerve);
    ax += Math.cos(f.phase) * 0.22;
    ay += Math.sin(f.phase * 0.7) * 0.10;

    // --- call: gather at the pitch, and rise ---
    if (calling) {
      const pull = 0.30 + f.boldness * 0.7;
      ax += (features.bright - f.x) * pull;
      ay += (0.35 - f.y) * pull * 0.6;
      // Boldness only ever climbs. Called fish come closer, and come
      // back sooner, for the rest of the session.
      f.boldness = Math.min(1, f.boldness + dts * 0.02);
    }

    // --- food ---
    const p = nearestPellet(f);
    if (p) {
      const dx = p.x - f.x;
      const dy = p.y - f.y;
      ax += dx * 0.5;
      ay += dy * 0.5;
      if (dx * dx + dy * dy < 0.0004) {
        tank.pellets.splice(tank.pellets.indexOf(p), 1);
        f.boldness = Math.min(1, f.boldness + 0.02);
        spawnBubble(f.x); // a visible chomp
      }
    }

    // --- puffed fish float ---
    if (f.puff > 0) ay -= f.puff * 0.45;

    // --- the leash: only as strong as the room is interesting ---
    if (f.x < EDGE) ax += (EDGE - f.x) * 3 * tank.interest;
    if (f.x > 1 - EDGE) ax -= (f.x - (1 - EDGE)) * 3 * tank.interest;

    /* ...and as the interest goes, a drift toward the nearest way out.

       "As interest falls the fish stop being turned back at the edges
       and simply swim out" was not true: releasing the leash only stops
       pulling, and a fish with nothing pulling it anywhere mills about
       inside the frame forever. Measured before this existed — five
       minutes of silence, nobody left, ever.

       What actually emptied the window was being startled hard enough
       to be thrown out of it, which is backwards. Quiet is supposed to
       empty the tank and noise is supposed to fill it; the tank had it
       exactly the wrong way round, and it took a scare that ejected
       most of the shoal to look like it was working.

       Nothing is lost by leaving: an away fish keeps its nerve and its
       boldness, and comes back when called. */
    const wanderlust = 1 - Math.min(1, tank.interest / LEASH_INTEREST);
    if (wanderlust > 0) ax += (f.x < 0.5 ? -1 : 1) * wanderlust * DRIFT;

    // --- vertical bounds are real; the sea has a surface and a floor ---
    if (f.y < TOP) ay += (TOP - f.y) * 3;
    if (f.y > BOTTOM) ay -= (f.y - BOTTOM) * 3;

    const max = SPEED[f.species] * speedScale * (1 - f.puff * 0.6);
    f.vx += ax * dts;
    f.vy += ay * dts;
    const sp = Math.hypot(f.vx, f.vy);
    if (sp > max && sp > 1e-6) {
      f.vx = (f.vx / sp) * max;
      f.vy = (f.vy / sp) * max;
    }

    integrate(f, dts);
  }

  // pellets sink; any that reach the floor dissolve
  for (let i = tank.pellets.length - 1; i >= 0; i--) {
    const p = tank.pellets[i];
    p.y += p.vy * dts;
    if (p.y > BOTTOM + 0.04) tank.pellets.splice(i, 1);
  }
}

function integrate(f: Fish, dts: number): void {
  f.x += f.vx * dts;
  f.y += f.vy * dts;

  // No side walls. Past the frame the fish is simply away — kept, not
  // deleted, so nothing it has learned is lost.
  if (f.x < -OFFSCREEN || f.x > 1 + OFFSCREEN) {
    f.presence = 'away';
    // Bold fish are back in a few seconds; strangers take a while.
    // Was 3..13s, which stacked on top of the cost of raising summon
    // at all — a stranger could not come back inside a quarter minute
    // however hard it was called.
    f.returnAt = tank.t + 2 + (1 - f.boldness) * 6;
    f.pending = 0;
    f.flee = 0;
    f.freeze = 0;
    return;
  }

  if (f.y < 0.05) {
    f.y = 0.05;
    f.vy = Math.abs(f.vy) * 0.5;
  }
  if (f.y > 0.95) {
    f.y = 0.95;
    f.vy = -Math.abs(f.vy) * 0.5;
  }
}

/** Away fish come back when they are called — not merely when the room
    is busy, and not because there is food going spare. */
function maybeReturn(f: Fish, dts: number): void {
  if (tank.t < f.returnAt) return;
  if (tank.summon < 0.2) return;
  // Staggered, so the shoal files in rather than teleporting back as a block.
  if (tankRandom() > dts * 1.5) return;

  const fromLeft = tankRandom() < 0.5;
  f.presence = 'here';
  f.x = fromLeft ? -OFFSCREEN + 0.01 : 1 + OFFSCREEN - 0.01;
  f.y = 0.2 + tankRandom() * 0.6;
  f.vx = (fromLeft ? 1 : -1) * SPEED[f.species] * 0.8;
  f.vy = 0;
  f.puff = 0;
  f.tint = 0;
}

function clampX(x: number): number {
  return Math.min(0.96, Math.max(0.04, x));
}

function nearestPellet(f: Fish): Pellet | null {
  let best: Pellet | null = null;
  let bestD = 0.18 * 0.18;
  for (const p of tank.pellets) {
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      best = p;
    }
  }
  return best;
}

function puffNearest(x: number): void {
  let best: Fish | null = null;
  let bestD = Infinity;
  for (const f of tank.fish) {
    if (f.presence === 'away' || f.puff > 0.05) continue;
    const d = Math.abs(f.x - x);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  if (best) best.puff = 1;
}

/* Warms the coolest fish inside a heat zone around the sound.

   Heat is local and it burns inward before it spreads. Preferring the
   coolest fish anywhere, or even the coolest fish in the zone, means
   there is always another cool one to reach for — colour spreads
   forever, nothing ever deepens, and the darkest shade is defined but
   never seen. Weighting distance far above tint puts the second stage
   on the fish sitting right at the pitch, and once that one is fully
   turned it drops out of the running and the next one out takes it.
   A held note makes a hot core with a warm fringe, and the fringe
   still grows the longer it goes on. */
const HEAT_RADIUS = 0.22;

function tintNearest(x: number): void {
  let best: Fish | null = null;
  let bestKey = Infinity;
  for (const f of tank.fish) {
    if (f.presence === 'away' || f.tint >= 1) continue;
    const d = Math.abs(f.x - x);
    if (d > HEAT_RADIUS) continue;
    const key = f.tint * 0.15 + d;
    if (key < bestKey) {
      bestKey = key;
      best = f;
    }
  }
  if (best) best.tint = Math.min(1, best.tint + 0.5);
}

export function drawFish(bank: number): void {
  for (const p of tank.pellets) {
    put(Math.round(toCellX(p.x)), Math.round(toCellY(p.y)), 42 /* * */, bank + A.GLOW, 4);
  }

  for (const f of tank.fish) {
    if (f.presence === 'away') continue;
    const right = f.vx >= 0;
    const sprite = f.puff > 0.3 ? PUFFED : SPRITE[f.species][right ? 0 : 1];
    const base = f.species === 'darter' ? A.FISH_ALT : A.FISH;
    const slot = f.tint > 0.66 ? A.TINT2 : f.tint > 0.24 ? A.TINT1 : base;
    const x0 = Math.round(toCellX(f.x) - (sprite.length - 1) / 2);
    const y = Math.round(toCellY(f.y));
    for (let i = 0; i < sprite.length; i++) {
      put(x0 + i, y, sprite.charCodeAt(i), bank + slot, 4);
    }
  }
}
