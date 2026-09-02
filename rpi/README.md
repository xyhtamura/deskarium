# Deskarium on the Raspberry Pi 4B

Target panel: 1024x600, ~95 x 56 mm of active glass.

Nothing here talks to the network. The Pi may have internet, but the app
never needs it — the whole point of this setup is that it runs with the
cable out.

## 1. Get the built files onto the Pi

The Pi never runs a build. Build on the workstation and commit `dist/`,
then on the Pi:

```bash
git clone <repo> ~/deskarium
```

## 2a. Or just point Chromium at GitHub Pages

`https://xyhtamura.github.io/deskarium/dist/rpi/` serves the committed
build directly, because `dist/` is in the repository. HTTPS is a secure
context, so the microphone works, and the service worker caches the page
after the first load.

The trade against the localhost route below: the Pi needs the network to
load it the first time, and a push changes what the panel runs. Pages
serves the repository root here rather than the Actions artifact, which
is why `dist/` appears in the URL.

## 2. Serve it from localhost

The microphone, the service worker, and PWA install all require a secure
context. `localhost` counts; a LAN IP does not. So the files are served
locally and the browser never leaves the machine.

```bash
sudo cp ~/deskarium/rpi/deskarium-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now deskarium-server
```

Check `http://localhost:8080/rpi/` loads in a normal Chromium window
first. That is the panel's own page — upside-down and pinned to the day
bank, built from `rpi/index.html`. `http://localhost:8080/` serves the
ordinary upright build, which is useful for telling a mounting problem
apart from a software one.

Note: this unit binds to `127.0.0.1` deliberately, unlike the workstation's
root server. Nothing off-device should reach it, and the kiosk browser is
on the same machine.

## 3. Install the PWA

In Chromium on the Pi, open `http://localhost:8080/rpi/`, then menu →
**Install Deskarium**. That writes a desktop entry containing the app-id,
which the kiosk script discovers automatically.

Once installed with the service worker registered, the app survives the
server being stopped — navigation goes through the worker and hits cache.
The systemd unit stays anyway so that updates and reinstalls stay simple;
the cache is redundancy, not the mechanism.

## 4. Kiosk on boot

```bash
cp ~/deskarium/rpi/deskarium-kiosk.sh ~/deskarium-kiosk.sh
chmod +x ~/deskarium-kiosk.sh
```

Then add it to the desktop autostart, e.g.
`~/.config/autostart/deskarium.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Deskarium
Exec=/home/pi/deskarium-kiosk.sh
X-GNOME-Autostart-enabled=true
```

`sudo apt install unclutter` hides the mouse cursor.

Stop it over SSH: `pkill -f deskarium-kiosk.sh ; pkill chromium`

## Control surface

| Panel control  | Key event    | Bound to             |
| -------------- | ------------ | -------------------- |
| L button       | `ArrowLeft`  | reserved (menu back) |
| C button       | `Space`      | wake / primary verb  |
| R button       | `ArrowRight` | cycle palette: auto / dawn / day / dusk / night |
| Encoder CCW    | `ArrowUp`    | reserved (scroll up) |
| Encoder press  | `Enter`      | reserved (select)    |
| Encoder CW     | `ArrowDown`  | reserved (scroll dn) |

The encoder emits discrete key events, not an absolute position. Rotation
speed is recovered from the gap between events — see `src/input/keys.ts`.

With a keyboard attached during development: `d` toggles the DOM overlay,
`r` toggles the in-grid readout bar.

## Updating

1. Build on the workstation, commit `dist/`.
2. On the Pi: `git -C ~/deskarium pull`
3. The service worker is `registerType: 'autoUpdate'`, so the next launch
   picks it up. If it looks stale, quit the kiosk and relaunch.
