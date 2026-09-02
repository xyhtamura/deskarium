// Catchment — the game. No DOM in this file.
//
// Space is continuous: x and y both run 0..1, the renderer decides pixels, and
// the game does not know the screen exists. That is confinery's rule and
// deskarium's before it, and it is what lets tools/check-table.mjs step a whole
// run headlessly.
//
// The loop, stated once:
//
//   The beam drops particles. The catcher is a detector aperture with three
//   settings — charge, parity, spin — and it absorbs a particle only when all
//   three agree with it and the particle lands inside its width. Absorbed
//   particles sit in the stack, where the real tables take over: unstable ones
//   decay on a compressed clock and their products stay inside, matter meets
//   antimatter and annihilates, two photons pair-produce, a proton and a
//   neutron bind. Decay fills the stack; reactions empty it, and throw their
//   products back up the field to be caught again. Fill the stack past its
//   capacity and the next absorption is a pile-up: the event is
//   unreconstructable, the chain breaks, and everything held is written off as
//   missing energy.
//
// No aperture setting admits a neutrino, because parity is not defined for one.
// Every neutrino that crosses the plane leaves as missing energy, which is the
// only way a real detector ever infers one.

import { SPECIES, DECAYS, ANNIHILATIONS, PAIRS, BINDINGS, BEAM, ORDER, AXES, admits } from './data/particles.js';
import { deck } from './cards.js';

/** Half-width of the aperture, in field widths. This is the whole of what the
 *  game calls geometric acceptance. */
export const APERTURE = 0.058;
export const STACK_CAPACITY = 6;
export const RUN_SECONDS = 120;

/** One encoder step, in field widths. About twenty steps across, ten at speed. */
const STEP = 0.048;
/** How fast the catcher slides to where the encoder put it. */
const GLIDE = 13;

/** Deterministic RNG, so a seed reproduces a run exactly. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Curvature.
//
// A charged particle in a magnetic field travels on an arc whose radius is its
// momentum over its charge times the field: r = p / qB. So the sign of the
// charge decides which way it bends, and a faster particle bends less. That is
// how a real tracker reads the sign of a charge off a photograph, and here it
// means the player can see what a thing is before its letter is legible.
//
// BEND stands in for qB and is chosen by eye, against one constraint that is
// not cosmetic: the slowest particle the beam delivers must still reach the
// detector plane. A real field this strong makes low-momentum tracks curl up
// and spiral out of the apparatus before they reach anything — a looper, and a
// true thing about detectors — but a game in which the cheapest particles are
// unreachable is not a game. tools/check-table.mjs asserts a 150 MeV positron
// lands, which is what pins this number.
//
// Momentum is stood in for by the particle's energy, exact only for the
// massless ones. The floor keeps a very soft track from curling anyway.
const BEND = 9;
const P_FLOOR = 120;

function turnVelocity(f, q, dt) {
  if (q === 0) return;
  const omega = (BEND * q) / Math.max(P_FLOOR, f.E);
  const a = omega * dt;
  const c = Math.cos(a), s = Math.sin(a);
  const vx = f.vx * c - f.vy * s;
  const vy = f.vx * s + f.vy * c;
  f.vx = vx; f.vy = vy;
}

/** The arc a particle just came along, integrated backwards from where it is.
 *  Nothing stores a history: the path is recovered by running the same turn the
 *  other way, so the trail is always exactly the curve the particle flew. */
export function traceBack(f, steps = 13, dt = 1 / 26) {
  const q = SPECIES[f.key].q;
  const probe = { vx: f.vx, vy: f.vy, E: f.E };
  const pts = [[f.x, f.y]];
  let x = f.x, y = f.y;
  for (let i = 0; i < steps; i++) {
    x -= probe.vx * dt;
    y -= probe.vy * dt;
    turnVelocity(probe, q, -dt);
    pts.push([x, y]);
  }
  return pts;
}

/** Where this particle will cross the detector plane, or null if it leaves the
 *  field first. Integrated rather than solved, because the arc is only an arc
 *  while nothing else touches it. Used by the interface to mark the landing of
 *  anything the aperture admits, and by the headless pilot to aim. */
export function predictLanding(f, dt = 1 / 30, limit = 400) {
  let { x, y, vx, vy, E } = f;
  const q = SPECIES[f.key].q;
  const probe = { vx, vy, E };
  for (let i = 0; i < limit; i++) {
    turnVelocity(probe, q, dt);
    x += probe.vx * dt;
    y += probe.vy * dt;
    if (x < -0.04 || x > 1.04) return null;
    if (y >= 1) return clamp(x, 0, 1);
    if (y < -0.2) return null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Time compression.
//
// Measured mean lives run from 8.4e-17 s to stable. On screen they have to run
// from "gone before you see it" to "sits there". log10 of the lifetime is
// mapped onto HOLD_MIN..HOLD_MAX seconds, which preserves the ordering and
// nothing else. Every rate the player sees is this rendering choice; the model
// card prints both columns side by side so the compression is visible rather
// than hidden.
const HOLD_MIN = 0.35, HOLD_MAX = 8.0;
const LOG_LO = -17, LOG_HI = 3;

export function holdLife(life) {
  if (!isFinite(life)) return Infinity;
  const l = Math.log10(life);
  const f = clamp((l - LOG_LO) / (LOG_HI - LOG_LO), 0, 1);
  return HOLD_MIN + f * (HOLD_MAX - HOLD_MIN);
}

// ---------------------------------------------------------------------------

export function createGame(seed = 1) {
  return {
    seed,
    rand: mulberry32(seed),
    phase: 'title',            // title | run | menu | over

    // The pause deck. `at` is the card the encoder has landed on and `slide`
    // is where the carousel has actually got to, which lags it — the same
    // split as the catcher's tx and x, and for the same reason: the encoder
    // steps and the picture glides.
    menu: { at: 0, slide: 0 },
    clock: 0,
    duration: RUN_SECONDS,

    // `x` is where the catcher is drawn and where it catches; `tx` is where the
    // encoder put it. The gap between them is the glide, and it is the only
    // easing in the game that the simulation knows about, because it changes
    // what gets caught.
    catcher: { x: 0.5, tx: 0.5, squash: 0, qi: 1, pi: 0, ji: 1 },

    falling: [],               // { id, key, x, y, vx, vy, E, jet, spin }
    stack: [],                 // { key, E, hold, held }
    flashes: [],               // { kind, x, y, t, life, text, colour }
    motes: [],                 // { x, y, vx, vy, t, life, key }
    log: [],                   // { t, text }

    // Three energy accounts, and the distinction between the second and the
    // third is a real one rather than bookkeeping. Energy that lands outside
    // the aperture never entered the apparatus — that is geometric acceptance,
    // and it is not a failure of the readout. Energy that lands inside it and
    // leaves no record is missing energy, which is the thing a detector is
    // judged on and the only way a neutrino is ever inferred.
    recorded: 0,
    missing: 0,
    outside: 0,
    caught: 0,
    passed: 0,
    reactions: 0,
    pileups: 0,
    chain: 0,
    bestChain: 0,
    freeQuarks: 0,             // stays 0, and that is the point

    nextId: 1,
    dropTimer: 0,
    census: {},
  };
}

/** The three aperture settings, resolved from their indices. */
export function aperture(g) {
  return { Q: AXES.Q[g.catcher.qi], P: AXES.P[g.catcher.pi], J: AXES.J[g.catcher.ji] };
}

/** Every species the given setting would absorb. The interface draws these, so
 *  the player tunes towards a thing rather than towards three numbers, which is
 *  what a trigger menu is: you select a signature. */
export function admitted(ap) {
  return ORDER.filter((k) => admits(ap, k));
}

/** Beam intensity ramps across the run. Invented for pacing. */
function beam(g) {
  const f = Math.min(1, g.clock / g.duration);
  return { rate: 1.15 + 2.5 * f, energy: 130 + 900 * f, jetChance: 0.03 + 0.09 * f };
}

// ---------------------------------------------------------------------------
// Input. Six events, matching the panel exactly: three buttons and an encoder.

export function press(g, button) {
  if (g.phase === 'title') {
    if (button === 'PRESS' || button === 'C') g.phase = 'run';
    return;
  }
  if (g.phase === 'over') {
    if (button === 'PRESS' || button === 'C') Object.assign(g, createGame(g.seed + 1));
    return;
  }

  // The deck. Turning moves through it, pressing does what the card says, and
  // C always resumes — so a player parked on Restart can leave without
  // restarting, and nobody restarts by accident.
  if (g.phase === 'menu') {
    const n = deckLength(g);
    switch (button) {
      case 'CCW': case 'L': g.menu.at = Math.max(0, g.menu.at - 1); break;
      case 'CW': case 'R': g.menu.at = Math.min(n - 1, g.menu.at + 1); break;
      case 'C': g.phase = 'run'; break;
      case 'PRESS':
        if (cardAction(g, g.menu.at) === 'restart') {
          const seed = g.seed + 1;
          Object.assign(g, createGame(seed));
          g.phase = 'run';
        } else {
          g.phase = 'run';
        }
        break;
      default: break;
    }
    return;
  }

  if (button === 'PRESS') { g.phase = 'menu'; g.menu.at = 0; g.menu.slide = 0; return; }

  switch (button) {
    case 'L': g.catcher.qi = (g.catcher.qi + 1) % AXES.Q.length; break;
    case 'C': g.catcher.pi = (g.catcher.pi + 1) % AXES.P.length; break;
    case 'R': g.catcher.ji = (g.catcher.ji + 1) % AXES.J.length; break;
    case 'CCW': move(g, -1); break;
    case 'CW': move(g, +1); break;
    default: break;
  }
}

// The deck is described in cards.js, which builds it from the same tables the
// simulation reads. It is imported lazily through these two so that game.js has
// no load-order dependency on a module that imports game.js back.
let DECK = null;
function loadDeck() {
  if (!DECK) DECK = deck();
  return DECK;
}
function deckLength() { return loadDeck().length; }
function cardAction(g, i) { return loadDeck()[i]?.action; }

/** The deck, for the renderer. */
export function cards() { return loadDeck(); }

/** A fast spin steps twice as far as a slow one. The encoder gives no absolute
 *  position, only the gap between steps, so speed is all there is to read. */
export function turn(g, dir, velocity = 0) {
  if (g.phase !== 'run') { press(g, dir < 0 ? 'CCW' : 'CW'); return; }
  move(g, dir * (velocity > 0.6 ? 2 : 1));
}

function move(g, d) {
  g.catcher.tx = clamp(g.catcher.tx + d * STEP, APERTURE, 1 - APERTURE);
}

// ---------------------------------------------------------------------------

function flash(g, kind, x, y, text, colour) {
  g.flashes.push({ kind, x, y, t: 0, life: kind === 'reaction' ? 1.2 : 0.6, text, colour });
  if (g.flashes.length > 40) g.flashes.shift();
}

/** Confetti. Carries no state the game reads; the renderer draws it and the
 *  step decays it, and a run with motes disabled plays identically. */
function burst(g, x, y, n, key) {
  for (let i = 0; i < n; i++) {
    const a = g.rand() * Math.PI * 2;
    const s = 0.10 + 0.30 * g.rand();
    g.motes.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.55,
      t: 0, life: 0.5 + 0.6 * g.rand(), key });
    if (g.motes.length > 220) g.motes.shift();
  }
}

function note(g, text) {
  g.log.push({ t: g.clock, text });
  if (g.log.length > 7) g.log.shift();
}

function pick(g, list) { return list[Math.floor(g.rand() * list.length)]; }

function spawn(g, key, x, y, vx, vy, E, jet = false) {
  g.falling.push({ id: g.nextId++, key, x, y, vx, vy, E, jet,
    spin: g.rand() * Math.PI * 2 });
}

/** Products of a reaction leave the aperture upward and fall again. They curve
 *  on the way, so a pair leaves as two mirrored arcs. Catching one continues
 *  the chain. */
function eject(g, keys, E) {
  const share = E / Math.max(1, keys.length);
  const spread = 0.9;
  keys.forEach((k, i) => {
    const t = keys.length === 1 ? 0 : (i / (keys.length - 1)) * 2 - 1;
    const a = -Math.PI / 2 + t * spread * 0.5;
    const s = 0.42 + 0.12 * g.rand();
    spawn(g, k, g.catcher.x, 0.97, Math.cos(a) * s, Math.sin(a) * s, share);
  });
}

// ---------------------------------------------------------------------------

export function step(g, dt) {
  if (g.phase === 'menu') {
    g.menu.slide += (g.menu.at - g.menu.slide) * Math.min(1, dt * 11);
    decay(g, dt);
    return;
  }
  if (g.phase !== 'run') { decay(g, dt); return; }

  g.clock += dt;
  if (g.clock >= g.duration) { g.phase = 'over'; return; }

  const b = beam(g);

  // --- the catcher glides to where the encoder put it -----------------------
  g.catcher.x += (g.catcher.tx - g.catcher.x) * Math.min(1, dt * GLIDE);
  g.catcher.squash = Math.max(0, g.catcher.squash - dt * 4);

  // --- the beam ------------------------------------------------------------
  g.dropTimer -= dt;
  while (g.dropTimer <= 0) {
    g.dropTimer += 1 / b.rate;
    if (g.rand() < b.jetChance) dropJet(g, b); else dropOne(g, b);
  }

  // --- flight --------------------------------------------------------------
  for (let i = g.falling.length - 1; i >= 0; i--) {
    const f = g.falling[i];
    turnVelocity(f, SPECIES[f.key].q, dt);
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.spin += dt * 1.4;
    if (f.x < -0.04 || f.x > 1.04 || f.y < -0.25) {
      // Left the apparatus sideways or out of the top. Never entered.
      g.outside += f.E;
      g.falling.splice(i, 1);
    } else if (f.y >= 1) {
      arrive(g, f);
      g.falling.splice(i, 1);
    }
  }

  stackTick(g, dt);
  react(g);
  decay(g, dt);
}

/** Flashes and confetti run on their own clock, and keep running on the title
 *  and end screens so neither is a frozen picture. */
function decay(g, dt) {
  for (let i = g.flashes.length - 1; i >= 0; i--) {
    g.flashes[i].t += dt;
    if (g.flashes[i].t > g.flashes[i].life) g.flashes.splice(i, 1);
  }
  for (let i = g.motes.length - 1; i >= 0; i--) {
    const m = g.motes[i];
    m.t += dt;
    m.x += m.vx * dt;
    m.y += m.vy * dt;
    m.vy += dt * 0.55;
    if (m.t > m.life) g.motes.splice(i, 1);
  }
}

function dropOne(g, b) {
  const key = pick(g, BEAM);
  const E = SPECIES[key].mass + b.energy * (0.35 + 1.3 * g.rand());
  const drift = (g.rand() - 0.5) * 0.06;
  spawn(g, key, 0.06 + g.rand() * 0.88, 0, drift, 0.145 + 0.075 * g.rand(), E);
}

/** A jet. A quark was knocked loose upstream and the string it was on broke
 *  before it got anywhere, so what arrives is a spray of hadrons fanning out
 *  from one point — never the quark. Confinement, as a detector sees it. The
 *  drag-tether version in confinery's specification is not built here. */
function dropJet(g, b) {
  const x = 0.16 + g.rand() * 0.68;
  const n = 3 + Math.floor(g.rand() * 3);
  const speed = 0.19 + 0.07 * g.rand();
  for (let i = 0; i < n; i++) {
    const key = pick(g, ['pi+', 'pi-', 'pi0', 'pi+', 'pi-']);
    const a = ((i / (n - 1)) * 2 - 1) * 0.34;
    const E = SPECIES[key].mass + b.energy * (0.4 + 0.9 * g.rand());
    spawn(g, key, x, -0.02 * i, Math.sin(a) * speed, Math.cos(a) * speed, E, true);
  }
  note(g, 'jet — a string that broke, never a free quark');
}

/** A particle reaches the detector plane. */
function arrive(g, f) {
  const s = SPECIES[f.key];
  const inside = Math.abs(f.x - g.catcher.x) <= APERTURE;

  if (!inside) {
    g.passed++;
    g.outside += f.E;
    return;
  }

  if (!admits(aperture(g), f.key)) {
    // It went through the apparatus and left nothing behind. A neutrino always
    // does this; anything else did it because the aperture was set wrong.
    g.passed++;
    g.missing += f.E;
    g.chain = 0;
    flash(g, s.P === null ? 'ghost' : 'through', f.x, 1, s.sym);
    return;
  }

  if (g.stack.length >= STACK_CAPACITY) {
    // Pile-up. Two events inside one readout window cannot be told apart, so
    // neither is reconstructed and everything held is written off.
    g.pileups++;
    g.chain = 0;
    const lost = f.E + g.stack.reduce((a, x) => a + x.E, 0);
    g.missing += lost;
    g.stack.length = 0;
    flash(g, 'pileup', g.catcher.x, 1, 'PILE-UP');
    burst(g, g.catcher.x, 1, 16, null);
    note(g, `pile-up — ${Math.round(lost)} MeV unreconstructable`);
    return;
  }

  g.caught++;
  g.census[f.key] = (g.census[f.key] || 0) + 1;
  g.chain++;
  g.bestChain = Math.max(g.bestChain, g.chain);
  const mult = 1 + Math.min(5, Math.floor(g.chain / 3)) * 0.5;
  g.recorded += f.E * mult;
  g.stack.push({ key: f.key, E: f.E, hold: holdLife(s.life), held: 0 });
  g.catcher.squash = 1;
  flash(g, 'catch', f.x, 1, s.sym);
  burst(g, f.x, 1, 5, f.key);
}

/** Held particles run their own clocks. Decay products stay inside the
 *  detector; neutrinos walk straight out and are only ever missing energy. */
function stackTick(g, dt) {
  for (let i = g.stack.length - 1; i >= 0; i--) {
    const it = g.stack[i];
    it.held += dt;
    if (!isFinite(it.hold) || it.held < it.hold) continue;

    const channels = DECAYS[it.key];
    if (!channels) { it.hold = Infinity; continue; }

    let r = g.rand(), chosen = channels[channels.length - 1];
    for (const c of channels) { if (r < c.br) { chosen = c; break; } r -= c.br; }

    g.stack.splice(i, 1);
    const kept = [];
    let escaped = 0;
    for (const k of chosen.out) {
      if (SPECIES[k].P === null) escaped++;
      else kept.push(k);
    }
    const share = it.E / chosen.out.length;
    g.missing += share * escaped;
    for (const k of kept) {
      g.stack.push({ key: k, E: share, hold: holdLife(SPECIES[k].life), held: 0 });
    }
    note(g, `${SPECIES[it.key].sym} → ${chosen.out.map((k) => SPECIES[k].sym).join(' ')}`
      + (escaped ? `  (${escaped}ν missing)` : ''));
    flash(g, 'decay', g.catcher.x, 1, SPECIES[it.key].sym);
  }
}

/** Two-body reactions inside the aperture. Products leave the stack upward, so
 *  a reaction is the only thing that empties it. */
function react(g) {
  for (const k of Object.keys(ANNIHILATIONS)) {
    const anti = SPECIES[k].anti;
    const i = g.stack.findIndex((x) => x.key === k);
    const j = g.stack.findIndex((x, n) => n !== i && x.key === anti);
    if (i < 0 || j < 0) continue;
    const E = g.stack[i].E + g.stack[j].E;
    removeTwo(g, i, j);
    fire(g, ANNIHILATIONS[k].out, E, `${SPECIES[k].sym} ${SPECIES[anti].sym} → `
      + ANNIHILATIONS[k].out.map((o) => SPECIES[o].sym).join(' '), 2.0);
    return;
  }

  for (const rule of BINDINGS) {
    const i = g.stack.findIndex((x) => x.key === rule.in[0]);
    const j = g.stack.findIndex((x, n) => n !== i && x.key === rule.in[1]);
    if (i < 0 || j < 0) continue;
    const E = g.stack[i].E + g.stack[j].E;
    removeTwo(g, i, j);
    // Binding energy is the mass deficit, computed here so it can never
    // disagree with the masses in the table.
    const deficit = SPECIES[rule.in[0]].mass + SPECIES[rule.in[1]].mass - SPECIES[rule.out[0]].mass;
    fire(g, rule.out, E, `${SPECIES[rule.in[0]].sym} ${SPECIES[rule.in[1]].sym} → `
      + `${SPECIES[rule.out[0]].sym} γ  (${deficit.toFixed(2)} MeV bound)`, 3.0);
    return;
  }

  const g1 = g.stack.findIndex((x) => x.key === 'gamma');
  const g2 = g.stack.findIndex((x, n) => n !== g1 && x.key === 'gamma');
  if (g1 >= 0 && g2 >= 0) {
    const E = g.stack[g1].E + g.stack[g2].E;
    for (let i = PAIRS.length - 1; i >= 0; i--) {
      const need = 2 * SPECIES[PAIRS[i].out[0]].mass;
      if (E < need) continue;
      removeTwo(g, g1, g2);
      fire(g, PAIRS[i].out, E, `γ γ → ${PAIRS[i].out.map((o) => SPECIES[o].sym).join(' ')}`, 1.6);
      return;
    }
  }
}

function removeTwo(g, i, j) {
  const [a, b] = i > j ? [i, j] : [j, i];
  g.stack.splice(a, 1);
  g.stack.splice(b, 1);
}

function fire(g, out, E, text, bonus) {
  g.reactions++;
  g.recorded += E * bonus * 0.5;
  eject(g, out, E);
  note(g, text);
  flash(g, 'reaction', g.catcher.x, 1, text.split('→')[0].trim());
  for (const k of out) burst(g, g.catcher.x, 0.985, 7, k);
}

/** Everything the readout needs, computed rather than tracked, so it cannot
 *  drift from the state above. */
export function readout(g) {
  const entered = g.recorded + g.missing;
  return {
    recorded: g.recorded,
    missing: g.missing,
    outside: g.outside,
    /** Of the energy that entered the aperture, the share that left a record. */
    fraction: entered > 0 ? g.recorded / entered : 0,
    stack: g.stack.length,
    capacity: STACK_CAPACITY,
    left: Math.max(0, g.duration - g.clock),
    chain: g.chain,
  };
}
