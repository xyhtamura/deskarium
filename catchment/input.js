// Catchment — panel input.
//
// The whole control surface is three buttons and a rotary encoder, and the key
// map is deskarium's, unchanged, because the two run on the same panel:
//
//   L      -> ArrowLeft    charge
//   C      -> Space        parity
//   R      -> ArrowRight   spin
//   CCW    -> ArrowUp      move the catcher left
//   press  -> Enter        begin, or run again
//   CW     -> ArrowDown    move the catcher right
//
// The encoder reports discrete steps, not an angle, so the only extra
// information it carries is timing: the gap between consecutive steps is the
// rotation speed. A fast spin crosses two lanes, a slow one crosses one.
//
// No inversion in the upside-down variant. The panel is mounted upside down and
// the page is rotated to cancel that, so the viewer sees an upright screen —
// and a 180-degree rotation about the screen normal leaves clockwise clockwise.

export const KEY_MAP = {
  ArrowLeft: 'L',
  ' ': 'C',
  Spacebar: 'C',
  ArrowRight: 'R',
  ArrowUp: 'CCW',
  ArrowDown: 'CW',
  Enter: 'PRESS',
};

/** Gap at or below this counts as a full-speed spin. */
const FAST_MS = 45;
/** Gap at or above this counts as stopped. */
const SLOW_MS = 400;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** handler(button, velocity). Returns an unbind function. */
export function bindKeys(handler) {
  let lastStepAt = 0;
  let lastStep = null;

  function onKeyDown(e) {
    const button = KEY_MAP[e.key];
    if (!button || e.repeat) return;
    e.preventDefault();

    let velocity = 0;
    if (button === 'CCW' || button === 'CW') {
      const now = performance.now();
      const gap = button === lastStep ? now - lastStepAt : SLOW_MS;
      velocity = 1 - clamp01((gap - FAST_MS) / (SLOW_MS - FAST_MS));
      lastStepAt = now;
      lastStep = button;
    }
    handler(button, velocity);
  }

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}

/** Touch, for a phone or a tablet. The panel has none of this; it exists so the
 *  page is usable where there are no arrow keys at all. The screen splits into
 *  the same six controls, laid out where the panel's are. */
export function bindTouch(el, handler) {
  function at(e) {
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const r = el.getBoundingClientRect();
    const fx = (t.clientX - r.left) / r.width;
    const fy = (t.clientY - r.top) / r.height;
    if (fy < 0.72) return fx < 0.5 ? 'CCW' : 'CW';
    return fx < 0.33 ? 'L' : fx < 0.66 ? 'C' : 'R';
  }
  function onDown(e) {
    e.preventDefault();
    handler(at(e), 0);
  }
  el.addEventListener('pointerdown', onDown);
  return () => el.removeEventListener('pointerdown', onDown);
}
