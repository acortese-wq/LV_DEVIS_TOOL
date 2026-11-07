# NIUcost – Abschlussbericht Redesign «Engineering-Arbeitsplatz»

App-Konzept und Urheber: **Alessandro Cortese** · Stand 07.11.2026 · Artefakt V103 · GitHub Pages live · Branch `claude/dreamy-cray-x10m0g`
Grundlage: Masterprompt NIUCOST (06.11.2026), Plan und Phasen-Stand in `docs/NIUCOST_REDESIGN.md`, Vorher/Nachher je Schritt in `docs/UX_AUDIT.md`.

## 1. Ergebnis in Kürze
- Die Kartenerfassung (Layout A) ist zu einem CAD/GIS-Arbeitsplatz ausgebaut: dunkles Engineering-Design aus den bestehenden Farben (Petrol bleibt Akzent, hell umschaltbar), Projektexplorer, kontextabhängige Eigenschaften, ziehbarer unterer Bereich mit Arbeitstabellen, einzeilige Kostenleiste, CAD-Statuszeile, Befehlsleiste **Strg+K**, Bedienmodi **Einfach / Standard / Experte**, Handy- und Tablet-Bedienung mit **Bottom Sheets**.
- **Rechnung unverändert:** Rechenkern (`src/kve.js`, `kve.py`) und Datenstrukturen nicht angefasst. Die vor dem Redesign eingefrorene Regressions-Referenz (64 Projekte, 2'732 Positionen) ist nach jeder Phase identisch (Test `t78`); Skill-Vergleich 300 Zufallsprojekte: 0 Abweichungen.
- **Keine Funktion entfernt:** alle Bedienelemente sind weiterhin erreichbar; im Modus «Einfach» ausgeblendete Werkzeuge bleiben über die Befehlsleiste aufrufbar (Test `t81`). Neue Einstellungen liegen nur in eigenen `localStorage`-Schlüsseln (`lvd-theme`, `lvd-uimode`, `lvd-dockh`, `lvd-ly-left`), nie im Projekt.

## 2. Umgesetzte Phasen
| Phase | Inhalt | Test |
|---|---|---|
| A–C | Bestandsanalyse (Funktion → Zone), Designanalyse/Token-Tabelle mit Kontrastwerten, UX-Konzept | – |
| Schutz | Regressions-Referenz `tests/fixtures/golden.json`, Vergleich im vm-Rechenkern | t78 |
| D | `tokens.css` (Rollen-Tokens `--nc-*`), dunkles Thema für den Arbeitsplatz, Umschalter ☀/☾ | t79 |
| E | Logo in der Kopfleiste, eine Statuszeile mit Befehlszeile und Menü «Ansicht», Dock ziehbar, Kostenleiste (Rabattstufe, Honorar, Hinweise), Projektexplorer, Kürzel Strg+J/B/F | t79 |
| F | Positionstabelle: Suche, Status-/Kapitelfilter, Sortierung, Spaltenbreiten, Prüfstatus inkl. **«In Prüfung»**; Kosten je Kapitel/Abschnitt, Top 10 mit Sprung | t80, t35 |
| G | Bedienmodi, Befehlsleiste Strg+K (Werkzeuge, Ansichten, Befehle, Objekte, LV-Positionen), Layout-Umschalter im Menü «Ansicht» | t81, t65 |
| H | Handy/Tablet: Arbeitsplatz startet auch mobil, Karte vollflächig, Menü ☰, Bereichsleiste mit Bottom Sheets (½/voll) | t82, t65 |
| I | QS-Matrix über alle Grössen und beide Themen, Performance, dieser Bericht | t83 |

## 3. Qualitätsprüfung (Phase I, Test `t83`)
Arbeitsplatz mit Demoprojekt, dunkel **und** hell (Werte identisch), axe-core inkl. Farbkontrast, Prüfung «alle Bereiche erreichbar» (Desktop: alle Dock-Reiter, Werkzeuge, Eigenschaften; mobil: alle fünf Blätter).

| Grösse | Überlauf | axe | Karte (px) | Anteil Bildschirm | Kosten = Referenz | Bereiche |
|---|---|---|---|---|---|---|
| 1920×1080 | nein | 0 | 1322×683 | 44 % | ja | erreichbar |
| 1440×900 | nein | 0 | 886×503 | 34 % | ja | erreichbar |
| 1280×800 | nein | 0 | 726×400 | 28 % | ja | erreichbar |
| 1024×768 | nein | 0 | 506×276 | 18 % | ja | erreichbar |
| 768×1024 (Tablet) | nein | 0 | 768×861 | 84 % | ja | erreichbar |
| 430×932 | nein | 0 | 430×769 | 83 % | ja | erreichbar |
| 390×844 | nein | 0 | 390×681 | 81 % | ja | erreichbar |
| 375×667 | nein | 0 | 375×504 | 76 % | ja | erreichbar |
| 320×568 | nein | 0 | 320×405 | 71 % | ja | erreichbar |

Zusätzlich: Handy quer 844×390 ohne Überlauf (t82); Zielgrössen mobil ≥ 44 px (t82); klassische Seite 320–1800 px weiterhin mit axe ohne Verstösse (`ui_qa`).
Vorher (vor dem Redesign) auf 1440×900: Karte ca. 790×302 px; auf dem Handy eine 665 px breite Scrollseite.

**Performance** (Chromium, Projekt mit 225 Datensätzen): Berechnung 3 ms, Filtern der Positionstabelle 9 ms, Sortieren 9 ms, Arbeitsplatz nach Neuladen in ca. 0.5 s offen.

**Gesamtlauf:** alle Tests (Browser-Tests, `ui_qa` mit axe, Skill-Vergleich) ohne Fehler – Ergebnis siehe Abschnitt 6.

In der QS gefundene und behobene Fehler: Bereichsknopf «Auswertung» ohne `aria-controls` (Dock entsteht später; jetzt verzögert verknüpft); offenes Menü «Ansicht» fing Esc vor der Befehlsleiste ab; im Modus «Einfach» verschwand ein aktives Zusatzwerkzeug samt Fokus; Kopfleiste bei 1440/1024 px zu voll; gefilterte Positionstabelle blieb gescrollt.

## 4. Was sich für die Benutzer ändert (bewusst)
- Prüfstatus auf der Ergebnisseite: «Geprüft» braucht zwei Klicks (neuer Zwischenschritt «In Prüfung»).
- Layout-Umschalter (A / B–D / klassisch) liegt im Menü «Ansicht» (Desktop) bzw. «Mehr › Ansicht» (Handy).
- Handy startet im Arbeitsplatz statt auf der klassischen Seite (klassisch weiterhin wählbar, Wahl wird gemerkt).
- Arbeitsplatz startet dunkel; Wahl hell/dunkel wird gemerkt. Karte, Fachgrafiken, Druck, Bericht und Excel bleiben hell.

## 5. Offen / bewusst nicht umgesetzt
- **1024 px:** Karte nur 18 % der Fläche (Werkzeuge, Eigenschaften und Dock gleichzeitig). Abhilfe heute: Dock einklappen (Strg+J) oder Seitenleisten minimieren; ein automatisch eingeklapptes Dock unter 1100 px wäre der nächste Schritt.
- **Tablet zweigeteilt** (Karte + Eigenschaften nebeneinander auf 768–1024 px hochkant) nicht umgesetzt; Tablet nutzt die Handy-Bedienung.
- Aus dem Konzept (Phase C) noch nicht umgesetzt: Kontextmenü im Explorer (Umbenennen/Duplizieren/Löschen), Kosten-Delta nach «Übernehmen», Dock-Reiter «LV» und «Annahmen» im Modus Experte.
- ~~Phase J~~ → erledigt, siehe Abschnitt 7.

## 6. Tests und Nachvollziehbarkeit
- Neue Tests dieses Redesigns: `t78` (Referenz), `t79` (Arbeitsplatz), `t80` (Dock-Tabellen), `t81` (Modi/Befehlsleiste), `t82` (Handy/Tablet), `t83` (QS-Matrix). Angepasst: `t35` (Prüfstatus-Zyklus), `t65` (Layout-Umschalter, Handy).
- Gesamtlauf `node tests/run.js` am Ende von Phase I: 63 Tests, alle ohne Fehler; Skill-Vergleich 0 Abweichungen.

## 7. Phase J – Veröffentlichung (07.11.2026)
- **Claude-Artefakt** aktualisiert (V103): https://claude.ai/artifact/F2BDoDDnQFxmsbmzGnwKxx
- **GitHub Pages** veröffentlicht automatisch aus dem Hauptbranch `claude/dreamy-cray-x10m0g` (Workflow «pages build and deployment», Umgebung `github-pages`); jeder Push aktualisiert die Live-Seite https://acortese-wq.github.io/LV_DEVIS_TOOL/. Der Stand von Phase I (Commit `fb47f61`) wurde am 07.11.2026 erfolgreich ausgeliefert (Status «success»). Die Live-Seite selbst ist aus der Arbeitsumgebung nicht aufrufbar; geprüft wurde über die GitHub-Schnittstelle.
