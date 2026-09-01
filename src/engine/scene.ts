/* Scene update and composition.
   ---------------------------------------------------------------
   Design rule for the screensaver half: the tank must be watchable
   in silence. Everything here runs on its own clock and audio only
   modulates it. Nothing stops when the room goes quiet.

   Quiet is not neglect. The silence ladder ends at night, which is
   the prettiest state the tank has — leaving it alone is rewarded,
   not punished, and the crab only ever shows up for people who stop
   making noise.

   Depth layers, painted back to front by the grid's z-test:
     1 motes  2 kelp/floor  3 bubbles/pellets/crab  4 fish
     5 surface  9 readout */

import { COLS, ROWS, SPACE, put, text, toCellX, toCellY } from './grid';
import { A, BANK } from '../render/palette';
import { tank, spawnBubble, tankRandom } from './tank';
import { features } from '../audio/features';
import { vad } from '../audio/vad';
import { updateFish, drawFish } from './fish';
import { currentMood } from './daylight';

const FLOOR_ROW = ROWS - 1;
const WATERLINE = 1;

const SURFACE_CHARS = '~~-_-~^';
const MOTE_CHARS = '.`\'.,';

/* Bubbles are punctuation, not weather.

   At the old rates they were the busiest thing on screen and the fish
   were lost behind them — you could not read a scatter or a gather
   through the traffic. One every eight seconds at rest, a handful on a
   loud moment, and a hard ceiling well below what the window can hold.
   The fish are the subject; everything else is there to give them
   somewhere to be. */
const AMBIENT_BUBBLE_RATE = 0.12;
let bubbleAccum = 0;

const CRAB_AFTER_MS = 15_000;

/** Any level above this sends the crab home. */
const CRAB_SPOOK = 0.12;

/** How late the tank repeats your rhythm back at you. */
const ECHO_DELAY_S = 0.9;

export function updateScene(dt: number): void {
  const dts = dt / 1000;
  tank.t += dts;

  // energy trails features.level: fast to rise, slow to fall, so a
  // single shout leaves a wake instead of a spike.
  const target = features.level;
  const k = target > tank.energy ? 0.35 : 0.04;
  tank.energy += (target - tank.energy) * k;

  /* Interest is what holds fish in frame. Any activity snaps it up;
     quiet bleeds it away over roughly half a minute, and as it goes
     the fish stop being turned back at the edges and swim out. Food
     on the way down holds it part-open — a lure keeping the window
     populated, never an obligation. */
  const activity = Math.max(features.level, features.onset ? 0.8 : 0);
  if (activity > tank.interest) tank.interest += (activity - tank.interest) * 0.4;
  else tank.interest = Math.max(0, tank.interest - dts * 0.03);
  if (tank.pellets.length > 0) tank.interest = Math.max(tank.interest, 0.35);

  // The clock only needs looking at about once a second.
  if (Math.floor(tank.t) !== Math.floor(tank.t - dts)) tank.mood = currentMood();

  // bubbles: a steady ambient trickle, plus a burst on every onset
  bubbleAccum += dts * (AMBIENT_BUBBLE_RATE + tank.energy * 1.2);
  while (bubbleAccum >= 1) {
    bubbleAccum -= 1;
    spawnBubble();
  }

  /* Bursts land anywhere. Brightness at the instant of an onset is
     measuring the transient rather than the voice behind it, and
     transients are broadband, so it reads high nearly every time and
     everything drifted to the right-hand edge. Sustained sounds still
     place by pitch — see the call target and the heat zone in fish.ts,
     both of which measure a tone that is being held. */
  if (features.onset) {
    const n = 1 + Math.floor(features.flux * 2);
    const at = tankRandom();
    for (let i = 0; i < n; i++) spawnBubble(at + (tankRandom() - 0.5) * 0.1);

    // ...and the tank remembers the hit, to repeat it back a beat later
    // and slightly wrong. This is the mechanic that makes people keep
    // talking to it.
    tank.echo.push({ due: tank.t + ECHO_DELAY_S, x: at + (tankRandom() - 0.5) * 0.14 });
    if (tank.echo.length > 4) tank.echo.shift();
  }

  for (let i = tank.echo.length - 1; i >= 0; i--) {
    if (tank.echo[i].due <= tank.t) {
      spawnBubble(tank.echo[i].x);
      tank.echo.splice(i, 1);
    }
  }

  for (let i = tank.bubbles.length - 1; i >= 0; i--) {
    const b = tank.bubbles[i];
    b.y -= b.vy * dts * (1 + tank.energy);
    b.wob += dts * 3;
    if (b.y <= 0.02) tank.bubbles.splice(i, 1);
  }

  updateFar(dts);
  updateCrab(dts);
  updateFish(dt);
}

/* Distant traffic, far beyond the glass. Never reacts, never leaves,
   and wraps around — so however empty the near water gets, the window
   is never a dead rectangle. */
function updateFar(dts: number): void {
  for (const s of tank.far) {
    s.x += s.vx * dts;
    if (s.x < -0.05) s.x = 1.05;
    if (s.x > 1.05) s.x = -0.05;
  }
}

/* The crab is the only thing in the tank you cannot get by being loud.
   It turns silence into a move rather than an absence. */
function updateCrab(dts: number): void {
  const crab = tank.crab;
  const spooked = features.onset || features.level > CRAB_SPOOK;

  if (crab.state === 'gone') {
    if (vad.silenceMs > CRAB_AFTER_MS && tankRandom() < dts * 0.35) {
      const fromLeft = tankRandom() < 0.5;
      crab.x = fromLeft ? -0.05 : 1.05;
      crab.vx = fromLeft ? 0.05 : -0.05;
      crab.state = 'walking';
    }
    return;
  }

  if (crab.state === 'walking') {
    if (spooked) {
      crab.state = 'fleeing';
      crab.vx = (crab.x < 0.5 ? -1 : 1) * 0.55;
    } else if (crab.x > 0.15 && crab.x < 0.85 && tankRandom() < dts * 0.25) {
      // Idle change of mind, but only once it is properly inside the
      // frame. Allowed at the edge it enters from, a coin flip in the
      // first second sends it straight back out and the crab is never
      // seen at all.
      crab.vx = -crab.vx;
    }
  }

  crab.x += crab.vx * dts;
  if (crab.x < -0.1 || crab.x > 1.1) crab.state = 'gone';
}

export function drawScene(): void {
  const bank = BANK[tank.mood];
  drawWater(bank);
  drawFar(bank);
  drawKelp(bank);
  drawBubbles(bank);
  drawCrab(bank);
  drawFish(bank);
  drawSurface(bank);
  drawFloor(bank);
}

function drawWater(bank: number): void {
  // The body of open water, painted every cell every frame — clear()
  // only resets to attr 0 (the dawn bank), so without this the water
  // between motes/fish/kelp stayed dawn-dark under every other bank.
  // Invisible in dusk and night, which are dark anyway; only the day
  // bank's pale water ever showed the mismatch.
  //
  // Sparse drifting motes on top. Deterministic from position and
  // time, so no per-mote state is needed and the field is stable
  // across frames. After dark they are the bioluminescence, so the
  // threshold drops and they switch to the one colour that gets
  // brighter at night.
  const night = tank.mood === 'night';
  const threshold = night ? 0.86 : 0.93;
  const moteAttr = bank + (night ? A.GLOW : A.WATER_DIM);
  const baseAttr = bank + A.WATER_DIM;
  const t = tank.t * 0.35;

  for (let y = WATERLINE + 1; y < FLOOR_ROW; y++) {
    for (let x = 0; x < COLS; x++) {
      const n = Math.sin(x * 0.7 + y * 1.9 + t) * Math.cos(x * 0.23 - y * 0.61 - t * 0.7);
      if (n > threshold) {
        const ch = MOTE_CHARS.charCodeAt((x + y) % MOTE_CHARS.length);
        put(x, y, ch, moteAttr, 1);
      } else {
        put(x, y, SPACE, baseAttr, 1);
      }
    }
  }
}

function drawFar(bank: number): void {
  for (const s of tank.far) {
    const x = Math.round(toCellX(s.x));
    const y = Math.round(toCellY(s.y));
    if (y <= WATERLINE || y >= FLOOR_ROW) continue;
    put(x, y, s.vx > 0 ? 62 /* > */ : 60 /* < */, bank + A.WATER_DIM, 1);
  }
}

function drawKelp(bank: number): void {
  for (const k of tank.kelp) {
    const baseX = toCellX(k.x);
    for (let i = 0; i < k.h; i++) {
      const y = FLOOR_ROW - 1 - i;
      if (y <= WATERLINE) break;
      // higher segments sway further; louder rooms sway harder
      const sway = Math.sin(tank.t * 0.9 + k.phase + i * 0.5) * (0.35 + i * 0.22) * (1 + tank.energy * 1.5);
      const x = Math.round(baseX + sway);
      const ch = sway > 0.35 ? 41 /* ) */ : sway < -0.35 ? 40 /* ( */ : 124 /* | */;
      put(x, y, ch, bank + A.KELP, 2);
    }
  }
}

function drawBubbles(bank: number): void {
  for (const b of tank.bubbles) {
    const x = Math.round(toCellX(b.x) + Math.sin(b.wob) * 0.8);
    const y = Math.round(toCellY(b.y));
    if (y <= WATERLINE) continue;
    const ch = b.vy > 0.24 ? 111 /* o */ : 46 /* . */;
    put(x, y, ch, bank + A.BUBBLE, 3);
  }
}

const CRAB_SPRITE = '\\oo/';

function drawCrab(bank: number): void {
  if (tank.crab.state === 'gone') return;
  const x0 = Math.round(toCellX(tank.crab.x)) - 1;
  const y = FLOOR_ROW - 1;
  for (let i = 0; i < CRAB_SPRITE.length; i++) {
    put(x0 + i, y, CRAB_SPRITE.charCodeAt(i), bank + A.FISH_ALT, 3);
  }
}

function drawSurface(bank: number): void {
  const amp = 0.4 + tank.energy * 2.2;
  for (let x = 0; x < COLS; x++) {
    const w = Math.sin(x * 0.45 + tank.t * 1.6) + Math.sin(x * 0.17 - tank.t * 2.3) * 0.6;
    const y = Math.round(WATERLINE + w * amp * 0.5);
    const idx = (x + Math.floor(tank.t * 4)) % SURFACE_CHARS.length;
    put(x, y, SURFACE_CHARS.charCodeAt(idx), bank + A.SURFACE, 5);
  }
}

function drawFloor(bank: number): void {
  for (let x = 0; x < COLS; x++) {
    const n = Math.sin(x * 1.7) * Math.cos(x * 0.41);
    const ch = n > 0.55 ? 44 /* , */ : n < -0.55 ? 46 /* . */ : 95 /* _ */;
    put(x, FLOOR_ROW, ch, bank + A.WATER, 2);
  }
}

/* --- verification readout ------------------------------------------
   Row 0 is above the waterline, so it is free. This bar is the
   instrument for tuning thresholds on the panel; drop it once the
   numbers are settled. */
export function drawReadout(fps: number, cells: number): void {
  const bank = BANK[tank.mood];
  const lvl = Math.round(features.level * (COLS - 12));
  for (let x = 0; x < lvl; x++) put(x, 0, 61 /* = */, bank + A.UI, 9);

  const cx = Math.round(features.bright * (COLS - 12));
  put(cx, 0, 124 /* | */, bank + A.UI, 9);

  const tag = vad.speaking ? '*' : ' ';
  text(COLS - 11, 0, `${tag}${pad(fps, 2)}f ${pad(cells, 4)}c`, bank + A.UI, 9);
}

function pad(n: number, w: number): string {
  return String(Math.round(n)).padStart(w, ' ');
}
