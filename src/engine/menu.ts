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

   The encoder reports velocity, so a fast spin scrubs coarsely and a
   slow one nudges — which is the difference between finding the right
   neighbourhood and landing on a number. */

import { COLS, ROWS, put, text, SPACE } from './grid';
import { A } from '../render/palette';
import { tank } from './tank';
import { BANK } from '../render/palette';
import { features } from '../audio/features';
import { settings, setSetting, resetSetting, LIMITS, type Settings } from './settings';
import type { Button } from '../input/keys';

const ITEMS: { key: keyof Settings; help: string }[] = [
  { key: 'gain', help: 'lower = hotter mic' },
  { key: 'quiet', help: 'a sound, not the room' },
  { key: 'loud', help: 'a threat, not a snack' },
];

const LABEL_W = 6;

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
      // Velocity turns the encoder into coarse and fine at once: a slow
      // step moves one increment, a fast spin moves up to eight.
      const steps = 1 + Math.round(velocity * 7);
      const dir = button === 'CW' ? 1 : -1;
      setSetting(item.key, settings[item.key] + dir * steps * LIMITS[item.key].step);
      return true;
    }
    case 'C':
      resetSetting(item.key);
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
const TOP_ROW = 6;
const HEIGHT = 9;
const LEFT = 6;
const WIDTH = COLS - 12;

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

  text(LEFT + 1, TOP_ROW, ' audio ', on, 11);
  text(LEFT + WIDTH - 12, TOP_ROW, 'press=close', ui, 11);

  ITEMS.forEach((item, i) => {
    const y = TOP_ROW + 2 + i;
    const sel = i === menu.index;
    const attr = sel ? on : ui;
    text(LEFT + 1, y, sel ? '>' : ' ', hot, 11);
    text(LEFT + 3, y, item.key.padEnd(LABEL_W), attr, 11);
    text(LEFT + 9, y, settings[item.key].toFixed(3), attr, 11);
    if (sel) text(LEFT + 16, y, item.help, ui, 11);
  });

  drawMeter(TOP_ROW + 6, bank);
  text(LEFT + 1, TOP_ROW + 8, 'turn=set  L/R=pick  C=default', ui, 11);
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
