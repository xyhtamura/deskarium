# Catchment — assets

## Nothing here is a third-party file

No fonts, icons, images, audio or samples are bundled or fetched. Type is a
system stack — `"DejaVu Sans", "Segoe UI Symbol", system-ui, sans-serif` —
chosen because DejaVu Sans ships with Raspberry Pi OS and covers Greek letters,
superscript signs and the combining macron the particle symbols need, and Segoe
UI Symbol covers the same range on Windows. Nothing is downloaded, so the page
works with the cable out and there is no licence to carry.

Particle glyphs are drawn as text with the canvas API. `γ`, `π⁺`, `μ⁻`, `p̄` are
Unicode, not artwork.

## The one thing with provenance: the numbers

[`data/particles.js`](data/particles.js) holds masses, mean lifetimes, decay
channels and branching ratios. These are measurements published by the
**Particle Data Group**. Measured quantities are facts, not expression, so
nothing here is a licensed copy of a work; the table is nonetheless tagged
value-by-value, because a number with no source is the failure this file exists
to prevent.

**Route.** The values came from
[`confinery/data/species.js`](../../confinery/data/species.js) rather than from the
PDG directly. Catchment adds two columns the sibling had no use for — intrinsic
parity `P` and spin `J` — and one composite, the deuteron.

**Tags used in `src` and `srcP`:**

| Tag | Means |
| :--- | :--- |
| `exact` | Fixed by definition. A photon's mass; a photon's `J^P`; a neutrino having no defined parity. |
| `pdg` | Confirmed against a published PDG-derived figure. The charged and neutral pion masses and lifetimes, and the pion and deuteron `J^P`. |
| `pdg?` | **Written from general knowledge and not checked against the PDG.** The electron, muon, proton, neutron and deuteron masses and lifetimes. |
| `convention` | A phase convention rather than a measurement. Fermion intrinsic parity is fixed by choosing the particle to be `+1`; the antiparticle is then `−1`. Nothing measures the choice. |
| `approx` | Stood in for. Neutrino masses are set to zero. |

**`pdg?` is the open job**, and it is the same job in both projects: the values
appear in `confinery/data/species.js` too, and fixing one file without the other
leaves them disagreeing. See
[`DEPENDENCIES.md`](../../DEPENDENCIES.md).

The `convention` rows are not a gap. Intrinsic parity for a fermion is a choice
of phase, and the table says so rather than presenting a convention as a
measurement.

## Publication

Not published. If it goes to GitHub Pages, nothing above changes — there is no
redistributable file in the repository.
