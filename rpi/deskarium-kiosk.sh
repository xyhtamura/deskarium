#!/usr/bin/env bash
# =====================================================================
# deskarium-kiosk.sh — launch Deskarium fullscreen on boot
# ---------------------------------------------------------------------
# Adapted from iris-vibecoded/iris-kiosk.sh. Two differences:
#   * no network wait — Deskarium makes no remote calls
#   * screen blanking is disabled, which matters more here because the
#     whole point is a picture that sits on the desk untouched
#
# Install:
#   1. cp rpi/deskarium-kiosk.sh ~/deskarium-kiosk.sh
#   2. chmod +x ~/deskarium-kiosk.sh
#   3. Install the PWA once from Chromium (see rpi/README.md), or set
#      DESK_URL below and it will fall back to --app=URL
#   4. Add to autostart (see rpi/README.md)
#
# Stop it over SSH:  pkill -f deskarium-kiosk.sh ; pkill chromium
# =====================================================================
set -u

LOG="/tmp/deskarium-kiosk.log"
exec >>"$LOG" 2>&1
echo "=================================================="
echo "deskarium-kiosk starting: $(date)"

# Fallback URL, used only when the installed PWA is not found.
DESK_URL="http://localhost:8080/upside-down-light.html"

# --- 1. find chromium -------------------------------------------------
CHROME="$(command -v chromium-browser || command -v chromium || true)"
if [ -z "$CHROME" ]; then
  echo "ERROR: chromium not found"; exit 1
fi
echo "chromium: $CHROME"

# --- 2. wait for the local server to answer --------------------------
# The service worker would serve from cache anyway, but starting against
# a live server keeps updates and a first install straightforward.
for i in $(seq 1 20); do
  if curl -fsS -o /dev/null "$DESK_URL" 2>/dev/null; then
    echo "local server ready after ${i}s"; break
  fi
  sleep 1
done

# --- 3. locate the installed PWA -------------------------------------
APP_ID=""
for f in "$HOME/.local/share/applications"/chrome-*-Default.desktop; do
  [ -e "$f" ] || continue
  if grep -q '^Name=Deskarium' "$f"; then
    b="$(basename "$f")"            # chrome-<id>-Default.desktop
    b="${b#chrome-}"
    APP_ID="${b%-Default.desktop}"
    echo "found installed PWA: $f  (app-id=$APP_ID)"
    break
  fi
done

# --- 4. clear Chromium's "didn't shut down cleanly" bubble -----------
PREFS="$HOME/.config/chromium/Default/Preferences"
if [ -f "$PREFS" ]; then
  sed -i 's/"exited_cleanly":false/"exited_cleanly":true/' "$PREFS" 2>/dev/null
  sed -i 's/"exit_type":"[^"]*"/"exit_type":"Normal"/'     "$PREFS" 2>/dev/null
fi

# --- 5. stop screen blanking (X11; no-op on Wayland) -----------------
xset s off       2>/dev/null
xset -dpms       2>/dev/null
xset s noblank   2>/dev/null

# --- 6. launch flags -------------------------------------------------
FLAGS=(
  --profile-directory=Default
  --kiosk
  --no-first-run
  --ozone-platform-hint=auto
  --password-store=basic                     # skip the keyring unlock prompt
  --use-fake-ui-for-media-stream             # auto-grant the microphone
  --autoplay-policy=no-user-gesture-required
  --noerrdialogs
  --disable-infobars
  --disable-session-crashed-bubble
  --disable-features=Translate
  --check-for-update-interval=604800
)

# --- 7. launch, relaunch if it exits ---------------------------------
while true; do
  if [ -n "$APP_ID" ]; then
    echo "launching installed PWA by app-id"
    "$CHROME" "${FLAGS[@]}" --app-id="$APP_ID"
  else
    echo "PWA not found for this user — falling back to --app=URL"
    "$CHROME" "${FLAGS[@]}" --app="$DESK_URL"
  fi
  echo "chromium exited at $(date) — restarting in 3s"
  sleep 3
done
