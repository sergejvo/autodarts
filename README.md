# Autodarts Kiosk

Electron-Shell, die den Autodarts Board-Manager (`http://localhost:3180`) und die Spielseite
(`https://autodarts.com/play`) in einem Fenster vereint – plus Custom Aktionen bei bestimmten Würfen.

## Start

    npm install
    npm start          # Fenster
    npm run kiosk      # Vollbild

Tasten: F1 Spiel · F2 Board · F3 Split · F4 Aktionen · F5 Neu laden · F11 Vollbild · Ctrl+Q Beenden

## Custom Aktionen

Unter „Aktionen“ lassen sich Regeln anlegen: Trigger (Einzelwurf `T20`/`D*`/`BULL`/`MISS`,
Aufnahme-Summe `180`, Bust, Aufnahme-Ende) → Aktionen (Sound, Sprachausgabe, Overlay, HTTP-Aufruf
z. B. für WLED/Home Assistant). Konfiguration liegt in `config.json` im Electron-userData-Ordner.

## Wichtig: Wurf-Erkennung verifizieren

Das WebSocket-Format von Autodarts ist nicht offiziell dokumentiert. `src/detector.js` parst tolerant
(`turn.throws[].segment.{number,multiplier}`). Mit „Debug-Log“ in den Einstellungen werden rohe
Nachrichten nach `ws-debug.log` geschrieben – damit die Heuristik an das echte Format anpassen.
Die „Live-Events“-Liste in den Einstellungen zeigt, was erkannt wurde.

## Linux

Sprachausgabe nutzt `spd-say` (speech-dispatcher) bzw. `espeak-ng`. Autostart z. B. per systemd-User-Unit
oder Desktop-Autostart mit `npm run kiosk`.

## Autostart (Linux)

Voraussetzung: Node.js ≥ 20, `curl`, optional `xset` (X11). Autologin des Kiosk-Benutzers im Display-Manager einrichten.

    ./deploy/install-autostart.sh

Das legt `~/.config/autostart/autodarts-kiosk.desktop` an. `deploy/autodarts-kiosk.sh` wartet bis der
Board-Manager auf Port 3180 antwortet, deaktiviert Bildschirmschoner/DPMS (X11) und startet die App im
Kiosk-Modus neu, falls sie abstürzt. Alternativ: systemd-User-Unit `deploy/autodarts-kiosk.service`
(Anleitung im Dateikopf).

Hinweise:
- Wenn Electron meldet, dass der SUID-Sandbox-Helper fehlt: `sudo chown root node_modules/electron/dist/chrome-sandbox && sudo chmod 4755 node_modules/electron/dist/chrome-sandbox`.
- Wayland: Bildschirmschoner im Desktop (z. B. GNOME: Einstellungen → Energie) abschalten; `xset` wirkt dort nicht.
- Mauszeiger ausblenden bei Touch-Betrieb: `unclutter`.
- Beenden im Kiosk: Ctrl+Q oder ✕ in der Toolbar. Das beendet die App sauber (Exit-Code 0) und das Skript startet sie nicht neu; nur bei einem Absturz wird neu gestartet.
