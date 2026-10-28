# LV-Devis Tiefbau

Einzeldatei-HTML-Tool für Kostenvoranschläge Swisscom-Tiefbau nach «LV Swisscom Infrastrukturarbeiten bei Baukooperationen V1.1 (10.07.2026)».
App-Konzept und Urheber: **Alessandro Cortese** (immer nennen). Sprache mit dem Benutzer: Deutsch. Bestehende Struktur, Farbwelt (Swisscom-Look) und Sprache respektieren.

## Aufbau
- `src/` ist die Quelle, `index.html` wird daraus gebaut: `python3 build.py` (nach jeder Änderung in `src/`).
- `src/kve.js` Rechenkern (deterministisch, keine Preise schätzen), `src/model.js` Datensätze/Honorar, `src/app.js` Oberfläche, `src/fig.js` SVG-Grafiken, `src/app.css` + `src/kv.css` Gestaltung.
- Texte DE/FR/IT/EN: `src/i18n_app.js` (neue Keys immer in allen 4 Sprachen), `src/i18n_kv.js`.
- LV-Daten: `src/data/lv.js` (generiert, 599 Positionen). Zustand: `localStorage`, Sicherung als JSON.
- Skill für Claude-KI: `skill/lv-devis-tiefbau/` (Python-Portierung des Rechenkerns, `scripts/kve.py`). Neu erzeugen: `node tools/build_skill.mjs`.

## Pflicht bei jeder Änderung am Rechenkern
Rechenlogik gilt zweimal: `src/kve.js` **und** `skill/lv-devis-tiefbau/scripts/kve.py` (identisch halten). Danach:
1. `python3 build.py && node tools/build_skill.mjs`
2. `sh tests/skill_test.sh` – muss «0 Abweichungen» zeigen (300 Zufallsprojekte, Skill gegen HTML-Tool).
Reine Oberflächenänderungen: Build + `AXE=… node tests/ui_qa.js` (Playwright: `/opt/node22/lib/node_modules/playwright`).

## Qualitätsregeln
- Barrierefreiheit: axe-core ohne Verstösse, Kontrast ≥ 4.5:1, Tastatur bedienbar, Handy (390 px) ohne Seitenüberlauf.
- Eingaben sind Text; Zahlen wie «1'200» werden markiert.
- Änderungen mit Kostenwirkung dem Benutzer klar melden. Vorher/Nachher-Liste: `docs/UX-Audit_2026-10.md`.
- Branch: `claude/dreamy-cray-x10m0g`, kein Pull Request ohne Auftrag.

## Veröffentlichung
Artefakt-URL (immer dieselbe aktualisieren): https://claude.ai/artifact/F2BDoDDnQFxmsbmzGnwKxx
