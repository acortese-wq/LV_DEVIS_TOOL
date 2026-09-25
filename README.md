# LV-Devis Tiefbau – Swisscom

Einzeldatei-Tool (`index.html`) für Kostenvoranschläge Tiefbau nach **LV Swisscom Infrastrukturarbeiten bei Baukooperationen (V1.1, 10.07.2026)**.
App-Konzept, Struktur und fachliche Ausgestaltung: **Alessandro Cortese**.

Zusammengeführt aus drei Werkzeugen:

| Herkunft | Was übernommen wurde |
|---|---|
| LV-Erfassung (Access-Maske) | Reiter Graben, Rohr, Schacht, Werkloch, Fundamente, Geb. Einführung, Belag (Typ A–C2), Allgemein, Ingenieurhonorar (KBOB); Datensätze je Reiter; Illustrationen; weitere LV-Positionen je Reiter |
| KV-Assistent Tiefbau | Kartendesign, Rechenkern (OFFEN-Logik, Rechenweg ƒ, Massenbilanz, Vollständigkeit, Sensitivität), Belagmodell, Excel-Export, individuelle Positionen, 4 Sprachen |
| Auswahl Schachtbau und Abdeckungen | Einbauort/Schachttyp-Bewertung, Abdeckung (liefern **und** versetzen), Stückliste mit Gewichten und HGC-Links, Massenauszug, Sonderfreigabe, Normplan- und Produktzeichnungen, Abdeckungsersatz, Zusatzpositionen |

## Aufbau

```
src/shell.html        HTML-Gerüst (Plankopf, Reiter, Spalten)
src/kv.css, app.css   Design KV-Assistent + Ergänzungen
src/kve.js            Rechenkern (alle Reiter)
src/app.js            Oberfläche
src/fig.js            Illustrationen (SVG)
src/i18n_*.js         Texte DE/FR/IT/EN
src/schacht_*.js      Daten und Texte der Schachtauswahl
src/data/lv.js        LV DE V1.1 + FR-Positionstexte (erzeugt durch tools/build_lv.py)
tools/                LV-Aufbereitung (FR-PDF-Parser, Korrekturen)
build.py              erzeugt index.html
```

Nach Änderungen in `src/`: `python3 build.py`.

## LV-Daten

- DE: V1.1 (Datensatz KV-Assistent), 599 Positionen. Korrekturen siehe `tools/build_lv.py`
  (151/632.130 → 632.133 + 632.233; Kontext 632.1xx = liefern, 632.2xx = versetzen).
- FR: LV FR TB Kopa 2026 (V1.0, 27.06.2026), 579 Positionstexte zugeordnet.
- IT: LV IT TB Kopa 2026 (V1.0, 27.06.2026), 581 Positionstexte (`tools/lv_it_data.py`); Preise identisch mit DE V1.1.
- Preisabweichung DE ↔ FR: 151/224.301 (108.95 ↔ 108.75); IT bestätigt 108.95.
