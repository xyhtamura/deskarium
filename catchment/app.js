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
requestAnimationFrame(frame);

// Exposed for the console and for the headless checks in tools/. Nothing in the
// game reads it back.
window.catchment = { get game() { return g; }, layout: L, restart(seed) { g = createGame(seed ?? 1); } };
