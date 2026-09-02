# Catchment — assets

Two font files ship in this project and are published with it. Everything else
on screen is drawn.

Read [`../../ASSETS.md`](../../ASSETS.md) for the rule this file answers to: a
project that ships a third-party asset carries its own record, listing per file
what it is, where it came from, the licence, and the date checked.

## Fonts

Both live in [`fonts/`](fonts/) and are declared in `catchment.css`. Provenance
below was read out of each file's own OpenType `name` table on 2026-09-03, not
inferred from the filename.

### terminal-grotesque.ttf — the interface face

| | |
| :--- | :--- |
| Family | Terminal Grotesque |
| Designer | Raphaël Bastide, 2011 |
| Source | <http://raphaelbastide.com> (vendor and designer URL in the file) |
| Licence | **SIL Open Font License 1.1**, with Reserved Font Name *Terminal Grotesque* |
| Licence text | [`fonts/terminal-grotesque-OFL.txt`](fonts/terminal-grotesque-OFL.txt), extracted verbatim from the file's name ID 13 |
| Checked | 2026-09-03 |

Clean to publish. Two OFL conditions are met deliberately and must stay met:
the licence travels with the font, which is what the `.txt` beside it is for;
and the **Reserved Font Name is not used**, so the family is referenced as
`Terminal Grotesque` and the file is not renamed. Renaming a reserved-name font,
or shipping it without the licence, is how an OFL font stops being usable.

### Moulimie-standard.otf — the display face

| | |
| :--- | :--- |
| Family | Moulimie |
| Designer | *Ricardo aka Johan* (the only attribution in the file) |
| Source | Unrecorded |
| Licence | **Not stated.** The file carries no copyright string, no licence text and no licence URL. |
| Checked | 2026-09-03 |

**This is an open question, not a cleared one.** The font declares a designer and
nothing else, so its terms cannot be named, and the rule in the root ledger is
that what cannot be named does not go in a published build.

It is shipped anyway, on three grounds, all of which are Xyh's to overturn:

1. It was asked for by name.
2. It is already published — the same file is served from
   `xyhtamura.github.io/fonts/`, so the exposure exists whether or not this
   folder copies it.
3. The absence of any restriction is not permission, but it is different from a
   licence that forbids redistribution.

**What would close it:** finding where the file came from and recording the
terms here. If they turn out to forbid redistribution, the fix is small —
`display()` in `render.js` is the only place the face is used, and it already
falls back to the interface face.

### What is deliberately not used

**Particle symbols do not use either face.** They are drawn from a system stack
— `"DejaVu Sans", "Segoe UI Symbol", system-ui` — because they need Greek
letters, superscript signs and the combining macron in `p̄` and `n̄`, and a
display face with a partial character set would render a blank disc where the
whole game is the letter. `SYM` in `render.js` is the one place this is set.

### What was declined

**`NUKLEAR.otf` was asked for as the body face and is not used.** Its own name
table identifies it as `Copyright (c) 2014 Commercial Type`, manufacturer
Commercial Type Inc., designer Berton Hasebe, carrying the full Commercial Type
End User License Agreement and the trademark note *"Druk Wide is a registered
trademark of Commercial Type/Schwartzco Inc."* — that is, it is a renamed copy
of the retail typeface **Druk Wide**, with the original licence intact.
Publishing it on GitHub Pages would redistribute commercial font software.

Terminal Grotesque was chosen in its place after reading the name tables of
every font in `xyhtamura.github.io/fonts/` and rendering the freely licensed
candidates at the sizes this interface actually uses. Druk Wide is a heavy wide
display face and would have read poorly at 11 px in any case, so nothing was
lost to the substitution but the intent.

## The numbers

[`data/particles.js`](data/particles.js) holds masses, mean lifetimes, decay
channels and branching ratios. These are measurements published by the
**Particle Data Group**. Measured quantities are facts, not expression, so
nothing here is a licensed copy of a work; the table is nonetheless tagged
value-by-value, because a number with no source is the failure this file exists
to prevent.

**Route.** The values came from
[`../../confinery/data/species.js`](../../confinery/data/species.js) rather than
from the PDG directly. Catchment adds two columns the sibling had no use for —
intrinsic parity `P` and spin `J` — and one composite, the deuteron.

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
leaves them disagreeing. See [`../../DEPENDENCIES.md`](../../DEPENDENCIES.md).

The `convention` rows are not a gap. Intrinsic parity for a fermion is a choice
of phase, and the table says so rather than presenting a convention as a
measurement.

## Everything else

No icons, images, audio or samples. Shapes and particle glyphs are drawn with
the canvas API; `γ`, `π⁺`, `μ⁻`, `p̄` are Unicode, not artwork. Nothing is
fetched at runtime, so the page works with the cable out.

---

*2026-09-03 — Claude Code — Rewritten when the project stopped being
asset-free. Every verdict above was read with
[`check_font_licences.py`](../../check_font_licences.py), which was kept at the
root because the question recurs: `xyhtamura.github.io/fonts/` holds 171 files,
18 of them declare a redistributable licence, and the folder is already served
publicly.*
