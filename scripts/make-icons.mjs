/* Generates the two PWA icons with no dependencies.
   Writes a minimal RGB PNG: signature, IHDR, one IDAT of zlib-deflated
   scanlines (filter byte 0 per row), IEND.

   Run: npm run icons */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(HERE, '..', 'public');

const BG = [0x06, 0x12, 0x18];
const WATER = [0x1f, 0x5a, 0x6e];
const SURFACE = [0x7f, 0xd8, 0xe8];
const FISH = [0xe8, 0xd9, 0xa0];

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function png(width, height, rgb) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function render(size) {
  const buf = Buffer.alloc(size * size * 3);
  const put = (x, y, c) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    buf[i] = c[0];
    buf[i + 1] = c[1];
    buf[i + 2] = c[2];
  };

  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) put(x, y, BG);

  // Content stays inside the middle 80% so maskable cropping is safe.
  const pad = size * 0.1;
  const inner = size - pad * 2;
  const line = Math.max(2, Math.round(size / 48));

  // three water bands
  for (let b = 0; b < 3; b++) {
    const baseY = pad + inner * (0.22 + b * 0.26);
    const amp = inner * 0.05;
    const colour = b === 0 ? SURFACE : WATER;
    for (let x = Math.round(pad); x < pad + inner; x++) {
      const p = (x - pad) / inner;
      const y = Math.round(baseY + Math.sin(p * Math.PI * 3 + b * 1.4) * amp);
      for (let t = 0; t < line; t++) put(x, y + t, colour);
    }
  }

  // a fish body on the middle band
  const fx = Math.round(pad + inner * 0.42);
  const fy = Math.round(pad + inner * 0.48);
  const r = Math.round(inner * 0.09);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r * 2; dx <= r * 2; dx++) {
      if ((dx * dx) / (4 * r * r) + (dy * dy) / (r * r) <= 1) put(fx + dx, fy + dy, FISH);
    }
  }
  // tail
  for (let dx = 0; dx <= r * 1.2; dx++) {
    const h = Math.round((dx / (r * 1.2)) * r);
    for (let dy = -h; dy <= h; dy++) put(fx - r * 2 - dx, fy + dy, FISH);
  }

  return png(size, size, buf);
}

mkdirSync(PUBLIC, { recursive: true });
for (const size of [192, 512]) {
  const file = resolve(PUBLIC, `pwa-${size}x${size}.png`);
  writeFileSync(file, render(size));
  console.log('wrote', file);
}
