// Catchment — the painter. Reads game state, writes pixels, changes nothing.
//
// The canvas is always 1024x600 in its own coordinates, which is the Pi panel
// exactly, and CSS scales it to whatever window it lands in. So a desktop
// browser shows the panel's layout at a different size rather than a different
// layout, and anything legible here is legible there.
//
// SAFE is the inset the casing needs. The Pi's bezel covers a few millimetres
// of the outer glass, so nothing is drawn outside this margin. It is
// overridable per install with `?bezel=28` or `<html data-bezel>`, because the
// exact overlap is a property of the enclosure and not of the game.
//
// ---------------------------------------------------------------------------
// The one idea in this file: a particle's three quantum numbers are its three
// visual channels, and they are the same three the buttons turn.
//
//     charge (L)  ->  colour     warm positive, cool negative, pale neutral
//     parity (C)  ->  fill       solid for +, outlined for -, dashed for none
//     spin   (R)  ->  shape      square for 0, circle for 1/2, star for 1
//
// So the catcher can be drawn with its own current setting, and "will this one
// go in" is a comparison of two drawings rather than a lookup of two triples.
// Every place a species appears — falling, in the stack, in the aperture
// legend, on the title roster — goes through `token()`, so the three channels
// cannot disagree between one part of the screen and another.

import { SPECIES, ORDER, AXES, admits } from './data/particles.js';
import { APERTURE, STACK_CAPACITY, aperture, admitted, readout, traceBack, predictLanding, cards } from './game.js';

export const W = 1024, H = 600;
const DEFAULT_SAFE = 22;

const C = {
  paper: '#fbf7f0',
  skyTop: '#e7effa',
  skyBot: '#f6f9fc',
  band: '#f6efe2',
  ink: '#33404c',
  mute: '#7d8b98',
  faint: '#b9c6d1',
  line: '#dfe7ee',
  good: '#37a06b',
  alarm: '#d9455e',
  gold: '#e8a020',
};

/** Charge decides colour, the same convention confinery uses: warm positive,
 *  cool negative, pale neutral. */
const CHARGE = { '1': '#ea6a4e', '-1': '#2c8fc9', '0': '#9b86c4' };

const colourOf = (key) => CHARGE[String(SPECIES[key].q)];

export function layout(safe) {
  const x = safe, w = W - safe * 2;
  const headerY = safe, headerH = 40;
  const fieldY = headerY + headerH, fieldH = 330;
  const planeY = fieldY + fieldH;
  return {
    x, w, safe, headerY, headerH, fieldY, fieldH, planeY,
    headerBase: headerY + 26,
    cupBottom: planeY + 24,        // the funnel hangs below the plane
    bandTop: planeY + 32,
    apLabel: planeY + 52,          // the small-caps row: L, C, R, ADMITS
    apValue: planeY + 78,          // the dial faces and the admitted tokens
    dialCaption: planeY + 96,      // the value under each dial
    stackTop: planeY + 106,
    stackH: 32,
    logA: planeY + 162,
    logB: planeY + 180,
    bottom: H - safe,
  };
}

/** The inset, in order of precedence: `?bezel=28` in the URL, then
 *  `<html data-bezel="28">`, then the default. The query parameter is for
 *  dialling it in live against the real casing; the attribute is how an install
 *  keeps the number it settled on. */
export function safeFor(doc, search) {
  for (const raw of [new URLSearchParams(search).get('bezel'), doc.documentElement.dataset.bezel]) {
    const v = Number(raw);
    if (raw !== null && raw !== undefined && Number.isFinite(v) && v >= 0 && v <= 80) return v;
  }
  return DEFAULT_SAFE;
}

const px = (L, x) => L.x + x * L.w;
const py = (L, y) => L.fieldY + y * L.fieldH;

/** Radius from mass, log-scaled, so a proton is not eighteen hundred times an
 *  electron across. Massless species get the floor. */
function radius(mass) {
  if (mass <= 0) return 12;
  return 12 + Math.min(10, Math.log10(mass + 1) * 3.2);
}

// Three roles, and the third is the one that matters.
//
//   SYM      particle letters only. A system stack, because it has to cover
//            gamma, pi, mu, superscript plus and minus, and the combining
//            macron in p-bar. A display face missing one of those would leave
//            a blank disc where the whole game is the letter.
//   UI       everything the player reads while playing.
//   DISPLAY  the title and card headings, and nothing small.
const SYM = '"DejaVu Sans", "Segoe UI Symbol", system-ui, sans-serif';
const UI = `"Terminal Grotesque", ${SYM}`;
const DISPLAY = `"Moulimie", ${UI}`;

function font(ctx, size, weight = '600') {
  ctx.font = `${weight} ${size}px ${UI}`;
}

/** Moulimie has one weight; asking for another gets a synthesised one. */
function display(ctx, size) {
  ctx.font = `${size}px ${DISPLAY}`;
}

function sym(ctx, size, weight = '700') {
  ctx.font = `${weight} ${size}px ${SYM}`;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}

// ---------------------------------------------------------------------------
// The token. Colour is charge, fill is parity, shape is spin.

/** Trace the outline for a spin, centred on the origin. */
function shapePath(ctx, J, r, rot = 0) {
  ctx.beginPath();
  if (J === 0) {
    // Scalar: a square, cornered off so it sits with the others.
    const s = r * 0.88, k = r * 0.30;
    if (ctx.roundRect) ctx.roundRect(-s, -s, s * 2, s * 2, k);
    else ctx.rect(-s, -s, s * 2, s * 2);
  } else if (J === 1) {
    // Vector: a six-pointed star, so the photon reads at a glance.
    for (let i = 0; i < 12; i++) {
      const a = rot + (i / 12) * Math.PI * 2;
      const rr = i % 2 === 0 ? r * 1.16 : r * 0.66;
      const fn = i === 0 ? 'moveTo' : 'lineTo';
      ctx[fn](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
  } else {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
}

/** Draw one species. `alpha` dims it, `glow` rings it, `rot` spins a star. */
function token(ctx, cx, cy, r, key, { alpha = 1, glow = null, rot = 0, letter = true } = {}) {
  const s = SPECIES[key];
  const col = colourOf(key);
  const solid = s.P === 1;
  const undefinedParity = s.P === null;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);

  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = 5;
    ctx.globalAlpha = alpha * 0.30;
    shapePath(ctx, s.J, r + 3.5, rot);
    ctx.stroke();
    ctx.globalAlpha = alpha;
  }

  if (undefinedParity) {
    // Parity is not defined, so the token is neither filled nor outlined: a
    // dashed edge, and nothing can be tuned to take it.
    ctx.fillStyle = C.paper;
    shapePath(ctx, s.J, r, rot); ctx.fill();
    ctx.setLineDash([3.5, 3.5]);
    ctx.strokeStyle = C.faint;
    ctx.lineWidth = 1.6;
    shapePath(ctx, s.J, r, rot); ctx.stroke();
    ctx.setLineDash([]);
  } else if (solid) {
    ctx.fillStyle = col;
    shapePath(ctx, s.J, r, rot); ctx.fill();
  } else {
    ctx.fillStyle = C.paper;
    shapePath(ctx, s.J, r, rot); ctx.fill();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2.6;
    shapePath(ctx, s.J, r, rot); ctx.stroke();
  }

  if (letter) {
    sym(ctx, Math.round(r * 1.15), '700');
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = undefinedParity ? C.faint : solid ? C.paper : col;
    ctx.fillText(s.sym, 0, 1);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------

export function draw(ctx, g, L) {
  ctx.fillStyle = C.paper;
  ctx.fillRect(0, 0, W, H);

  if (g.phase === 'title') { drawTitle(ctx, g, L); drawMotes(ctx, g, L); return; }
  if (g.phase === 'over') { drawOver(ctx, g, L); drawMotes(ctx, g, L); return; }

  drawRun(ctx, g, L);

  if (g.phase === 'menu') {
    // The run stays visible under the deck, washed back. Pausing should look
    // like a held frame rather than a different screen.
    ctx.fillStyle = hexA(C.paper, 0.88);
    ctx.fillRect(0, 0, W, H);
    drawMenu(ctx, g, L);
  }
}

function drawRun(ctx, g, L) {
  drawHeader(ctx, g, L);
  drawField(ctx, g, L);
  drawCatcher(ctx, g, L);
  drawApertureBand(ctx, g, L);
  drawStack(ctx, g, L);
  drawLog(ctx, g, L);
  drawFlashes(ctx, g, L);
  drawMotes(ctx, g, L);
}

// ---------------------------------------------------------------------------
// The deck. Cards come from cards.js, which builds them out of the same tables
// the simulation reads, so a recipe on a card is the recipe the game runs.

const CARD_W = 432, CARD_H = 384, CARD_GAP = 42;

function drawMenu(ctx, g, L) {
  const deck = cards();
  const cx = L.x + L.w / 2;
  const top = L.safe + 52;

  ctx.textAlign = 'center';
  font(ctx, 12, '700'); ctx.fillStyle = C.mute;
  ctx.fillText('PAUSED', cx, L.safe + 24);

  // Neighbours first, so the focused card sits on top of them.
  for (let i = 0; i < deck.length; i++) {
    const d = i - g.menu.slide;
    if (Math.abs(d) > 1.6) continue;
    const focused = Math.abs(d) < 0.5;
    if (focused) continue;
    drawCard(ctx, deck[i], cx + d * (CARD_W + CARD_GAP), top, 0.9, 0.30);
  }
  const d0 = g.menu.at - g.menu.slide;
  drawCard(ctx, deck[g.menu.at], cx + d0 * (CARD_W + CARD_GAP), top, 1, 1);

  // Where you are in the deck.
  const dotY = L.bottom - 30;
  deck.forEach((_, i) => {
    const dx = cx + (i - (deck.length - 1) / 2) * 16;
    ctx.beginPath();
    ctx.arc(dx, dotY, i === g.menu.at ? 4.5 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i === g.menu.at ? C.ink : C.faint;
    ctx.fill();
  });

  ctx.textAlign = 'center';
  font(ctx, 12, '600'); ctx.fillStyle = C.mute;
  ctx.fillText('turn to move through the deck   ·   C resumes', cx, L.bottom - 8);
}

function drawCard(ctx, card, cx, top, scale, alpha) {
  const w = CARD_W * scale, h = CARD_H * scale;
  const x = cx - w / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.fillStyle = C.paper;
  roundRect(ctx, x, top, w, h, 16); ctx.fill();
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.5;
  roundRect(ctx, x, top, w, h, 16); ctx.stroke();

  if (scale < 1) { ctx.restore(); return; }   // neighbours are a shape, not a read

  const pad = 24;
  let y = top + 40;
  ctx.textAlign = 'left';
  display(ctx, 27); ctx.fillStyle = C.ink;
  ctx.fillText(card.title, x + pad, y);
  y += 14;
  ctx.strokeStyle = C.line;
  ctx.beginPath(); ctx.moveTo(x + pad, y); ctx.lineTo(x + w - pad, y); ctx.stroke();
  y += 24;

  for (const row of card.rows) y = drawRow(ctx, row, x + pad, y, w - pad * 2);

  // What the button does here, said on the card rather than learned.
  const foot = card.action === 'restart' ? 'press to restart' : 'press to resume';
  font(ctx, 12, '700');
  ctx.fillStyle = card.action === 'restart' ? C.alarm : C.good;
  ctx.textAlign = 'right';
  ctx.fillText(foot, x + w - pad, top + h - 18);
  ctx.textAlign = 'left';

  ctx.restore();
}

function drawRow(ctx, row, x, y, w) {
  if (row.t === 'gap') return y + 9;

  if (row.t === 'p') {
    font(ctx, 13, '600'); ctx.fillStyle = C.ink;
    ctx.fillText(row.text, x, y);
    return y + 18;
  }

  if (row.t === 'kv') {
    font(ctx, 12, '700'); ctx.fillStyle = C.mute;
    ctx.fillText(row.k, x, y);
    font(ctx, 12, '600'); ctx.fillStyle = C.ink;
    ctx.fillText(row.v, x + 104, y);
    return y + 19;
  }

  if (row.t === 'ch') {
    token(ctx, x + 13, y - 5, 13, row.key);
    font(ctx, 12, '700'); ctx.fillStyle = C.ink;
    ctx.fillText(row.k, x + 34, y - 1);
    font(ctx, 12, '600'); ctx.fillStyle = C.mute;
    ctx.fillText(row.v, x + 120, y - 1);
    return y + 30;
  }

  if (row.t === 'rx') {
    let tx = x + 13;
    for (const k of row.in) { token(ctx, tx, y - 5, 12, k); tx += 28; }
    font(ctx, 14, '700'); ctx.fillStyle = C.mute;
    ctx.fillText('\u2192', tx - 8, y - 1);
    tx += 16;
    for (const k of row.out) { token(ctx, tx, y - 5, 12, k); tx += 28; }
    if (row.note) {
      font(ctx, 10, '600'); ctx.fillStyle = C.faint;
      ctx.fillText(row.note, Math.min(tx - 6, x + w - 74), y - 1);
    }
    return y + 30;
  }

  return y;
}

// ---------------------------------------------------------------------------

function drawHeader(ctx, g, L) {
  const r = readout(g);
  const y = L.headerBase;

  display(ctx, 21);
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.fillText('CATCHMENT', L.x + 4, y + 1);

  // Measured, not guessed. The display face is much wider than the interface
  // one at the same size, and a fixed offset here put the timer through the
  // middle of the word.
  const titleEnd = L.x + 4 + ctx.measureText('CATCHMENT').width;

  // Time as a draining bar rather than a number to read.
  const bw = 96, bx = titleEnd + 22, by = y - 11;
  ctx.fillStyle = C.line;
  roundRect(ctx, bx, by, bw, 12, 6); ctx.fill();
  ctx.fillStyle = r.left < 15 ? C.alarm : C.gold;
  roundRect(ctx, bx, by, Math.max(4, bw * (r.left / g.duration)), 12, 6); ctx.fill();
  font(ctx, 13, '600'); ctx.fillStyle = C.mute;
  ctx.fillText(`${Math.ceil(r.left)}s`, bx + bw + 8, y);

  if (g.chain > 1) {
    ctx.fillStyle = C.good;
    font(ctx, 15, '700');
    ctx.fillText(`chain ×${g.chain}`, bx + bw + 48, y);
  }

  ctx.textAlign = 'right';
  font(ctx, 13, '600');
  ctx.fillStyle = C.mute;
  ctx.fillText(`missing ${gev(r.missing)}`, L.x + L.w - 4, y);
  font(ctx, 19, '700');
  ctx.fillStyle = C.ink;
  ctx.fillText(gev(r.recorded), L.x + L.w - 148, y);
  font(ctx, 12, '600');
  ctx.fillStyle = C.mute;
  ctx.fillText('recorded', L.x + L.w - 148, y - 17);
}

function drawField(ctx, g, L) {
  const grd = ctx.createLinearGradient(0, L.fieldY, 0, L.planeY);
  grd.addColorStop(0, C.skyTop);
  grd.addColorStop(1, C.skyBot);
  ctx.fillStyle = grd;
  roundRect(ctx, L.x, L.fieldY, L.w, L.fieldH, 14); ctx.fill();

  ctx.save();
  roundRect(ctx, L.x, L.fieldY, L.w, L.fieldH, 14); ctx.clip();

  const live = new Set(admitted(aperture(g)));

  for (const f of g.falling) {
    const s = SPECIES[f.key];
    const hot = live.has(f.key);
    const col = colourOf(f.key);
    const ghost = s.P === null;

    // The track. Recovered by running the turn backwards, so the trail is
    // exactly the arc the particle flew — which is the whole point of curving
    // them: the bend is the sign of the charge.
    const pts = traceBack(f, 22, 1 / 22);
    ctx.beginPath();
    ctx.moveTo(px(L, pts[pts.length - 1][0]), py(L, pts[pts.length - 1][1]));
    for (let i = pts.length - 2; i >= 0; i--) ctx.lineTo(px(L, pts[i][0]), py(L, pts[i][1]));
    const a = pts[pts.length - 1], b = pts[0];
    const tg = ctx.createLinearGradient(px(L, a[0]), py(L, a[1]), px(L, b[0]), py(L, b[1]));
    tg.addColorStop(0, hexA(col, 0));
    tg.addColorStop(1, hexA(col, ghost ? 0.18 : 0.62));
    ctx.strokeStyle = tg;
    ctx.lineWidth = ghost ? 1.5 : 4.5;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Where it will land, marked only for what the aperture is set to take.
    if (hot) {
      const land = predictLanding(f);
      if (land !== null) {
        const lx = px(L, land);
        ctx.strokeStyle = hexA(col, 0.45);
        ctx.setLineDash([3, 4]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(lx, L.planeY - 12); ctx.lineTo(lx, L.planeY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const bob = Math.sin(f.spin * 0.9) * 1.4;
    token(ctx, px(L, f.x), py(L, f.y) + bob, radius(s.mass), f.key, {
      alpha: ghost ? 0.55 : 1,
      glow: hot ? col : null,
      rot: f.spin * 0.5,
    });
  }
  ctx.restore();
}

function drawCatcher(ctx, g, L) {
  const ap = aperture(g);
  const takes = admitted(ap);
  const cx = px(L, g.catcher.x);
  const half = APERTURE * L.w;
  const squash = g.catcher.squash;

  // The plane.
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(L.x, L.planeY + 1); ctx.lineTo(L.x + L.w, L.planeY + 1);
  ctx.stroke();

  // The funnel, exactly as wide at the rim as the acceptance, tapering to a
  // throat. It is drawn in the colour of whatever the current setting admits,
  // and grey when the setting admits nothing, so lining up is a comparison of
  // two drawings rather than of two triples of numbers.
  const col = takes.length ? colourOf(takes[0]) : C.faint;
  const rim = -6 - squash * 5;                 // the mouth flinches on a catch
  const throatY = L.cupBottom - L.planeY;
  const throat = half * 0.36;

  ctx.save();
  ctx.translate(cx, L.planeY);
  ctx.beginPath();
  ctx.moveTo(-half, rim);
  ctx.lineTo(-throat, throatY - 5);
  ctx.quadraticCurveTo(0, throatY + 4, throat, throatY - 5);
  ctx.lineTo(half, rim);
  ctx.closePath();
  ctx.fillStyle = hexA(col, 0.16 + squash * 0.30);
  ctx.fill();
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // The rim itself, heavier, because it is the line a particle has to land
  // inside of.
  ctx.beginPath();
  ctx.moveTo(-half, rim); ctx.lineTo(half, rim);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------------------

function drawApertureBand(ctx, g, L) {
  const ap = aperture(g);
  const takes = admitted(ap);

  ctx.fillStyle = C.band;
  roundRect(ctx, L.x, L.bandTop, L.w, L.bottom - L.bandTop, 14); ctx.fill();

  // Three dials. Each shows its own axis in the channel that axis controls, so
  // the button teaches what it does by what it changes.
  chargeDial(ctx, L, L.x + 18, g);
  parityDial(ctx, L, L.x + 168, g);
  spinDial(ctx, L, L.x + 318, g);

  const ax = L.x + 500;
  ctx.textAlign = 'left';
  font(ctx, 11, '700'); ctx.fillStyle = C.mute;
  ctx.fillText('TAKES', ax, L.apLabel);
  if (takes.length) {
    takes.forEach((k, i) => {
      token(ctx, ax + 20 + i * 50, L.apValue - 6, 16, k);
    });
  } else {
    font(ctx, 15, '700'); ctx.fillStyle = C.faint;
    ctx.fillText('nothing', ax, L.apValue);
  }

  ctx.textAlign = 'right'; font(ctx, 11, '600');
  ctx.fillStyle = C.faint;
  ctx.fillText('encoder moves the catcher', L.x + L.w - 14, L.apLabel);
}

function dialHead(ctx, L, x, btn, label) {
  ctx.textAlign = 'left';
  font(ctx, 11, '700'); ctx.fillStyle = C.gold;
  ctx.fillText(btn, x, L.apLabel);
  font(ctx, 11, '600'); ctx.fillStyle = C.mute;
  ctx.fillText(label, x + 12, L.apLabel);
}

function chargeDial(ctx, L, x, g) {
  dialHead(ctx, L, x, 'L', 'charge · colour');
  AXES.Q.forEach((q, i) => {
    const on = i === g.catcher.qi;
    const cx = x + 12 + i * 34, cy = L.apValue - 8;
    ctx.fillStyle = CHARGE[String(q)];
    ctx.globalAlpha = on ? 1 : 0.28;
    ctx.beginPath(); ctx.arc(cx, cy, on ? 11 : 7, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (on) {
      font(ctx, 11, '700'); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      ctx.fillText(fmtQ(q), cx, L.dialCaption);
      ctx.textAlign = 'left';
    }
  });
}

function parityDial(ctx, L, x, g) {
  dialHead(ctx, L, x, 'C', 'parity · fill');
  AXES.P.forEach((p, i) => {
    const on = i === g.catcher.pi;
    const cx = x + 12 + i * 34, cy = L.apValue - 8;
    const r = on ? 11 : 7;
    ctx.globalAlpha = on ? 1 : 0.28;
    if (p > 0) {
      ctx.fillStyle = C.ink;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = C.paper;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (on) {
      font(ctx, 11, '700'); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      ctx.fillText(p > 0 ? '+' : '−', cx, L.dialCaption);
      ctx.textAlign = 'left';
    }
  });
}

function spinDial(ctx, L, x, g) {
  dialHead(ctx, L, x, 'R', 'spin · shape');
  AXES.J.forEach((j, i) => {
    const on = i === g.catcher.ji;
    const cx = x + 12 + i * 34, cy = L.apValue - 8;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha = on ? 1 : 0.28;
    ctx.fillStyle = C.ink;
    shapePath(ctx, j, on ? 10 : 7);
    ctx.fill();
    ctx.restore();
    if (on) {
      font(ctx, 11, '700'); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
      ctx.fillText(fmtJ(j), cx, L.dialCaption);
      ctx.textAlign = 'left';
    }
  });
}

function drawStack(ctx, g, L) {
  ctx.textAlign = 'left'; font(ctx, 11, '700');
  ctx.fillStyle = C.mute;
  ctx.fillText('STACK', L.x + 18, L.stackTop + 20);

  const x0 = L.x + 70;
  const full = g.stack.length >= STACK_CAPACITY;
  for (let i = 0; i < STACK_CAPACITY; i++) {
    const bx = x0 + i * 42, by = L.stackTop, bw = 36, bh = L.stackH;
    const it = g.stack[i];
    ctx.strokeStyle = full ? hexA(C.alarm, 0.55) : C.line;
    ctx.lineWidth = 1.5;
    roundRect(ctx, bx, by, bw, bh, 8); ctx.stroke();
    if (!it) continue;
    token(ctx, bx + bw / 2, by + bh / 2 - 1, 11, it.key);
    // A held particle runs its own clock. The bar is how much of its compressed
    // lifetime is gone; a stable one has no bar.
    if (isFinite(it.hold)) {
      ctx.fillStyle = hexA(colourOf(it.key), 0.55);
      roundRect(ctx, bx + 3, by + bh - 5, (bw - 6) * Math.min(1, it.held / it.hold), 3, 1.5);
      ctx.fill();
    }
  }

  ctx.textAlign = 'right'; font(ctx, 12, '600');
  ctx.fillStyle = full ? C.alarm : C.mute;
  ctx.fillText(full ? 'full — the next catch is a pile-up' : `${g.stack.length}/${STACK_CAPACITY} held`,
    L.x + L.w - 14, L.stackTop + 21);
}

function drawLog(ctx, g, L) {
  const last = g.log[g.log.length - 1];
  const prev = g.log[g.log.length - 2];
  ctx.textAlign = 'left'; font(ctx, 14, '700');
  ctx.fillStyle = C.ink;
  if (last) ctx.fillText(last.text, L.x + 18, L.logA);
  font(ctx, 12, '600');
  ctx.fillStyle = C.mute;
  ctx.globalAlpha = 0.75;
  if (prev) ctx.fillText(prev.text, L.x + 18, L.logB);
  ctx.globalAlpha = 1;

  ctx.textAlign = 'right'; font(ctx, 11, '600');
  ctx.fillStyle = C.faint;
  ctx.fillText(`free quarks ${g.freeQuarks}   pile-ups ${g.pileups}   outside acceptance ${gev(g.outside)}`,
    L.x + L.w - 14, L.logB);
}

function drawFlashes(ctx, g, L) {
  ctx.save();
  roundRect(ctx, L.x, L.fieldY, L.w, L.fieldH + 22, 14); ctx.clip();
  for (const fl of g.flashes) {
    const a = 1 - fl.t / fl.life;
    const x = px(L, fl.x);
    if (fl.kind === 'reaction' || fl.kind === 'pileup') {
      const col = fl.kind === 'pileup' ? C.alarm : C.good;
      ctx.strokeStyle = hexA(col, a * 0.95);
      ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.arc(x, L.planeY - 26, 14 + (1 - a) * 86, 0, Math.PI * 2); ctx.stroke();
      font(ctx, 16, '700');
      ctx.textAlign = 'center';
      const tx = Math.max(L.x + 110, Math.min(L.x + L.w - 110, x));
      const ty = L.planeY - 128;
      const tw = ctx.measureText(fl.text).width + 22;
      ctx.fillStyle = hexA(C.paper, a * 0.92);
      roundRect(ctx, tx - tw / 2, ty - 17, tw, 26, 13); ctx.fill();
      ctx.strokeStyle = hexA(col, a * 0.5);
      ctx.lineWidth = 1.5;
      roundRect(ctx, tx - tw / 2, ty - 17, tw, 26, 13); ctx.stroke();
      ctx.fillStyle = hexA(col, a);
      ctx.fillText(fl.text, tx, ty);
    } else if (fl.kind === 'ghost' || fl.kind === 'through') {
      ctx.strokeStyle = hexA(fl.kind === 'ghost' ? C.faint : C.alarm, a * 0.8);
      ctx.setLineDash([4, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, L.planeY - 46); ctx.lineTo(x, L.planeY + 14);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (fl.kind === 'catch') {
      ctx.strokeStyle = hexA(C.good, a);
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, L.planeY, 12 + (1 - a) * 26, 0, Math.PI * 2); ctx.stroke();
    }
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/** Confetti, in the colours of whatever caused it. */
function drawMotes(ctx, g, L) {
  for (const m of g.motes) {
    const a = 1 - m.t / m.life;
    ctx.fillStyle = hexA(m.key ? colourOf(m.key) : C.alarm, a * 0.85);
    const r = 3.4 * a + 1;
    ctx.beginPath();
    ctx.arc(px(L, m.x), py(L, m.y), r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------------------------------------------------------------------------

function drawTitle(ctx, g, L) {
  const cx = L.x + L.w / 2;
  ctx.textAlign = 'center';
  display(ctx, 52); ctx.fillStyle = C.ink;
  ctx.fillText('CATCHMENT', cx, L.fieldY + 60);
  font(ctx, 15, '600'); ctx.fillStyle = C.mute;
  ctx.fillText('Particles arrive from above. The catcher is a detector aperture.', cx, L.fieldY + 90);
  ctx.fillText('It takes one only when charge, parity and spin all agree with it.', cx, L.fieldY + 112);

  // The three channels, shown rather than described.
  const keys = ['p', 'pi-', 'gamma'];
  const labels = [
    ['L', 'charge', 'colour'],
    ['C', 'parity', 'fill'],
    ['R', 'spin', 'shape'],
  ];
  labels.forEach(([btn, axis, channel], i) => {
    const x = cx - 250 + i * 250;
    const y = L.fieldY + 168;
    token(ctx, x, y, 20, keys[i]);
    font(ctx, 13, '700'); ctx.fillStyle = C.gold; ctx.textAlign = 'center';
    ctx.fillText(btn, x, y + 42);
    font(ctx, 13, '600'); ctx.fillStyle = C.ink;
    ctx.fillText(`${axis} · ${channel}`, x, y + 60);
  });

  font(ctx, 13, '600'); ctx.fillStyle = C.mute;
  ctx.fillText('encoder moves the catcher · press to begin', cx, L.fieldY + 258);

  drawRoster(ctx, L, cx, L.fieldY + 296);

  // The neutrino, drawn beside the sentence about it: dashed, because it is
  // neither filled nor outlined, because it has no parity to be either.
  const line = 'No setting takes a neutrino. Parity is not defined for one, so it always passes.';
  font(ctx, 13, '600');
  const lw = ctx.measureText(line).width;
  token(ctx, cx - lw / 2 - 22, L.bottom - 23, 13, 'nue');
  ctx.fillStyle = C.mute;
  ctx.textAlign = 'left';
  ctx.fillText(line, cx - lw / 2, L.bottom - 18);
  ctx.textAlign = 'center';
}

/** Every setting that admits anything, drawn. This is the whole game on one
 *  screen: the player learns to tune towards a picture. */
function drawRoster(ctx, L, cx, top) {
  const live = [];
  for (const Q of AXES.Q) for (const P of AXES.P) for (const J of AXES.J) {
    const hits = ORDER.filter((k) => admits({ Q, P, J }, k));
    if (hits.length) live.push(hits);
  }

  const cols = 6, cellW = 120, cellH = 66;
  ctx.textAlign = 'center';
  font(ctx, 11, '700'); ctx.fillStyle = C.mute;
  ctx.fillText(`THE ${live.length} SETTINGS THAT TAKE ANYTHING`, cx, top);

  live.forEach((hits, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, live.length - row * cols);
    const rowX = cx - (inRow * cellW) / 2;
    const x = rowX + (i % cols) * cellW + cellW / 2;
    const y = top + 34 + row * cellH;
    if (hits.length === 1) token(ctx, x, y, 17, hits[0]);
    else { token(ctx, x - 17, y, 15, hits[0]); token(ctx, x + 17, y, 15, hits[1]); }
  });
}

function drawOver(ctx, g, L) {
  const r = readout(g);
  const cx = L.x + L.w / 2;
  ctx.textAlign = 'center';
  font(ctx, 15, '600'); ctx.fillStyle = C.mute;
  ctx.fillText('recorded', cx, L.fieldY + 44);
  display(ctx, 44); ctx.fillStyle = C.ink;
  ctx.fillText(gev(g.recorded), cx, L.fieldY + 88);

  const rows = [
    ['absorbed', `${g.caught}`],
    ['passed through the aperture', `${gev(g.missing)} missing`],
    ['never entered it', `${gev(g.outside)} outside acceptance`],
    ['of what entered, recorded', `${(r.fraction * 100).toFixed(1)}%`],
    ['reactions', `${g.reactions}`],
    ['pile-ups', `${g.pileups}`],
    ['longest chain', `${g.bestChain}`],
    ['free quarks', `${g.freeQuarks}`],
  ];
  font(ctx, 15, '600');
  rows.forEach(([a, b], i) => {
    const y = L.fieldY + 132 + i * 26;
    ctx.textAlign = 'right'; ctx.fillStyle = C.mute; ctx.fillText(a, cx - 14, y);
    ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.fillText(b, cx + 14, y);
  });

  // What was caught, drawn rather than tallied in text.
  const census = Object.entries(g.census).sort((a, b) => b[1] - a[1]).slice(0, 12);
  const cw = 74;
  const x0 = cx - (census.length * cw) / 2;
  census.forEach(([k, n], i) => {
    const x = x0 + i * cw + cw / 2;
    token(ctx, x, L.bottom - 74, 15, k);
    font(ctx, 12, '700'); ctx.fillStyle = C.mute; ctx.textAlign = 'center';
    ctx.fillText(`×${n}`, x, L.bottom - 48);
  });

  ctx.textAlign = 'center';
  font(ctx, 13, '600'); ctx.fillStyle = C.faint;
  ctx.fillText('press to run again', cx, L.bottom - 18);
}

// ---------------------------------------------------------------------------

function gev(mev) {
  return mev >= 1000 ? `${(mev / 1000).toFixed(1)} GeV` : `${Math.round(mev)} MeV`;
}
const fmtQ = (q) => (q > 0 ? '+1' : q < 0 ? '−1' : '0');
const fmtJ = (j) => (j === 0.5 ? '½' : String(j));
