/* Glyph atlas.
   ---------------------------------------------------------------
   Every (character, palette) pair is rendered once into an offscreen
   canvas at boot. Drawing a frame is then a drawImage blit per cell
   instead of a fillText per cell — roughly an order of magnitude
   cheaper, and the reason a 1020-cell grid holds 30fps on a Pi 4B.

   Cell geometry is decoupled from font metrics: the glyph is centered
   in its tile, so CELL_W/CELL_H can be chosen for legibility on the
   panel without fighting advance width or line height. */

import { CELL_W, CELL_H } from '../engine/grid';
import { PALETTE } from './palette';

export const CHAR_MIN = 32;
export const CHAR_MAX = 126;
export const CHARSET_LEN = CHAR_MAX - CHAR_MIN + 1;

/** Fraction of cell height used as font size. Tune by eye on the panel. */
const FONT_RATIO = 1.0;

const FONT_STACK = '"DejaVu Sans Mono","Liberation Mono","Consolas","Menlo",monospace';

export interface Atlas {
  canvas: HTMLCanvasElement;
  /** Tile size in device pixels. */
  cw: number;
  ch: number;
  /** charCode -> atlas column, or -1 when the character is not in the set. */
  col: Int16Array;
}

export function buildAtlas(dpr: number): Atlas {
  const cw = Math.round(CELL_W * dpr);
  const ch = Math.round(CELL_H * dpr);

  const canvas = document.createElement('canvas');
  canvas.width = CHARSET_LEN * cw;
  canvas.height = PALETTE.length * ch;

  const g = canvas.getContext('2d');
  if (!g) throw new Error('atlas: 2d context unavailable');

  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${Math.round(CELL_H * FONT_RATIO * dpr)}px ${FONT_STACK}`;

  for (let p = 0; p < PALETTE.length; p++) {
    const y = p * ch;
    g.fillStyle = PALETTE[p].bg;
    g.fillRect(0, y, canvas.width, ch);
    g.fillStyle = PALETTE[p].fg;
    for (let i = 0; i < CHARSET_LEN; i++) {
      const code = CHAR_MIN + i;
      if (code === 32) continue; // space is background only
      g.fillText(String.fromCharCode(code), i * cw + cw / 2, y + ch / 2);
    }
  }

  const col = new Int16Array(256).fill(-1);
  for (let i = 0; i < CHARSET_LEN; i++) col[CHAR_MIN + i] = i;

  return { canvas, cw, ch, col };
}
