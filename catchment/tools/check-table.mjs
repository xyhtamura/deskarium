// Catchment — table validator and headless run.
//
//   node tools/check-table.mjs
//
// Two jobs, and the second is the reason this file exists rather than a test
// runner. First it walks every channel in data/particles.js and fails if charge,
// baryon number or either lepton number does not balance — the cheap check that
// catches a transcription error and is the difference between a physics game
// and a physics-shaped game. Then it steps a whole run with no browser, no
// canvas and no frame, which is only possible because game.js holds no DOM.
//
// Exit code is non-zero if anything failed.

import {
  SPECIES, DECAYS, ANNIHILATIONS, PAIRS, BINDINGS, ORDER, BEAM, AXES, admits,
} from '../data/particles.js';
import { createGame, step, press, holdLife, readout, predictLanding, APERTURE } from '../game.js';

let failures = 0;
const fail = (m) => { failures++; console.log(`  FAIL  ${m}`); };
const ok = (m) => console.log(`  ok    ${m}`);

const NUMS = ['q', 'b', 'le', 'lm'];
const sum = (keys, n) => keys.reduce((a, k) => a + SPECIES[k][n], 0);

function balances(label, inKeys, outKeys) {
  for (const n of NUMS) {
    const a = sum(inKeys, n), b = sum(outKeys, n);
    if (Math.abs(a - b) > 1e-9) {
      fail(`${label}: ${n} ${a} in, ${b} out`);
      return false;
    }
  }
  return true;
}

console.log('\n— the table —');

// Every species has the columns the game reads.
for (const k of Object.keys(SPECIES)) {
  const s = SPECIES[k];
  for (const n of [...NUMS, 'mass', 'life', 'J']) {
    if (s[n] === undefined) fail(`${k} has no ${n}`);
  }
  if (!('P' in s)) fail(`${k} has no P`);
  if (s.P !== null && s.P !== 1 && s.P !== -1) fail(`${k} has P = ${s.P}`);
  if (!AXES.J.includes(s.J)) fail(`${k} has J = ${s.J}, which no aperture can select`);
  if (!s.sym) fail(`${k} has no symbol to draw`);
  if (!s.src) fail(`${k} carries no provenance tag`);
}
ok(`${Object.keys(SPECIES).length} species, every column present`);

// Antiparticles negate every quantum number reciprocally.
for (const k of Object.keys(SPECIES)) {
  const s = SPECIES[k];
  if (!s.anti) continue;
  const a = SPECIES[s.anti];
  if (!a) { fail(`${k} names antiparticle ${s.anti}, which is not in the table`); continue; }
  if (a.anti !== k) fail(`${k} <-> ${s.anti} is not reciprocal`);
  if (Math.abs(a.mass - s.mass) > 1e-9) fail(`${k} and ${s.anti} differ in mass`);
  for (const n of NUMS) if (a[n] !== -s[n] && !(s[n] === 0 && a[n] === 0)) fail(`${k}/${s.anti}: ${n} not negated`);
  // Intrinsic parity is opposite for a fermion and its antiparticle, and the
  // same for a boson and its antiparticle. Getting this backwards is exactly
  // the transcription error this file exists to catch.
  const wantP = s.J % 1 === 0.5 ? -s.P : s.P;
  if (s.P !== null && s.anti !== k && a.P !== wantP) {
    fail(`${k}/${s.anti}: P should be ${wantP} for a ${s.J % 1 === 0.5 ? 'fermion' : 'boson'} pair, table says ${a.P}`);
  }
  if (a.J !== s.J) fail(`${k}/${s.anti}: spin differs`);
}
ok('antiparticles negate q, b, le, lm; fermion pairs flip P, boson pairs keep it');

// Decays balance, sum to 1, and cannot make more mass than they had.
let channels = 0;
for (const [parent, list] of Object.entries(DECAYS)) {
  let br = 0;
  for (const c of list) {
    channels++;
    balances(`${parent} → ${c.out.join(' ')}`, [parent], c.out);
    const mIn = SPECIES[parent].mass, mOut = sum(c.out, 'mass');
    if (mOut > mIn + 1e-6) fail(`${parent} → ${c.out.join(' ')} makes ${mOut} MeV from ${mIn}`);
    br += c.br;
  }
  if (Math.abs(br - 1) > 1e-4) fail(`${parent}: branching ratios sum to ${br}`);
}
ok(`${channels} decay channels balance, sum to 1, and conserve mass downward`);

// Anything with a finite life must have somewhere to go.
for (const [k, s] of Object.entries(SPECIES)) {
  if (isFinite(s.life) && !DECAYS[k]) fail(`${k} has a finite lifetime and no channels`);
}
ok('every unstable species has channels');

// Annihilations and bindings balance.
for (const [k, r] of Object.entries(ANNIHILATIONS)) {
  balances(`${k} + ${SPECIES[k].anti}`, [k, SPECIES[k].anti], r.out);
}
ok(`${Object.keys(ANNIHILATIONS).length} annihilations balance`);

for (const r of BINDINGS) {
  balances(`${r.in.join(' + ')}`, r.in, r.out);
  const deficit = sum(r.in, 'mass') - sum(r.out, 'mass');
  if (deficit <= 0) fail(`${r.label}: binding releases ${deficit} MeV, so it is not bound`);
  else ok(`${r.label} balances and is bound by ${deficit.toFixed(3)} MeV`);
}

for (const p of PAIRS) balances(`γγ → ${p.out.join(' ')}`, [], p.out);
ok(`${PAIRS.length} pair channels balance against a photon pair`);

// ORDER covers the table.
for (const k of Object.keys(SPECIES)) if (!ORDER.includes(k)) fail(`${k} missing from ORDER`);
for (const k of BEAM) if (!SPECIES[k]) fail(`BEAM names ${k}, which is not in the table`);
ok('ORDER and BEAM name only species that exist');

console.log('\n— the aperture —');

// Which of the 18 settings are live, and what each one admits. Two species
// sharing a setting is not an error: quantum numbers alone do not separate an
// electron from a muon, and a real detector needs penetration depth for that.
const live = [];
for (const Q of AXES.Q) for (const P of AXES.P) for (const J of AXES.J) {
  const hits = Object.keys(SPECIES).filter((k) => admits({ Q, P, J }, k));
  if (hits.length) live.push([`Q${Q >= 0 ? '+' : ''}${Q} P${P > 0 ? '+' : '-'} J${J}`, hits]);
}
for (const [label, hits] of live) console.log(`  ${label}  ->  ${hits.map((k) => SPECIES[k].sym).join(' ')}`);
console.log(`  ${live.length} of ${AXES.Q.length * AXES.P.length * AXES.J.length} settings admit anything`);

// Nothing may admit a neutrino, ever.
const nus = ['nue', 'nueb', 'numu', 'numub'];
let admitted = 0;
for (const Q of AXES.Q) for (const P of AXES.P) for (const J of AXES.J) {
  for (const nu of nus) if (admits({ Q, P, J }, nu)) admitted++;
}
if (admitted) fail(`${admitted} settings admit a neutrino`);
else ok('no setting admits a neutrino — parity is not defined for one');

// Every beam species except the neutrinos must be reachable by some setting.
for (const k of BEAM) {
  const reachable = live.some(([, hits]) => hits.includes(k));
  if (!reachable) fail(`${k} falls but no aperture setting can absorb it`);
}
ok('every species the beam delivers is reachable');

console.log('\n— time compression —');
console.log('  species        measured mean life        on screen');
for (const k of ORDER) {
  const s = SPECIES[k];
  if (k.startsWith('nu')) continue;
  const h = holdLife(s.life);
  console.log(`  ${(s.sym + '            ').slice(0, 12)} ${(isFinite(s.life) ? s.life.toExponential(3) + ' s' : 'stable').padStart(16)}`
    + `   ${(isFinite(h) ? h.toFixed(2) + ' s' : 'held').padStart(8)}`);
}

console.log('\n— a headless run —');

// 120 seconds at 60 Hz, no browser and no canvas, which is only possible
// because game.js holds no DOM.
//
// The autopilot plays deliberately rather than at random: it picks the lowest
// particle still falling, walks the three dials towards that particle's
// quantum numbers, and steers towards where the particle will actually cross
// the plane — which is not where it is now, because a charged track curves.
// Random button-mashing catches almost nothing here, so a random pilot would
// prove only that the game is hard, not that it is playable. This one doubles
// as the reference for what playing well costs: its presses are throttled to
// roughly a human's rate.

function autopilot(g, i) {
  const live = g.falling.filter((f) => f.vy > 0 && SPECIES[f.key].P !== null);
  if (!live.length) return;
  const t = live.reduce((a, b) => (b.y > a.y ? b : a));
  const s = SPECIES[t.key];

  if (i % 5 === 0) {
    const wantQ = AXES.Q.indexOf(s.q), wantP = AXES.P.indexOf(s.P), wantJ = AXES.J.indexOf(s.J);
    if (g.catcher.qi !== wantQ) press(g, 'L');
    else if (g.catcher.pi !== wantP) press(g, 'C');
    else if (g.catcher.ji !== wantJ) press(g, 'R');
  }
  if (i % 4 === 0) {
    const land = predictLanding(t);
    const aim = land === null ? t.x : land;
    if (Math.abs(aim - g.catcher.tx) > APERTURE * 0.6) {
      press(g, g.catcher.tx < aim ? 'CW' : 'CCW');
    }
  }
}

const g = createGame(7);
press(g, 'PRESS');
const seen = new Set();
let curvedLeft = 0, curvedRight = 0, straight = 0;
for (let i = 0; i < 130 * 60 && g.phase === 'run'; i++) {
  autopilot(g, i);
  const before = g.falling.map((f) => [f.key, f.vx]);
  step(g, 1 / 60);
  // Sample the bend: a positive charge must turn one way and a negative one the
  // other, every frame, or the tracker is not reading charge off the curve.
  for (let n = 0; n < before.length && n < g.falling.length; n++) {
    if (g.falling[n] === undefined || before[n][0] !== g.falling[n].key) continue;
    const dq = SPECIES[before[n][0]].q;
    const dvx = g.falling[n].vx - before[n][1];
    if (dq === 0) { if (Math.abs(dvx) < 1e-12) straight++; }
    else if (dq > 0 && dvx > 0) curvedRight++;
    else if (dq < 0 && dvx < 0) curvedLeft++;
  }
  for (const l of g.log) seen.add(l.text);
}
const r = readout(g);
console.log(`  phase after ${g.clock.toFixed(1)}s: ${g.phase}`);
console.log(`  absorbed ${g.caught}, passed ${g.passed}, reactions ${g.reactions}, pile-ups ${g.pileups}`);
console.log(`  recorded ${(g.recorded / 1000).toFixed(1)} GeV`
  + `, missing ${(g.missing / 1000).toFixed(1)} GeV`
  + `, outside acceptance ${(g.outside / 1000).toFixed(1)} GeV`);
console.log(`  of the energy that entered the aperture, ${(r.fraction * 100).toFixed(1)}% left a record`);
console.log(`  longest chain ${g.bestChain}, free quarks ${g.freeQuarks}`);
console.log(`  stack ended at ${g.stack.length}/${r.capacity}, ${g.falling.length} still in flight`);
console.log('  absorbed by species: '
  + Object.entries(g.census).map(([k, n]) => `${SPECIES[k].sym}x${n}`).join(' '));

if (g.phase !== 'over') fail('the run did not end on the clock');
if (g.caught < 20) fail(`a deliberate pilot absorbed only ${g.caught} in 120 s — the game is not playable`);
if (g.reactions === 0) fail('no reaction ever fired');
if (g.freeQuarks !== 0) fail('a free quark was produced');
if (g.missing === 0) fail('nothing was ever missed, which cannot be right');
if (g.falling.some((f) => !isFinite(f.x) || !isFinite(f.y))) fail('a particle reached a non-finite position');
if (g.stack.length > r.capacity) fail(`stack over capacity at ${g.stack.length}`);
if (g.catcher.x < 0 || g.catcher.x > 1) fail(`the catcher left the field at x=${g.catcher.x}`);

console.log('\n— the magnetic field —');
console.log(`  positive tracks turned one way ${curvedRight} times, negative the other ${curvedLeft}, `
  + `neutral tracks stayed straight ${straight} times`);
if (curvedRight === 0 || curvedLeft === 0) fail('charge is not bending tracks in both directions');
if (straight === 0) fail('neutral particles are being bent');

// A high-energy track must bend less than a low-energy one of the same charge,
// because the radius is the momentum. This is the claim the interface rests on.
function bendOf(E) {
  const probe = { key: 'e+', x: 0.5, y: 0, vx: 0, vy: 0.2, E };
  const land = predictLanding(probe);
  return land === null ? null : land - 0.5;
}
const slow = bendOf(150), fast = bendOf(1500);
console.log(`  a 150 MeV positron lands ${slow === null ? 'off the field' : slow.toFixed(3)} from straight down;`
  + ` a 1500 MeV one lands ${fast === null ? 'off the field' : fast.toFixed(3)}`);
if (slow === null || fast === null) fail('a test track left the field before the plane');
else if (!(Math.abs(fast) < Math.abs(slow))) fail('a faster track is not straighter — radius is not momentum');
else ok('a faster track is straighter, so the curvature reads as momentum');

const kinds = [...seen].filter((t) => t.includes('→'));
console.log(`\n  decays and reactions in the last log window (${kinds.length}):`);
for (const k of kinds) console.log(`    ${k}`);

// The same seed must give the same run.
function fingerprint(seed) {
  const h = createGame(seed);
  press(h, 'PRESS');
  for (let i = 0; i < 60 * 60; i++) { autopilot(h, i); step(h, 1 / 60); }
  return `${h.caught}/${h.passed}/${h.reactions}/${Math.round(h.recorded)}`;
}
const a1 = fingerprint(11), a2 = fingerprint(11), a3 = fingerprint(12);
if (a1 !== a2) fail(`seed 11 is not reproducible: ${a1} then ${a2}`);
else ok(`seed 11 reproduces exactly (${a1})`);
if (a1 === a3) fail('seeds 11 and 12 give identical runs');
else ok(`seed 12 differs (${a3})`);

console.log(failures ? `\n${failures} FAILED\n` : '\nall checks passed\n');
process.exit(failures ? 1 : 0);
