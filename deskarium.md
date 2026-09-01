# Deskarium

A sound-responsive ASCII marine window for a 1024x600 desk panel driven
by a Raspberry Pi 4B. Screensaver first, instrument second: it runs on
its own clock and the room's sound modulates it.

Not an enclosed aquarium — a window onto open sea. There are no side
walls. What holds fish in frame is `tank.interest`, which any activity
raises and half a minute of quiet bleeds away; as it falls the fish stop
being turned back at the edges and simply swim out. Make a noise and
they file back in. Fish that leave are marked `away`, never destroyed,
so nothing they have learned is lost — which is where `boldness` earns
its keep, since fish that have been called return soonest.

Input is three buttons and a rotary encoder. There is a microphone and a
speaker. There is no pointer and no network.

## What exists now

Boot gesture, audio capture, per-frame feature extraction, character
grid, glyph atlas, dirty-cell blitter, a scene of water, kelp, bubbles
and waterline, and a stocked tank: 18 fish, pellets, a crab, mimicry,
and the silence ladder.

## The rule

**Every state change self-reverses, and nothing can ever be lost.**

No death, no hunger, no decay, no neglect meter, no state that punishes
you for walking away. If a mechanic cannot undo itself within about ten
seconds or drift back on its own, it does not go in. This is the whole
difference between "responsive and zany" and a tamagotchi, and it is
meant to be enforced at review time rather than felt.

Consequences: `Fish` has no health and no hunger. `nerve` is fixed at
spawn. `boldness` only rises. The inflation gag deflates on its own.
Pellets are eaten or dissolve. Night is a costume change, not a decline.

## Sound, and what it means

Split by *how* a sound is made rather than how loud it is, so the
mapping is learnable without instructions:

| Sound | Meaning | Window |
|---|---|---|
| sharp + loud | threat | scatter, overshoot, freeze, sidle back (~2.5s) |
| sharp + soft | food | pellet drops at a random position, nearest fish break for it, and it holds the present shoal from drifting off. Needs level above 0.25 — below that it is the room, not you — and is suppressed while a note is held |
| held + low | a call | fish gather at the pitch and rise; boldness climbs; away fish return |
| held + loud | heat | nearest fish inflates and sighs back down; colour spreads outward from the pitch, deepening at the centre the longer it holds |

### Two signals, two jobs

`interest` is a **leash**: it holds the fish already in frame. Any
activity raises it, food included.

`summon` is a **call**: it brings back fish that have already left. Only
a sustained sound raises it. Food does not, and neither does a clap —
you cannot startle something into returning, and leaving a snack out
does not fill an empty window. To repopulate it you have to hold a note,
and a low call pulls about twice as hard as ordinary talk.

Food is a lure, never a requirement. Nothing starves without it.

### Colour comes from the clock

Four palette banks, chosen by the hour: **dawn** 05–08, **day** 08–17,
**dusk** 17–20, **night** 20–05. The boundaries are blunt on purpose —
real civil twilight moves with the date and the latitude, and none of
that is visible across four palettes.

**Day is a light bank**, and the only one that inverts: pale water with
the fish as dark silhouettes, which is what looking into lit shallow
water actually gives you. The page background behind the 1020px grid
follows the bank, so a light palette does not sit in a black frame.

The palette used to be driven by how long the room had been quiet —
silence standing in for dusk, which was a metaphor. A window looks out
at the actual light outside. Silence keeps everything else it had: fish
still drift off, the crab still comes out, the shoal still slows down.
Those are behaviours and they were doing the real work; only the colour
moved to the clock.

**R cycles the palette** — auto, dawn, day, dusk, night, back to auto.
Without it the only way to see whether the night bank is legible on the
panel is to wait until 03:00.

### Where pitch places things, and where it does not

Pitch placement is valid for **sustained** sounds and wrong for anything
triggered by an **onset**. An onset *is* a transient, and transients are
broadband, so measuring brightness at the moment of the attack samples
the click rather than the voice behind it — it reads high nearly every
time and everything piled against the right-hand edge.

So: the call target and the heat zone place by pitch, because both
measure a tone that is being held. Pellets and onset bubble bursts land
at random positions.

Horizontal position comes from pitch, via `features.bright`. A mono mic
gives no direction, so pitch is the only spatial control available — and
it is what makes the tank playable rather than merely reactive. Raw
spectral centroid was useless for this: speech sits at 1-2 kHz, which on
the raw scale is 0.10-0.21, cramming every voice into the left fifth of
the tank. `bright` remaps it log-spaced over 200 Hz - 4 kHz, so a low hum
lands near 0.15 and an "sss" at the top.

Comedy comes from overreaction plus fast recovery. Reaction delay scales
off `nerve`, so the school panics raggedly rather than as one body, and
fish with `nerve` below 0.12 never react at all. The deadpan fish that
keeps swimming through the commotion is doing more comic work than any
of the others.

Quiet has its own rewards: the crab appears after 15s of silence and
scuttles off at the first noise, and it is the only thing in the tank
you cannot get by being loud.

## Hardware

| | |
|---|---|
| Panel | 1024x600, ~95 x 56 mm active glass (~10.78 px/mm) |
| Grid | 51 cols x 20 rows at 20x30 px cells |
| Physical cell | 1.86 x 2.78 mm |
| Host | Raspberry Pi 4B, Chromium kiosk |

Measured 9.5 x 6 cm by hand; the 60 mm includes roughly 4 mm of bezel,
since square pixels put the active height at 55.7 mm.

`COLS`/`ROWS`/`CELL_W`/`CELL_H` in `src/engine/grid.ts` are the knobs to
tune with eyes on the device. 40x15 at 25x40 cells is the coarser
fallback if 51x20 reads as mush. Nothing else in the engine changes:
everything simulates in normalized [0,1] space and maps through the grid.

## Architecture

React owns the shell and never renders a frame. The simulation is a
plain rAF loop writing into typed arrays.

```
src/
  App.tsx            boot gate, key binding, canvas mount
  store.ts           2Hz snapshot bridge (useSyncExternalStore)
  ui/
    Boot.tsx         "press C to begin"
    Overlay.tsx      debug readout, `d`
  engine/
    grid.ts          COLS/ROWS, cell buffers, put() with z-test
    tank.ts          serializable state tree
    scene.ts         water, kelp, bubbles, surface, readout
    loop.ts          rAF driver, dt clamp, StrictMode guard
  render/
    palette.ts       8 (fg,bg) pairs
    atlas.ts         glyph atlas, built once at boot
    blit.ts          dirty-cell drawImage
  audio/
    engine.ts        AudioContext, mic + output analysers
    features.ts      rms, noise floor, centroid, flux, onset
    vad.ts           utterance gate, silence timer
  input/
    keys.ts          three buttons + encoder, rotation speed from timing
```

Three constraints that hold the framerate:

1. `tank` lives in module scope, never in React state.
2. The overlay subscribes to a 2Hz snapshot, never to the tank.
3. `startLoop` guards against StrictMode's double mount. Without it,
   two rAF loops drive one tank at half speed.

### Why a glyph atlas

1020 cells of `fillText` per frame does not hold 30fps on a Pi 4B. Every
(character, palette) pair is pre-rendered into one offscreen canvas at
boot, and a frame becomes a `drawImage` blit per changed cell. Each tile
carries its own background, so a dirty blit fully covers the cell it
replaces and no clear pass is needed.

Consequence: changing a palette colour means rebuilding the atlas. That
is fine for mood shifts, which happen about once a minute.

### Two audio tiers

The instrument half and the screensaver half want different latencies,
so they are separate.

- **Per frame** (`features.ts`): rms, spectral centroid, spectral flux,
  onset. ~33 ms from sound to picture. Drives surface chop, bubble
  bursts, kelp sway.
- **Per utterance** (`vad.ts`): speaking / silence / night timer.
  Seconds. Drives mood.

`rmsOf()` and the asymmetric noise-floor tracker come from
`../iris-vibecoded/app.js`, where they were tuned on this same hardware.
The floor falls fast and rises slow, which absorbs fan noise and room
tone with no calibration step. Thresholds (`speechDelta` 0.012,
`silenceMs` 1100, `minSpeechMs` 350) are that project's measured values.

### Stack

React + TypeScript + Tailwind v4 + Vite 6 + Workbox via
`vite-plugin-pwa` — collaborator's specification, chosen over the
root `AGENTS.md` static-first default. Reason, static alternative, and
Pages consequence were stated and the call was made deliberately. The
build produces commit-ready static output, which is the condition
`AGENTS.md` sets for a build tool.

`base: './'` means the build runs unchanged from a server root, from
`/deskarium/dist/`, or from GitHub Pages, with no reconfiguration.

## Offline

Nothing here makes a network call. Files are served from `localhost` on
the Pi (secure context, so the microphone and the service worker both
work), the PWA is installed once from the browser, and the kiosk script
finds it by app-id.

The systemd unit binds to `127.0.0.1`, unlike the workstation's root
server, which `AGENTS.md` says to leave open for Tailscale and tablets.
Different machine, different purpose: nothing off-device should reach the
Pi's copy, and the kiosk browser is on the same host.

## Versions

Variants of the tank live as sibling HTML entries, each its own URL under
`/deskarium/dist/` — one Vite build, four pages, same bundle:

| File | What differs |
|---|---|
| `index.html` | Normal. Palette follows the clock. |
| `upside-down.html` | Whole page rendered rotated 180°, canvas included — the fix for a panel physically mounted upside down: what reads upside-down here is right-side-up on that hardware. |
| `light.html` | Boots into the day bank instead of the clock (`setOverride('day')`); R still cycles from there. |
| `upside-down-light.html` | Both of the above at once. |

The day bank itself (`DAY` in `src/render/palette.ts`) is pastel light
blue water with the fish, kelp, and crab pushed darker for contrast —
tuned so the figures read as silhouettes against the water rather than
blending into it. It is the one bank every variant can reach: directly
in `light.html`/`upside-down-light.html`, or by the clock (or R) in
`index.html`/`upside-down.html`.

`data-variant` on `<html>` (set per-file) is read once in `main.tsx` and
passed to `App` as a prop — see `vite.config.ts`'s `build.rollupOptions.input`
for the entry list and `src/App.tsx` for what each variant changes.

## Next

See `rpi/README.md` for the Pi-side install.

---

## Log

### 2026-09-02 — Claude Code — fourth variant, pastel day palette

Cy: a fourth page combining the first two (upside-down + light), and the
day bank should read as light blue water with darker figures — the
existing day colours were closer to pale grey-teal than blue, and the
fish/kelp against it were about the same value as the water rather than
standing off from it.

**Added** `upside-down-light.html`, wired into `vite.config.ts` alongside
the other three. `App`'s `Variant` type gained the fourth member; `light`
and `flipped` are now derived independently from it
(`variant === 'light' || variant === 'upside-down-light'`, same pattern
for `flipped`), so the two effects compose instead of needing a fifth
special case.

**Re-tuned `DAY` in `src/render/palette.ts`.** Background `#dfeef2` to
`#d6ecf8` (bluer, less grey). `WATER_DIM`/`WATER`/`SURFACE` shifted
toward blue. `FISH`/`FISH_ALT`/`KELP` darkened — `FISH` `#2c4a52` to
`#1c313d` — so the silhouettes hold contrast against the new background
instead of sitting close to it in value. This is the shared `day` bank,
so the change reaches `index.html`/`upside-down.html` too, whenever the
clock (or R) lands on day, not only the two dedicated light pages. `Boot`
and the pre-mount CSS background were brought into step with the same
colours rather than left on the old ones.

**Verified:** built (4 HTML entries, one shared bundle, no tsc errors).
Loaded `upside-down-light.html`, clicked past Boot, confirmed by
screenshot that the scene is both inverted and pastel-blue with visibly
darker fish/kelp, and read a canvas pixel directly (`getImageData` at an
open-water point) to confirm the flat background is `#d6ecf8`, matching
the new `BG_DAY`. Reloaded `light.html` and `index.html` to confirm the
shared-palette change looks consistent there too.

**Undone:** no further variants requested. Same open item as the last
sitting — deskarium still has no `ROADMAP.md` entry.

### 2026-09-02 — Claude Code — variant URLs: upside-down, light

Cy wants versions of the tank as separate URLs — sub-pages in `dist/`
rather than one page with settings. First: upside-down, because the Pi's
panel is mounted rotated 180° and there's no fix for that on the hardware
side right now. Second: a light, bright version.

**Added** three Vite HTML entries — `index.html`, `upside-down.html`,
`light.html` — listed in `vite.config.ts`'s `build.rollupOptions.input`,
each setting `data-variant` on `<html>`. `main.tsx` reads that once and
passes it to `App` as a prop. One JS/CSS bundle, three `dist/*.html` URLs.

- **upside-down**: `App`'s outer container gets `transform: rotate(180deg)`
  — canvas, boot screen, and readout all invert together, so the page
  looks upside-down here and right-side-up on the flipped panel.
- **light**: calls `setOverride('day')` on mount, so it boots into the day
  bank instead of whatever the clock says. R still cycles from there —
  only the starting point changes.

**Found and fixed a real rendering bug, by reading canvas pixels instead
of trusting a screenshot.** `drawWater()` in `scene.ts` only ever painted
sparse motes; every other water cell kept whatever `clear()` left it at,
which is attr 0 — the *dawn* bank's `WATER_DIM` — regardless of
`tank.mood`. This has apparently been true since the four-bank palette
shipped: dusk and night both stay dark, close enough to dawn's dark that
the mismatch is invisible by eye, so nothing caught it in three sittings
of "still not verified visually." Only the day bank's pale water made it
obvious, and only because building `light.html` forced someone to
actually look. Fixed by having `drawWater` paint a base
`bank + A.WATER_DIM` background across the whole water body every frame,
motes drawn on top of that — this changes rendering for the existing
`index.html` too, at every hour, not only for `light.html`.

**Verified:** `npm run build` (3 HTML entries, one shared bundle, no
tsc errors). Loaded all three `dist/*.html` in the browser pane, clicked
past Boot, and read the canvas directly with `getImageData` rather than
judging color from a screenshot — `light.html` water samples as `#dfeef2`
(matches `BG_DAY`) where it previously read `#141a26` (dawn). Confirmed
`upside-down.html` renders the same scene with kelp hanging from the top
edge and the readout mirrored to the bottom-left. Confirmed `index.html`
still resolves the current hour's bank correctly and looks materially the
same as before apart from the water-fill fix.

**Undone:** deskarium has no entry in the root `ROADMAP.md` — checked, it
isn't listed under any name. Not added here; that's a placement decision
(section, Mechanism line) this sitting wasn't asked to make. No third
variant is queued — Cy named exactly two. The GitHub Pages workflow
(`deploy.yml`) publishes `dist/` as committed, so once pushed the three
pages should be live at `/upside-down.html` and `/light.html` alongside
`/`; that has not been checked against the actual deployment, only the
local build.

### 2026-08-31 — Codex — shared-server blank page diagnosis

The page at `http://localhost:8000/deskarium/` serves the source
`index.html`, which requests `/src/main.tsx`. The workspace root server
resolves that request outside the project and returns `404`, so React never
mounts and `#root` remains empty. Development through the source entrypoint
requires Vite's module transforms.

**Verified:** An HTTP request to `http://localhost:8000/src/main.tsx` returned
`404`. Browser inspection found an empty `#root` at
`http://localhost:8000/deskarium/`. The committed build at
`http://localhost:8000/deskarium/dist/` rendered the Deskarium boot screen with
one canvas and no console errors or warnings.

**Undone:** The canonical shared-server URL remains blank. Use the committed
build under `/deskarium/dist/` or run `npm run dev` for source development. A
redirect or build-serving change was not attempted because this sitting was
diagnosis only.

### 2026-08-31 — Antigravity — standalone repo, GitHub Pages workflow & desktop gestures

Initialized `deskarium` as an independent Git repository, added GitHub Actions workflow for publishing `dist/` directly to GitHub Pages, and improved desktop browser interactivity.

**Configured:** Git repository initialized directly in `deskarium/` on branch `main`; added `*.tsbuildinfo` to `.gitignore`; added `.github/workflows/deploy.yml` for direct GitHub Pages deployment from `dist/`; bound literal `'c'` and `'C'` keyboard keys to Center wake button; added click/tap gesture listener to `Boot` screen for easy wake on desktop and mobile browsers.

**Verified:** `npm run build` and `npm run smoke` pass all 58 checks; `dist/` contains valid precached service worker and bundled assets.

### 2026-08-06 — Claude Code — the clock

Cy asked to see it in light mode, or to have colour follow the clock.
Did both: four banks driven by the hour, with day as a genuine light
palette, plus an override so any bank can be seen on demand.

**Added** `src/engine/daylight.ts` — hour boundaries, override state,
cycling. Fourth palette bank (dawn). `BANK_BG` so the page background
behind the grid follows the water. R button cycles the override.

**Day inverts.** Every other bank is light glyphs on dark water; the day
bank is dark glyphs on pale water, fish as silhouettes. Worth watching
on the panel — a bright 5cm screen on a desk is a different object from
a dark one, and this is the change most likely to want reverting.

**Silence lost the palette but kept the behaviour.** Colour by quiet was
a metaphor; colour by clock is a fact about the window. Fish still drift
off, the crab still appears, and the shoal still slows down when the
room is quiet — that last one moved from `mood` to `interest`, so it now
stacks with night rather than being the same knob wearing two hats.

Smoke test 58 checks. The palette is pinned with `setOverride('day')` at
the top so the rest of the suite no longer depends on what time it runs
— it would otherwise have quietly changed behaviour at 17:00.

### 2026-08-06 — Claude Code — fish are the subject

Cy, watching it run: pellets fire on background noise and sometimes
collide with a held voice; the bubbles are distracting and it is hard to
see what is happening; the fish should be the stars. Shoal to 5.

**Feeding now needs a deliberate sound and a gap in the talking.** An
onset fires on spectral flux alone, so a fan tick or a keyboard press
clears the bar while sitting barely above the noise floor — that is why
the window filled with food nobody asked for. Added `FEED_MIN_LEVEL`
0.25, which is the line between a sound someone made and a sound the
room made, and suppressed feeding entirely while a note is held, since
the call and the heat are trying to say something else with that same
stretch of audio. Pellet gap 1.0s to 1.5s.

**Bubbles cut hard.** Ambient rate 0.7/s to 0.12/s (one every eight
seconds), the loudness multiplier 6 to 1.2, onset bursts from 2-10 down
to 1-3, the mimicry echo from two bubbles to one, and the ceiling from
60 to 12. They were the busiest thing on screen and a scatter or a
gather could not be read through them.

**Also trimmed distant traffic 7 to 4** — not asked for, same reasoning,
easy to put back in `createTank`.

**Nerve spread made count-proof.** The even deal was `(i + 0.5) /
FISH_COUNT`, which at five fish put the lowest at 0.10 with jitter that
could carry it past the 0.12 deadpan cutoff — no deadpan fish, silently,
on some seeds. Now spread over a fixed [0.05, 0.95] by index, so the
guarantee holds at any `FISH_COUNT`.

Smoke test 50 checks, including that room noise does not feed, a held
note suppresses feeding, and bubbles still happen but stay sparse.

### 2026-08-06 — Claude Code — smaller shoal, honest placement

Cy confirmed pellets are visible now. Four changes from watching it run.

**Shoal cut 18 to 10** (`FISH_COUNT`, exported so the smoke test tracks
it). Pellet rate limit 0.5s to 1.0s.

**Pitch placement dropped for onset-triggered things.** Pellets piled
against the right-hand edge, and the cause is structural rather than a
tuning miss: an onset *is* a transient, transients are broadband, so
sampling brightness at the attack measures the click and not the voice.
It reads high nearly every time. Pellets and onset bubble bursts now
land at random x. The call target and the heat zone still place by
pitch, because those measure a sustained tone — that distinction is the
useful part of the finding and is written up above.

**Nerve is now dealt evenly across the shoal** rather than drawn
uniformly. At ten fish a random draw produced four that ignore
everything, which makes a scare land as a shrug. An even spread
guarantees one deadpan fish, one hair-trigger, and a graded middle at
any `FISH_COUNT`.

**`interest` split from `summon`.** Cy: pellets should hold existing
fish, not summon new ones — the sustain should do the summoning. They
were the same signal, so food refilled an empty window. Now `interest`
is the leash on fish in frame and `summon` gates returns, and only
sustained sound raises it.

**Fixed: the crab was usually never seen.** It entered at the frame edge
and its idle change-of-mind could fire within the first second, turning
it straight back out. Reversals are now gated to the middle of the
frame. Caught by the smoke test failing intermittently across seeds —
worth noting that a flaky check was pointing at a real bug rather than
at test noise.

Smoke test now 48 checks, including that food alone summons nobody.

**Still not verified visually beyond the pellets.**

### 2026-08-06 — Claude Code — marine window

Reframed from enclosed aquarium to a window on open sea, and fixed the
pellets, which Cy could not see.

**The pellet bug had three causes stacked**, found by stepping the sim
rather than by reasoning about it:

```
t+0.00s  row=1  glowCellsOnScreen=0     ← spawned on the row the surface overpaints
t+0.33s  row=2  glowCellsOnScreen=1
t+0.66s  pellets=0                      ← eaten half a second after spawning
```

and the one frame it was visible, it was a dim `.` sharing a cell
cluster with the five bubbles the same onset spawned. Total visible life
was about one frame at 30fps. Fixed all three: spawns at y 0.16 instead
of 0.06, draws as `*` at fish depth rather than `.` behind them,
attraction cut 1.4 to 0.5 and eat radius 0.03 to 0.02 so the approach
takes a second and a half, food rate-limited to one per 0.5s, and eating
now spawns a bubble so the chomp is visible. Measured visible life is
now 2.97s of a 3s window.

**Open sea.** Removed the horizontal walls. Added `tank.interest`, fish
`presence`/`returnAt`, and distant background traffic that never reacts
and never leaves, so an empty window is still not a dead rectangle.

**Heat.** `held + loud` now spreads colour as well as inflating. Two new
palette slots per bank (TINT1 amber, TINT2 coral).

**Fixed, twice, both found by the smoke test:** the second colour stage
was unreachable. Ranking candidates by tint means there is always a
cooler fish to reach for, so colour spread forever and never deepened —
`TINT2` was defined and could never appear on screen. Confining heat to
a zone around the pitch was not enough on its own; the fix was weighting
distance far above tint, so the fish sitting at the pitch saturates and
drops out of the running, and the next one out takes it. A held note now
makes a hot core with a warm fringe.

**Smoke test** now 45 checks. New coverage: the window empties in long
quiet, fish return on noise, returning fish keep their boldness, a
pellet starts below the waterline and stays visible for seconds, and a
long hold reaches the second colour stage.

**Still not verified visually.** No frame has been displayed at any
point. Everything above is measured behaviour, not appearance.

### 2026-08-06 — Claude Code — playful ecosystem

Stocked the tank. Direction from Cy: playful and zany, explicitly not a
tamagotchi, nothing that feels fragile or needs upkeep. That produced
the rule above, which in turn cut hunger, decay, and every mechanic that
could be lost.

**Added:** `src/engine/fish.ts` — boids-lite (separation, weak cohesion,
wander, bounds) with three sound meanings, startle overshoot into a
frozen stare, the inflation gag, pellets. `nerve` fixed at spawn,
`boldness` monotonically rising. Crab, mimicry echo, and the silence
ladder in `scene.ts`. `features.bright` — log-remapped centroid, because
raw centroid crushed all speech into the left fifth of the tank. Three
full palette banks (day/dusk/night) instead of one recoloured bank, so a
mood shift is an index offset rather than an atlas rebuild.

**Added a headless smoke test** (`npm run smoke`). The engine touches no
DOM, so the whole simulation steps outside a browser. This matters
because the tank is watched rather than asserted on — a fish stuck at
NaN or parked off-grid reads as "nothing happened" on screen and is
obvious in a loop. 30 checks, all passing: bounds and finiteness through
a scare, staggered reactions, the deadpan fish sitting one out, pellets
not piling up, puff deflating unaided, boldness never falling, the mood
ladder, and no fish ever lost.

**Fixed:** `f.freeze` was decremented without a floor, so it settled at
small negative values instead of zero. Harmless to the picture — the
`> 0` guard still worked — but it left fish in a state that never
compared equal to "recovered", which is the kind of thing that turns
into a real bug the moment something else reads that field. Found by the
smoke test, not by looking.

**Tuned:** `boldness` gain 0.05/s to 0.02/s. At the old rate a called
fish saturated in 20 seconds, which made familiarity a stopwatch rather
than something that accrues across a session.

**Still not verified visually.** No frame of this has been displayed at
any point. The simulation is now well exercised and the render path is
not: the smoke test proves the fish move sensibly and the grid gets
painted, and says nothing about whether any of it *looks* like an
aquarium. Sprite legibility at 20x30, whether 18 fish reads as a school
or as soup, whether the startle overshoot is funny or just twitchy —
all open.

### 2026-08-06 — Claude Code — scaffold

Scaffolded the project and built the vertical slice through to a moving,
sound-reactive scene.

**Added:** Vite 6 + React 19 + TS + Tailwind v4 + vite-plugin-pwa config;
character grid with painter's z-test; glyph atlas; dirty-cell blitter;
audio graph with separate mic and output analysers; per-frame feature
extraction; utterance-level VAD; three-button + encoder input mapping
with rotation speed recovered from event timing; boot gesture gate; 2Hz
snapshot bridge; water/kelp/bubble/surface scene; dependency-free PNG
icon generator; Pi kiosk script and systemd unit adapted from
`iris-vibecoded`.

**Changed during the session:** a refused microphone used to block boot.
It no longer does — `initAudio()` returns a rig with `mic: null` and the
tank runs deaf, showing a corner note. A screensaver has to be watchable
in silence anyway, so refusing to start without a microphone was wrong.

**Verified:** clean `tsc -b` and `vite build`; the built output loads,
registers its service worker, and reaches the boot screen; the C-key
gesture wakes it; the microphone-denied path degrades as intended and
the canvas is sized correctly (backing store 1020x600, CSS 1020x600) on
a 1024x600 viewport; the glyph path renders ink for `~ o | ( _` and none
for space, with a measured advance of 16.49 px inside the 20 px cell.

**Not verified — no frame has ever been displayed.** The browser pane
used for testing runs hidden, so `document.visibilityState` is
`'hidden'` and `requestAnimationFrame` never fires. Zero frames ran; the
canvas was still blank when inspected. Nothing about the scene's
appearance, the blitter's output, or the framerate has been observed.
The first person to actually look at this will be seeing it for the
first time. Run `npm run dev` and watch it before trusting anything
visual here.

Also unverified: anything on the real hardware. Framerate at 51x20 on a
Pi 4B is a projection. The panel's active dimensions are inferred from a
hand measurement. The kiosk script and systemd unit have not been run.
Microphone thresholds are `iris-vibecoded`'s values, not re-tuned for
this enclosure.

**One measurement worth carrying:** the 16.49 px advance above came from
Consolas resolving on Windows (ratio 0.55). The Pi will resolve DejaVu
Sans Mono (ratio ~0.602), giving an ~18.1 px advance and a tighter 2 px
gap in the 20 px cell. Cell height is the binding constraint at this
aspect either way, so `FONT_RATIO` 1.0 holds — but the horizontal gap
between glyphs will look different on the two machines, and the Pi is
the one that counts.

**Undone, in order:**

1. Push to the Pi and measure. Framerate and blitted-cell count are on
   screen already; `r` toggles that bar. This decides whether 51x20
   stands or drops to 40x15.
2. Fish. `Fish` is declared in `tank.ts` and the array stays empty.
   Boids-lite: separation, cohesion, wander, plus an audio force.
   15-25 fish at this grid size; more turns the tank to soup.
3. Synthesis out. Oscillator bubbles and plinks through the existing
   output gain, modelled on `iris-shared.js`'s beep engine. No samples.
4. Feedback ducking. The speaker will feed the microphone. The output
   analyser exists for exactly this: duck the mic threshold by our own
   known output level rather than using a fixed number.
   `iris-vibecoded` needed a ~7x gap between its idle threshold (0.012)
   and its speaking threshold (0.08) on this hardware — that is the
   starting figure.
5. Menu on the encoder, once there is anything worth selecting.

Session-only persistence is deliberate; `tank` is a plain serializable
tree with no class instances or back-pointers, so adding storage later
is `JSON.stringify(tank)` and nothing else.
