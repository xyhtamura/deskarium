/* Dirty-cell blitter.
   ---------------------------------------------------------------
   Keeps the previous frame's buffers and only repaints cells whose
   character or attribute changed. A still tank changes well under
   15% of its cells per frame, so this is where most of the frame
   budget is won back. drawn() reports the count so the readout can
   show it while tuning on the device. */

import { COLS, ROWS, SIZE } from '../engine/grid';
import type { Atlas } from './atlas';

export class Blitter {
  private prevChars = new Uint16Array(SIZE);
  private prevAttrs = new Uint8Array(SIZE);
  private full = true;

  constructor(
    private ctx: CanvasRenderingContext2D,
    private atlas: Atlas,
  ) {}

  /** Force a complete repaint — after a resize or an atlas rebuild. */
  forceFull(): void {
    this.full = true;
  }

  setAtlas(atlas: Atlas): void {
    this.atlas = atlas;
    this.full = true;
  }

  draw(chars: Uint16Array, attrs: Uint8Array): number {
    const { canvas, cw, ch, col } = this.atlas;
    const ctx = this.ctx;
    const full = this.full;
    let drawn = 0;

    for (let y = 0; y < ROWS; y++) {
      const row = y * COLS;
      for (let x = 0; x < COLS; x++) {
        const i = row + x;
        const c = chars[i];
        const a = attrs[i];
        if (!full && c === this.prevChars[i] && a === this.prevAttrs[i]) continue;

        const sx = col[c];
        if (sx < 0) continue; // outside the charset: leave the cell alone

        ctx.drawImage(
          canvas,
          sx * cw, a * ch, cw, ch,
          x * cw, y * ch, cw, ch,
        );

        this.prevChars[i] = c;
        this.prevAttrs[i] = a;
        drawn++;
      }
    }

    this.full = false;
    return drawn;
  }
}
