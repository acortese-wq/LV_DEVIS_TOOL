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
Reine Oberflächenänderungen: Build + betroffene Tests, z. B. `node tests/run.js t64 --no-skill`.

## Tests (siehe tests/README.md)
- Einmalig: `npm ci --omit=optional --prefix tests` (Leaflet, axe-core, pdf.js in festen Versionen). Alles Weitere liegt im Repo (`tests/lib/k.js`, `tests/fixtures/`).
- Alle Tests: `node tests/run.js` (Browser-Tests, ui_qa mit axe, Skill-Vergleich); Teilmengen: `node tests/run.js t50 t64`, `--from=60`, `--no-ui`, `--no-skill`.
- Neue Tests als `tests/tNN.js` mit `require('./lib/k.js')`; keine Pfade ausserhalb des Repos verwenden.

## Qualitätsregeln
- Barrierefreiheit: axe-core ohne Verstösse, Kontrast ≥ 4.5:1, Tastatur bedienbar, Handy (390 px) ohne Seitenüberlauf.
- Eingaben sind Text; Zahlen wie «1'200» werden markiert.
- Änderungen mit Kostenwirkung dem Benutzer klar melden. Vorher/Nachher-Liste: `docs/UX-Audit_2026-10.md`.
- Branch: `claude/dreamy-cray-x10m0g` (Hauptstand, Standard-Branch), kein Pull Request ohne Auftrag.
- Vorhaben Layout A: Branch `layout-a` (vom Benutzer freigegeben am 05.11.2026), siehe unten.

## Veröffentlichung
Artefakt-URL (immer dieselbe aktualisieren): https://claude.ai/artifact/F2BDoDDnQFxmsbmzGnwKxx

## Vorhaben Layout A (Branch `layout-a`)
Vom Benutzer am 05.11.2026 festgelegt (Masterprompt «Four Live Layouts», Referenzgrafik A–D):
- **Umfang:** nur Layout A «Planungsfokus» – Karte als Startbildschirm; oben Projekt, Gemeinde, Status, Kennzahlen (Länge, Aushub, Schächte, Kosten exkl./inkl. MWST); links Werkzeuge in Gruppen; rechts kontextabhängige Eigenschaften; unten Reiter Höhenprofil, Ausmass, Kosten, Positionen, Hinweise. Datensätze, Ergebnis und Bericht bleiben als Panels erreichbar. Layout-Umschalter nur vorbereiten (B–D folgen später).
- **Technik:** bestehende Technik behalten (Vanilla-JS, Leaflet, Einzeldatei), keine Migration. Rechenkern unverändert; Kosten vor/nach identisch.
- **Arbeitsweise:** kurze Bestandsaufnahme, nötige Teile des Designsystems, dann Umbau; nach jedem grösseren Schritt Tests (`node tests/run.js`), Commit/Push auf `layout-a`.
- **Veröffentlichung:** separates Vorschau-Artefakt (nicht die Haupt-Artefakt-URL); `claude/dreamy-cray-x10m0g`, GitHub Pages und Haupt-Artefakt bleiben unverändert. Am Schluss Pull Request von `layout-a` nach `claude/dreamy-cray-x10m0g`.
- **Stand:** umgesetzt (siehe `docs/LAYOUT_A.md`), Test `t65`. Einstellung `lvd-layout` (`a`/`classic`); die Testhilfe `tests/lib/k.js` belegt `classic` vor, damit ältere Tests auf der klassischen Seite starten.
- **Offen:** Layout B – Reserve/Zuschläge (nicht Teil von Layout A).
