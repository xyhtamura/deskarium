# Catchment on the Raspberry Pi

Target panel: 1024×600, driven by three buttons and a rotary encoder. Same
hardware as [deskarium](../../rpi/README.md), and the key map is
deskarium's unchanged, so a panel already set up for that runs this with no
rewiring.

Nothing here talks to the network after the first load.

## 1. Get the files onto the Pi

Catchment is static — no build, no bundler, no package install, and it is not
part of Deskarium's Vite build. It lives inside Deskarium's repository, so a Pi
already set up for Deskarium already has it:

```bash
git -C ~/deskarium pull
```

On a fresh Pi:

```bash
git clone https://github.com/xyhtamura/deskarium.git ~/deskarium
```

## 2. Serve it from localhost

No part of the game needs a secure context — there is no microphone, no service
worker and no storage — so `file://` would nearly work. It does not, because the
page loads ES modules, and module scripts are blocked on `file://` by the
browser's origin rules. Any static server fixes it:

```bash
python3 -m http.server 8080 --directory ~/deskarium
```

Then open `http://localhost:8080/catchment/rpi/`. That is the panel's own page:
upside-down, and inset further than the web pages.
`http://localhost:8080/catchment/` serves the ordinary upright build, which is
how to tell a mounting problem apart from a software one.

It is also on the web at `https://xyhtamura.github.io/deskarium/catchment/rpi/`,
because Pages serves the repository root. That needs the network on first load
and there is no service worker to cache it, so the localhost route above is the
one that runs with the cable out.

To have it come up on boot, adapt deskarium's
[`deskarium-server.service`](../../rpi/deskarium-server.service) — the
unit does the same job and only the paths change.

## 3. Kiosk on boot

Launch Chromium at that URL with `--kiosk --noerrdialogs
--disable-infobars --check-for-update-interval=31536000`, from the desktop
autostart, the same way deskarium's
[`deskarium-kiosk.sh`](../../rpi/deskarium-kiosk.sh) does it.
`sudo apt install unclutter` hides the mouse cursor.

## The inset

The casing covers a few millimetres of the outer glass, so nothing is drawn in
the outer margin and a hairline frame marks where it runs. The panel page starts
at 28 px, set as `data-bezel` on the `<html>` element in
[`index.html`](index.html).

Dial it in against the real enclosure by adding `?bezel=` to the URL — the query
parameter wins over the attribute, so
`http://localhost:8080/catchment/rpi/?bezel=34` shows that margin immediately. When one
looks right, put the number in `index.html` and drop the parameter. Values from
0 to 80 are accepted; anything else falls back to the default.

## Control surface

| Panel control | Key event    | Does                                    |
| ------------- | ------------ | --------------------------------------- |
| L button      | `ArrowLeft`  | cycle the aperture's charge: −1, 0, +1  |
| C button      | `Space`      | flip the aperture's parity: + / −        |
| R button      | `ArrowRight` | cycle the aperture's spin: 0, ½, 1       |
| Encoder CCW   | `ArrowUp`    | move the catcher left                    |
| Encoder press | `Enter`      | begin a run; run again after one ends    |
| Encoder CW    | `ArrowDown`  | move the catcher right                   |

The catcher's position is continuous. One step moves it about a twentieth of the
field and a fast spin moves it twice as far, and it glides rather than jumping.
The encoder reports discrete steps rather than an angle, so the gap between
steps is the only speed information there is; see `input.js`.

**The encoder's sense is not inverted in the upside-down variant.** The panel is
mounted upside down and the page is rotated to cancel that, so the viewer sees
an upright screen, and a half turn about the screen normal leaves clockwise
clockwise.

## Updating

Pull, then reload the kiosk. There is no service worker and no cache to
invalidate.
