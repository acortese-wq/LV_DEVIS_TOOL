# Tests – LV-Devis Tiefbau

Alles, was die Tests brauchen, liegt im Repo oder wird in festen Versionen über npm geholt.

## Einmalig vorbereiten
```sh
npm ci --omit=optional --prefix tests     # Leaflet 1.9.4, axe-core 4.10.2, pdf.js 3.11.174 (tests/node_modules, nicht im Git)
```
Playwright mit Chromium muss vorhanden sein (global `playwright`; sonst `npm i -g playwright && npx playwright install chromium`
oder `PW=/pfad/zu/playwright` setzen).

## Ausführen (im Repo-Ordner, nach `python3 build.py`)
```sh
node tests/run.js                  # alle Browser-Tests (t*.js, abdeckung), UI-Qualität mit axe (ui_qa) und Skill-Vergleich
node tests/run.js t50 t64          # nur diese
node tests/run.js --from=60        # ab t60
node tests/run.js --no-ui --no-skill
sh tests/skill_test.sh             # nur Rechenkern-Vergleich Skill (Python) gegen HTML-Tool, muss «0 Abweichungen» zeigen
```
Protokolle je Test: `<Temp>/lvd-tests/logs/<test>.log`. Rückgabewert ≠ 0, wenn ein Test fehlschlägt.

## Aufbau
- `tests/lib/k.js` – gemeinsame Hilfe: startet die Seite (`index.html` im Repo, oder `LVD_URL`), liefert Leaflet lokal aus
  (keine Internetabhängigkeit), sperrt geo.admin-Abfragen (leere Antworten), `ok()`, `getS()`, `openMid()` (Ebenen-Fenster), `tmp()`.
- `tests/fixtures/` – Testdaten (Plan-PNG, PDFs für die automatische Ausrichtung).
- `t48.js` prüft die Weitergabe-Version nur mit `LVD_RELEASE=1 LVD_URL=file:///…/dist/<datei>.html`.
- Externe Dienste (Höhenprofil, Route, Adresssuche) werden in den Tests simuliert – ein Live-Test im echten Browser bleibt nötig.
