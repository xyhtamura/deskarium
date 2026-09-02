/* Shoal balance measurement.
   ---------------------------------------------------------------
   How hard is it to empty the window, and how hard to fill it again?

   Those two are a single feel — "the tank ignores me" is what you say
   when scaring is cheap and calling is expensive — and neither is
   visible in the smoke test, which asks whether the mechanics fire at
   all rather than what they cost. This measures the price in seconds.

   It is a measuring instrument, not a pass/fail suite: numbers go up
   and down with deliberate tuning, so it prints figures and asserts
   almost nothing. Run it before and after touching anything in the
   summon/startle path.

   Run: npm run balance */

import { tank, FISH_COUNT } from '../src/engine/tank';
import { updateScene } from '../src/engine/scene';
import { features } from '../src/audio/features';
import { updateVad, vad } from '../src/audio/vad';
import { setOverride } from '../src/engine/daylight';

setOverride('day');

const DT = 33;

interface Sound {
  level?: number;
  bright?: number;
  flux?: number;
  onset?: boolean;
  rms?: number;
}

function frame(s: Sound = {}): void {
  features.rms = s.rms ?? 0;
  features.floor = 0.015;
  features.level = s.level ?? 0;
  features.bright = s.bright ?? 0.5;
  features.flux = s.flux ?? 0;
  features.onset = s.onset ?? false;
  updateVad(DT);
  updateScene(DT);
}

function run(seconds: number, s: Sound = {}): void {
  const n = Math.round((seconds * 1000) / DT);
  for (let i = 0; i < n; i++) frame(s);
}

const here = () => tank.fish.filter((f) => f.presence === 'here').length;
const away = () => tank.fish.filter((f) => f.presence === 'away').length;

/* A voice held at a steady level. `bright` low is a call, high is
   ordinary talk — the two the engine distinguishes. */
const CALL: Sound = { level: 0.34, rms: 0.34, bright: 0.22, flux: 0.02 };
const TALK: Sound = { level: 0.34, rms: 0.34, bright: 0.62, flux: 0.02 };
const BANG: Sound = { level: 0.95, rms: 0.95, bright: 0.7, flux: 0.9, onset: true };

/** Seconds of `s` until every away fish is back, or `cap` if it never happens. */
function secondsToRefill(s: Sound, cap = 90): number {
  let t = 0;
  while (t < cap) {
    run(0.5, s);
    t += 0.5;
    if (away() === 0) return t;
  }
  return Infinity;
}

/** Drive the window empty the way a room does: noise, then long quiet. */
function empty(): void {
  for (let i = 0; i < 8; i++) {
    frame(BANG);
    run(2.5);
  }
  run(120);
}

function pct(n: number): string {
  return `${Math.round((n / FISH_COUNT) * 100)}%`;
}

console.log(`shoal of ${FISH_COUNT}\n`);

/* --- 1. what one bang costs ------------------------------------- */
run(5, TALK);
const before = here();
frame(BANG);
run(12);
const lostToOneBang = before - here();
console.log('--- one loud noise, from a full window ---');
console.log(`fish in frame   ${before} -> ${here()}`);
console.log(`lost to a bang  ${lostToOneBang} (${pct(lostToOneBang)})`);
console.log(`summon after    ${tank.summon.toFixed(2)}, interest ${tank.interest.toFixed(2)}`);

/* --- 2. the price of calling them back --------------------------- */
empty();
console.log(`\n--- refill, from ${away()} away ---`);
console.log(`interest after long quiet  ${tank.interest.toFixed(2)}`);

const callSecs = secondsToRefill(CALL);
console.log(`held low call   ${callSecs === Infinity ? 'never' : callSecs.toFixed(1) + 's'}`);

empty();
const talkSecs = secondsToRefill(TALK);
console.log(`ordinary talk   ${talkSecs === Infinity ? 'never' : talkSecs.toFixed(1) + 's'}`);

/* --- 3. speech that stops and starts, which is what talking is ---- */
empty();
let t = 0;
let done = Infinity;
while (t < 90) {
  run(1.2, TALK); // a phrase
  run(0.8); // a breath
  t += 2;
  if (away() === 0) {
    done = t;
    break;
  }
}
console.log(`broken speech   ${done === Infinity ? 'never' : done.toFixed(1) + 's'}  (1.2s on, 0.8s off)`);

/* --- 4. does summon survive the gaps? ---------------------------- */
empty();
run(1.2, TALK);
const peak = tank.summon;
run(0.8);
console.log(`\nsummon after one phrase   ${peak.toFixed(2)}`);
console.log(`after a 0.8s breath       ${tank.summon.toFixed(2)}  (gate is 0.20)`);

/* --- 5. how long a fish is ineligible ---------------------------- */
const waits = tank.fish.map((f) => f.returnAt - tank.t).filter((w) => w > 0);
if (waits.length) {
  console.log(
    `\nreturn cooldown still to run  ${Math.min(...waits).toFixed(1)}s .. ${Math.max(...waits).toFixed(1)}s`,
  );
}
console.log(`\nvad: speaking ${vad.speaking}, speechMs ${Math.round(vad.speechMs)}`);
