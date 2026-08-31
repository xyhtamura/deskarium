/* The character grid.
   ---------------------------------------------------------------
   Sized for a 1024x600 panel measuring ~95 x 56 mm of active glass
   (~10.78 px/mm), which puts a 20x30 px cell at 1.86 x 2.78 mm.
   51 cols x 20 rows fills 1020 x 600 with 2px of slack each side.

   These are the numbers to tune on the device. Everything else in
   the engine works in normalized [0,1] space and is mapped through
   here, so changing COLS/ROWS does not touch the simulation. */

export const COLS = 51;
export const ROWS = 20;
export const CELL_W = 20;
export const CELL_H = 30;
export const SIZE = COLS * ROWS;

export const SPACE = 32;

export const chars = new Uint16Array(SIZE);
export const attrs = new Uint8Array(SIZE);

/** Painter's depth buffer: a higher depth wins the cell. */
const zbuf = new Uint8Array(SIZE);

export function clear(): void {
  chars.fill(SPACE);
  attrs.fill(0);
  zbuf.fill(0);
}

export function put(x: number, y: number, code: number, attr: number, depth = 1): void {
  const cx = x | 0;
  const cy = y | 0;
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return;
  const i = cy * COLS + cx;
  if (depth < zbuf[i]) return;
  chars[i] = code;
  attrs[i] = attr;
  zbuf[i] = depth;
}

export function text(x: number, y: number, s: string, attr: number, depth = 1): void {
  for (let k = 0; k < s.length; k++) put(x + k, y, s.charCodeAt(k), attr, depth);
}

/** Normalized [0,1] position -> cell coordinates. */
export function toCellX(nx: number): number {
  return nx * (COLS - 1);
}

export function toCellY(ny: number): number {
  return ny * (ROWS - 1);
}
