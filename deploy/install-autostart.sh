#!/usr/bin/env bash
# Installiert Desktop-Autostart für den aktuellen Benutzer.
set -euo pipefail
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
[ -d node_modules ] || npm install

mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/autodarts-kiosk.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Autodarts Kiosk
Exec=$APP_DIR/deploy/autodarts-kiosk.sh
X-GNOME-Autostart-enabled=true
DESKTOP
echo "Autostart installiert: ~/.config/autostart/autodarts-kiosk.desktop"

# Mauszeiger ausblenden (optional): sudo apt install unclutter && unclutter -idle 3 &
echo "Fertig. Beim nächsten Login startet der Kiosk automatisch."
