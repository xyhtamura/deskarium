/* Headless smoke test for the simulation.
   ---------------------------------------------------------------
   The engine is pure TypeScript over typed arrays — grid, tank, fish
   and scene touch no DOM — so the whole simulation can be stepped
   outside a browser. That matters here because the window is watched,
   not asserted on: a fish stuck at NaN, a shoal that leaves and never
   comes back, or a pellet that is eaten before it can be seen all look
   like "nothing happened" on screen and are obvious in a loop.

   Run: npm run smoke */

import { tank, FISH_COUNT, spawnPellet } from '../src/engine/tank';
import { updateScene, drawScene } from '../src/engine/scene';
import { chars, attrs, clear, SIZE, SPACE, ROWS } from '../src/engine/grid';
import { features } from '../src/audio/features';
import { updateVad } from '../src/audio/vad';
import { PALETTE, MOODS, BANK, SLOTS, type Mood } from '../src/render/palette';
import { setOverride, setPinned, cycleOverride, currentMood, moodForHour } from '../src/engine/daylight';
import { toggleMenu, updateMenu, drawMenu, menuCopy, INNER_W } from '../src/engine/menu';
import { settings, setSetting, resetSetting, LIMITS, DEFAULTS } from '../src/engine/settings';

/* Pin the palette so every other check is independent of what time the
   test happens to run. */
setOverride('day');

interface Sound {
  rms?: number;
  level?: number;
  bright?: number;
  flux?: number;
  onset?: boolean;
}

const DT = 33;
const WATERLINE = 1;
let failures = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
}

/** One frame, in the same order the real loop runs them. */
function frame(s: Sound = {}): void {
  features.rms = s.rms ?? 0;
  features.floor = 0.015;
  features.level = s.level ?? 0;
  features.bright = s.bright ?? 0.5;
  features.flux = s.flux ?? 0;
  features.onset = s.onset ?? false;
  updateVad(DT);
  updateScene(DT);
  clear();
  drawScene();
}

function run(n: number, s: Sound = {}): void {
  for (let i = 0; i < n; i++) frame(s);
}

const here = () => tank.fish.filter((f) => f.presence === 'here');
const away = () => tank.fish.filter((f) => f.presence === 'away');

function finite(): boolean {
  return tank.fish.every(
    (f) => Number.isFinite(f.x) && Number.isFinite(f.y) && Number.isFinite(f.vx) && Number.isFinite(f.vy),
  );
}

/** Fish in frame stay in frame; the margin is the offscreen threshold. */
function inFrame(): boolean {
  return here().every((f) => f.x >= -0.13 && f.x <= 1.13 && f.y >= 0 && f.y <= 1);
}

function painted(): number {
  let n = 0;
  for (let i = 0; i < SIZE; i++) if (chars[i] !== SPACE) n++;
  return n;
}

function attrsValid(): boolean {
  for (let i = 0; i < SIZE; i++) if (attrs[i] >= PALETTE.length) return false;
  return true;
}

/* Every cell must belong to the bank in force, including cells no draw
   pass writes. Those keep whatever clear() reset them to — slot 0 of
   the dawn bank — and each glyph tile carries its own background, so a
   stray cell paints a foreign bank's background rather than nothing.
   Dark banks hide it from the eye; this does not. */
function attrsAllInBank(mood: Mood): boolean {
  const base = BANK[mood];
  for (let i = 0; i < SIZE; i++) {
    if (attrs[i] < base || attrs[i] >= base + SLOTS) return false;
  }
  return true;
}

/** Steady room noise, loud enough to hold interest, below startle. */
const CHATTER: Sound = { rms: 0.08, level: 0.4, bright: 0.5 };

console.log('--- quiet, 10s ---');
// Bubbles are rare now, so a single sample can easily land between two.
let sawBubble = false;
for (let i = 0; i < 300; i++) {
  frame();
  if (tank.bubbles.length > 0) sawBubble = true;
}
check('fish stay finite', finite());
check('fish stay in frame', inFrame());
check('grid gets painted', painted() > 50, `${painted()} cells`);
check('attrs within palette', attrsValid());
check('mood is day', tank.mood === 'day', tank.mood);
check('the shoal is still around', here().length >= FISH_COUNT - 2, `${here().length} of ${FISH_COUNT} here`);
check('there is a deadpan fish', tank.fish.some((f) => f.nerve < 0.12));
check('there is a hair-trigger fish', tank.fish.some((f) => f.nerve > 0.9));
check('bubbles still happen at rest', sawBubble);
check('but stay sparse', tank.bubbles.length <= 4, `${tank.bubbles.length} on screen`);

console.log('\n--- quiet, 25s: the crab window ---');
run(500);
check('crab has appeared', tank.crab.state !== 'gone', tank.crab.state);

console.log('\n--- a noise sends the crab home ---');
run(3, { rms: 0.2, level: 0.5, onset: true, flux: 0.2 });
check('crab flees or is gone', tank.crab.state !== 'walking', tank.crab.state);

console.log('\n--- long quiet: the window empties ---');
run(2400); // ~80s
check('interest has bled away', tank.interest < 0.1, tank.interest.toFixed(3));
check('fish have swum off', away().length > 0, `${away().length} away, ${here().length} here`);
check('nothing was deleted', tank.fish.length === FISH_COUNT, `${tank.fish.length} fish`);
check('distant traffic still there', tank.far.length === 4);
check('empty window still paints', painted() > 30, `${painted()} cells`);

console.log('\n--- food alone does not summon ---');
const awayPeak = away().length;
tank.pellets.length = 0;
spawnPellet(0.5);
// Sample across the pellet's life rather than after it: once eaten,
// interest resumes bleeding away like anything else.
let heldWhileFalling = true;
for (let i = 0; i < 200; i++) {
  frame();
  if (tank.pellets.length > 0 && tank.interest < 0.34) heldWhileFalling = false;
}
check('food holds interest open while it lasts', heldWhileFalling, tank.interest.toFixed(2));
check('but summons nobody', away().length >= awayPeak, `${awayPeak} away -> ${away().length} away`);
check('summon stays down', tank.summon < 0.2, tank.summon.toFixed(2));

console.log('\n--- hold a note: they come back ---');
const boldBeforeReturn = tank.fish.map((f) => f.boldness);
run(600, CHATTER); // ~20s of sustained sound
check('summon rises', tank.summon > 0.2, tank.summon.toFixed(2));
check('fish return', away().length < awayPeak, `${awayPeak} away -> ${away().length} away`);
check(
  'returning fish keep what they learned',
  tank.fish.every((f, i) => f.boldness >= boldBeforeReturn[i]),
);

console.log('\n--- startle: sharp and loud ---');
run(300, CHATTER); // make sure the shoal is in frame
const present = here();
const deadpan = present.filter((f) => f.nerve < 0.12).length;
const reactive = present.length - deadpan;
frame({ rms: 0.3, level: 0.9, onset: true, flux: 0.4, bright: 0.2 });

/* The reaction is a moving target — flee lasts 380-800ms and the freeze
   that follows lasts 240-520ms, so sampling once lands in whichever
   phase happens to be current. Watch the whole window instead. */
const firedAt = new Map<number, number>();
const froze = new Set<number>();
tank.fish.forEach((f, i) => {
  if (f.flee > 0) firedAt.set(i, 0);
});
for (let step = 1; step <= 80; step++) {
  frame();
  tank.fish.forEach((f, i) => {
    if (f.flee > 0 && !firedAt.has(i)) firedAt.set(i, step);
    if (f.freeze > 0) froze.add(i);
  });
}
check('every nervy fish reacts', firedAt.size >= reactive, `${firedAt.size} fired, ${reactive} reactive`);
check('the steadiest fish sits it out', deadpan > 0 && firedAt.size < present.length, `${deadpan} deadpan`);
check('reactions are staggered', new Set(firedAt.values()).size > 1, `${new Set(firedAt.values()).size} distinct start frames`);
check('fish reach the frozen stare', froze.size > 0, `${froze.size} froze`);
run(120);
check('everyone recovers', tank.fish.every((f) => f.flee === 0 && f.freeze === 0 && f.pending === 0));
check('still finite after a scare', finite());
check('still in frame after a scare', inFrame());

console.log('\n--- feed: sharp and soft ---');
run(60, CHATTER);
run(60); // let the utterance lapse, so nothing is being held
tank.pellets.length = 0;

frame({ rms: 0.02, level: 0.08, onset: true, flux: 0.08 });
check('room noise does not feed', tank.pellets.length === 0, `${tank.pellets.length} pellets`);

run(60);
frame({ rms: 0.1, level: 0.35, onset: true, flux: 0.1, bright: 0.6 });
const pellet = tank.pellets[0];
check('a deliberate sound does', !!pellet, `${tank.pellets.length} pellets`);
check(
  'it starts below the waterline',
  !!pellet && Math.round(pellet.y * (ROWS - 1)) > WATERLINE,
  pellet ? `row ${Math.round(pellet.y * (ROWS - 1))}` : '-',
);
let sawPellet = 0;
for (let i = 0; i < 90; i++) {
  frame(CHATTER);
  if (tank.pellets.length > 0) sawPellet++;
}
check('it lasts long enough to see', sawPellet > 30, `visible ${(sawPellet * DT) / 1000}s of 3s`);
// Onsets ride on top of a held note constantly; feeding must not.
tank.pellets.length = 0;
let spawns = 0;
let lastAt = tank.lastPelletAt;
for (let i = 0; i < 300; i++) {
  frame({ rms: 0.08, level: 0.4, onset: true, flux: 0.1 });
  if (tank.lastPelletAt !== lastAt) {
    spawns++;
    lastAt = tank.lastPelletAt;
  }
}
check('a held note suppresses feeding', spawns <= 1, `${spawns} pellets in 10s of sustain`);

console.log('\n--- held + loud: inflate, and the colour spreads ---');
const HOLD: Sound = { rms: 0.3, level: 0.7, bright: 0.5 };
run(30, HOLD);
const tinted1 = here().filter((f) => f.tint > 0).length;
run(120, HOLD);
const tinted2 = here().filter((f) => f.tint > 0).length;
check('a fish inflates', here().some((f) => f.puff > 0), `max puff ${Math.max(...here().map((f) => f.puff)).toFixed(2)}`);
check('colour spreads the longer it holds', tinted2 > tinted1, `${tinted1} -> ${tinted2} tinted`);
run(300, HOLD); // keep holding: the near water should start deepening
check(
  'a long hold reaches the second stage',
  here().some((f) => f.tint > 0.66),
  `${here().filter((f) => f.tint > 0.66).length} deep, ${here().filter((f) => f.tint > 0).length} tinted`,
);
run(600, CHATTER);
check('inflation subsides', tank.fish.every((f) => f.puff === 0));
check('colour fades back', tank.fish.every((f) => f.tint === 0));

console.log('\n--- call: held and low ---');
const boldBefore = tank.fish.reduce((a, f) => a + f.boldness, 0);
run(300, { rms: 0.06, level: 0.35, bright: 0.2 });
const boldAfter = tank.fish.reduce((a, f) => a + f.boldness, 0);
check('boldness rises when called', boldAfter > boldBefore, `${boldBefore.toFixed(2)} -> ${boldAfter.toFixed(2)}`);
run(300, CHATTER);
check('boldness never falls', tank.fish.reduce((a, f) => a + f.boldness, 0) >= boldAfter);

console.log('\n--- the clock, not the silence ---');
check('early morning is dawn', moodForHour(6) === 'dawn', moodForHour(6));
check('midday is day', moodForHour(12) === 'day', moodForHour(12));
check('evening is dusk', moodForHour(18) === 'dusk', moodForHour(18));
check('small hours are night', moodForHour(2) === 'night', moodForHour(2));

setOverride(null);
const cycled = new Set<Mood>();
for (let i = 0; i < MOODS.length; i++) {
  const m = cycleOverride();
  if (m) cycled.add(m);
}
check('R reaches every bank', cycled.size === MOODS.length, [...cycled].join(' '));
check('and returns to auto', cycleOverride() === null);

for (const mood of MOODS) {
  setOverride(mood);
  run(60);
  check(`${mood} bank applies and paints`, tank.mood === mood && painted() > 30, `${painted()} cells`);
  check(`${mood} attrs within palette`, attrsValid());
  check(`${mood} paints no other bank`, attrsAllInBank(mood));
}
setOverride('day');

/* A pinned page is what /light.html means, so nothing may move it:
   not the clock, not the R button, not an override left set by
   something else. This is the check that the light variants stopped
   drifting to the night bank. */
console.log('\n--- a pinned page stays pinned ---');
setPinned('day');
setOverride('night');
check('pin outranks an override', currentMood() === 'day', currentMood());
check('pin outranks the clock', ![0, 6, 12, 18, 23].some((h) => currentMood(new Date(2026, 0, 1, h)) !== 'day'));
check('R cannot cycle off a pin', cycleOverride() === 'day' && currentMood() === 'day');
run(120);
check('pinned tank paints the pinned bank', tank.mood === 'day' && painted() > 30, tank.mood);

setPinned(null);
setOverride('day');
check('unpinning restores the override', currentMood() === 'day');
check('and the clock is reachable again', (setOverride(null), currentMood()) === moodForHour(new Date().getHours()));
setOverride('day');

/* The settings menu is drawn into the grid and touches no DOM, so the
   whole thing steps out here — including the meter, which is the part
   that matters and the part nobody can eyeball without a microphone. */
console.log('\n--- the settings menu ---');
setOverride('day');
clear();
drawScene();
const beforeMenu = painted();
drawMenu();
check('closed menu draws nothing', painted() === beforeMenu);

toggleMenu();
clear();
drawScene();
drawMenu();
check('open menu draws', painted() > beforeMenu, `${painted() - beforeMenu} more cells`);
check('menu stays inside the grid', attrsValid() && attrsAllInBank('day'));

/* The meter has to move with the level or it is decoration. Count the
   filled cells at two levels and require the louder one to be longer. */
function meterFill(level: number): number {
  features.level = level;
  updateMenu(33);
  clear();
  drawScene();
  drawMenu();
  let n = 0;
  for (let i = 0; i < SIZE; i++) if (chars[i] === 61 /* = */) n++;
  return n;
}
const quietFill = meterFill(0.1);
const loudFill = meterFill(0.9);
check('meter tracks the level', loudFill > quietFill, `${quietFill} -> ${loudFill} cells`);

setSetting('loud', 0.5);
check('a setting takes', settings.loud === 0.5, String(settings.loud));
setSetting('quiet', 0.9);
check('quiet cannot pass loud', settings.quiet < settings.loud, `${settings.quiet} < ${settings.loud}`);
setSetting('gain', 99);
check('values clamp to range', settings.gain === LIMITS.gain.max, String(settings.gain));
resetSetting('gain');
resetSetting('quiet');
resetSetting('loud');
check('reset restores defaults', settings.loud === DEFAULTS.loud && settings.gain === DEFAULTS.gain);

toggleMenu();
features.level = 0;
const tooWide = menuCopy().filter((t) => t.length > INNER_W);
check('menu copy fits the panel', tooWide.length === 0, tooWide.join(' | ') || `<= ${INNER_W} cols`);

check('menu closes', (clear(), drawScene(), drawMenu(), painted()) === beforeMenu);

console.log('\n--- nothing was lost ---');
check('no fish died', tank.fish.length === FISH_COUNT, `${tank.fish.length} fish`);
check('final state finite', finite());
check('final state in frame', inFrame());

console.log(`\n${failures === 0 ? 'all checks passed' : failures + ' FAILURES'}`);
process.exit(failures === 0 ? 0 : 1);
