# NIUcost – Redesign «Engineering-Arbeitsplatz» (Masterprompt vom 06.11.2026)

App-Konzept und Urheber: **Alessandro Cortese**. Dieses Dokument enthält Phase A (Bestandsanalyse), Phase B (Designanalyse) und Phase C (UX-Konzept) sowie den Umsetzungsplan der Phasen D–J. Es ist die Arbeitsgrundlage; jede Phase wird hier nachgeführt.

## 0. Schutz der Fachlogik (vor jeder Änderung)

| Sicherung | Stand |
|---|---|
| **Regressions-Referenz** `tests/fixtures/golden.json` – 64 Projekte (Beispielprojekt DE/FR/IT/EN + 60 Zufallsprojekte), eingefroren am 06.11.2026 vor dem Redesign | erzeugt mit `node tools/make_golden.js` |
| **Test `t78`** vergleicht Netto, Brutto, MWST, Rabatt, Installation, jede Position (Menge, EP, Betrag, Einheit, Flag), Element-Summen, Warnungen, Vollständigkeit, Honorar; dazu Oberfläche = Referenz | grün: 64/64 identisch, 2732 Positionen |
| **Skill-Vergleich** `tests/skill_test.sh` – 300 Zufallsprojekte HTML-Rechenkern ↔ Python-Skill | 0 Abweichungen |
| Gesamtlauf `node tests/run.js` (Browser-Tests, axe, Skill) | 56 Tests grün (vor Redesign) |

Regel für alle Phasen: **Rechenkern (`src/kve.js`, `src/model.js`, `skill/…/kve.py`) wird im Redesign nicht verändert.** `t78` muss nach jeder Phase identisch bleiben; die Referenz wird nie «passend gemacht».

## 1. Phase A – Bestandsanalyse

### 1.1 Architektur
- Einzeldatei-Webapp: `src/*` → `python3 build.py` → `index.html` (~3.3 MB inkl. LV-Daten, Leaflet/pdf.js von CDN). Vanilla-JS, keine Frameworks, keine Build-Kette ausser `build.py`.
- Zustand `S` (localStorage `lvd-state`, JSON-Sicherung v2), Undo-Schnappschüsse, Sync zwischen Tabs.
- Module: `kve.js` Rechenkern (deterministisch) · `model.js` Datensätze/Honorar · `app.js` Seite, Formulare, Ergebnis, Bericht, Excel · `karte.js` Arbeitsfläche (Karte/Plan, Leaflet) inkl. Layout A · `fig.js` Querschnitte/Grafiken · `chat*.js` Assistent (regelbasiert, ohne KI-Tokens) · `help*.js` Anleitung · `i18n_*` DE/FR/IT/EN.

### 1.2 Funktionsübersicht und Zielzone
Legende Zielzone: **T** Topbar · **E** Projektexplorer (links) · **C** Canvas (Mitte) · **P** Eigenschaften (rechts) · **D** Dock (unten) · **K** Kostenleiste · **A** Assistent. Status: ✔ vorhanden · ◐ vorhanden, wird umgebaut · ✚ neu.

| Bereich | Funktion (Quelle) | Zone | Status |
|---|---|---|---|
| Projekt | Projektangaben/Plankopf (Projekt, SAP, Ort, Bearbeiter, Datum, Devis-Nr., Lieferant, Vertrag, Termin, Rolle, Bemerkung) `shell.html #kopfbox` | P (Auswahl «Projekt»), T (Name/Ort) | ◐ |
| Projekt | Neues Projekt `#bNew`, Beispielprojekt `loadDemo` | T | ✔ |
| Projekt | Speichern JSON `#bSave`, Laden `#bLoad` (mit Rückfrage/Undo), Autospeicher + Speicherstatus `#saveState`, Tab-Sync | T | ◐ |
| Projekt | Sprache DE/FR/IT/EN (auch im Planungsfokus) | T | ✔ |
| Projekt | Versionszeile, Ablaufhinweis `#expiry` | T (Info) | ✔ |
| Datensätze | Reiter Graben, Schacht, Belag, Werkloch, Gebäudeeinführung, Allgemein, Annahmen, Plan, Honorar (`renderTabs`, `renderForm`) | E (Baum «Datensätze») + P (Formular) | ◐ |
| Datensätze | Felder mit Einheiten, Zahlprüfung «1'200», Pflichtfelder, Kachelwahl, Zubehör, Rohrblöcke, Abzweiger, weitere LV-Positionen, freie Positionen, eigene Preise OFFEN | P | ✔ |
| Datensätze | Querschnitts-/Schachtgrafiken `fig.js` | P | ✔ |
| Karte | Kartenquellen (Landeskarte farbig/grau, Luftbild, Kataster, leer, eigener WMS/AV), Geokatalog inkl. Schnellauswahl (Mobilfunk, GWR) | E (Layer) + C | ✔ |
| Karte | Werkzeuge: Auswahl/Verschieben, Linie, Schacht, Werkloch, Gebäudeeinführung, Route Adresse/Punkt, Sondage, Belagsfläche, Text, Pfeil, Skizzenlinie, Rechteck, Lineal, Kalibrieren, Undo/Redo, Beenden, Löschen | C (Werkzeugleiste) | ✔ |
| Karte | Fang (Punkt, Linie, rechtwinklig/parallel, 45°), Mehrfachauswahl, Kontextmenü (Rechtsklick/Kontext-Taste), Abzweig, Schacht auf Linie, Tastatur (Pfeile, Entf, Strg+Z/Y/S/A, 1–4 Oberfläche) | C | ✔ |
| Karte | Höhenprofil (folgt aktiver Linie), Schräglänge, Brücke/Bohrung, Profil-Schachtsetzen | D (Reiter Profil) | ✔ |
| Karte | Auswertung: Prüfung nach Handbuch, Vorschläge (Schächte/Werklöcher), DXF-Export | P (Reiter Auswertung) / D (Hinweise) | ✔ |
| Karte | DXF/PDF-Import: DXF-Hintergrund (Layer ein/aus, Farben, Swisscom SIA 405 Klartext, Fang am Bestand, Übernahme als Leitung), PDF-Planunterlage (Zentrumskoordinate automatisch, Passpunkte mit Ausgleich) | E (Layer «Bestand/Unterlagen») + C | ✔ |
| Karte | Street View, map.geo.admin.ch, Swisscom Netzauskunft (Links) | C (Kontext) | ✔ |
| Karte | Übernehmen in Datensätze, Nur Zeichnung sichern, Rückfrage bei nicht übernommenen Änderungen | T (Speichern/Übernehmen) | ✔ |
| Plan | Plan-Reiter (PDF/Bild, Massstab-Kalibrierung, Zeichnen, Übertragen in Karte) | C (Ansicht «Plan») | ✔ |
| Ergebnis | KPI, Kostenblock (Netto, Rabattstufe, Installation, MWST, Brutto), Honorar, Zuschläge, offene Positionen (OFFEN), Warnungen mit Sprung | K + D | ◐ |
| Ergebnis | Positionsliste je Element und Zusammenfassung, **Suche + Statusfilter** `fbarHtml`, **Prüfstatus offen/geprüft/zu klären + Notiz + Zeitstempel** `pruefInit/pstSet`, Top-10-Kostentreiber | D (Reiter Positionen) + P (Position) | ◐ |
| Ergebnis | Annahmen-/Sensitivitätstabelle | D (Reiter Annahmen) | ✔ |
| Ausgabe | Druck kompakt/detailliert/Zusammenfassung, Projektbericht (A4 hoch, Situationskarte, DXF), Excel (Devis, Offertregister mit/ohne Preise inkl. NPK 111/113) | T (Export) | ✔ |
| LV | LV-Browser `#lvBtn/#lvcol` (599 Positionen, DE/FR/IT) | D (Reiter LV) + Befehlsleiste | ◐ |
| Assistent | Regelbasierter Assistent (Wissen, 24 Beratungen, Projektstand, Vorschläge nur mit Bestätigung), DE/FR/IT/EN | A (rechtes Panel als Reiter) | ✔ |
| Hilfe | Anleitung (F1), Schnellstart, Kostenwirkungen | T | ✔ |
| Layout | Layout A «Planungsfokus» (Karte als Start, Projektleiste mit Kennzahlen, Dock 5 Reiter), klassische Ansicht | Basis des neuen Arbeitsplatzes | ◐ |

Keine Funktion entfällt. Die klassische Seite bleibt als «Klassische Ansicht» erreichbar (Rückfallebene, Druck/Bericht).

### 1.3 Bestehende Tastaturbelegung (Konfliktprüfung)
Strg/Cmd+Z, Strg+Y / Strg+Umschalt+Z, Strg+S, Strg+A (Bearbeiten), Esc (abbrechen), Entf/Rücktaste, Pfeile (verschieben, Passpunkte 1 cm), 1–4 (Oberfläche beim Linienzeichnen), F1 (Hilfe), F10/Kontextmenü-Taste, «/» (Suche in der Seite), Enter. **Neu vorgesehen:** Strg+K (Befehlsleiste), Strg+F im Arbeitsplatz → Befehlsleiste/Positionssuche (Browser-Suche bleibt in der klassischen Ansicht), Strg+B Explorer ein/aus, Strg+J Dock ein/aus, Strg+I Eigenschaften ein/aus – kollisionsfrei mit dem Bestand.

### 1.4 Technische Risiken
1. **Grösse von `karte.js` (2'800 Zeilen)** – UI und Logik eng verwoben; Umbau schrittweise, Tests t37–t77 als Netz.
2. **Zwei Token-Sätze in `kv.css` (Zeile 2 und 269) und ein dritter in `app.css`**, teils widersprüchlich (`--navy` = #0a4f55 bzw. #0b6b72; zwei Rot-Töne #b8332a/#c2192b) → zentraler Token-Satz nötig, sonst Farbdrift.
3. **Dunkles Design vs. Druck/Bericht**: Bericht, Excel und Druck bleiben hell (Papier). Dunkel nur am Bildschirm; `@media print` setzt hell zurück.
4. **Karten-/Planinhalte auf dunklem Grund**: swisstopo-Karten sind hell – Canvas bleibt kartenhell, nur die Bedienoberfläche ist dunkel (wie Civil 3D mit hellem Modellbereich wählbar).
5. **Barrierefreiheit**: Original-Petrol als Schrift auf Dunkel nur 2.8:1 → Text-Akzent als hellere Stufe desselben Tons (siehe Phase B).
6. **Mobile**: der Arbeitsplatz startet heute auf dem Handy bewusst klassisch (t65) – eigene mobile Bedienlogik (Bottom Sheets) ist Phase H.
7. **Speicher**: neue UI-Einstellungen (Modus, Panelgrössen) nur in eigenen localStorage-Schlüsseln, nie im Projektzustand `S` → Projekte/Sicherungen bleiben kompatibel.
8. **Deployment**: Live-Seite `acortese-wq.github.io/LV_DEVIS_TOOL` (Repo umbenannt in `LV_DEVIS_TOOL`) ist aus der Arbeitsumgebung nicht erreichbar; welcher Branch GitHub Pages speist, ist zu klären (Phase J). Das Claude-Artefakt wird wie bisher aktualisiert.

## 2. Phase B – Designanalyse

### 2.1 Bestehende Farben (verbindlich)
| Rolle | Wert | Quelle |
|---|---|---|
| Akzent Petrol | `#0b6b72` | Markenfarbe (CLAUDE.md), `kv.css --navy` |
| Petrol dunkel | `#0a4f55` | `app.css --navy`, Logo |
| Logo Türkis | `#00a3ad` / Schrift `#00838c` | NIUcost-Logo |
| Fokus/Link | `#0e7490`, `#0e6a8a` | `--focus`, `--link` |
| Text | `#10202b`, `#1a1c1e` | `--ink` |
| Text sekundär | `#516470`, `#5d6167` | `--ink-soft` |
| Linien | `#c3ced5`, `#8fa1ac`, `#e4e6e9`, `#d3d7dc` | `--rule`, `--rule-strong` |
| Flächen | `#ffffff`, `#eef1f3`, `#f7f9fa`, `#f0f1f3` | `--paper`, `--panel`, `--page` |
| Warnung rot | `#b8332a` (Bg `#fbeceb`), `#c2192b` | `--signal` |
| Hinweis amber | `#8a5b00` (Bg `#fdf4e3`) | `--amber` |
| OK grün | `#1c6446`, `#1c6b3f` (Bg `#e9f3ee`) | `--ok` |
| DXF-Rückfall | `#7b2cbf` | DXF ohne Farbe |

Schrift: Systemschrift (Inter/Segoe/Helvetica-Stack), Radius 10 px, Schatten dezent.

### 2.2 Zentrales Token-System (Phase D)
Ein Satz Rollen-Tokens `--nc-*` in `src/tokens.css` (vor allen anderen Styles), aus dem die bestehenden Variablen (`--navy`, `--ink` …) abgeleitet werden. Zwei Themen mit **denselben Markenfarben**:

| Token | Hell (heute) | Dunkel «Engineering» (aus bestehenden Werten abgeleitet) | Kontrast dunkel |
|---|---|---|---|
| `--nc-bg` (Arbeitsflächenrand) | `#f0f1f3` | `#0d1a23` (Ink abgedunkelt) | – |
| `--nc-surface` (Panels) | `#ffffff` | `#10202b` (= bestehendes `--ink`) | Text 15.7:1 |
| `--nc-panel` (Panel-Kopf, Dock) | `#eef1f3` | `#17303d` (Petrol-Ink) | Text 13.0:1 |
| `--nc-raised` (Eingaben, Kacheln) | `#f7f9fa` | `#1f3b49` | Text 11.2:1 |
| `--nc-text` | `#10202b` | `#f7f9fa` (= bestehendes `--panel-2`) | ≥ 11:1 |
| `--nc-text-soft` | `#516470` | `#c3ced5` (= bestehendes `--rule`) | ≥ 7.4:1 |
| `--nc-muted` | `#8fa1ac` | `#8fa1ac` (bestehend; nur auf surface/panel) | 5.1–6.2:1 |
| `--nc-accent` (Füllung Knopf/Aktiv) | `#0b6b72` | `#0b6b72` (unverändert, Weiss darauf 6.2:1) | – |
| `--nc-accent-text` (Akzent als Schrift) | `#0b6b72` | `#5fb3b9` (hellere Stufe desselben Tons) | 6.8–7.3:1 |
| `--nc-focus` | `#0e7490` | `#67c3d6` (hellere Stufe) | 8.2:1 |
| `--nc-danger` / `-text` | `#b8332a` | Füllung `#b8332a`, Schrift `#f08a80` | 6.8:1 |
| `--nc-warn-text` | `#8a5b00` | `#e8b25a` | 8.7:1 |
| `--nc-ok-text` | `#1c6446` | `#6cc59a` | 8.0:1 |

Änderung nur dort, wo Kontrast < 4.5:1 – dann hellere Stufe desselben Farbtons (Regel des Masterprompts «Kontraste nur wo nötig optimieren»).

## 3. Phase C – UX-Konzept

### 3.1 Fünf-Zonen-Arbeitsplatz (Weiterentwicklung von Layout A)
```
┌ T  Topbar: Logo · Projekt ▾ (Status) · Rückgängig/Wiederherst. · Speichern ● gespeichert · Import ▾ · Export ▾ · [Befehl/Suche  Strg+K] · Modus ▾ · DE FR IT EN · ? ┐
├ E Explorer ┬──────────────── C Canvas (Karte/Plan, Werkzeugleiste kontextabhängig) ────────────────┬ P Eigenschaften │ A Assistent ┤
│ ▸ Projekt  │                                                                                         │ (Auswahl-Kontext)             │
│ ▸ Datensätze (Graben n, Schächte n …)                                                                 │                               │
│ ▸ Zeichnung (Linien, Schächte, Notizen)                                                               │                               │
│ ▸ Layer (Karte, Geokatalog, DXF, Plan) │                                                               │                               │
├────────────┴──────────────── D Dock: Positionen · LV · Kosten · Ausmass · Profil · Hinweise · Annahmen ─┴──────────────── (Höhe ziehbar) ┤
└ K Kostenleiste: Netto · Rabattstufe · Installation · MWST · Brutto · Honorar · ⚠ offen n · Warnungen n ─────────────────────────────── ┘
```
- **Auswahl ist das Zentrum** (AutoCAD-Prinzip): Klick in Explorer, Karte oder Tabelle wählt dasselbe Objekt; P zeigt immer dessen Eigenschaften (Projekt / Datensatz / Linie / Schacht / Position); nichts ausgewählt → Projekt-Übersicht.
- **Explorer** (QGIS/Civil-3D-Prospector): Baum mit Zählern, Suche, Kontextmenü (Umbenennen, Duplizieren, Löschen, Auf Karte zeigen, Zu Position), aktive Hervorhebung.
- **Canvas** bleibt hell (Karte), Bedienelemente dunkel; Werkzeugleiste zeigt im Einfachmodus nur Linie/Schacht/Gebäude/Auswahl.
- **Dock**: Tabellen mit fixiertem Kopf, Sortierung, Filter (Kapitel, Status offen/geprüft/zu klären/«In Prüfung» ✚), Spaltenbreiten, Sprung zur Position/zum Objekt; vorhandener Prüfstatus wird übernommen (Status «In Prüfung» als Erweiterung desselben Feldes `S.pruef`, rückwärtskompatibel).
- **Kostenleiste** immer sichtbar, 1 Zeile; Klick öffnet Dock «Kosten». Kostenänderung nach «Übernehmen» kurz als Delta angezeigt (z. B. «+1'240.50 CHF»).
- **Befehlsleiste (Strg+K)**: durchsucht Werkzeuge, Befehle, Datensätze, Kartenobjekte und LV-Positionen; zeigt nur ausführbare Einträge.

### 3.2 Bedienmodi (gleiche Daten, gleiche Rechnung; Einstellung `lvd-uimode`, nicht im Projekt)
| | Einfach | Standard | Experte |
|---|---|---|---|
| Werkzeuge | Auswahl, Linie, Schacht, Gebäude, Route | + Werkloch, Sondage, Fläche, Beschriften, Messen, DXF/PDF | + Kalibrieren, Passpunkte, Fangoptionen, Mehrfachauswahl-Befehle |
| Explorer | Projekt, Datensätze | + Zeichnung, Layer | + Datenquellen, Geokatalog |
| Eigenschaften | Kernfelder + geführte Hinweise | alle Felder | + technische Details (LV-Nr., Regeln «rule», Zubehör) |
| Dock | Kosten, Hinweise | + Positionen, Ausmass, Profil | + LV, Annahmen, Spalten/Filter erweitert |
| Hilfe | Assistent offen, Schritt-Hinweise | auf Abruf | Tastaturkürzel-Übersicht |

### 3.3 Mobile (Phase H)
Smartphone: Canvas vollflächig, kompakte Topbar (Projekt, Speichern, Menü), Werkzeuge als einblendbare Leiste unten, Eigenschaften/Positionen/Kosten als **Bottom Sheets** (½ / voll), Kostenleiste als Chip; Tabellen als Kartenliste. Tablet (768 px): Explorer als Overlay, Canvas + Eigenschaften zweigeteilt.

## 4. Umsetzungsplan (Phasen D–J) mit Prüftoren
| Phase | Inhalt | Prüftor |
|---|---|---|
| D | `tokens.css`, Themen hell/dunkel, Komponenten (Knopf, Tab, Panel, Tabelle, Menü, Toast) vereinheitlicht | t78 ✔, ui_qa/axe ✔, Screenshots |
| E | Arbeitsplatz: Topbar neu, Explorer-Baum, Eigenschaften nach Auswahl, Dock ziehbar, Kostenleiste; Layout A wird zum Arbeitsplatz | t65 angepasst, t78 ✔, Gesamtlauf |
| F | Dock-Tabellen: Sortierung, Filter, Spaltenbreiten, Sprung, Prüfstatus inkl. «In Prüfung», Kapitel-/Abschnittskosten, Top-10 | t78 ✔, Performance 200 Datensätze |
| G | Modi Einfach/Standard/Experte, Befehlsleiste Strg+K, Kürzel | t78 ✔, Tastatur-Test |
| H | Mobile/Tablet: Bottom Sheets, Werkzeugleiste unten | 430/390/375/320/768 ohne Überlauf |
| I | QS: alle Grössen (1920…320), Funktions-, Regressions-, UX-Tests, Bericht | Abschlussbericht |
| J | Veröffentlichung Artefakt; GitHub Pages nach Klärung des Branches | Live-Prüfung soweit erreichbar |

## 5. Stand
- 06.11.2026: Phasen A–C erstellt, Regressions-Referenz und t78 eingeführt (keine Änderung an Oberfläche oder Rechnung).
- 06.11.2026 **Phase D umgesetzt:** `src/tokens.css` (Rollen-Tokens `--nc-*`), `src/workspace.css` (Thema «dunkel» für den Arbeitsplatz, bestehende Variablen auf Rollen abgebildet, hart codierte helle Flächen ersetzt). Umschalter ☀/☾ in der Kopfleiste (`lvd-theme`, Vorgabe dunkel, nicht im Projekt). Karte, Fachgrafiken, Druck/Bericht/Excel bleiben hell. axe hell und dunkel ohne Verstösse.
- 06.11.2026 **Phase E (Teil 1) umgesetzt:** Logo in der Kopfleiste; «Ebenen» in der Kopfleiste; **eine Statuszeile** (Fang · Koordinate/Massstab · Befehlszeile mit aktuellem Arbeitshinweis · Menü «Ansicht» mit Kartenquelle, Street View, geo.admin, Netzauskunft, Fenster zurücksetzen, Masshinweis · Urheber) statt drei Zeilen; **Dock-Höhe ziehbar** (Maus/Pfeiltasten, `lvd-dockh`); **Kostenleiste** einzeilig mit Länge, Aushub, Schächte, Netto, Brutto, Rabattstufe, Honorar, Hinweise (→ Dock) und offene Positionen; **Projektexplorer** als Reiter im linken Panel (Projekt, Zeichnung mit allen Objekten, Layer/Unterlagen inkl. DXF-Layer ein/aus, Datensätze; Suche; Klick wählt in Karte und Eigenschaften, Doppelklick zoomt); Kürzel **Strg+J** Dock, **Strg+B** Werkzeuge/Explorer, **Strg+F** Projektsuche. Arbeitsfläche 1440×900: **886×503 px statt ~790×302 px**. Test `t79` (29 Prüfungen, 1024–1920 px ohne Überlauf). Kosten unverändert (`t78`).
- **Offen (nächste Schritte):** Phase F (Dock-Tabellen: Sortierung, Spaltenbreiten, Kapitel-/Abschnittskosten, Status «In Prüfung»), Phase G (Modi Einfach/Standard/Experte, Befehlsleiste Strg+K), Phase H (Mobile Bottom Sheets – Handy startet weiterhin klassisch), Phase I/J (QS-Bericht, Veröffentlichung GitHub Pages).
