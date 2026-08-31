/* Panel input.
   ---------------------------------------------------------------
   The whole control surface is three buttons and a rotary encoder:

     L      -> ArrowLeft
     C      -> Space
     R      -> ArrowRight
     CCW    -> ArrowUp
     press  -> Enter
     CW     -> ArrowDown

   The encoder reports discrete key events, not an absolute position,
   so there is no angle to read. What it does give is timing: the gap
   between consecutive steps is the rotation speed. `velocity` turns
   that into a 0..1 figure so a fast spin can scrub coarsely and a
   slow one can nudge. */

export type Button = 'L' | 'C' | 'R' | 'CCW' | 'CW' | 'PRESS';

const KEY_MAP: Record<string, Button> = {
  ArrowLeft: 'L',
  ' ': 'C',
  Spacebar: 'C',
  c: 'C',
  C: 'C',
  ArrowRight: 'R',
  ArrowUp: 'CCW',
  ArrowDown: 'CW',
  Enter: 'PRESS',
};

/** Gap at or below this counts as a full-speed spin. */
const FAST_MS = 40;
/** Gap at or above this counts as stopped. */
const SLOW_MS = 400;

export type ButtonHandler = (button: Button, velocity: number) => void;

export function bindKeys(handler: ButtonHandler): () => void {
  let lastStepAt = 0;
  let lastStep: Button | null = null;

  function onKeyDown(e: KeyboardEvent): void {
    const button = KEY_MAP[e.key];
    if (!button) return;
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

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
