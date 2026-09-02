// Catchment — wiring. The only file that touches the DOM.

import { createGame, step, press, turn } from './game.js';
import { draw, layout, safeFor, W, H } from './render.js';
import { bindKeys, bindTouch } from './input.js';

document.getElementById('fallback')?.remove();

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d', { alpha: false });
canvas.width = W;
canvas.height = H;

const L = layout(safeFor(document, location.search));
let g = createGame(Math.floor(Math.random() * 1e9));

bindKeys((button, velocity) => {
  if (button === 'CCW' || button === 'CW') turn(g, button === 'CCW' ? -1 : 1, velocity);
  else press(g, button);
});

bindTouch(canvas, (button) => {
  if (g.phase !== 'run') { press(g, 'PRESS'); return; }
  if (button === 'CCW' || button === 'CW') turn(g, button === 'CCW' ? -1 : 1, 0);
  else press(g, button);
});

// One clock. dt is capped so a backgrounded tab does not resume by stepping a
// minute of beam into a single frame.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  step(g, dt);
  draw(ctx, g, L);
  requestAnimationFrame(frame);
}

/** Canvas does not wait for a webfont: text drawn before a face arrives is
 *  drawn in the fallback and never repainted, so the first seconds would be in
 *  the wrong type. Wait for both, but never longer than a second — on the panel
 *  a missing font must not mean a missing game. */
async function ready() {
  if (!document.fonts) return;
  const faces = [
    document.fonts.load('16px Moulimie', 'CATCHMENT'),
    document.fonts.load('13px "Terminal Grotesque"', 'recorded'),
  ];
  try {
    await Promise.race([
      Promise.all(faces),
      new Promise((r) => setTimeout(r, 1000)),
    ]);
  } catch { /* draw in the fallback rather than not at all */ }
}

ready().then(() => {
  last = performance.now();
  requestAnimationFrame(frame);
});

// Exposed for the console and for the headless checks in tools/. Nothing in the
// game reads it back.
window.catchment = { get game() { return g; }, layout: L, restart(seed) { g = createGame(seed ?? 1); } };
