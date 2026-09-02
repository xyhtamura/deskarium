// Catchment — the model card.
//
// Not documentation. It is the honesty mechanism, and it is part of the work,
// following coping/ and confinery/. It says which numbers were measured and
// which were invented for play, and it builds its tables from data/particles.js
// and game.js rather than restating them, so the card and the game cannot
// disagree about anything.
//
// It only appears where there is a pointer to open it with. The panel has three
// buttons and an encoder, so on the Pi this button is never shown.

import { SPECIES, ORDER, AXES, admits } from './data/particles.js';
import { holdLife, APERTURE, STACK_CAPACITY, RUN_SECONDS } from './game.js';

const dialog = document.getElementById('card');
const opener = document.getElementById('card-open');
if (window.matchMedia('(hover: hover)').matches && dialog && opener) {
  opener.hidden = false;
  opener.addEventListener('click', () => { build(); dialog.showModal(); });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  style();
}

let built = false;

function build() {
  if (built) return;
  built = true;

  const rows = ORDER.map((k) => {
    const s = SPECIES[k];
    const h = holdLife(s.life);
    return `<tr>
      <td class="sym">${s.sym}</td>
      <td>${s.name}</td>
      <td class="n">${s.q > 0 ? '+' : ''}${s.q}</td>
      <td class="n">${s.P === null ? '—' : s.P > 0 ? '+' : '−'}</td>
      <td class="n">${s.J === 0.5 ? '½' : s.J}</td>
      <td class="n">${s.mass === 0 ? '0' : s.mass.toFixed(s.mass < 1 ? 6 : 3)}</td>
      <td class="n">${isFinite(s.life) ? s.life.toExponential(3) : 'stable'}</td>
      <td class="n">${isFinite(h) ? h.toFixed(2) + ' s' : 'held'}</td>
      <td class="tag t-${(s.src || '').replace('?', 'q')}">${s.src}</td>
      <td class="tag t-${(s.srcP || '').replace('?', 'q')}">${s.srcP || '—'}</td>
    </tr>`;
  }).join('');

  const settings = [];
  for (const Q of AXES.Q) for (const P of AXES.P) for (const J of AXES.J) {
    const hits = ORDER.filter((k) => admits({ Q, P, J }, k));
    if (hits.length) {
      settings.push(`<li><code>${Q > 0 ? '+' : ''}${Q} &nbsp; ${P > 0 ? '+' : '−'} &nbsp; ${J === 0.5 ? '½' : J}</code>
        <span>${hits.map((k) => SPECIES[k].sym).join(' ')}</span></li>`);
    }
  }

  dialog.innerHTML = `
    <article>
      <header>
        <h1>The model</h1>
        <button type="button" data-close>close</button>
      </header>

      <h2>What was measured</h2>
      <p>Masses, mean lifetimes, decay channels and branching ratios come from
        Particle Data Group values by way of <code>confinery</code>, a
        sibling project that is not published, which is the origin of this
        table. Intrinsic parity and spin were added here,
        because the game is built on them. Every value carries a tag.</p>
      <p><strong>Two tags are warnings.</strong> <code>pdg?</code> means the
        figure is written from general knowledge and has <em>not</em> been
        checked against the PDG — the electron, muon, proton and neutron are all
        in that state, and fixing them fixes confinery's table too.
        <code>convention</code> means the value is a phase convention rather
        than a measurement: fermion intrinsic parity is fixed by choosing the
        particle to be +1, and nothing measures that choice.</p>

      <h2>What was invented for play</h2>
      <ul>
        <li><strong>The selection rule.</strong> That an aperture absorbs a
          particle when charge, parity and spin all agree with it is a game
          rule wearing physics vocabulary. Real detectors select on energy
          deposition, track curvature and penetration depth, not on a triple of
          quantum numbers. What is <em>not</em> invented is the consequence:
          nothing can be tuned to admit a neutrino, because the weak
          interaction does not conserve parity and a neutrino is produced in a
          definite helicity rather than a definite parity. It has no value on
          that axis to match.</li>
        <li><strong>The field.</strong> A flat two-dimensional box with
          gravity downward and an aperture
          ${(APERTURE * 200).toFixed(0)}% of its width. Real kinematics is none
          of this, and a real detector surrounds the interaction rather than
          sitting under it.</li>
        <li><strong>How hard the field bends a track.</strong> The
          <em>shape</em> of the bending is real: a charged particle in a
          magnetic field travels on an arc of radius
          <code>r = p / qB</code>, so the sign of the charge decides the
          direction and a faster particle bends less. That is how a tracker
          reads the sign of a charge, and it is why you can tell what
          something is here before its letter is legible. What is invented is
          the strength, and the reason it was chosen: at a realistic field
          strength the slowest particles curl up and spiral out of the
          apparatus without ever reaching the plane — a real effect, called a
          looper — and a game whose cheapest particles are unreachable is not
          a game. The field was weakened until a 150 MeV positron lands.
          Momentum is also stood in for by energy, which is exact only for the
          massless species.</li>
        <li><strong>Time compression.</strong> Measured mean lives span twenty
          orders of magnitude. The table below prints each species' measured
          value beside the time it is held on screen; the mapping is
          logarithmic and preserves the ordering and nothing else. Every rate
          you see is this choice.</li>
        <li><strong>The stack and its capacity.</strong> Holding
          ${STACK_CAPACITY} particles inside the aperture at once, with
          reactions between them, is a device for making the tables playable.
          Pile-up is a real term and a real failure mode; a queue of six is not
          how it works.</li>
        <li><strong>Reaction products thrown back up the field</strong>, and the
          chain multiplier for catching them.</li>
        <li><strong>Beam intensity, energies and the ${RUN_SECONDS}-second
          run.</strong> Pacing, chosen by ear.</li>
      </ul>

      <h2>Confinement</h2>
      <p>You cannot catch a quark. When a quark is knocked out of a hadron the
        string behind it stores energy as it stretches until the energy makes a
        new quark–antiquark pair, and the string breaks — so what arrives at any
        detector is a spray of hadrons, never the quark. That is what a
        <em>jet</em> is, and it is why the readout's <code>free quarks</code>
        counter is fixed at zero.</p>
      <p>The drag gesture in confinery's own specification — pulling a
        tether until it snaps, with the stored energy legible — is
        <strong>not built here</strong>. A jet arriving already fragmented is
        the cheap version of it.</p>

      <h2>Colour, fill and shape</h2>
      <p>A particle's three quantum numbers are drawn as its three visual
        channels, and they are the three the buttons turn: <strong>charge is
        colour</strong> (warm positive, cool negative, pale neutral),
        <strong>parity is fill</strong> (solid for +, outlined for −),
        <strong>spin is shape</strong> (square for 0, circle for ½, star for
        1). None of that is a fact about particles; it is a mapping chosen so
        that lining the catcher up is a comparison of two drawings rather than
        of two triples of numbers.</p>
      <p>One of the three is not a free choice. A neutrino is drawn with a
        dashed edge — neither filled nor outlined — because it has no parity to
        be either, and that is the same reason nothing can be tuned to take
        one.</p>

      <h2>The eleven live settings</h2>
      <p>Of ${AXES.Q.length * AXES.P.length * AXES.J.length} settings the three
        dials can reach, these admit anything. Two species sharing a setting is
        not an error: quantum numbers alone do not separate an electron from a
        muon, and a real detector needs penetration depth for that.</p>
      <ul class="settings">${settings.join('')}</ul>

      <h2>The table</h2>
      <table>
        <thead><tr>
          <th></th><th>species</th><th>Q</th><th>P</th><th>J</th>
          <th>mass<br><span>MeV/c²</span></th>
          <th>mean life<br><span>seconds</span></th>
          <th>on screen</th><th>mass src</th><th>P src</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>

      <h2>Checking it</h2>
      <p>Charge, baryon number and both lepton numbers are checked across every
        decay, annihilation, binding and pair channel by
        <code>node tools/check-table.mjs</code>, which also steps a whole
        120-second run with no browser. That check is the difference between a
        physics game and a physics-shaped game, and it is cheap enough that
        there is no reason to skip it.</p>
    </article>`;

  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
}

function style() {
  const css = document.createElement('style');
  css.textContent = `
    #card-open {
      position: fixed; right: 14px; bottom: 12px; z-index: 5;
      background: #fbf7f0; color: #7d8b98; border: 1px solid #dfe7ee;
      border-radius: 999px; padding: 5px 13px; font: 600 12px system-ui, sans-serif;
      cursor: pointer;
    }
    #card-open:hover { color: #33404c; border-color: #b9c6d1; }
    /* The card pins its own palette rather than inheriting the page's, per
       coping, so it reads the same whatever the game behind it is doing. */
    #card {
      color: #1a2530; background: #f4f2ec; border: none; border-radius: 6px;
      max-width: 62rem; width: calc(100vw - 3rem); max-height: 88vh; padding: 0;
      font: 400 15px/1.55 Georgia, "Times New Roman", serif;
    }
    #card::backdrop { background: rgba(51,64,76,0.55); }
    #card article { padding: 1.6rem 2rem 2.2rem; }
    #card header { display: flex; align-items: baseline; justify-content: space-between;
      border-bottom: 1px solid #d6d0c2; margin-bottom: 1rem; }
    #card h1 { font-size: 1.5rem; margin: 0 0 .6rem; }
    #card h2 { font-size: 1.05rem; margin: 1.6rem 0 .4rem; letter-spacing: .02em; }
    #card p, #card li { max-width: 58ch; }
    #card ul { padding-left: 1.1rem; }
    #card li { margin: .35rem 0; }
    #card code { font: 500 13px ui-monospace, "DejaVu Sans Mono", monospace;
      background: #e6e2d6; padding: 1px 4px; border-radius: 3px; }
    #card a { color: #2a5d78; }
    #card [data-close] { background: none; border: 1px solid #c9c2b1; border-radius: 4px;
      padding: 3px 10px; font: 500 12px system-ui, sans-serif; cursor: pointer; color: #4a5560; }
    #card table { border-collapse: collapse; font: 400 13px/1.4 ui-monospace, "DejaVu Sans Mono", monospace;
      margin-top: .5rem; }
    #card th, #card td { padding: 3px 9px 3px 0; text-align: left; vertical-align: bottom; }
    #card thead th { border-bottom: 1px solid #c9c2b1; font-weight: 600; font-size: 11px; }
    #card thead th span { font-weight: 400; color: #7b7466; }
    #card td.n { text-align: right; }
    #card td.sym { font-size: 16px; font-weight: 700; }
    #card .tag { font-size: 11px; color: #7b7466; }
    #card .t-pdgq { color: #a8492f; font-weight: 600; }
    #card .t-approx, #card .t-convention { color: #8a6d1f; }
    #card ul.settings { list-style: none; padding: 0; columns: 3; max-width: 46rem; }
    #card ul.settings li { margin: .2rem 0; break-inside: avoid; }
    #card ul.settings code { min-width: 6.4rem; display: inline-block; }
    #card ul.settings span { font-size: 15px; }
  `;
  document.head.append(css);
}
