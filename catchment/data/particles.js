// Catchment — the particle table.
//
// Derived from confinery/data/species.js, which is the sibling project and the
// origin of every mass, lifetime and decay channel here. Two columns are new,
// because the game is built on them and confinery had no use for them:
//
//   P  intrinsic parity, +1 or -1, or null where parity is not defined
//   J  spin, in units of hbar: 0, 0.5 or 1
//
// (Q, P, J) is the aperture the player tunes. `sector` is for colour only.
//
// Provenance tags in `src`:
//   exact      fixed by definition (a photon's mass, a photon's J^P)
//   pdg        confirmed against a published Particle Data Group figure
//   pdg?       written from general knowledge, NOT checked against the PDG.
//              Same caveat confinery carries; fixing it fixes both files.
//   convention a phase convention rather than a measurement. Fermion intrinsic
//              parity is fixed by choosing the particle to be +1; the
//              antiparticle is then -1. Nothing measures this, and the table
//              says so rather than dressing it as data.
//   approx     stood in for. Neutrino masses are set to zero.
//
// Units: mass in MeV/c^2, lifetime in seconds. `Infinity` = stable under the
// interactions this game models.
//
// Quantum numbers carried so the conservation gate can run:
//   q  electric charge, in units of e
//   b  baryon number
//   le electron lepton number
//   lm muon lepton number
//
// tools/check-table.mjs walks every channel below and fails if q, b, le or lm
// does not balance, and separately reports which (Q,P,J) apertures are dead.
// Run it before trusting anything here.

export const SPECIES = {
  // ---- gauge boson -------------------------------------------------------
  gamma: { name: 'photon', sym: 'γ', sector: 'boson',
    mass: 0, life: Infinity, q: 0, b: 0, le: 0, lm: 0,
    P: -1, J: 1, anti: 'gamma', src: 'exact', srcP: 'exact' },

  // ---- charged leptons ---------------------------------------------------
  'e-': { name: 'electron', sym: 'e⁻', sector: 'lepton',
    mass: 0.51099895, life: Infinity, q: -1, b: 0, le: 1, lm: 0,
    P: 1, J: 0.5, anti: 'e+', src: 'pdg?', srcP: 'convention' },
  'e+': { name: 'positron', sym: 'e⁺', sector: 'lepton',
    mass: 0.51099895, life: Infinity, q: 1, b: 0, le: -1, lm: 0,
    P: -1, J: 0.5, anti: 'e-', src: 'pdg?', srcP: 'convention' },
  'mu-': { name: 'muon', sym: 'μ⁻', sector: 'lepton',
    mass: 105.6583755, life: 2.1969811e-6, q: -1, b: 0, le: 0, lm: 1,
    P: 1, J: 0.5, anti: 'mu+', src: 'pdg?', srcP: 'convention' },
  'mu+': { name: 'antimuon', sym: 'μ⁺', sector: 'lepton',
    mass: 105.6583755, life: 2.1969811e-6, q: 1, b: 0, le: 0, lm: -1,
    P: -1, J: 0.5, anti: 'mu-', src: 'pdg?', srcP: 'convention' },

  // ---- neutrinos ---------------------------------------------------------
  // P is null and that is the physics, not a gap. The weak interaction does not
  // conserve parity, the neutrino is produced in a definite helicity rather
  // than a definite parity, and a massless left-handed neutrino has no
  // parity-reflected partner to be assigned against. An aperture that selects
  // on parity therefore cannot be set to admit one, which is why nothing in
  // this game can ever catch a neutrino.
  nue: { name: 'electron neutrino', sym: 'ν', sector: 'lepton',
    mass: 0, life: Infinity, q: 0, b: 0, le: 1, lm: 0,
    P: null, J: 0.5, anti: 'nueb', src: 'approx', srcP: 'exact' },
  nueb: { name: 'electron antineutrino', sym: 'ν', sector: 'lepton',
    mass: 0, life: Infinity, q: 0, b: 0, le: -1, lm: 0,
    P: null, J: 0.5, anti: 'nue', src: 'approx', srcP: 'exact' },
  numu: { name: 'muon neutrino', sym: 'ν', sector: 'lepton',
    mass: 0, life: Infinity, q: 0, b: 0, le: 0, lm: 1,
    P: null, J: 0.5, anti: 'numub', src: 'approx', srcP: 'exact' },
  numub: { name: 'muon antineutrino', sym: 'ν', sector: 'lepton',
    mass: 0, life: Infinity, q: 0, b: 0, le: 0, lm: -1,
    P: null, J: 0.5, anti: 'numu', src: 'approx', srcP: 'exact' },

  // ---- mesons ------------------------------------------------------------
  // Pseudoscalar: J^P = 0^-. Measured, not conventional.
  'pi+': { name: 'pion', sym: 'π⁺', sector: 'hadron',
    mass: 139.57061, life: 2.6033e-8, q: 1, b: 0, le: 0, lm: 0,
    P: -1, J: 0, anti: 'pi-', src: 'pdg', srcP: 'pdg' },
  'pi-': { name: 'antipion', sym: 'π⁻', sector: 'hadron',
    mass: 139.57061, life: 2.6033e-8, q: -1, b: 0, le: 0, lm: 0,
    P: -1, J: 0, anti: 'pi+', src: 'pdg', srcP: 'pdg' },
  pi0: { name: 'neutral pion', sym: 'π⁰', sector: 'hadron',
    mass: 134.97657, life: 8.43e-17, q: 0, b: 0, le: 0, lm: 0,
    P: -1, J: 0, anti: 'pi0', src: 'pdg', srcP: 'pdg' },

  // ---- baryons -----------------------------------------------------------
  p: { name: 'proton', sym: 'p', sector: 'hadron',
    mass: 938.27208816, life: Infinity, q: 1, b: 1, le: 0, lm: 0,
    P: 1, J: 0.5, anti: 'pbar', src: 'pdg?', srcP: 'convention' },
  pbar: { name: 'antiproton', sym: 'p̄', sector: 'hadron',
    mass: 938.27208816, life: Infinity, q: -1, b: -1, le: 0, lm: 0,
    P: -1, J: 0.5, anti: 'p', src: 'pdg?', srcP: 'convention' },
  n: { name: 'neutron', sym: 'n', sector: 'hadron',
    mass: 939.56542052, life: 878.4, q: 0, b: 1, le: 0, lm: 0,
    P: 1, J: 0.5, anti: 'nbar', src: 'pdg?', srcP: 'convention' },
  nbar: { name: 'antineutron', sym: 'n̄', sector: 'hadron',
    mass: 939.56542052, life: 878.4, q: 0, b: -1, le: 0, lm: 0,
    P: -1, J: 0.5, anti: 'n', src: 'pdg?', srcP: 'convention' },

  // ---- composite the player can build ------------------------------------
  // Deuteron: J^P = 1^+. The only thing in this table that is assembled rather
  // than delivered, and the reason the binding rule below exists.
  d: { name: 'deuteron', sym: 'd', sector: 'hadron',
    mass: 1875.61294257, life: Infinity, q: 1, b: 2, le: 0, lm: 0,
    P: 1, J: 1, anti: null, src: 'pdg?', srcP: 'pdg' },
};

// Decay channels. Branching ratios per parent must sum to ~1.
// Antiparticle channels are the charge conjugates of the particle ones.
export const DECAYS = {
  'mu-': [{ br: 1.0, out: ['e-', 'nueb', 'numu'] }],
  'mu+': [{ br: 1.0, out: ['e+', 'nue', 'numub'] }],
  'pi+': [{ br: 0.999877, out: ['mu+', 'numu'] },
          { br: 0.000123, out: ['e+', 'nue'] }],
  'pi-': [{ br: 0.999877, out: ['mu-', 'numub'] },
          { br: 0.000123, out: ['e-', 'nueb'] }],
  pi0:  [{ br: 0.98823, out: ['gamma', 'gamma'] },
         { br: 0.01177, out: ['e+', 'e-', 'gamma'] }],
  n:    [{ br: 1.0, out: ['p', 'e-', 'nueb'] }],
  nbar: [{ br: 1.0, out: ['pbar', 'e+', 'nue'] }],
};

// Annihilation. Keyed by one of the pair; the partner is SPECIES[k].anti.
export const ANNIHILATIONS = {
  'e-':  { out: ['gamma', 'gamma'] },
  'mu-': { out: ['gamma', 'gamma'] },
  'pi+': { out: ['gamma', 'gamma'] },
  p:     { out: ['pi+', 'pi-', 'pi0'] },
  n:     { out: ['pi+', 'pi-', 'pi0'] },
};

// Pair production inside the aperture: two photons whose combined energy pays
// for 2*mass. Ordered lightest first, so what the aperture can make depends on
// what the beam delivered.
export const PAIRS = [
  { out: ['e-', 'e+'], label: 'electron pair' },
  { out: ['mu-', 'mu+'], label: 'muon pair' },
  { out: ['pi+', 'pi-'], label: 'charged pion pair' },
];

// Binding. Two held species fuse and release the difference as a photon.
// The binding energy is the mass deficit, computed from the masses above and
// never written down, so the two cannot disagree.
export const BINDINGS = [
  { in: ['p', 'n'], out: ['d', 'gamma'], label: 'deuteron' },
];

// Order for the census strip and the aperture legend.
export const ORDER = [
  'gamma',
  'nue', 'nueb', 'numu', 'numub',
  'e-', 'e+', 'mu-', 'mu+',
  'pi+', 'pi-', 'pi0',
  'p', 'pbar', 'n', 'nbar',
  'd',
];

/** Species the beam delivers. Neutrinos arrive only as decay products. */
export const BEAM = ['gamma', 'e-', 'e+', 'mu-', 'mu+', 'pi+', 'pi-', 'pi0', 'p', 'pbar', 'n', 'nbar'];

/** Aperture axes, in the order each button cycles them. */
export const AXES = {
  Q: [-1, 0, 1],
  P: [1, -1],
  J: [0, 0.5, 1],
};

/** The selection rule. Invented for play; see the model card.
 *  A particle is absorbed when all three settings agree with it. A null parity
 *  agrees with nothing, which is why neutrinos always pass. */
export function admits(aperture, key) {
  const s = SPECIES[key];
  if (!s) return false;
  if (s.P === null) return false;
  return aperture.Q === s.q && aperture.P === s.P && aperture.J === s.J;
}
