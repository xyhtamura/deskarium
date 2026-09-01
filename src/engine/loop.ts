/* Frame loop.
   ---------------------------------------------------------------
   The whole simulation lives outside React. React mounts the canvas
   and starts this; it never re-renders per frame.

   The `running` guard matters: StrictMode mounts an effect, tears it
   down, and mounts it again. Without the guard that leaves two rAF
   loops driving one tank at half the framerate, which is confusing
   to debug and trivial to prevent. */

import { COLS, ROWS, CELL_W, CELL_H, chars, attrs, clear } from './grid';
import { BANK_BG, type Mood } from '../render/palette';
import { tank } from './tank';
import { buildAtlas, type Atlas } from '../render/atlas';
import { Blitter } from '../render/blit';
import { updateScene, drawScene, drawReadout } from './scene';
import { updateFeatures, features } from '../audio/features';
import { updateVad, vad } from '../audio/vad';
import { getRig } from '../audio/engine';
import { currentMood } from './daylight';
import { publish } from '../store';

export const GRID_W = COLS * CELL_W;
export const GRID_H = ROWS * CELL_H;

/** dt is clamped so a throttled frame cannot teleport the whole tank. */
const MAX_DT = 64;

const PUBLISH_MS = 500;

let running = false;

export interface LoopOptions {
  showReadout: () => boolean;
}

export function startLoop(canvas: HTMLCanvasElement, opts: LoopOptions): () => void {
  if (running) return () => {};
  running = true;

  /* createTank() hardcodes a mood so the type is satisfied at module
     load, and updateScene only re-reads the clock on a whole-second
     boundary — so without this the first second of every session is
     painted in whatever bank the tank was declared with, regardless of
     the hour or the pin. One second of the wrong palette on a page
     whose entire job is its palette. */
  tank.mood = currentMood();

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('loop: 2d context unavailable');
  ctx.imageSmoothingEnabled = false;

  let dpr = 0;
  let atlas: Atlas | null = null;
  let blitter: Blitter | null = null;

  function resize(): void {
    const nextDpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(window.innerWidth / GRID_W, window.innerHeight / GRID_H);

    canvas.style.width = `${Math.floor(GRID_W * scale)}px`;
    canvas.style.height = `${Math.floor(GRID_H * scale)}px`;

    if (nextDpr !== dpr || !atlas) {
      dpr = nextDpr;
      canvas.width = Math.round(GRID_W * dpr);
      canvas.height = Math.round(GRID_H * dpr);
      atlas = buildAtlas(dpr);
      ctx!.imageSmoothingEnabled = false;
      if (blitter) blitter.setAtlas(atlas);
      else blitter = new Blitter(ctx!, atlas);
    }
    blitter!.forceFull();
  }

  resize();
  window.addEventListener('resize', resize);

  let raf = 0;
  let last = performance.now();
  let lastPublish = 0;
  let fps = 0;
  let cells = 0;
  let shownMood: Mood | null = null;

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);

    const dt = Math.min(MAX_DT, now - last);
    last = now;
    fps += (1000 / Math.max(1, dt) - fps) * 0.1;

    updateFeatures(getRig()?.mic ?? null, now);
    updateVad(dt);

    updateScene(dt);

    clear();
    drawScene();
    if (opts.showReadout()) drawReadout(fps, cells);

    cells = blitter!.draw(chars, attrs);

    // Keep the letterboxing either side of the 1020px grid in step with
    // the water, or a light bank sits in a black frame.
    if (tank.mood !== shownMood) {
      shownMood = tank.mood;
      document.body.style.background = BANK_BG[shownMood];
    }

    if (now - lastPublish > PUBLISH_MS) {
      lastPublish = now;
      publish({
        fps: Math.round(fps),
        cells,
        rms: features.rms,
        floor: features.floor,
        level: features.level,
        centroid: features.centroid,
        bright: features.bright,
        flux: features.flux,
        speaking: vad.speaking,
        silenceMs: vad.silenceMs,
      });
    }
  }

  raf = requestAnimationFrame(frame);

  return function stop(): void {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
  };
}
