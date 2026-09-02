// Catchment — the pause deck.
//
// The cards are *built from the tables*, not written out beside them. Every
// recipe on screen is read from data/particles.js at the moment the deck is
// asked for, so a card cannot claim a reaction the simulation does not have,
// and adding a channel to the table adds it to the deck. Same rule the model
// card follows, and the same reason: two statements of one fact drift.
//
// A card is a title plus rows. A row is one of:
//
//   { t: 'p',  text }              a line of prose
//   { t: 'rx', in, out, note }     a reaction, drawn as tokens with an arrow
//   { t: 'kv', k, v }              a labelled value
//   { t: 'ch', key, k, v }         a channel: one token, then a label and value
//   { t: 'gap' }                   a blank line
//
// render.js knows how to draw each. Nothing here touches a canvas.

import { SPECIES, DECAYS, ANNIHILATIONS, PAIRS, BINDINGS, AXES } from './data/particles.js';
import { STACK_CAPACITY, RUN_SECONDS, APERTURE } from './game.js';

const p = (text) => ({ t: 'p', text });
const gap = () => ({ t: 'gap' });
const kv = (k, v) => ({ t: 'kv', k, v });
const rx = (inn, out, note) => ({ t: 'rx', in: inn, out, note });

/** Every card, in deck order. `action` is what PRESS does on that card. */
export function deck() {
  const cards = [];

  cards.push({
    title: 'The catch',
    action: 'resume',
    rows: [
      p('Particles fall. The catcher is a detector'),
      p('aperture with three settings.'),
      gap(),
      p('It takes one only when charge, parity'),
      p('and spin all agree with it, and only if'),
      p('the particle lands inside its mouth.'),
      gap(),
      p('The mouth is about a tenth of the field'),
      p('wide. That is the whole of what this'),
      p('game calls geometric acceptance.'),
      gap(),
      kv('aperture', `${(APERTURE * 200).toFixed(0)}% of the field`),
      kv('run', `${RUN_SECONDS} seconds`),
    ],
  });

  cards.push({
    title: 'The dials',
    action: 'resume',
    rows: [
      p('A particle wears its three quantum'),
      p('numbers. So does the catcher.'),
      gap(),
      { t: 'ch', key: 'p', k: 'L  charge', v: 'colour' },
      { t: 'ch', key: 'pi-', k: 'C  parity', v: 'fill' },
      { t: 'ch', key: 'gamma', k: 'R  spin', v: 'shape' },
      gap(),
      p('Warm is positive, cool is negative,'),
      p('pale is neutral. Solid is parity +,'),
      p('outlined is −. Square is spin 0,'),
      p('circle is ½, star is 1.'),
      gap(),
      p('Two species can share one setting.'),
      p('Quantum numbers alone do not tell an'),
      p('electron from a muon.'),
    ],
  });

  // --- Annihilation, straight off the table --------------------------------
  const ann = Object.keys(ANNIHILATIONS).map((k) =>
    rx([k, SPECIES[k].anti], ANNIHILATIONS[k].out));
  cards.push({
    title: 'Annihilation',
    action: 'resume',
    rows: [
      p('Hold a thing and its antiparticle at'),
      p('the same time and both are gone.'),
      gap(),
      ...ann,
      gap(),
      p('The products are thrown back up the'),
      p('field. Catch one and the chain grows.'),
    ],
  });

  // --- Pair production and binding -----------------------------------------
  const pairRows = PAIRS.map((r) =>
    rx(['gamma', 'gamma'], r.out, `needs ${Math.round(2 * SPECIES[r.out[0]].mass)} MeV`));
  const bindRows = BINDINGS.map((r) => {
    const deficit = r.in.reduce((a, k) => a + SPECIES[k].mass, 0) - SPECIES[r.out[0]].mass;
    return rx(r.in, r.out, `${deficit.toFixed(2)} MeV bound`);
  });
  cards.push({
    title: 'Making things',
    action: 'resume',
    rows: [
      p('Two photons with enough between them'),
      p('become matter. What they can pay for'),
      p('depends on what the beam delivered.'),
      gap(),
      ...pairRows,
      gap(),
      p('A proton and a neutron bind, and the'),
      p('mass they lose leaves as a photon.'),
      gap(),
      ...bindRows,
    ],
  });

  // --- Decay ---------------------------------------------------------------
  const decayRows = ['pi0', 'pi+', 'mu-', 'n']
    .filter((k) => DECAYS[k])
    .map((k) => {
      const c = DECAYS[k][0];
      return rx([k], c.out, c.br > 0.999 ? null : `${(c.br * 100).toFixed(1)}%`);
    });
  cards.push({
    title: 'Decay',
    action: 'resume',
    rows: [
      p('A held particle runs its own clock and'),
      p('comes apart. Its pieces stay inside.'),
      gap(),
      ...decayRows,
      gap(),
      p('Antiparticles go the same way, to the'),
      p('charge conjugates.'),
      gap(),
      p('Decay fills the stack. Reactions are'),
      p('the only thing that empties it.'),
    ],
  });

  cards.push({
    title: 'Pile-up',
    action: 'resume',
    rows: [
      kv('the stack holds', `${STACK_CAPACITY}`),
      gap(),
      p('Absorb into a full stack and two events'),
      p('land in one readout window. Neither can'),
      p('be reconstructed. The chain breaks and'),
      p('everything held is written off.'),
      gap(),
      p('It is the only punishment here.'),
      p('Missing a particle is not one — a'),
      p('detector missing things is the normal'),
      p('condition, and the readout measures it'),
      p('rather than charging you for it.'),
    ],
  });

  cards.push({
    title: 'The readout',
    action: 'resume',
    rows: [
      kv('recorded', 'absorbed and reconstructed'),
      kv('missing', 'landed inside, left no record'),
      kv('outside', 'never entered the mouth'),
      gap(),
      p('The last is geometry, not a failure of'),
      p('the readout, which is why it is counted'),
      p('apart. Folding it in would make the'),
      p('fraction meaningless.'),
      gap(),
      p('The score is recorded energy. A chain'),
      p('of catches multiplies it.'),
    ],
  });

  cards.push({
    title: 'Out of reach',
    action: 'resume',
    rows: [
      { t: 'ch', key: 'nue', k: 'neutrino', v: 'never' },
      gap(),
      p('No setting takes one. The weak'),
      p('interaction does not conserve parity, so'),
      p('a neutrino has no value on that dial to'),
      p('match — which is why it is drawn with a'),
      p('dashed edge, neither filled nor'),
      p('outlined.'),
      gap(),
      p('Nor is there a free quark. One knocked'),
      p('loose is on a string that breaks into a'),
      p('new pair before it arrives, so what you'),
      p('get is a jet of hadrons fanning from a'),
      p('point. The counter stays at zero.'),
    ],
  });

  cards.push({
    title: 'Restart',
    action: 'restart',
    rows: [
      p('Abandon this run and begin a new one'),
      p('with a new beam.'),
      gap(),
      p('The score is not kept anywhere.'),
    ],
  });

  return cards;
}

/** Sanity numbers the checker asserts, so a card cannot quietly lose its
 *  recipes when a table changes. */
export function deckSummary() {
  const d = deck();
  return {
    cards: d.length,
    reactions: d.reduce((a, c) => a + c.rows.filter((r) => r.t === 'rx').length, 0),
    actions: d.filter((c) => c.action === 'restart').length,
    axes: AXES.Q.length + AXES.P.length + AXES.J.length,
  };
}
