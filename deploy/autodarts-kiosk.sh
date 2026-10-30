#!/usr/bin/env bash
# Startskript für den Kiosk. Wird von Autostart/systemd aufgerufen.
set -u
APP_DIR="$(cd "$(dirname "$(readlink -f "$0")")/.." && pwd)"

# Bildschirm nie abdunkeln (nur X11; unter Wayland siehe README)
if [ -n "${DISPLAY:-}" ] && command -v xset >/dev/null; then
  xset s off; xset -dpms; xset s noblank
fi

# Auf Board-Manager warten (max. 60 s), damit die Seite sofort lädt
for _ in $(seq 1 60); do
  curl -fs -o /dev/null --max-time 1 http://localhost:3180 && break
  sleep 1
done

cd "$APP_DIR"
EXTRA=()
# Unter Wayland native Ozone-Plattform nutzen
[ "${XDG_SESSION_TYPE:-}" = "wayland" ] && EXTRA+=(--ozone-platform-hint=auto)
# Bei Absturz neu starten (sauberes Beenden mit Exit-Code 0 beendet auch die Schleife)
while true; do
  ./node_modules/.bin/electron . --kiosk ${EXTRA[@]+"${EXTRA[@]}"} && break
  sleep 2
done
