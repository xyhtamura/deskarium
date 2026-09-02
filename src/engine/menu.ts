/* The settings menu.
   ---------------------------------------------------------------
   Drawn into the character grid rather than as a React overlay, for
   three reasons that all come from the panel: it inherits the current
   palette bank, it rotates with the upside-down variants for free, and
   it goes through the same glyph atlas as everything else, so it
   cannot be the one part of the screen that looks like a web page.

   It exists because audio thresholds are a property of the room and
   the microphone, not of the software — see settings.ts. The meter is
   the point. Numbers alone would be guesswork; a bar with the two
   thresholds marked on it, moving while you talk, turns calibration
   into "make the marks straddle my voice".

   Controls, on the panel's three buttons and encoder:

     PRESS (Enter)     open, and close
     L / R (arrows)    previous / next setting
     CW / CCW (up/dn)  raise / lower the selected value
     C (space)         reset the selected value to its default

   `colour` rides along in the same list because it wants the same
   controls, even though it is a display override rather than a stored
   threshold — see the note on it below.

   The encoder reports velocity, so a fast spin scrubs coarsely and a
   slow one nudges — which is the difference between finding the right
   neighbourhood and landing on a number. */

import { COLS, ROWS, put, text, SPACE } from './grid';
import {
  A, BANK, MOODS, setBiome, currentBiome, currentBiomeName, type Mood,
} from '../render/palette';
import { BIOME_NAMES } from '../render/biomes';
import { tank } from './tank';
import { getPinned, setPinned } from './daylight';
import { features } from '../audio/features';
import { settings, setSetting, resetSetting, LIMITS, type Settings } from './settings';
import type { Button } from '../input/keys';

/* `colour` is not a stored setting, deliberately. The variant pin is
   what the URL means (see settings-vs-pin in daylight.ts), so an
   override made here lasts the session and the page comes back as
   itself on reload. It exists to show the four banks without waiting
   for the clock — the same job the R button does, but visible, and
   reachable on a page where R is pinned shut. */
type Item =
  | { kind: 'num'; key: keyof Settings; label: string; help: string }
  | { kind: 'bank'; label: string; help: string }
  | { kind: 'biome'; label: string; help: string };

const ITEMS: Item[] = [
  { kind: 'biome', label: 'place', help: 'The water, and what lives in it.' },
  { kind: 'bank', label: 'colour', help: 'auto follows the clock.' },
  { kind: 'num', key: 'gain', label: 'gain', help: 'Lower makes the meter rise sooner.' },
  { kind: 'num', key: 'quiet', label: 'quiet', help: 'Sounds above this reach the fish.' },
  { kind: 'num', key: 'loud', label: 'loud', help: 'Sounds above this scatter the fish.' },
];

const LABEL_W = 7;

/** auto, then the four banks. */
const BANKS: (Mood | null)[] = [null, ...MOODS];

function stepBank(dir: number): void {
  const i = BANKS.indexOf(getPinned());
  const next = (i + dir + BANKS.length) % BANKS.length;
  setPinned(BANKS[next]);
}

function bankLabel(): string {
  return getPinned() ?? 'auto';
}

const menu = {
  open: false,
  index: 0,
  /** Decaying peak, so a short shout leaves a mark you can aim at. */
  peak: 0,
};

export function menuOpen(): boolean {
  return menu.open;
}

export function toggleMenu(): void {
  menu.open = !menu.open;
}

/** Returns true if the menu consumed the button. */
export function menuHandleButton(button: Button, velocity: number): boolean {
  if (button === 'PRESS') {
    toggleMenu();
    return true;
  }
  if (!menu.open) return false;

  const item = ITEMS[menu.index];

  switch (button) {
    case 'L':
      menu.index = (menu.index + ITEMS.length - 1) % ITEMS.length;
      return true;
    case 'R':
      menu.index = (menu.index + 1) % ITEMS.length;
      return true;
    case 'CW':
    case 'CCW': {
      const dir = button === 'CW' ? 1 : -1;
      if (item.kind === 'bank') {
        stepBank(dir);
        return true;
      }
      if (item.kind === 'biome') {
        const i = BIOME_NAMES.indexOf(currentBiomeName());
        setBiome(BIOME_NAMES[(i + dir + BIOME_NAMES.length) % BIOME_NAMES.length]);
        return true;
      }
      // Velocity turns the encoder into coarse and fine at once: a slow
      // step moves one increment, a fast spin moves up to eight.
      const steps = 1 + Math.round(velocity * 7);
      setSetting(item.key, settings[item.key] + dir * steps * LIMITS[item.key].step);
      return true;
    }
    case 'C':
      if (item.kind === 'bank') setPinned(null);
      else if (item.kind === 'biome') setBiome('reef');
      else resetSetting(item.key);
      return true;
  }
  return false;
}

export function updateMenu(dt: number): void {
  const decay = dt / 1000 / 1.6;
  menu.peak = Math.max(features.level, menu.peak - decay);
}

/* Row 0 is the debug readout's, and the menu is a modal thing, so it
   takes the middle of the window and lets the tank carry on behind it. */
const TOP_ROW = 3;
const HEIGHT = 13;
const LEFT = 6;
const WIDTH = COLS - 12;

const FOOTER = 'turn: adjust   L/R: move   C: reset';
const CLOSE = 'press: close';

/* Every string the panel renders, and the width it has to fit in.
   `text()` clips at the grid edge without complaining, so a string one
   character too long loses its last character and reads as a typo.
   Checked in the smoke test rather than remembered. */
export const INNER_W = WIDTH - 2;
export function menuCopy(): string[] {
  return [...ITEMS.map((i) => i.help), FOOTER, CLOSE];
}

export function drawMenu(): void {
  if (!menu.open) return;

  const bank = BANK[tank.mood];
  const ui = bank + A.UI;
  const on = bank + A.FISH;
  const hot = bank + A.TINT2;
  const dim = bank + A.WATER;

  // A cleared panel, so the tank behind it does not make the text soup.
  for (let y = TOP_ROW; y < TOP_ROW + HEIGHT && y < ROWS; y++) {
    for (let x = LEFT; x < LEFT + WIDTH && x < COLS; x++) put(x, y, SPACE, dim, 10);
  }

  text(LEFT + 1, TOP_ROW, ' settings ', on, 11);
  text(LEFT + WIDTH - CLOSE.length, TOP_ROW, CLOSE, ui, 11);

  ITEMS.forEach((item, i) => {
    const y = TOP_ROW + 2 + i;
    const sel = i === menu.index;
    const attr = sel ? on : ui;
    text(LEFT + 1, y, sel ? '>' : ' ', hot, 11);
    text(LEFT + 3, y, item.label.padEnd(LABEL_W), attr, 11);
    const value =
      item.kind === 'bank'
        ? bankLabel()
        : item.kind === 'biome'
          ? currentBiome().label
          : settings[item.key].toFixed(3);
    text(LEFT + 3 + LABEL_W, y, value.padEnd(6), attr, 11);
  });

  // Help for the selected row gets the full width. Cramped into the
  // margin beside the value it had to be abbreviated into "a threat,
  // not a snack" — which names neither what the control changes nor
  // what happens when it does.
  text(LEFT + 1, TOP_ROW + 7, ITEMS[menu.index].help, ui, 11);

  drawMeter(TOP_ROW + 9, bank);
  text(LEFT + 1, TOP_ROW + 12, FOOTER, ui, 11);
}

/* The calibration instrument: current level as a bar, with `quiet` and
   `loud` marked on the same scale. Talk at the panel and the two marks
   should sit either side of where the bar spends its time. */
function drawMeter(row: number, bank: number): void {
  const w = WIDTH - 2;
  const ui = bank + A.UI;
  const lvl = Math.round(features.level * w);
  const pk = Math.round(menu.peak * w);
  const qx = Math.round(settings.quiet * w);
  const lx = Math.round(settings.loud * w);

  for (let i = 0; i < w; i++) {
    const x = LEFT + 1 + i;
    // Below quiet it is the room; between the marks it is a voice;
    // above loud it is a bang. The bar is coloured by what the tank
    // would call it, so the meaning is visible, not just the number.
    const attr =
      i > lx ? bank + A.TINT2 : i > qx ? bank + A.FISH : bank + A.WATER;
    if (i < lvl) put(x, row, 61 /* = */, attr, 11);
    else put(x, row, 45 /* - */, ui, 11);
  }

  if (pk > 0 && pk < w) put(LEFT + 1 + pk, row, 124 /* | */, bank + A.FISH_ALT, 12);
  if (qx < w) put(LEFT + 1 + qx, row + 1, 113 /* q */, bank + A.FISH, 11);
  if (lx < w) put(LEFT + 1 + lx, row + 1, 108 /* l */, bank + A.TINT2, 11);
}
